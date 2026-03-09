process.env.DB_PATH = ":memory:";

const request = require("supertest");
const app = require("../index");
const db = require("../db");

beforeEach(() => {
  db._resetForTest();
});

describe("POST /auth/register", () => {
  it("devrait créer un nouvel utilisateur", async () => {
    const res = await request(app).post("/auth/register").send({
      firstName: "Jean",
      lastName: "Martin",
      email: "jean@bank.fr",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.firstName).toBe("Jean");
    expect(res.body.email).toBe("jean@bank.fr");
    expect(res.body).not.toHaveProperty("password");
  });

  it("devrait retourner 400 si des champs sont manquants", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ firstName: "Jean" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("devrait retourner 400 si l'email est déjà utilisé", async () => {
    await request(app).post("/auth/register").send({
      firstName: "Jean",
      lastName: "Martin",
      email: "jean@bank.fr",
      password: "password123",
    });

    const res = await request(app).post("/auth/register").send({
      firstName: "Pierre",
      lastName: "Dupont",
      email: "jean@bank.fr",
      password: "password456",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it("devrait assigner le rôle USER par défaut", async () => {
    const res = await request(app).post("/auth/register").send({
      firstName: "Jean",
      lastName: "Martin",
      email: "jean@bank.fr",
      password: "password123",
    });

    expect(res.body.role).toBe("USER");
  });

  it("devrait permettre de définir le rôle ADMIN", async () => {
    const res = await request(app).post("/auth/register").send({
      firstName: "Admin",
      lastName: "User",
      email: "admin@bank.fr",
      password: "password123",
      role: "ADMIN",
    });

    expect(res.body.role).toBe("ADMIN");
  });
});

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/auth/register").send({
      firstName: "Jean",
      lastName: "Martin",
      email: "jean@bank.fr",
      password: "password123",
    });
  });

  it("devrait retourner un token JWT après connexion", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "jean@bank.fr", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user).not.toHaveProperty("password");
  });

  it("devrait retourner 400 si des champs sont manquants", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "jean@bank.fr" });

    expect(res.status).toBe(400);
  });

  it("devrait retourner 401 pour un email inconnu", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "wrong@bank.fr", password: "password123" });

    expect(res.status).toBe(401);
  });

  it("devrait retourner 401 pour un mot de passe incorrect", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "jean@bank.fr", password: "wrongpassword" });

    expect(res.status).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("devrait retourner le profil de l'utilisateur connecté", async () => {
    await request(app).post("/auth/register").send({
      firstName: "Jean",
      lastName: "Martin",
      email: "jean@bank.fr",
      password: "password123",
    });

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "jean@bank.fr", password: "password123" });

    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("jean@bank.fr");
    expect(res.body).not.toHaveProperty("password");
  });

  it("devrait retourner 401 sans token", async () => {
    const res = await request(app).get("/auth/me");

    expect(res.status).toBe(401);
  });

  it("devrait retourner 401 avec un token invalide", async () => {
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", "Bearer invalidtoken");

    expect(res.status).toBe(401);
  });
});
