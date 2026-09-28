import { describe, expect, it } from "vitest";
import { mapSeedanceInput } from "./replicate.mapper.js";
describe("Seedance provider mapper", () => { it("maps provider-independent names", async () => { const output = await mapSeedanceInput({ model: "bytedance/seedance-2.0", prompt: "Scene", duration: 5, resolution: "720p", aspectRatio: "16:9", generateAudio: true, referenceImages: [], referenceVideos: [], referenceAudio: [] }); expect(output).toMatchObject({ prompt: "Scene", aspect_ratio: "16:9", generate_audio: true }); }); });
