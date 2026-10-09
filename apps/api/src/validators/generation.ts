import { z } from "zod";
import { MODEL_REGISTRY } from "../models/registry.js";
import { AppError } from "../middleware/errors.js";

export const createGenerationSchema = z.object({
  modelId: z.string(), prompt: z.string().trim().min(1).max(200000), enhancedPrompt: z.string().max(201000).optional(),
  duration: z.number().int(), resolution: z.string(), aspectRatio: z.string(), generateAudio: z.boolean(),
  seed: z.number().int().min(0).max(2147483647).optional(), imageAssetId: z.string().uuid().optional(),
  lastFrameAssetId: z.string().uuid().optional(), referenceImageAssetIds: z.array(z.string().uuid()).max(30).default([]),
  referenceVideoAssetIds: z.array(z.string().uuid()).max(10).default([]), referenceAudioAssetIds: z.array(z.string().uuid()).max(10).default([]),
  presetId: z.string().optional(), idempotencyKey: z.string().min(8).max(100).optional(),
});

export function validateModelRequest(data: z.infer<typeof createGenerationSchema>) {
  const model = MODEL_REGISTRY[data.modelId];
  if (!model?.enabled) throw new AppError(400, "MODEL_UNAVAILABLE", "The selected model is not available.");
  if (model.maxPromptChars && data.prompt.length > model.maxPromptChars) throw new AppError(400, "PROMPT_TOO_LONG", `${model.displayName} supports prompts up to ${model.maxPromptChars} characters.`);
  if (!Number.isInteger(data.duration) || data.duration < model.minDuration || data.duration > model.maxDuration) throw new AppError(400, "INVALID_DURATION", `Choose a supported duration between ${model.minDuration} and ${model.maxDuration} seconds.`);
  if (!model.resolutions.includes(data.resolution)) throw new AppError(400, "INVALID_RESOLUTION", "The selected resolution is not supported.");
  if (!model.aspectRatios.includes(data.aspectRatio)) throw new AppError(400, "INVALID_ASPECT_RATIO", "The selected aspect ratio is not supported.");
  if (data.imageAssetId && !model.capabilities.imageToVideo) throw new AppError(400, "UNSUPPORTED_CAPABILITY", `${model.displayName} does not support image-to-video.`);
  if (data.lastFrameAssetId && !model.capabilities.firstLastFrame) throw new AppError(400, "UNSUPPORTED_CAPABILITY", `${model.displayName} does not support last-frame guidance.`);
  if (data.referenceImageAssetIds.length && !model.capabilities.referenceImages) throw new AppError(400, "UNSUPPORTED_CAPABILITY", `${model.displayName} does not support reference images.`);
  if (data.referenceImageAssetIds.length > model.maxReferenceImages) throw new AppError(400, "TOO_MANY_REFERENCES", `${model.displayName} supports up to ${model.maxReferenceImages} reference images.`);
  if (data.referenceVideoAssetIds.length && !model.capabilities.referenceVideos) throw new AppError(400, "UNSUPPORTED_CAPABILITY", `${model.displayName} does not support reference videos.`);
  if (data.referenceVideoAssetIds.length > model.maxReferenceVideos) throw new AppError(400, "TOO_MANY_REFERENCES", `${model.displayName} supports up to ${model.maxReferenceVideos} reference videos.`);
  if (data.referenceAudioAssetIds.length && !model.capabilities.referenceAudio) throw new AppError(400, "UNSUPPORTED_CAPABILITY", `${model.displayName} does not support reference audio.`);
  if (data.referenceAudioAssetIds.length > model.maxReferenceAudio) throw new AppError(400, "TOO_MANY_REFERENCES", `${model.displayName} supports up to ${model.maxReferenceAudio} reference audio tracks.`);
  if (data.generateAudio && !model.capabilities.nativeAudio) throw new AppError(400, "UNSUPPORTED_CAPABILITY", `${model.displayName} does not support synchronized audio.`);
  if (data.lastFrameAssetId && !data.imageAssetId) throw new AppError(400, "FIRST_FRAME_REQUIRED", "A first frame is required when a last frame is selected.");
  if ((data.imageAssetId || data.lastFrameAssetId) && data.referenceImageAssetIds.length) throw new AppError(400, "REFERENCE_CONFLICT", "First/last frames cannot be combined with reference images.");
  if (data.referenceAudioAssetIds.length && !data.referenceImageAssetIds.length && !data.referenceVideoAssetIds.length) throw new AppError(400, "AUDIO_REFERENCE_CONTEXT_REQUIRED", "Reference audio requires at least one reference image or video.");
  return model;
}
