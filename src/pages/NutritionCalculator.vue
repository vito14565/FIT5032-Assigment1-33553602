<!-- src/pages/NutritionCalculator.vue -->
<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { auth, db } from '../firebase'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { searchFoods } from '../composables/useUsdaApi'

/* ---------- Row Data ---------- */
function makeRow(initial = {}) {
  return {
    name:   initial.name   ?? '',
    grams:  initial.grams  ?? 100,
    per100: initial.per100 ?? null,
    fdcId:  initial.fdcId  ?? null,
  }
}
const rows = ref([ makeRow(), makeRow() ])
const note = ref('')

/* ---------- Live Search (USDA) ---------- */
const queryText = ref('')
const searching = ref(false)
const results   = ref([])         // shared search results
const error     = ref('')
const activeRowIndex = ref(null)  // which row is “picking”

let debounceTimer = null
watch(queryText, (q) => {
  clearTimeout(debounceTimer)
  if (!q || q.trim().length < 2) { results.value = []; return }
  debounceTimer = setTimeout(async () => {
    try {
      searching.value = true
      results.value = await searchFoods(q.trim(), 20)
      error.value = ''
    } catch (e) {
      console.error(e)
      error.value = 'USDA API search failed. Please try again later.'
      results.value = []
    } finally {
      searching.value = false
    }
  }, 300)
})

function openPickerForRow(i) { activeRowIndex.value = i }

async function pickFood(item) {
  const i = activeRowIndex.value
  if (i == null) return
  const r = rows.value[i]
  r.name   = item.name
  r.per100 = item.per100
  r.fdcId  = item.fdcId

  // clear results and close picker after selection
  results.value = []
  queryText.value = ''
  activeRowIndex.value = null

  await nextTick()
  const input = document.querySelector(`#gram-input-${i}`)
  if (input) input.focus()
}

/* ESC / click outside closes picker */
function closePicker(){ activeRowIndex.value = null }
function onKey(e){ if (e.key === 'Escape') closePicker() }
function onDocClick(e){
  const host = document.querySelector('.nc-host')
  if (host && !host.contains(e.target)) closePicker()
}
onMounted(() => {
  document.addEventListener('keydown', onKey)
  document.addEventListener('click', onDocClick)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  document.removeEventListener('click', onDocClick)
})

/* ---------- Calculations ---------- */
function rowTotals(r) {
  const g = Number(r.grams) || 0
  if (!r.per100 || g <= 0) return { kcal:0, carbs_g:0, protein_g:0, fat_g:0 }
  const k = g / 100
  const p = r.per100
  return {
    kcal:       +(p.kcal       * k).toFixed(1),
    carbs_g:    +(p.carbs_g    * k).toFixed(1),
    protein_g:  +(p.protein_g  * k).toFixed(1),
    fat_g:      +(p.fat_g      * k).toFixed(1),
  }
}
const totals = computed(() =>
  rows.value.reduce((acc, r) => {
    const t = rowTotals(r)
    acc.kcal += t.kcal
    acc.carbs_g += t.carbs_g
    acc.protein_g += t.protein_g
    acc.fat_g += t.fat_g
    return acc
  }, { kcal:0, carbs_g:0, protein_g:0, fat_g:0 })
)

function addRow(){ rows.value.push(makeRow()) }
function removeRow(i){ rows.value.splice(i, 1) }

/* ---------- Save ---------- */
async function logToIntake() {
  if (!auth.currentUser) { alert('Please log in to save intake.'); return }
  const t = totals.value
  const dateKey = new Date().toISOString().slice(0,10)
  const parts = rows.value
    .filter(r => r.name && Number(r.grams) > 0)
    .map(r => `${r.name} ${Number(r.grams)}g`)
  let name = parts.join(', ') || 'Custom meal'
  if (note.value.trim()) name += ` — ${note.value.trim()}`

  const payload = {
    uid: auth.currentUser.uid,
    name,
    carbs_g:   +t.carbs_g.toFixed(1),
    protein_g: +t.protein_g.toFixed(1),
    fat_g:     +t.fat_g.toFixed(1),
    kcal:      Math.round(t.kcal),
    dateKey,
    ts: serverTimestamp()
  }

  try {
    await addDoc(collection(db, 'intake'), payload)
    alert('Logged to Intake!')
  } catch (e) {
    console.error(e)
    alert('Failed to log intake.')
  }
}
</script>

<template>
  <div class="container py-3 nc-host">
    <h1 class="h4 mb-3 text-center">Nutrition Calculator</h1>

    <div class="alert alert-info small" role="status">
      Enter a keyword in <strong>Search Ingredient</strong> → pick from the USDA database →
      enter weight (g). The system will calculate total calories and C/P/F automatically.
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <!-- Global search -->
        <div class="mb-3">
          <label for="q" class="form-label">Search Ingredient (USDA)</label>
          <input id="q" class="form-control" v-model.trim="queryText" placeholder="e.g., chicken breast, rice, apple" />
          <div class="form-text">
            {{
              searching
                ? 'Searching…'
                : (queryText.length >= 2
                    ? (results.length ? 'Click “Pick result” on a row to insert' : 'No results')
                    : 'Type at least 2 characters to search')
            }}
          </div>
          <div v-if="error" class="text-danger small mt-1">{{ error }}</div>
        </div>

        <div class="table-responsive">
          <table class="table align-middle">
            <thead>
              <tr>
                <th style="width:38%">Ingredient (per 100g)</th>
                <th style="width:14%">Grams</th>
                <th style="width:12%" class="text-end">kcal</th>
                <th style="width:12%" class="text-end">Carbs (g)</th>
                <th style="width:12%" class="text-end">Protein (g)</th>
                <th style="width:12%" class="text-end">Fat (g)</th>
                <th style="width:10%"></th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="(r,i) in rows" :key="i">
                <td>
                  <div class="mb-1 d-flex gap-2 align-items-start">
                    <input
                      class="form-control"
                      v-model.trim="r.name"
                      placeholder="(Select a result or enter a name)"
                    />

                    <!-- Custom picker -->
                    <div class="picker w-100">
                      <button
                        class="btn btn-outline-secondary"
                        type="button"
                        :disabled="queryText.length < 2"
                        @click.stop="openPickerForRow(i)"
                        aria-haspopup="listbox"
                        :aria-expanded="activeRowIndex === i && results.length > 0 ? 'true' : 'false'"
                      >
                        Pick result
                      </button>

                      <!-- Results panel -->
                      <ul
                        v-if="activeRowIndex === i && results.length > 0"
                        class="picker-menu list-group"
                        role="listbox"
                      >
                        <li
                          v-for="item in results"
                          :key="item.fdcId"
                          class="list-group-item list-group-item-action"
                          role="option"
                          @click.stop="pickFood(item)"
                        >
                          <div class="fw-semibold">{{ item.name }}</div>
                          <div class="small text-muted">
                            {{ item.per100.kcal }} kcal, C {{ item.per100.carbs_g }}g,
                            P {{ item.per100.protein_g }}g, F {{ item.per100.fat_g }}g
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div class="small text-muted" v-if="r.per100">
                    per 100g: {{ r.per100.kcal }} kcal, C {{ r.per100.carbs_g }}g,
                    P {{ r.per100.protein_g }}g, F {{ r.per100.fat_g }}g
                  </div>
                </td>

                <td>
                  <input
                    :id="`gram-input-${i}`"
                    type="number"
                    min="0"
                    step="1"
                    class="form-control text-center"
                    v-model.number="r.grams"
                    placeholder="g"
                  />
                </td>

                <td class="text-end">{{ rowTotals(r).kcal }}</td>
                <td class="text-end">{{ rowTotals(r).carbs_g }}</td>
                <td class="text-end">{{ rowTotals(r).protein_g }}</td>
                <td class="text-end">{{ rowTotals(r).fat_g }}</td>

                <td class="text-end">
                  <button class="btn btn-outline-danger btn-sm" @click="removeRow(i)" aria-label="Remove row">✕</button>
                </td>
              </tr>
            </tbody>

            <tfoot>
              <tr class="fw-semibold">
                <td class="text-end">Totals:</td>
                <td></td>
                <td class="text-end">{{ totals.kcal.toFixed(0) }}</td>
                <td class="text-end">{{ totals.carbs_g.toFixed(1) }}</td>
                <td class="text-end">{{ totals.protein_g.toFixed(1) }}</td>
                <td class="text-end">{{ totals.fat_g.toFixed(1) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="d-flex gap-2">
          <button class="btn btn-outline-primary" @click="addRow">+ Add ingredient</button>
          <input class="form-control" style="max-width: 320px" v-model.trim="note" placeholder="Note (optional)" />
          <button class="btn btn-primary ms-auto" @click="logToIntake">Save to Intake</button>
        </div>
      </div>
    </div>

    <p class="text-muted small">
      This page uses USDA FoodData Central (Foundation + SR Legacy). Values are estimates per 100g.
    </p>
  </div>
</template>

<style scoped>
table td, table th { vertical-align: middle; }

.picker { position: relative; display: inline-block; }

.picker-menu {
  position: absolute;
  left: 0;
  top: calc(100% + 6px);
  z-index: 1060;
  width: 100%;
  max-width: min(720px, 100%);
  max-height: 320px;
  overflow: auto;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: .5rem;
  box-shadow: 0 0.75rem 1.5rem rgba(0,0,0,.15);
}

.picker-menu .list-group-item {
  white-space: normal;
  cursor: pointer;
}
.picker-menu .list-group-item:hover { background: #f8f9fa; }
</style>