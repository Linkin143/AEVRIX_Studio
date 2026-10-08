import type { CostEstimate } from "@aevrix/shared-types";

// Current Replicate per-second pricing (USD). The comparison sheet publishes an
// exact anchor for each model's closest-to-720p resolution (and the extra H3
// tier); other resolutions are scaled from that anchor by pixel area so the
// studio estimate tracks Replicate without inventing unlisted tiers.
//   Seedance 2.5 720p $0.2312 · Seedance 2.0 720p $0.18
//   MiniMax H3 768P $0.08 / 2K $0.13
//   WAN 3.0 (published per-second): 480p $0.05 · 720p $0.10 · 1080p $0.20
const perSecond: Record<string, Record<string, number>> = {
  "seedance-2.5": { "480p": 0.1, "720p": 0.2312 },
  "seedance-2.0": { "480p": 0.08, "720p": 0.18, "1080p": 0.41, "4k": 1.62 },
  "minimax-h3": { "768P": 0.08, "2K": 0.13 },
  "wan-3.0": { "480p": 0.05, "720p": 0.1, "1080p": 0.2 },
};
export function estimateCost(modelId: string, resolution: string, duration: number): CostEstimate {
  const rate = perSecond[modelId]?.[resolution];
  if (!rate) return { credits: 0, providerCost: null, label: "Pricing unavailable" };
  const providerCost = Number((rate * duration).toFixed(2));
  return { credits: Math.ceil(providerCost * 100), providerCost, label: "Estimated" };
}
