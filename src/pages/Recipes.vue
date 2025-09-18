<script setup>
// Fetch dynamic data from Firestore
import { ref, computed, onMounted } from 'vue'
import { db } from '../firebase'
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
} from 'firebase/firestore'

// Rating UI (C.3)
import RecipeRating from '../components/RecipeRating.vue'

// UI state
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')

// Data
const recipes = ref([])

// Filters
const qText  = ref('')   // keyword for title/tags
const minCal = ref('')   // optional min calories
const maxCal = ref('')   // optional max calories

// ---- Add Recipe form state ----
const form = ref({
  title: '',
  calories: '',
  tagsText: '' // comma-separated
})

// Helpers
function parseTags(s) {
  return String(s || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
}

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

// Apply filters
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

// Submit handler to add a recipe（與舊 schema 一致）
async function addRecipe() {
  error.value = ''
  success.value = ''

  const title = form.value.title.trim()
  const caloriesNum = Number(form.value.calories)
  const tags = parseTags(form.value.tagsText)

  if (!title) {
    error.value = 'Title is required.'
    return
  }
  if (Number.isNaN(caloriesNum) || caloriesNum < 0) {
    error.value = 'Calories must be a non-negative number.'
    return
  }

  // 與舊資料一致：只存 title / calories / tags
  const payload = { title, calories: caloriesNum, tags }

  try {
    saving.value = true
    const col = collection(db, 'recipes')
    const docRef = await addDoc(col, payload)

    // Optimistic update
    recipes.value.push({ id: docRef.id, ...payload })

    // Reset form
    form.value.title = ''
    form.value.calories = ''
    form.value.tagsText = ''
    success.value = 'Recipe added!'
  } catch (e) {
    console.error(e)
    error.value = 'Failed to add recipe.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <h2 class="h4 mb-3 text-center">Recipe Library</h2>

  <!-- Add Recipe Card：整體置中 + 限寬 -->
  <div class="card mb-4 mx-auto add-card text-center">
    <div class="card-body">
      <h5 class="card-title mb-4">Add Recipe</h5>

      <div class="mx-auto add-form">
        <!-- Title -->
        <div class="mb-3 text-start">
          <label class="form-label">Title<span class="text-danger">*</span></label>
          <input
            class="form-control text-center"
            v-model.trim="form.title"
            placeholder="e.g., Grilled Chicken Salad"
          />
        </div>

        <!-- Calories -->
        <div class="mb-3 text-start">
          <label class="form-label">Calories<span class="text-danger">*</span></label>
          <input
            class="form-control text-center"
            v-model.number="form.calories"
            type="number"
            min="0"
            placeholder="e.g., 520"
          />
        </div>

        <!-- Tags -->
        <div class="mb-4 text-start">
          <label class="form-label">Tags (comma separated)</label>
          <input
            class="form-control text-center"
            v-model.trim="form.tagsText"
            placeholder="lunch, high-protein"
          />
        </div>

        <!-- Submit button -->
        <div class="d-flex justify-content-center">
          <button class="btn btn-primary px-5" :disabled="saving" @click="addRecipe">
            {{ saving ? 'Saving...' : 'Add' }}
          </button>
        </div>

        <!-- Messages -->
        <div class="mt-3" v-if="error">
          <div class="alert alert-danger py-2 mb-0">{{ error }}</div>
        </div>
        <div class="mt-3" v-if="success">
          <div class="alert alert-success py-2 mb-0">{{ success }}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Filters -->
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
  <div v-else-if="error && !success" class="alert alert-danger">{{ error }}</div>

  <!-- Results grid：固定 3 欄，最後一列置中；卡片等寬等高 -->
  <div v-else class="row g-3 justify-content-center">
    <div
      v-for="r in filtered"
      :key="r.id"
      class="col-12 col-md-6 col-lg-4 d-flex"
    >
      <div class="card h-100 w-100">
        <div class="card-body text-center d-flex flex-column">
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

          <div class="mt-auto">
            <RecipeRating :recipe-id="r.id" />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div class="col-12" v-if="filtered.length === 0">
      <div class="alert alert-warning text-center">No recipes match your filters.</div>
    </div>
  </div>
</template>

<style scoped>
/* Add Recipe：限寬 + 置中 */
.add-card { max-width: 720px; }
.add-form { max-width: 600px; }

/* keep the 3 inputs visually consistent */
.filters .form-control { min-height: 44px; }

/* normalize number inputs */
.filters input[type="number"]::-webkit-outer-spin-button,
.filters input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.filters input[type="number"] {
  -moz-appearance: textfield;
}
</style>