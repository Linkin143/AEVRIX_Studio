import type { CostEstimate } from "@aevrix/shared-types";

const perSecond: Record<string, Record<string, number>> = {
  "seedance-2.0": { "480p": 0.04, "720p": 0.08, "768p": 0.09, "1080p": 0.14, "2K": 0.2, "4K": 0.28 },
  "seedance-2.5": { "480p": 0.05, "720p": 0.09, "768p": 0.1, "1080p": 0.16, "2K": 0.23, "4K": 0.32 },
  "minimax-h3": { "480p": 0.04, "720p": 0.07, "768p": 0.08, "1080p": 0.13, "2K": 0.19, "4K": 0.27 },
  "wan-3.0": { "480p": 0.03, "720p": 0.06, "768p": 0.07, "1080p": 0.11, "2K": 0.17, "4K": 0.25 },
};
export function estimateCost(modelId: string, resolution: string, duration: number): CostEstimate {
  const rate = perSecond[modelId]?.[resolution];
  if (!rate) return { credits: 0, providerCost: null, label: "Pricing unavailable" };
  const providerCost = Number((rate * duration).toFixed(2));
  return { credits: Math.ceil(providerCost * 100), providerCost, label: "Estimated" };
}
