export const GENERATION_STATUSES = [
  "DRAFT", "QUEUED", "STARTING", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELED",
] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];
export type AssetType = "IMAGE" | "VIDEO" | "AUDIO";
export type AssetRole = "INPUT_IMAGE" | "LAST_FRAME" | "REFERENCE_IMAGE" | "REFERENCE_VIDEO" | "REFERENCE_AUDIO";

export interface ModelCapabilities {
  textToVideo: boolean; imageToVideo: boolean; firstLastFrame: boolean;
  referenceImages: boolean; referenceVideos: boolean; referenceAudio: boolean;
  nativeAudio: boolean; intelligentDuration: boolean; adaptiveAspectRatio: boolean;
}
export interface ModelDefinition {
  id: string; displayName: string; provider: string; providerModel: string; type: "video";
  description: string; capabilities: ModelCapabilities; resolutions: string[];
  aspectRatios: string[]; durations: number[]; minDuration: number; maxDuration: number;
  maxReferenceImages: number; maxReferenceVideos: number; maxReferenceAudio: number; enabled: boolean;
  // Hard prompt character cap. Only set where the provider documents one
  // (Seedance 2.0 = 4000). Omitted/undefined means no documented limit.
  maxPromptChars?: number;
}
export interface Asset {
  id: string; type: AssetType; originalName: string; mimeType: string; sizeBytes: number;
  width: number | null; height: number | null; duration: number | null; createdAt: string; url: string;
}
export interface CreateGenerationRequest {
  modelId: string; prompt: string; enhancedPrompt?: string; duration: number; resolution: string;
  aspectRatio: string; generateAudio: boolean; seed?: number; imageAssetId?: string;
  lastFrameAssetId?: string; referenceImageAssetIds?: string[]; referenceVideoAssetIds?: string[];
  referenceAudioAssetIds?: string[]; presetId?: string; idempotencyKey?: string;
}
export interface Generation {
  id: string; modelId: string; provider: string; providerGenerationId: string | null;
  prompt: string; enhancedPrompt: string | null; duration: number; resolution: string;
  aspectRatio: string; generateAudio: boolean; seed: number | null; status: GenerationStatus;
  progress: number; estimatedCost: number | null; actualCost: number | null; creditsReserved: number;
  creditsUsed: number; outputUrl: string | null; thumbnailUrl: string | null; errorMessage: string | null;
  favorite: boolean; parentGenerationId: string | null; createdAt: string; startedAt: string | null;
  completedAt: string | null; canceledAt: string | null; assets?: Array<Asset & { role: AssetRole; referenceIndex: number | null }>;
}
export interface Paginated<T> { items: T[]; page: number; limit: number; total: number; totalPages: number }
export interface ApiSuccess<T> { success: true; data: T }
export interface ApiError { success: false; error: { code: string; message: string; details?: unknown } }
export interface Health { status: "ok" | "degraded"; database: "ok" | "error"; storage: "ok" | "error"; replicate: "configured" | "not_configured" | "mock" }
export interface Settings {
  replicateConfigured: boolean; mockMode: boolean; storageDirectory: string; databaseUrl: string;
  maxConcurrentGenerations: number; pollingIntervalMs: number; webhookMode: "auto" | "enabled" | "disabled";
}
export interface Stats { total: number; completed: number; processing: number; failed: number; creditsUsed: number; favoriteModel: string | null; balance: number; reserved: number }
export interface CostEstimate { credits: number; providerCost: number | null; label: "Estimated" | "Pricing unavailable" }
export interface Preset { id: string; name: string; description: string; modelId: string; aspectRatio: string; duration: number; resolution: string; promptModifier: string; generateAudio: boolean }
