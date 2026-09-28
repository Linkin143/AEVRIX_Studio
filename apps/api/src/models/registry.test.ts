import { describe, expect, it } from "vitest";
import { MODEL_REGISTRY } from "./registry.js";

describe("model registry", () => {
  it("contains all selectable studio models", () => expect(Object.keys(MODEL_REGISTRY)).toEqual(expect.arrayContaining(["seedance-2.5", "seedance-2.0", "minimax-h3", "wan-3.0"])));
  it("exposes the requested duration and resolution options", () => {
    for (const model of Object.values(MODEL_REGISTRY)) {
      expect(model.durations).toEqual([5, 7, 10, 15, 20, 30]);
      expect(model.resolutions).toEqual(expect.arrayContaining(["480p", "720p", "768p", "1080p", "2K", "4K"]));
      expect(model.capabilities.intelligentDuration).toBe(false);
    }
  });
  it("covers common YouTube, Instagram, and LinkedIn formats", () => expect(MODEL_REGISTRY["seedance-2.5"].aspectRatios).toEqual(expect.arrayContaining(["16:9", "9:16", "1:1", "4:5", "1.91:1"])));
});
