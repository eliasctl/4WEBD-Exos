const express = require("express");
const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
const path = require("path");
const { PORT } = require("./config");

const accountsRouter = require("./routes/accounts");
const transactionsRouter = require("./routes/transactions");

const app = express();

// ─── CORS ────────────────────────────────────────────────────────────────────

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

// ─── Swagger ──────────────────────────────────────────────────────────────────

const swaggerPath = path.join(__dirname, "swagger-output.json");
if (fs.existsSync(swaggerPath)) {
  const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  // #swagger.tags = ['Health']
  // #swagger.description = 'Vérifier la santé du service'
  res.json({ status: "UP", service: "account-service", port: PORT });
});

app.use("/accounts", accountsRouter);
app.use("/transactions", transactionsRouter);

// ─── Démarrage ────────────────────────────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀 Account Service démarré sur le port ${PORT}`);
    console.log(`   Swagger UI  : http://localhost:${PORT}/api-docs`);
    console.log(`   GET         : http://localhost:${PORT}/health`);
    console.log(`   GET/POST    : http://localhost:${PORT}/accounts`);
    console.log(
      `   POST        : http://localhost:${PORT}/accounts/:id/deposit`,
    );
    console.log(
      `   POST        : http://localhost:${PORT}/accounts/:id/withdraw`,
    );
    console.log(`   GET         : http://localhost:${PORT}/transactions`);
    console.log(
      `   POST        : http://localhost:${PORT}/transactions/transfer\n`,
    );
  });
}

module.exports = app;
