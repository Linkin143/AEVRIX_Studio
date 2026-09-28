import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  redact: ["req.headers.authorization", "token", "apiToken", "REPLICATE_API_TOKEN", "prompt"],
});
