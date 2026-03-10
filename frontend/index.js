const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

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

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// ─── API Proxy ───────────────────────────────────────────────────────────────

const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://localhost:3002";
const ACCOUNT_SERVICE_URL =
  process.env.ACCOUNT_SERVICE_URL || "http://localhost:3003";
const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3001";

const SERVICES = {
  auth: USER_SERVICE_URL,
  users: USER_SERVICE_URL,
  accounts: ACCOUNT_SERVICE_URL,
  transactions: ACCOUNT_SERVICE_URL,
  notifications: NOTIFICATION_SERVICE_URL,
};

app.all("/api/{*splat}", async (req, res) => {
  const fullPath = Array.isArray(req.params.splat)
    ? req.params.splat.join("/")
    : req.params.splat;
  const service = fullPath.split("/")[0];
  const baseUrl = SERVICES[service];
  if (!baseUrl) return res.status(404).json({ error: "Service inconnu" });

  const query = req.url.includes("?") ? "?" + req.url.split("?")[1] : "";
  const url = `${baseUrl}/${fullPath}${query}`;

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
    console.log(`[PROXY] ❌ ${req.method} ${url} — ${err.message}`);
    res.status(502).json({ error: "Service indisponible" });
  }
});

app.get("{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  const mode = process.env.MODE || "dev";
  const publicUrl =
    mode === "prod" ? `http://frontend:${PORT}` : `http://localhost:3010`;
  console.log(`\n🌐 Frontend démarré (${mode}) sur ${publicUrl}`);
  console.log(
    `   Proxy API → ${USER_SERVICE_URL}, ${NOTIFICATION_SERVICE_URL}, ${ACCOUNT_SERVICE_URL}\n`,
  );
});
