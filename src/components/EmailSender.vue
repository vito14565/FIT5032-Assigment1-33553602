<!-- src/components/EmailSender.vue -->
<template>
  <div class="card shadow-sm mt-4">
    <div class="card-body">
      <!-- Use a readable heading; hide the emoji from AT -->
      <h3 id="send-email-title" class="card-title text-center mb-4 h5">
        <span aria-hidden="true">📧</span>
        <span class="visually-hidden-focusable sr-only">Send Email (with attachment)</span>
        Send Email (with attachment)
      </h3>

      <!-- Associate the form with the heading for SR users -->
      <form @submit.prevent="sendEmail" aria-labelledby="send-email-title" novalidate>
        <!-- Recipient -->
        <div class="mb-3">
          <label for="recipient" class="form-label">Recipient Email</label>
          <input
            id="recipient"
            name="recipient"
            type="email"
            v-model.trim="recipient"
            class="form-control"
            placeholder="Enter recipient email"
            autocomplete="email"
            required
            :aria-invalid="recipientTouched && !emailOk"
            :aria-describedby="`recipient-help${recipientTouched && !emailOk ? ' recipient-err' : ''}`"
            @blur="recipientTouched = true"
          />
          <p id="recipient-help" class="sr-only">Enter a valid email address.</p>
          <div
            v-if="recipientTouched && !emailOk"
            id="recipient-err"
            class="invalid-feedback d-block"
            role="alert"
          >
            Please enter a valid email address.
          </div>
        </div>

        <!-- Subject -->
        <div class="mb-3">
          <label for="subject" class="form-label">Subject</label>
          <input
            id="subject"
            name="subject"
            type="text"
            v-model.trim="subject"
            class="form-control"
            placeholder="Enter subject"
            required
            :aria-invalid="subjectTouched && !subject"
            :aria-describedby="subjectTouched && !subject ? 'subject-err' : null"
            @blur="subjectTouched = true"
          />
          <div
            v-if="subjectTouched && !subject"
            id="subject-err"
            class="invalid-feedback d-block"
            role="alert"
          >
            Subject is required.
          </div>
        </div>

        <!-- Message -->
        <div class="mb-3">
          <label for="message" class="form-label">Message</label>
          <textarea
            id="message"
            name="message"
            v-model.trim="message"
            class="form-control"
            rows="4"
            placeholder="Write your message"
            required
            :aria-invalid="messageTouched && !message"
            :aria-describedby="messageTouched && !message ? 'message-err' : null"
            @blur="messageTouched = true"
          ></textarea>
          <div
            v-if="messageTouched && !message"
            id="message-err"
            class="invalid-feedback d-block"
            role="alert"
          >
            Message is required.
          </div>
        </div>

        <!-- File Upload -->
        <div class="mb-3">
          <label for="file" class="form-label">Attachment (optional)</label>
          <input
            id="file"
            ref="fileInput"
            name="file"
            type="file"
            class="form-control"
            @change="handleFileUpload"
          />
          <small v-if="file" class="text-muted d-block mt-1">
            Selected: {{ file?.name }} ({{ prettySize(file?.size) }})
          </small>
        </div>

        <!-- Submit -->
        <div class="d-grid">
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="loading"
            :aria-busy="loading ? 'true' : 'false'"
          >
            {{ loading ? "Sending..." : "Send" }}
          </button>
        </div>
      </form>

      <!-- Feedback: role & aria-live switch based on status type -->
      <div
        v-if="statusMessage"
        class="alert mt-3"
        :class="statusClass"
        :role="isError ? 'alert' : 'status'"
        :aria-live="isError ? 'assertive' : 'polite'"
      >
        {{ statusMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
// Email sender with accessible form semantics and live status messages
import { ref, computed } from "vue"
import { storage, auth } from "../firebase" // auth is used to read uid
import { ref as sRef, uploadBytes } from "firebase/storage"

/** --------- API Config ---------- */
const RUN_URL = "https://sendemail-sbwcik6mcq-uc.a.run.app"
const isHosted =
  /\.web\.app$/.test(location.host) || /\.firebaseapp\.com$/.test(location.host)
const API_PRIMARY = isHosted ? "/api/send-email" : RUN_URL
const API_FALLBACK = RUN_URL

/** --------- State ---------- */
const recipient = ref("")
const subject = ref("")
const message = ref("")
const file = ref(null)
const fileInput = ref(null)

const loading = ref(false)
const statusMessage = ref("")
const statusClass = ref("alert-info") // 'alert-success' | 'alert-danger' | 'alert-info'

/** Touched flags for minimal client-side validation */
const recipientTouched = ref(false)
const subjectTouched = ref(false)
const messageTouched = ref(false)

/** --------- Validators ---------- */
const emailOk = computed(() => /^\S+@\S+\.\S+$/.test(recipient.value.trim()))
const isError = computed(() => statusClass.value.includes("danger"))

/** --------- Helpers ---------- */
function prettySize(n = 0) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
function handleFileUpload(e) {
  file.value = e.target.files?.[0] ?? null
}

/** --------- Main ---------- */
async function sendEmail() {
  recipientTouched.value = true
  subjectTouched.value = true
  messageTouched.value = true

  // client-side checks for better UX
  if (!emailOk.value || !subject.value || !message.value) {
    statusMessage.value = "Please correct the highlighted fields."
    statusClass.value = "alert-danger"
    return
  }

  loading.value = true
  statusMessage.value = ""
  statusClass.value = "alert-info"

  try {
    // Must be logged in to upload (to comply with rules)
    const u = auth.currentUser
    if (!u) throw new Error("Please log in before uploading attachments.")

    // (Optional) Basic file check: within 10MB
    if (file.value && file.value.size > 10 * 1024 * 1024) {
      throw new Error("Attachment too large (max 10 MB).")
    }

    // 1) If there is an attachment, upload it to Storage (uploads/{uid}/...)
    let storagePath = ""
    if (file.value) {
      const cleanName = file.value.name.replace(/[^\w.\-]+/g, "_")
      storagePath = `uploads/${u.uid}/emails/${Date.now()}_${cleanName}`
      await uploadBytes(
        sRef(storage, storagePath),
        file.value,
        { contentType: file.value.type || "application/octet-stream" }
      )
    }

    // 2) Send JSON
    const payload = {
      to: recipient.value.trim().toLowerCase(),
      subject: subject.value.trim(),
      text: message.value.trim(),
      storagePath,
    }

    const json = await callJson(API_PRIMARY, payload).catch(() =>
      callJson(API_FALLBACK, payload)
    )

    if (!json?.ok) throw new Error(json?.error || "Send failed")

    statusMessage.value = "Email sent successfully."
    statusClass.value = "alert-success"

    // reset
    recipient.value = ""
    subject.value = ""
    message.value = ""
    file.value = null
    if (fileInput.value) fileInput.value.value = ""
    recipientTouched.value = subjectTouched.value = messageTouched.value = false
  } catch (err) {
    statusMessage.value = "Error: " + (err?.message || "Failed to send email.")
    statusClass.value = "alert-danger"
  } finally {
    loading.value = false
  }
}

/** JSON fetch helper */
async function callJson(url, body) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const msg = data?.error || `HTTP ${resp.status}`
    throw new Error(msg)
  }
  return data
}
</script>

<style scoped>
.card { max-width: 640px; margin: 0 auto; }
/* Utility for screen-reader-only text (kept here in case global isn't loaded in tests) */
.sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(1px,1px,1px,1px);
  white-space: nowrap;
}
</style>