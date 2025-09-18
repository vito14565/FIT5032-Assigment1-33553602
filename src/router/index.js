// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { auth, db } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

// Eager-loaded pages（常用頁面可保留 eager）
import Home from '../pages/Home.vue'
import Dashboard from '../pages/Dashboard.vue'
import Recipes from '../pages/Recipes.vue'

// Auth pages
import Login from '../pages/Login.vue'
import Register from '../pages/Register.vue'

// Admin-only page（可保留 eager）
import AdminPanel from '../pages/AdminPanel.vue'

// Lazy-loaded: Tables（BR D.3）
const Tables = () => import('../pages/Tables.vue')

const routes = [
  { path: '/', name: 'Home', component: Home, meta: { public: true } }, // Public
  { path: '/dashboard', name: 'Dashboard', component: Dashboard },      // Auth required
  { path: '/recipes', name: 'Recipes', component: Recipes },            // Auth required

  // Admin routes
  { path: '/admin', name: 'AdminPanel', component: AdminPanel, meta: { role: 'admin' } },
  { path: '/tables', name: 'Tables', component: Tables, meta: { role: 'admin' } }, // <-- 新增

  // Auth pages（publicOnly：登入中不可進）
  { path: '/login', name: 'Login', component: Login, meta: { public: true, publicOnly: true } },
  { path: '/login/:rest(.*)?', component: Login, meta: { public: true, publicOnly: true } },
  { path: '/register', name: 'Register', component: Register, meta: { public: true, publicOnly: true } },

  // 可選：簡單 404（保持風格簡單）
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(), // 或 createWebHistory(import.meta.env.BASE_URL)
  routes,
})

/** 取得目前使用者（已快取則同步回傳） */
function getCurrentUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop()
      resolve(user)
    })
  })
}

/** 從 Firestore 取得使用者角色（users/{uid}.role），預設 'user' */
async function getUserRole(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data().role || 'user') : 'user'
}

/** 全域守門員 */
router.beforeEach(async (to) => {
  // 1) Public routes：總是允許
  if (to.meta?.public) {
    // 已登入者不可進 publicOnly（login/register）
    if (to.meta.publicOnly && (await getCurrentUser())) {
      return { name: 'Dashboard' }
    }
    return true
  }

  // 2) 需要登入
  const user = await getCurrentUser()
  if (!user) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // 3) 需要角色（如 admin）
  if (to.meta?.role) {
    const role = await getUserRole(user.uid)
    if (to.meta.role === 'admin' && role !== 'admin') {
      return { name: 'Dashboard' }
    }
  }

  return true
})

export default router