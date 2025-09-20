<!-- src/pages/AdminPanel.vue -->
<template>
  <div class="container py-4">
    <!-- Page main heading (use h1 for the page title) -->
    <h1 class="h4 mb-3">Admin Panel</h1>
    <p class="text-muted">Only administrators can access this page.</p>

    <!-- Accessible section landmark for email sender -->
    <!-- aria-labelledby points to the section heading for screen readers -->
    <section class="card p-3 mt-4 shadow-sm" aria-labelledby="send-email-title">
      <!-- Section heading (h2 since h1 is already used above) -->
      <h2 id="send-email-title" class="card-title h5">Send Email</h2>
      <EmailSender />
    </section>
  </div>
</template>

<script setup>
// Import the EmailSender component that contains the actual form
import EmailSender from "../components/EmailSender.vue";
</script>

<style scoped>
/* Keep card corners slightly rounded for consistency */
.card {
  border-radius: 8px;
}
</style>