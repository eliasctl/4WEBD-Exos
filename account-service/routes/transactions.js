const express = require('express');
const router = express.Router();
const { accountStmts, txStmts, transfer } = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

/**
 * @swagger
 * /transactions:
 *   get:
 *     summary: Historique des transactions du compte connecté
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Liste des transactions
 *       404:
 *         description: Aucun compte trouvé
 */
router.get('/', (req, res) => {
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

/**
 * @swagger
 * /transactions/transfer:
 *   post:
 *     summary: Effectuer un virement vers un autre compte
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [toAccountId, amount]
 *             properties:
 *               toAccountId:
 *                 type: string
 *                 example: acc-2
 *               amount:
 *                 type: number
 *                 example: 50
 *               description:
 *                 type: string
 *                 example: Remboursement loyer
 *     responses:
 *       200:
 *         description: Virement effectué
 *       400:
 *         description: Solde insuffisant ou montant invalide
 *       404:
 *         description: Compte source introuvable
 */
router.post('/transfer', (req, res) => {
  const fromAccount = accountStmts.findByUserId.get(req.user.id);
  if (!fromAccount) return res.status(404).json({ error: 'Vous n\'avez pas de compte' });

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
