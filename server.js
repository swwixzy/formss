require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
app.use(express.json({ limit: "100kb" }));

// -----------------------------------------------------------------
// CONFIG (all from environment variables — set these on Railway)
// -----------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const GMAIL_USER = process.env.GMAIL_USER;       // ваш Gmail, с которого шлём письма
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD; // App Password, НЕ обычный пароль
const TO_EMAIL = process.env.TO_EMAIL || GMAIL_USER; // куда присылать заявки
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://swwixzy.github.io")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error(
    "[FATAL] Missing GMAIL_USER or GMAIL_APP_PASSWORD environment variables."
  );
}

// -----------------------------------------------------------------
// CORS — only your GitHub Pages site (and anything else you list
// in ALLOWED_ORIGINS) is allowed to call this API from a browser.
// -----------------------------------------------------------------
app.use(
  cors({
    origin(origin, callback) {
      // allow server-to-server / curl / health checks (no Origin header)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["POST", "GET", "OPTIONS"],
  })
);

// -----------------------------------------------------------------
// Mail transport
// -----------------------------------------------------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

// -----------------------------------------------------------------
// Form definitions — mirrors the fields in index.html.
// Each key = formId sent by script.js. `fields` lists which keys
// we expect and in what human-readable label + order they appear
// in the email. Anything not listed here is ignored (defense
// against unexpected/garbage fields).
// -----------------------------------------------------------------
const FORM_DEFINITIONS = {
  "submit-form": {
    subject: "KINDORF — новая заявка: Submit a Project",
    fields: [
      ["name", "Имя"],
      ["project", "Название проекта"],
      ["description", "Описание"],
      ["goal", "Цель"],
      ["geography", "География"],
      ["direction", "Направление"],
      ["done", "Что уже сделано"],
      ["help", "Какая помощь нужна"],
      ["email", "Email"],
    ],
    requiredFields: [
      "name",
      "project",
      "description",
      "goal",
      "geography",
      "direction",
      "help",
      "email",
    ],
  },
  "join-form": {
    subject: "KINDORF — новая заявка: Join Kindorf",
    fields: [
      ["name", "Имя"],
      ["email", "Email"],
      ["department", "Подразделение"],
      ["note", "Почему хочет присоединиться"],
    ],
    requiredFields: ["name", "email", "department", "note"],
  },
  "partner-form": {
    subject: "KINDORF — новое предложение: Partnerships",
    fields: [
      ["organization", "Организация"],
      ["email", "Email"],
      ["note", "Предлагаемое сотрудничество"],
    ],
    requiredFields: ["organization", "email", "note"],
  },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// escape user text before it goes into the HTML email body
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// -----------------------------------------------------------------
// Routes
// -----------------------------------------------------------------
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "kindorf-forms-backend" });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/submit-form", async (req, res) => {
  try {
    const { formId, data } = req.body || {};

    const definition = FORM_DEFINITIONS[formId];
    if (!definition) {
      return res.status(400).json({ ok: false, error: "Unknown formId" });
    }
    if (!data || typeof data !== "object") {
      return res.status(400).json({ ok: false, error: "Missing form data" });
    }

    // required-field validation
    for (const key of definition.requiredFields) {
      const value = data[key];
      if (!value || !String(value).trim()) {
        return res
          .status(400)
          .json({ ok: false, error: `Missing required field: ${key}` });
      }
    }

    // basic email sanity check, if the form has an email field
    if (data.email && !EMAIL_REGEX.test(String(data.email).trim())) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }

    // build the email body from the whitelisted fields only
    const rowsHtml = definition.fields
      .map(([key, label]) => {
        const raw = data[key];
        if (raw === undefined || raw === null || raw === "") return "";
        const value = escapeHtml(raw).replace(/\n/g, "<br>");
        return `<tr><td style="padding:6px 10px;font-weight:600;vertical-align:top;white-space:nowrap;">${escapeHtml(
          label
        )}</td><td style="padding:6px 10px;">${value}</td></tr>`;
      })
      .join("");

    const rowsText = definition.fields
      .map(([key, label]) => {
        const raw = data[key];
        if (raw === undefined || raw === null || raw === "") return "";
        return `${label}: ${raw}`;
      })
      .filter(Boolean)
      .join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;">
        <h2 style="margin-bottom:12px;">${escapeHtml(definition.subject)}</h2>
        <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          ${rowsHtml}
        </table>
      </div>
    `;

    const replyTo =
      data.email && EMAIL_REGEX.test(String(data.email).trim())
        ? String(data.email).trim()
        : undefined;

    await transporter.sendMail({
      from: `"KINDORF site" <${GMAIL_USER}>`,
      to: TO_EMAIL,
      replyTo,
      subject: definition.subject,
      text: rowsText,
      html,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error sending mail:", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

app.listen(PORT, () => {
  console.log(`KINDORF forms backend running on port ${PORT}`);
});
