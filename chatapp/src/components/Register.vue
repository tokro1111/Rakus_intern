<script setup>
import { ref, computed } from 'vue';
import { useRouter } from "vue-router"
import { createClient } from '@supabase/supabase-js';

const router = useRouter()

// DBの設定
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// フォーム、ユーザー名、パスワード、メニューの状態、日付
const inputUserName = ref('');
const inputPassword = ref('');
const menu = ref(false); // Boolean 型の値
const date = ref(null); // 選択された日付
const errorMessage=ref('');
const showError = ref(false);


// 日付をフォーマットする計算プロパティ
const formattedDate = computed(() => {
  if (!date.value) return '';
  return new Date(date.value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
});

const calculateAge = (birthDate) => {
  const today = new Date();
  const birthDateObj = new Date(birthDate);
  let age = today.getFullYear() - birthDateObj.getFullYear();
  const monthDifference = today.getMonth() - birthDateObj.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDateObj.getDate())) {
    age--;
  }
  return age;
};

// データベースにデータを挿入する関数
const sendToDB = async (tableName, data) => {
  console.log(`Sending data to ${tableName}:`, data); // デバッグ用ログ
  const { data: insertData, error } = await supabase.from(tableName).insert(data);

  if (error) {
    console.error(`Error inserting data into ${tableName}:`, error.message);
    console.error('Error details:', error.details);
    console.error('Error hint:', error.hint);
  } else {
    console.log(`Data inserted successfully into ${tableName}:`, insertData);
  }
};

async function checkUserNameExists(userName) {
  const { data, error } = await supabase
    .from('user_data')
    .select('user_name')
    .eq('user_name', userName);

  if (error) {
    console.error('Error checking user name:', error);
    return true; // エラーがあった場合、重複扱いにする
  }

  return data.length > 0; // 既にユーザー名が存在するか確認
}

// サインアップ処理
const onSignUp = async () => {
  // エラー処理
  const age = calculateAge(date.value);
  if (age < 18) {
    showError.value = true;
    errorMessage.value = '18歳未満は登録できません';
    console.log("The User is a minor");
    return;
  }
  if (!inputUserName.value && !date.value && !inputPassword.value) {
    showError.value = true;
    console.log("Error: Username and Birthday and Password are required");
    errorMessage.value = 'ユーザー名、生年月日、パスワードの入力は必須です';
    return; // 未入力なら処理を中断
  }
  if (!inputUserName.value　&& !date.value) {
    showError.value = true;
    console.log("Error: Username and date are required");
    errorMessage.value = 'ユーザー名と生年月日を入力してください';
    return; // ユーザー名が未入力の場合の処理
  }
  if (!date.value && !inputPassword.value) {
    showError.value = true;
    console.log("Error: Birthday and Password are required");
    errorMessage.value = '生年月日とパスワードを入力してください';
    return;
  }
  if (!inputUserName.value && !inputPassword.value) {
    showError.value = true;
    console.log("Error: Username and Password are required");
    errorMessage.value = 'ユーザー名とパスワードを入力してください';
    return;
  }
  if (!inputUserName.value) {
    showError.value = true;
    console.log("Error: Username are required");
    errorMessage.value = 'ユーザー名を入力してください';
    return; // ユーザー名が未入力の場合の処理
  }
  if (!date.value) {
    showError.value = true;
    console.log("Error: Birthday are required");
    errorMessage.value = '生年月日を入力してください';
    return;
  }
  if (!inputPassword.value) {
    showError.value = true;
    console.log("Error: Password are required");
    errorMessage.value = 'パスワードを入力してください';
    return;
  }
  
  showError.value = false;

  // ユーザー名が既に存在するかを確認
  const isUserNameTaken = await checkUserNameExists(inputUserName.value);
  if (isUserNameTaken) {
    console.error('User name is already taken');
    showError.value = true;
    errorMessage.value = 'そのユーザー名は既に使用されています';
    return; // 重複している場合は処理を中断
  }

  // DBへの登録処理
  const userData = {
    user_name: inputUserName.value,
    user_birthdate: date.value,
    user_password: inputPassword.value
  };

  // データを挿入
  const { data, error } = await supabase
    .from('user_data')
    .insert([{ user_name: userData.user_name, user_birthdate: userData.user_birthdate , user_password: userData.user_password}]);

  if (error) {
    console.error('Error inserting data into user_data:', error);
    showError.value = true;
    errorMessage.value = 'そのユーザー名は既に存在しています';
    return;
  }

  console.log('Sign Up Clicked'); // デバッグ用コンソールログ
  console.log('User Name:', inputUserName.value);
  console.log('Date:', date.value);

  // 登録成功後にログイン画面へリダイレクト
  router.push({ name: "login" });
};

const backLogin=()=>{
  router.push({ name: "login" });
}

</script>

<template>
  <v-card class="mx-auto px-6 py-8" max-width="344">
    <img src="../images/rakurakukouryu_icon.png" width=100%>
    <h1 class="title">新規登録</h1>
    <v-form>
      <v-text-field
        label="New username"
        placeholder="Enter your name"
        v-model="inputUserName"
        prepend-inner-icon="mdi-account"
      ></v-text-field>
      <v-text-field
      label="New password"
      placeholder="Enter new password"
      v-model="inputPassword"
      prepend-inner-icon="mdi-account"
      ></v-text-field>

      <!-- カレンダー入力 -->
      <v-date-picker
        v-model="date"
        locale="en" 
        class="mt-4"
      ></v-date-picker>
      <v-text-field
        :value="formattedDate" 
        label="Enter your birthday"
        prepend-icon="mdi-calendar"
        readonly
        class="mt-2"
      ></v-text-field>

      <!-- エラーメッセージ -->
      <p v-if="showError" class="error-message">{{ errorMessage }}</p>

      <!-- 登録ボタン -->
      <v-btn color="#EA6F00" size="large" @click="onSignUp" block>Sign Up</v-btn>
      <!-- 戻るボタン-->
      <v-btn color="#EA6F00" size="small" @click="backLogin" block class="mt-3">Back</v-btn>
    </v-form>
  </v-card>
</template>

<style scoped>
.title{
  color:#EA6F00;
  padding: 5px;
  text-align: center;
}
.error-message{
  color: red;
}
</style>
