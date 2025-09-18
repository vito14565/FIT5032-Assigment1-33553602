// functions/index.js
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

if (!admin.apps.length) admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

exports.sendEmail = onRequest({ invoker: "public" }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send();

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
    const FROM_EMAIL   = process.env.SENDGRID_FROM;
    if (!SENDGRID_KEY || !FROM_EMAIL) {
      console.error("❌ Missing env", { hasKey: !!SENDGRID_KEY, from: FROM_EMAIL });
      return res.status(500).json({ ok: false, error: "Missing SendGrid config" });
    }
    sgMail.setApiKey(SENDGRID_KEY);

    // ---- tolerant body parsing ----
    const ctype = req.headers["content-type"] || "";
    let body = req.body;

    // 如果 body 不是物件（可能是字串或 undefined），試著解析 rawBody
    if (!body || typeof body !== "object") {
      try {
        if (req.rawBody) {
          body = JSON.parse(Buffer.from(req.rawBody).toString("utf8"));
        }
      } catch (e) {
        console.warn("⚠️ Failed to parse rawBody as JSON");
      }
    }

    // 映射舊欄位名 -> 新欄位名
    const to        = body?.to        ?? body?.recipient ?? body?.email;
    const subject   = body?.subject;
    const text      = body?.text      ?? body?.message;
    const storagePath = body?.storagePath;

    if (!to || !subject) {
      console.error("❌ Missing fields after normalization", {
        contentType: ctype,
        bodyType: typeof body,
        bodyPreview: typeof body === "object" ? Object.keys(body) : String(body).slice(0, 200)
      });
      return res.status(400).json({ ok: false, error: "Missing to/subject" });
    }

    // 附件（可選）：從 Storage 讀檔
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

    console.log("📤 Sending", { from: FROM_EMAIL, to, subject, hasKey: !!SENDGRID_KEY });

    const [resp] = await sgMail.send({
      to,
      from: FROM_EMAIL,
      subject,
      text: text || "",
      attachments,
    });

    console.log("✅ SendGrid", { statusCode: resp?.statusCode, messageId: resp?.headers?.["x-message-id"] });
    return res.json({ ok: true });
  } catch (e) {
    const details = e?.response?.body || e?.message || e;
    console.error("❌ SendGrid error", details);
    return res.status(500).json({ ok: false, error: e?.message || "Send failed" });
  }
});