<script setup>
// Register page with robust Firebase error handling & redirects
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { auth, db } from '../firebase'
import { onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'

const router = useRouter()

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
onMounted(() => {
  const stop = onAuthStateChanged(auth, (user) => {
    if (user) router.replace('/dashboard')
    stop()
  })
})

// Map Firebase errors to friendly messages
function mapAuthError(e) {
  const code = (e?.code || '').toLowerCase()
  if (code.includes('email-already-in-use')) return 'This email is already registered.'
  if (code.includes('invalid-email')) return 'Please enter a valid email.'
  if (code.includes('weak-password')) return 'Password should be at least 6 characters.'
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait and try again.'
  if (code.includes('operation-not-allowed')) return 'Email/Password sign-in is not enabled.'
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

    // Create user profile doc (best-effort)
    try {
      await setDoc(
        doc(db, 'users', cred.user.uid),
        { email: normalizedEmail, role: 'user', createdAt: Date.now() },
        { merge: true },
      )
    } catch (e) {
      console.warn('setDoc failed:', e) // non-blocking
    }

    router.push('/dashboard')
  } catch (e) {
    error.value = mapAuthError(e)
    if ((e?.code || '').toLowerCase().includes('email-already-in-use')) {
      router.push({ path: '/login', query: { email: email.value.trim().toLowerCase() } })
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="d-flex justify-content-center align-items-center" style="min-height:70vh">
    <div class="w-100" style="max-width:480px">
      <h2 class="h4 mb-3 text-center">Register</h2>

      <form class="vstack gap-3 p-4 border rounded-3 bg-white shadow-sm" @submit.prevent="register" novalidate>
        <!-- Email -->
        <div>
          <input
            class="form-control"
            v-model.trim="email"
            type="email"
            placeholder="Email"
            autocomplete="email"
            required
            :class="{ 'is-invalid': email && !emailOk }"
            autofocus
          />
          <div class="invalid-feedback">Please enter a valid email address.</div>
        </div>

        <!-- Password (do NOT trim password) -->
        <div class="input-group">
          <input
            class="form-control"
            :type="showPwd ? 'text' : 'password'"
            v-model="password"
            placeholder="Password (min 6 chars)"
            minlength="6"
            autocomplete="new-password"
            required
            :class="{ 'is-invalid': password && !pwdOk }"
          />
          <button
            class="btn btn-outline-secondary"
            type="button"
            @click="showPwd = !showPwd"
            aria-label="Toggle password visibility"
          >
            {{ showPwd ? 'Hide' : 'Show' }}
          </button>
        </div>
        <div class="invalid-feedback d-block" v-if="password && !pwdOk">
          Password should be at least 6 characters.
        </div>

        <!-- Error -->
        <div class="text-danger small" v-if="error" role="alert" aria-live="assertive">
          {{ error }}
        </div>

        <button class="btn btn-success w-100" :disabled="!canSubmit || loading">
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