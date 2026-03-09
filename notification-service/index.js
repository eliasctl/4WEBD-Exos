const express = require("express");
const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ─── SQLite ───────────────────────────────────────────────────────────────────

const dbPath = process.env.DB_PATH || path.join(__dirname, "notifications.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id              TEXT PRIMARY KEY,
    type            TEXT NOT NULL,
    recipient       TEXT NOT NULL,
    message         TEXT NOT NULL,
    metadata        TEXT,
    status          TEXT NOT NULL DEFAULT 'SENT',
    createdAt       TEXT NOT NULL
  )
`);

console.log("[DB] ✅ Base SQLite connectée — notifications.db");

// ─── Swagger ──────────────────────────────────────────────────────────────────

const swaggerPath = path.join(__dirname, "swagger-output.json");
if (fs.existsSync(swaggerPath)) {
  const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// ─── Logique ──────────────────────────────────────────────────────────────────

const NOTIFICATION_TYPES = ["EMAIL", "SMS", "PUSH"];

const insertNotif = db.prepare(`
  INSERT INTO notifications (id, type, recipient, message, metadata, status, createdAt)
  VALUES (@id, @type, @recipient, @message, @metadata, @status, @createdAt)
`);

function sendNotification(type, recipient, message, metadata = {}) {
  const createdAt = new Date().toISOString();
  const id = `NOTIF-${Date.now()}`;

  insertNotif.run({
    id,
    type,
    recipient,
    message,
    metadata: JSON.stringify(metadata),
    status: "SENT",
    createdAt,
  });

  console.log("─────────────────────────────────────────");
  console.log(`[${createdAt}] 📬 Nouvelle notification`);
  console.log(`  ID           : ${id}`);
  console.log(`  Type         : ${type}`);
  console.log(`  Destinataire : ${recipient}`);
  console.log(`  Message      : ${message}`);
  if (Object.keys(metadata).length > 0) {
    console.log(`  Metadata     : ${JSON.stringify(metadata)}`);
  }
  console.log("─────────────────────────────────────────");

  return { notificationId: id, timestamp: createdAt, status: "SENT" };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/notifications", (req, res) => {
  // #swagger.tags = ['Notifications']
  // #swagger.description = "Lister l'historique des notifications"
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const type = req.query.type?.toUpperCase();
  const offset = (page - 1) * limit;

  const where = type ? "WHERE type = ?" : "";
  const params = type ? [type, limit, offset] : [limit, offset];

  const rows = db
    .prepare(
      `SELECT * FROM notifications ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
    )
    .all(...params);
  const total = db
    .prepare(`SELECT COUNT(*) as count FROM notifications ${where}`)
    .get(...(type ? [type] : [])).count;

  const totalPages = Math.ceil(total / limit);

  console.log(
    `[NOTIF] 📋 Historique — page ${page}/${totalPages}, type: ${type || "tous"}`,
  );

  return res.status(200).json({
    data: rows.map((n) => ({ ...n, metadata: JSON.parse(n.metadata || "{}") })),
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
});

app.post("/notifications", (req, res) => {
  // #swagger.tags = ['Notifications']
  // #swagger.description = 'Envoyer une notification générique'
  const { type, recipient, message, metadata } = req.body;

  if (!type || !recipient || !message) {
    return res
      .status(400)
      .json({ error: "Les champs type, recipient et message sont requis" });
  }

  if (!NOTIFICATION_TYPES.includes(type.toUpperCase())) {
    return res.status(400).json({
      error: `Type invalide. Types acceptés : ${NOTIFICATION_TYPES.join(", ")}`,
    });
  }

  const result = sendNotification(
    type.toUpperCase(),
    recipient,
    message,
    metadata,
  );
  return res.status(201).json({ success: true, ...result });
});

app.post("/notifications/transaction", (req, res) => {
  // #swagger.tags = ['Notifications']
  // #swagger.description = 'Notifier une transaction bancaire (EMAIL/SMS/PUSH)'
  const {
    userId,
    email,
    phone,
    amount,
    currency = "EUR",
    transactionType,
  } = req.body;

  if (!userId || !amount || !transactionType) {
    return res.status(400).json({
      error: "Les champs userId, amount et transactionType sont requis",
    });
  }

  const message = `Transaction ${transactionType} de ${amount} ${currency} effectuée sur votre compte.`;
  const results = [];

  if (email)
    results.push(
      sendNotification("EMAIL", email, message, {
        userId,
        transactionType,
        amount,
      }),
    );
  if (phone)
    results.push(
      sendNotification("SMS", phone, message, {
        userId,
        transactionType,
        amount,
      }),
    );
  if (!email && !phone)
    results.push(
      sendNotification("PUSH", `user:${userId}`, message, {
        userId,
        transactionType,
        amount,
      }),
    );

  return res.status(201).json({
    success: true,
    notificationsSent: results.length,
    notifications: results,
  });
});

app.post("/notifications/alert", (req, res) => {
  // #swagger.tags = ['Notifications']
  // #swagger.description = 'Envoyer une alerte de sécurité'
  const { userId, email, alertType, details } = req.body;

  if (!userId || !alertType) {
    return res
      .status(400)
      .json({ error: "Les champs userId et alertType sont requis" });
  }

  const message = `⚠️ ALERTE SÉCURITÉ [${alertType}] : ${details || "Activité suspecte détectée sur votre compte."}`;
  const recipient = email || `user:${userId}`;
  const type = email ? "EMAIL" : "PUSH";

  const result = sendNotification(type, recipient, message, {
    userId,
    alertType,
  });
  return res.status(201).json({ success: true, ...result });
});

app.get("/health", (req, res) => {
  // #swagger.tags = ['Health']
  // #swagger.description = 'Vérifier la santé du service'
  res.json({ status: "UP", service: "notification-service", port: PORT });
});

// ─── Démarrage ────────────────────────────────────────────────────────────────

const resetDb = () => {
  db.prepare("DELETE FROM notifications").run();
};

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀 Notification Service démarré sur le port ${PORT}`);
    console.log(`   Swagger UI  : http://localhost:${PORT}/api-docs`);
    console.log(`   GET         : http://localhost:${PORT}/health`);
    console.log(`   GET         : http://localhost:${PORT}/notifications`);
    console.log(`   POST        : http://localhost:${PORT}/notifications`);
    console.log(
      `   POST        : http://localhost:${PORT}/notifications/transaction`,
    );
    console.log(
      `   POST        : http://localhost:${PORT}/notifications/alert\n`,
    );
  });
}

module.exports = { app, resetDb };
