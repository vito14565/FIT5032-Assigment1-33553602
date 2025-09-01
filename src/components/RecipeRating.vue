<template>
  <div>
    <div class="d-flex align-items-center gap-2">
      <StarRating
        :model-value="myRating"
        @update:modelValue="onRate"
        :showValue="false"
      />
      <span class="small text-muted">
        Avg: <strong>{{ avg.toFixed(1) }}</strong> ({{ count }})
      </span>
    </div>

    <div v-if="notice" class="text-danger small mt-1">{{ notice }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { auth, db } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  doc, setDoc, onSnapshot, collection, query
} from 'firebase/firestore'
import StarRating from './StarRating.vue'

const props = defineProps({
  recipeId: { type: String, required: true },
})

const myRating = ref(0)
const avg = ref(0)
const count = ref(0)
const user = ref(null)
const notice = ref('')

let stopAuth = null
let stopRatings = null

onMounted(() => {
  stopAuth = onAuthStateChanged(auth, (u) => {
    user.value = u || null
    // 當登入者改變，重新抓自己的評分（在同一個 ratings 流內會同步）
  })

  // 監聽此食譜的所有評分以計算平均
  const q = query(collection(db, 'recipes', props.recipeId, 'ratings'))
  stopRatings = onSnapshot(q, (snap) => {
    let sum = 0; let c = 0; let mine = 0
    snap.forEach(d => {
      const v = Number(d.data().value || 0)
      if (v) { sum += v; c += 1 }
      if (user.value && d.id === user.value.uid) mine = v
    })
    avg.value = c ? sum / c : 0
    count.value = c
    myRating.value = mine
  })
})

onUnmounted(() => {
  stopAuth && stopAuth()
  stopRatings && stopRatings()
})

async function onRate(value) {
  if (!user.value) {
    notice.value = 'Please log in to rate.'
    setTimeout(() => (notice.value = ''), 2500)
    return
  }
  try {
    await setDoc(
      doc(db, 'recipes', props.recipeId, 'ratings', user.value.uid),
      { value, updatedAt: new Date() },
      { merge: true }
    )
    notice.value = ''
  } catch (e) {
    notice.value = 'Failed to submit rating. Try again.'
  }
}
</script>