# Review and verification — October 7, 2026

The Gemini integration has been replaced in both backend generation paths. The standalone visualizer never contained an AI integration; it received build, interaction, layout, and dependency fixes.

| Finding | Implemented correction |
| --- | --- |
| Gemini-specific SDK and hardcoded model | Server-only OpenRouter chat completion client, configurable model, refreshed npm/Bun lockfiles, updated setup template |
| No response validation or bounded provider request | Input/output limits, timeout/abort, enum/text/shape checks, explicit HTTP errors, one request without paid retries |
| AI claims accepted without quotation checks | Exact supplied-passage quotation verification, actual source attribution, generated proposals left unreviewed, objections kept open |
| Concurrent cycles could duplicate paid calls | Per-job/per-node in-flight promises share concurrent work |
| Tests could delete existing user records | Isolated temporary databases, no user-database cleanup, mocked providers |
| Fresh database failed graph seeding | Project seeded before graph, transaction rollback, propagated startup failures |
| Startup could erase partial graphs | Populated graphs preserved without destructive reseeding |
| PDF parser incompatible with installed package | Current PDFParse class with getText/destroy; binary fallback removed; successful and invalid PDF tests |
| Paragraph offsets wrong with CRLF or multiple blank lines | Offsets track exact extracted text and trimmed paragraph spans |
| Ingestion/context frontend contracts mismatched backend | Correct contentText body and result shape; source/context adaptation |
| Partial synchronized writes could leave inconsistent records | Nested-safe savepoints for node/claim writes, densification and offline research; errors propagate |
| W5 edits could remain supported | W5 graph/claim edits explicitly marked disputed |
| Production CJS startup depended on import.meta | Removed unused import.meta path setup; compiled bundle starts in production mode |
| Missing input validation and raw server errors | Bounded research settings, validated graph inputs, JSON errors, origin checks, safe API failures |
| Root compiler accidentally included standalone sources | Explicit root scope and verified strict TypeScript checking |
| Wheel handler was passive; drag could select nodes | Native non-passive wheel handling, pointer capture, drag threshold, touch-friendly canvas |
| Reset used device pixels; high-DPI rendering inconsistent | CSS-coordinate framing, capped device-pixel ratio, resize observation |
| Animation depended on screen refresh rate | Elapsed-time pacing capped at 30 FPS; hidden-tab drawing skipped |
| Expand/collapse did not affect the hardcoded graph | Actual graph visibility controls, complete canonical coverage and readable initial depth |
| Saved graph/generation controls were unconnected | Root data loading/retry, inspector proposal action, loading/errors, visible provider/fallback status |
| Header blocked inspector control; mobile controls overlapped | Measured header placement, responsive toolbar, fit-to-graph framing |
| Standalone radial labels clustered and graph clipped | Weighted radial layout and fit-to-graph framing |
| Standalone claimed 1,808 nodes for a visual reference | Actual visible-node count displayed |
| Vulnerable build dependencies and cloud-only icon files | Patched Vite/Tailwind stack, compatible esbuild, locally reinstalled Lucide package |
| Root watching/style scans included unrelated app output | Scoped stylesheet scanning and ignored standalone/data/artifact paths |

Executed checks:

- `npm install`, `npm run typecheck`, `npm run build`, and `npm run dev` in both apps.
- 15 acceptance tests and 18 targeted regression tests passed.
- Compiled production server smoke checks passed with a disposable SQLite database.
- Headless Edge checked rendered canvases at 2× DPI, desktop/mobile layouts, search, expand/collapse, pointer panning, wheel/keyboard zoom, inspector controls, and a mocked proposal action. No captured page/console errors in the passing run.
- Both dependency audits reported zero vulnerabilities. The root frontend build contains no OpenRouter credential variable or provider authorization header; the Gemini SDK is absent from the npm dependency tree.
- Desktop/mobile screenshot evidence is in `artifacts/`.

Limits: no live OpenRouter request was made because no key was configured. Real-provider model support, account access/credits, and answer quality remain unverified. Scanned PDFs require OCR. The server is intended for local single-user use; public hosting needs authentication/access controls. These checks do not prove every possible bug is absent. Existing quotation/source content was preserved rather than independently authenticated.
