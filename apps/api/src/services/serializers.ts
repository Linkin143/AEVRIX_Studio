import type { Request } from "express";

export function assetDto(asset: { id: string; type: string; originalName: string; mimeType: string; sizeBytes: number; width: number | null; height: number | null; duration: number | null; createdAt: Date }, req: Request) {
  return { ...asset, createdAt: asset.createdAt.toISOString(), url: `${req.protocol}://${req.get("host")}/api/assets/${asset.id}/content` };
}
export function generationDto(generation: any, req: Request) {
  const base = `${req.protocol}://${req.get("host")}/api/generations/${generation.id}`;
  return { ...generation, outputPath: undefined, thumbnailPath: undefined, idempotencyKey: undefined, createdAt: generation.createdAt.toISOString(), startedAt: generation.startedAt?.toISOString() ?? null, completedAt: generation.completedAt?.toISOString() ?? null, canceledAt: generation.canceledAt?.toISOString() ?? null, outputUrl: generation.outputPath ? `${base}/media` : null, thumbnailUrl: generation.thumbnailPath ? `${base}/thumbnail` : null, assets: generation.assets?.map((link: any) => ({ ...assetDto(link.asset, req), role: link.role, referenceIndex: link.referenceIndex })) };
}
