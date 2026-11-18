# Open and save your web app

The app contains the cosmic graph and the full research workbench.

## Open the existing online version

- Graph: https://hypermarkmap-cosmic-nihilist.zocomputer.io/
- Research workbench: https://hypermarkmap-cosmic-nihilist.zocomputer.io/architect

These are the existing deployment's addresses. Changes in a downloaded copy or a GitHub
branch appear online after that version is published through the hosting account.

## Run this version on your computer

1. Install [Bun](https://bun.sh/docs/installation).
2. Open a terminal in this project folder.
3. Run:

   ```sh
   bun install --frozen-lockfile
   bun run build
   bun run start
   ```

4. Open http://localhost:3000 in your browser. Keep the terminal open while using the app.
   Press Ctrl+C in the terminal to stop it.

For development, use `bun run dev`. If another app already uses port 3000, set `PORT`
in the hosting environment or your local `.env.local` file before starting this app.

## Find the features

On the graph, use **Add Concept Node**, **Ingest Documents**, **Export Topology JSON**,
or **Drive & Docs Hub**. Click a node to inspect it, use F2 to rename a custom node,
drag to pan, and scroll to zoom. The nodes float very gently; labels and lines follow.
Your system's reduced-motion setting stops the node movement.

Choose **Architect Workbench** for:

- The overview and 1,808-node research hypermap.
- The 17-chapter reference edition.
- The searchable document corpus and surrounding passage context.
- Claims, warrants, objections, and the mandatory critical revisions.
- Bounded research cycles and the constitutional audit.
- JSON and ZIP exports of the research records and manuscript.

Use **Hypermarkmap** in the workbench header to return to the cosmic graph.

## Save your work

There are two separate data stores:

- **Cosmic graph:** documents and custom nodes are saved in that browser's IndexedDB.
  Use the same browser and website address to return to them. Use **Export Topology
  JSON** to download a portable record, and keep your original documents. Clearing
  that website's browser data removes its locally saved graph.
- **Research workbench:** records are saved in `data/nihiltheism.db`, or the directory
  selected by `DATA_DIR`. The workbench's **Export** button downloads the records and
  manuscript. ZIP downloads include `database.json` with source passages, the workbench
  graph, relationships, research jobs and logs, reviewer notes, and the other records. For a filesystem backup, stop
  the server and copy the entire data folder.

Keep a copy of the project source outside this cloud workspace. Source backups do not
automatically include browser storage or the ignored data folder.

## AI and Google setup

Local document import parses your files without calling AI. It does not report imported
nodes as AI-enriched. **AI Research** opens the workbench's separate research tools.

The research tools use clearly labelled deterministic proposals when no AI key is set.
To enable live generation, the hosting account needs `OPENROUTER_API_KEY`; an exact model
can be selected with `OPENROUTER_MODEL`. Keep that private key on the server.

Google Drive and Docs require a working Firebase project with Google sign-in enabled
and the app's host in its authorized domains. The public Firebase configuration fields
are listed in `.env.example`. Rebuild after changing `VITE_FIREBASE_*` values, then sign
in through **Drive & Docs Hub**. Live Google sign-in and live AI generation need account
setup; passing the automated tests does not verify those accounts.

## Check a change

```sh
bun run build
bun run test:all
bun run test:browser
```

The tests use disposable databases and synthetic documents. The browser suite needs
Chromium; it uses an existing system installation or the browser installed by
`bunx playwright-core install chromium`. It records screenshots and a verification
summary in `artifacts/`.
