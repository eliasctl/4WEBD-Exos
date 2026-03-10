const request = require("supertest");
const app = require("../index");

describe("Notification Load Balancer", () => {
  it("should respond to health check", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "ok");
  });
});
