import { Router } from "express";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../database/client.js";
import { generationQueue } from "../jobs/generation.queue.js";
import { logger } from "../config/logger.js";

export const webhookRouter = Router();
function verify(raw: Buffer, headers: Record<string, unknown>) {
  if (!env.REPLICATE_WEBHOOK_SECRET) return false;
  const id = String(headers["webhook-id"] || ""); const timestamp = String(headers["webhook-timestamp"] || ""); const signatures = String(headers["webhook-signature"] || "").split(" ");
  if (!id || !timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const keyText = env.REPLICATE_WEBHOOK_SECRET.replace(/^whsec_/, "");
  const expected = crypto.createHmac("sha256", Buffer.from(keyText, "base64")).update(`${id}.${timestamp}.${raw.toString("utf8")}`).digest("base64");
  return signatures.some((entry) => { const value = entry.includes(",") ? entry.split(",")[1] : entry; try { return crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected)); } catch { return false; } });
}
webhookRouter.post("/replicate", async (req, res) => {
  const raw = (req as typeof req & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));
  if (!verify(raw, req.headers)) return res.status(401).json({ success: false, error: { code: "INVALID_SIGNATURE", message: "Webhook signature verification failed." } });
  const eventId = String(req.headers["webhook-id"]); const existing = await prisma.webhookEvent.findUnique({ where: { id: eventId } }); if (existing) return res.status(200).json({ success: true });
  await prisma.webhookEvent.create({ data: { id: eventId } });
  const generation = await prisma.generation.findUnique({ where: { providerGenerationId: String(req.body.id) } }); res.status(202).json({ success: true });
  if (!generation) return;
  logger.info({ generationId: generation.id, providerGenerationId: req.body.id }, "webhook.received");
  const output = typeof req.body.output === "string" ? req.body.output : Array.isArray(req.body.output) ? req.body.output[0] : undefined;
  void generationQueue.applyStatus(generation.id, { id: req.body.id, status: req.body.status === "succeeded" ? "succeeded" : req.body.status === "failed" ? "failed" : req.body.status === "canceled" ? "canceled" : req.body.status === "starting" ? "starting" : "processing", outputUrl: output, error: req.body.error ? String(req.body.error) : undefined }).catch((error) => logger.error({ err: error, generationId: generation.id }, "webhook.processing_failed"));
});
