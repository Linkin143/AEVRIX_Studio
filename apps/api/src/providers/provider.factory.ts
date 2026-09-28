import { env } from "../config/env.js";
import { MockVideoProvider } from "./mock/mock.provider.js";
import { ReplicateProvider } from "./replicate/replicate.provider.js";
import type { VideoProvider } from "./provider.interface.js";

let provider: VideoProvider | undefined;
let runtimeToken = env.REPLICATE_API_TOKEN;
export function getProvider() {
  provider ??= env.ENABLE_MOCK_PROVIDER ? new MockVideoProvider() : new ReplicateProvider(runtimeToken);
  return provider;
}
export function setProviderToken(token: string) { runtimeToken = token; provider = undefined; }
export function providerConfigured() { return env.ENABLE_MOCK_PROVIDER || Boolean(runtimeToken); }
