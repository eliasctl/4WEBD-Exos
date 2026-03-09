process.env.DB_PATH = ":memory:";

const request = require("supertest");
const app = require("../index");

describe("GET /health", () => {
  it("devrait retourner le statut du service", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UP");
    expect(res.body.service).toBe("user-service");
  });
});
