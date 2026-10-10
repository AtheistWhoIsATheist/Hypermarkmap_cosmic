# HyperMarkMap Cosmic Graph

A local graph workbench with an Express/SQLite backend and a separate standalone visualizer. AI generation uses **OpenRouter**. The root app exposes the saved graph and generates dialectical proposals from its inspector. `singularity-omega` is a static visualizer and requires no API key.

## Root application

Requires Node.js 22.13 or newer; verified with Node.js 24.14 and npm 11.13 on Windows.

```powershell
npm install
npm run typecheck
npm run build
npm run dev
```

Open http://127.0.0.1:3000. Both npm lockfiles are included. The original root Bun lockfile is also refreshed to match the dependency changes.

To enable AI, create `.env.local` using the variables in `.env.example` and set `OPENROUTER_API_KEY` locally. Never put credentials in a `VITE_` variable or paste them into source code. Restart the server after changing its environment. The shell environment wins over `.env.local`, which wins over `.env`.

`OPENROUTER_MODEL` accepts an exact OpenRouter model slug. Its default is `openrouter/auto`; the selected provider must support JSON output. No key is bundled in the frontend. Without a configured key, generation remains available as explicitly labeled deterministic proposals. Provider failures also produce a visible fallback warning. Generated claims and branches remain unreviewed proposals rather than accepted evidence.

Select **Canonical Matrix**, inspect a saved node, then use **Generate OpenRouter proposals** or **Generate offline proposals**. Expand/collapse, search, pointer/touch panning, wheel zoom, and keyboard navigation are supported. Focus the canvas and use Enter to inspect the root, arrows to pan, plus/minus to zoom, Home to fit the graph, or Escape to close the inspector. Child buttons in the inspector provide keyboard navigation through the hierarchy.

The database defaults to `data/nihiltheism.db`. `DATA_DIR` selects a separate directory. Startup preserves populated graphs, including partial graphs. SQLite uses foreign keys, WAL, and a bounded busy timeout. PDF ingestion requires extractable text; scanned/image-only PDFs need OCR before import. Character offsets refer to the extracted text. Paragraph chunks do not invent PDF page numbers.

For a production-mode local launch:

```powershell
npm run build
npm start
```

The server binds to `127.0.0.1` by default. `HOST` and `PORT` are configurable. This is a single-user local workbench; public hosting requires authentication and access controls in front of the server.

## Standalone visualizer

```powershell
cd singularity-omega
npm install
npm run typecheck
npm run build
npm run dev
```

Open http://127.0.0.1:3001. The app runs independently of the backend. Its Vite/Tailwind dependencies were updated, and its icon package was reinstalled to replace unreadable OneDrive placeholders. Keep dependencies available locally when working from a synchronized folder.

## Verification

```powershell
npm test
npm run test:regression
npm run test:runtime
# Start both development servers before this check:
npm run test:browser
```

Acceptance and regression tests use temporary SQLite databases and synthetic/mock provider responses. They do not delete records from the user database or send source text to an AI provider. Runtime smoke checks launch the compiled server on port 3002 with a disposable database. Browser checks use installed Microsoft Edge in headless mode and write desktop/mobile screenshots into `artifacts/`.

Verified: 15 acceptance tests, 18 regression tests, production startup/API smoke checks, desktop/mobile browser interactions, both typechecks and builds, and zero reported dependency audit vulnerabilities. No live OpenRouter completion was executed because no OpenRouter key was configured. These checks establish the tested behavior; they do not prove the absence of every possible bug.

Provider implementation follows the [OpenRouter chat-completion contract](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request) and [JSON-output routing guidance](https://openrouter.ai/docs/guides/features/structured-outputs). Requests are bounded by input length, output tokens, and a configurable timeout; each generation makes one provider request without automatic paid retries.
