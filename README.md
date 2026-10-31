# Nihiltheism Architect — Grounded Epistemic Topology

A local-first, high-performance epistemic graph workbench and visualization environment for Journal314 and phenomenological inquiry.

Built with **React 19**, **Vite**, **TypeScript**, and **Tailwind CSS**. Features GPU-accelerated canvas force-directed layout with Vogel's golden-angle phyllotaxis spiral packing, 4-tier semantic level-of-detail (LoD) zoom, IndexedDB client-side persistence, multi-format file ingestion (Markdown, PDF, JSON, CSV, Plaintext), in-line node inspection/editing, and optional Google Workspace (Drive & Docs) synchronization.

---

## Architecture & Product Scope

- **Frontend Visualization Engine**: High-performance HTML5 Canvas rendering engine with `ResizeObserver` layout decoupling, GPU smooth dampening, double-click center-to-node focus, screen-space AABB label collision grid, and 1-hop ego-network spotlights.
- **Local Persistence Layer**: `GraphStorage` client-side storage driven by browser IndexedDB with a synchronous in-memory cache and atomic transactional cascade deletion.
- **Client-Side Ingestion Subsystem**: Modular parsers extracting frontmatter, sections, verbatim SourceSpans, citations, and confidence status from user-uploaded philosophical documents.
- **Google Workspace Integration**: Optional Drive and Docs integration with minimized OAuth scopes (`drive.readonly`, `drive.file`, `documents.readonly`) and in-memory-only token caching.

---

## Quickstart & Local Development

Requires **Node.js 22.13 or newer** (tested on Node.js 22.x and 24.x).

```bash
# Install dependencies
npm install

# Run static typecheck
npm run typecheck

# Build production bundle
npm run build

# Start local development server (port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

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

---

## Automated Verification & Test Suite

The test suite runs with Node's native test runner via `tsx` without external runtime dependencies:

```bash
# Run all unit tests
npm test
```

Verified test coverage includes:
1. **Spatial & Physics Engine (`tests/spatial.test.ts`)**:
   - Vogel's phyllotaxis spiral clearance and constant areal density
   - 4-Tier semantic level-of-detail (LoD) thresholds
   - Screen-space AABB label collision culler
   - Dynamic document supernode folding and progressive disclosure
   - Inverse affine screen-to-world coordinate projection
   - Archimedean spiral collision avoidance for entity spawning
   - Global keyboard guard against input field interference (`isEditableElement`)
   - Custom node creation, rename validation, and cascade edge pruning
2. **Document Ingestion Pipeline (`tests/ingestion.test.ts`)**:
   - Markdown frontmatter and hierarchical section decomposition
   - Malformed JSON error isolation
   - Scanned PDF detection without hallucination
   - Streaming Markdown ingestion guardrails
   - SHA-256 fingerprint deduplication
   - Live telemetry and memory profiling
3. **Google Workspace Contracts (`tests/workspace.test.ts`)**:
   - Google Docs AST to CommonMark transformation
   - Minimized OAuth scope enforcement

---

## Configuration & Environment Variables

Copy `.env.example` to `.env.local` to configure optional client settings:

```bash
cp .env.example .env.local
```

| Variable | Description |
| :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Optional Firebase Web API key for Google authentication |
| `VITE_FIREBASE_AUTH_DOMAIN` | Optional Firebase authentication domain |
| `VITE_FIREBASE_PROJECT_ID` | Optional Firebase project identifier |

---

## License

MIT
