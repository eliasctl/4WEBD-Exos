process.env.DB_PATH = ":memory:";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../index");
const { _resetForTest } = require("../db");
const { JWT_SECRET } = require("../config");

const makeToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

let adminToken, userToken, user2Token;

beforeEach(() => {
  _resetForTest();
  adminToken = makeToken({
    id: "usr-admin",
    email: "admin@bank.fr",
    role: "ADMIN",
  });
  userToken = makeToken({ id: "usr-1", email: "jean@bank.fr", role: "USER" });
  user2Token = makeToken({
    id: "usr-2",
    email: "pierre@bank.fr",
    role: "USER",
  });
});

describe("GET /health", () => {
  it("devrait retourner le statut du service", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UP");
    expect(res.body.service).toBe("account-service");
  });
});

describe("POST /accounts", () => {
  it("devrait créer un compte pour l'utilisateur connecté", async () => {
    const res = await request(app)
      .post("/accounts")
      .set("Authorization", `Bearer ${userToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.userId).toBe("usr-1");
    expect(res.body.balance).toBe(0);
    expect(res.body.currency).toBe("EUR");
  });

  it("devrait accepter une devise personnalisée", async () => {
    const res = await request(app)
      .post("/accounts")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ currency: "USD" });

    expect(res.status).toBe(201);
    expect(res.body.currency).toBe("USD");
  });

  it("devrait retourner 409 si le compte existe déjà", async () => {
    await request(app)
      .post("/accounts")
      .set("Authorization", `Bearer ${userToken}`)
      .send({});

    const res = await request(app)
      .post("/accounts")
      .set("Authorization", `Bearer ${userToken}`)
      .send({});

    expect(res.status).toBe(409);
  });

  it("devrait retourner 401 sans token", async () => {
    const res = await request(app).post("/accounts").send({});
    expect(res.status).toBe(401);
  });
});

describe("GET /accounts", () => {
  beforeEach(async () => {
    await request(app)
      .post("/accounts")
      .set("Authorization", `Bearer ${userToken}`)
      .send({});
    await request(app)
      .post("/accounts")
      .set("Authorization", `Bearer ${user2Token}`)
      .send({});
  });

  it("devrait retourner tous les comptes pour un admin", async () => {
    const res = await request(app)
      .get("/accounts")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  it("devrait retourner uniquement son compte pour un user", async () => {
    const res = await request(app)
      .get("/accounts")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].userId).toBe("usr-1");
  });

  it("devrait retourner un tableau vide si l'user n'a pas de compte", async () => {
    const noAccountToken = makeToken({
      id: "usr-none",
      email: "none@bank.fr",
      role: "USER",
    });
    const res = await request(app)
      .get("/accounts")
      .set("Authorization", `Bearer ${noAccountToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe("GET /accounts/:id", () => {
  let accountId;

  beforeEach(async () => {
    const res = await request(app)
      .post("/accounts")
      .set("Authorization", `Bearer ${userToken}`)
      .send({});
    accountId = res.body.id;
  });

  it("devrait retourner le compte pour son propriétaire", async () => {
    const res = await request(app)
      .get(`/accounts/${accountId}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(accountId);
  });

  it("devrait retourner le compte pour un admin", async () => {
    const res = await request(app)
      .get(`/accounts/${accountId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it("devrait retourner 403 pour un autre utilisateur", async () => {
    const res = await request(app)
      .get(`/accounts/${accountId}`)
      .set("Authorization", `Bearer ${user2Token}`);

    expect(res.status).toBe(403);
  });

  it("devrait retourner 404 pour un compte inexistant", async () => {
    const res = await request(app)
      .get("/accounts/acc-999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe("POST /accounts/:id/deposit", () => {
  let accountId;

  beforeEach(async () => {
    const res = await request(app)
      .post("/accounts")
      .set("Authorization", `Bearer ${userToken}`)
      .send({});
    accountId = res.body.id;
  });

  it("devrait déposer de l'argent", async () => {
    const res = await request(app)
      .post(`/accounts/${accountId}/deposit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 100 });

    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(100);
    expect(res.body.transaction).toHaveProperty("id");
    expect(res.body.transaction.type).toBe("DEPOSIT");
    expect(res.body.transaction.amount).toBe(100);
  });

  it("devrait cumuler les dépôts", async () => {
    await request(app)
      .post(`/accounts/${accountId}/deposit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 100 });

    const res = await request(app)
      .post(`/accounts/${accountId}/deposit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 50 });

    expect(res.body.balance).toBe(150);
  });

  it("devrait retourner 400 pour un montant invalide", async () => {
    const res = await request(app)
      .post(`/accounts/${accountId}/deposit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: -10 });

    expect(res.status).toBe(400);
  });

  it("devrait retourner 400 sans montant", async () => {
    const res = await request(app)
      .post(`/accounts/${accountId}/deposit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("devrait retourner 403 pour un autre utilisateur", async () => {
    const res = await request(app)
      .post(`/accounts/${accountId}/deposit`)
      .set("Authorization", `Bearer ${user2Token}`)
      .send({ amount: 100 });

    expect(res.status).toBe(403);
  });

  it("devrait retourner 404 pour un compte inexistant", async () => {
    const res = await request(app)
      .post("/accounts/acc-999/deposit")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 100 });

    expect(res.status).toBe(404);
  });
});

describe("POST /accounts/:id/withdraw", () => {
  let accountId;

  beforeEach(async () => {
    const create = await request(app)
      .post("/accounts")
      .set("Authorization", `Bearer ${userToken}`)
      .send({});
    accountId = create.body.id;

    await request(app)
      .post(`/accounts/${accountId}/deposit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 200 });
  });

  it("devrait retirer de l'argent", async () => {
    const res = await request(app)
      .post(`/accounts/${accountId}/withdraw`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 50 });

    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(150);
    expect(res.body.transaction.type).toBe("WITHDRAWAL");
  });

  it("devrait retourner 400 si solde insuffisant", async () => {
    const res = await request(app)
      .post(`/accounts/${accountId}/withdraw`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insuffisant/i);
  });

  it("devrait retourner 400 pour un montant invalide", async () => {
    const res = await request(app)
      .post(`/accounts/${accountId}/withdraw`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 0 });

    expect(res.status).toBe(400);
  });

  it("devrait retourner 403 pour un autre utilisateur", async () => {
    const res = await request(app)
      .post(`/accounts/${accountId}/withdraw`)
      .set("Authorization", `Bearer ${user2Token}`)
      .send({ amount: 50 });

    expect(res.status).toBe(403);
  });

  it("devrait retourner 404 pour un compte inexistant", async () => {
    const res = await request(app)
      .post("/accounts/acc-999/withdraw")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 50 });

    expect(res.status).toBe(404);
  });
});
