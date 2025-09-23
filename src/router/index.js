// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { auth, db } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

/* -------- Eager-loaded pages (small / frequently used) -------- */
import Home from '../pages/Home.vue'
import Dashboard from '../pages/Dashboard.vue'
import Recipes from '../pages/Recipes.vue'

/* -------- Auth pages -------- */
import Login from '../pages/Login.vue'
import Register from '../pages/Register.vue'

/* -------- Admin-only page -------- */
import AdminPanel from '../pages/AdminPanel.vue'

/* -------- Lazy-loaded pages (split chunks) -------- */
const Tables = () => import('../pages/Tables.vue')          // BR D.3 (admin)
const HealthyMap = () => import('../pages/HealthyMap.vue')  // BR E.2 Map page
const RecipeDetail = () => import('../pages/RecipeDetail.vue') // ✅ NEW: 詳細頁

const routes = [
  // Public pages
  { path: '/', name: 'Home', component: Home, meta: { public: true, title: 'Home' } },

  // Map page is public (so assessors can open without login)
  { path: '/map', name: 'HealthyMap', component: HealthyMap, meta: { public: true, title: 'Healthy Map' } },

  // Auth-required pages
  { path: '/dashboard', name: 'Dashboard', component: Dashboard, meta: { title: 'Dashboard' } },
  { path: '/recipes', name: 'Recipes', component: Recipes, meta: { title: 'Recipes' } },
  { path: '/recipes/:id', name: 'recipe-detail', component: RecipeDetail, meta: { title: 'Recipe Detail' } }, // ✅ NEW

  // Admin-only pages
  { path: '/admin', name: 'AdminPanel', component: AdminPanel, meta: { role: 'admin', title: 'Admin' } },
  { path: '/tables', name: 'Tables', component: Tables, meta: { role: 'admin', title: 'Tables' } },

  // Auth pages
  { path: '/login', name: 'Login', component: Login, meta: { public: true, publicOnly: true, title: 'Login' } },
  { path: '/login/:rest(.*)?', component: Login, meta: { public: true, publicOnly: true, title: 'Login' } },
  { path: '/register', name: 'Register', component: Register, meta: { public: true, publicOnly: true, title: 'Register' } },

  // Fallback
  { path: '/:pathMatch(.*)*', redirect: '/', meta: { public: true, title: 'Not Found' } },
]

const router = createRouter({
  // If deploying under a subpath, use createWebHistory(import.meta.env.BASE_URL)
  history: createWebHistory(),
  routes,
})

/** Return current user immediately if cached; otherwise wait for the first auth state */
function getCurrentUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop()
      resolve(user)
    })
  })
}

/** Read user role from Firestore: users/{uid}.role (default 'user') */
async function getUserRole(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data().role || 'user') : 'user'
}

/** Global navigation guard:
 * - Allow public routes
 * - Block publicOnly for signed-in users (e.g., login/register)
 * - Require auth for the rest
 * - Enforce role for admin routes
 */
router.beforeEach(async (to) => {
  // 1) Public routes: always allow
  if (to.meta?.public) {
    // Logged-in users cannot access publicOnly routes (login/register)
    if (to.meta.publicOnly && (await getCurrentUser())) {
      return { name: 'Dashboard' }
    }
    return true
  }

  // 2) Require sign-in for non-public routes
  const user = await getCurrentUser()
  if (!user) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // 3) Role guard (e.g., admin)
  if (to.meta?.role) {
    const role = await getUserRole(user.uid)
    if (to.meta.role === 'admin' && role !== 'admin') {
      return { name: 'Dashboard' }
    }
  }

  return true
})

export default router