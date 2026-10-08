import { describe, expect, it } from "vitest";
import { createGenerationSchema, validateModelRequest } from "./generation.js";
const valid = { modelId: "seedance-2.0", prompt: "Test", duration: 5, resolution: "720p", aspectRatio: "16:9", generateAudio: true, referenceImageAssetIds: [], referenceVideoAssetIds: [], referenceAudioAssetIds: [] };
describe("Seedance validation", () => {
  it("accepts the baseline contract", () => expect(() => validateModelRequest(createGenerationSchema.parse(valid))).not.toThrow());
  it("accepts a 30-second generation on a model that allows it", () => expect(() => validateModelRequest(createGenerationSchema.parse({ ...valid, modelId: "wan-3.0", duration: 30 }))).not.toThrow());
  it("accepts synchronized audio on every model", () => expect(() => validateModelRequest(createGenerationSchema.parse({ ...valid, modelId: "minimax-h3", resolution: "768P", aspectRatio: "16:9", generateAudio: true }))).not.toThrow());
  it("rejects a duration past the model's maximum", () => expect(() => validateModelRequest(createGenerationSchema.parse({ ...valid, duration: 30 }))).toThrow(/supported duration/i));
  it("does not accept intelligent duration", () => expect(() => validateModelRequest(createGenerationSchema.parse({ ...valid, duration: -1 }))).toThrow(/supported duration/i));
  it("requires a first frame with the last frame", () => expect(() => validateModelRequest(createGenerationSchema.parse({ ...valid, lastFrameAssetId: crypto.randomUUID() }))).toThrow(/first frame/i));
  it("requires visual context for reference audio", () => expect(() => validateModelRequest(createGenerationSchema.parse({ ...valid, referenceAudioAssetIds: [crypto.randomUUID()] }))).toThrow(/requires at least one/i));
});
