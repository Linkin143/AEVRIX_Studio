import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../database/client.js";
import { env, storageRoot } from "../config/env.js";
import { MODEL_REGISTRY } from "../models/registry.js";
import { PRESETS } from "../models/presets.js";
import { asyncHandler, AppError } from "../middleware/errors.js";
import { saveAsset, deleteAsset } from "../services/asset.service.js";
import { assetDto, generationDto } from "../services/serializers.js";
import { createGeneration, deleteGeneration, getGenerationOrThrow, requestFromGeneration } from "../services/generation.service.js";
import { generationQueue } from "../jobs/generation.queue.js";
import { estimateCost } from "../services/cost.service.js";
import { enhancePrompt, promptEnhancementSchema } from "../services/prompt.service.js";
import { getProvider, providerConfigured, setProviderToken } from "../providers/provider.factory.js";
import { logger } from "../config/logger.js";
import { saveReplicateToken } from "../services/secret.service.js";
import { storagePaths } from "../storage/storage.service.js";

export const api = Router();
const upload = multer({ storage: multer.diskStorage({ destination: storagePaths.temp, filename: (_req, _file, callback) => callback(null, `${crypto.randomUUID()}.upload`) }), limits: { fileSize: 100 * 1024 * 1024, files: 1 } });
const optionalDate = z.preprocess((value) => value === "" ? undefined : value, z.coerce.date().optional());

api.get("/health", asyncHandler(async (_req, res) => {
  let database: "ok" | "error" = "ok"; try { await prisma.$queryRaw`SELECT 1`; } catch { database = "error"; }
  const storage = fs.existsSync(storageRoot) ? "ok" : "error";
  res.json({ success: true, data: { status: database === "ok" && storage === "ok" ? "ok" : "degraded", database, storage, replicate: env.ENABLE_MOCK_PROVIDER ? "mock" : providerConfigured() ? "configured" : "not_configured" } });
}));
api.get("/models", (_req, res) => res.json({ success: true, data: Object.values(MODEL_REGISTRY).filter((model) => model.enabled) }));
api.get("/models/:id", (req, res) => { const model = MODEL_REGISTRY[req.params.id]; if (!model) throw new AppError(404, "MODEL_NOT_FOUND", "Model not found."); res.json({ success: true, data: model }); });
api.get("/presets", (_req, res) => res.json({ success: true, data: PRESETS }));
api.post("/prompts/enhance", (req, res) => res.json({ success: true, data: { prompt: enhancePrompt(promptEnhancementSchema.parse(req.body)) } }));
api.post("/cost-estimate", (req, res) => { const data = z.object({ modelId: z.string(), resolution: z.string(), duration: z.number().int() }).parse(req.body); res.json({ success: true, data: estimateCost(data.modelId, data.resolution, data.duration) }); });

api.post("/assets", upload.single("file"), asyncHandler(async (req, res) => { if (!req.file) throw new AppError(400, "FILE_REQUIRED", "Choose a file to upload."); const asset = await saveAsset(req.file); logger.info({ assetId: asset.id, type: asset.type }, "asset.uploaded"); res.status(201).json({ success: true, data: assetDto(asset, req) }); }));
api.get("/assets", asyncHandler(async (req, res) => { const type = typeof req.query.type === "string" ? req.query.type.toUpperCase() : undefined; const search = typeof req.query.search === "string" ? req.query.search : undefined; const assets = await prisma.asset.findMany({ where: { type: type ? { equals: type } : undefined, originalName: search ? { contains: search } : undefined }, orderBy: { createdAt: "desc" } }); res.json({ success: true, data: assets.map((asset) => assetDto(asset, req)) }); }));
api.get("/assets/:id/content", asyncHandler(async (req, res) => { const asset = await prisma.asset.findUnique({ where: { id: req.params.id } }); if (!asset) throw new AppError(404, "ASSET_NOT_FOUND", "Asset not found."); res.type(asset.mimeType).sendFile(asset.storagePath); }));
api.patch("/assets/:id", asyncHandler(async (req, res) => { const { name } = z.object({ name: z.string().trim().min(1).max(180) }).parse(req.body); const asset = await prisma.asset.update({ where: { id: req.params.id }, data: { originalName: path.basename(name) } }).catch(() => { throw new AppError(404, "ASSET_NOT_FOUND", "Asset not found."); }); res.json({ success: true, data: assetDto(asset, req) }); }));
api.delete("/assets/:id", asyncHandler(async (req, res) => { await deleteAsset(req.params.id); logger.info({ assetId: req.params.id }, "asset.deleted"); res.status(204).end(); }));

api.post("/generations", asyncHandler(async (req, res) => { const generation = await createGeneration(req.body); generationQueue.enqueue(generation.id); logger.info({ generationId: generation.id, modelId: generation.modelId }, "generation.created"); res.status(202).json({ success: true, data: generationDto(generation, req) }); }));
api.get("/generations", asyncHandler(async (req, res) => {
  const query = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(24), status: z.string().optional(), modelId: z.string().optional(), search: z.string().optional(), from: optionalDate, to: optionalDate, sort: z.enum(["newest", "oldest"]).default("newest") }).parse(req.query);
  const where = { status: query.status ? { equals: query.status } : undefined, modelId: query.modelId || undefined, prompt: query.search ? { contains: query.search } : undefined, createdAt: query.from || query.to ? { gte: query.from, lte: query.to ? new Date(query.to.getTime() + 86_399_999) : undefined } : undefined };
  const [items, total] = await Promise.all([prisma.generation.findMany({ where, include: { assets: { include: { asset: true } } }, orderBy: { createdAt: query.sort === "newest" ? "desc" : "asc" }, skip: (query.page - 1) * query.limit, take: query.limit }), prisma.generation.count({ where })]);
  res.json({ success: true, data: { items: items.map((item) => generationDto(item, req)), page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } });
}));
api.get("/generations/:id", asyncHandler(async (req, res) => res.json({ success: true, data: generationDto(await getGenerationOrThrow(req.params.id), req) })));
api.get("/generations/:id/media", asyncHandler(async (req, res) => { const generation = await getGenerationOrThrow(req.params.id); if (!generation.outputPath) throw new AppError(404, "VIDEO_NOT_READY", "Video is not available yet."); res.type("video/mp4").sendFile(generation.outputPath); }));
api.get("/generations/:id/thumbnail", asyncHandler(async (req, res) => { const generation = await getGenerationOrThrow(req.params.id); if (!generation.thumbnailPath) throw new AppError(404, "THUMBNAIL_NOT_FOUND", "Thumbnail is not available."); res.type("image/jpeg").sendFile(generation.thumbnailPath); }));
api.get("/generations/:id/download", asyncHandler(async (req, res) => { const generation = await getGenerationOrThrow(req.params.id); if (!generation.outputPath) throw new AppError(404, "VIDEO_NOT_READY", "Video is not available yet."); res.download(generation.outputPath, `aevrix-${generation.id}.mp4`); }));
api.post("/generations/:id/cancel", asyncHandler(async (req, res) => { await getGenerationOrThrow(req.params.id); await generationQueue.cancel(req.params.id); res.json({ success: true, data: generationDto(await getGenerationOrThrow(req.params.id), req) }); }));
api.post("/generations/:id/retry", asyncHandler(async (req, res) => { const source = await getGenerationOrThrow(req.params.id); const created = await createGeneration({ ...requestFromGeneration(source), idempotencyKey: crypto.randomUUID() }, source.id); generationQueue.enqueue(created.id); res.status(202).json({ success: true, data: generationDto(created, req) }); }));
api.post("/generations/:id/duplicate", asyncHandler(async (req, res) => { const source = await getGenerationOrThrow(req.params.id); res.json({ success: true, data: requestFromGeneration(source) }); }));
api.patch("/generations/:id/favorite", asyncHandler(async (req, res) => { const { favorite } = z.object({ favorite: z.boolean() }).parse(req.body); const updated = await prisma.generation.update({ where: { id: req.params.id }, data: { favorite } }).catch(() => { throw new AppError(404, "GENERATION_NOT_FOUND", "Generation not found."); }); res.json({ success: true, data: generationDto(updated, req) }); }));
api.delete("/generations/:id", asyncHandler(async (req, res) => { await deleteGeneration(req.params.id); res.status(204).end(); }));

api.get("/settings", asyncHandler(async (_req, res) => { const webhook = await prisma.setting.findUnique({ where: { key: "webhookMode" } }); res.json({ success: true, data: { replicateConfigured: providerConfigured(), mockMode: env.ENABLE_MOCK_PROVIDER, storageDirectory: storageRoot, databaseUrl: env.DATABASE_URL.replace(/[^/\\]+\.db$/, "••••.db"), maxConcurrentGenerations: env.MAX_CONCURRENT_GENERATIONS, pollingIntervalMs: env.POLL_INTERVAL_MS, webhookMode: webhook?.value || "auto" } }); }));
api.put("/settings", asyncHandler(async (req, res) => { const data = z.object({ replicateApiToken: z.string().min(10).optional(), webhookMode: z.enum(["auto", "enabled", "disabled"]).optional() }).parse(req.body); if (data.replicateApiToken) { await saveReplicateToken(data.replicateApiToken); setProviderToken(data.replicateApiToken); } if (data.webhookMode) await prisma.setting.upsert({ where: { key: "webhookMode" }, update: { value: data.webhookMode }, create: { key: "webhookMode", value: data.webhookMode } }); res.json({ success: true, data: { saved: true, replicateConfigured: providerConfigured() } }); }));
api.post("/settings/test-connection", asyncHandler(async (_req, res) => { if (!providerConfigured()) throw new AppError(503, "PROVIDER_NOT_CONFIGURED", "Configure Replicate or enable mock mode first."); await getProvider().testConnection(); res.json({ success: true, data: { connected: true } }); }));
api.get("/stats", asyncHandler(async (_req, res) => { const [total, completed, processing, failed, usage, wallet, favorite] = await Promise.all([prisma.generation.count(), prisma.generation.count({ where: { status: "SUCCEEDED" } }), prisma.generation.count({ where: { status: { in: ["QUEUED", "STARTING", "PROCESSING"] } } }), prisma.generation.count({ where: { status: "FAILED" } }), prisma.generation.aggregate({ _sum: { creditsUsed: true } }), prisma.creditWallet.findUnique({ where: { id: "local-wallet" } }), prisma.generation.groupBy({ by: ["modelId"], _count: true, orderBy: { _count: { modelId: "desc" } }, take: 1 })]); res.json({ success: true, data: { total, completed, processing, failed, creditsUsed: usage._sum.creditsUsed ?? 0, favoriteModel: favorite[0]?.modelId ?? null, balance: wallet?.balance ?? 0, reserved: wallet?.reserved ?? 0 } }); }));
