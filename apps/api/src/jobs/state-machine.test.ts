import { describe, expect, it } from "vitest";
import { canTransition } from "./state-machine.js";
describe("generation state machine", () => {
  it("allows normal progress", () => expect(canTransition("STARTING", "PROCESSING")).toBe(true));
  it("allows direct provider completion", () => expect(canTransition("STARTING", "SUCCEEDED")).toBe(true));
  it("does not regress terminal jobs", () => expect(canTransition("SUCCEEDED", "PROCESSING")).toBe(false));
  it("does not regress processing jobs", () => expect(canTransition("PROCESSING", "STARTING")).toBe(false));
});
