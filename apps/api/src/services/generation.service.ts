import type { AssetRole, CreateGenerationRequest } from "@aevrix/shared-types";
import { prisma } from "../database/client.js";
import { AppError } from "../middleware/errors.js";
import { estimateCost } from "./cost.service.js";
import { createGenerationSchema, validateModelRequest } from "../validators/generation.js";
import { deleteIfExists } from "../storage/storage.service.js";

type ParsedRequest = ReturnType<typeof createGenerationSchema.parse>;
function links(data: ParsedRequest) {
  const result: Array<{ assetId: string; role: AssetRole; referenceIndex?: number }> = [];
  if (data.imageAssetId) result.push({ assetId: data.imageAssetId, role: "INPUT_IMAGE" });
  if (data.lastFrameAssetId) result.push({ assetId: data.lastFrameAssetId, role: "LAST_FRAME" });
  data.referenceImageAssetIds.forEach((assetId, referenceIndex) => result.push({ assetId, role: "REFERENCE_IMAGE", referenceIndex }));
  data.referenceVideoAssetIds.forEach((assetId, referenceIndex) => result.push({ assetId, role: "REFERENCE_VIDEO", referenceIndex }));
  data.referenceAudioAssetIds.forEach((assetId, referenceIndex) => result.push({ assetId, role: "REFERENCE_AUDIO", referenceIndex }));
  return result;
}
async function validateAssets(data: ParsedRequest) {
  const requested = links(data); const ids = [...new Set(requested.map((item) => item.assetId))];
  const assets = await prisma.asset.findMany({ where: { id: { in: ids } } });
  if (assets.length !== ids.length) throw new AppError(400, "ASSET_NOT_FOUND", "One or more reference assets no longer exist.");
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const expected: Record<AssetRole, string> = { INPUT_IMAGE: "IMAGE", LAST_FRAME: "IMAGE", REFERENCE_IMAGE: "IMAGE", REFERENCE_VIDEO: "VIDEO", REFERENCE_AUDIO: "AUDIO" };
  for (const item of requested) if (byId.get(item.assetId)?.type !== expected[item.role]) throw new AppError(400, "ASSET_TYPE_MISMATCH", `An asset selected for ${item.role.toLowerCase()} has the wrong media type.`);
  for (const role of ["REFERENCE_VIDEO", "REFERENCE_AUDIO"] as const) {
    const total = requested.filter((item) => item.role === role).reduce((sum, item) => sum + (byId.get(item.assetId)?.duration ?? 0), 0);
    if (total > 15) throw new AppError(400, "REFERENCE_DURATION_EXCEEDED", `${role === "REFERENCE_VIDEO" ? "Reference videos" : "Reference audio"} exceed the 15-second combined limit.`);
  }
  return requested;
}
export async function createGeneration(input: CreateGenerationRequest, parentGenerationId?: string) {
  const data = createGenerationSchema.parse(input); const model = validateModelRequest(data); const assetLinks = await validateAssets(data);
  if (data.idempotencyKey) { const existing = await prisma.generation.findUnique({ where: { idempotencyKey: data.idempotencyKey } }); if (existing) return existing; }
  const cost = estimateCost(data.modelId, data.resolution, data.duration); const id = crypto.randomUUID();
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.creditWallet.findUnique({ where: { id: "local-wallet" } });
    if (!wallet || wallet.balance < cost.credits) throw new AppError(402, "INSUFFICIENT_CREDITS", "Not enough local credits are available for this generation.");
    await tx.creditWallet.update({ where: { id: wallet.id }, data: { balance: { decrement: cost.credits }, reserved: { increment: cost.credits } } });
    const generation = await tx.generation.create({ data: { id, userId: "local-user", modelId: data.modelId, provider: model.provider, prompt: data.prompt, enhancedPrompt: data.enhancedPrompt, duration: data.duration, resolution: data.resolution, aspectRatio: data.aspectRatio, generateAudio: data.generateAudio, seed: data.seed, status: "QUEUED", estimatedCost: cost.providerCost, creditsReserved: cost.credits, idempotencyKey: data.idempotencyKey, parentGenerationId, assets: { create: assetLinks.map((item) => ({ assetId: item.assetId, role: item.role, referenceIndex: item.referenceIndex })) } } });
    await tx.creditTransaction.create({ data: { id: crypto.randomUUID(), type: "RESERVE", amount: cost.credits, generationId: id, description: `Reserved for ${model.displayName}` } });
    return generation;
  });
}
export async function releaseCredits(generationId: string, description: string) {
  await prisma.$transaction(async (tx) => {
    const generation = await tx.generation.findUnique({ where: { id: generationId } });
    if (!generation || generation.creditsReserved <= 0) return;
    await tx.creditWallet.update({ where: { id: "local-wallet" }, data: { balance: { increment: generation.creditsReserved }, reserved: { decrement: generation.creditsReserved } } });
    await tx.generation.update({ where: { id: generationId }, data: { creditsReserved: 0 } });
    await tx.creditTransaction.create({ data: { id: crypto.randomUUID(), type: "REFUND", amount: generation.creditsReserved, generationId, description } });
  });
}
export async function finalizeCredits(generationId: string) {
  await prisma.$transaction(async (tx) => {
    const generation = await tx.generation.findUnique({ where: { id: generationId } });
    if (!generation || generation.creditsReserved <= 0) return;
    await tx.creditWallet.update({ where: { id: "local-wallet" }, data: { reserved: { decrement: generation.creditsReserved } } });
    await tx.generation.update({ where: { id: generationId }, data: { creditsUsed: generation.creditsReserved, creditsReserved: 0 } });
    await tx.creditTransaction.create({ data: { id: crypto.randomUUID(), type: "CAPTURE", amount: generation.creditsReserved, generationId, description: "Generation completed" } });
  });
}
export async function getGenerationOrThrow(id: string) {
  const generation = await prisma.generation.findUnique({ where: { id }, include: { assets: { include: { asset: true }, orderBy: { referenceIndex: "asc" } } } });
  if (!generation) throw new AppError(404, "GENERATION_NOT_FOUND", "Generation not found.");
  return generation;
}
export function requestFromGeneration(generation: Awaited<ReturnType<typeof getGenerationOrThrow>>): CreateGenerationRequest {
  const role = (name: AssetRole) => generation.assets.filter((item) => item.role === name).map((item) => item.assetId);
  return { modelId: generation.modelId, prompt: generation.prompt, enhancedPrompt: generation.enhancedPrompt ?? undefined, duration: generation.duration, resolution: generation.resolution, aspectRatio: generation.aspectRatio, generateAudio: generation.generateAudio, seed: generation.seed ?? undefined, imageAssetId: role("INPUT_IMAGE")[0], lastFrameAssetId: role("LAST_FRAME")[0], referenceImageAssetIds: role("REFERENCE_IMAGE"), referenceVideoAssetIds: role("REFERENCE_VIDEO"), referenceAudioAssetIds: role("REFERENCE_AUDIO") };
}
export async function deleteGeneration(id: string) {
  const generation = await getGenerationOrThrow(id);
  if (["QUEUED", "STARTING", "PROCESSING"].includes(generation.status)) throw new AppError(409, "GENERATION_ACTIVE", "Cancel this generation before deleting it.");
  await prisma.generation.delete({ where: { id } }); await Promise.all([deleteIfExists(generation.outputPath), deleteIfExists(generation.thumbnailPath)]);
}
