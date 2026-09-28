import { describe, expect, it } from "vitest";
import { createGenerationSchema, validateModelRequest } from "./generation.js";
const valid = { modelId: "seedance-2.0", prompt: "Test", duration: 5, resolution: "720p", aspectRatio: "16:9", generateAudio: true, referenceImageAssetIds: [], referenceVideoAssetIds: [], referenceAudioAssetIds: [] };
describe("Seedance validation", () => {
  it("accepts the baseline contract", () => expect(() => validateModelRequest(createGenerationSchema.parse(valid))).not.toThrow());
  it("accepts a 30-second generation", () => expect(() => validateModelRequest(createGenerationSchema.parse({ ...valid, duration: 30 }))).not.toThrow());
  it("does not accept intelligent duration", () => expect(() => validateModelRequest(createGenerationSchema.parse({ ...valid, duration: -1 }))).toThrow(/supported duration/i));
  it("requires a first frame with the last frame", () => expect(() => validateModelRequest(createGenerationSchema.parse({ ...valid, lastFrameAssetId: crypto.randomUUID() }))).toThrow(/first frame/i));
  it("requires visual context for reference audio", () => expect(() => validateModelRequest(createGenerationSchema.parse({ ...valid, referenceAudioAssetIds: [crypto.randomUUID()] }))).toThrow(/requires at least one/i));
});
