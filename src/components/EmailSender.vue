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
            v-model="recipient"
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
            v-model="subject"
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
            v-model="message"
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
          <input type="file" @change="handleFileUpload" id="file" class="form-control" />
        </div>

        <!-- Submit -->
        <div class="d-grid">
          <button type="submit" class="btn btn-primary">Send</button>
        </div>
      </form>

      <!-- Feedback message -->
      <div v-if="statusMessage" class="alert mt-3" :class="statusClass">
        {{ statusMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const recipient = ref("");
const subject = ref("");
const message = ref("");
const file = ref(null);

const statusMessage = ref("");
const statusClass = ref("alert-info");

function handleFileUpload(event) {
  file.value = event.target.files[0];
}

async function sendEmail() {
  try {
    statusMessage.value = "Sending...";
    statusClass.value = "alert-info";

    const formData = new FormData();
    formData.append("recipient", recipient.value);
    formData.append("subject", subject.value);
    formData.append("message", message.value);
    if (file.value) {
      formData.append("file", file.value);
    }

    const response = await fetch("/api/send-email", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      statusMessage.value = "✅ Email sent successfully!";
      statusClass.value = "alert-success";
      recipient.value = "";
      subject.value = "";
      message.value = "";
      file.value = null;
    } else {
      throw new Error("Failed to send email");
    }
  } catch (err) {
    statusMessage.value = "❌ Error: " + err.message;
    statusClass.value = "alert-danger";
  }
}
</script>