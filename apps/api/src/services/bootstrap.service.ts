import { prisma } from "../database/client.js";
import { env } from "../config/env.js";
import { MODEL_REGISTRY } from "../models/registry.js";
import { PRESETS } from "../models/presets.js";

export async function bootstrapData() {
  await prisma.user.upsert({ where: { id: "local-user" }, update: {}, create: { id: "local-user", name: "Local Creator" } });
  // Real billing is on Replicate; keep the local wallet topped up so it never
  // blocks generation (the gate was removed in generation.service.ts).
  await prisma.creditWallet.upsert({ where: { id: "local-wallet" }, update: { balance: env.LOCAL_CREDIT_BALANCE }, create: { id: "local-wallet", balance: env.LOCAL_CREDIT_BALANCE } });
  for (const model of Object.values(MODEL_REGISTRY)) await prisma.model.upsert({ where: { id: model.id }, update: { enabled: model.enabled, configurationJson: JSON.stringify(model) }, create: { id: model.id, displayName: model.displayName, provider: model.provider, providerModel: model.providerModel, enabled: model.enabled, configurationJson: JSON.stringify(model) } });
  for (const preset of PRESETS) await prisma.preset.upsert({ where: { id: preset.id }, update: preset, create: preset });
}
