import { describe, expect, it } from "vitest";
import { GENERATION_STATUSES } from "./index.js";
describe("shared generation contract", () => { it("contains every terminal state", () => expect(GENERATION_STATUSES).toEqual(expect.arrayContaining(["SUCCEEDED", "FAILED", "CANCELED"]))); });
