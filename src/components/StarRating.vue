<template>
  <div class="d-inline-flex align-items-center gap-1">
    <button
      v-for="n in 5"
      :key="n"
      type="button"
      class="btn btn-sm"
      :class="n <= current ? 'text-warning' : 'text-secondary'"
      @click="$emit('update:modelValue', n)"
      :aria-label="`Rate ${n} star${n>1?'s':''}`"
    >
      ★
    </button>
    <span v-if="showValue" class="small ms-1">{{ current }}/5</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  showValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
const current = computed(() => Math.round(props.modelValue ?? 0))
</script>

<style scoped>
button.btn { line-height: 1; padding: 0 .25rem; }
</style>