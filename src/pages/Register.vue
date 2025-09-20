<script setup>
// Register page with robust Firebase error handling & redirects
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { auth, db } from '../firebase'
import { onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'

const router = useRouter()
const route = useRoute()

// -------- helpers: normalize internal redirect target --------
function normalizeRedirect(v, fallback = '/dashboard') {
  const raw = typeof v === 'string' && v ? v : fallback
  const trimmed = raw.replace(/^\s+|\s+$/g, '')
  return trimmed.startsWith('/') ? trimmed : '/' + trimmed
}

// Form state
const email = ref('')
const password = ref('')
const showPwd = ref(false)

// UI state
const loading = ref(false)
const error = ref('')

// Validators
const emailOk = computed(() => /^\S+@\S+\.\S+$/.test(email.value.trim()))
const pwdOk   = computed(() => password.value.length >= 6)
const canSubmit = computed(() => emailOk.value && pwdOk.value && !loading.value)

// Clear stale errors whenever user edits
watch([email, password], () => { if (error.value) error.value = '' })

// If already signed in, don't show register page
let stopAuthWatcher = null
onMounted(() => {
  stopAuthWatcher = onAuthStateChanged(auth, (user) => {
    if (user) {
      const target = normalizeRedirect(route.query.redirect)
      router.replace(target)
    }
  })
})
onUnmounted(() => { if (typeof stopAuthWatcher === 'function') stopAuthWatcher() })

// Map Firebase errors to friendly messages
function mapAuthError(e) {
  const code = (e?.code || '').toLowerCase()
  if (code.includes('email-already-in-use')) return 'This email is already registered.'
  if (code.includes('invalid-email')) return 'Please enter a valid email.'
  if (code.includes('weak-password')) return 'Password should be at least 6 characters.'
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait and try again.'
  if (code.includes('operation-not-allowed')) return 'Email/Password sign-in is not enabled in Firebase Console.'
  if (code.includes('network-request-failed')) return 'Network error. Please check your connection and try again.'
  return 'Failed to register. Please try again.'
}

async function register() {
  if (!canSubmit.value) return
  loading.value = true
  error.value = ''
  try {
    // Normalize email (lowercase) but NEVER trim the password
    const normalizedEmail = email.value.trim().toLowerCase()

    const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password.value)

    // Create/merge user profile doc (best-effort)
    try {
      await setDoc(
        doc(db, 'users', cred.user.uid),
        { email: normalizedEmail, role: 'user', createdAt: serverTimestamp() },
        { merge: true },
      )
      localStorage.setItem(`role:${cred.user.uid}`, 'user')
    } catch (e) {
      console.warn('setDoc failed:', e) // non-blocking
    }

    // Redirect to intended page or dashboard
    const target = normalizeRedirect(route.query.redirect)
    router.push(target)
  } catch (e) {
    const msg = mapAuthError(e)
    if ((e?.code || '').toLowerCase().includes('email-already-in-use')) {
      router.push({
        path: '/login',
        query: {
          email: email.value.trim().toLowerCase(),
          redirect: route.query.redirect
        }
      })
    } else {
      error.value = msg
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="d-flex justify-content-center align-items-center" style="min-height:70vh">
    <div class="w-100" style="max-width:480px">
      <h1 class="h4 mb-3 text-center" id="register-title">Register</h1>

      <form
        class="vstack gap-3 p-4 border rounded-3 bg-white shadow-sm"
        @submit.prevent="register"
        novalidate
        aria-labelledby="register-title"
      >
        <!-- Email -->
        <div>
          <label class="form-label" for="reg-email">Email</label>
          <input
            id="reg-email"
            class="form-control"
            v-model.trim="email"
            type="email"
            name="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
            :aria-describedby="`email-help${(email && !emailOk) ? ' email-err' : ''}`"
            :aria-invalid="!!(email && !emailOk)"
            autofocus
          />
          <p id="email-help" class="sr-only">Enter a valid email address.</p>
          <div v-if="email && !emailOk" id="email-err" class="invalid-feedback d-block">
            Please enter a valid email address.
          </div>
        </div>

        <!-- Password (do NOT trim password) -->
        <div>
          <label class="form-label" for="reg-password">Password</label>
          <div class="input-group">
            <input
              id="reg-password"
              class="form-control"
              :type="showPwd ? 'text' : 'password'"
              v-model="password"
              name="new-password"
              placeholder="Password (min 6 chars)"
              minlength="6"
              autocomplete="new-password"
              required
              :aria-describedby="`pwd-help${(password && !pwdOk) ? ' pwd-err' : ''}`"
              :aria-invalid="!!(password && !pwdOk)"
            />
            <button
              class="btn btn-outline-secondary"
              type="button"
              @click="showPwd = !showPwd"
              :aria-pressed="showPwd ? 'true' : 'false'"
              aria-label="Toggle password visibility"
              aria-controls="reg-password"
            >
              {{ showPwd ? 'Hide' : 'Show' }}
            </button>
          </div>
          <p id="pwd-help" class="sr-only">Password must be at least 6 characters.</p>
          <div v-if="password && !pwdOk" id="pwd-err" class="invalid-feedback d-block">
            Password should be at least 6 characters.
          </div>
        </div>

        <!-- Error -->
        <div class="text-danger small" v-if="error" role="alert" aria-live="assertive">
          {{ error }}
        </div>

        <button class="btn btn-success w-100" :disabled="!canSubmit || loading" :aria-busy="loading" type="submit">
          <span v-if="loading">Creating…</span>
          <span v-else>Create account</span>
        </button>

        <p class="small mb-0 text-end">
          Already have an account?
          <RouterLink to="/login">Login</RouterLink>
        </p>
      </form>
    </div>
  </div>
</template>