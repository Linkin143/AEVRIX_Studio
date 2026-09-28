import fsp from "node:fs/promises";
import path from "node:path";
import type { AssetType } from "@aevrix/shared-types";
import { prisma } from "../database/client.js";
import { AppError } from "../middleware/errors.js";
import { deleteIfExists, probeMedia, safePath } from "../storage/storage.service.js";

const allowed: Record<string, { type: AssetType; extensions: string[]; signatures: number[][] }> = {
  "image/jpeg": { type: "IMAGE", extensions: [".jpg", ".jpeg"], signatures: [[0xff,0xd8,0xff]] },
  "image/png": { type: "IMAGE", extensions: [".png"], signatures: [[0x89,0x50,0x4e,0x47]] },
  "image/webp": { type: "IMAGE", extensions: [".webp"], signatures: [[0x52,0x49,0x46,0x46]] },
  "video/mp4": { type: "VIDEO", extensions: [".mp4"], signatures: [[0x00,0x00,0x00]] },
  "video/webm": { type: "VIDEO", extensions: [".webm"], signatures: [[0x1a,0x45,0xdf,0xa3]] },
  "video/quicktime": { type: "VIDEO", extensions: [".mov"], signatures: [[0x00,0x00,0x00]] },
  "audio/mpeg": { type: "AUDIO", extensions: [".mp3"], signatures: [[0x49,0x44,0x33],[0xff,0xfb],[0xff,0xf3]] },
  "audio/wav": { type: "AUDIO", extensions: [".wav"], signatures: [[0x52,0x49,0x46,0x46]] },
  "audio/mp4": { type: "AUDIO", extensions: [".m4a"], signatures: [[0x00,0x00,0x00]] },
  "audio/aac": { type: "AUDIO", extensions: [".aac"], signatures: [[0xff,0xf1],[0xff,0xf9]] },
};
async function readHeader(filePath: string) {
  const handle = await fsp.open(filePath, "r");
  try { const header = Buffer.alloc(12); await handle.read(header, 0, header.length, 0); return header; }
  finally { await handle.close(); }
}
export async function validateUpload(file: Express.Multer.File) {
  const definition = allowed[file.mimetype];
  if (!definition) throw new AppError(415, "UNSUPPORTED_MEDIA", "Use a supported image, video, or audio file.");
  const header = file.buffer?.subarray(0, 12) ?? await readHeader(file.path);
  if (!definition.signatures.some((signature) => signature.every((byte, index) => header[index] === byte))) throw new AppError(415, "INVALID_MEDIA", "The file contents do not match its media type.");
  const ascii = header.toString("ascii");
  if (["video/mp4", "video/quicktime", "audio/mp4"].includes(file.mimetype) && ascii.slice(4, 8) !== "ftyp") throw new AppError(415, "INVALID_MEDIA", "The file is not a valid ISO media container.");
  if (file.mimetype === "image/webp" && ascii.slice(8, 12) !== "WEBP") throw new AppError(415, "INVALID_MEDIA", "The file is not a valid WebP image.");
  if (file.mimetype === "audio/wav" && ascii.slice(8, 12) !== "WAVE") throw new AppError(415, "INVALID_MEDIA", "The file is not a valid WAV audio file.");
  return definition;
}
export async function saveAsset(file: Express.Multer.File) {
  let storagePath: string | undefined;
  try {
    const definition = await validateUpload(file); const id = crypto.randomUUID();
    const supplied = path.extname(file.originalname).toLowerCase(); const ext = definition.extensions.includes(supplied) ? supplied : definition.extensions[0];
    storagePath = safePath("inputs", `${id}${ext}`);
    if (file.path) await fsp.rename(file.path, storagePath); else await fsp.writeFile(storagePath, file.buffer);
    const metadata = await probeMedia(storagePath);
    return await prisma.asset.create({ data: { id, type: definition.type, originalName: path.basename(file.originalname).slice(0, 180), storagePath, mimeType: file.mimetype, sizeBytes: file.size, ...metadata } });
  } catch (error) {
    await Promise.all([deleteIfExists(file.path), deleteIfExists(storagePath)]); throw error;
  }
}
export async function deleteAsset(id: string) {
  const asset = await prisma.asset.findUnique({ where: { id }, include: { _count: { select: { generations: true } } } });
  if (!asset) throw new AppError(404, "ASSET_NOT_FOUND", "Asset not found.");
  if (asset._count.generations) throw new AppError(409, "ASSET_IN_USE", "This asset is used by a generation and cannot be deleted.");
  await prisma.asset.delete({ where: { id } }); await deleteIfExists(asset.storagePath);
}
