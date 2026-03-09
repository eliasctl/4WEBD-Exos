const express = require("express");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
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

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Notification Service API",
      version: "1.0.0",
      description: "Microservice de notifications bancaires (email, SMS, push)",
    },
    servers: [
      { url: `http://localhost:${PORT}`, description: "Serveur local" },
    ],
    tags: [
      {
        name: "Notifications",
        description: "Envoi et historique de notifications",
      },
      { name: "Health", description: "Santé du service" },
    ],
    components: {
      schemas: {
        NotificationResult: {
          type: "object",
          properties: {
            notificationId: { type: "string", example: "NOTIF-1710000000000" },
            timestamp: { type: "string", format: "date-time" },
            status: { type: "string", example: "SENT" },
          },
        },
        Notification: {
          type: "object",
          properties: {
            id: { type: "string", example: "NOTIF-1710000000000" },
            type: { type: "string", example: "EMAIL" },
            recipient: { type: "string", example: "client@bank.fr" },
            message: { type: "string" },
            metadata: { type: "object" },
            status: { type: "string", example: "SENT" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            total: { type: "integer", example: 42 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 10 },
            totalPages: { type: "integer", example: 5 },
            hasNext: { type: "boolean", example: true },
            hasPrev: { type: "boolean", example: false },
          },
        },
        PaginatedNotifications: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Notification" },
            },
            pagination: { $ref: "#/components/schemas/Pagination" },
          },
        },
      },
    },
  },
  apis: ["./index.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Lister l'historique des notifications
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numéro de page (commence à 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Nombre d'éléments par page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [EMAIL, SMS, PUSH]
 *         description: Filtrer par type de notification
 *     responses:
 *       200:
 *         description: Liste paginée des notifications
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedNotifications'
 */
app.get("/notifications", (req, res) => {
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

/**
 * @swagger
 * /notifications:
 *   post:
 *     summary: Envoyer une notification générique
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, recipient, message]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [EMAIL, SMS, PUSH]
 *                 example: EMAIL
 *               recipient:
 *                 type: string
 *                 example: client@bank.fr
 *               message:
 *                 type: string
 *                 example: Votre virement a été effectué.
 *               metadata:
 *                 type: object
 *                 example: { "accountId": "ACC-123" }
 *     responses:
 *       201:
 *         description: Notification envoyée
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                 - $ref: '#/components/schemas/NotificationResult'
 *       400:
 *         description: Paramètres manquants ou invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post("/notifications", (req, res) => {
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

/**
 * @swagger
 * /notifications/transaction:
 *   post:
 *     summary: Notifier une transaction bancaire
 *     description: Envoie une notification par EMAIL et/ou SMS selon les infos fournies. Si aucun canal n'est fourni, envoie une notification PUSH.
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, amount, transactionType]
 *             properties:
 *               userId:
 *                 type: string
 *                 example: usr-42
 *               email:
 *                 type: string
 *                 example: client@bank.fr
 *               phone:
 *                 type: string
 *                 example: "+33612345678"
 *               amount:
 *                 type: number
 *                 example: 250
 *               currency:
 *                 type: string
 *                 example: EUR
 *                 default: EUR
 *               transactionType:
 *                 type: string
 *                 example: VIREMENT
 *     responses:
 *       201:
 *         description: Notifications envoyées
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 notificationsSent:
 *                   type: integer
 *                   example: 2
 *                 notifications:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NotificationResult'
 *       400:
 *         description: Paramètres manquants
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post("/notifications/transaction", (req, res) => {
  const {
    userId,
    email,
    phone,
    amount,
    currency = "EUR",
    transactionType,
  } = req.body;

  if (!userId || !amount || !transactionType) {
    return res
      .status(400)
      .json({
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

  return res
    .status(201)
    .json({
      success: true,
      notificationsSent: results.length,
      notifications: results,
    });
});

/**
 * @swagger
 * /notifications/alert:
 *   post:
 *     summary: Envoyer une alerte de sécurité
 *     tags: [Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, alertType]
 *             properties:
 *               userId:
 *                 type: string
 *                 example: usr-42
 *               email:
 *                 type: string
 *                 example: client@bank.fr
 *               alertType:
 *                 type: string
 *                 example: CONNEXION_SUSPECTE
 *               details:
 *                 type: string
 *                 example: Tentative de connexion depuis un nouvel appareil.
 *     responses:
 *       201:
 *         description: Alerte envoyée
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                 - $ref: '#/components/schemas/NotificationResult'
 *       400:
 *         description: Paramètres manquants
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post("/notifications/alert", (req, res) => {
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

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Vérifier la santé du service
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service opérationnel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: UP
 *                 service:
 *                   type: string
 *                   example: notification-service
 *                 port:
 *                   type: integer
 *                   example: 3001
 */
app.get("/health", (req, res) => {
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
