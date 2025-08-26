<script setup>
// Fetch dynamic data from Firestore instead of local demo array
import { ref, computed, onMounted } from 'vue'
import { db } from '../firebase'                     // <-- make sure src/firebase.js exists
import { collection, getDocs, query, orderBy } from 'firebase/firestore'

// UI state
const loading = ref(true)
const error = ref('')

// Data
const recipes = ref([])

// Filters
const qText = ref('')   // keyword for title/tags
const minCal = ref('')  // optional min calories
const maxCal = ref('')  // optional max calories

// Load data on mount
onMounted(async () => {
  try {
    const col = collection(db, 'recipes')
    const snap = await getDocs(query(col, orderBy('title')))
    recipes.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) {
    console.error(e)
    error.value = 'Failed to load recipes.'
  } finally {
    loading.value = false
  }
})

// Apply filters
const filtered = computed(() => {
  const kw = qText.value.trim().toLowerCase()
  const min = minCal.value === '' ? -Infinity : Number(minCal.value)
  const max = maxCal.value === '' ?  Infinity : Number(maxCal.value)

  return recipes.value.filter(r => {
    const titleMatch = String(r.title || '').toLowerCase().includes(kw)
    const tagMatch = Array.isArray(r.tags) && r.tags.some(t => String(t).toLowerCase().includes(kw))
    const inRange = typeof r.calories === 'number' && r.calories >= min && r.calories <= max
    return (kw ? (titleMatch || tagMatch) : true) && inRange
  })
})
</script>

<template>
  <h2 class="h4 mb-3">Recipe Library</h2>

  <!-- Filters -->
  <div class="row g-2 mb-3">
    <div class="col-12 col-lg-6">
      <input class="form-control" v-model.trim="qText" placeholder="Search by title or tag..." />
    </div>
    <div class="col-6 col-lg-3">
      <input class="form-control" v-model.trim="minCal" type="number" min="0" placeholder="Min calories" />
    </div>
    <div class="col-6 col-lg-3">
      <input class="form-control" v-model.trim="maxCal" type="number" min="0" placeholder="Max calories" />
    </div>
  </div>

  <!-- States -->
  <div v-if="loading" class="alert alert-info">Loading recipes...</div>
  <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

  <!-- Responsive grid: 1 column (sm), 2 (md), 3 (lg) -->
  <div v-else class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
    <div class="col" v-for="r in filtered" :key="r.id">
      <div class="card h-100">
        <div class="card-body">
          <h5 class="card-title">{{ r.title }}</h5>
          <p class="card-text mb-2">Calories: {{ r.calories }}</p>
          <div>
            <span class="badge bg-secondary me-1" v-for="t in r.tags" :key="t">{{ t }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div class="col-12" v-if="filtered.length === 0">
      <div class="alert alert-warning">No recipes match your filters.</div>
    </div>
  </div>
</template>