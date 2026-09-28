import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiClientError } from "./api";

afterEach(() => vi.restoreAllMocks());
describe("API client", () => {
  it("unwraps successful responses", async () => { vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data: { status: "ok" } }), { status: 200 }))); await expect(api("/health")).resolves.toEqual({ status: "ok" }); });
  it("preserves actionable backend errors", async () => { vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: false, error: { code: "INVALID_DURATION", message: "Duration is invalid" } }), { status: 400 }))); await expect(api("/generations")).rejects.toMatchObject<ApiClientError>({ code: "INVALID_DURATION", message: "Duration is invalid" }); });
});
