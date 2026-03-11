process.env.DB_PATH = ":memory:";

const request = require("supertest");
const app = require("../index");
const db = require("../db");

let adminToken, userToken, adminId, userId;

beforeEach(async () => {
  db._resetForTest();

  const adminReg = await request(app).post("/auth/register").send({
    firstName: "Admin",
    lastName: "User",
    email: "admin@bank.fr",
    password: "admin123",
    role: "ADMIN",
  });
  adminId = adminReg.body.id;

  const adminLogin = await request(app)
    .post("/auth/login")
    .send({ email: "admin@bank.fr", password: "admin123" });
  adminToken = adminLogin.body.token;

  const userReg = await request(app).post("/auth/register").send({
    firstName: "Jean",
    lastName: "Martin",
    email: "jean@bank.fr",
    password: "password123",
  });
  userId = userReg.body.id;

  const userLogin = await request(app)
    .post("/auth/login")
    .send({ email: "jean@bank.fr", password: "password123" });
  userToken = userLogin.body.token;
});

describe("GET /users", () => {
  it("devrait retourner les utilisateurs paginés pour un admin", async () => {
    const res = await request(app)
      .get("/users")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pagination");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
  });

  it("devrait supporter les paramètres de pagination", async () => {
    const res = await request(app)
      .get("/users?page=1&limit=1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.pagination.totalPages).toBe(2);
    expect(res.body.pagination.hasNext).toBe(true);
  });

  it("devrait retourner 403 pour un non-admin", async () => {
    const res = await request(app)
      .get("/users")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it("devrait retourner 401 sans token", async () => {
    const res = await request(app).get("/users");

    expect(res.status).toBe(401);
  });
});

describe("GET /users/:id", () => {
  it("devrait permettre à un utilisateur de voir son propre profil", async () => {
    const res = await request(app)
      .get(`/users/${userId}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(userId);
    expect(res.body).not.toHaveProperty("password");
  });

  it("devrait permettre à un admin de voir n'importe quel profil", async () => {
    const res = await request(app)
      .get(`/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(userId);
  });

  it("devrait retourner 403 pour un utilisateur consultant un autre profil", async () => {
    const res = await request(app)
      .get(`/users/${adminId}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it("devrait retourner 404 pour un utilisateur inexistant", async () => {
    const res = await request(app)
      .get("/users/usr-999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

describe("PUT /users/:id", () => {
  it("devrait permettre à un utilisateur de modifier son profil", async () => {
    const res = await request(app)
      .put(`/users/${userId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ firstName: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe("Updated");
  });

  it("devrait permettre à un admin de modifier n'importe quel profil", async () => {
    const res = await request(app)
      .put(`/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ lastName: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.lastName).toBe("Updated");
  });

  it("devrait retourner 403 pour modifier le profil d'un autre", async () => {
    const res = await request(app)
      .put(`/users/${adminId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ firstName: "Hacked" });

    expect(res.status).toBe(403);
  });

  it("devrait retourner 404 pour un utilisateur inexistant", async () => {
    const res = await request(app)
      .put("/users/usr-999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ firstName: "Ghost" });

    expect(res.status).toBe(404);
  });

  it("devrait retourner 400 si l'email est déjà pris", async () => {
    const res = await request(app)
      .put(`/users/${userId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ email: "admin@bank.fr" });

    expect(res.status).toBe(400);
  });

  it("devrait permettre de changer le mot de passe", async () => {
    await request(app)
      .put(`/users/${userId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ password: "newpassword123" });

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "jean@bank.fr", password: "newpassword123" });

    expect(loginRes.status).toBe(200);
  });
});

describe("DELETE /users/:id", () => {
  it("devrait permettre à un admin de supprimer un utilisateur", async () => {
    const res = await request(app)
      .delete(`/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("devrait retourner 403 pour un non-admin", async () => {
    const res = await request(app)
      .delete(`/users/${adminId}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it("devrait retourner 404 pour un utilisateur inexistant", async () => {
    const res = await request(app)
      .delete("/users/usr-999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
