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

// Admin-only page
import AdminPanel from '../pages/AdminPanel.vue'

const routes = [
  { path: '/', component: Home, meta: { public: true } },                 // Public route
  { path: '/dashboard', component: Dashboard },                           // Requires authentication
  { path: '/recipes', component: Recipes },                               // Requires authentication
  { path: '/admin', component: AdminPanel, meta: { role: 'admin' } },     // Admin-only route
  { path: '/login', component: Login, meta: { public: true, publicOnly: true } }, // Public-only
  // Alias so URLs like /login/recipes are still handled by Login.vue
  { path: '/login/:rest(.*)?', component: Login, meta: { public: true, publicOnly: true } },
  { path: '/register', component: Register, meta: { public: true, publicOnly: true } }, // Public-only
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * Resolve the current user session.
 * Returns the user object or null.
 */
function getCurrentUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  return new Promise(resolve => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop()
      resolve(user)
    })
  })
}

/**
 * Fetch user role from Firestore users/{uid}.
 * Defaults to 'user' if the document does not exist.
 */
async function getUserRole(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data().role || 'user') : 'user'
}

// Global navigation guard
router.beforeEach(async (to) => {
  // Public routes are always allowed
  if (to.meta?.public) {
    // Prevent logged-in users from accessing login/register
    if (to.meta.publicOnly && (await getCurrentUser())) {
      return { path: '/dashboard' }
    }
    return true
  }

  // Non-public routes require authentication
  const u = await getCurrentUser()
  if (!u) {
    // Redirect to login with ?redirect=... parameter
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // Role-protected routes
  if (to.meta?.role) {
    const role = await getUserRole(u.uid)
    if (to.meta.role === 'admin' && role !== 'admin') {
      return { path: '/dashboard' }
    }
  }

  return true
})

export default router