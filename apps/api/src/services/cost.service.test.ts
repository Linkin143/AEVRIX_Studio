import { describe, expect, it } from "vitest";
import { estimateCost } from "./cost.service.js";
describe("estimateCost", () => {
  it("uses configured model rates", () => expect(estimateCost("seedance-2.0", "720p", 10)).toEqual({ credits: 80, providerCost: 0.8, label: "Estimated" }));
  it("estimates the new 30-second duration", () => expect(estimateCost("seedance-2.0", "720p", 30).credits).toBe(240));
  it("does not invent missing prices", () => expect(estimateCost("future", "720p", 5).providerCost).toBeNull());
});
