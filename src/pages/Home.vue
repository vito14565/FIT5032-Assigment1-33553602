<template>
  <div class="row g-3">
    <!-- Left column -->
    <div class="col-12 col-lg-8">
      <div class="p-4 border rounded-3">
        <h2 class="h4 mb-3">Welcome</h2>
        <p>This is the Nutrition Education web app. Learn the basics of healthy eating and plan your meals effectively.</p>
      </div>
    </div>

    <!-- Right column -->
    <div class="col-12 col-lg-4">
      <div class="p-4 border rounded-3">
        <h3 class="h5 mb-2">Quick Links</h3>
        <ul class="mb-0">
          <li><RouterLink to="/dashboard">Your Dashboard</RouterLink></li>
          <li><RouterLink to="/recipes">Recipe Library</RouterLink></li>
        </ul>
      </div>
    </div>
  </div>
</template>