import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createRequire } from "node:module";
import ffprobeStatic from "ffprobe-static";
import { storageRoot } from "../config/env.js";
import { AppError } from "../middleware/errors.js";

export const storagePaths = { inputs: path.join(storageRoot, "inputs"), videos: path.join(storageRoot, "videos"), thumbnails: path.join(storageRoot, "thumbnails"), temp: path.join(storageRoot, "temp"), exports: path.join(storageRoot, "exports") };
const require = createRequire(import.meta.url);
const ffmpegCommand = (require("ffmpeg-static") as string | null) || "ffmpeg";
const ffprobeCommand = ffprobeStatic.path || "ffprobe";
export async function ensureStorage() { await Promise.all(Object.values(storagePaths).map((dir) => fsp.mkdir(dir, { recursive: true }))); }
export function safePath(directory: keyof typeof storagePaths, filename: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) throw new AppError(400, "INVALID_PATH", "Invalid media identifier.");
  return path.join(storagePaths[directory], filename);
}
export async function deleteIfExists(filePath?: string | null) { if (!filePath) return; await fsp.unlink(filePath).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); }
export async function materializeVideo(generationId: string, source: { outputUrl?: string; localOutputPath?: string }) {
  const output = safePath("videos", `${generationId}.mp4`);
  if (source.localOutputPath) await fsp.copyFile(source.localOutputPath, output);
  else if (source.outputUrl) {
    const response = await fetch(source.outputUrl);
    if (!response.ok || !response.body) throw new AppError(502, "OUTPUT_DOWNLOAD_FAILED", `Could not download provider output (${response.status}).`);
    await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(output));
  } else throw new AppError(502, "OUTPUT_MISSING", "The provider completed without a downloadable video.");
  return output;
}
export async function createThumbnail(videoPath: string, generationId: string) {
  const output = safePath("thumbnails", `${generationId}.jpg`);
  return new Promise<string | null>((resolve) => {
    const child = spawn(ffmpegCommand, ["-y", "-ss", "1", "-i", videoPath, "-frames:v", "1", "-vf", "scale=720:-2", output], { windowsHide: true, stdio: "ignore" });
    child.once("error", () => resolve(null));
    child.once("exit", (code) => resolve(code === 0 ? output : null));
  });
}
export async function probeMedia(filePath: string) {
  return new Promise<{ width: number | null; height: number | null; duration: number | null }>((resolve) => {
    let output = "";
    const child = spawn(ffprobeCommand, ["-v", "error", "-show_entries", "stream=width,height:format=duration", "-of", "json", filePath], { windowsHide: true });
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", () => resolve({ width: null, height: null, duration: null }));
    child.once("exit", (code) => {
      if (code !== 0) return resolve({ width: null, height: null, duration: null });
      try { const data = JSON.parse(output); resolve({ width: data.streams?.[0]?.width ?? null, height: data.streams?.[0]?.height ?? null, duration: data.format?.duration ? Number(data.format.duration) : null }); }
      catch { resolve({ width: null, height: null, duration: null }); }
    });
  });
}
