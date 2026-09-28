import { prisma } from "../database/client.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { MODEL_REGISTRY } from "../models/registry.js";
import { getProvider } from "../providers/provider.factory.js";
import type { ProviderAsset, ProviderGenerationRequest, ProviderGenerationStatus } from "../providers/provider.interface.js";
import { createThumbnail, materializeVideo } from "../storage/storage.service.js";
import { finalizeCredits, getGenerationOrThrow, releaseCredits } from "../services/generation.service.js";
import { canTransition } from "./state-machine.js";

class GenerationQueue {
  private pending: string[] = []; private active = new Set<string>(); private canceled = new Set<string>();
  enqueue(id: string) { if (!this.pending.includes(id) && !this.active.has(id)) { this.pending.push(id); this.drain(); } }
  async cancel(id: string) {
    this.pending = this.pending.filter((item) => item !== id); this.canceled.add(id);
    const generation = await prisma.generation.findUnique({ where: { id } });
    if (generation?.providerGenerationId) await getProvider().cancelGeneration(generation.providerGenerationId).catch((error) => logger.warn({ err: error, generationId: id }, "provider.cancel_failed"));
    if (generation && !["SUCCEEDED", "FAILED", "CANCELED"].includes(generation.status)) { await prisma.generation.update({ where: { id }, data: { status: "CANCELED", canceledAt: new Date(), progress: 0 } }); await releaseCredits(id, "Generation canceled"); logger.info({ generationId: id }, "generation.canceled"); }
  }
  private drain() { while (this.active.size < env.MAX_CONCURRENT_GENERATIONS && this.pending.length) { const id = this.pending.shift()!; this.active.add(id); void this.process(id).finally(() => { this.active.delete(id); this.drain(); }); } }
  private async process(id: string) {
    try {
      let generation = await getGenerationOrThrow(id); if (this.canceled.has(id) || ["SUCCEEDED", "FAILED", "CANCELED"].includes(generation.status)) return;
      const provider = getProvider(); let providerId = generation.providerGenerationId;
      if (!providerId) {
        const assets = generation.assets.map((link) => ({ ...link.asset, role: link.role }));
        const forRole = (role: string): ProviderAsset[] => assets.filter((asset) => asset.role === role).map((asset) => ({ id: asset.id, mimeType: asset.mimeType, storagePath: asset.storagePath, duration: asset.duration }));
        const request: ProviderGenerationRequest = { model: MODEL_REGISTRY[generation.modelId].providerModel, prompt: generation.enhancedPrompt || generation.prompt, duration: generation.duration, resolution: generation.resolution, aspectRatio: generation.aspectRatio, generateAudio: generation.generateAudio, seed: generation.seed ?? undefined, image: forRole("INPUT_IMAGE")[0], lastFrame: forRole("LAST_FRAME")[0], referenceImages: forRole("REFERENCE_IMAGE"), referenceVideos: forRole("REFERENCE_VIDEO"), referenceAudio: forRole("REFERENCE_AUDIO"), webhookUrl: env.REPLICATE_WEBHOOK_URL || undefined };
        const submitted = await provider.createGeneration(request); providerId = submitted.id;
        await prisma.generation.update({ where: { id }, data: { providerGenerationId: providerId, status: "STARTING", startedAt: new Date(), progress: 5 } });
        logger.info({ generationId: id, providerGenerationId: providerId, modelId: generation.modelId }, "generation.submitted");
      }
      const interval = env.ENABLE_MOCK_PROVIDER ? 400 : env.POLL_INTERVAL_MS;
      for (let attempt = 0; attempt < 720 && !this.canceled.has(id); attempt++) {
        const status = await provider.getGeneration(providerId); await this.applyStatus(id, status);
        if (["succeeded", "failed", "canceled"].includes(status.status)) return;
        await new Promise((resolve) => setTimeout(resolve, Math.min(interval * (1 + Math.floor(attempt / 30) * 0.5), 30000)));
      }
      throw new Error("Provider polling exceeded the configured safety limit.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown generation error";
      await prisma.generation.updateMany({ where: { id, status: { notIn: ["SUCCEEDED", "CANCELED"] } }, data: { status: "FAILED", errorMessage: message, completedAt: new Date() } });
      await releaseCredits(id, "Generation failed"); logger.error({ err: error, generationId: id }, "generation.failed");
    }
  }
  async applyStatus(id: string, status: ProviderGenerationStatus) {
    const current = await prisma.generation.findUnique({ where: { id } });
    if (!current || ["SUCCEEDED", "FAILED", "CANCELED"].includes(current.status)) return;
    if (status.status === "starting" || status.status === "processing") { const next = status.status === "starting" ? "STARTING" : "PROCESSING"; if (canTransition(current.status, next)) await prisma.generation.update({ where: { id }, data: { status: next, progress: status.progress ?? (status.status === "starting" ? 10 : 50) } }); return; }
    if (status.status === "failed") { await prisma.generation.update({ where: { id }, data: { status: "FAILED", errorMessage: status.error || "The provider could not complete this video.", completedAt: new Date() } }); await releaseCredits(id, "Provider generation failed"); return; }
    if (status.status === "canceled") { await prisma.generation.update({ where: { id }, data: { status: "CANCELED", canceledAt: new Date() } }); await releaseCredits(id, "Provider generation canceled"); return; }
    const outputPath = await materializeVideo(id, status); const thumbnailPath = await createThumbnail(outputPath, id);
    await prisma.generation.update({ where: { id }, data: { status: "SUCCEEDED", progress: 100, outputPath, thumbnailPath, completedAt: new Date() } }); await finalizeCredits(id);
    logger.info({ generationId: id }, "generation.completed");
  }
  async recover() { const jobs = await prisma.generation.findMany({ where: { status: { in: ["QUEUED", "STARTING", "PROCESSING"] } }, orderBy: { createdAt: "asc" } }); jobs.forEach((job) => this.enqueue(job.id)); }
}
export const generationQueue = new GenerationQueue();
