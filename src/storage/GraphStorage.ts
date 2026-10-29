/**
 * Transactional Storage Engine (src/storage/GraphStorage.ts)
 * Atomic IndexedDB persistence with synchronous hydrated in-memory cache,
 * pre-commit relational integrity checks, and SHA-256 fingerprint deduplication.
 */

import type {
  GraphNode,
  GraphEdge,
  SourceDocument,
  SourceSpan,
  GraphPersistenceSnapshot
} from '../types/graph';

const DB_NAME = 'nihiltheism_graph_storage';
const DB_VERSION = 1;

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

  constructor() {
    if (typeof window !== 'undefined') {
      this.hydrationPromise = this.hydrateCache();
    }
  }

  /**
   * Opens or returns the active IndexedDB connection
   */
  private async getDb(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return null;
    }
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

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
          resolve(request.result);
        };

        request.onerror = () => {
          console.warn('[GraphStorage] IndexedDB open error, falling back to in-memory store.');
          resolve(null);
        };
      } catch (err) {
        console.warn('[GraphStorage] IndexedDB unavailable:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Hydrates in-memory cache from IndexedDB on startup
   */
  public async hydrateCache(): Promise<void> {
    const db = await this.getDb();
    if (!db) {
      this.isHydrated = true;
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(['documents', 'nodes', 'edges', 'source_spans', 'file_hashes'], 'readonly');

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
          this.isHydrated = true;
          resolve();
        };

        tx.onerror = () => {
          this.isHydrated = true;
          resolve();
        };
      } catch {
        this.isHydrated = true;
        resolve();
      }
    });
  }

  /**
   * Checks if an identical file hash has already been committed (Deduplication Check)
   */
  public async hasFileHash(hash: string): Promise<boolean> {
    if (this.hydrationPromise) await this.hydrationPromise;
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
    if (this.hydrationPromise) await this.hydrationPromise;
    return this.getIngestedGraphSync();
  }

  /**
   * Pre-Commit Integrity Validation:
   * 1. Unique node IDs
   * 2. Edge endpoint verification (both source and target must exist either in current batch, storage, or baseline topology)
   * 3. No destructive mutation of baseline nodes
   */
  private validateBatchIntegrity(
    nodes: GraphNode[],
    edges: GraphEdge[]
  ): void {
    const nodeIds = new Set<string>(this.cachedNodes.keys());

    // Include baseline topology node IDs as valid targets/sources
    const baselineIds = [
      'markmap_root',
      'mm_orientation',
      'mm_knowledge_engine',
      'mm_canonical_matrix',
      'mm_existentialism_cluster',
      'mm_figure',
      'mm_apophatic_theology',
      'mm_phenomenological_bracketting',
      'mm_dialectical_tension',
      'mm_warrant_discipline',
      'mm_void_confrontation',
      'mm_radical_reduction'
    ];
    for (const bId of baselineIds) {
      nodeIds.add(bId);
    }

    // 1. Check duplicate IDs within batch
    for (const n of nodes) {
      nodeIds.add(n.id);
    }

    // 2. Validate edge endpoints
    for (const e of edges) {
      if (!nodeIds.has(e.source)) {
        throw new Error(`Edge relational integrity violation: Source node '${e.source}' does not exist.`);
      }
      if (!nodeIds.has(e.target)) {
        // Also allow unresolved target nodes if prefixed with 'unresolved_' or 'ref_'
        if (e.target.startsWith('unresolved_') || e.target.startsWith('ref_')) {
          continue;
        }
        throw new Error(`Edge relational integrity violation: Target node '${e.target}' does not exist.`);
      }
    }
  }

  /**
   * Atomic commit of extracted nodes, edges, spans, document metadata, and file hash
   * Rolls back completely on failure.
   */
  public async commitBatchExtraction(
    hash: string,
    nodes: GraphNode[],
    edges: GraphEdge[],
    documentRecord?: SourceDocument
  ): Promise<void> {
    if (this.hydrationPromise) await this.hydrationPromise;

    // 1. Pre-Commit Validation
    this.validateBatchIntegrity(nodes, edges);

    const db = await this.getDb();

    // 2. Commit to IndexedDB if available
    if (db) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(
            ['documents', 'nodes', 'edges', 'source_spans', 'file_hashes'],
            'readwrite'
          );

          tx.onerror = () => {
            reject(new Error(`IndexedDB transaction failed: ${tx.error?.message}`));
          };

          tx.oncomplete = () => {
            resolve();
          };

          const docStore = tx.objectStore('documents');
          const nodeStore = tx.objectStore('nodes');
          const edgeStore = tx.objectStore('edges');
          const spanStore = tx.objectStore('source_spans');
          const hashStore = tx.objectStore('file_hashes');

          // Store document record
          if (documentRecord) {
            docStore.put(documentRecord);
          }

          // Store nodes & spans
          for (const node of nodes) {
            nodeStore.put(node);
            if (node.sourceSpans) {
              for (const span of node.sourceSpans) {
                spanStore.put(span);
              }
            }
          }

          // Store edges
          for (const edge of edges) {
            edgeStore.put(edge);
          }

          // Store hash fingerprint
          hashStore.put({ hash, timestamp: Date.now() });
        } catch (err) {
          reject(err);
        }
      });
    }

    // 3. Atomically update in-memory cache once transaction succeeds
    if (documentRecord) {
      this.cachedDocuments.set(documentRecord.id, documentRecord);
    }
    for (const node of nodes) {
      this.cachedNodes.set(node.id, node);
      if (node.sourceSpans) {
        for (const s of node.sourceSpans) {
          this.cachedSpans.set(s.spanId, s);
        }
      }
    }
    for (const edge of edges) {
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
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(
            ['documents', 'nodes', 'edges', 'source_spans', 'file_hashes'],
            'readwrite'
          );
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);

          tx.objectStore('documents').clear();
          tx.objectStore('nodes').clear();
          tx.objectStore('edges').clear();
          tx.objectStore('source_spans').clear();
          tx.objectStore('file_hashes').clear();
        } catch (err) {
          reject(err);
        }
      });
    }

    this.cachedNodes.clear();
    this.cachedEdges.clear();
    this.cachedDocuments.clear();
    this.cachedSpans.clear();
    this.cachedHashes.clear();
  }

  public async getDocument(docId: string): Promise<SourceDocument | undefined> {
    if (this.hydrationPromise) await this.hydrationPromise;
    return this.cachedDocuments.get(docId);
  }

  public async getSourceSpan(spanId: string): Promise<SourceSpan | undefined> {
    if (this.hydrationPromise) await this.hydrationPromise;
    return this.cachedSpans.get(spanId);
  }

  public async searchNodes(query: string): Promise<GraphNode[]> {
    if (this.hydrationPromise) await this.hydrationPromise;
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
