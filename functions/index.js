// functions/index.js
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const functions = require("firebase-functions"); // 只為了讀 config()
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

exports.sendEmail = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send();

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    // 1) 在 handler 內讀取金鑰（v2 仍支援 functions.config()；未來可改 .env/secrets）
    const keyFromConfig = functions.config()?.sendgrid?.key;
    const fromFromConfig = functions.config()?.sendgrid?.from;
    const SENDGRID_KEY = process.env.SENDGRID_API_KEY || keyFromConfig;
    const FROM_EMAIL  = process.env.SENDGRID_FROM || fromFromConfig;

    if (!SENDGRID_KEY || !FROM_EMAIL) {
      return res.status(500).json({
        ok: false,
        error: "Missing SendGrid config: SENDGRID_API_KEY or SENDGRID_FROM",
      });
    }

    // 2) 只在需要時設定 API key
    sgMail.setApiKey(SENDGRID_KEY);

    const { to, subject, text, storagePath } = req.body || {};
    if (!to || !subject) {
      return res.status(400).json({ ok: false, error: "Missing to/subject" });
    }

    // 3) 處理附件（可選）
    const attachments = [];
    if (storagePath) {
      const bucket = admin.storage().bucket();
      const file = bucket.file(storagePath);
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(400).json({ ok: false, error: "Attachment not found" });
      }
      const [buf] = await file.download();
      const [meta] = await file.getMetadata();
      attachments.push({
        content: buf.toString("base64"),
        filename: (meta.name || storagePath).split("/").pop(),
        type: meta.contentType || "application/octet-stream",
        disposition: "attachment",
      });
    }

    await sgMail.send({
      to,
      from: FROM_EMAIL,
      subject,
      text: text || "",
      attachments,
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});