# AEVRIX API

Base URL: `http://127.0.0.1:5000/api`. Successful JSON responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "error": { "code", "message", "details?" } }`.

## System and catalog

| Method | URL | Purpose |
| --- | --- | --- |
| GET | `/health` | Database, storage, and provider configuration status; never returns secrets. |
| GET | `/models` | Enabled capability-driven model definitions. |
| GET | `/models/:id` | One model definition; 404 when unknown. |
| GET | `/presets` | Built-in creator presets. |
| GET | `/stats` | Real local generation counts, credit use, and wallet state. |
| GET | `/settings` | Safe local settings summary. |
| PUT | `/settings` | Save `{ replicateApiToken?, webhookMode? }`; the token is written to ignored `.env` and never returned. |
| POST | `/settings/test-connection` | Verify the active mock or Replicate provider configuration. |
| POST | `/prompts/enhance` | Deterministically enhance `{ prompt, camera?, lighting?, motion?, style?, environment?, audio? }`. |
| POST | `/cost-estimate` | Estimate `{ modelId, resolution, duration }`; the backend remains authoritative. |

## Assets

### `POST /assets`

Multipart field `file`. Allows JPEG, PNG, WebP, MP4, WebM, MOV, MP3, WAV, M4A, and AAC up to 100 MB. MIME and leading file signatures are validated. Returns 201 with the created asset.

### `GET /assets`

Optional query parameters: `type=IMAGE|VIDEO|AUDIO`, `search=text`. Returns an array with safe content URLs.

### `GET /assets/:id/content`

Streams a known asset by ID. Arbitrary paths are never accepted.

### `PATCH /assets/:id`

Body: `{ "name": "new display name" }`. Only metadata changes; storage names stay UUID-based.

### `DELETE /assets/:id`

Returns 204. Assets referenced by a generation return 409 and are preserved.

## Generations

### `POST /generations`

Returns 202 and queues a persistent generation.

```json
{
  "modelId": "seedance-2.0",
  "prompt": "A cinematic rooftop restaurant at sunset",
  "duration": 5,
  "resolution": "720p",
  "aspectRatio": "16:9",
  "generateAudio": true,
  "seed": 42,
  "imageAssetId": "optional-uuid",
  "lastFrameAssetId": "optional-uuid",
  "referenceImageAssetIds": [],
  "referenceVideoAssetIds": [],
  "referenceAudioAssetIds": [],
  "idempotencyKey": "unique-client-key"
}
```

Prompt length is 1–4000. Supported durations are 5, 7, 10, 15, 20, and 30 seconds. Model capabilities, reference limits, and first/last-frame conflicts are validated before provider submission. Common errors: `MODEL_UNAVAILABLE`, `INVALID_DURATION`, `ASSET_NOT_FOUND`, `REFERENCE_CONFLICT`, `REFERENCE_DURATION_EXCEEDED`, and `INSUFFICIENT_CREDITS`.

### `GET /generations`

Query: `page` (default 1), `limit` (default 24, max 100), `status`, `modelId`, `search`, `sort=newest|oldest`.

```json
{"success":true,"data":{"items":[],"page":1,"limit":24,"total":0,"totalPages":0}}
```

### Generation item routes

| Method | URL | Purpose |
| --- | --- | --- |
| GET | `/generations/:id` | Full metadata and linked assets. |
| GET | `/generations/:id/media` | Stream completed video. |
| GET | `/generations/:id/thumbnail` | Serve generated poster when available. |
| GET | `/generations/:id/download` | Download as `aevrix-<id>.mp4`. |
| POST | `/generations/:id/cancel` | Cancel provider work and refund reserved credits. |
| POST | `/generations/:id/retry` | Create and queue a linked generation; does not overwrite history. |
| POST | `/generations/:id/duplicate` | Return editable request settings without generating. |
| PATCH | `/generations/:id/favorite` | Body `{ "favorite": true }`. |
| DELETE | `/generations/:id` | Delete terminal metadata, video, and thumbnail; assets remain. |

## Webhook

`POST /webhooks/replicate` accepts Replicate prediction events. It requires `webhook-id`, `webhook-timestamp`, and `webhook-signature`, rejects events older than five minutes, verifies the configured signing secret against the raw request body, stores event IDs for idempotency, responds 202 quickly, and performs output materialization asynchronously.
