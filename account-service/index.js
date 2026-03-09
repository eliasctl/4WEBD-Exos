const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger-output.json');
const { PORT } = require('./config');

const accountsRouter = require('./routes/accounts');
const transactionsRouter = require('./routes/transactions');

const app = express();
app.use(express.json());

// ─── Swagger ──────────────────────────────────────────────────────────────────

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  // #swagger.tags = ['Health']
  // #swagger.description = 'Vérifier la santé du service'
  res.json({ status: 'UP', service: 'account-service', port: PORT });
});

app.use('/accounts', accountsRouter);
app.use('/transactions', transactionsRouter);

// ─── Démarrage ────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Account Service démarré sur le port ${PORT}`);
  console.log(`   Swagger UI  : http://localhost:${PORT}/api-docs`);
  console.log(`   GET         : http://localhost:${PORT}/health`);
  console.log(`   GET/POST    : http://localhost:${PORT}/accounts`);
  console.log(`   POST        : http://localhost:${PORT}/accounts/:id/deposit`);
  console.log(`   POST        : http://localhost:${PORT}/accounts/:id/withdraw`);
  console.log(`   GET         : http://localhost:${PORT}/transactions`);
  console.log(`   POST        : http://localhost:${PORT}/transactions/transfer\n`);
});
