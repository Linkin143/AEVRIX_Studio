import fs from "node:fs/promises";
import type { ProviderAsset, ProviderGenerationRequest } from "../provider.interface.js";

async function toDataUri(asset?: ProviderAsset) {
  if (!asset) return undefined;
  const data = await fs.readFile(asset.storagePath);
  return `data:${asset.mimeType};base64,${data.toString("base64")}`;
}
export async function mapSeedanceInput(request: ProviderGenerationRequest) {
  const input: Record<string, unknown> = {
    prompt: request.prompt, duration: request.duration, resolution: request.resolution,
    aspect_ratio: request.aspectRatio, generate_audio: request.generateAudio,
  };
  if (request.seed !== undefined) input.seed = request.seed;
  const image = await toDataUri(request.image); if (image) input.image = image;
  const lastFrame = await toDataUri(request.lastFrame); if (lastFrame) input.last_frame_image = lastFrame;
  if (request.referenceImages.length) input.reference_images = await Promise.all(request.referenceImages.map(toDataUri));
  if (request.referenceVideos.length) input.reference_videos = await Promise.all(request.referenceVideos.map(toDataUri));
  if (request.referenceAudio.length) input.reference_audios = await Promise.all(request.referenceAudio.map(toDataUri));
  return input;
}
export async function mapMinimaxInput(request: ProviderGenerationRequest) {
  const input: Record<string, unknown> = { prompt: request.prompt, prompt_optimizer: true };
  const image = await toDataUri(request.image); if (image) input.first_frame_image = image;
  return input;
}
export async function mapWanInput(request: ProviderGenerationRequest) {
  // alibaba/wan-3 is text/first-frame only: no references or last frame. It
  // produces audio automatically (no generate_audio input — sending one errors).
  const input: Record<string, unknown> = {
    prompt: request.prompt, duration: request.duration, resolution: request.resolution,
    aspect_ratio: request.aspectRatio,
  };
  if (request.seed !== undefined) input.seed = request.seed;
  const image = await toDataUri(request.image); if (image) input.image = image;
  return input;
}
export async function mapMinimaxH3Input(request: ProviderGenerationRequest) {
  // minimax/h3 takes first/last frame + reference *_urls arrays; no seed input.
  // Audio is produced automatically (no generate_audio input to send).
  const input: Record<string, unknown> = {
    prompt: request.prompt, duration: request.duration, resolution: request.resolution,
    ratio: request.aspectRatio,
  };
  const image = await toDataUri(request.image); if (image) input.first_frame_image = image;
  const lastFrame = await toDataUri(request.lastFrame); if (lastFrame) input.last_frame_image = lastFrame;
  if (request.referenceImages.length) input.reference_image_urls = await Promise.all(request.referenceImages.map(toDataUri));
  if (request.referenceVideos.length) input.reference_video_urls = await Promise.all(request.referenceVideos.map(toDataUri));
  if (request.referenceAudio.length) input.reference_audio_urls = await Promise.all(request.referenceAudio.map(toDataUri));
  return input;
}
export async function mapProviderInput(request: ProviderGenerationRequest) {
  if (request.model.startsWith("minimax/video")) return mapMinimaxInput(request);
  if (request.model.startsWith("minimax/h3")) return mapMinimaxH3Input(request);
  if (request.model.startsWith("wan-video/") || request.model.startsWith("alibaba/wan")) return mapWanInput(request);
  return mapSeedanceInput(request);
}
