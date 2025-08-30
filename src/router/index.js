// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'

// Basic pages
import Home from '../pages/Home.vue'
import Dashboard from '../pages/Dashboard.vue'
import Recipes from '../pages/Recipes.vue'

// Authentication pages
import Login from '../pages/Login.vue'
import Register from '../pages/Register.vue'

const routes = [
  { path: '/', component: Home, meta: { public: true } },          // Public
  { path: '/recipes', component: Recipes, meta: { public: true }}, // Public
  { path: '/dashboard', component: Dashboard },                    // Requires login
  { path: '/login', component: Login, meta: { public: true } },
  { path: '/register', component: Register, meta: { public: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Get current authenticated user
function getCurrentUser() {
  return new Promise(resolve => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop()
      resolve(user)
    })
  })
}

// Global navigation guard: check if route requires login
router.beforeEach(async (to) => {
  if (to.meta?.public) return true
  const user = await getCurrentUser()
  return user ? true : '/login'
})

export default router