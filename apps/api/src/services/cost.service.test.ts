import { describe, expect, it } from "vitest";
import { estimateCost } from "./cost.service.js";
describe("estimateCost", () => {
  it("uses configured model rates", () => expect(estimateCost("seedance-2.0", "720p", 10)).toEqual({ credits: 180, providerCost: 1.8, label: "Estimated" }));
  it("prices a 30-second WAN clip at its published 720p rate", () => expect(estimateCost("wan-3.0", "720p", 30).providerCost).toBe(3));
  it("prices MiniMax H3 at its published 2K rate", () => expect(estimateCost("minimax-h3", "2K", 10).providerCost).toBe(1.3));
  it("does not invent missing prices", () => expect(estimateCost("future", "720p", 5).providerCost).toBeNull());
  it("does not price resolutions a model does not offer", () => expect(estimateCost("minimax-h3", "720p", 5).providerCost).toBeNull());
});
