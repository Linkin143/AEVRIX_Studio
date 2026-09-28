import type { ApiError, ApiSuccess } from "@aevrix/shared-types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";
export class ApiClientError extends Error { constructor(message: string, public code: string, public details?: unknown) { super(message); } }
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: options?.body instanceof FormData ? options.headers : { "Content-Type": "application/json", ...options?.headers } });
  if (response.status === 204) return undefined as T;
  const payload = await response.json() as ApiSuccess<T> | ApiError;
  if (!response.ok || !payload.success) { const error = (payload as ApiError).error; throw new ApiClientError(error?.message || "Request failed", error?.code || "REQUEST_FAILED", error?.details); }
  return payload.data;
}
export function uploadAsset(file: File) { const body = new FormData(); body.append("file", file); return api("/assets", { method: "POST", body }); }
