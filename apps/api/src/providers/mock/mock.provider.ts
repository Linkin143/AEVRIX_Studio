import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { repoRoot } from "../../config/env.js";
import type { ProviderGenerationRequest, ProviderGenerationResult, ProviderGenerationStatus, VideoProvider } from "../provider.interface.js";

const jobs = new Map<string, { created: number; canceled: boolean }>();
const fixturePath = path.join(repoRoot, "fixtures", "mock-generation.mp4");
const require = createRequire(import.meta.url);
const ffmpegStatic = require("ffmpeg-static") as string | null;
async function ensureFixture() {
  if (fs.existsSync(fixturePath)) return;
  await fsp.mkdir(path.dirname(fixturePath), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    if (!ffmpegStatic) return reject(new Error("The bundled mock video encoder is unavailable."));
    const child = spawn(ffmpegStatic, ["-y", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=24", "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=44100", "-t", "5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", fixturePath], { windowsHide: true, stdio: "ignore" });
    child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Could not create the bundled mock video.")));
  });
}
export class MockVideoProvider implements VideoProvider {
  async createGeneration(_request: ProviderGenerationRequest): Promise<ProviderGenerationResult> {
    await ensureFixture();
    const id = `mock_${crypto.randomUUID()}`;
    jobs.set(id, { created: Date.now(), canceled: false });
    return { id, status: "starting" };
  }
  async getGeneration(id: string): Promise<ProviderGenerationStatus> {
    const job = jobs.get(id);
    if (!job && id.startsWith("mock_") && fs.existsSync(fixturePath)) return { id, status: "succeeded", progress: 100, localOutputPath: fixturePath };
    if (!job) return { id, status: "failed", error: "Mock job was not found after restart. Retry the generation." };
    if (job.canceled) return { id, status: "canceled" };
    const elapsed = Date.now() - job.created;
    if (elapsed < 900) return { id, status: "starting", progress: 10 };
    if (elapsed < 3000) return { id, status: "processing", progress: Math.min(90, Math.round(20 + elapsed / 45)) };
    return { id, status: "succeeded", progress: 100, localOutputPath: fixturePath };
  }
  async cancelGeneration(id: string) { const job = jobs.get(id); if (job) job.canceled = true; }
  async testConnection() { return true; }
  supportsWebhook() { return false; }
}
