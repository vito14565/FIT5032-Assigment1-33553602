<template>
  <div>
    <!-- Navigation bar -->
    <nav class="navbar navbar-expand-lg bg-light px-3">
      <a class="navbar-brand fw-bold">Health Hub</a>

      <div class="navbar-nav">
        <RouterLink class="nav-link" to="/">Home</RouterLink>

        <!-- Protected links: only visible when authenticated -->
        <RouterLink
          v-if="ready && user"
          class="nav-link"
          to="/dashboard"
          @click.prevent="goOrWarn('/dashboard')"
        >
          Dashboard
        </RouterLink>

        <RouterLink
          v-if="ready && user"
          class="nav-link"
          to="/recipes"
          @click.prevent="goOrWarn('/recipes')"
        >
          Recipes
        </RouterLink>

        <!-- Admin link: only visible for users with role 'admin' -->
        <RouterLink
          v-if="ready && role === 'admin'"
          class="nav-link"
          to="/admin"
          @click.prevent="goOrWarn('/admin', true)"
        >
          Admin
        </RouterLink>
      </div>

      <!-- Auth area on the right -->
      <div class="ms-auto navbar-nav align-items-center">
        <!-- Show Login / Register when not authenticated -->
        <RouterLink v-if="ready && !user" class="nav-link" to="/login">Login</RouterLink>
        <RouterLink v-if="ready && !user" class="nav-link" to="/register">Register</RouterLink>

        <!-- Show email + Logout when authenticated -->
        <div v-if="ready && user" class="d-flex align-items-center gap-2">
          <span class="nav-link disabled small">{{ user.email }}</span>
          <button class="btn btn-outline-secondary btn-sm" @click="logout">Logout</button>
        </div>
      </div>
    </nav>

    <!-- Red notice banner (appears when access is blocked) -->
    <div v-if="notice" class="alert alert-danger mx-3 mt-3 py-2 small">
      {{ notice }}
    </div>

    <!-- Main content -->
    <main class="container py-4">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer class="text-center text-muted py-4 border-top">
      © 2025 Health Hub
    </footer>
  </div>
</template>

<script setup>
// Core Vue + Firebase imports
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

// Router instance for redirects
const router = useRouter()

// Auth & role state
const user = ref(null)
const role = ref(null)    // 'admin' | 'user' | null
const ready = ref(false)  // true when auth/role has finished loading
const notice = ref('')    // red banner text

// Helper: show a red notice for a short time
function showNotice(msg) {
  notice.value = msg
  setTimeout(() => {
    if (notice.value === msg) notice.value = ''
  }, 3000) // auto-hide after 3s
}

/**
 * Decide to navigate or show a warning.
 * @param {string} path - target route
 * @param {boolean} needsAdmin - whether admin role is required
 */
function goOrWarn(path, needsAdmin = false) {
  if (!user.value) {
    showNotice('Please log in to access this page.')
    return
  }
  if (needsAdmin && role.value !== 'admin') {
    showNotice('Admins only. Your account does not have permission.')
    return
  }
  router.push(path)
}

// Watch for login/logout and load role from Firestore users/{uid}
onMounted(() => {
  onAuthStateChanged(auth, async (u) => {
    user.value = u
    role.value = null
    ready.value = false

    if (u) {
      try {
        const snap = await getDoc(doc(db, 'users', u.uid))
        role.value = snap.exists() ? (snap.data().role || 'user') : 'user'
      } catch (e) {
        console.warn('Failed to load role:', e)
        role.value = 'user'
      }
    }

    ready.value = true
  })
})

// Logout handler: sign out and redirect to /login
async function logout() {
  await signOut(auth)
  router.push('/login')
}
</script>