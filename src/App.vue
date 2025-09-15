<template>
  <div>
    <!-- Skip link for keyboard users -->
    <a href="#main" class="visually-hidden-focusable">Skip to content</a>

    <!-- Navigation bar -->
    <nav class="navbar navbar-expand-lg bg-light px-3" role="navigation" aria-label="Main">
      <a class="navbar-brand fw-bold">Health Hub</a>

      <div class="navbar-nav">
        <RouterLink class="nav-link" to="/">Home</RouterLink>

        <!-- Protected links -->
        <RouterLink
          v-if="ready && user"
          class="nav-link"
          to="/dashboard"
          :tabindex="user ? 0 : -1"
          @click.prevent="goOrWarn('/dashboard')"
        >
          Dashboard
        </RouterLink>

        <RouterLink
          v-if="ready && user"
          class="nav-link"
          to="/recipes"
          :tabindex="user ? 0 : -1"
          @click.prevent="goOrWarn('/recipes')"
        >
          Recipes
        </RouterLink>

        <!-- Admin link -->
        <RouterLink
          v-if="ready && role === 'admin'"
          class="nav-link"
          to="/admin"
          :aria-disabled="role !== 'admin'"
          :tabindex="role !== 'admin' ? -1 : 0"
          @click.prevent="goOrWarn('/admin', true)"
        >
          Admin
        </RouterLink>
      </div>

      <!-- Auth area -->
      <div class="ms-auto navbar-nav align-items-center">
        <!-- Show Login/Register -->
        <RouterLink v-if="ready && !user" class="nav-link" to="/login">Login</RouterLink>
        <RouterLink v-if="ready && !user" class="nav-link" to="/register">Register</RouterLink>

        <!-- Show email + Logout -->
        <div v-if="ready && user" class="d-flex align-items-center gap-2">
          <span class="nav-link disabled small">{{ user.email }}</span>
          <button class="btn btn-outline-secondary btn-sm" @click="logout">Logout</button>
        </div>
      </div>
    </nav>

    <!-- Red notice banner -->
    <div v-if="notice" class="alert alert-danger mx-3 mt-3 py-2 small" role="alert" aria-live="assertive">
      {{ notice }}
    </div>

    <!-- Main content -->
    <main id="main" class="container py-4">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer class="text-center text-muted py-4 border-top">
      © 2025 Health Hub
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

const router = useRouter()

// State
const user = ref(null)
const role = ref(null)    // 'admin' | 'user' | null
const ready = ref(false)
const notice = ref('')

// Notice timer
let noticeTimer = null
function showNotice(msg) {
  notice.value = msg
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    if (notice.value === msg) notice.value = ''
    noticeTimer = null
  }, 3000)
}

// Navigate or warn
function goOrWarn(path, needsAdmin = false) {
  if (!user.value) {
    showNotice('Please log in to access this page.')
    return router.push({ path: '/login', query: { redirect: path } })
  }
  if (needsAdmin && role.value !== 'admin') {
    showNotice('Admins only. Your account does not have permission.')
    return
  }
  router.push(path)
}

// Role cache
function cacheRole(uid, role) {
  localStorage.setItem(`role:${uid}`, role)
}
function getCachedRole(uid) {
  return localStorage.getItem(`role:${uid}`)
}

// Auth watcher
let stopAuthWatcher = null
onMounted(() => {
  stopAuthWatcher = onAuthStateChanged(auth, async (u) => {
    user.value = u
    role.value = null
    ready.value = false

    if (u) {
      const cached = getCachedRole(u.uid)
      if (cached) role.value = cached

      try {
        const snap = await getDoc(doc(db, 'users', u.uid))
        const r = snap.exists() ? (snap.data().role || 'user') : 'user'
        role.value = r
        cacheRole(u.uid, r)
      } catch (e) {
        console.warn('Failed to load role:', e)
        role.value = role.value || 'user'
      }
    }

    ready.value = true
  })
})

onUnmounted(() => {
  if (typeof stopAuthWatcher === 'function') stopAuthWatcher()
})

// Logout
async function logout() {
  const uid = user.value?.uid
  await signOut(auth)
  if (uid) localStorage.removeItem(`role:${uid}`)
  router.push('/login')
}
</script>

<style>
/* Make skip link visible only on focus */
.visually-hidden-focusable {
  position: absolute;
  left: -999px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.visually-hidden-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  margin: 1rem;
  padding: 0.5rem 1rem;
  background: #f8f9fa;
  border: 1px solid #ccc;
  border-radius: 0.25rem;
  z-index: 1000;
}
</style>