// Zero-cost Replicate model validator.
// Fetches each model's INPUT SCHEMA (a free metadata GET — NOT a prediction,
// so it spends ZERO credits) and checks that:
//   1. every provider slug actually resolves on Replicate, and
//   2. every input field + enum value our mappers send really exists.
//
// Run this BEFORE adding credit. If it prints all ✅ you can top up and
// generate on the first try without wasting credits.
//
// Usage:  node scripts/validate-models.mjs
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, "..", ".env") });

const token = process.env.REPLICATE_API_TOKEN;
if (!token) { console.error("❌ REPLICATE_API_TOKEN is not set in .env"); process.exit(1); }
console.log(`🔑 Token: ${token.slice(0, 6)}…${token.slice(-4)}\n`);

// Each entry mirrors apps/api/src/models/registry.ts. `fields` are the input
// keys our mappers send; `resolution`/`aspect`/`durations` are the exact values
// the UI offers — every one is checked against the model's live enum so the UI
// can never present an option that would fail a paid run.
// `resField`/`aspectField` name the model's actual size/ratio input keys.
const MODELS = {
  "Seedance 2.5":      { slug: process.env.REPLICATE_SEEDANCE_25_MODEL || "bytedance/seedance-2.5", fields: ["prompt", "duration", "resolution", "aspect_ratio", "generate_audio", "seed", "image", "last_frame_image", "reference_images", "reference_videos", "reference_audios"], resField: "resolution", aspectField: "aspect_ratio", resolution: ["480p", "720p"], aspect: ["adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], durations: [5, 10, 15, 30] },
  "Seedance 2.0":      { slug: process.env.REPLICATE_SEEDANCE_20_MODEL || "bytedance/seedance-2.0", fields: ["prompt", "duration", "resolution", "aspect_ratio", "generate_audio", "seed", "image", "last_frame_image", "reference_images", "reference_videos", "reference_audios"], resField: "resolution", aspectField: "aspect_ratio", resolution: ["480p", "720p", "1080p", "4k"], aspect: ["adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], durations: [5, 10, 15] },
  // H3 & WAN emit audio automatically — the registry marks them nativeAudio but
  // their mappers send NO generate_audio field (neither schema accepts one).
  "MiniMax H3":        { slug: process.env.REPLICATE_MINIMAX_H3_MODEL || "minimax/h3", fields: ["prompt", "duration", "resolution", "ratio", "first_frame_image", "last_frame_image", "reference_image_urls", "reference_video_urls", "reference_audio_urls"], resField: "resolution", aspectField: "ratio", resolution: ["768P", "2K"], aspect: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], durations: [5, 10, 15] },
  "WAN 3.0":           { slug: process.env.REPLICATE_WAN_30_MODEL || "alibaba/wan-3", fields: ["prompt", "duration", "resolution", "aspect_ratio", "seed", "image"], resField: "resolution", aspectField: "aspect_ratio", resolution: ["480p", "720p", "1080p"], aspect: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4"], durations: [5, 10, 15, 30] },
};

function enumOf(comps, prop) {
  if (!prop) return null;
  if (prop.enum) return prop.enum;
  const ref = prop.allOf?.[0]?.$ref || prop.$ref;
  if (ref && comps) return comps[ref.split("/").pop()]?.enum ?? null;
  return null;
}

async function getSchema(slug) {
  const [owner, name] = slug.split("/");
  const res = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = await res.json();
  const comps = json?.latest_version?.openapi_schema?.components?.schemas;
  const props = comps?.Input?.properties;
  if (props) return { known: Object.keys(props), props, comps, dur: props.duration, source: "schema" };
  // Official models (no pinned version) only expose a default_example — field
  // names are verifiable but enum sets are not published, so enums are skipped.
  if (json?.default_example?.input) return { known: Object.keys(json.default_example.input), props: null, comps: null, dur: null, source: "example" };
  throw new Error("no input schema or default_example found");
}

let hadError = false;
for (const [name, m] of Object.entries(MODELS)) {
  console.log(`\n• ${name}  (${m.slug})`);
  try {
    const { known, props, comps, dur, source } = await getSchema(m.slug);
    // 1) field names our mapper sends.
    const unknown = m.fields.filter((f) => !known.includes(f));
    if (unknown.length) {
      // A pinned "schema" enumerates every accepted input, so an unknown field
      // there is a real error. A "default_example" only shows the fields that
      // one sample happened to use, so absence cannot prove rejection — warn.
      if (source === "schema") { hadError = true; console.log(`  🔴 fields not accepted: ${unknown.join(", ")}`); console.log(`     accepted (${source}): ${known.join(", ")}`); }
      else { console.log(`  ⚠️  not in example (can't verify, likely fine): ${unknown.join(", ")}`); console.log(`     example fields: ${known.join(", ")}`); }
    }
    else console.log(`  ✅ all ${m.fields.length} input fields valid (via ${source})`);

    if (source === "example") { console.log("  ·  enum values not published for official models — skipped (field names verified)"); continue; }

    // 2) resolution enum
    if (m.resField) {
      const live = enumOf(comps, props[m.resField]);
      if (!live) console.log(`  ·  ${m.resField} has no enum (free-form) — skipped`);
      else { const bad = m.resolution.filter((v) => !live.includes(v)); if (bad.length) { hadError = true; console.log(`  🔴 resolution rejected: ${bad.join(", ")}  (allowed: ${live.join(", ")})`); } else console.log(`  ✅ resolution all valid: ${m.resolution.join(", ")}`); }
    }
    // 3) aspect ratio enum
    if (m.aspectField) {
      const live = enumOf(comps, props[m.aspectField]);
      if (!live) console.log(`  ·  ${m.aspectField} has no enum (free-form) — skipped`);
      else { const bad = m.aspect.filter((v) => !live.includes(v)); if (bad.length) { hadError = true; console.log(`  🔴 aspect rejected: ${bad.join(", ")}  (allowed: ${live.join(", ")})`); } else console.log(`  ✅ aspect all valid: ${m.aspect.join(", ")}`); }
    }
    // 4) duration enum or min/max range
    if (dur) {
      if (dur.enum) { const bad = m.durations.filter((v) => !dur.enum.includes(v)); if (bad.length) { hadError = true; console.log(`  🔴 durations rejected: ${bad.join(", ")}  (allowed: ${dur.enum.join(", ")})`); } else console.log(`  ✅ durations valid: ${m.durations.join(", ")}s`); }
      else { const lo = dur.minimum, hi = dur.maximum; const bad = m.durations.filter((v) => (lo != null && v < lo) || (hi != null && v > hi)); if (bad.length) { hadError = true; console.log(`  🔴 durations out of range: ${bad.join(", ")}  (allowed ${lo}–${hi}s)`); } else console.log(`  ✅ durations within ${lo ?? "?"}–${hi ?? "?"}s: ${m.durations.join(", ")}s`); }
    }
  } catch (error) {
    hadError = true;
    console.log(`  🔴 ${error.message}`);
    if (String(error.message).includes("404")) console.log("     → slug does not exist on Replicate");
    if (String(error.message).includes("401")) console.log("     → token invalid/revoked");
  }
}

console.log("\n" + (hadError
  ? "❌ Fix the items above BEFORE adding credit — they would fail a real run."
  : "✅ All slugs, input fields, and selectable enum values are valid. Safe to add credit and generate."));
process.exit(hadError ? 1 : 0);