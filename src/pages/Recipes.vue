<script setup>
// Fetch dynamic data from Firestore
import { ref, computed, onMounted } from 'vue'
import { db } from '../firebase'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'

// Rating UI (C.3)
import RecipeRating from '../components/RecipeRating.vue'

// UI state
const loading = ref(true)
const error = ref('')

// Data
const recipes = ref([])

// Filters
const qText  = ref('')   // keyword for title/tags
const minCal = ref('')   // optional min calories
const maxCal = ref('')   // optional max calories

// Load data on mount
onMounted(async () => {
  try {
    const col  = collection(db, 'recipes')
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
  const kw  = qText.value.trim().toLowerCase()
  const min = (minCal.value === '' || Number.isNaN(Number(minCal.value))) ? -Infinity : Number(minCal.value)
  const max = (maxCal.value === '' || Number.isNaN(Number(maxCal.value))) ?  Infinity : Number(maxCal.value)

  return recipes.value.filter(r => {
    const titleStr = String(r.title || '')
    const tagsArr  = Array.isArray(r.tags) ? r.tags : []
    const cals     = typeof r.calories === 'number' ? r.calories : NaN

    const titleMatch = titleStr.toLowerCase().includes(kw)
    const tagMatch   = tagsArr.some(t => String(t).toLowerCase().includes(kw))
    const kwOk       = kw ? (titleMatch || tagMatch) : true

    const inRange = !Number.isNaN(cals) && cals >= min && cals <= max
    return kwOk && inRange
  })
})

// Dynamic grid helpers: center when results < 3
const gridColsClass = computed(() => {
  const n = filtered.value.length
  if (n <= 1) return 'row-cols-1'
  if (n === 2) return 'row-cols-1 row-cols-md-2'
  return 'row-cols-1 row-cols-md-2 row-cols-lg-3'
})
const gridJustifyClass = computed(() =>
  filtered.value.length < 3 ? 'justify-content-center' : ''
)

// NEW: when only 1 item, don't let the card stretch full width; center it and cap width
const singleColClass = computed(() =>
  filtered.value.length === 1 ? 'col-12 col-md-8 col-lg-6 mx-auto' : ''
)
</script>

<template>
  <h2 class="h4 mb-3 text-center text-md-start">Recipe Library</h2>

  <!-- Filters: stack on xs, 3 equal columns on md+ -->
  <div class="row row-cols-1 row-cols-md-3 g-2 mb-3 filters">
    <div class="col">
      <input class="form-control w-100" v-model.trim="qText" placeholder="Search by title or tag..." />
    </div>
    <div class="col">
      <input class="form-control w-100" v-model.number="minCal" type="number" min="0" placeholder="Min calories" />
    </div>
    <div class="col">
      <input class="form-control w-100" v-model.number="maxCal" type="number" min="0" placeholder="Max calories" />
    </div>
  </div>

  <!-- States -->
  <div v-if="loading" class="alert alert-info">Loading recipes...</div>
  <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

  <!-- Results grid: dynamic columns + centering when few items -->
  <div v-else :class="['row g-3', gridColsClass, gridJustifyClass]">
    <div v-for="r in filtered" :key="r.id" :class="['col', singleColClass]">
      <div class="card h-100">
        <div class="card-body">
          <h5 class="card-title">{{ r.title }}</h5>
          <p class="card-text mb-2">Calories: {{ r.calories }}</p>

          <div class="mb-2">
            <span class="badge bg-secondary me-1" v-for="t in (Array.isArray(r.tags) ? r.tags : [])" :key="t">
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

<style scoped>
/* keep the 3 inputs visually consistent across browsers */
.filters .form-control { min-height: 44px; }

/* normalize number inputs (Safari/Chrome arrows change height) */
.filters input[type="number"]::-webkit-outer-spin-button,
.filters input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.filters input[type="number"] {
  -moz-appearance: textfield; /* Firefox */
}
</style>