<!-- src/pages/Dashboard.vue -->
<script setup>
import { ref, reactive, computed, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { auth, db } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, addDoc,
  query, where, orderBy, onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import {
  Chart,
  ArcElement, Tooltip, Legend,
  LineElement, PointElement, LinearScale, CategoryScale, Title,
} from 'chart.js'
import { Pie, Line } from 'vue-chartjs'

Chart.register(
  ArcElement, Tooltip, Legend,
  LineElement, PointElement, LinearScale, CategoryScale, Title
)

/** ---------- Utils ---------- **/
function toLocalYmd(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10) // YYYY-MM-DD
}
function todayKey(d = new Date()) { return toLocalYmd(d) }
function kcalOf({ carbs_g, protein_g, fat_g }) {
  return Math.round((Number(carbs_g||0)*4) + (Number(protein_g||0)*4) + (Number(fat_g||0)*9))
}
function pct(n, d) { 
  if (!d) return 0
  return Math.round((n * 100) / d) 
}

/** ---------- A11y live regions ---------- **/
const statusMsg = ref('')
const alertMsg  = ref('')

/** ---------- Tiny toast ---------- **/
const toastOpen = ref(false)
const toastMsg = ref('')
const toastType = ref('success')
let toastTimer = null
function flash(msg, type = 'success', ms = 2500) {
  toastMsg.value = msg
  toastType.value = type
  toastOpen.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastOpen.value = false), ms)
}

/** ---------- Firestore onSnapshot unsub holders ---------- **/
let unsubToday = null          // today list subscription
// watchHistory 本身會掛一個 watchHistory.unsub

/** ---------- Auth ---------- **/
const uid = ref(null)
onMounted(() => {
  const stop = onAuthStateChanged(auth, (u) => {
    uid.value = u?.uid || null
    stop()

    // 先清理舊訂閱（避免上一個使用者或未登入狀態殘留）
    if (unsubToday) { unsubToday(); unsubToday = null }
    if (typeof watchHistory.unsub === 'function') { watchHistory.unsub(); watchHistory.unsub = null }

    if (uid.value) {
      loadGoals()
      watchTodayIntake()
      watchHistory()
    } else {
      alertMsg.value = 'Please sign in to use the dashboard.'
      flash('Please sign in to use the dashboard.', 'error')
    }
  })
})

/** ---------- Daily Goal (BR4 擴充：四項目標) ---------- **/
const goalForm = reactive({
  email: '',
  calories: '',
  protein_g: '',
  carbs_g: '',
  fat_g: ''
})
const errors = reactive({})
const emailEl = ref(null)
const caloriesEl = ref(null)

function validateGoal() {
  Object.keys(errors).forEach(k => delete errors[k])
  statusMsg.value = ''
  alertMsg.value  = ''

  if (goalForm.email && !/^\S+@\S+\.\S+$/.test(goalForm.email)) {
    errors.email = 'Invalid email format'
  }
  const cal = Number(goalForm.calories)
  if (goalForm.calories === '' || goalForm.calories === null) {
    errors.calories = 'Calories is required'
  } else if (Number.isNaN(cal) || cal < 0 || cal > 5000) {
    errors.calories = 'Calories must be between 0 and 5000'
  }

  // 其餘目標非必填，但若填寫需合理
  ;(['protein_g','carbs_g','fat_g']).forEach(k => {
    const v = goalForm[k]
    if (v === '' || v === null) return
    const n = Number(v)
    if (Number.isNaN(n) || n < 0 || n > 2000) {
      errors[k] = '0–2000'
    }
  })

  const firstKey = Object.keys(errors)[0]
  if (firstKey) {
    nextTick(() => {
      const el = firstKey === 'email' ? emailEl.value : caloriesEl.value
      el?.focus?.()
      el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      alertMsg.value = 'Please fix the errors in the form.'
      flash('Please fix the errors in the form.', 'error')
    })
    return false
  }
  return true
}

async function saveGoal() {
  if (!uid.value) { flash('You must be signed in.', 'error'); return }
  if (!validateGoal()) return
  const gRef = doc(db, 'goals', uid.value)
  const payload = {
    uid: uid.value,
    kcal: Number(goalForm.calories),
    // 新增三大營養素目標（可為空，用 undefined 排除）
    protein_g: goalForm.protein_g === '' ? undefined : Number(goalForm.protein_g),
    carbs_g:   goalForm.carbs_g   === '' ? undefined : Number(goalForm.carbs_g),
    fat_g:     goalForm.fat_g     === '' ? undefined : Number(goalForm.fat_g),
    updatedAt: Date.now(),
    ...(goalForm.email ? { email: goalForm.email } : {})
  }
  await setDoc(gRef, payload, { merge: true })
  statusMsg.value = 'Daily goal saved.'
  flash('Daily goal saved ✅', 'success')
}

/** ---------- Add Meal (auto kcal) ---------- **/
const intakeForm = reactive({ name: '', carbs_g: '', protein_g: '', fat_g: '' })
const kcalLive = computed(() => kcalOf({
  carbs_g: intakeForm.carbs_g,
  protein_g: intakeForm.protein_g,
  fat_g: intakeForm.fat_g,
}))
const intakeErrors = reactive({})
const mealNameEl = ref(null)

function validateIntake() {
  Object.keys(intakeErrors).forEach(k => delete intakeErrors[k])
  if (!intakeForm.name.trim()) intakeErrors.name = 'Name is required'
  ;['carbs_g','protein_g','fat_g'].forEach(f => {
    const v = Number(intakeForm[f])
    if (intakeForm[f] === '' || intakeForm[f] === null) intakeErrors[f] = 'Required'
    else if (Number.isNaN(v) || v < 0 || v > 2000) intakeErrors[f] = '0–2000'
  })
  const firstKey = Object.keys(intakeErrors)[0]
  if (firstKey) {
    nextTick(() => { if (firstKey === 'name') mealNameEl.value?.focus?.() })
    flash('Please fix the meal form.', 'error')
    return false
  }
  return true
}

async function addIntake() {
  if (!uid.value) { flash('You must be signed in.', 'error'); return }
  if (!validateIntake()) return

  await addDoc(collection(db, 'intake'), {
    uid: uid.value,
    name: intakeForm.name.trim() || 'Meal',
    carbs_g: Number(intakeForm.carbs_g || 0),
    protein_g: Number(intakeForm.protein_g || 0),
    fat_g: Number(intakeForm.fat_g || 0),
    kcal: kcalLive.value,
    ts: serverTimestamp(),
    dateKey: todayKey(),
  })

  intakeForm.name = ''
  intakeForm.carbs_g = ''
  intakeForm.protein_g = ''
  intakeForm.fat_g = ''
  statusMsg.value = 'Meal added.'
  flash('Meal added 🍽️', 'success')
}

/** ---------- Today list + totals ---------- **/
const todayMeals = ref([]) // [{id, ...}]
const totals = computed(() =>
  todayMeals.value.reduce((acc, x) => {
    acc.carbs_g  += Number(x.carbs_g  || 0)
    acc.protein_g+= Number(x.protein_g|| 0)
    acc.fat_g    += Number(x.fat_g    || 0)
    acc.kcal     += Number(x.kcal     || 0)
    return acc
  }, { carbs_g: 0, protein_g: 0, fat_g: 0, kcal: 0 })
)

// 目標文件（goals/{uid}）
const goals = ref(null)

async function loadGoals() {
  const gRef = doc(db, 'goals', uid.value)
  const snap = await getDoc(gRef)
  if (snap.exists()) {
    goals.value = snap.data()
    if (snap.data().kcal != null) goalForm.calories = String(snap.data().kcal)
    // 將三大營養素預填回表單（若有值）
    ;(['protein_g','carbs_g','fat_g']).forEach(k => {
      if (snap.data()[k] != null) goalForm[k] = String(snap.data()[k])
    })
  }
}

/* ----- Edit/Delete ----- */
const editingId = ref(null)
const editForm = reactive({ name: '', carbs_g: '', protein_g: '', fat_g: '' })
function openEdit(meal) {
  editingId.value = meal.id
  editForm.name = meal.name
  editForm.carbs_g = meal.carbs_g
  editForm.protein_g = meal.protein_g
  editForm.fat_g = meal.fat_g
}
function closeEdit() {
  editingId.value = null
  editForm.name = ''
  editForm.carbs_g = ''
  editForm.protein_g = ''
  editForm.fat_g = ''
}
async function saveEdit() {
  if (!editingId.value) return
  const ok = ['carbs_g','protein_g','fat_g'].every(k => {
    const n = Number(editForm[k]); return !Number.isNaN(n) && n >= 0 && n <= 2000
  }) && editForm.name?.trim()
  if (!ok) { flash('Invalid values. Please check form.', 'error'); return }

  const refDoc = doc(db, 'intake', editingId.value)
  await updateDoc(refDoc, {
    name: editForm.name.trim(),
    carbs_g: Number(editForm.carbs_g),
    protein_g: Number(editForm.protein_g),
    fat_g: Number(editForm.fat_g),
    kcal: kcalOf({
      carbs_g: Number(editForm.carbs_g),
      protein_g: Number(editForm.protein_g),
      fat_g: Number(editForm.fat_g),
    }),
  })
  flash('Meal updated ✏️', 'success')
  closeEdit()
}
async function removeMeal(id) {
  if (!confirm('Delete this meal?')) return
  await deleteDoc(doc(db, 'intake', id))
  flash('Meal deleted 🗑️', 'success')
}

function watchTodayIntake() {
  if (!uid.value) return
  const colRef = collection(db, 'intake')

  // needs composite index: uid ASC, dateKey ASC, ts DESC
  const qIndexed = query(
    colRef,
    where('uid', '==', uid.value),
    where('dateKey', '==', todayKey()),
    orderBy('ts', 'desc')
  )
  const qFallback = query(
    colRef,
    where('uid', '==', uid.value),
    where('dateKey', '==', todayKey())
  )

  const subscribe = (q, isFallback = false) => onSnapshot(
    q,
    (snap) => {
      let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (isFallback) {
        rows.sort((a, b) => (b.ts?.seconds ?? 0) - (a.ts?.seconds ?? 0))
      }
      todayMeals.value = rows
    },
    (err) => {
      if (err?.code === 'failed-precondition') {
        console.warn('Missing composite index; using fallback for today list.')
        if (unsubToday) { unsubToday() }
        unsubToday = subscribe(qFallback, true)
      } else {
        console.error('onSnapshot error:', err)
      }
    }
  )

  // 先清舊後訂新
  if (unsubToday) { unsubToday(); unsubToday = null }
  unsubToday = subscribe(qIndexed, false)
}

/** ---------- BR1 Pie (colored) ---------- **/
const PIE_COLORS = {
  carbs:   '#60a5fa',
  protein: '#34d399',
  fat:     '#fbbf24',
}
const pieData = computed(() => ({
  labels: ['Carbs', 'Protein', 'Fat'],
  datasets: [{
    data: [
      totals.value.carbs_g * 4,
      totals.value.protein_g * 4,
      totals.value.fat_g * 9,
    ],
    backgroundColor: [PIE_COLORS.carbs, PIE_COLORS.protein, PIE_COLORS.fat],
    borderWidth: 0,
    hoverOffset: 8,
  }]
}))
const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16 } },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const total = ctx.dataset.data.reduce((a,b)=>a+b,0) || 1
          const pctNum = Math.round((ctx.raw / total) * 100)
          return `${ctx.label}: ${ctx.raw} kcal (${pctNum}%)`
        }
      }
    }
  }
}

/** ---------- BR1 History (7/30 days) ---------- */
const historyDays = ref(7) // 7 or 30
const historySeries = ref([]) // [{dateKey, kcal}]

function startKeyForDays(days) {
  const d = new Date()
  d.setHours(0,0,0,0)
  d.setDate(d.getDate() - (days - 1)) // include today
  return toLocalYmd(d)
}
function buildDateRange(fromKey) {
  const out = []
  const start = new Date(fromKey + 'T00:00:00')
  const today = new Date()
  start.setHours(0,0,0,0); today.setHours(0,0,0,0)
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    out.push(toLocalYmd(d))
  }
  return out
}

const historyLabels = computed(() => historySeries.value.map(x => x.dateKey))
const historyKcals  = computed(() => historySeries.value.map(x => x.kcal))
const historyData = computed(() => ({
  labels: historyLabels.value,
  datasets: [{
    label: 'Daily kcal',
    data: historyKcals.value,
    borderColor: '#4f46e5',
    backgroundColor: '#c7d2fe',
    pointRadius: 4,
    pointHoverRadius: 6,
    borderWidth: 2,
    tension: 0.25,
    fill: false,
    spanGaps: true,
  }]
}))
const historyOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, title: { display: true, text: 'Kcal Trend' } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
}

function watchHistory() {
  if (!uid.value) return
  const fromKey = startKeyForDays(historyDays.value)
  const toKey   = toLocalYmd(new Date())

  const colRef = collection(db, 'intake')

  // Recommended index: uid ASC, dateKey ASC
  const qIndexed = query(
    colRef,
    where('uid', '==', uid.value),
    where('dateKey', '>=', fromKey),
    where('dateKey', '<=', toKey),
    orderBy('dateKey', 'asc')
  )
  const qFallback = query(
    colRef,
    where('uid', '==', uid.value),
    where('dateKey', '>=', fromKey),
    where('dateKey', '<=', toKey)
  )

  const aggregate = (docs, needSort = false) => {
    const byDay = new Map()
    docs.forEach(d => {
      const v = d.data()
      const k = v.dateKey
      byDay.set(k, (byDay.get(k) || 0) + Number(v.kcal || 0))
    })
    const range = buildDateRange(fromKey)
    let arr = range.map(k => ({ dateKey: k, kcal: byDay.get(k) || 0 }))
    if (needSort) arr.sort((a,b)=>a.dateKey.localeCompare(b.dateKey))
    return arr
  }

  const subscribe = (q, sorted = false) => onSnapshot(
    q,
    (snap) => { historySeries.value = aggregate(snap.docs, sorted) },
    (err) => {
      if (err?.code === 'failed-precondition') {
        console.warn('Missing composite index; history falls back without orderBy.')
        if (typeof watchHistory.unsub === 'function') { watchHistory.unsub() }
        watchHistory.unsub = subscribe(qFallback, true)
      } else {
        console.error('history onSnapshot error:', err)
      }
    }
  )

  if (typeof watchHistory.unsub === 'function') { watchHistory.unsub() }
  watchHistory.unsub = subscribe(qIndexed, false)
}
function changeHistoryRange(days) {
  historyDays.value = days
  watchHistory()
}

/** ---------- BR4：計算進度與建議 ---------- */
const progress = computed(() => {
  const g = goals.value || {}
  return {
    kcal:    pct(totals.value.kcal,     g.kcal || 0),
    protein: pct(totals.value.protein_g,g.protein_g || 0),
    carbs:   pct(totals.value.carbs_g,  g.carbs_g || 0),
    fat:     pct(totals.value.fat_g,    g.fat_g || 0),
  }
})
const smartTips = computed(() => {
  const g = goals.value || {}
  const t = totals.value
  const tips = []
  if (g.kcal) {
    if (t.kcal < g.kcal * 0.85) tips.push('Calories below 85% — consider an extra snack.')
    if (t.kcal > g.kcal * 1.10) tips.push('Calories exceed 110% — go lighter next meal.')
  }
  if (g.protein_g && t.protein_g < g.protein_g) tips.push('Protein below target — add tofu/lean meat/yogurt.')
  if (g.carbs_g && t.carbs_g < g.carbs_g * 0.8) tips.push('Carbs quite low — whole grains or fruit can help.')
  if (g.fat_g && t.fat_g > g.fat_g * 1.2) tips.push('Fat exceeds 120% — reduce oils or high-fat toppings.')
  return tips
})

/** ---------- cleanup on leave ---------- */
onBeforeUnmount(() => {
  if (unsubToday) { unsubToday(); unsubToday = null }
  if (typeof watchHistory.unsub === 'function') { watchHistory.unsub(); watchHistory.unsub = null }
})
</script>

<template>
  <div class="container py-4">
    <h2 class="h4 mb-4">🍽️ Meal Planner / Dashboard</h2>

    <!-- SR live regions -->
    <p class="sr-only" aria-live="polite">{{ statusMsg }}</p>
    <p class="sr-only" role="alert" aria-live="assertive">{{ alertMsg }}</p>

    <!-- Toast -->
    <transition name="fade">
      <div
        v-show="toastOpen"
        class="toasty"
        :class="{
          'toasty--success': toastType==='success',
          'toasty--error': toastType==='error',
          'toasty--info': toastType==='info'
        }"
        role="status"
        aria-live="polite"
      >
        {{ toastMsg }}
      </div>
    </transition>

    <!-- 1) Daily Goal (擴充：新增三大營養素目標) -->
    <div class="card p-4 mb-4 shadow-sm">
      <h5 class="mb-3">🎯 Daily Goal</h5>
      <form class="row gy-3" @submit.prevent="saveGoal" novalidate>
        <div class="col-12 col-md-6">
          <label for="email" class="form-label">Email (optional)</label>
          <input
            id="email"
            ref="emailEl"
            class="form-control"
            v-model.trim="goalForm.email"
            type="email"
            placeholder="you@example.com"
            :aria-invalid="!!errors.email"
            :aria-describedby="errors.email ? 'email-error' : null"
          />
          <div v-if="errors.email" id="email-error" class="text-danger small mt-1" role="alert">
            {{ errors.email }}
          </div>
        </div>

        <div class="col-12 col-md-6">
          <label for="calories" class="form-label">Daily Calories Target</label>
          <input
            id="calories"
            ref="caloriesEl"
            class="form-control"
            v-model.trim="goalForm.calories"
            type="number"
            min="0"
            max="5000"
            required
            :aria-invalid="!!errors.calories"
            :aria-describedby="errors.calories ? 'calories-error' : null"
          />
          <div v-if="errors.calories" id="calories-error" class="text-danger small mt-1" role="alert">
            {{ errors.calories }}
          </div>
        </div>

        <!-- 新增：三大營養素目標（可選） -->
        <div class="col-12 col-md-4">
          <label class="form-label">Protein (g)</label>
          <input class="form-control" v-model.trim="goalForm.protein_g" type="number" min="0" max="2000"
                 :aria-invalid="!!errors.protein_g" />
          <div v-if="errors.protein_g" class="text-danger small mt-1" role="alert">{{ errors.protein_g }}</div>
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">Carbs (g)</label>
          <input class="form-control" v-model.trim="goalForm.carbs_g" type="number" min="0" max="2000"
                 :aria-invalid="!!errors.carbs_g" />
          <div v-if="errors.carbs_g" class="text-danger small mt-1" role="alert">{{ errors.carbs_g }}</div>
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">Fat (g)</label>
          <input class="form-control" v-model.trim="goalForm.fat_g" type="number" min="0" max="2000"
                 :aria-invalid="!!errors.fat_g" />
          <div v-if="errors.fat_g" class="text-danger small mt-1" role="alert">{{ errors.fat_g }}</div>
        </div>

        <div class="col-12 text-end">
          <button class="btn btn-primary px-4">Save Goal</button>
        </div>
      </form>
    </div>

    <!-- 2) Add Meal -->
    <div class="card p-4 mb-4 shadow-sm">
      <h5 class="mb-3">🥗 Add Meal</h5>
      <form class="row gy-3" @submit.prevent="addIntake" novalidate>
        <div class="col-12 col-md-3">
          <label for="mealName" class="form-label">Meal Name</label>
          <input id="mealName" ref="mealNameEl" class="form-control" v-model.trim="intakeForm.name" placeholder="e.g., Chicken salad"
                 :aria-invalid="!!intakeErrors.name" :aria-describedby="intakeErrors.name ? 'mealName-error' : null" />
          <div v-if="intakeErrors.name" id="mealName-error" class="text-danger small mt-1" role="alert">
            {{ intakeErrors.name }}
          </div>
        </div>
        <div class="col-12 col-md-3">
          <label class="form-label">Carbs (g)</label>
          <input class="form-control" v-model.trim="intakeForm.carbs_g" type="number" min="0" max="2000"
                 :aria-invalid="!!intakeErrors.carbs_g" />
        </div>
        <div class="col-12 col-md-3">
          <label class="form-label">Protein (g)</label>
          <input class="form-control" v-model.trim="intakeForm.protein_g" type="number" min="0" max="2000"
                 :aria-invalid="!!intakeErrors.protein_g" />
        </div>
        <div class="col-12 col-md-3">
          <label class="form-label">Fat (g)</label>
          <input class="form-control" v-model.trim="intakeForm.fat_g" type="number" min="0" max="2000"
                 :aria-invalid="!!intakeErrors.fat_g" />
        </div>

        <div class="col-12">
          <p class="mb-1">Auto Calories: <strong>{{ kcalLive }}</strong> kcal</p>
        </div>

        <div class="col-12 text-end">
          <button class="btn btn-success px-4">Add Meal</button>
        </div>
      </form>
    </div>

    <!-- 3) Today Totals + Pie -->
    <div class="row g-4">
      <div class="col-12 col-lg-6">
        <div class="card p-4 h-100 shadow-sm">
          <h5 class="mb-3">📊 Today Total</h5>
          <p class="mb-1 fs-5"><strong>{{ totals.kcal }}</strong> kcal</p>
          <ul class="mb-3 list-unstyled small">
            <li>Carbs: {{ totals.carbs_g }} g</li>
            <li>Protein: {{ totals.protein_g }} g</li>
            <li>Fat: {{ totals.fat_g }} g</li>
          </ul>
          <div style="height:260px">
            <Pie :data="pieData" :options="pieOptions" />
          </div>
        </div>
      </div>

      <!-- 4) Progress vs Goal（擴充：四條進度 + 提示） -->
      <div class="col-12 col-lg-6">
        <div class="card p-4 h-100 shadow-sm">
          <div class="d-flex align-items-center gap-2 mb-3">
            <h5 class="mb-0">🎯 Progress vs Goal</h5>
            <!-- 簡易徽章 -->
            <span v-if="goals && progress.kcal>110" class="badge text-bg-danger">Calories high</span>
            <span v-if="goals && goals.protein_g && progress.protein<60" class="badge text-bg-warning">Protein low</span>
          </div>

          <div v-if="goals">
            <!-- kcal -->
            <div class="mb-3">
              <label class="form-label d-block">
                kcal {{ totals.kcal }} / {{ goals.kcal }}
                <span class="ms-2 text-muted small">({{ progress.kcal }}%)</span>
              </label>
              <div class="progress" style="height: 20px;">
                <div class="progress-bar bg-success" :style="{ width: progress.kcal + '%' }"></div>
              </div>
            </div>

            <!-- Protein -->
            <div v-if="goals.protein_g != null" class="mb-3">
              <label class="form-label d-block">
                Protein {{ totals.protein_g }}g / {{ goals.protein_g }}g
                <span class="ms-2 text-muted small">({{ progress.protein }}%)</span>
              </label>
              <div class="progress" style="height: 14px;">
                <div class="progress-bar bg-info" :style="{ width: progress.protein + '%' }"></div>
              </div>
            </div>

            <!-- Carbs -->
            <div v-if="goals.carbs_g != null" class="mb-3">
              <label class="form-label d-block">
                Carbs {{ totals.carbs_g }}g / {{ goals.carbs_g }}g
                <span class="ms-2 text-muted small">({{ progress.carbs }}%)</span>
              </label>
              <div class="progress" style="height: 14px;">
                <div class="progress-bar bg-primary" :style="{ width: progress.carbs + '%' }"></div>
              </div>
            </div>

            <!-- Fat -->
            <div v-if="goals.fat_g != null" class="mb-3">
              <label class="form-label d-block">
                Fat {{ totals.fat_g }}g / {{ goals.fat_g }}g
                <span class="ms-2 text-muted small">({{ progress.fat }}%)</span>
              </label>
              <div class="progress" style="height: 14px;">
                <div class="progress-bar bg-warning" :style="{ width: progress.fat + '%' }"></div>
              </div>
            </div>

            <!-- Tips -->
            <div v-if="smartTips.length" class="alert alert-info mt-3 mb-0">
              <ul class="mb-0 ps-3">
                <li v-for="(t,i) in smartTips" :key="i">{{ t }}</li>
              </ul>
            </div>
            <p v-else class="text-muted small mb-0">Nice! You're on track today.</p>
          </div>

          <p v-else class="text-muted mb-0">Set your daily goal to view progress.</p>
        </div>
      </div>
    </div>

    <!-- 5) Today Meals (with Actions) -->
    <div class="card p-4 mt-4 shadow-sm">
      <h5 class="mb-3">🍴 Today Meals</h5>
      <div class="table-responsive">
        <table class="table table-striped align-middle">
          <thead class="table-light">
            <tr>
              <th>Name</th><th>Carbs(g)</th><th>Protein(g)</th><th>Fat(g)</th><th>kcal</th><th style="width:140px;">Actions</th>
            </tr>
          </thead>
          <tbody>
          <tr v-for="(x,i) in todayMeals" :key="x.id || i">
            <td>{{ x.name }}</td>
            <td>{{ x.carbs_g }}</td>
            <td>{{ x.protein_g }}</td>
            <td>{{ x.fat_g }}</td>
            <td>{{ x.kcal }}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary me-2" @click="openEdit(x)">Edit</button>
              <button class="btn btn-sm btn-outline-danger" @click="removeMeal(x.id)">Delete</button>
            </td>
          </tr>
          <tr v-if="!todayMeals.length">
            <td colspan="6" class="text-muted text-center">No meals yet. Add your first one above.</td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editingId" class="modal-backdrop" @click.self="closeEdit">
      <div class="modal-card">
        <h6 class="mb-3">Edit Meal</h6>
        <div class="row g-3">
          <div class="col-12">
            <label class="form-label">Name</label>
            <input class="form-control" v-model.trim="editForm.name" />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label">Carbs (g)</label>
            <input class="form-control" type="number" v-model.number="editForm.carbs_g" min="0" max="2000" />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label">Protein (g)</label>
            <input class="form-control" type="number" v-model.number="editForm.protein_g" min="0" max="2000" />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label">Fat (g)</label>
            <input class="form-control" type="number" v-model.number="editForm.fat_g" min="0" max="2000" />
          </div>
        </div>
        <div class="text-end mt-4">
          <button class="btn btn-outline-secondary me-2" @click="closeEdit">Cancel</button>
          <button class="btn btn-primary" @click="saveEdit">Save</button>
        </div>
      </div>
    </div>

    <!-- 6) History / Reports -->
    <div class="card p-4 mt-4 shadow-sm">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">📈 History</h5>
        <div class="btn-group">
          <button class="btn btn-sm" :class="historyDays===7?'btn-primary':'btn-outline-primary'"
                  @click="changeHistoryRange(7)">7d</button>
          <button class="btn btn-sm" :class="historyDays===30?'btn-primary':'btn-outline-primary'"
                  @click="changeHistoryRange(30)">30d</button>
        </div>
      </div>
      <div style="height:300px">
        <Line :data="historyData" :options="historyOptions" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(1px,1px,1px,1px);
  white-space: nowrap;
}
.toasty {
  position: fixed;
  right: 16px;
  bottom: 16px;
  max-width: 80vw;
  z-index: 2000;
  padding: 10px 14px;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,.15);
  color: #0f172a;
  background: #e2e8f0;
  transition: opacity .2s ease, transform .2s ease;
}
.toasty--success { background: #dcfce7; }
.toasty--error   { background: #fee2e2; }
.fade-enter-active, .fade-leave-active { transition: opacity .3s ease, transform .3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(10px); }

.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.35);
  display: flex; align-items: center; justify-content: center;
  z-index: 1050;
}
.modal-card {
  width: min(640px, 92vw);
  background: #fff; border-radius: 12px;
  padding: 20px; box-shadow: 0 20px 60px rgba(0,0,0,.2);
}
</style>