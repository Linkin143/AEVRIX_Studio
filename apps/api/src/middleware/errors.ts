import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { logger } from "../config/logger.js";

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}

export const notFound: RequestHandler = (_req, _res, next) => next(new AppError(404, "NOT_FOUND", "The requested resource was not found."));
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError) return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ success: false, error: { code: error.code, message: error.code === "LIMIT_FILE_SIZE" ? "The upload exceeds the 100 MB limit." : error.message } });
  if (error instanceof ZodError) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Check the highlighted values and try again.", details: error.flatten() } });
  if (error instanceof AppError) return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message, details: error.details } });
  logger.error({ err: error }, "request.failed");
  return res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." } });
};
export const asyncHandler = (fn: RequestHandler): RequestHandler => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
