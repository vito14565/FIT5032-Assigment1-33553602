// src/composables/useGoals.js
import { ref, computed, onMounted } from 'vue'
import { auth, db } from '@/firebase'
import {
  doc, getDoc, setDoc, collection, query, where, orderBy, getDocs
} from 'firebase/firestore'

export default function useGoals () {
  const loading = ref(false)
  const goals = ref({ daily: { kcal: 0, protein: 0, carbs: 0, fat: 0 } })
  const todayTotal = ref({ kcal: 0, protein: 0, carbs: 0, fat: 0 })

  // 今日 00:00 ~ 明日 00:00
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(start); end.setDate(end.getDate() + 1)

  const progress = computed(() => {
    const g = goals.value.daily
    const t = todayTotal.value
    const pct = (v, target) => (!target ? 0 : Math.min(100, Math.round((v / target) * 100)))
    return {
      kcal: pct(t.kcal, g.kcal),
      protein: pct(t.protein, g.protein),
      carbs: pct(t.carbs, g.carbs),
      fat: pct(t.fat, g.fat)
    }
  })

  const tips = computed(() => {
    const g = goals.value.daily, t = todayTotal.value
    const msgs = []
    if (g.kcal) {
      if (t.kcal < g.kcal * 0.85) msgs.push('Calories below 85% — consider an extra snack.')
      if (t.kcal > g.kcal * 1.10) msgs.push('Calories exceed 110% — go lighter next meal.')
    }
    if (g.protein && t.protein < g.protein) msgs.push('Protein below target — add tofu/lean meat/yogurt.')
    if (g.carbs && t.carbs < g.carbs * 0.8) msgs.push('Carbs low — whole grains or fruit can help.')
    if (g.fat && t.fat > g.fat * 1.2) msgs.push('Fat >120% — reduce oils/high-fat toppings.')
    return msgs
  })

  async function loadGoals () {
    const uid = auth.currentUser?.uid
    if (!uid) return
    loading.value = true
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'settings', 'goals'))
      if (snap.exists()) goals.value = snap.data()
    } finally { loading.value = false }
  }

  async function saveGoals (payload) {
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error('Not signed in')
    const ref = doc(db, 'users', uid, 'settings', 'goals')
    const next = { ...goals.value, ...payload }
    await setDoc(ref, next, { merge: true })
    goals.value = next
  }

  async function loadTodayTotal () {
    const uid = auth.currentUser?.uid
    if (!uid) return
    const col = collection(db, 'users', uid, 'intake')
    const q = query(
      col,
      where('ts', '>=', start.getTime()),
      where('ts', '<', end.getTime()),
      orderBy('ts', 'asc')
    )
    const snap = await getDocs(q)
    const s = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    snap.forEach(d => {
      const x = d.data()
      s.kcal += Number(x.kcal || 0)
      s.protein += Number(x.protein || 0)
      s.carbs += Number(x.carbs || 0)
      s.fat += Number(x.fat || 0)
    })
    todayTotal.value = s
  }

  onMounted(async () => {
    await loadGoals()
    await loadTodayTotal()
  })

  return { loading, goals, todayTotal, progress, tips, saveGoals, loadGoals, loadTodayTotal }
}