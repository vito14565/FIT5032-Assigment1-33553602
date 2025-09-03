<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { auth } from '../firebase'
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth'

const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const resetMsg = ref('')

// Prefill from query (?email=...) and redirect if already signed in
onMounted(() => {
  const qEmail = String(route.query.email || '').trim().toLowerCase()
  if (qEmail) email.value = qEmail

  const stop = onAuthStateChanged(auth, (u) => {
    if (u) router.replace('/dashboard')
    stop()
  })
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
  return 'Invalid email or password.'
}

async function login() {
  error.value = ''
  resetMsg.value = ''
  loading.value = true
  try {
    // Normalize email; NEVER trim password
    const normalizedEmail = email.value.trim().toLowerCase()
    await signInWithEmailAndPassword(auth, normalizedEmail, password.value)
    router.push('/dashboard')
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
      <h2 class="h4 mb-3 text-center">Login</h2>

      <!-- Card-style form -->
      <form class="vstack gap-3 p-4 border rounded-3 bg-white shadow-sm" @submit.prevent="login" novalidate>
        <input
          class="form-control"
          v-model.trim="email"
          type="email"
          placeholder="Email"
          autocomplete="email"
          required
        />
        <input
          class="form-control"
          v-model="password"           <!-- do NOT trim password -->
          type="password"
          placeholder="Password"
          minlength="6"
          autocomplete="current-password"
          required
        />

        <!-- Error and success messages -->
        <div class="text-danger small" v-if="error" role="alert" aria-live="assertive">{{ error }}</div>
        <div class="text-success small" v-if="resetMsg" role="status" aria-live="polite">{{ resetMsg }}</div>

        <button class="btn btn-primary w-100" :disabled="loading">
          {{ loading ? 'Signing in…' : 'Login' }}
        </button>

        <div class="d-flex justify-content-between align-items-center">
          <!-- Password reset link -->
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