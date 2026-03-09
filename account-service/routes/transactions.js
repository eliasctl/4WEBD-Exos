const express = require('express');
const router = express.Router();
const { accountStmts, txStmts, transfer } = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', (req, res) => {
  // #swagger.tags = ['Transactions']
  // #swagger.description = 'Historique des transactions du compte connecté'
  // #swagger.security = [{ "bearerAuth": [] }]
  const account = accountStmts.findByUserId.get(req.user.id);
  if (!account) return res.status(404).json({ error: 'Aucun compte trouvé pour cet utilisateur' });

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const data = txStmts.findByAccount.all(account.id, account.id, limit, offset);
  const total = txStmts.countByAccount.get(account.id, account.id).count;
  const totalPages = Math.ceil(total / limit);

  console.log(`[TRANSACTIONS] 📋 Historique pour ${account.id} — page ${page}/${totalPages}`);
  return res.json({
    data,
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

router.post('/transfer', (req, res) => {
  // #swagger.tags = ['Transactions']
  // #swagger.description = 'Effectuer un virement vers un autre compte'
  // #swagger.security = [{ "bearerAuth": [] }]
  const fromAccount = accountStmts.findByUserId.get(req.user.id);
  if (!fromAccount) return res.status(404).json({ error: "Vous n'avez pas de compte" });

  const { toAccountId, amount, description } = req.body;
  if (!toAccountId) return res.status(400).json({ error: 'toAccountId requis' });

  const parsedAmount = parseFloat(amount);
  if (!parsedAmount || parsedAmount <= 0) return res.status(400).json({ error: 'Montant invalide' });
  if (fromAccount.id === toAccountId) return res.status(400).json({ error: 'Impossible de virer vers son propre compte' });

  try {
    const tx = transfer(fromAccount.id, toAccountId, parsedAmount, description);
    const updatedFrom = accountStmts.findById.get(fromAccount.id);
    console.log(`[TRANSACTIONS] 💸 Virement de ${parsedAmount} : ${fromAccount.id} → ${toAccountId}`);
    return res.json({ transaction: tx, newBalance: updatedFrom.balance });
  } catch (err) {
    console.log(`[TRANSACTIONS] ❌ Virement échoué — ${err.message}`);
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
