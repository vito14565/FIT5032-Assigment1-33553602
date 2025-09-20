<template>
  <div>
    <!-- Skip link (first tabbable) -->
    <a href="#main" class="visually-hidden-focusable">Skip to main content</a>

    <header role="banner">
      <!-- Navigation -->
      <nav class="navbar navbar-expand-lg bg-light px-3" role="navigation" aria-label="Main">
        <RouterLink class="navbar-brand fw-bold" to="/">Health Hub</RouterLink>

        <!-- Use list semantics for nav items -->
        <ul class="navbar-nav">
          <!-- Public -->
          <li class="nav-item">
            <RouterLink class="nav-link" to="/" aria-current="$route.path === '/' ? 'page' : null">Home</RouterLink>
          </li>
          <li class="nav-item">
            <RouterLink class="nav-link" to="/map" :aria-current="$route.path.startsWith('/map') ? 'page' : null">
              Healthy Map
            </RouterLink>
          </li>

          <!-- Protected (signed-in) -->
          <li class="nav-item" v-if="ready && user">
            <!-- Use click prevent + guard to keep SPA link semantics -->
            <RouterLink class="nav-link" to="/dashboard" @click.prevent="goOrWarn('/dashboard')"
              :aria-current="$route.path.startsWith('/dashboard') ? 'page' : null">
              Dashboard
            </RouterLink>
          </li>
          <li class="nav-item" v-if="ready && user">
            <RouterLink class="nav-link" to="/recipes" @click.prevent="goOrWarn('/recipes')"
              :aria-current="$route.path.startsWith('/recipes') ? 'page' : null">
              Recipes
            </RouterLink>
          </li>

          <!-- Admin only (rendered only if admin; no aria-disabled/tabindex hacks needed) -->
          <li class="nav-item" v-if="ready && role === 'admin'">
            <RouterLink class="nav-link" to="/tables" @click.prevent="goOrWarn('/tables', true)"
              :aria-current="$route.path.startsWith('/tables') ? 'page' : null">
              Tables
            </RouterLink>
          </li>
          <li class="nav-item" v-if="ready && role === 'admin'">
            <RouterLink class="nav-link" to="/admin" @click.prevent="goOrWarn('/admin', true)"
              :aria-current="$route.path.startsWith('/admin') ? 'page' : null">
              Admin
            </RouterLink>
          </li>
        </ul>

        <!-- Auth area -->
        <div class="ms-auto navbar-nav align-items-center">
          <!-- Public -->
          <RouterLink v-if="ready && !user" class="nav-link" to="/login">Login</RouterLink>
          <RouterLink v-if="ready && !user" class="nav-link" to="/register">Register</RouterLink>

          <!-- Signed-in -->
          <div v-if="ready && user" class="d-flex align-items-center gap-2">
            <span class="nav-link disabled small" aria-live="polite">{{ user.email }}</span>
            <button class="btn btn-outline-secondary btn-sm" @click="logout" aria-label="Log out">Logout</button>
          </div>
        </div>
      </nav>
    </header>

    <!-- Inline guard feedback -->
    <div v-if="notice" class="alert alert-danger mx-3 mt-3 py-2 small" role="alert" aria-live="assertive">
      {{ notice }}
    </div>

    <!-- SR-only route announcer for page changes (if you didn't add it in main.js) -->
    <div id="route-announcer" class="sr-only" aria-live="polite"></div>

    <!-- Main content -->
    <main id="main" class="container py-4" role="main">
      <RouterView />
    </main>

    <footer class="text-center text-muted py-4 border-top" role="contentinfo">
      © 2025 Health Hub
    </footer>
  </div>
</template>

<script setup>
/**
 * App shell with:
 * - Accessible skip link + semantic landmarks
 * - Public, protected, and admin-only nav links
 * - Inline notice banner for auth/role guard feedback
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { auth, db } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

const router = useRouter()
const $route = useRoute()

/* ---------------- State ---------------- */
const user = ref(null)
const role = ref(null)    // 'admin' | 'user' | null
const ready = ref(false)
const notice = ref('')

/* ---------------- Notice helpers ---------------- */
let noticeTimer = null
function showNotice(msg) {
  notice.value = msg
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    if (notice.value === msg) notice.value = ''
    noticeTimer = null
  }, 3000)
}

/**
 * Navigate or show an inline warning:
 * - If not signed in -> redirect to login with return URL
 * - If admin route and role !== admin -> show warning
 */
function goOrWarn(path, needsAdmin = false) {
  if (!user.value) {
    showNotice('Please log in to access this page.')
    router.push({ path: '/login', query: { redirect: path } })
    return
  }
  if (needsAdmin && role.value !== 'admin') {
    showNotice('Admins only. Your account does not have permission.')
    return
  }
  router.push(path)
}

/* ---------------- Role cache (localStorage) ---------------- */
function cacheRole(uid, r) { localStorage.setItem(`role:${uid}`, r) }
function getCachedRole(uid) { return localStorage.getItem(`role:${uid}`) }

/* ---------------- Auth watcher ---------------- */
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

onUnmounted(() => { if (typeof stopAuthWatcher === 'function') stopAuthWatcher() })

/* ---------------- Logout ---------------- */
async function logout() {
  const uid = user.value?.uid
  await signOut(auth)
  if (uid) localStorage.removeItem(`role:${uid}`)
  router.push('/login')
}
</script>

<style>
/* Make the skip link visible only on focus */
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

/* SR-only utility used by #route-announcer */
.sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(1px,1px,1px,1px);
  white-space: nowrap;
}

/* Highlight the active route link */
.router-link-active.nav-link { font-weight: 600; }
</style>