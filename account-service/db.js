const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'accounts.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id        TEXT PRIMARY KEY,
    userId    TEXT NOT NULL UNIQUE,
    balance   REAL NOT NULL DEFAULT 0,
    currency  TEXT NOT NULL DEFAULT 'EUR',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    fromAccount TEXT,
    toAccount   TEXT,
    amount      REAL NOT NULL,
    description TEXT,
    createdAt   TEXT NOT NULL,
    FOREIGN KEY (fromAccount) REFERENCES accounts(id),
    FOREIGN KEY (toAccount)   REFERENCES accounts(id)
  );
`);

let counter = db.prepare('SELECT COUNT(*) as count FROM accounts').get().count;

function nextAccountId() {
  counter++;
  return `acc-${counter}`;
}

let txCounter = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;

function nextTxId() {
  txCounter++;
  return `tx-${txCounter}`;
}

const accountStmts = {
  findAll: db.prepare('SELECT * FROM accounts ORDER BY createdAt DESC'),
  findById: db.prepare('SELECT * FROM accounts WHERE id = ?'),
  findByUserId: db.prepare('SELECT * FROM accounts WHERE userId = ?'),
  insert: db.prepare('INSERT INTO accounts (id, userId, balance, currency, createdAt) VALUES (?, ?, ?, ?, ?)'),
  updateBalance: db.prepare('UPDATE accounts SET balance = ? WHERE id = ?'),
};

const txStmts = {
  findByAccount: db.prepare(`
    SELECT * FROM transactions
    WHERE fromAccount = ? OR toAccount = ?
    ORDER BY createdAt DESC
    LIMIT ? OFFSET ?
  `),
  countByAccount: db.prepare(`
    SELECT COUNT(*) as count FROM transactions
    WHERE fromAccount = ? OR toAccount = ?
  `),
  insert: db.prepare('INSERT INTO transactions (id, type, fromAccount, toAccount, amount, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)'),
};

const transfer = db.transaction((fromId, toId, amount, description) => {
  const from = accountStmts.findById.get(fromId);
  const to = accountStmts.findById.get(toId);

  if (!from) throw new Error('Compte source introuvable');
  if (!to) throw new Error('Compte destinataire introuvable');
  if (from.balance < amount) throw new Error('Solde insuffisant');

  accountStmts.updateBalance.run(from.balance - amount, fromId);
  accountStmts.updateBalance.run(to.balance + amount, toId);

  const tx = {
    id: nextTxId(),
    type: 'TRANSFER',
    fromAccount: fromId,
    toAccount: toId,
    amount,
    description: description || null,
    createdAt: new Date().toISOString(),
  };
  txStmts.insert.run(tx.id, tx.type, tx.fromAccount, tx.toAccount, tx.amount, tx.description, tx.createdAt);
  return tx;
});

module.exports = { db, accountStmts, txStmts, transfer, nextAccountId, nextTxId };
