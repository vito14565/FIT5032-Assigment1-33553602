// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { auth, db } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

// Basic pages
import Home from '../pages/Home.vue'
import Dashboard from '../pages/Dashboard.vue'
import Recipes from '../pages/Recipes.vue'

// Authentication pages
import Login from '../pages/Login.vue'
import Register from '../pages/Register.vue'

// Admin-only page (create a minimal placeholder if you haven't yet)
import AdminPanel from '../pages/AdminPanel.vue'

const routes = [
  { path: '/', component: Home, meta: { public: true } },                 //  Only Home is public
  { path: '/dashboard', component: Dashboard },                           //  Requires login
  { path: '/recipes', component: Recipes },                               //  Requires login
  { path: '/admin', component: AdminPanel, meta: { role: 'admin' } },     //  Admin only
  { path: '/login', component: Login, meta: { public: true, publicOnly: true } },
  { path: '/register', component: Register, meta: { public: true, publicOnly: true } },
  // Optional: 404 page
  // { path: '/:pathMatch(.*)*', component: NotFound, meta: { public: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * Wait for Firebase Auth to resolve the current session.
 * Returns the user or null.
 */
function getCurrentUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop()
      resolve(user)
    })
  })
}

/**
 * Fetch role from Firestore users/{uid}. Returns 'admin' | 'user'.
 * Defaults to 'user' if the doc is missing.
 */
async function getUserRole(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data().role || 'user') : 'user'
}

// Global navigation guard
router.beforeEach(async (to) => {
  // Public routes are always allowed
  if (to.meta?.public) {
    // For public-only routes (login/register), redirect authenticated users
    if (to.meta.publicOnly && (await getCurrentUser())) return '/dashboard'
    return true
  }

  // Non-public routes require authentication
  const u = await getCurrentUser()
  if (!u) return '/login'

  // Role-protected routes (e.g., admin)
  if (to.meta?.role) {
    const role = await getUserRole(u.uid)
    if (to.meta.role === 'admin' && role !== 'admin') return '/dashboard'
  }

  return true
})

export default router