// Standalone Replicate connectivity smoke-test.
// Runs the FREE black-forest-labs/flux-schnell image model to validate the
// REPLICATE_API_TOKEN without spending any video credits.
//
// Usage:  node scripts/test-replicate.mjs
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, "..", ".env") });

const token = process.env.REPLICATE_API_TOKEN;
if (!token) {
  console.error("❌ REPLICATE_API_TOKEN is not set in .env");
  process.exit(1);
}
console.log(`🔑 Token loaded: ${token.slice(0, 6)}…${token.slice(-4)}`);

const { default: Replicate } = await import("replicate");
const replicate = new Replicate({ auth: token });

try {
  console.log("🖼️  Running black-forest-labs/flux-schnell (free image model)…");
  const started = Date.now();
  const output = await replicate.run("black-forest-labs/flux-schnell", {
    input: { prompt: "golden test card, AEVRIX studio smoke test", num_outputs: 1 },
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const url = Array.isArray(output) ? output[0] : output;
  console.log(`✅ Replicate token WORKS (${seconds}s). Image URL:`);
  console.log(`   ${typeof url === "object" && url?.url ? url.url() : url}`);
  process.exit(0);
} catch (error) {
  console.error("❌ Replicate call FAILED:");
  console.error(`   ${error?.message ?? error}`);
  if (error?.response?.status === 401) console.error("   → 401 Unauthorized: the token is invalid or revoked.");
  if (error?.response?.status === 402) console.error("   → 402 Payment Required: free credit exhausted; add billing.");
  process.exit(1);
}
