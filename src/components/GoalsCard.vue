<!-- src/components/GoalsCard.vue -->
<script setup>
import { reactive, watchEffect } from 'vue'
import useGoals from '@/composables/useGoals'

const { loading, goals, todayTotal, progress, tips, saveGoals } = useGoals()

const local = reactive({ daily: { kcal: 0, protein: 0, carbs: 0, fat: 0 } })
watchEffect(() => {
  if (goals.value?.daily) {
    // 深拷貝避免直接改到 goals
    local.daily = JSON.parse(JSON.stringify(goals.value.daily))
  }
})

async function onSave () {
  await saveGoals({ daily: {
    kcal: Number(local.daily.kcal || 0),
    protein: Number(local.daily.protein || 0),
    carbs: Number(local.daily.carbs || 0),
    fat: Number(local.daily.fat || 0),
  }})
  // 這裡可加你的 toast/snackbar：Saved successfully
}
</script>

<template>
  <section class="hm-card" aria-label="Goals & Progress">
    <div class="flex items-center gap-2">
      <h3 class="hm-title">🎯 Goals & Progress</h3>
      <span v-if="progress.kcal>110" class="hm-badge-danger">Calories high</span>
      <span v-if="progress.protein<60 && goals.daily?.protein" class="hm-badge-warn">Protein low</span>
    </div>

    <!-- Goals form -->
    <form @submit.prevent="onSave" class="grid md:grid-cols-4 gap-3 mt-3">
      <input v-model.number="local.daily.kcal" class="hm-input" type="number" min="0" placeholder="Daily kcal target" />
      <input v-model.number="local.daily.protein" class="hm-input" type="number" min="0" placeholder="Protein (g)" />
      <input v-model.number="local.daily.carbs" class="hm-input" type="number" min="0" placeholder="Carbs (g)" />
      <input v-model.number="local.daily.fat" class="hm-input" type="number" min="0" placeholder="Fat (g)" />
      <div class="md:col-span-4">
        <button class="hm-btn-primary" type="submit" :disabled="loading">Save Goal</button>
      </div>
    </form>

    <!-- Progress bars -->
    <div class="mt-4 space-y-3">
      <ProgressRow label="Calories" :val="progress.kcal" :suffix="`${todayTotal.kcal} / ${goals.daily?.kcal||0} kcal`" />
      <ProgressRow label="Protein"  :val="progress.protein" :suffix="`${todayTotal.protein} / ${goals.daily?.protein||0} g`" />
      <ProgressRow label="Carbs"    :val="progress.carbs" :suffix="`${todayTotal.carbs} / ${goals.daily?.carbs||0} g`" />
      <ProgressRow label="Fat"      :val="progress.fat" :suffix="`${todayTotal.fat} / ${goals.daily?.fat||0} g`" />
    </div>

    <!-- Tips -->
    <div v-if="tips.length" class="mt-4 hm-alert-info">
      <ul class="list-disc ml-5">
        <li v-for="(t,i) in tips" :key="i">{{ t }}</li>
      </ul>
    </div>
  </section>
</template>

<script>
export default {
  components: {
    ProgressRow: {
      props: { label: String, val: Number, suffix: String },
      template: `
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span>{{ label }}</span>
            <span>{{ Math.min(100, val||0) }}% • {{ suffix }}</span>
          </div>
          <div class="w-full h-2 bg-gray-200 rounded">
            <div class="h-2 bg-green-500 rounded" :style="{ width: Math.min(100, val||0) + '%' }"></div>
          </div>
        </div>`
    }
  }
}
</script>