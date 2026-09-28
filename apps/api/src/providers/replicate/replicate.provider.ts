import Replicate from "replicate";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errors.js";
import { mapSeedanceInput } from "./replicate.mapper.js";
import type { ProviderGenerationRequest, ProviderGenerationResult, ProviderGenerationStatus, ProviderStatusName, VideoProvider } from "../provider.interface.js";

const statusMap: Record<string, ProviderStatusName> = { starting: "starting", processing: "processing", succeeded: "succeeded", failed: "failed", canceled: "canceled", aborted: "canceled" };
export class ReplicateProvider implements VideoProvider {
  private client: Replicate;
  constructor(token = env.REPLICATE_API_TOKEN) {
    if (!token) throw new AppError(503, "REPLICATE_NOT_CONFIGURED", "Add a Replicate API token in the server environment or enable mock mode.");
    this.client = new Replicate({ auth: token });
  }
  async createGeneration(request: ProviderGenerationRequest): Promise<ProviderGenerationResult> {
    const input = await mapSeedanceInput(request);
    const options: Record<string, unknown> = { model: request.model, input };
    if (request.webhookUrl) { options.webhook = request.webhookUrl; options.webhook_events_filter = ["start", "completed"]; }
    const prediction = await this.client.predictions.create(options as never);
    return { id: prediction.id, status: statusMap[prediction.status] ?? "starting" };
  }
  async getGeneration(id: string): Promise<ProviderGenerationStatus> {
    const prediction = await this.client.predictions.get(id);
    const rawOutput = prediction.output as unknown;
    const outputUrl = typeof rawOutput === "string" ? rawOutput : Array.isArray(rawOutput) && typeof rawOutput[0] === "string" ? rawOutput[0] : undefined;
    return { id, status: statusMap[prediction.status] ?? "processing", outputUrl, error: prediction.error ? String(prediction.error) : undefined };
  }
  async cancelGeneration(id: string) { await this.client.predictions.cancel(id); }
  async testConnection() { await this.client.models.get("bytedance", "seedance-2.0"); return true; }
  supportsWebhook() { return true; }
}
