// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'

// 基本頁面
import Home from '../pages/Home.vue'
import Dashboard from '../pages/Dashboard.vue'
import Recipes from '../pages/Recipes.vue'

// Authentication 頁面
import Login from '../pages/Login.vue'
import Register from '../pages/Register.vue'

const routes = [
  { path: '/', component: Home, meta: { public: true } },       // 公開
  { path: '/recipes', component: Recipes, meta: { public: true } }, // 公開
  { path: '/dashboard', component: Dashboard },                 // 需登入
  { path: '/login', component: Login, meta: { public: true } },
  { path: '/register', component: Register, meta: { public: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 取得當前使用者
function getCurrentUser() {
  return new Promise(resolve => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop()
      resolve(user)
    })
  })
}

// 全域守衛：檢查是否需要登入
router.beforeEach(async (to) => {
  if (to.meta?.public) return true
  const user = await getCurrentUser()
  return user ? true : '/login'
})

export default router