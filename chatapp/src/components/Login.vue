<script setup>
import { inject,computed, ref,watch } from "vue"
import { useRouter } from "vue-router"
import socketManager from '../socketManager.js'
import { createClient } from '@supabase/supabase-js';

//Supabaseの設定
const supabaseUrl=import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey=import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase=createClient(supabaseUrl, supabaseAnonKey)

// #region global state
const userName = inject("userName");
// #endregion

// #region local variable
const router = useRouter()
const socket = socketManager.getInstance()
// #endregion

// #region reactive variable
const inputUserName = ref("");
const inputPassword = ref("");
const errorMessage=ref("");
const isUsernameEmpty=computed(()=>!inputUserName.value.trim());
const isPasswordEmpty=computed(()=>!inputPassword.value.trim());
// #endregion

// #region browser event handler
  //ユーザーにエラーメッセージを見せる
const showError=ref(false)
const showalert=ref(false)
// 入室メッセージをクライアントに送信する
const showErroralert=()=>{
  alert("ユーザー名またはパスワードは必ず入力してください\n未入力のまま入室はできません")
}

async function checkUser(userName,userPassword){
  const {data,error}=await supabase
  .from('user_data')
  .select('user_name','user_password')
  .eq('user_name',userName)
  .eq('user_password',userPassword);

  console.log("Data:", data);
  console.log("Error:",error);

  if(error==null){
    return data.length>0;
  }else{
    console.error('Error checking user name or password:',error);
    showError.value=true;
    errorMessage.value='認証中にエラーが発生しました';
    return false;
  }
}

const onEnter = async () => {
  // ユーザー名またはパスワードが空かどうかをチェック
  showError.value = isUsernameEmpty.value || isPasswordEmpty.value;
  showalert.value = isUsernameEmpty.value || isPasswordEmpty.value;
  if (showError.value) {
    // エラーメッセージを表示
    console.log("The UserName or Password is empty or whitespace only");
    errorMessage.value = "ユーザー名またはパスワードが未入力です";
    return;  // エラーの場合は処理を中断
  }

  try {
    // ユーザーの認証を確認
    const userIsValid = await checkUser(inputUserName.value, inputPassword.value);
    console.log(userIsValid);
    if (userIsValid) {
      // 入室メッセージを送信
      socket.emit("inputUserName", inputUserName.value);
      // 全体で使用する名前に入力されたユーザー名を格納
      userName.value = inputUserName.value;
      console.log(`${userName.value} Enter`);
      // チャット画面へ遷移
      router.push({ name: "chat" });
    } else {
      // 認証失敗時の処理
      console.log("User name or password is wrong");
      showError.value=true;
      errorMessage.value = 'ユーザー名またはパスワードが間違っています';
    }
  } catch (error) {
    // エラーハンドリング
    console.error("An error occurred during user validation:", error);
    showError.value=true;
    errorMessage.value = "エラーが発生しました";
  }
};

const onRegister=()=>{
  router.push({ name: "register" });
}

watch(showalert,(newValue)=>{
  if(newValue){
    showErroralert();
  }
})
// #endregion
</script>

<template>
  <v-card class="mx-auto px-6 py-8" max-width="344">
    <img src="../images/rakurakukouryu_icon.png" width=100%>
    <v-form v-model="form">
      <v-text-field label="username" placeholder="Enter your name" v-model="inputUserName" prepend-inner-icon="mdi-account"></v-text-field>
      <v-text-field label="パスワード" placeholder="Enter your password" v-model="inputPassword" prepend-inner-icon="mdi-lock"></v-text-field>
      <p v-if="showError" class="error-message">{{ errorMessage }}</p>
      <v-btn color="#EA6F00" size="large" @click="onEnter" block class="mb-5">Sign In</v-btn>
      <v-layout align-center justify-center>
      <span>アカウントを持っていませんか？</span>
    </v-layout>
      <v-btn color="#EA6F00" size="small" @click="onRegister" block class="mb-2">Sign Up</v-btn>
    </v-form>
  </v-card>
</template>

<style scoped>
.user-name-text {
  width: 200px;
  border: 1px solid #888;
  margin-bottom: 16px;
}

.error-message{
  color: red;
}
</style>
