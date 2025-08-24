<script setup>
// Demo recipe list for testing responsiveness
const demo = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  title: `Recipe #${i + 1}`,
  calories: 400 + i * 30
}))
</script>

<template>
  <h2 class="h4 mb-3">Recipe Library</h2>
  
  <!-- Responsive grid: 1 column on small, 2 columns on medium, 3 on large -->
  <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
    <div class="col" v-for="r in demo" :key="r.id">
      <div class="card h-100">
        <div class="card-body">
          <h5 class="card-title">{{ r.title }}</h5>
          <p class="card-text mb-1">Calories: {{ r.calories }}</p>
        </div>
      </div>
    </div>
  </div>
</template>