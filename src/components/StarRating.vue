<template>
  <div
    class="d-inline-flex align-items-center gap-1"
    role="slider"
    tabindex="0"
    :aria-valuemin="1"
    :aria-valuemax="5"
    :aria-valuenow="current"
    aria-label="Star rating"
    @keydown="onKeydown"
  >
    <button
      v-for="n in 5"
      :key="n"
      type="button"
      class="btn btn-sm"
      :class="n <= current ? 'text-warning' : 'text-secondary'"
      @click="$emit('update:modelValue', n)"
      :aria-label="`Rate ${n} star${n>1?'s':''}`"
      :aria-pressed="n === current"
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
const current = computed(() => Math.min(5, Math.max(1, Math.round(props.modelValue || 0))))

function onKeydown(e) {
  if (['ArrowRight', 'ArrowUp'].includes(e.key)) {
    e.preventDefault()
    emit('update:modelValue', Math.min(5, current.value + 1))
  } else if (['ArrowLeft', 'ArrowDown'].includes(e.key)) {
    e.preventDefault()
    emit('update:modelValue', Math.max(1, current.value - 1))
  } else if (['Home'].includes(e.key)) {
    e.preventDefault()
    emit('update:modelValue', 1)
  } else if (['End'].includes(e.key)) {
    e.preventDefault()
    emit('update:modelValue', 5)
  }
}
</script>

<style scoped>
button.btn { line-height: 1; padding: 0 .25rem; }
</style>