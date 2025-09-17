<!-- src/pages/AdminPanel.vue -->
<template>
  <div class="container py-4">
    <h2 class="h4 mb-3">Admin Panel</h2>
    <p class="text-muted">Only administrators can access this page.</p>

    <div class="card p-3 mt-4 shadow-sm">
      <h5 class="card-title">Send Email</h5>
      <EmailSender />
    </div>
  </div>
</template>

<script setup>
import EmailSender from "../components/EmailSender.vue";
</script>

<style scoped>
.card {
  border-radius: 8px;
}
</style>