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

// Simple field validations for a11y hints
const titleInvalid = computed(() => form.value.title.trim() === '')
const caloriesInvalid = computed(() => {
  const n = Number(form.value.calories)
  return Number.isNaN(n) || n < 0
})

// Submit handler to add a recipe
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

  // Consistent with old data: only store title / calories / tags
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
  <!-- Use h1 as the page main heading for SR users -->
  <h1 class="h4 mb-3 text-center">Recipe Library</h1>

  <!-- Add Recipe Card: centered overall + fixed width -->
  <div class="card mb-4 mx-auto add-card text-center" aria-labelledby="add-recipe-title">
    <div class="card-body">
      <!-- Section heading -->
      <h2 id="add-recipe-title" class="card-title mb-4 h5">Add Recipe</h2>

      <!-- Real HTML form for better semantics and keyboard submit -->
      <form class="mx-auto add-form" @submit.prevent="addRecipe" aria-describedby="add-recipe-help">
        <p id="add-recipe-help" class="sr-only">
          Fields marked with asterisk are required.
        </p>

        <!-- Title -->
        <div class="mb-3 text-start">
          <label class="form-label" for="recipe-title">
            Title <span class="text-danger" aria-hidden="true">*</span>
          </label>
          <input
            id="recipe-title"
            class="form-control text-center"
            v-model.trim="form.title"
            placeholder="e.g., Grilled Chicken Salad"
            :aria-invalid="titleInvalid ? 'true' : 'false'"
            aria-describedby="title-hint"
            required
          />
          <div id="title-hint" class="form-text">Provide a descriptive recipe title.</div>
        </div>

        <!-- Calories -->
        <div class="mb-3 text-start">
          <label class="form-label" for="recipe-calories">
            Calories <span class="text-danger" aria-hidden="true">*</span>
          </label>
          <input
            id="recipe-calories"
            class="form-control text-center"
            v-model.number="form.calories"
            type="number"
            min="0"
            inputmode="numeric"
            placeholder="e.g., 520"
            :aria-invalid="caloriesInvalid ? 'true' : 'false'"
            aria-describedby="calories-hint"
            required
          />
          <div id="calories-hint" class="form-text">Enter a non-negative number.</div>
        </div>

        <!-- Tags -->
        <div class="mb-4 text-start">
          <label class="form-label" for="recipe-tags">Tags (comma separated)</label>
          <input
            id="recipe-tags"
            class="form-control text-center"
            v-model.trim="form.tagsText"
            placeholder="lunch, high-protein"
          />
        </div>

        <!-- Submit button -->
        <div class="d-flex justify-content-center">
          <button
            class="btn btn-primary px-5"
            type="submit"
            :disabled="saving"
            :aria-busy="saving ? 'true' : 'false'"
          >
            {{ saving ? 'Saving...' : 'Add' }}
          </button>
        </div>

        <!-- Messages: assertive for errors, polite for success -->
        <div class="mt-3" v-if="error">
          <div class="alert alert-danger py-2 mb-0" role="alert" aria-live="assertive">
            {{ error }}
          </div>
        </div>
        <div class="mt-3" v-if="success">
          <div class="alert alert-success py-2 mb-0" aria-live="polite">
            {{ success }}
          </div>
        </div>
      </form>
    </div>
  </div>

  <!-- Filters: provide hidden labels so SR can identify each control -->
  <div class="row row-cols-1 row-cols-md-3 g-2 mb-3 filters" role="group" aria-label="Recipe filters">
    <div class="col">
      <label for="filter-text" class="sr-only">Search by title or tag</label>
      <input
        id="filter-text"
        class="form-control w-100"
        v-model.trim="qText"
        placeholder="Search by title or tag..."
      />
    </div>
    <div class="col">
      <label for="filter-min" class="sr-only">Minimum calories</label>
      <input
        id="filter-min"
        class="form-control w-100"
        v-model.number="minCal"
        type="number"
        min="0"
        inputmode="numeric"
        placeholder="Min calories"
      />
    </div>
    <div class="col">
      <label for="filter-max" class="sr-only">Maximum calories</label>
      <input
        id="filter-max"
        class="form-control w-100"
        v-model.number="maxCal"
        type="number"
        min="0"
        inputmode="numeric"
        placeholder="Max calories"
      />
    </div>
  </div>

  <!-- States -->
  <div v-if="loading" class="alert alert-info" aria-live="polite">Loading recipes...</div>
  <div v-else-if="error && !success" class="alert alert-danger" role="alert" aria-live="assertive">{{ error }}</div>

  <!-- Results grid: role=list makes semantics clear for SR; items as listitem -->
  <div v-else class="row g-3 justify-content-center" role="list" aria-label="Recipe results">
    <div
      v-for="r in filtered"
      :key="r.id"
      class="col-12 col-md-6 col-lg-4 d-flex"
      role="listitem"
    >
      <div class="card h-100 w-100">
        <div class="card-body text-center d-flex flex-column">
          <h3 class="h5 card-title">{{ r.title }}</h3>
          <p class="card-text mb-2">
            <span v-if="typeof r.calories === 'number'">Calories: {{ r.calories }}</span>
          </p>

          <div class="mb-2">
            <span
              class="badge bg-secondary me-1"
              v-for="t in (Array.isArray(r.tags) ? r.tags : [])"
              :key="t"
            >
              {{ t }}
            </span>
          </div>

          <!-- Keep rating UI; assume it is accessible internally -->
          <div class="mt-auto">
            <RecipeRating :recipe-id="r.id" />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div class="col-12" v-if="filtered.length === 0">
      <div class="alert alert-warning text-center" aria-live="polite">No recipes match your filters.</div>
    </div>
  </div>
</template>

<style scoped>
/* Add Recipe: fixed width + centered */
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

/* Screen-reader-only utility (in case global isn't loaded in tests) */
.sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(1px,1px,1px,1px);
  white-space: nowrap;
}
</style>