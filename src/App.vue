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
</script>