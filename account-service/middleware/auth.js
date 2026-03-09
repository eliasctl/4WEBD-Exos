const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`[AUTH] ❌ Accès refusé — token manquant (${req.method} ${req.path})`);
    return res.status(401).json({ error: 'Token manquant ou invalide' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    console.log(`[AUTH] ✅ Token valide — userId: ${payload.id}, role: ${payload.role}`);
    next();
  } catch (err) {
    console.log(`[AUTH] ❌ Token invalide — ${err.message}`);
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    console.log(`[AUTH] ⛔ Accès admin refusé — userId: ${req.user?.id}`);
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly };
