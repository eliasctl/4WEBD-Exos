process.env.DB_PATH = ":memory:";

const request = require("supertest");
const { app, resetDb } = require("../index");

beforeEach(() => {
  resetDb();
});

describe("GET /health", () => {
  it("devrait retourner le statut du service", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UP");
    expect(res.body.service).toBe("notification-service");
  });
});

describe("POST /notifications", () => {
  it("devrait envoyer une notification EMAIL", async () => {
    const res = await request(app).post("/notifications").send({
      type: "EMAIL",
      recipient: "client@bank.fr",
      message: "Test notification",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("notificationId");
    expect(res.body.status).toBe("SENT");
  });

  it("devrait retourner 400 si des champs sont manquants", async () => {
    const res = await request(app)
      .post("/notifications")
      .send({ type: "EMAIL" });

    expect(res.status).toBe(400);
  });

  it("devrait retourner 400 pour un type invalide", async () => {
    const res = await request(app).post("/notifications").send({
      type: "INVALID",
      recipient: "client@bank.fr",
      message: "Test",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type/i);
  });

  it("devrait accepter le type SMS", async () => {
    const res = await request(app).post("/notifications").send({
      type: "SMS",
      recipient: "+33612345678",
      message: "Test SMS",
    });

    expect(res.status).toBe(201);
  });

  it("devrait accepter le type PUSH", async () => {
    const res = await request(app).post("/notifications").send({
      type: "PUSH",
      recipient: "user:usr-1",
      message: "Test push",
    });

    expect(res.status).toBe(201);
  });

  it("devrait stocker les metadata", async () => {
    await request(app)
      .post("/notifications")
      .send({
        type: "EMAIL",
        recipient: "client@bank.fr",
        message: "Avec metadata",
        metadata: { accountId: "ACC-123" },
      });

    const list = await request(app).get("/notifications");
    expect(list.body.data[0].metadata).toEqual({ accountId: "ACC-123" });
  });
});

describe("GET /notifications", () => {
  beforeEach(async () => {
    await request(app).post("/notifications").send({
      type: "EMAIL",
      recipient: "a@bank.fr",
      message: "Notif 1",
    });
    // petit délai pour éviter collision de Date.now()
    await new Promise((r) => setTimeout(r, 5));
    await request(app).post("/notifications").send({
      type: "SMS",
      recipient: "+33600000000",
      message: "Notif 2",
    });
    await new Promise((r) => setTimeout(r, 5));
    await request(app).post("/notifications").send({
      type: "EMAIL",
      recipient: "b@bank.fr",
      message: "Notif 3",
    });
  });

  it("devrait retourner les notifications paginées", async () => {
    const res = await request(app).get("/notifications");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pagination");
    expect(res.body.data.length).toBe(3);
  });

  it("devrait supporter la pagination", async () => {
    const res = await request(app).get("/notifications?page=1&limit=2");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.totalPages).toBe(2);
    expect(res.body.pagination.hasNext).toBe(true);
  });

  it("devrait filtrer par type", async () => {
    const res = await request(app).get("/notifications?type=EMAIL");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    res.body.data.forEach((n) => {
      expect(n.type).toBe("EMAIL");
    });
  });

  it("devrait retourner une liste vide pour un type sans résultats", async () => {
    const res = await request(app).get("/notifications?type=PUSH");

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });
});

describe("POST /notifications/transaction", () => {
  it("devrait envoyer une notification EMAIL pour une transaction", async () => {
    const res = await request(app).post("/notifications/transaction").send({
      userId: "usr-1",
      email: "client@bank.fr",
      amount: 250,
      transactionType: "VIREMENT",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.notificationsSent).toBe(1);
  });

  it("devrait envoyer une notification SMS pour une transaction", async () => {
    const res = await request(app).post("/notifications/transaction").send({
      userId: "usr-1",
      phone: "+33612345678",
      amount: 100,
      transactionType: "RETRAIT",
    });

    expect(res.status).toBe(201);
    expect(res.body.notificationsSent).toBe(1);
  });

  it("devrait envoyer EMAIL et SMS si les deux sont fournis", async () => {
    const res = await request(app).post("/notifications/transaction").send({
      userId: "usr-1",
      email: "client@bank.fr",
      phone: "+33612345678",
      amount: 500,
      transactionType: "VIREMENT",
    });

    expect(res.status).toBe(201);
    expect(res.body.notificationsSent).toBe(2);
  });

  it("devrait envoyer un PUSH si ni email ni phone", async () => {
    const res = await request(app).post("/notifications/transaction").send({
      userId: "usr-1",
      amount: 50,
      transactionType: "PAIEMENT",
    });

    expect(res.status).toBe(201);
    expect(res.body.notificationsSent).toBe(1);
  });

  it("devrait utiliser EUR comme devise par défaut", async () => {
    const res = await request(app).post("/notifications/transaction").send({
      userId: "usr-1",
      email: "client@bank.fr",
      amount: 100,
      transactionType: "VIREMENT",
    });

    expect(res.status).toBe(201);

    const list = await request(app).get("/notifications");
    expect(list.body.data[0].message).toContain("EUR");
  });

  it("devrait retourner 400 si des champs requis sont manquants", async () => {
    const res = await request(app)
      .post("/notifications/transaction")
      .send({ userId: "usr-1" });

    expect(res.status).toBe(400);
  });
});

describe("POST /notifications/alert", () => {
  it("devrait envoyer une alerte par EMAIL", async () => {
    const res = await request(app).post("/notifications/alert").send({
      userId: "usr-1",
      email: "client@bank.fr",
      alertType: "CONNEXION_SUSPECTE",
      details: "Connexion depuis un nouvel appareil",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("devrait envoyer un PUSH sans email", async () => {
    const res = await request(app).post("/notifications/alert").send({
      userId: "usr-1",
      alertType: "CONNEXION_SUSPECTE",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("devrait utiliser un message par défaut sans details", async () => {
    await request(app).post("/notifications/alert").send({
      userId: "usr-1",
      email: "client@bank.fr",
      alertType: "CONNEXION_SUSPECTE",
    });

    const list = await request(app).get("/notifications");
    expect(list.body.data[0].message).toContain("Activité suspecte");
  });

  it("devrait retourner 400 si des champs requis sont manquants", async () => {
    const res = await request(app)
      .post("/notifications/alert")
      .send({ userId: "usr-1" });

    expect(res.status).toBe(400);
  });
});
