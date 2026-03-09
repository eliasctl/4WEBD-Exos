const Database = require("better-sqlite3");
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(__dirname, "users.db");
const db = new Database(dbPath);

// Activer les foreign keys et le mode WAL (meilleures performances)
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─── Création de la table ─────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    firstName  TEXT NOT NULL,
    lastName   TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    password   TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'USER',
    createdAt  TEXT NOT NULL
  )
`);

console.log("[DB] ✅ Base SQLite connectée — users.db");

// ─── Seed : admin par défaut si la table est vide ─────────────────────────────

const count = db.prepare("SELECT COUNT(*) as count FROM users").get();
if (count.count === 0) {
  const bcrypt = require("bcryptjs");
  const hashedPassword = bcrypt.hashSync("admin123", 10);
  db.prepare(
    `
    INSERT INTO users (id, firstName, lastName, email, password, role, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    "usr-1",
    "Alice",
    "Dupont",
    "alice@bank.fr",
    hashedPassword,
    "ADMIN",
    new Date().toISOString(),
  );
  console.log("[DB] 🌱 Utilisateur admin créé — alice@bank.fr / admin123");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _counter =
  db.prepare("SELECT COUNT(*) as count FROM users").get().count + 1;
const nextId = () => `usr-${_counter++}`;

const findAll = () => db.prepare("SELECT * FROM users").all();

const findPaginated = ({ page = 1, limit = 10 } = {}) => {
  const offset = (page - 1) * limit;
  const data = db
    .prepare("SELECT * FROM users ORDER BY createdAt DESC LIMIT ? OFFSET ?")
    .all(limit, offset);
  const total = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const findById = (id) => db.prepare("SELECT * FROM users WHERE id = ?").get(id);

const findByEmail = (email) =>
  db.prepare("SELECT * FROM users WHERE email = ?").get(email);

const insert = (user) => {
  db.prepare(
    `
    INSERT INTO users (id, firstName, lastName, email, password, role, createdAt)
    VALUES (@id, @firstName, @lastName, @email, @password, @role, @createdAt)
  `,
  ).run(user);
  return findById(user.id);
};

const update = (id, fields) => {
  const allowed = ["firstName", "lastName", "email", "password", "role"];
  const updates = Object.keys(fields)
    .filter((k) => allowed.includes(k) && fields[k] !== undefined)
    .map((k) => `${k} = @${k}`)
    .join(", ");

  if (!updates) return findById(id);

  db.prepare(`UPDATE users SET ${updates} WHERE id = @id`).run({
    ...fields,
    id,
  });
  return findById(id);
};

const remove = (id) => db.prepare("DELETE FROM users WHERE id = ?").run(id);

const _resetForTest = () => {
  db.prepare("DELETE FROM users").run();
  _counter = 1;
};

module.exports = {
  nextId,
  findAll,
  findPaginated,
  findById,
  findByEmail,
  insert,
  update,
  remove,
  _resetForTest,
};
