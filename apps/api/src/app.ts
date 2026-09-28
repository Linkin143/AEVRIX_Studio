import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { api } from "./routes/api.js";
import { webhookRouter } from "./routes/webhooks.js";
import { errorHandler, notFound } from "./middleware/errors.js";

export const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.FRONTEND_URL, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }));
app.use(pinoHttp({ logger }));
app.use(express.json({ limit: "2mb", verify: (req, _res, buffer) => { (req as typeof req & { rawBody?: Buffer }).rawBody = buffer; } }));
app.use("/api/webhooks", webhookRouter);
app.use("/api", api);
app.use(notFound);
app.use(errorHandler);
