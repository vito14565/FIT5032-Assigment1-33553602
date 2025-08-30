<template>
  <div>
    <!-- Navigation bar -->
    <nav class="navbar navbar-expand-lg bg-light px-3">
      <a class="navbar-brand fw-bold">Health Hub</a>
      <div class="navbar-nav">
        <RouterLink class="nav-link" to="/">Home</RouterLink>
        <RouterLink class="nav-link" to="/dashboard">Dashboard</RouterLink>
        <RouterLink class="nav-link" to="/recipes">Recipes</RouterLink>
      </div>

      <!-- Authentication links on the right -->
      <div class="ms-auto navbar-nav align-items-center">
        <!-- Show Login / Register when not authenticated -->
        <RouterLink v-if="!user" class="nav-link" to="/login">Login</RouterLink>
        <RouterLink v-if="!user" class="nav-link" to="/register">Register</RouterLink>

        <!-- Show email + Logout button when authenticated -->
        <div v-if="user" class="d-flex align-items-center gap-2">
          <span class="nav-link disabled small">{{ user.email }}</span>
          <button class="btn btn-outline-secondary btn-sm" @click="logout">Logout</button>
        </div>
      </div>
    </nav>

    <!-- Main content -->
    <main class="container py-4">
      <RouterView/>
    </main>

    <!-- Footer -->
    <footer class="text-center text-muted py-4 border-top">
      © 2025 Health Hub
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { auth } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'

// User state
const user = ref(null)

// Watch for login/logout state changes
onMounted(() => {
  onAuthStateChanged(auth, (u) => {
    user.value = u
  })
})

// Logout handler
async function logout() {
  await signOut(auth)
}
</script>