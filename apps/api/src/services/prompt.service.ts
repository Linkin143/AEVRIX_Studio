import { z } from "zod";

export const promptEnhancementSchema = z.object({ prompt: z.string().trim().min(1).max(200000), camera: z.string().max(120).optional(), lighting: z.string().max(120).optional(), motion: z.string().max(120).optional(), style: z.string().max(120).optional(), environment: z.string().max(120).optional(), audio: z.string().max(120).optional() });
export function enhancePrompt(input: z.infer<typeof promptEnhancementSchema>) {
  const additions = [input.camera && `Camera: ${input.camera}`, input.lighting && `Lighting: ${input.lighting}`, input.motion && `Motion: ${input.motion}`, input.style && `Style: ${input.style}`, input.environment && `Environment: ${input.environment}`, input.audio && `Audio: ${input.audio}`].filter(Boolean);
  return additions.length ? `${input.prompt.trim()}\n\n${additions.join(". ")}.` : `${input.prompt.trim()}\n\nCinematic composition, physically believable motion, coherent lighting, refined detail.`;
}
