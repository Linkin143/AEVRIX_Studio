# AEVRIX Video Studio implementation plan

This plan translates the supplied product specification into testable delivery phases. The attached document is treated as product requirements; execution decisions remain in this repository.

## Phase 1 — Foundation

- npm workspaces monorepo with Next.js web, Express API, and shared TypeScript contracts
- environment validation, structured logging, error envelopes, health checks
- Prisma SQLite schema, migration, seed data, configurable local storage

**Exit:** dependencies install, database migrates, API and web boot.

## Phase 2 — Core media workflow

- capability-driven Seedance model registry and pricing service
- validated asset upload/list/rename/delete with UUID-backed paths
- generation service, credit reservation, persistent in-process queue
- mock and Replicate providers behind one provider interface
- bounded polling, cancel/retry, restart reconciliation, local output download

**Exit:** mock and configured Replicate jobs persist through the same API contract.

## Phase 3 — Creator experience

- premium responsive shell, command palette, keyboard shortcuts
- Create workspace with prompt helper, model controls, references, upload, and cost estimate
- Generations history/detail/actions, Assets library, Models, Dashboard, Settings
- transparent configuration, progress, validation, and recovery states

**Exit:** all primary navigation and action buttons perform real work.

## Phase 4 — Reliability and handoff

- webhook ingestion, idempotency, local media post-processing, safe downloads
- unit/integration coverage for validation, mappings, costs, and lifecycle
- Playwright smoke flow in mock mode
- production builds, API reference, complete local runbook

**Exit:** documented acceptance flow passes without external services in mock mode.

## Scope notes

- Local-first single-user modular monolith; no cloud database, Redis, or object storage.
- Replicate credentials remain server-only.
- FFmpeg improves thumbnails but is not required for generation completion.
- Provider pricing is explicitly an estimate and configuration-driven.
