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
  const lastFrame = await toDataUri(request.lastFrame); if (lastFrame) input.last_frame = lastFrame;
  if (request.referenceImages.length) input.reference_images = await Promise.all(request.referenceImages.map(toDataUri));
  if (request.referenceVideos.length) input.reference_videos = await Promise.all(request.referenceVideos.map(toDataUri));
  if (request.referenceAudio.length) input.reference_audios = await Promise.all(request.referenceAudio.map(toDataUri));
  return input;
}
