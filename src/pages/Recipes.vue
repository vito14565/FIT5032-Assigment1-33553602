<script setup>
// Fetch dynamic data from Firestore
import { ref, computed, onMounted } from 'vue'
import { db } from '../firebase'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'

// ⭐ Rating UI (C.3)
import RecipeRating from '../components/RecipeRating.vue'

// UI state
const loading = ref(true)
const error = ref('')

// Data
const recipes = ref([])

// Filters
const qText = ref('')   // keyword for title/tags
const minCal = ref('')  // optional min calories
const maxCal = ref('')  // optional max calories

// Load data on mount (one-time fetch is fine for the list)
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

// Apply filters with sane defaults
const filtered = computed(() => {
  const kw = qText.value.trim().toLowerCase()

  // Coerce string -> number; fallback to ±Infinity on NaN/empty
  const minParsed = Number(minCal.value)
  const maxParsed = Number(maxCal.value)
  const min = (minCal.value === '' || Number.isNaN(minParsed)) ? -Infinity : minParsed
  const max = (maxCal.value === '' || Number.isNaN(maxParsed)) ?  Infinity : maxParsed

  return recipes.value.filter(r => {
    const titleStr = String(r.title || '')
    const tagsArr = Array.isArray(r.tags) ? r.tags : []
    const cals = typeof r.calories === 'number' ? r.calories : NaN

    const titleMatch = titleStr.toLowerCase().includes(kw)
    const tagMatch = tagsArr.some(t => String(t).toLowerCase().includes(kw))
    const kwOk = kw ? (titleMatch || tagMatch) : true

    const inRange = !Number.isNaN(cals) && cals >= min && cals <= max

    return kwOk && inRange
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

          <div class="mb-2">
            <span
              class="badge bg-secondary me-1"
              v-for="t in (Array.isArray(r.tags) ? r.tags : [])"
              :key="t"
            >
              {{ t }}
            </span>
          </div>

          <!-- C.3 Rating widget -->
          <RecipeRating :recipe-id="r.id" />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div class="col-12" v-if="filtered.length === 0">
      <div class="alert alert-warning">No recipes match your filters.</div>
    </div>
  </div>
</template>