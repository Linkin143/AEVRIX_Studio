export interface ProviderAsset { id: string; mimeType: string; storagePath: string; duration: number | null }
export interface ProviderGenerationRequest {
  model: string; prompt: string; duration: number; resolution: string; aspectRatio: string;
  generateAudio: boolean; seed?: number; image?: ProviderAsset; lastFrame?: ProviderAsset;
  referenceImages: ProviderAsset[]; referenceVideos: ProviderAsset[]; referenceAudio: ProviderAsset[];
  webhookUrl?: string;
}
export type ProviderStatusName = "starting" | "processing" | "succeeded" | "failed" | "canceled";
export interface ProviderGenerationResult { id: string; status: ProviderStatusName }
export interface ProviderGenerationStatus { id: string; status: ProviderStatusName; outputUrl?: string; localOutputPath?: string; error?: string; progress?: number }
export interface VideoProvider {
  createGeneration(request: ProviderGenerationRequest): Promise<ProviderGenerationResult>;
  getGeneration(id: string): Promise<ProviderGenerationStatus>;
  cancelGeneration(id: string): Promise<void>;
  testConnection(): Promise<boolean>;
  supportsWebhook(): boolean;
}
