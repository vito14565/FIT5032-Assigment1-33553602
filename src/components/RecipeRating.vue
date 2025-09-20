<template>
  <!-- Group the rating UI for SR users; describe with avg/count -->
  <div
    class="d-flex align-items-start flex-column gap-1"
    role="group"
    aria-label="Rate this recipe"
    :aria-describedby="descId"
    :aria-busy="ratingSaving ? 'true' : 'false'"
  >
    <div class="d-flex align-items-center gap-2">
      <!-- Pass accessible name/description down to the custom control -->
      <StarRating
        :model-value="myRating"
        @update:modelValue="onRate"
        :showValue="false"
        aria-label="Star rating"
        :aria-describedby="descId"
      />
      <span class="small text-muted" :id="descId">
        Avg: <strong>{{ avg.toFixed(1) }}</strong> ({{ count }})
      </span>
    </div>

    <!-- Live region for success/info updates (polite so it won't interrupt) -->
    <span class="sr-only" aria-live="polite">{{ liveMsg }}</span>

    <!-- Immediate alerts (errors / not logged in) -->
    <div
      v-if="notice"
      class="text-danger small mt-1"
      role="alert"
      aria-live="assertive"
    >
      {{ notice }}
    </div>
  </div>
</template>

<script setup>
/**
 * Accessible rating summary:
 * - Wrap in role="group" with a clear label
 * - Describe control with avg/count via aria-describedby
 * - Announce success via a polite live region
 * - Announce errors via role="alert" (assertive)
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { auth, db } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, onSnapshot, collection, query } from 'firebase/firestore'
import StarRating from './StarRating.vue'

const props = defineProps({
  recipeId: { type: String, required: true },
})

const myRating = ref(0)
const avg = ref(0)
const count = ref(0)
const user = ref(null)

const notice = ref('')         // assertive errors
const liveMsg = ref('')        // polite success/info
const ratingSaving = ref(false)

// unique id for aria-describedby
const descId = `rating-desc-${Math.random().toString(36).slice(2, 9)}`

let stopAuth = null
let stopRatings = null

onMounted(() => {
  stopAuth = onAuthStateChanged(auth, (u) => {
    user.value = u || null
    // If user changes, their own rating will be reflected from the snapshot below
  })

  // Listen to all ratings for this recipe to calculate average and my rating
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
  // Clear prior messages
  notice.value = ''
  liveMsg.value = ''

  if (!user.value) {
    notice.value = 'Please log in to rate.'
    return
  }
  try {
    ratingSaving.value = true
    await setDoc(
      doc(db, 'recipes', props.recipeId, 'ratings', user.value.uid),
      { value, updatedAt: new Date() },
      { merge: true }
    )
    // Announce the new personal rating (do not spam avg which may fluctuate)
    liveMsg.value = `Your rating is set to ${value} out of 5.`
  } catch (e) {
    notice.value = 'Failed to submit rating. Try again.'
  } finally {
    ratingSaving.value = false
  }
}
</script>

<style scoped>
/* Screen-reader-only helper (in case global stylesheet isn't loaded here) */
.sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(1px,1px,1px,1px);
  white-space: nowrap;
}
</style>