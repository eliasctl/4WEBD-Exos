const express = require('express');
const router = express.Router();
const { accountStmts, nextAccountId } = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware);

/**
 * @swagger
 * /accounts:
 *   get:
 *     summary: Lister les comptes (admin = tous, user = le sien)
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des comptes
 */
router.get('/', (req, res) => {
  if (req.user.role === 'ADMIN') {
    const accounts = accountStmts.findAll.all();
    console.log(`[ACCOUNTS] 📋 Admin liste tous les comptes (${accounts.length})`);
    return res.json({ data: accounts });
  }
  const account = accountStmts.findByUserId.get(req.user.id);
  console.log(`[ACCOUNTS] 📋 User ${req.user.id} consulte son compte`);
  return res.json({ data: account ? [account] : [] });
});

/**
 * @swagger
 * /accounts:
 *   post:
 *     summary: Créer un compte pour l'utilisateur connecté
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currency:
 *                 type: string
 *                 example: EUR
 *     responses:
 *       201:
 *         description: Compte créé
 *       409:
 *         description: Compte déjà existant
 */
router.post('/', (req, res) => {
  const existing = accountStmts.findByUserId.get(req.user.id);
  if (existing) {
    console.log(`[ACCOUNTS] ⚠️ Compte déjà existant pour userId: ${req.user.id}`);
    return res.status(409).json({ error: 'Un compte existe déjà pour cet utilisateur' });
  }

  const { currency = 'EUR' } = req.body;
  const account = {
    id: nextAccountId(),
    userId: req.user.id,
    balance: 0,
    currency,
    createdAt: new Date().toISOString(),
  };

  accountStmts.insert.run(account.id, account.userId, account.balance, account.currency, account.createdAt);
  console.log(`[ACCOUNTS] ✅ Compte créé: ${account.id} pour userId: ${req.user.id}`);
  return res.status(201).json(account);
});

/**
 * @swagger
 * /accounts/{id}:
 *   get:
 *     summary: Obtenir un compte par ID
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Compte trouvé
 *       403:
 *         description: Accès refusé
 *       404:
 *         description: Compte introuvable
 */
router.get('/:id', (req, res) => {
  const account = accountStmts.findById.get(req.params.id);
  if (!account) {
    return res.status(404).json({ error: 'Compte introuvable' });
  }
  if (req.user.role !== 'ADMIN' && account.userId !== req.user.id) {
    console.log(`[ACCOUNTS] ⛔ Accès refusé au compte ${req.params.id} pour userId: ${req.user.id}`);
    return res.status(403).json({ error: 'Accès refusé' });
  }
  console.log(`[ACCOUNTS] 📋 Consultation du compte ${account.id}`);
  return res.json(account);
});

/**
 * @swagger
 * /accounts/{id}/deposit:
 *   post:
 *     summary: Déposer de l'argent sur un compte
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 100
 *     responses:
 *       200:
 *         description: Dépôt effectué
 */
router.post('/:id/deposit', (req, res) => {
  const account = accountStmts.findById.get(req.params.id);
  if (!account) return res.status(404).json({ error: 'Compte introuvable' });
  if (req.user.role !== 'ADMIN' && account.userId !== req.user.id) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const amount = parseFloat(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Montant invalide' });

  const { txStmts, nextTxId } = require('../db');
  const newBalance = account.balance + amount;
  accountStmts.updateBalance.run(newBalance, account.id);

  const tx = {
    id: nextTxId(),
    type: 'DEPOSIT',
    fromAccount: null,
    toAccount: account.id,
    amount,
    description: req.body.description || null,
    createdAt: new Date().toISOString(),
  };
  txStmts.insert.run(tx.id, tx.type, tx.fromAccount, tx.toAccount, tx.amount, tx.description, tx.createdAt);

  console.log(`[ACCOUNTS] 💰 Dépôt de ${amount} sur ${account.id} — nouveau solde: ${newBalance}`);
  return res.json({ ...account, balance: newBalance, transaction: tx });
});

/**
 * @swagger
 * /accounts/{id}/withdraw:
 *   post:
 *     summary: Retirer de l'argent d'un compte
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 50
 *     responses:
 *       200:
 *         description: Retrait effectué
 *       400:
 *         description: Solde insuffisant
 */
router.post('/:id/withdraw', (req, res) => {
  const account = accountStmts.findById.get(req.params.id);
  if (!account) return res.status(404).json({ error: 'Compte introuvable' });
  if (req.user.role !== 'ADMIN' && account.userId !== req.user.id) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const amount = parseFloat(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Montant invalide' });
  if (account.balance < amount) return res.status(400).json({ error: 'Solde insuffisant' });

  const { txStmts, nextTxId } = require('../db');
  const newBalance = account.balance - amount;
  accountStmts.updateBalance.run(newBalance, account.id);

  const tx = {
    id: nextTxId(),
    type: 'WITHDRAWAL',
    fromAccount: account.id,
    toAccount: null,
    amount,
    description: req.body.description || null,
    createdAt: new Date().toISOString(),
  };
  txStmts.insert.run(tx.id, tx.type, tx.fromAccount, tx.toAccount, tx.amount, tx.description, tx.createdAt);

  console.log(`[ACCOUNTS] 💸 Retrait de ${amount} depuis ${account.id} — nouveau solde: ${newBalance}`);
  return res.json({ ...account, balance: newBalance, transaction: tx });
});

module.exports = router;
