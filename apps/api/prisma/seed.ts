import { PrismaClient } from "@prisma/client";
import { MODEL_REGISTRY } from "../src/models/registry.js";
import { PRESETS } from "../src/models/presets.js";

const prisma = new PrismaClient();
await prisma.user.upsert({ where: { id: "local-user" }, update: {}, create: { id: "local-user", name: "Local Creator" } });
await prisma.creditWallet.upsert({ where: { id: "local-wallet" }, update: {}, create: { id: "local-wallet", balance: Number(process.env.LOCAL_CREDIT_BALANCE ?? 1000) } });
for (const model of Object.values(MODEL_REGISTRY)) await prisma.model.upsert({ where: { id: model.id }, update: { enabled: model.enabled, configurationJson: JSON.stringify(model) }, create: { id: model.id, displayName: model.displayName, provider: model.provider, providerModel: model.providerModel, enabled: model.enabled, configurationJson: JSON.stringify(model) } });
for (const preset of PRESETS) await prisma.preset.upsert({ where: { id: preset.id }, update: preset, create: preset });
await prisma.$disconnect();
