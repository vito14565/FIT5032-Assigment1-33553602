<script setup>
import { ref, nextTick } from 'vue'

// Reactive form state
const form = ref({ email: '', calories: '' })

// Store validation errors
const errors = ref({})

// Refs to inputs (to focus the first invalid field)
const emailEl = ref(null)
const caloriesEl = ref(null)

// Live region messages (status and alerts)
const statusMsg = ref('') // polite
const alertMsg = ref('')  // assertive

// Validation function
function validate() {
  errors.value = {}
  statusMsg.value = ''
  alertMsg.value = ''

  // Email validation
  if (!form.value.email) {
    errors.value.email = 'Email is required'
  } else if (!/^\S+@\S+\.\S+$/.test(form.value.email)) {
    errors.value.email = 'Invalid email format'
  }

  // Calories validation
  const cal = Number(form.value.calories)
  if (form.value.calories === '' || form.value.calories === null) {
    errors.value.calories = 'Calories is required'
  } else if (Number.isNaN(cal) || cal < 0 || cal > 5000) {
    errors.value.calories = 'Calories must be between 0 and 5000'
  }

  // Focus the first invalid field (accessibility & UX)
  const firstKey = Object.keys(errors.value)[0]
  if (firstKey) {
    nextTick(() => {
      const el = firstKey === 'email' ? emailEl.value : caloriesEl.value
      el?.focus?.()
      el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      alertMsg.value = 'Please fix the errors in the form.'
    })
    return false
  }

  return true
}

// Handle submit
function submit() {
  if (validate()) {
    statusMsg.value = 'Form submitted successfully!'
    alert('Form submitted successfully!')
  }
}
</script>

<template>
  <div>
    <h2 class="h4 mb-3">Your Dashboard</h2>

    <!-- Polite live region for non-critical status updates -->
    <p class="sr-only" aria-live="polite">{{ statusMsg }}</p>
    <!-- Assertive live region for errors -->
    <p class="sr-only" role="alert" aria-live="assertive">{{ alertMsg }}</p>

    <!-- User input form -->
    <form class="row gy-3" @submit.prevent="submit" novalidate>
      <!-- Email field -->
      <div class="col-12 col-md-6">
        <label for="email" class="form-label">Email</label>
        <input
          id="email"
          ref="emailEl"
          class="form-control"
          v-model.trim="form.email"
          type="email"
          placeholder="you@example.com"
          required
          :aria-invalid="!!errors.email"
          :aria-describedby="errors.email ? 'email-error' : null"
        />
        <div
          v-if="errors.email"
          id="email-error"
          class="text-danger small"
          role="alert"
        >
          {{ errors.email }}
        </div>
      </div>

      <!-- Calories field -->
      <div class="col-12 col-md-6">
        <label for="calories" class="form-label">Daily Calories Target</label>
        <input
          id="calories"
          ref="caloriesEl"
          class="form-control"
          v-model.trim="form.calories"
          type="number"
          min="0"
          max="5000"
          required
          :aria-invalid="!!errors.calories"
          :aria-describedby="errors.calories ? 'calories-error' : null"
        />
        <div
          v-if="errors.calories"
          id="calories-error"
          class="text-danger small"
          role="alert"
        >
          {{ errors.calories }}
        </div>
      </div>

      <!-- Submit button -->
      <div class="col-12">
        <button class="btn btn-primary">Save</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
/* Screen-reader-only utility (in case global .sr-only isn't available here) */
.sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(1px,1px,1px,1px);
  white-space: nowrap;
}
</style>