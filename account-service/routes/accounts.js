const express = require('express');
const router = express.Router();
const { accountStmts, nextAccountId } = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', (req, res) => {
  // #swagger.tags = ['Accounts']
  // #swagger.description = 'Lister les comptes (admin = tous, user = le sien)'
  // #swagger.security = [{ "bearerAuth": [] }]
  if (req.user.role === 'ADMIN') {
    const accounts = accountStmts.findAll.all();
    console.log(`[ACCOUNTS] 📋 Admin liste tous les comptes (${accounts.length})`);
    return res.json({ data: accounts });
  }
  const account = accountStmts.findByUserId.get(req.user.id);
  console.log(`[ACCOUNTS] 📋 User ${req.user.id} consulte son compte`);
  return res.json({ data: account ? [account] : [] });
});

router.post('/', (req, res) => {
  // #swagger.tags = ['Accounts']
  // #swagger.description = "Créer un compte pour l'utilisateur connecté"
  // #swagger.security = [{ "bearerAuth": [] }]
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

router.get('/:id', (req, res) => {
  // #swagger.tags = ['Accounts']
  // #swagger.description = 'Obtenir un compte par ID'
  // #swagger.security = [{ "bearerAuth": [] }]
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

router.post('/:id/deposit', (req, res) => {
  // #swagger.tags = ['Accounts']
  // #swagger.description = "Déposer de l'argent sur un compte"
  // #swagger.security = [{ "bearerAuth": [] }]
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

router.post('/:id/withdraw', (req, res) => {
  // #swagger.tags = ['Accounts']
  // #swagger.description = "Retirer de l'argent d'un compte"
  // #swagger.security = [{ "bearerAuth": [] }]
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
