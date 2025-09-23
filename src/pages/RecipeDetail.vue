<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { db } from '../firebase'
import { doc, getDoc } from 'firebase/firestore'

const route   = useRoute()
const recipe  = ref(null)
const loading = ref(true)
const error   = ref('')

onMounted(async () => {
  try {
    const snap = await getDoc(doc(db, 'recipes', route.params.id))
    if (snap.exists()) {
      recipe.value = { id: snap.id, ...snap.data() }
    } else {
      error.value = 'Recipe not found'
    }
  } catch (e) {
    console.error(e)
    error.value = 'Failed to load recipe'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="container py-4">
    <div v-if="loading" class="alert alert-info">Loading recipe...</div>
    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

    <article v-else-if="recipe" class="card">
      <div class="card-body">
        <h1 class="card-title h3">{{ recipe.title }}</h1>

        <!-- Dietary / Tags -->
        <div class="mb-3 d-flex flex-wrap gap-1">
          <span v-for="d in (recipe.dietary || [])" :key="`diet-${d}`" class="badge bg-success">{{ d }}</span>
          <span v-for="t in (recipe.tags || [])"     :key="`tag-${t}`"  class="badge bg-secondary">{{ t }}</span>
        </div>

        <!-- Calories & Macros -->
        <p class="mb-2"><strong>Calories:</strong> {{ recipe.calories ?? recipe.kcal }}</p>
        <p class="mb-3">
          <strong>Carbs:</strong> {{ recipe.carbs ?? recipe.carbs_g }} g &nbsp;|
          <strong>Protein:</strong> {{ recipe.protein ?? recipe.protein_g }} g &nbsp;|
          <strong>Fat:</strong> {{ recipe.fat ?? recipe.fat_g }} g
        </p>

        <!-- Ingredients -->
        <h2 class="h5 mt-4">Ingredients</h2>
        <ul class="mb-3">
          <li v-for="(ing, i) in (recipe.ingredients || [])" :key="i">{{ ing }}</li>
        </ul>

        <!-- Steps -->
        <h2 class="h5 mt-4">Steps</h2>
        <ol>
          <li v-for="(step, i) in (recipe.steps || [])" :key="i">{{ step }}</li>
        </ol>
      </div>
    </article>
  </div>
</template>