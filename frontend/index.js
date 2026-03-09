const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ─── API Proxy ───────────────────────────────────────────────────────────────

const SERVICES = {
  auth: 'http://localhost:3002',
  users: 'http://localhost:3002',
  accounts: 'http://localhost:3003',
  transactions: 'http://localhost:3003',
  notifications: 'http://localhost:3001',
};

app.all('/api/{*splat}', async (req, res) => {
  const fullPath = Array.isArray(req.params.splat) ? req.params.splat.join('/') : req.params.splat;
  const service = fullPath.split('/')[0];
  const baseUrl = SERVICES[service];
  if (!baseUrl) return res.status(404).json({ error: 'Service inconnu' });

  const query = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
  const url = `${baseUrl}/${fullPath}${query}`;

  const headers = { 'Content-Type': 'application/json' };
  if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;

  try {
    const fetchOptions = { method: req.method, headers };
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.log(`[PROXY] ❌ ${req.method} ${url} — ${err.message}`);
    res.status(502).json({ error: 'Service indisponible' });
  }
});

app.get('{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🌐 Frontend démarré sur http://localhost:${PORT}`);
  console.log(`   Proxy API → user-service:3002, notification-service:3001, account-service:3003\n`);
});
