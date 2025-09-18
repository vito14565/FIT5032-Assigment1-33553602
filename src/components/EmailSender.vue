<!-- src/components/EmailSender.vue -->
<template>
  <div class="card shadow-sm mt-4">
    <div class="card-body">
      <h5 class="card-title text-center mb-4">📧 Send Email (with attachment)</h5>

      <form @submit.prevent="sendEmail">
        <!-- Recipient -->
        <div class="mb-3">
          <label for="recipient" class="form-label">Recipient Email</label>
          <input
            type="email"
            v-model.trim="recipient"
            id="recipient"
            class="form-control"
            placeholder="Enter recipient email"
            required
          />
        </div>

        <!-- Subject -->
        <div class="mb-3">
          <label for="subject" class="form-label">Subject</label>
          <input
            type="text"
            v-model.trim="subject"
            id="subject"
            class="form-control"
            placeholder="Enter subject"
            required
          />
        </div>

        <!-- Message -->
        <div class="mb-3">
          <label for="message" class="form-label">Message</label>
          <textarea
            v-model.trim="message"
            id="message"
            class="form-control"
            rows="4"
            placeholder="Write your message"
            required
          ></textarea>
        </div>

        <!-- File Upload -->
        <div class="mb-3">
          <label for="file" class="form-label">Attachment (optional)</label>
          <input
            ref="fileInput"
            type="file"
            @change="handleFileUpload"
            id="file"
            class="form-control"
          />
          <small v-if="file" class="text-muted d-block mt-1">
            Selected: {{ file?.name }} ({{ prettySize(file?.size) }})
          </small>
        </div>

        <!-- Submit -->
        <div class="d-grid">
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? "Sending..." : "Send" }}
          </button>
        </div>
      </form>

      <!-- Feedback -->
      <div v-if="statusMessage" class="alert mt-3" :class="statusClass">
        {{ statusMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { storage, auth } from "../firebase"; // 要帶 auth 才能知道 uid
import { ref as sRef, uploadBytes } from "firebase/storage";

/** --------- API Config ---------- */
const RUN_URL = "https://sendemail-sbwcik6mcq-uc.a.run.app";
const isHosted =
  /\.web\.app$/.test(location.host) || /\.firebaseapp\.com$/.test(location.host);
const API_PRIMARY = isHosted ? "/api/send-email" : RUN_URL;
const API_FALLBACK = RUN_URL;

/** --------- State ---------- */
const recipient = ref("");
const subject = ref("");
const message = ref("");
const file = ref(null);
const fileInput = ref(null);

const loading = ref(false);
const statusMessage = ref("");
const statusClass = ref("alert-info");

/** --------- Helpers ---------- */
function prettySize(n = 0) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function handleFileUpload(e) {
  file.value = e.target.files?.[0] ?? null;
}

/** --------- Main ---------- */
async function sendEmail() {
  loading.value = true;
  statusMessage.value = "";
  statusClass.value = "alert-info";

  try {
    if (!recipient.value || !subject.value) {
      throw new Error("Recipient & subject are required.");
    }

    // 必須登入才能上傳（符合 rules）
    const u = auth.currentUser;
    if (!u) throw new Error("Please log in before uploading attachments.");

    // (可選) 檔案基本檢查：10MB 以內
    if (file.value && file.value.size > 10 * 1024 * 1024) {
      throw new Error("Attachment too large (max 10 MB).");
    }

    // 1) 有附件就上傳到 Storage（uploads/{uid}/...）
    let storagePath = "";
    if (file.value) {
      const cleanName = file.value.name.replace(/[^\w.\-]+/g, "_");
      storagePath = `uploads/${u.uid}/emails/${Date.now()}_${cleanName}`;
      await uploadBytes(
        sRef(storage, storagePath),
        file.value,
        { contentType: file.value.type || "application/octet-stream" }
      );
    }

    // 2) 發送 JSON
    const payload = {
      to: recipient.value,
      subject: subject.value,
      text: message.value,
      storagePath,
    };

    const json = await callJson(API_PRIMARY, payload).catch(() =>
      callJson(API_FALLBACK, payload)
    );

    if (!json?.ok) throw new Error(json?.error || "Send failed");

    statusMessage.value = "✅ Email sent successfully!";
    statusClass.value = "alert-success";

    // reset
    recipient.value = "";
    subject.value = "";
    message.value = "";
    file.value = null;
    if (fileInput.value) fileInput.value.value = "";
  } catch (err) {
    statusMessage.value =
      "❌ Error: " + (err?.message || "Failed to send email");
    statusClass.value = "alert-danger";
  } finally {
    loading.value = false;
  }
}

/** JSON fetch helper */
async function callJson(url, body) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.error || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}
</script>

<style scoped>
.card { max-width: 640px; margin: 0 auto; }
</style>