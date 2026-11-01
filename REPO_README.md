# HyperMarkMap Cosmic — Nihiltheism Architect v1.0 (Zo Site)

A dialectical hypermap workbench over the JOURNAL314 corpus: Express + SQLite (WAL, FTS5)
backend behind a Bun fetch bridge, Vite + React 18 + Tailwind 4 frontend, OpenRouter for
AI generation (deterministic labeled fallback when no key is set).

This folder is a **Zo Site** (`zosite.json`), published at
https://hypermarkmap-cosmic-nihilist.zocomputer.io. The Bun toolchain is the only supported
workflow: there is no npm script path, no `npm start`, and no `singularity-omega/` folder.
`.env.example` documents the client Firebase variables and the server variables
(`WRITE_API_KEY`, `ADMIN_API_KEY`, `OPENROUTER_API_KEY`, `DATA_DIR`); it is a template, not
a requirement — every variable is optional and the server boots without any of them.

This tree is the **convergence** of the upstream `main` branch (ten commits through
`0f74e77`, the canvas visualizer upgrade, spatial engine, export engine, streaming
ingestion, node creation/renaming, and the Google Workspace hub) with this backend tier.
`README.md` is the canonical operational document; this file is the remediation record.

## Two surfaces

| Route | What it is |
|---|---|
| `/` | **JOURNAL314 Ω — Nihiltheistic Hypermap Visual.** The upstream canvas topology engine (golden-angle phyllotaxis packing, 4-tier semantic zoom, screen-space label culling, ego-network spotlight) over the client-side baseline ontology, with document ingestion (Markdown, text, PDF, JSON, CSV), Google Drive/Docs pickup, concept-node creation, topology export, search, and zoom/pan inspection. |
| `/architect` | **The Nihiltheism Architect workbench.** Overview, 1,808-node hypermap with dialectical CRUD, corpus explorer (FTS5), the 17-chapter reference edition, dialectical engine, critical revisions, research loop, and the fidelity audit. |

Both routes are served by the same Bun server. The architect bundle is code-split and is
only fetched when `/architect` is requested.

## Architecture

```
Browser ──HTTPS──▶ Zo front proxy (x-forwarded-host = real site host)
                        │
                        ▼  platform port (58306 dev / 56831 production)
        Bun fetch server   export default { fetch, port, idleTimeout: 255 }
                        │   passes x-forwarded-host/proto through untouched;
                        │   fills them from request.url only when absent
                        ▼  ephemeral loopback port (127.0.0.1:0)
        node:http server ◀── Express app (all API routes, Vite middleware in dev,
                        │    static dist/ in production)
                        ▼
        SQLite data/nihiltheism.db (WAL mode, FTS5, foreign keys, busy timeout)
```

- **Development:** port `58306` (`zosite.json` → `local_port`), hot reload via
  `bun run --hot server.ts`. Vite middleware runs with `hmr: false, ws: false`.
- **Production:** port `56831` (`zosite.json` → `publish.published_port`), started by the
  platform supervisor with `NODE_ENV=production`. Killing the production process makes the
  supervisor reboot it cleanly; the port is never left double-bound.
- The bridge binds the platform port immediately; requests wait on the bridge readiness
  promise (no top-level await, so `bun build --format=cjs` can also bundle the module).
- `bun run build:server` emits `dist/server.cjs` (node target, CJS). Node has no
  fetch-server convention, so the bundle carries an adapter that binds the same port and
  translates node requests into the same handler: `node dist/server.cjs` is a live
  entrypoint, verified by `tests/runtime.ts`.

## Repository layout

```
server.ts              Bun fetch bridge + Express application + node entrypoint adapter
server/                config, db (schema + WAL/FTS5), errors, openrouter client, seed, services
shared/types.ts        API contract types shared by server and client
src/App.tsx            route switch: "/" → visualizer, "/architect" → workbench
src/app/               ArchitectShell + api client + the eleven workbench views
src/components/        topology visualizer, ingestion/creation/export/workspace modals,
                       cosmic HUD, minimap, node inspector drawer
src/services/          ingestion pipeline, parsers, export engine, workspace client
src/storage/           IndexedDB-backed GraphStorage with in-memory cache
src/types/             graph, ingestion and export data contracts
tests/                 runner (15), regression (18), spatial (9), export (7), ingestion (20),
                       workspace (2), runtime.zosite (bridge smoke), runtime (CJS bundle smoke)
data/nihiltheism.db    SQLite database (runtime artefacts: *.db-wal, *.db-shm are untracked)
```

## Scripts

| Script | What it does |
|---|---|
| `bun run dev` | Development server on port 58306 with hot reload |
| `bun run build` | `tsc && vite build` → client bundle in `dist/` |
| `bun run build:server` | Bundles the server module to `dist/server.cjs` (node target, CJS) |
| `bun run prod` | `build` then production server on port 56831 |
| `bun run typecheck` / `lint` | `tsc --noEmit` |
| `bun run test` | 15 acceptance tests (`tests/runner.ts`) |
| `bun run test:regression` | 18 regression tests (`tests/regression.test.ts`) |
| `bun run test:client:spatial` | 9 spatial-engine and geometry tests (`tests/spatial.test.ts`) |
| `bun run test:client:export` | 7 topology-export serialization tests (`tests/export.test.ts`) |
| `bun run test:client:ingestion` | 20 ingestion-pipeline, telemetry and logging tests (`tests/ingestion.test.ts`) |
| `bun run test:client:workspace` | 2 Google Workspace parsing tests (`tests/workspace.test.ts`) |
| `bun run test:runtime` | Production smoke against the live fetch bridge (`tests/runtime.zosite.ts`, disposable database, ephemeral port) |
| `bun run test:runtime:bundle` | Builds the CJS bundle and smokes it (`tests/runtime.ts`) |
| `bun run test:all` | Every suite above, in order |

All test suites use temporary SQLite databases and synthetic/mock provider responses;
they never touch the user database and never send source text to a provider.

## Environment

`server/config.ts` loads `.env.local` then `.env` if present (shell wins; none are required).

| Variable | Effect |
|---|---|
| `OPENROUTER_API_KEY` | Enables live AI generation; without it, deterministic labeled proposals |
| `OPENROUTER_MODEL` | OpenRouter model slug (default `openrouter/auto`) |
| `DATA_DIR` | Database directory (default `data/`) |
| `HOST` / `PORT` | Bind override (platform sets these in normal operation) |
| `WRITE_API_KEY` / `ADMIN_API_KEY` | Bearer token required on API mutations. Unset → single-user mode (same-origin policy only) plus one startup warning |

## Supply-chain posture

`bunfig.toml` sets `minimumReleaseAge = 604800` (7 days) for every install, so no release
published inside the cooldown window can enter the tree. Blocked postinstall scripts
(`@firebase/util`, `protobufjs`) are deliberately left untrusted. Pinned runtime
dependencies: `express@^4.21.2` (v4 keeps `app.all('/api/*')` route semantics), `jszip@^3.10.1`,
`dotenv@^16.4.7`, `pdf-parse@^2.4.5` (the `PDFParse` class API this codebase uses),
`d3@^7.9.0`, `firebase@^13.1.0`, `react@^18.3.1`.

## Data layer

`data/nihiltheism.db` (SQLite, WAL mode, FTS5 virtual tables, foreign keys on, 5 s busy
timeout) holds projects, sources, passages, concepts, claims, objections, contradictions,
revisions, corrections, research jobs, and the hypermap node graph. Seeding is idempotent:
a populated graph is never reseeded or re-initialised on restart. WAL sidecars are runtime
artefacts and are not tracked in git.

## Security model

- **Same-origin write guard.** Any non-`GET`/`HEAD`/`OPTIONS` request whose `Origin` host
  does not match `x-forwarded-host` (or `host`) is refused with `403`; requests with no
  `Origin` (programmatic callers) are allowed.
- **Optional bearer auth.** With `WRITE_API_KEY` set, API mutations require
  `Authorization: Bearer <key>` (constant-time comparison).
- **Rate limiting.** A fixed one-minute window per client bounds write volume (120), AI
  generation calls (20), and uploaded bytes (256 MB). Expired buckets are swept.
- **Hardening.** `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`,
  `X-Frame-Options: DENY`, `Cache-Control: no-store` on API responses, `x-powered-by`
  disabled, 60 MB body limits, and JSON error responses instead of HTML error pages.

## Convergence record (2026-10-31)

Upstream `main` advanced past the baseline this remediation was first applied to. The
divergent history was reconciled rather than overwritten:

| Change | Detail |
|---|---|
| History | `main` was fast-forwarded from `0f74e77`; the ten upstream commits (visualizer upgrade, spatial engine, export engine, streaming ingestion, node creation/renaming, Google Workspace hub, rename/stability refactor) are ancestors of the current tip and were not rewritten. |
| Frontend | Upstream's canvas visualizer, cosmic HUD, minimap, export modal, create-node modal, spatial engine and export service were adopted wholesale. The Architect Workbench cross-navigation hook (`onOpenArchitect`) was re-applied to the new component so the workbench stays reachable from the sidebar. |
| Backend | `server.ts`, `server/**`, `shared/types.ts`, `src/app/**`, `src/App.tsx` and the server-side suites were kept from the remediation, unchanged. |
| Contracts | `src/types/**` follows upstream (the authoritative graph and export contracts). `src/types.ts` remains the client rendering type module used by the visualizer. |
| Upstream defect fixed | `tests/export.test.ts` declared fixtures in a retired node shape (`category`, `canonicalStage`, `canonicalGroup`, `priorityScore`, `isCustom`, `created`) and passed `includeDocuments`/`includeChecksum`, none of which exist in the current `GraphNode`/`TopologyExportOptions` contracts — upstream `main` did not typecheck. The fixtures were rewritten against the current contracts and the two unknown options removed; runtime behaviour is unchanged (7/7 export assertions still pass). |
| Test surface | Four upstream client suites (spatial, export, ingestion, workspace — 38 assertions) were added to the script matrix alongside the 15 acceptance, 18 regression, and 2 runtime smoke suites. |
| Corpus divergence (reported, not silently merged) | The canvas visualizer renders the client-side baseline ontology shipped in `src/components/GroundedEpistemicTopologyData.ts` (50 nodes at Tier 0), while the Architect Workbench renders the server-side canonical corpus (1,808 hypermap nodes in SQLite). The two are different scopes by construction: the visualizer is a browser-local graph with its own IndexedDB persistence, the workbench is the SQLite-backed research corpus. Unifying them would change the upstream visualizer's data contract and the baseline ontology it ships, so it is recorded here as a deliberate boundary rather than an automated merge. |
