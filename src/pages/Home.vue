<template>
  <div class="row g-3">
    <!-- Left column -->
    <div class="col-12 col-lg-8">
      <div class="p-4 border rounded-3">
        <h2 class="h4 mb-3">Welcome</h2>
        <p>
          This is the Nutrition Education web app. Learn the basics of healthy eating
          and plan your meals effectively.
        </p>
      </div>
    </div>

    <!-- Right column -->
    <div class="col-12 col-lg-4">
      <div class="p-4 border rounded-3">
        <h3 class="h5 mb-2 text-center">Quick Links</h3>

        <ul class="list-unstyled text-center mb-0">
          <li class="mb-2">
            <!-- If logged in: real link; otherwise: fake link that only shows a notice -->
            <RouterLink v-if="user" to="/dashboard">Your Dashboard</RouterLink>
            <button
              v-else
              type="button"
              class="btn btn-link p-0"
              @click="showNotice('Please log in to access this page.')"
            >
              Your Dashboard
            </button>
          </li>

          <li>
            <RouterLink v-if="user" to="/recipes">Recipe Library</RouterLink>
            <button
              v-else
              type="button"
              class="btn btn-link p-0"
              @click="showNotice('Please log in to access this page.')"
            >
              Recipe Library
            </button>
          </li>
        </ul>

        <!-- Red notice -->
        <div
          v-if="notice"
          class="alert alert-danger mt-3 py-2 small text-center"
          role="alert"
          aria-live="assertive"
        >
          {{ notice }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Track auth state and show a red notice when blocked
import { ref, onMounted } from 'vue'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'

const user = ref(null)   // current Firebase user (or null)
const notice = ref('')   // red banner text

// Subscribe to auth state
onMounted(() => {
  onAuthStateChanged(auth, (u) => (user.value = u))
})

// Show a red banner for a short time
function showNotice(msg) {
  notice.value = msg
  setTimeout(() => {
    if (notice.value === msg) notice.value = ''
  }, 3000) // auto-hide after 3s
}
</script>