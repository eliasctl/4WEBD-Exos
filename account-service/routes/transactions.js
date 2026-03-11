const express = require("express");
const router = express.Router();
const { accountStmts, txStmts, transfer } = require("../db");
const { authMiddleware } = require("../middleware/auth");
const { publishNotification } = require("../amqp");

router.use(authMiddleware);

router.get("/", (req, res) => {
  // #swagger.tags = ['Transactions']
  // #swagger.description = 'Historique des transactions (accountId requis si plusieurs comptes)'
  // #swagger.security = [{ "bearerAuth": [] }]
  const { accountId } = req.query;
  let account;

  if (accountId) {
    account = accountStmts.findById.get(accountId);
    if (!account) return res.status(404).json({ error: "Compte introuvable" });
    if (req.user.role !== "ADMIN" && account.userId !== req.user.id) {
      return res.status(403).json({ error: "Accès refusé" });
    }
  } else {
    const accounts = accountStmts.findAllByUserId.all(req.user.id);
    if (accounts.length === 0)
      return res
        .status(404)
        .json({ error: "Aucun compte trouvé pour cet utilisateur" });
    account = accounts[0];
  }

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const data = txStmts.findByAccount.all(account.id, account.id, limit, offset);
  const total = txStmts.countByAccount.get(account.id, account.id).count;
  const totalPages = Math.ceil(total / limit);

  console.log(
    `[TRANSACTIONS] 📋 Historique pour ${account.id} — page ${page}/${totalPages}`,
  );
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

router.post("/transfer", (req, res) => {
  // #swagger.tags = ['Transactions']
  // #swagger.description = 'Effectuer un virement vers un autre compte'
  // #swagger.security = [{ "bearerAuth": [] }]
  const { fromAccountId, toAccountId, amount, description } = req.body;
  let fromAccount;

  if (fromAccountId) {
    fromAccount = accountStmts.findById.get(fromAccountId);
    if (!fromAccount)
      return res.status(404).json({ error: "Compte source introuvable" });
    if (req.user.role !== "ADMIN" && fromAccount.userId !== req.user.id) {
      return res.status(403).json({ error: "Accès refusé" });
    }
  } else {
    const accounts = accountStmts.findAllByUserId.all(req.user.id);
    if (accounts.length === 0)
      return res.status(404).json({ error: "Vous n'avez pas de compte" });
    fromAccount = accounts[0];
  }

  if (!toAccountId)
    return res.status(400).json({ error: "toAccountId requis" });

  const parsedAmount = parseFloat(amount);
  if (!parsedAmount || parsedAmount <= 0)
    return res.status(400).json({ error: "Montant invalide" });
  if (fromAccount.id === toAccountId)
    return res
      .status(400)
      .json({ error: "Impossible de virer vers son propre compte" });

  try {
    const tx = transfer(fromAccount.id, toAccountId, parsedAmount, description);
    const updatedFrom = accountStmts.findById.get(fromAccount.id);
    console.log(
      `[TRANSACTIONS] 💸 Virement de ${parsedAmount} : ${fromAccount.id} → ${toAccountId}`,
    );

    publishNotification({
      type: "EMAIL",
      recipient: `user:${req.user.id}`,
      message: `Transaction VIREMENT de ${parsedAmount} ${updatedFrom.currency} effectuée sur votre compte.`,
      metadata: {
        userId: req.user.id,
        transactionType: "VIREMENT",
        amount: parsedAmount,
      },
    });

    return res.json({ transaction: tx, newBalance: updatedFrom.balance });
  } catch (err) {
    console.log(`[TRANSACTIONS] ❌ Virement échoué — ${err.message}`);
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
