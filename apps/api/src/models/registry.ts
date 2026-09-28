import type { ModelDefinition } from "@aevrix/shared-types";

export const MODEL_REGISTRY: Record<string, ModelDefinition> = {
  "seedance-2.0": {
    id: "seedance-2.0", displayName: "Seedance 2.0", provider: "replicate",
    providerModel: "bytedance/seedance-2.0", type: "video", enabled: true,
    description: "Cinematic video generation with native audio and multimodal references.",
    capabilities: { textToVideo: true, imageToVideo: true, firstLastFrame: true, referenceImages: true, referenceVideos: true, referenceAudio: true, nativeAudio: true, intelligentDuration: false, adaptiveAspectRatio: true },
    resolutions: ["480p", "720p", "768p", "1080p", "2K", "4K"],
    aspectRatios: ["16:9", "9:16", "1:1", "4:5", "5:4", "3:4", "4:3", "2:3", "3:2", "1.91:1", "16:10", "21:9", "adaptive"],
    durations: [5, 7, 10, 15, 20, 30], minDuration: 5, maxDuration: 30,
  },
  "seedance-2.5": {
    id: "seedance-2.5", displayName: "Seedance 2.5", provider: "replicate",
    providerModel: process.env.REPLICATE_SEEDANCE_25_MODEL || "bytedance/seedance-2.5", type: "video", enabled: true,
    description: "Latest Seedance generation with multimodal references and synchronized audio.",
    capabilities: { textToVideo: true, imageToVideo: true, firstLastFrame: true, referenceImages: true, referenceVideos: true, referenceAudio: true, nativeAudio: true, intelligentDuration: false, adaptiveAspectRatio: true },
    resolutions: ["480p", "720p", "768p", "1080p", "2K", "4K"],
    aspectRatios: ["16:9", "9:16", "1:1", "4:5", "5:4", "3:4", "4:3", "2:3", "3:2", "1.91:1", "16:10", "21:9", "adaptive"],
    durations: [5, 7, 10, 15, 20, 30], minDuration: 5, maxDuration: 30,
  },
  "minimax-h3": {
    id: "minimax-h3", displayName: "MiniMax H3", provider: "replicate",
    providerModel: process.env.REPLICATE_MINIMAX_H3_MODEL || "minimax/h3", type: "video", enabled: true,
    description: "Expressive cinematic generation with strong character motion and audio support.",
    capabilities: { textToVideo: true, imageToVideo: true, firstLastFrame: false, referenceImages: false, referenceVideos: false, referenceAudio: false, nativeAudio: true, intelligentDuration: false, adaptiveAspectRatio: false },
    resolutions: ["480p", "720p", "768p", "1080p", "2K", "4K"],
    aspectRatios: ["16:9", "9:16", "1:1", "4:5", "5:4", "3:4", "4:3", "2:3", "3:2", "1.91:1", "16:10", "21:9"],
    durations: [5, 7, 10, 15, 20, 30], minDuration: 5, maxDuration: 30,
  },
  "wan-3.0": {
    id: "wan-3.0", displayName: "WAN 3.0", provider: "replicate",
    providerModel: process.env.REPLICATE_WAN_30_MODEL || "wan-video/wan-3.0", type: "video", enabled: true,
    description: "High-detail general video generation for cinematic and social formats.",
    capabilities: { textToVideo: true, imageToVideo: true, firstLastFrame: false, referenceImages: false, referenceVideos: false, referenceAudio: false, nativeAudio: false, intelligentDuration: false, adaptiveAspectRatio: false },
    resolutions: ["480p", "720p", "768p", "1080p", "2K", "4K"],
    aspectRatios: ["16:9", "9:16", "1:1", "4:5", "5:4", "3:4", "4:3", "2:3", "3:2", "1.91:1", "16:10", "21:9"],
    durations: [5, 7, 10, 15, 20, 30], minDuration: 5, maxDuration: 30,
  },
};
