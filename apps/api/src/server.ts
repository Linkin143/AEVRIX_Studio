import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./database/client.js";
import { ensureStorage } from "./storage/storage.service.js";
import { bootstrapData } from "./services/bootstrap.service.js";
import { generationQueue } from "./jobs/generation.queue.js";

await ensureStorage(); await prisma.$connect(); await bootstrapData(); await generationQueue.recover();
const server = app.listen(env.PORT, env.HOST, () => logger.info({ host: env.HOST, port: env.PORT, mockMode: env.ENABLE_MOCK_PROVIDER }, "server.started"));
async function shutdown() { logger.info("server.stopping"); server.close(); await prisma.$disconnect(); process.exit(0); }
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
