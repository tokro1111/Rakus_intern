<script setup>
import { provide, ref, onBeforeUnmount, onMounted  } from "vue"

// #region reactive state
const userName = ref("")
// #endregion

// #region global variable
provide("userName", userName)
// #endregion

const showReloadWarning = (event) => {
  event.preventDefault()
  event.returnValue = ""
}

onMounted(() => {
  window.addEventListener("beforeunload", showReloadWarning)
})

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", showReloadWarning)
})

</script>

<template>
  <router-view />
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  background-color: #F6F0EA; /* 背景色を設定 */
}

#app {
  display: flex;
}
</style>
