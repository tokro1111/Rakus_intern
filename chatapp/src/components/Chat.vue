<script setup>
import { inject, ref, reactive, onMounted, computed, nextTick, watch } from "vue"
import socketManager from '../socketManager.js'
import moment from 'moment';
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'; // uuidライブラリをインポート

// DB
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)
const sentId = ref('');  // 送信したIDの表示用

async function sendToDB(tableName, data) {
  const { data: insertData, error } = await supabase.from(tableName).insert(data);

  if (error) {
    // 失敗した場合のログ
    console.error(`Error inserting data into ${tableName}:`, error.message);
    console.error('Error details:', error.details);
    console.error('Error hint:', error.hint);
  } else {
    // 成功した場合のログ
    console.log(`Data inserted successfully into ${tableName}:`, insertData);
  }
}

async function getFromDB(tableName, roomId) {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq('room_id', roomId) // Filter messages by roomId

  if (error) {
    console.error(`Error fetching data from ${tableName}:`, error.message);
  }

  return data;
}

// 入室時間のDBを取得
async function getETFromDB(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")

  if (error) {
    console.error(`Error fetching data from ${tableName}:`, error.message);
  }

  return data;
}

// #region global state
const userName = inject("userName")
// #endregion

// # 投稿制限回数/分
const Counts = 1
const limitReached = ref(false) // 新しい変数追加

// #region local variable
const socket = socketManager.getInstance()
// #endregion

// # チャット関係
const chatContent = ref("")
const chatList = reactive([])
const showMemo = ref(false)   // メモ欄の表示/非表示を管理
const memoList = reactive([])

// ユーザー表示関連
const userList = reactive([])
const nowRoomId = ref("")
const enterTimeList = reactive([])
const userActivity = reactive({Active: [], NonActive: []})

// # チャネル
const links = [
  ['mdi-account-group', 'Home', 'Home'],
  ['mdi-book-open', '履修', 'study'],
  ['mdi-soccer', 'サークル', 'circle'],
]
const selectedRoom = ref("") // デフォルトでどこにも所属していない

// エラー関係
const errorShow = ref(false)
const emptyIs = computed(() => !chatContent.value.trim())
// #endregion

// #region lifecycle
// チャットが更新された後にスクロールする処理

onMounted(() => {
  // ページの読み込みや、閉じたさいにlogout
  window.onbeforeunload = function () {
    onExit(selectedRoom)
  }
  registerSocketEvent()
  // 入室時間情報の更新
  fetcheenterTimes();

  const fetchChatHistory = async () => {
    // DBから履歴を取得して表示
    const historyMessages = await getFromDB("test_tanaka_chat_messages");
    if (historyMessages && historyMessages.length > 0) {
      historyMessages.forEach((message) => {
        chatList.push({
          userName: message.user_name,
          message: message.user_message,
          date: message.submit_date,
          event_type: message.event_type,
        });
      });
      console.log("履歴呼び出し")
    }
  };
  // 非同期関数を呼び出す
  fetchChatHistory();
  window.addEventListener('keydown', handleKeyDown);
})

const handleKeyDown = (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    if (showMemo.value) {
      onMemo(); // メモを投稿
    } else {
      onPublish(); // チャットを送信
    }
  }
};

const fetcheenterTimes = async () => {
  enterTimeList.length = 0
  const enterTimesDB = await getETFromDB("login_times");
  if (enterTimesDB && enterTimesDB.length > 0) {
    enterTimesDB.forEach((row) => {
      enterTimeList.push({
        userName: row.user_name,
        login_time: row.login_time,
      })
    });
  };
}

const fetchActiveTime = async () => {
  const currentTime = Date.now();
  let ActiveUsers = [];
  let NonActiveUsers = [];
  const enterTimesDB = await getETFromDB("login_times");
  if (enterTimesDB && enterTimesDB.length > 0) {
    enterTimesDB.forEach((row) => {
    if (userList.includes(row.user_name)){
      if (currentTime - row.active_time < 60000) {
        ActiveUsers.push(row.user_name)
      }
      else {
        NonActiveUsers.push(row.user_name)
      }
    }
    });
  };
  userActivity.Active = ActiveUsers.slice();
  userActivity.NonActive = NonActiveUsers.slice();
}
setInterval(fetchActiveTime, 5000); // 5秒ごとにアクティブ状態かを確認

// #region browser event handler
// レート制限をチェックする関数
const rateLimit = (func, limitCount, duration) => {
  let calls = 0;
  let lastReset = Date.now();

  return (...args) => {
    const now = Date.now();
    if (now - lastReset > duration) {
      // 指定された時間が経過したらカウンターをリセット
      calls = 0;
      lastReset = now;
    }

    if (calls < limitCount) {
      calls++;
      func(...args);
    } else {
      limitReached.value = true; // 制限に達した場合はポップアップ表示
      setTimeout(() => {

        limitReached.value = false; // 5秒後に非表示にする
      }, 5000);
    }
  };
};

// メッセージのバリデーションとエラー表示
const validateMessage = () => {
  if (emptyIs.value) {
    console.log("The content is empty or whitespace only");
    return false;
  }
  return true;
};

async function deleteRows(tableName){
  const { error } = await supabase.from("login_times").delete().eq("user_name", userName.value);

  if (error) {
    console.error(`Error fetching data from ${tableName}:`, error.message);
  }
}

const updateEnterTime = async ()=> {
  await deleteRows("login_times");
  const user_login_time = moment().format('YYYY/MM/DD/HH:mm:ss');

  let messageData = {
    user_name: userName.value,
    room_id: selectedRoom.value,
    login_time: user_login_time,
    active_time: Date.now(),
  };

  await sendToDB("login_times", messageData)
}

// メッセージをサーバに送信する処理
const sendMessage = () => {

  // メッセージの送信時間を別DBに記録
  updateEnterTime();

  // 固有のIDを生成
  const uniqueId = uuidv4(); // uuidv4関数を使ってUUIDを生成
  const room_id = selectedRoom.value
  const user_message_type = "group_chat"
  const date = moment().format('YYYY/MM/DD/HH:mm:ss');
  const event_type = "message"
  socket.emit("publishEvent", { roomId: selectedRoom.value, userName:userName.value, message: chatContent.value, date:date, event_type:event_type})

  let messageData = {
    unique_id: uniqueId, // 生成されたuuidを追加
    room_id: room_id, // 仮
    user_name: userName.value,
    user_message: chatContent.value,
    user_message_type: user_message_type,// 仮
    submit_date: date,
    event_type: event_type,
  };
  // test_tanaka_chat_messages（chat_messagesにmessage_typeを加えた）というテーブルを作成しています。
  sendToDB("test_tanaka_chat_messages", messageData)
  // メッセージ送信後に入力フィールドをクリア
  chatContent.value = "";
};

// sendMessage 関数を rateLimit でラップ
const limitedSendMessage = rateLimit(sendMessage, Counts, 60000);

// 投稿メッセージをサーバに送信する
const onPublish = () => {
  errorShow.value = emptyIs.value;

  if (validateMessage()) {
    limitedSendMessage();
  }
};

// 下にスクロールする関数
const scrollToBottom = () => {
  let elm = document.documentElement;
  let bottom = elm.scrollHeight - elm.clientHeight;
  window.scroll(0, bottom);
};

// チャットリストが更新されたときスクロールを下にする
watch(chatList, () => {
    nextTick(() => {
      scrollToBottom();
    });
  },
);

// 退室メッセージをサーバに送信する
const onExit = (roomId) => {
  // sendMessageを参考
  const uniqueId = uuidv4();
  const room_id = roomId
  const user_message_type = "group_chat"
  const date = moment().format('YYYY/MM/DD/HH:mm:ss');
  const event_type = "exit"
  const exit_message = userName.value + "さんが退室しました"
  socket.emit("exitEvent", { roomId: roomId, userName: userName.value, message: exit_message, event_type: event_type })
  let messageData = {
    unique_id: uniqueId,
    room_id: room_id,
    user_name: userName.value,
    user_message: exit_message,
    user_message_type: user_message_type,
    submit_date: date,
    event_type: event_type,
  };

  // test_tanaka_chat_messages（チャット履歴+入退室の判別）というテーブルを作成しています。
  sendToDB("test_tanaka_chat_messages", messageData)
  userList.length = 0;
}

// 入室メッセージをサーバに送信する
const onEnter = (roomId) => {
  // sendMessageを参考
  const uniqueId = uuidv4();
  const room_id = roomId
  const user_message_type = "group_chat"
  const date = moment().format('YYYY/MM/DD/HH:mm:ss');
  const event_type = "enter"
  const enter_message = userName.value + "さんが入室しました"
  socket.emit("enterEvent", { roomId: roomId, userName: userName.value, message: enter_message, event_type:event_type })
  let messageData = {
    unique_id: uniqueId,
    room_id: room_id,
    user_name: userName.value,
    user_message: enter_message,
    user_message_type: user_message_type,
    submit_date: date,
    event_type: event_type,
  };

  // test_tanaka_chat_messages（チャット履歴+入退室の判別）というテーブルを作成しています。
  sendToDB("test_tanaka_chat_messages", messageData)
}

// room選択した後に入室メッセージを選択
const clickedRoom = async (roomId) => {
  fetcheenterTimes()
  nowRoomId.value = roomId; // 選択後のroomIdを格納
  onExit(selectedRoom.value);
  selectedRoom.value = roomId; // 選択後のroomIdを格納 (修正する必要あり)
  chatList.length = 0; // Clear chat messages when entering a new room
  updateEnterTime(); // update times of entering channels

  // Fetch messages for the selected room
  const historyMessages = await getFromDB("test_tanaka_chat_messages", selectedRoom.value);
  if (historyMessages && historyMessages.length > 0) {
    historyMessages.forEach((message) => {
      chatList.push({
        userName: message.user_name,
        message: message.user_message,
        date: message.submit_date,
        event_type: message.event_type
      });
    });
  }
  onEnter(selectedRoom.value);
  console.log(chatList);
  
};

// メモを画面上に表示する
const onMemo = () => {
  // メモの内容を表示
  showMemo.value = true;
  // 入力欄を初期化
  if (chatContent.value.trim()) {
    // Display the memo content
    const date = moment().format('YYYY/MM/DD/HH:mm:ss');
    const lf = '\n'; // 改行コードを変数に格納
    memoList.unshift(`${chatContent.value}`);
    // Clear the input field
    chatContent.value = "";
  }

}

// メモ削除機能
const removeMemo = (index) => {
  memoList.splice(index, 1);
};

// 自身の名前を入室者に送信
const onExist = (roomId) => {
  socket.emit("publishExistEvent", { roomId: roomId, message: userName.value })
}
// #endregion

// #region socket event handler
// サーバから受信した入室メッセージ画面上に表示する
const onReceiveEnter = (data) => {
  chatList.push({
    event_type: data.event_type,
    message: data.message
  })
  onExist(nowRoomId.value)
}

// サーバから受信した退室メッセージを受け取って画面上に表示する
const onReceiveExit = (data) => {
  const nameIdx = userList.indexOf(data.userName)
  if (nameIdx !== -1) {
    userList.splice(nameIdx, 1)
  }
  chatList.push({
    event_type: data.event_type,
    message: data.message
  })
}

// 入室中の人の名前を取得
const onReceiveExist = (data) => {
  if (userList.includes(data) == false) {
    userList.push(data);
    userList.sort();
  }
}

// サーバから受信した投稿メッセージを画面上に表示する
const onReceivePublish = (data) => {
  chatList.push({
      userName: data.userName,
      message: data.message,
      date: data.date,
      event_type: data.event_type,
  });
}


// #endregion

// #region local methods
// イベント登録をまとめる
const registerSocketEvent = () => {
  // 入室イベントを受け取ったら実行
  socket.on("enterEvent", (data) => {
    onReceiveEnter(data)
  })

  // 退室イベントを受け取ったら実行
  socket.on("exitEvent", (data) => {
    onReceiveExit(data)
  })

  // 投稿イベントを受け取ったら実行
  socket.on("publishEvent", (data) => {
    onReceivePublish(data)
  })

  // 入室済みの人の名前の受け取りイベントが発生したら実行
  socket.on("publishExistEvent", (data) => {
    onReceiveExist(data)
  })
}

// #endregion
</script>


<template>
  <v-app>
    <v-navigation-drawer permanent color="#F6F0EA">
      <v-sheet class="pa-4" color="#F6F0EA">
        <!-- ユーザーアイコン -->
        <img src="../images/rakurakukouryu_icon.png" width=100%>

        <!-- ユーザ名 -->
        <v-container class="justify-center">
          <h5>ログインユーザー:</h5>
          <h3>{{ userName }}さん</h3>
          <v-btn to="/" color="red" @click="onExit(selectedRoom)">Logout</v-btn>
        </v-container>
      </v-sheet>

      <v-divider></v-divider>
      <!-- チャネル -->
      <v-list>
        <v-list-subheader>チャネル</v-list-subheader>
        <v-list-item v-for="[icon, text, roomId] in links" :key="icon" :prepend-icon="icon" :title="text"
          :value="roomId" @click="clickedRoom(roomId)" link></v-list-item>
      </v-list>

      <v-divider></v-divider>
      <!-- 入室者一覧 -->
      <v-list>
        <v-list-subheader>入室者一覧</v-list-subheader>
        <v-list-item v-for="(user, i) in userActivity.Active" :key="i">{{ user }}</v-list-item>
        <v-list-item class="NonActiveUser-display" v-for="(user, i) in userActivity.NonActive" :key="i">{{ user }}</v-list-item>
      </v-list>
      
      <v-divider></v-divider>
      <!-- 最終ログイン -->
      <v-list-subheader>最終ログイン</v-list-subheader>
      <v-list v-for="(dic, i) in enterTimeList" :key="i">
        <v-list-item-title v-for="(values, key) in dic" :key="key">{{ values }}</v-list-item-title>
      </v-list>
    </v-navigation-drawer>

    <!-- チャットエリア -->
    <v-main>
      <v-container class="py-5 px-0 d-flex flex-column chat-display" fluid>
        <v-row class="flex-grow-1">
          <v-col cols="12">
            <!-- 部屋が選択されていない場合のメッセージ -->
            <v-card v-if="!selectedRoom">
              <v-card-text>どこにも入室していません</v-card-text>
            </v-card>

            <v-sheet v-else v-for="(chat, i) in chatList" :key="i">
              <!-- chat.messageが入室or退室 -->
               <v-sheet v-if="chat.event_type == 'enter' || chat.event_type == 'exit'">
                 <v-card  class='enter-exit-message'>
                   <!-- ユーザー名とメッセージを表示 -->
                   <v-list-item-title>
                    {{ chat.message }}
                   </v-list-item-title>
                 </v-card>
               </v-sheet>

              <!-- chat.messageがチャットの場合 -->
              <v-sheet v-if="chat.event_type ==  'message'" class="mx-3 my-5">
                <div v-bind:class="[chat.userName == userName ? 'text-right user-date-text' : 'text-left user-date-text']"> {{ chat.userName }}さん: <span class="date-color">{{ chat.date }}</span></div>
                <v-card v-bind:class="[chat.userName == userName ? 'my-message' : 'other-message']" :style="{ borderRadius: '10px', }" elevation="1">
                  <v-card-text style="white-space: pre-line;">{{ chat.message }}</v-card-text>
                </v-card>
              </v-sheet>

            </v-sheet>
          </v-col>
        </v-row>
      </v-container>
      <v-form class="chat-form">
        <!-- メモ表示部分 -->
        <v-row v-show="showMemo" class="mt-4">
          <v-col cols="12">
            <v-card>
              <v-card-title>メモ欄</v-card-title>
              <v-list lines="two" v-if="memoList.length">
                <template v-for="(memo, i) in memoList.slice().reverse()" :key="i">
                  <v-list-item>
                    <v-list-item-content class="d-flex align-center">
                      <v-list-item-title class="mr-2 text-wrap" style="white-space: normal; flex: 1;">
                        <li> {{ memo }}</li>
                      </v-list-item-title>
                      <v-btn color="#EA6F00" variant="flat" @click="removeMemo(memoList.length - 1 - i)">
                        <v-icon>mdi-delete</v-icon>
                        <v-tooltip activator="parent" location="start">メモを削除</v-tooltip>
                      </v-btn>
                    </v-list-item-content>
                  </v-list-item>
                  <v-divider v-if="i < memoList.length - 1"></v-divider>
                </template>
              </v-list>
              <!-- メモがない場合のメッセージ -->
              <v-alert v-else type="info" color="#EA6F00" class="my-4">メモがありません。</v-alert>
            </v-card>
          </v-col>
        </v-row>

        <!-- 投稿エラーの表示 -->
        <v-container>
          <v-alert v-if="errorShow" type="error" dense outlined>投稿文は必須です</v-alert>
          <!-- 投稿回数制限のアラート -->
          <v-alert v-if="limitReached" type="warning" elevation="2" border="top" colored-border dismissible
            class="my-5">
            投稿回数の上限になりました。しばらく経ってからまたお試しください。
          </v-alert>
          <v-row>
            <!-- メッセージ入力欄 -->
            <v-col cols="11">
              <v-textarea v-model="chatContent" clear-icon="mdi-close-circle" label="Message"
                type="text" rows="3" class="chat-textarea custom-send-icon" bg-color="grey-lighten-2" clearable
                auto-grow></v-textarea>
            </v-col>
            <!-- アイコンボタン -->
            <v-col cols="1" class="d-flex flex-column">
              <!-- showMemoがfalseの時に表示されるボタン -->
              <!-- 送信ボタン -->
              <v-btn color="#EA6F00" variant="flat" @click="onPublish" class="mb-2" v-show="!showMemo"
                :disabled="!chatContent">
                <v-icon>mdi-send</v-icon>
                <v-tooltip activator="parent" location="start">送信する</v-tooltip>
              </v-btn>
              <!-- メモを開くボタン -->
              <v-btn color="#EA6F00" variant="flat" @click="showMemo = !showMemo" class="mb-2" v-show="!showMemo">
                <v-icon>mdi-note-edit</v-icon>
                <v-tooltip activator="parent" location="start">メモを開く</v-tooltip>
              </v-btn>
              <!-- showMemoがtrueの時に表示されるボタン -->
              <!-- メモを投稿するボタン -->
              <v-btn color="#EA6F00" variant="flat" @click="onMemo" class="mb-2" v-show="showMemo"
                :disabled="!chatContent">
                <v-icon>mdi-pencil-circle</v-icon>
                <v-tooltip activator="parent" location="start">メモを投稿する</v-tooltip>
              </v-btn>
              <!-- メモを閉じるボタン -->
              <v-btn color="#EA6F00" variant="flat" @click="showMemo = !showMemo" class="mb-2" v-show="showMemo">
                <v-icon>mdi-close-circle</v-icon>
                <v-tooltip activator="parent" location="start">メモを閉じる</v-tooltip>
              </v-btn>
            </v-col>
          </v-row>
        </v-container>
      </v-form>

    </v-main>
  </v-app>
</template>

<style scoped>
.message-error {
  color: red;
}

.chat-form {
  position: fixed;
  bottom: 3px;
  left: 256px;
  /* 画面の左端からスタートするように指定 */
  right: 0;
  /* 画面の右端まで伸ばす */
  background-color: white;
  box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.1);
  padding: 10px;
}

.chat-display {
  margin-bottom: 180px; /*チャット欄と入力欄が重ならないように*/
}

.date-color {
  color: #8b8687;
  /* ピンク色の例 */
  font-weight: bold;
  /* 太字にする例 */
}

.enter-exit-message {
  width: fit-content;
  margin: 10px auto; /* 中央に配置 */
  padding: 2px 20px;
  text-align: center;
  background-color: #dcdcdc;
}

.my-message {
  width: fit-content;
  margin-left: auto;
  margin-right: 0;
  text-align: end;
  background-color: #F6F0EA;
  max-width: 60%;
}

.other-message {
  width: fit-content;
  margin-left: 0;
  margin-right: auto;
  text-align: start;
  background-color: #F6F0EA;
  max-width: 60%;
}

.user-date-text {
  font-size: 12px;
}

.NonActiveUser-display {
  color: rgba(0, 0, 0, 0.4);
}
</style>