import { beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("./database/client.js", () => ({ prisma: { $queryRaw: vi.fn(async () => [1]) } }));
let app: import("express").Express;
beforeAll(async () => { process.env.ENABLE_MOCK_PROVIDER = "true"; app = (await import("./app.js")).app; });
describe("API", () => {
  it("returns an envelope and safe health state", async () => { const response = await request(app).get("/api/health"); expect(response.status).toBe(200); expect(response.body.success).toBe(true); expect(response.body.data).not.toHaveProperty("token"); });
  it("serves the capability registry", async () => { const response = await request(app).get("/api/models"); expect(response.status).toBe(200); expect(response.body.data[0].id).toBe("seedance-2.0"); });
  it("returns structured 404 errors", async () => { const response = await request(app).get("/api/unknown"); expect(response.status).toBe(404); expect(response.body.error.code).toBe("NOT_FOUND"); });
});
