process.env.DB_PATH = ":memory:";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../index");
const { _resetForTest } = require("../db");
const { JWT_SECRET } = require("../config");

const makeToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

let userToken, user2Token, accountId, account2Id;

beforeEach(async () => {
  _resetForTest();
  userToken = makeToken({ id: "usr-1", email: "jean@bank.fr", role: "USER" });
  user2Token = makeToken({
    id: "usr-2",
    email: "pierre@bank.fr",
    role: "USER",
  });

  // Créer deux comptes avec solde
  const a1 = await request(app)
    .post("/accounts")
    .set("Authorization", `Bearer ${userToken}`)
    .send({});
  accountId = a1.body.id;

  const a2 = await request(app)
    .post("/accounts")
    .set("Authorization", `Bearer ${user2Token}`)
    .send({});
  account2Id = a2.body.id;

  // Déposer de l'argent sur le compte 1
  await request(app)
    .post(`/accounts/${accountId}/deposit`)
    .set("Authorization", `Bearer ${userToken}`)
    .send({ amount: 500 });
});

describe("POST /transactions/transfer", () => {
  it("devrait effectuer un virement entre deux comptes", async () => {
    const res = await request(app)
      .post("/transactions/transfer")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ toAccountId: account2Id, amount: 100 });

    expect(res.status).toBe(200);
    expect(res.body.transaction.type).toBe("TRANSFER");
    expect(res.body.transaction.amount).toBe(100);
    expect(res.body.newBalance).toBe(400);

    // Vérifier le solde du destinataire
    const dest = await request(app)
      .get(`/accounts/${account2Id}`)
      .set("Authorization", `Bearer ${user2Token}`);
    expect(dest.body.balance).toBe(100);
  });

  it("devrait retourner 400 si solde insuffisant", async () => {
    const res = await request(app)
      .post("/transactions/transfer")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ toAccountId: account2Id, amount: 9999 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insuffisant/i);
  });

  it("devrait retourner 400 sans toAccountId", async () => {
    const res = await request(app)
      .post("/transactions/transfer")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 100 });

    expect(res.status).toBe(400);
  });

  it("devrait retourner 400 pour un montant invalide", async () => {
    const res = await request(app)
      .post("/transactions/transfer")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ toAccountId: account2Id, amount: -50 });

    expect(res.status).toBe(400);
  });

  it("devrait retourner 400 pour un virement vers son propre compte", async () => {
    const res = await request(app)
      .post("/transactions/transfer")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ toAccountId: accountId, amount: 50 });

    expect(res.status).toBe(400);
  });

  it("devrait retourner 400 pour un compte destinataire inexistant", async () => {
    const res = await request(app)
      .post("/transactions/transfer")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ toAccountId: "acc-999", amount: 50 });

    expect(res.status).toBe(400);
  });

  it("devrait retourner 404 si l'utilisateur n'a pas de compte", async () => {
    const noAccountToken = makeToken({
      id: "usr-none",
      email: "none@bank.fr",
      role: "USER",
    });
    const res = await request(app)
      .post("/transactions/transfer")
      .set("Authorization", `Bearer ${noAccountToken}`)
      .send({ toAccountId: account2Id, amount: 50 });

    expect(res.status).toBe(404);
  });
});

describe("GET /transactions", () => {
  beforeEach(async () => {
    // Créer quelques transactions
    await request(app)
      .post("/transactions/transfer")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ toAccountId: account2Id, amount: 50 });

    await request(app)
      .post("/transactions/transfer")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ toAccountId: account2Id, amount: 30 });
  });

  it("devrait retourner l'historique des transactions", async () => {
    const res = await request(app)
      .get("/transactions")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pagination");
    // 1 deposit + 2 transfers = 3 transactions pour ce compte
    expect(res.body.data.length).toBe(3);
  });

  it("devrait supporter la pagination", async () => {
    const res = await request(app)
      .get("/transactions?page=1&limit=2")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.hasNext).toBe(true);
  });

  it("devrait retourner 404 si l'utilisateur n'a pas de compte", async () => {
    const noAccountToken = makeToken({
      id: "usr-none",
      email: "none@bank.fr",
      role: "USER",
    });
    const res = await request(app)
      .get("/transactions")
      .set("Authorization", `Bearer ${noAccountToken}`);

    expect(res.status).toBe(404);
  });

  it("devrait retourner 401 sans token", async () => {
    const res = await request(app).get("/transactions");
    expect(res.status).toBe(401);
  });
});
