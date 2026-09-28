import type { GenerationStatus } from "@aevrix/shared-types";

const transitions: Record<GenerationStatus, GenerationStatus[]> = {
  DRAFT: ["QUEUED", "CANCELED"],
  QUEUED: ["STARTING", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELED"],
  STARTING: ["PROCESSING", "SUCCEEDED", "FAILED", "CANCELED"],
  PROCESSING: ["SUCCEEDED", "FAILED", "CANCELED"],
  SUCCEEDED: [], FAILED: [], CANCELED: [],
};
export function canTransition(from: string, to: GenerationStatus) {
  return from === to || (transitions[from as GenerationStatus]?.includes(to) ?? false);
}
