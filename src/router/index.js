// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { auth, db } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

// Eager-loaded pages
import Home from '../pages/Home.vue'
import Dashboard from '../pages/Dashboard.vue'
import Recipes from '../pages/Recipes.vue'

// Auth pages
import Login from '../pages/Login.vue'
import Register from '../pages/Register.vue'

// Admin-only page
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

  // Auth pages
  { path: '/login', name: 'Login', component: Login, meta: { public: true, publicOnly: true } },
  { path: '/login/:rest(.*)?', component: Login, meta: { public: true, publicOnly: true } },
  { path: '/register', name: 'Register', component: Register, meta: { public: true, publicOnly: true } },

  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(), // or createWebHistory(import.meta.env.BASE_URL)
  routes,
})

/** Get the current user (return synchronously if cached) */
function getCurrentUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop()
      resolve(user)
    })
  })
}

/** Get user role from Firestore (users/{uid}.role), default to 'user' */
async function getUserRole(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data().role || 'user') : 'user'
}

/** Global guard */
router.beforeEach(async (to) => {
  // 1) Public routes：always allow
  if (to.meta?.public) {
    // Logged-in users cannot access publicOnly routes (login/register)
    if (to.meta.publicOnly && (await getCurrentUser())) {
      return { name: 'Dashboard' }
    }
    return true
  }

  // 2) need login 
  const user = await getCurrentUser()
  if (!user) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // 3) need role（ex. admin）
  if (to.meta?.role) {
    const role = await getUserRole(user.uid)
    if (to.meta.role === 'admin' && role !== 'admin') {
      return { name: 'Dashboard' }
    }
  }

  return true
})

export default router