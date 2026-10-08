import { describe, expect, it } from "vitest";
import { MODEL_REGISTRY } from "./registry.js";

describe("model registry", () => {
  it("contains all selectable studio models", () => expect(Object.keys(MODEL_REGISTRY)).toEqual(expect.arrayContaining(["seedance-2.5", "seedance-2.0", "minimax-h3", "wan-3.0"])));
  it("exposes only Replicate-verified resolution and duration ranges", () => {
    // Must stay in sync with the comparison sheet / live schemas (scripts/validate-models.mjs).
    expect(MODEL_REGISTRY["seedance-2.5"].resolutions).toEqual(["480p", "720p"]);
    expect(MODEL_REGISTRY["seedance-2.0"].resolutions).toEqual(["480p", "720p", "1080p", "4k"]);
    expect(MODEL_REGISTRY["minimax-h3"].resolutions).toEqual(["768P", "2K"]);
    expect(MODEL_REGISTRY["wan-3.0"].resolutions).toEqual(["480p", "720p", "1080p"]);
    expect([MODEL_REGISTRY["seedance-2.5"].minDuration, MODEL_REGISTRY["seedance-2.5"].maxDuration]).toEqual([4, 30]);
    expect([MODEL_REGISTRY["seedance-2.0"].minDuration, MODEL_REGISTRY["seedance-2.0"].maxDuration]).toEqual([4, 15]);
    expect([MODEL_REGISTRY["minimax-h3"].minDuration, MODEL_REGISTRY["minimax-h3"].maxDuration]).toEqual([4, 15]);
    expect([MODEL_REGISTRY["wan-3.0"].minDuration, MODEL_REGISTRY["wan-3.0"].maxDuration]).toEqual([2, 30]);
    for (const model of Object.values(MODEL_REGISTRY)) expect(model.capabilities.intelligentDuration).toBe(false);
  });
  it("lists only aspect ratios each model actually accepts", () => {
    expect(MODEL_REGISTRY["seedance-2.5"].aspectRatios).toEqual(["adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]);
    expect(MODEL_REGISTRY["minimax-h3"].aspectRatios).toEqual(["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]);
    expect(MODEL_REGISTRY["wan-3.0"].aspectRatios).toEqual(["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"]);
  });
  it("carries the per-model reference caps verified against live schemas", () => {
    expect([MODEL_REGISTRY["seedance-2.5"].maxReferenceImages, MODEL_REGISTRY["seedance-2.5"].maxReferenceVideos, MODEL_REGISTRY["seedance-2.5"].maxReferenceAudio]).toEqual([30, 10, 10]);
    expect([MODEL_REGISTRY["seedance-2.0"].maxReferenceImages, MODEL_REGISTRY["seedance-2.0"].maxReferenceVideos, MODEL_REGISTRY["seedance-2.0"].maxReferenceAudio]).toEqual([9, 3, 3]);
    expect([MODEL_REGISTRY["minimax-h3"].maxReferenceImages, MODEL_REGISTRY["minimax-h3"].maxReferenceVideos, MODEL_REGISTRY["minimax-h3"].maxReferenceAudio]).toEqual([9, 3, 3]);
    // WAN 3.0 (alibaba/wan-3) is text/first-frame only — no references.
    expect([MODEL_REGISTRY["wan-3.0"].maxReferenceImages, MODEL_REGISTRY["wan-3.0"].maxReferenceVideos, MODEL_REGISTRY["wan-3.0"].maxReferenceAudio]).toEqual([0, 0, 0]);
    // Native audio is enabled on every model.
    for (const model of Object.values(MODEL_REGISTRY)) expect(model.capabilities.nativeAudio).toBe(true);
  });
});
