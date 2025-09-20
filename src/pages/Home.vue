<template>
  <div class="row g-3" aria-labelledby="home-title">
    <!-- Left column / main welcome copy -->
    <div class="col-12 col-lg-8">
      <section class="p-4 border rounded-3" role="region" aria-labelledby="home-title">
        <!-- Use h1 as the page’s main heading -->
        <h1 id="home-title" class="h4 mb-3">Welcome</h1>
        <p>
          This is the Nutrition Education web app. Learn the basics of healthy eating
          and plan your meals effectively.
        </p>
      </section>
    </div>

    <!-- Right column / quick links -->
    <aside class="col-12 col-lg-4" aria-labelledby="quick-links-title">
      <div class="p-4 border rounded-3">
        <h2 id="quick-links-title" class="h5 mb-2 text-center">Quick Links</h2>

        <!-- Use list semantics to help screen readers understand grouping -->
        <ul class="list-unstyled text-center mb-0" role="list">
          <li class="mb-2" role="listitem">
            <!-- If logged in: real link -->
            <RouterLink v-if="user" to="/dashboard">Your Dashboard</RouterLink>

            <!-- Otherwise: a true button (not a fake link) that explains the requirement -->
            <button
              v-else
              type="button"
              class="btn btn-link p-0"
              :aria-describedby="'ql-hint'"
              @click="showNotice('Please log in to access this page.')"
            >
              Your Dashboard
            </button>
          </li>

          <li role="listitem">
            <RouterLink v-if="user" to="/recipes">Recipe Library</RouterLink>
            <button
              v-else
              type="button"
              class="btn btn-link p-0"
              :aria-describedby="'ql-hint'"
              @click="showNotice('Please log in to access this page.')"
            >
              Recipe Library
            </button>
          </li>
        </ul>

        <!-- Hidden hint, referenced by aria-describedby when logged out -->
        <p id="ql-hint" class="sr-only">
          Login is required to open these pages.
        </p>

        <!-- Red notice; focus it when shown so SR/keyboard users don’t miss it -->
        <div
          v-if="notice"
          ref="noticeEl"
          class="alert alert-danger mt-3 py-2 small text-center"
          role="alert"
          aria-live="assertive"
          tabindex="-1"
        >
          {{ notice }}
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup>
// Auth state + accessible notice focus management
import { ref, onMounted, nextTick } from 'vue'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'

const user = ref(null)    // current Firebase user (or null)
const notice = ref('')    // red banner text
const noticeEl = ref(null) // to programmatically focus the alert

// Subscribe to auth state
onMounted(() => {
  onAuthStateChanged(auth, (u) => (user.value = u))
})

// Show a red banner briefly; move focus to the alert for SR users
function showNotice(msg) {
  notice.value = msg
  nextTick(() => {
    // Make sure the alert is focusable and focus it so it gets announced
    noticeEl.value?.focus?.()
    noticeEl.value?.scrollIntoView?.({ block: 'nearest' })
  })
  setTimeout(() => {
    if (notice.value === msg) notice.value = ''
  }, 3000)
}
</script>

<style scoped>
/* Screen-reader-only utility (in case global .sr-only isn’t present here) */
.sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(1px,1px,1px,1px);
  white-space: nowrap;
}
</style>