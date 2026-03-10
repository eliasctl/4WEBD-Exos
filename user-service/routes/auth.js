const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN, SERVICE_NUMBER } = require('../config');

const router = express.Router();

router.post('/register', async (req, res) => {
  // #swagger.tags = ['Auth']
  // #swagger.description = 'Créer un compte utilisateur'
  const { firstName, lastName, email, password, role = 'USER' } = req.body;

  console.log(`[AUTH-${SERVICE_NUMBER}] 📝 Tentative d'inscription — email: ${email}`);

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis : firstName, lastName, email, password' });
  }

  if (db.findByEmail(email)) {
    console.log(`[AUTH-${SERVICE_NUMBER}] ❌ Email déjà utilisé — ${email}`);
    return res.status(400).json({ error: 'Cet email est déjà utilisé' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: db.nextId(),
    firstName,
    lastName,
    email,
    password: hashedPassword,
    role: role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER',
    createdAt: new Date().toISOString(),
  };

  const created = db.insert(newUser);
  console.log(`[AUTH-${SERVICE_NUMBER}] ✅ Inscription réussie — id: ${created.id}, email: ${created.email}, role: ${created.role}`);

  const { password: _, ...userPublic } = created;
  return res.status(201).json(userPublic);
});

router.post('/login', async (req, res) => {
  // #swagger.tags = ['Auth']
  // #swagger.description = 'Se connecter et obtenir un token JWT'
  const { email, password } = req.body;

  console.log(`[AUTH-${SERVICE_NUMBER}] 🔑 Tentative de connexion — email: ${email}`);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const user = db.findByEmail(email);
  if (!user) {
    console.log(`[AUTH-${SERVICE_NUMBER}] ❌ Utilisateur introuvable — ${email}`);
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    console.log(`[AUTH-${SERVICE_NUMBER}] ❌ Mot de passe incorrect — ${email}`);
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  console.log(`[AUTH-${SERVICE_NUMBER}] ✅ Connexion réussie — id: ${user.id}, role: ${user.role}`);

  const { password: _, ...userPublic } = user;
  return res.status(200).json({ token, user: userPublic });
});

router.get('/me', require('../middleware/auth').authMiddleware, (req, res) => {
  // #swagger.tags = ['Auth']
  // #swagger.description = 'Obtenir son propre profil (token requis)'
  // #swagger.security = [{ "bearerAuth": [] }]
  const user = db.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  console.log(`[AUTH] 👤 Profil consulté — id: ${user.id}`);

  const { password: _, ...userPublic } = user;
  return res.status(200).json(userPublic);
});

module.exports = router;
