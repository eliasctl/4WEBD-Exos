const express = require("express");

const app = express();
const PORT = process.env.PORT || 3004;

// ─── Liste des instances notification-service ────────────────────────────────

const TARGETS = (
  process.env.NOTIFICATION_TARGETS ||
  "http://notification-service-1:3001,http://notification-service-2:3001"
)
  .split(",")
  .map((u) => u.trim());

let currentIndex = 0;

function getNextTarget() {
  const target = TARGETS[currentIndex];
  currentIndex = (currentIndex + 1) % TARGETS.length;
  return target;
}

// ─── CORS ────────────────────────────────────────────────────────────────────

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

// ─── Health check ────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", targets: TARGETS });
});

// ─── Proxy round-robin ──────────────────────────────────────────────────────

app.all("/{*splat}", async (req, res) => {
  const target = getNextTarget();
  const path = req.originalUrl;
  const url = `${target}${path}`;

  console.log(`[LB] ${req.method} ${path} → ${url}`);

  const headers = { "Content-Type": "application/json" };
  if (req.headers.authorization)
    headers["Authorization"] = req.headers.authorization;

  try {
    const fetchOptions = { method: req.method, headers };
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.log(`[LB] ❌ ${req.method} ${url} — ${err.message}`);
    res.status(502).json({ error: "Notification service indisponible" });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n⚖️  Notification Load Balancer démarré sur le port ${PORT}`);
    console.log(`   Mode : Round Robin`);
    console.log(`   Instances :`);
    TARGETS.forEach((t, i) => console.log(`     [${i}] ${t}`));
    console.log();
  });
}

module.exports = app; // export for testing
