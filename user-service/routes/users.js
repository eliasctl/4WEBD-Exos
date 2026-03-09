const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', adminOnly, (req, res) => {
  // #swagger.tags = ['Users']
  // #swagger.description = 'Lister tous les utilisateurs (admin uniquement)'
  // #swagger.security = [{ "bearerAuth": [] }]
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

  const { data, total, totalPages } = db.findPaginated({ page, limit });
  const users = data.map(({ password, ...u }) => u);

  console.log(`[USERS] 📋 Liste demandée par admin: ${req.user.id} — page ${page}/${totalPages}`);

  return res.status(200).json({
    data: users,
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

router.get('/:id', (req, res) => {
  // #swagger.tags = ['Users']
  // #swagger.description = "Obtenir un utilisateur par ID (soi-même ou admin)"
  // #swagger.security = [{ "bearerAuth": [] }]
  const { id } = req.params;

  if (req.user.id !== id && req.user.role !== 'ADMIN') {
    console.log(`[USERS] ⛔ Accès refusé — ${req.user.id} tente de lire le profil de ${id}`);
    return res.status(403).json({ error: 'Accès interdit' });
  }

  const user = db.findById(id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  console.log(`[USERS] 👤 Profil consulté — id: ${id}`);
  const { password, ...userPublic } = user;
  return res.status(200).json(userPublic);
});

router.put('/:id', async (req, res) => {
  // #swagger.tags = ['Users']
  // #swagger.description = 'Mettre à jour un utilisateur (soi-même ou admin)'
  // #swagger.security = [{ "bearerAuth": [] }]
  const { id } = req.params;

  if (req.user.id !== id && req.user.role !== 'ADMIN') {
    console.log(`[USERS] ⛔ Modification refusée — ${req.user.id} tente de modifier ${id}`);
    return res.status(403).json({ error: 'Accès interdit' });
  }

  if (!db.findById(id)) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const { firstName, lastName, email, password } = req.body;

  if (email) {
    const existing = db.findByEmail(email);
    if (existing && existing.id !== id) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }
  }

  const fields = { firstName, lastName, email };
  if (password) fields.password = await bcrypt.hash(password, 10);

  const updated = db.update(id, fields);
  console.log(`[USERS] ✏️  Utilisateur mis à jour — id: ${id}`);

  const { password: _, ...userPublic } = updated;
  return res.status(200).json(userPublic);
});

router.delete('/:id', adminOnly, (req, res) => {
  // #swagger.tags = ['Users']
  // #swagger.description = 'Supprimer un utilisateur (admin uniquement)'
  // #swagger.security = [{ "bearerAuth": [] }]
  const { id } = req.params;

  if (!db.findById(id)) return res.status(404).json({ error: 'Utilisateur introuvable' });

  db.remove(id);
  console.log(`[USERS] 🗑️  Utilisateur supprimé — id: ${id} par admin: ${req.user.id}`);

  return res.status(200).json({ message: `Utilisateur ${id} supprimé` });
});

module.exports = router;
