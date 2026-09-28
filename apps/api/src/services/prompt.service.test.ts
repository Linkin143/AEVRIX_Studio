import { describe, expect, it } from "vitest";
import { enhancePrompt } from "./prompt.service.js";
describe("enhancePrompt", () => { it("keeps the raw prompt visible", () => { const result = enhancePrompt({ prompt: "A red car", camera: "slow orbit" }); expect(result).toContain("A red car"); expect(result).toContain("Camera: slow orbit"); }); });
