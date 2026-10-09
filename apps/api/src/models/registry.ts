import type { ModelDefinition } from "@aevrix/shared-types";

// Resolutions, aspect ratios and durations below are verified against
// Replicate's live input schemas (see scripts/validate-models.mjs). Only
// values the model actually accepts are listed, so the UI never offers an
// option that would make a paid generation fail. This registry is the single
// source of truth for both the web form and the server-side validator.
export const MODEL_REGISTRY: Record<string, ModelDefinition> = {
  "seedance-2.5": {
    id: "seedance-2.5", displayName: "Seedance 2.5", provider: "replicate",
    providerModel: process.env.REPLICATE_SEEDANCE_25_MODEL || "bytedance/seedance-2.5", type: "video", enabled: true,
    description: "Latest Seedance generation with multimodal references and synchronized audio.",
    capabilities: { textToVideo: true, imageToVideo: true, firstLastFrame: true, referenceImages: true, referenceVideos: true, referenceAudio: true, nativeAudio: true, intelligentDuration: false, adaptiveAspectRatio: true },
    resolutions: ["480p", "720p"],
    aspectRatios: ["adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    durations: [5, 10, 15, 30], minDuration: 4, maxDuration: 30,
    maxReferenceImages: 30, maxReferenceVideos: 10, maxReferenceAudio: 10,
  },
  "seedance-2.0": {
    id: "seedance-2.0", displayName: "Seedance 2.0", provider: "replicate",
    providerModel: "bytedance/seedance-2.0", type: "video", enabled: true,
    description: "Cinematic video generation with native audio and multimodal references.",
    capabilities: { textToVideo: true, imageToVideo: true, firstLastFrame: true, referenceImages: true, referenceVideos: true, referenceAudio: true, nativeAudio: true, intelligentDuration: false, adaptiveAspectRatio: true },
    resolutions: ["480p", "720p", "1080p", "4k"],
    aspectRatios: ["adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    durations: [5, 10, 15], minDuration: 4, maxDuration: 15,
    maxReferenceImages: 9, maxReferenceVideos: 3, maxReferenceAudio: 3,
    maxPromptChars: 4000, // ByteDance documents a 4000-char cap for Seedance 2.0 only.
  },
  "minimax-h3": {
    id: "minimax-h3", displayName: "MiniMax H3", provider: "replicate",
    providerModel: process.env.REPLICATE_MINIMAX_H3_MODEL || "minimax/h3", type: "video", enabled: true,
    description: "Expressive cinematic generation with first/last frame control, multimodal references and native audio.",
    capabilities: { textToVideo: true, imageToVideo: true, firstLastFrame: true, referenceImages: true, referenceVideos: true, referenceAudio: true, nativeAudio: true, intelligentDuration: false, adaptiveAspectRatio: false },
    resolutions: ["768P", "2K"],
    aspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    durations: [5, 10, 15], minDuration: 4, maxDuration: 15,
    maxReferenceImages: 9, maxReferenceVideos: 3, maxReferenceAudio: 3,
  },
  "wan-3.0": {
    id: "wan-3.0", displayName: "WAN 3.0", provider: "replicate",
    providerModel: process.env.REPLICATE_WAN_30_MODEL || "alibaba/wan-3", type: "video", enabled: true,
    description: "High-detail general video generation for cinematic and social formats, from text or a first-frame image, with native audio.",
    capabilities: { textToVideo: true, imageToVideo: true, firstLastFrame: false, referenceImages: false, referenceVideos: false, referenceAudio: false, nativeAudio: true, intelligentDuration: false, adaptiveAspectRatio: true },
    resolutions: ["480p", "720p", "1080p"],
    aspectRatios: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"],
    durations: [5, 10, 15, 30], minDuration: 2, maxDuration: 30,
    maxReferenceImages: 0, maxReferenceVideos: 0, maxReferenceAudio: 0,
  },
};
