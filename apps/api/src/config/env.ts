import "dotenv/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
loadEnv({ path: path.join(repoRoot, ".env"), override: false });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.string().default("file:../../../data/aevrix.db"),
  AEVRIX_STORAGE_DIR: z.string().default("./storage"),
  REPLICATE_API_TOKEN: z.string().optional(),
  REPLICATE_WEBHOOK_SECRET: z.string().optional(),
  REPLICATE_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  MAX_CONCURRENT_GENERATIONS: z.coerce.number().int().min(1).max(10).default(2),
  POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  ENABLE_MOCK_PROVIDER: z.string().default("false").transform((v) => v === "true"),
  LOCAL_CREDIT_BALANCE: z.coerce.number().nonnegative().default(1000),
  LOG_PROMPTS: z.string().default("false").transform((v) => v === "true"),
});

export const env = schema.parse(process.env);
process.env.DATABASE_URL ||= env.DATABASE_URL;
export const storageRoot = path.resolve(repoRoot, env.AEVRIX_STORAGE_DIR);
