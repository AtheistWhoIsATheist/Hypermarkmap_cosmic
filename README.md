# Nihiltheism Architect — Grounded Epistemic Topology

A local-first philosophical research workbench and topology visualiser for Journal314 and
phenomenological inquiry, served as a **Zo Site**.

It has two surfaces over one backend:

- **`/` — JOURNAL314 Ω — Nihiltheistic Hypermap Visual.** A canvas topology engine
  (golden-angle phyllotaxis packing, 4-tier semantic level-of-detail, screen-space label
  collision culling, 1-hop ego-network spotlight) over a browser-local graph with
  IndexedDB persistence, document ingestion, node creation/renaming, topology export,
  and an optional Google Drive/Docs hub.
- **`/architect` — The Nihiltheism Architect workbench.** The SQLite-backed research
  console: a 1,808-node hypermap with dialectical CRUD, the FTS5 corpus explorer, the
  17-chapter reference edition, the dialectical engine, the twelve mandatory critical
  revisions, the adversarial objection register, the research loop, and the fidelity
  audit.

Built with **Bun**, **React 18**, **Vite 8**, **TypeScript**, **Tailwind CSS 4**, and an
**Express 4 + SQLite (WAL, FTS5)** backend behind a Bun fetch bridge.

---

## Architecture

```
Browser ──HTTPS──▶ Zo front proxy (sets x-forwarded-host = real site host)
                        │
                        ▼  platform port (58306 dev / 56831 production)
        Bun fetch server   export default { fetch, port, idleTimeout: 255 }
                        │   passes x-forwarded-host/proto through untouched;
                        │   fills them from request.url only when absent
                        ▼  ephemeral loopback port (127.0.0.1:0)
        node:http server ◀── Express app (API routes, Vite middleware in dev,
                        │    static dist/ in production)
                        ▼
        SQLite data/nihiltheism.db (WAL mode, FTS5, foreign keys, busy timeout)
```

The platform hosts native Bun fetch servers; Express is a node-http listener. A loopback
`node:http` server carries the Express app, and the Bun `fetch` handler proxies to it,
preserving `Host`, `Origin`, `Referer`, and the proxy's `x-forwarded-*` headers so the
same-origin write guard keeps working behind the front proxy.

**Tier split.** The client tier is the visualizer and its browser-local graph. The server
tier is the research corpus: SQLite, FTS5 search, the hypermap node graph, claims,
objections, contradictions, corrections, revisions, research jobs, the reference
edition, and the export bundle. The two tiers share `shared/types.ts`.

---

## Quickstart

Requires **Bun 1.2+** (the runtime, the test runner, and the package manager). Node
22.13+ is required only to execute the optional CJS bundle `dist/server.cjs`.

```bash
bun install          # installs exactly the pinned versions in package.json
bun run typecheck    # tsc --noEmit
bun run build        # tsc && vite build  → client bundle in dist/
bun run dev          # development server on port 58306 (hot reload)
```

Development URLs:

| Surface | URL |
|---|---|
| Visualiser | `http://127.0.0.1:58306/` |
| Workbench | `http://127.0.0.1:58306/architect` |
| Health | `http://127.0.0.1:58306/api/health` |

Port `3000` belongs to another workspace occupant and is never used by this project.

---

## Interactive Navigation & Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **Drag** or **Space + Drag** | Pan canvas viewport smoothly |
| **Scroll Wheel** | Exponentially dampened zoom (clamped from 0.1x to 4.0x) |
| **Double Click Node** | Focus and center camera on target entity |
| **N** or **Alt + N** | Open glassmorphic modal to spawn a new conceptual node |
| **F2** | Enter in-line title editing inside the Node Inspector Drawer |
| **Delete** / **Backspace** | Safely delete selected node with confirmation modal |
| **Home** | Reset camera transform to fit entire visible topology |
| **Escape** | Dismiss inspector drawer, search query, or active modals |
| **Ctrl + E** | Export the serialized topology as JSON |

---

## Automated Verification

Every suite uses a temporary SQLite database and synthetic or mock provider responses.
No suite touches the user database, and no source text is ever sent to a provider.

```bash
bun run test                  # 15 server acceptance tests      (tests/runner.ts)
bun run test:regression       # 18 regression tests             (tests/regression.test.ts)
bun run test:client:spatial   # 9 spatial-engine tests          (tests/spatial.test.ts)
bun run test:client:export    # 7 export-engine tests           (tests/export.test.ts)
bun run test:client:ingestion # 20 ingestion/telemetry tests     (tests/ingestion.test.ts)
bun run test:client:workspace # 2 Google Workspace tests        (tests/workspace.test.ts)
bun run test:runtime          # live fetch-bridge smoke         (tests/runtime.zosite.ts)
bun run test:runtime:bundle   # CJS bundle smoke                (tests/runtime.ts)
bun run test:all              # all of the above, in order
```

Coverage summary:

1. **Server acceptance (`tests/runner.ts`)** — schema and WAL/FTS5 initialisation,
   summary-only seeding with no invented pagination, ranked passage search, passage
   context retrieval, ingestion with SHA-256 and chunking, the twelve mandatory critical
   revisions, the five W0–W4 warrants held as disputes, the constitutional audit, the
   budgeted research loop, the 17-chapter reference edition (12,592 words), the JSON/ZIP
   export bundle, the 1,808-node hypermap with two root trees, D3 hierarchy generation,
   dialectical node CRUD with claim/objection synchronisation, and dialectical
   densification producing a claim, a defeater, and an LP paraconsistent antinomy.
2. **Regression (`tests/regression.test.ts`)** — provider error handling (401/402/429/502)
   without credential echo or paid retries, stalled-request aborts, CRLF-preserving
   passage offsets, broken-PDF rejection, ingestion rollback, concurrent research
   coalescing, rejection of invented citations, validated densification branches,
   densification rollback, partial-graph preservation on startup, the current PDF
   parser, and empty-project/invalid-bound handling.
3. **Client suites** — phyllotaxis clearance and constant areal density, semantic-zoom
   thresholds, the screen-space AABB label culler, supernode folding and progressive
   disclosure, inverse affine projection, spiral collision avoidance, the keyboard guard
   against input-field interference, custom node creation with atomic rename and cascade
   edge pruning; export filename sanitisation, byte formatting, SHA-256 determinism,
   unified/custom-only/ingested-only scope serialisation, orphan-edge pruning and
   referential integrity; streaming Markdown ingestion guardrails, bounded-memory hashing,
   32 KB preview sanitisation, live stage telemetry and structured logging; Google Docs
   AST conversion and minimised OAuth scopes.
4. **Runtime smokes** — startup, static asset delivery, health, graph traversal,
   ingestion context, generation, error envelopes, and the origin checks, both against the
   live Bun fetch bridge and against the Node-executable CJS bundle.

---

## Configuration & Environment Variables

Copy `.env.example` to `.env.local` (or `.env`). Every variable is optional.

| Variable | Description |
| :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Optional Firebase Web API key for Google authentication |
| `VITE_FIREBASE_AUTH_DOMAIN` | Optional Firebase authentication domain |
| `VITE_FIREBASE_PROJECT_ID` | Optional Firebase project identifier |
| `VITE_FIREBASE_STORAGE_BUCKET` | Optional Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Optional Firebase messaging sender id |
| `VITE_FIREBASE_APP_ID` | Optional Firebase app id |
| `WRITE_API_KEY` | Bearer token required for API mutations; unset → single-user mode |
| `ADMIN_API_KEY` | Bearer token for administrative mutations |
| `OPENROUTER_API_KEY` | Enables live AI generation; unset → deterministic labelled proposals |
| `OPENROUTER_MODEL` | OpenRouter model slug (default `openrouter/auto`) |
| `DATA_DIR` | Database directory (default `data/`) |
| `HOST` / `PORT` | Bind override (the platform sets these in normal operation) |

---

## Security Model

- **Same-origin write guard.** Any non-`GET`/`HEAD`/`OPTIONS` request whose `Origin` host
  does not match `x-forwarded-host` (or `host`) is refused with `403`. Requests with no
  `Origin` (programmatic callers) are allowed.
- **Optional bearer auth.** With `WRITE_API_KEY` set, API mutations require
  `Authorization: Bearer <key>` (constant-time comparison). With no key configured, one
  startup warning is logged and the write surface is guarded by the same-origin policy
  alone.
- **Rate limiting.** A one-minute window per client bounds write volume, AI generation
  calls, and uploaded bytes.
- **Hardening.** `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`,
  `X-Frame-Options: DENY`, `Cache-Control: no-store` on API responses, `x-powered-by`
  disabled, bounded request bodies, and JSON error envelopes instead of HTML error pages.

## Supply-chain posture

`bunfig.toml` sets `minimumReleaseAge = 604800` (7 days), so no release published inside
the cooldown window can enter the tree. The blocked postinstall scripts (`@firebase/util`,
`protobufjs`) are deliberately left untrusted. Pinned runtime dependencies:
`express@^4.21.2` (v4 preserves `app.all('/api/*')` semantics that Express 5 breaks),
`jszip@^3.10.1`, `dotenv@^16.4.7`, `pdf-parse@^2.4.5` (the `PDFParse` class API this
codebase uses), `d3@^7.9.0`, `firebase@^13.1.0`, `react@^18.3.1`.

## Data layer

`data/nihiltheism.db` (SQLite, WAL mode, FTS5 virtual tables, foreign keys on, busy
timeout) holds projects, sources, passages, concepts, claims, objections, contradictions,
corrections, revisions, research jobs, and the hypermap node graph. Seeding is idempotent:
a populated graph is never reseeded or re-initialised on restart. WAL sidecars are runtime
artefacts and are not tracked in git.

## Deployment

`zosite.json` describes the Zo Site: development on port `58306`, production on
`56831` (`bun run prod` → `build` then the production server). The published instance is
https://hypermarkmap-cosmic-nihilist.zocomputer.io. The platform supervisor restarts the
production process cleanly; the port is never left double-bound.

## License

MIT
