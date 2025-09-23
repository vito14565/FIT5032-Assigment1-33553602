<script setup>
// Fetch dynamic data from Firestore
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
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
const router = useRouter()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const success = ref('')

// Data
const recipes = ref([])

// Filters
const qText  = ref('')   // keyword for title/tags/cuisine
const minCal = ref('')   // optional min calories
const maxCal = ref('')   // optional max calories

// Dietary filter (multi-select)
const dietSelected = ref([]) // e.g., ['Vegetarian','Halal']
const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Halal',
  'Gluten-Free',
  'Keto',
  'Pescatarian'
]

// Cuisine options (for Add form)
const CUISINE_OPTIONS = [
  'Chinese','Japanese','Korean','Thai','Vietnamese','Indian',
  'Italian','French','Spanish','Mexican','Middle Eastern',
  'Mediterranean','American','Other'
]

// ---- Add Recipe form state ----
const form = ref({
  title: '',
  calories: '',
  tagsText: '',     // comma-separated
  cuisine: '',      // one of CUISINE_OPTIONS
  dietary: []       // ✅ multi-select array
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
  const diets = dietSelected.value

  return recipes.value.filter(r => {
    const titleStr = String(r.title || '')
    const tagsArr  = Array.isArray(r.tags) ? r.tags : []
    const cals     = typeof r.calories === 'number' ? r.calories : NaN
    const dietary  = Array.isArray(r.dietary) ? r.dietary : [] // 兼容舊資料
    const cuisine  = String(r.cuisine || '')                   // 兼容舊資料

    // Global keyword: title / tags / cuisine
    const titleMatch   = titleStr.toLowerCase().includes(kw)
    const tagMatch     = tagsArr.some(t => String(t).toLowerCase().includes(kw))
    const cuisineMatch = cuisine.toLowerCase().includes(kw)
    const kwOk         = kw ? (titleMatch || tagMatch || cuisineMatch) : true

    const inRange = !Number.isNaN(cals) && cals >= min && cals <= max

    // Dietary filter: only check when selected; require all selected to be included
    const dietOk = diets.length === 0 || diets.every(d => dietary.includes(d))

    return kwOk && inRange && dietOk
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
  const cuisine = form.value.cuisine.trim()
  const dietary = Array.isArray(form.value.dietary) ? form.value.dietary.filter(Boolean) : []

  if (!title) {
    error.value = 'Title is required.'
    return
  }
  if (Number.isNaN(caloriesNum) || caloriesNum < 0) {
    error.value = 'Calories must be a non-negative number.'
    return
  }

  // Backward compatible payload
  const payload = { title, calories: caloriesNum, tags }
  if (cuisine) payload.cuisine = cuisine
  if (dietary.length > 0) payload.dietary = dietary

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
    form.value.cuisine = ''
    form.value.dietary = []
    success.value = 'Recipe added!'
  } catch (e) {
    console.error(e)
    error.value = 'Failed to add recipe.'
  } finally {
    saving.value = false
  }
}

// Go to detail page
function goDetail(id) {
  router.push({ name: 'recipe-detail', params: { id } })
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
        <div class="mb-3 text-start">
          <label class="form-label" for="recipe-tags">Tags (comma separated)</label>
          <input
            id="recipe-tags"
            class="form-control text-center"
            v-model.trim="form.tagsText"
            placeholder="lunch, high-protein"
          />
        </div>

        <!-- Dietary Needs -->
        <div class="mb-3 text-start">
          <label class="form-label" for="recipe-dietary">Dietary Needs</label>
          <select
            id="recipe-dietary"
            class="form-select text-center"
            v-model="form.dietary"
            multiple
            aria-describedby="dietary-hint"
          >
            <option v-for="opt in DIETARY_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <small id="dietary-hint" class="text-muted">Hold ⌘/Ctrl to multi-select</small>
        </div>

        <!-- Cuisine -->
        <div class="mb-4 text-start">
          <label class="form-label" for="recipe-cuisine">Cuisine</label>
          <select id="recipe-cuisine" class="form-select text-center" v-model="form.cuisine">
            <option value="">-- Select cuisine (optional) --</option>
            <option v-for="c in CUISINE_OPTIONS" :key="c" :value="c">{{ c }}</option>
          </select>
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

  <!-- Filters -->
  <div class="row row-cols-1 row-cols-md-4 g-2 mb-3 filters" role="group" aria-label="Recipe filters">
    <div class="col">
      <label for="filter-text" class="sr-only">Search by title, tag or cuisine</label>
      <input
        id="filter-text"
        class="form-control w-100"
        v-model.trim="qText"
        placeholder="Search by title, tag or cuisine..."
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

    <!-- Dietary multi-select -->
    <div class="col">
      <label for="filter-diet" class="sr-only">Dietary Needs</label>
      <select
        id="filter-diet"
        class="form-select w-100"
        v-model="dietSelected"
        multiple
      >
        <option v-for="opt in DIETARY_OPTIONS" :key="opt" :value="opt">
          {{ opt }}
        </option>
      </select>
      <small class="text-muted">Hold ⌘/Ctrl to multi-select</small>
    </div>
  </div>

  <!-- States -->
  <div v-if="loading" class="alert alert-info" aria-live="polite">Loading recipes...</div>
  <div v-else-if="error && !success" class="alert alert-danger" role="alert" aria-live="assertive">{{ error }}</div>

  <!-- Results grid -->
  <div v-else class="row g-3 justify-content-center" role="list" aria-label="Recipe results">
    <div
      v-for="r in filtered"
      :key="r.id"
      class="col-12 col-md-6 col-lg-4 d-flex"
      role="listitem"
    >
      <div class="card h-100 w-100 hover-shadow" @click="goDetail(r.id)" style="cursor:pointer">
        <div class="card-body text-center d-flex flex-column">
          <h3 class="h5 card-title">{{ r.title }}</h3>

          <p class="card-text mb-2">
            <span v-if="typeof r.calories === 'number'">Calories: {{ r.calories }}</span>
          </p>

          <!-- Cuisine + Dietary + Tags -->
          <div class="mb-2">
            <span v-if="r.cuisine" class="badge bg-primary me-1">{{ r.cuisine }}</span>
            <span
              class="badge bg-success me-1"
              v-for="d in (Array.isArray(r.dietary) ? r.dietary : [])"
              :key="`diet-${d}`"
            >{{ d }}</span>
            <span
              class="badge bg-secondary me-1"
              v-for="t in (Array.isArray(r.tags) ? r.tags : [])"
              :key="`tag-${t}`"
            >{{ t }}</span>
          </div>

          <!-- Keep rating UI -->
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

/* keep the inputs visually consistent */
.filters .form-control,
.filters .form-select { min-height: 44px; }

/* normalize number inputs */
.filters input[type="number"]::-webkit-outer-spin-button,
.filters input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.filters input[type="number"] {
  -moz-appearance: textfield;
}

/* Card hover */
.hover-shadow:hover { box-shadow: 0 0.5rem 1rem rgba(0,0,0,.15); }

/* Screen-reader-only utility */
.sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(1px,1px,1px,1px);
  white-space: nowrap;
}
</style>