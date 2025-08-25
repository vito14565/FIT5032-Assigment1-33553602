<script setup>
import { ref } from 'vue'

// Reactive form state
const form = ref({
  email: '',
  calories: ''
})

// Store validation errors
const errors = ref({})

// Validation function
function validate() {
  errors.value = {}

  // Email validation
  if (!form.value.email) {
    errors.value.email = 'Email is required'
  } else if (!/^\S+@\S+\.\S+$/.test(form.value.email)) {
    errors.value.email = 'Invalid email format'
  }

  // Calories validation
  const cal = Number(form.value.calories)
  if (!form.value.calories) {
    errors.value.calories = 'Calories is required'
  } else if (Number.isNaN(cal) || cal < 0 || cal > 5000) {
    errors.value.calories = 'Calories must be between 0 and 5000'
  }

  return Object.keys(errors.value).length === 0
}

// Handle submit
function submit() {
  if (validate()) {
    alert('Form submitted successfully!')
  }
}
</script>

<template>
  <div>
    <h2 class="h4 mb-3">Your Dashboard</h2>

    <!-- User input form -->
    <form class="row gy-3" @submit.prevent="submit">

      <!-- Email field -->
      <div class="col-12 col-md-6">
        <label class="form-label">Email</label>
        <input class="form-control" v-model.trim="form.email" type="email" placeholder="you@example.com">
        <div class="text-danger small" v-if="errors.email">{{ errors.email }}</div>
      </div>

      <!-- Calories field -->
      <div class="col-12 col-md-6">
        <label class="form-label">Daily Calories Target</label>
        <input class="form-control" v-model.trim="form.calories" type="number" min="0" max="5000">
        <div class="text-danger small" v-if="errors.calories">{{ errors.calories }}</div>
      </div>

      <!-- Submit button -->
      <div class="col-12">
        <button class="btn btn-primary">Save</button>
      </div>
    </form>
  </div>
</template>