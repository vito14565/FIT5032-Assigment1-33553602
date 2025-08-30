<script setup>
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { auth } from '../firebase'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const resetMsg = ref('')

// Map Firebase error codes to user-friendly messages
function mapAuthError(e) {
  const code = e?.code || ''
  if (code.includes('user-not-found')) return 'No user found with this email.'
  if (code.includes('wrong-password')) return 'Incorrect password.'
  if (code.includes('invalid-email')) return 'Invalid email format.'
  return 'Invalid email or password'
}

async function login() {
  error.value = ''
  resetMsg.value = ''
  loading.value = true
  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value)
    router.push('/dashboard')   // Redirect to Dashboard after login
  } catch (e) {
    error.value = mapAuthError(e)
  } finally {
    loading.value = false
  }
}

async function resetPassword() {
  error.value = ''
  resetMsg.value = ''
  if (!email.value) {
    error.value = 'Please enter your email first.'
    return
  }
  try {
    await sendPasswordResetEmail(auth, email.value.trim())
    resetMsg.value = 'Password reset email sent. Please check your inbox.'
  } catch (e) {
    error.value = 'Failed to send reset email. Please try again.'
  }
}
</script>

<template>
  <!-- Center the form vertically and horizontally -->
  <div class="d-flex justify-content-center align-items-center" style="min-height:70vh">
    <div class="w-100" style="max-width:480px">
      <h2 class="h4 mb-3 text-center">Login</h2>

      <!-- Card-style form -->
      <form class="vstack gap-3 p-4 border rounded-3 bg-white shadow-sm" @submit.prevent="login">
        <input class="form-control" v-model.trim="email" type="email" placeholder="Email" required />
        <input class="form-control" v-model.trim="password" type="password" placeholder="Password" minlength="6" required />

        <!-- Error and success messages -->
        <div class="text-danger small" v-if="error">{{ error }}</div>
        <div class="text-success small" v-if="resetMsg">{{ resetMsg }}</div>

        <button class="btn btn-primary w-100" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Login' }}
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