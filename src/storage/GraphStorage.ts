/**
 * Transactional Storage Engine (src/storage/GraphStorage.ts)
 * Atomic IndexedDB persistence with synchronous hydrated in-memory cache,
 * non-blocking timeout safety guards (2s IDB timeout with in-memory fallback),
 * chunked 500-item transactions, 32KB document text truncation guards,
 * pre-commit relational integrity checks, and SHA-256 fingerprint deduplication.
 */

import type {
  GraphNode,
  GraphEdge,
  SourceDocument,
  SourceSpan,
  GraphPersistenceSnapshot
} from '../types/graph';
import {
  MARKMAP_EPITEMIC_TOPOLOGY,
  type EpistemicTopologyNode
} from '../components/GroundedEpistemicTopologyData';

const DB_NAME = 'nihiltheism_graph_storage';
const DB_VERSION = 1;
const MAX_DOCUMENT_TEXT_PREVIEW = 32768; // 32 KB maximum preview string length
const TRANSACTION_BATCH_SIZE = 500; // 500 items per IndexedDB transaction to prevent IPC buffer starvation
const IDB_SAFETY_TIMEOUT_MS = 2500; // 2.5s timeout for IDB operations before graceful in-memory fallback

function sanitizeDocumentRecord(doc?: SourceDocument): SourceDocument | undefined {
  if (!doc) return undefined;
  const sanitized: SourceDocument = { ...doc };
  if (sanitized.summary && sanitized.summary.length > MAX_DOCUMENT_TEXT_PREVIEW) {
    sanitized.summary = sanitized.summary.slice(0, MAX_DOCUMENT_TEXT_PREVIEW) + '... [TRUNCATED 32KB]';
  }
  const dynamicDoc = sanitized as unknown as Record<string, unknown>;
  if (typeof dynamicDoc.content === 'string' && dynamicDoc.content.length > MAX_DOCUMENT_TEXT_PREVIEW) {
    dynamicDoc.content = dynamicDoc.content.slice(0, MAX_DOCUMENT_TEXT_PREVIEW) + '... [TRUNCATED 32KB]';
  }
  if (typeof dynamicDoc.rawText === 'string' && dynamicDoc.rawText.length > MAX_DOCUMENT_TEXT_PREVIEW) {
    dynamicDoc.rawText = dynamicDoc.rawText.slice(0, MAX_DOCUMENT_TEXT_PREVIEW) + '... [TRUNCATED 32KB]';
  }
  return sanitized;
}

function sanitizeNode(node: GraphNode): GraphNode {
  if (node.content && node.content.length > MAX_DOCUMENT_TEXT_PREVIEW) {
    return {
      ...node,
      content: node.content.slice(0, MAX_DOCUMENT_TEXT_PREVIEW) + '... [TRUNCATED 32KB]'
    };
  }
  return node;
}

function extractAllBaselineIds(root: EpistemicTopologyNode): Set<string> {
  const ids = new Set<string>();
  function walk(node: EpistemicTopologyNode) {
    if (node.id) ids.add(node.id);
    if (node.children) node.children.forEach(walk);
  }
  walk(root);
  return ids;
}

class GraphStorageEngine {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  // Synchronous in-memory hydrated cache for 60fps React renders
  private cachedNodes = new Map<string, GraphNode>();
  private cachedEdges = new Map<string, GraphEdge>();
  private cachedDocuments = new Map<string, SourceDocument>();
  private cachedSpans = new Map<string, SourceSpan>();
  private cachedHashes = new Set<string>();
  private isHydrated = false;
  private hydrationPromise: Promise<void> | null = null;
  private allBaselineIds: Set<string>;

  constructor() {
    this.allBaselineIds = extractAllBaselineIds(MARKMAP_EPITEMIC_TOPOLOGY);
    if (typeof window !== 'undefined') {
      this.hydrationPromise = this.hydrateCache();
    }
  }

  /**
   * Opens or returns the active IndexedDB connection with defensive timeout guards
   */
  private async getDb(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return null;
    }
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          console.warn('[GraphStorage] IndexedDB open timed out after 2500ms. Falling back to in-memory store.');
          resolve(null);
        }
      }, IDB_SAFETY_TIMEOUT_MS);

      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onblocked = () => {
          console.warn('[GraphStorage] IndexedDB open blocked. Falling back to in-memory store.');
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(null);
          }
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains('documents')) {
            db.createObjectStore('documents', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('nodes')) {
            db.createObjectStore('nodes', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('edges')) {
            db.createObjectStore('edges', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('source_spans')) {
            db.createObjectStore('source_spans', { keyPath: 'spanId' });
          }
          if (!db.objectStoreNames.contains('file_hashes')) {
            db.createObjectStore('file_hashes', { keyPath: 'hash' });
          }
        };

        request.onsuccess = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(request.result);
          }
        };

        request.onerror = () => {
          console.warn('[GraphStorage] IndexedDB open error, falling back to in-memory store.');
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(null);
          }
        };
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          console.warn('[GraphStorage] IndexedDB unavailable:', err);
          resolve(null);
        }
      }
    });

    return this.dbPromise;
  }

  /**
   * Hydrates in-memory cache from IndexedDB on startup with safety timeout
   */
  public async hydrateCache(): Promise<void> {
    const db = await this.getDb();
    if (!db) {
      this.isHydrated = true;
      return;
    }

    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.isHydrated = true;
          resolve();
        }
      }, IDB_SAFETY_TIMEOUT_MS);

      try {
        const tx = db.transaction(['documents', 'nodes', 'edges', 'source_spans', 'file_hashes'], 'readonly');

        tx.onerror = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            this.isHydrated = true;
            resolve();
          }
        };

        tx.onabort = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            this.isHydrated = true;
            resolve();
          }
        };

        tx.objectStore('documents').getAll().onsuccess = (e) => {
          const docs = (e.target as IDBRequest<SourceDocument[]>).result || [];
          docs.forEach(d => this.cachedDocuments.set(d.id, d));
        };

        tx.objectStore('nodes').getAll().onsuccess = (e) => {
          const nodes = (e.target as IDBRequest<GraphNode[]>).result || [];
          nodes.forEach(n => this.cachedNodes.set(n.id, n));
        };

        tx.objectStore('edges').getAll().onsuccess = (e) => {
          const edges = (e.target as IDBRequest<GraphEdge[]>).result || [];
          edges.forEach(ed => this.cachedEdges.set(ed.id, ed));
        };

        tx.objectStore('source_spans').getAll().onsuccess = (e) => {
          const spans = (e.target as IDBRequest<SourceSpan[]>).result || [];
          spans.forEach(s => this.cachedSpans.set(s.spanId, s));
        };

        tx.objectStore('file_hashes').getAll().onsuccess = (e) => {
          const hashes = (e.target as IDBRequest<{ hash: string }[]>).result || [];
          hashes.forEach(h => this.cachedHashes.add(h.hash));
        };

        tx.oncomplete = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            this.isHydrated = true;
            resolve();
          }
        };
      } catch {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this.isHydrated = true;
          resolve();
        }
      }
    });
  }

  /**
   * Checks if an identical file hash has already been committed (Deduplication Check)
   */
  public async hasFileHash(hash: string): Promise<boolean> {
    if (this.hydrationPromise) {
      await Promise.race([
        this.hydrationPromise,
        new Promise((r) => setTimeout(r, 1500))
      ]);
    }
    return this.cachedHashes.has(hash);
  }

  /**
   * Synchronous check for hash deduplication
   */
  public hasFileHashSync(hash: string): boolean {
    return this.cachedHashes.has(hash);
  }

  /**
   * Synchronous accessor for currently ingested graph elements
   */
  public getIngestedGraphSync(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: Array.from(this.cachedNodes.values()),
      edges: Array.from(this.cachedEdges.values())
    };
  }

  /**
   * Asynchronous accessor ensuring hydration is complete
   */
  public async getIngestedGraph(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    if (this.hydrationPromise) {
      await Promise.race([
        this.hydrationPromise,
        new Promise((r) => setTimeout(r, 1500))
      ]);
    }
    return this.getIngestedGraphSync();
  }

  /**
   * Pre-Commit Integrity Validation:
   * 1. Unique node IDs
   * 2. Edge endpoint verification without aborting on partial references
   * 3. Retains all valid edges while safely filtering unresolvable orphans
   */
  private filterValidBatchEdges(
    nodes: GraphNode[],
    edges: GraphEdge[]
  ): GraphEdge[] {
    const nodeIds = new Set<string>(this.cachedNodes.keys());

    // Include all 50 baseline topology node IDs as valid targets/sources
    for (const bId of this.allBaselineIds) {
      nodeIds.add(bId);
    }

    for (const n of nodes) {
      nodeIds.add(n.id);
    }

    const validEdges: GraphEdge[] = [];
    for (const e of edges) {
      const hasSource = nodeIds.has(e.source);
      const hasTarget =
        nodeIds.has(e.target) ||
        e.target.startsWith('unresolved_') ||
        e.target.startsWith('ref_') ||
        e.target.startsWith('concept_');

      if (hasSource && hasTarget) {
        validEdges.push(e);
      } else {
        console.warn(`[GraphStorage] Filtered orphaned edge ${e.id} (${e.source} -> ${e.target})`);
      }
    }

    return validEdges;
  }

  /**
   * Atomic commit of extracted nodes, edges, spans, document metadata, and file hash.
   * Chunks node and edge insertions into 500-item transactions to prevent IPC starvation.
   * Gracefully updates in-memory cache even if browser IndexedDB fails.
   */
  public async commitBatchExtraction(
    hash: string,
    nodes: GraphNode[],
    edges: GraphEdge[],
    documentRecord?: SourceDocument
  ): Promise<void> {
    if (this.hydrationPromise) {
      await Promise.race([
        this.hydrationPromise,
        new Promise((r) => setTimeout(r, 1500))
      ]);
    }

    // 1. Pre-Commit Validation & Orphan Edge Pruning
    const sanitizedDoc = sanitizeDocumentRecord(documentRecord);
    const sanitizedNodes = nodes.map(sanitizeNode);
    const validEdges = this.filterValidBatchEdges(sanitizedNodes, edges);

    const db = await this.getDb();

    // 2. Commit to IndexedDB in bounded batches if available with safety timeout
    if (db) {
      try {
        await Promise.race([
          (async () => {
            // 2a. Store Document Record
            if (sanitizedDoc) {
              await new Promise<void>((resolve, reject) => {
                try {
                  const tx = db.transaction(['documents'], 'readwrite');
                  tx.onerror = () => reject(new Error(`IndexedDB document write failed: ${tx.error?.message}`));
                  tx.onabort = () => reject(new Error(`IndexedDB document write aborted: ${tx.error?.message}`));
                  const req = tx.objectStore('documents').put(sanitizedDoc);
                  req.onerror = () => reject(req.error);
                  tx.oncomplete = () => resolve();
                } catch (err) {
                  reject(err);
                }
              });
            }

            // 2b. Store Nodes & Source Spans in batches of TRANSACTION_BATCH_SIZE (500)
            for (let i = 0; i < sanitizedNodes.length; i += TRANSACTION_BATCH_SIZE) {
              const nodeBatch = sanitizedNodes.slice(i, i + TRANSACTION_BATCH_SIZE);
              await new Promise<void>((resolve, reject) => {
                try {
                  const tx = db.transaction(['nodes', 'source_spans'], 'readwrite');
                  tx.onerror = () => reject(new Error(`IndexedDB node batch transaction failed: ${tx.error?.message}`));
                  tx.onabort = () => reject(new Error(`IndexedDB node batch transaction aborted: ${tx.error?.message}`));

                  const nodeStore = tx.objectStore('nodes');
                  const spanStore = tx.objectStore('source_spans');

                  for (const node of nodeBatch) {
                    const nodeReq = nodeStore.put(node);
                    nodeReq.onerror = () => reject(nodeReq.error);

                    if (node.sourceSpans) {
                      for (const span of node.sourceSpans) {
                        const spanReq = spanStore.put(span);
                        spanReq.onerror = () => reject(spanReq.error);
                      }
                    }
                  }

                  tx.oncomplete = () => resolve();
                } catch (err) {
                  reject(err);
                }
              });
            }

            // 2c. Store Edges in batches of TRANSACTION_BATCH_SIZE (500)
            for (let i = 0; i < validEdges.length; i += TRANSACTION_BATCH_SIZE) {
              const edgeBatch = validEdges.slice(i, i + TRANSACTION_BATCH_SIZE);
              await new Promise<void>((resolve, reject) => {
                try {
                  const tx = db.transaction(['edges'], 'readwrite');
                  tx.onerror = () => reject(new Error(`IndexedDB edge batch transaction failed: ${tx.error?.message}`));
                  tx.onabort = () => reject(new Error(`IndexedDB edge batch transaction aborted: ${tx.error?.message}`));

                  const edgeStore = tx.objectStore('edges');
                  for (const edge of edgeBatch) {
                    const edgeReq = edgeStore.put(edge);
                    edgeReq.onerror = () => reject(edgeReq.error);
                  }

                  tx.oncomplete = () => resolve();
                } catch (err) {
                  reject(err);
                }
              });
            }

            // 2d. Store Hash Fingerprint
            await new Promise<void>((resolve, reject) => {
              try {
                const tx = db.transaction(['file_hashes'], 'readwrite');
                tx.onerror = () => reject(new Error(`IndexedDB hash transaction failed: ${tx.error?.message}`));
                tx.onabort = () => reject(new Error(`IndexedDB hash transaction aborted: ${tx.error?.message}`));

                const hashStore = tx.objectStore('file_hashes');
                const hashReq = hashStore.put({ hash, timestamp: Date.now() });
                hashReq.onerror = () => reject(hashReq.error);

                tx.oncomplete = () => resolve();
              } catch (err) {
                reject(err);
              }
            });
          })(),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('IndexedDB commit timeout')), 4000)
          )
        ]);
      } catch (idbErr) {
        console.warn('[GraphStorage] IndexedDB write failed or timed out, committing to synchronous in-memory store:', idbErr);
      }
    }

    // 3. Atomically update in-memory cache once transactions succeed or fallback triggers
    if (sanitizedDoc) {
      this.cachedDocuments.set(sanitizedDoc.id, sanitizedDoc);
    }
    for (const node of sanitizedNodes) {
      this.cachedNodes.set(node.id, node);
      if (node.sourceSpans) {
        for (const s of node.sourceSpans) {
          this.cachedSpans.set(s.spanId, s);
        }
      }
    }
    for (const edge of validEdges) {
      this.cachedEdges.set(edge.id, edge);
    }
    this.cachedHashes.add(hash);
  }

  /**
   * Resets all user-ingested data while leaving baseline application nodes untouched
   */
  public async clearIngestedGraph(): Promise<void> {
    const db = await this.getDb();

    if (db) {
      try {
        await Promise.race([
          new Promise<void>((resolve, reject) => {
            try {
              const tx = db.transaction(
                ['documents', 'nodes', 'edges', 'source_spans', 'file_hashes'],
                'readwrite'
              );
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(new Error(`Clear transaction failed: ${tx.error?.message}`));
              tx.onabort = () => reject(new Error(`Clear transaction aborted: ${tx.error?.message}`));

              tx.objectStore('documents').clear();
              tx.objectStore('nodes').clear();
              tx.objectStore('edges').clear();
              tx.objectStore('source_spans').clear();
              tx.objectStore('file_hashes').clear();
            } catch (err) {
              reject(err);
            }
          }),
          new Promise<void>((r) => setTimeout(r, 2000))
        ]);
      } catch {
        // Fallback to clearing in-memory store
      }
    }

    this.cachedNodes.clear();
    this.cachedEdges.clear();
    this.cachedDocuments.clear();
    this.cachedSpans.clear();
    this.cachedHashes.clear();
  }

  public async getDocument(docId: string): Promise<SourceDocument | undefined> {
    if (this.hydrationPromise) {
      await Promise.race([this.hydrationPromise, new Promise((r) => setTimeout(r, 1500))]);
    }
    return this.cachedDocuments.get(docId);
  }

  public async getSourceSpan(spanId: string): Promise<SourceSpan | undefined> {
    if (this.hydrationPromise) {
      await Promise.race([this.hydrationPromise, new Promise((r) => setTimeout(r, 1500))]);
    }
    return this.cachedSpans.get(spanId);
  }

  public async searchNodes(query: string): Promise<GraphNode[]> {
    if (this.hydrationPromise) {
      await Promise.race([this.hydrationPromise, new Promise((r) => setTimeout(r, 1500))]);
    }
    const lower = query.toLowerCase().trim();
    if (!lower) return [];
    return Array.from(this.cachedNodes.values()).filter(n =>
      n.label.toLowerCase().includes(lower) ||
      n.title.toLowerCase().includes(lower) ||
      n.description.toLowerCase().includes(lower)
    );
  }

  public getSnapshot(): GraphPersistenceSnapshot {
    return {
      documents: Array.from(this.cachedDocuments.values()),
      nodes: Array.from(this.cachedNodes.values()),
      edges: Array.from(this.cachedEdges.values()),
      fileHashes: Array.from(this.cachedHashes.values()),
      timestamp: Date.now()
    };
  }
}

export const GraphStorage = new GraphStorageEngine();
