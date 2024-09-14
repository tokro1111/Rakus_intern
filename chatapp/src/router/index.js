import { createRouter, createWebHistory } from "vue-router"
import Chat from "../components/Chat.vue"
import Login from "../components/Login.vue"
import Register from '../components/Register.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "login",
      component: Login
    },{
      path: "/chat/",
      name: "chat",
      component: Chat,
      beforeEnter: (to, from, next) => {
        if(from.name === "login"){
          next()
        } else {
          next({ name:"login" })
        }
      },
    },{
      path: "/register/",
      name: "register",
      component: Register
    }
  ],
})

export default router