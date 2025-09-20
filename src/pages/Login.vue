<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { auth } from '../firebase'
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth'

const router = useRouter()
const route = useRoute()

// Form state
const email = ref('')
const password = ref('')
const showPwd = ref(false)

// UI state
const error = ref('')
const loading = ref(false)
const resetMsg = ref('')

// Normalize redirect target
function getRedirectTarget() {
  const q = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  const fromQuery = q ? ('/' + q.replace(/^\/+/, '')) : ''
  const fromDeepLogin = route.path.startsWith('/login/')
    ? '/' + route.path.replace(/^\/login\/+/, '')
    : ''
  const raw = fromQuery || fromDeepLogin || '/dashboard'
  return raw.startsWith('/') ? raw : '/' + raw
}

// Prefill & auto-redirect if already signed in
let stopAuthWatcher = null
onMounted(() => {
  const qEmail = String(route.query.email || '').trim().toLowerCase()
  if (qEmail) email.value = qEmail

  stopAuthWatcher = onAuthStateChanged(auth, (u) => {
    if (u) router.replace(getRedirectTarget())
  })
})

onUnmounted(() => {
  if (typeof stopAuthWatcher === 'function') stopAuthWatcher()
})

// Map Firebase error codes to user-friendly messages
function mapAuthError(e) {
  const code = (e?.code || '').toLowerCase()
  if (code.includes('user-not-found')) return 'No user found with this email.'
  if (code.includes('wrong-password')) return 'Incorrect password.'
  if (code.includes('invalid-email')) return 'Invalid email format.'
  if (code.includes('invalid-credential')) return 'Invalid email or password.'
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait and try again.'
  if (code.includes('user-disabled')) return 'This account has been disabled.'
  if (code.includes('network-request-failed')) return 'Network error. Please try again.'
  if (code.includes('internal-error')) return 'Server error. Please try again later.'
  return 'Invalid email or password.'
}

async function login() {
  error.value = ''
  resetMsg.value = ''
  loading.value = true
  try {
    const normalizedEmail = email.value.trim().toLowerCase()
    await signInWithEmailAndPassword(auth, normalizedEmail, password.value) // do NOT trim password
    router.replace(getRedirectTarget())
  } catch (e) {
    error.value = mapAuthError(e)
  } finally {
    loading.value = false
  }
}

async function resetPassword() {
  error.value = ''
  resetMsg.value = ''
  const normalizedEmail = email.value.trim().toLowerCase()
  if (!normalizedEmail) {
    error.value = 'Please enter your email first.'
    return
  }
  try {
    await sendPasswordResetEmail(auth, normalizedEmail)
    resetMsg.value = 'Password reset email sent. Please check your inbox.'
  } catch (e) {
    error.value = mapAuthError(e)
  }
}
</script>

<template>
  <!-- Center the form vertically and horizontally -->
  <div class="d-flex justify-content-center align-items-center" style="min-height:70vh">
    <div class="w-100" style="max-width:480px">
      <h1 class="h4 mb-3 text-center" id="login-title">Login</h1>

      <!-- Card-style form -->
      <form
        class="vstack gap-3 p-4 border rounded-3 bg-white shadow-sm"
        @submit.prevent="login"
        novalidate
        aria-labelledby="login-title"
      >
        <!-- Email -->
        <div>
          <label class="form-label" for="email">Email</label>
          <input
            id="email"
            class="form-control"
            v-model.trim="email"
            type="email"
            name="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
            :aria-describedby="`email-help${error ? ' auth-err' : ''}`"
            :aria-invalid="!!error && !resetMsg"
            autofocus
          />
          <p id="email-help" class="sr-only">Enter your email address.</p>
        </div>

        <!-- Password (no trim) + show/hide -->
        <div>
          <label class="form-label" for="password">Password</label>
          <div class="input-group">
            <input
              id="password"
              class="form-control"
              :type="showPwd ? 'text' : 'password'"
              v-model="password"
              name="password"
              placeholder="Your password"
              minlength="6"
              autocomplete="current-password"
              required
              :aria-describedby="`pwd-help${error ? ' auth-err' : ''}`"
              :aria-invalid="!!error && !resetMsg"
            />
            <button
              class="btn btn-outline-secondary"
              type="button"
              @click="showPwd = !showPwd"
              :aria-pressed="showPwd ? 'true' : 'false'"
              aria-label="Toggle password visibility"
              aria-controls="password"
            >
              {{ showPwd ? 'Hide' : 'Show' }}
            </button>
          </div>
          <p id="pwd-help" class="sr-only">Password must be at least 6 characters.</p>
        </div>

        <!-- Error and success messages -->
        <div v-if="error" id="auth-err" class="text-danger small" role="alert" aria-live="assertive">
          {{ error }}
        </div>
        <div v-if="resetMsg" class="text-success small" role="status" aria-live="polite">
          {{ resetMsg }}
        </div>

        <button class="btn btn-primary w-100" :disabled="loading" :aria-busy="loading" type="submit">
          {{ loading ? 'Signing in…' : 'Login' }}
        </button>

        <div class="d-flex justify-content-between align-items-center">
          <button type="button" class="btn btn-link p-0 small" @click="resetPassword">
            Forgot password?
          </button>
          <p class="small mb-0">
            Don’t have an account?
            <RouterLink to="/register">Create one</RouterLink>
          </p>
        </div>
      </form>
    </div>
  </div>
</template>