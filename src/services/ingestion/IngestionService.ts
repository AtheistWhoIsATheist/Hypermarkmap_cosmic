/**
 * Ingestion Orchestrator Service (src/services/ingestion/IngestionService.ts)
 * 
 * Orchestrates the 16-stage ingestion lifecycle: validation, Web Crypto SHA-256,
 * deduplication, parser strategy dispatch, linear O(N) Inverted Token Index semantic
 * edge synthesis, atomic persistence, real-time stage progress telemetry,
 * safety timeouts (15s), cooperative macrotask yields, and detailed stage-level
 * telemetry logging (execution duration, Node.js process.memoryUsage() tracking,
 * robust error contexts with stack traces, Winston/Bunyan format compatibility,
 * and configurable threshold-based conditional logging for 500MB+ files).
 * 
 * @example
 * ```ts
 * // Example: Initializing and configuring the PipelineStageLogger
 * import { PipelineStageLogger, IngestionService } from './IngestionService';
 * 
 * const logger = new PipelineStageLogger({
 *   minDurationMsThreshold: 100, // Only log stages taking >= 100ms
 *   minMemoryDeltaBytesThreshold: 2 * 1024 * 1024, // Only log if memory delta >= 2MB
 *   logLevel: 'info',
 *   logAlwaysOnError: true,
 *   format: 'both' // Outputs readable text and Bunyan/Winston JSON
 * });
 * 
 * const service = new IngestionService(logger);
 * const item = await service.ingestFile(myLargeFile, {
 *   processingMode: 'STRUCTURALLY_INGESTED',
 *   stageTimeoutMs: 30000
 * });
 * ```
 */

import type {
  IngestionBatchItem,
  SupportedMimeType,
  GraphNode,
  GraphEdge,
  SourceDocument,
  IngestionProcessingMode
} from '../../types/graph';
import { computeFileSha256, validateFileHeaderAndMime, generateScopedId } from '../../utils/crypto';
import { GraphStorage } from '../../storage/GraphStorage';
import type { FileParser, ParserOptions } from '../parsers/BaseParser';
import { yieldToMain } from '../parsers/BaseParser';
import { MarkdownParser } from '../parsers/MarkdownParser';
import { TextParser } from '../parsers/TextParser';
import { JsonParser } from '../parsers/JsonParser';
import { CsvParser } from '../parsers/CsvParser';
import { PdfParser } from '../parsers/PdfParser';

// ============================================================================
// STAGE TELEMETRY & LOGGING UTILITY INTERFACES & IMPLEMENTATION
// ============================================================================

/**
 * Snapshot of process memory usage in bytes.
 * Adheres to Node.js process.memoryUsage() structure.
 */
export interface PipelineMemorySnapshot {
  /** Resident Set Size (total memory allocated for the process) */
  rss: number;
  /** Total size of the allocated heap */
  heapTotal: number;
  /** Actual memory used during execution */
  heapUsed: number;
  /** Memory used by C++ objects bound to JavaScript objects */
  external: number;
  /** Memory allocated for ArrayBuffers and SharedArrayBuffers */
  arrayBuffers: number;
}

/**
 * Detailed telemetry metrics captured for a single pipeline stage execution.
 */
export interface PipelineStageMetrics {
  /** Human-readable name of the pipeline stage */
  stageName: string;
  /** Epoch timestamp in ms when the stage started */
  startTime: number;
  /** Epoch timestamp in ms when the stage concluded */
  endTime: number;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Memory consumption snapshot taken immediately before stage execution */
  memoryBefore: PipelineMemorySnapshot;
  /** Memory consumption snapshot taken immediately after stage execution */
  memoryAfter: PipelineMemorySnapshot;
  /** Net difference in memory usage (bytes) between end and start */
  memoryDeltaBytes: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  /** Arbitrary contextual parameters supplied for this stage (e.g. file size, hash) */
  context: Record<string, unknown>;
  /** Error information if stage execution threw an exception */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  /** Whether the stage duration exceeded the predefined time threshold */
  exceededDurationThreshold: boolean;
  /** Whether the stage memory delta exceeded the predefined memory threshold */
  exceededMemoryThreshold: boolean;
}

/**
 * External logger contract compatible with standard Winston or Bunyan loggers.
 */
export interface IExternalLogger {
  info(message: string, ...meta: any[]): void;
  warn(message: string, ...meta: any[]): void;
  error(message: string, ...meta: any[]): void;
  debug?(message: string, ...meta: any[]): void;
}

/**
 * Bunyan-compliant JSON log record format.
 */
export interface BunyanLogRecord {
  name: string;
  hostname: string;
  pid: number;
  level: number; // 20: DEBUG, 30: INFO, 40: WARN, 50: ERROR
  msg: string;
  time: string; // ISO-8601
  stage: string;
  durationMs: number;
  memoryDeltaBytes: number;
  memory: {
    before: PipelineMemorySnapshot;
    after: PipelineMemorySnapshot;
    delta: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
  };
  context: Record<string, unknown>;
  err?: {
    name: string;
    message: string;
    stack?: string;
  };
  [key: string]: unknown;
}

/**
 * Winston-compliant JSON log record format.
 */
export interface WinstonLogRecord {
  level: string; // 'info' | 'warn' | 'error' | 'debug'
  message: string;
  timestamp: string; // ISO-8601
  service: string;
  stage: string;
  durationMs: number;
  memoryDeltaBytes: number;
  memoryBefore: PipelineMemorySnapshot;
  memoryAfter: PipelineMemorySnapshot;
  context: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  [key: string]: unknown;
}

/**
 * Configuration options for the pipeline stage logging utility.
 */
export interface IngestionLoggerConfig {
  /**
   * Minimum execution duration in milliseconds required to trigger stage logging.
   * Helps eliminate overhead during rapid, trivial steps on large files.
   * Default: 50 ms. Set to 0 to log every executed stage.
   */
  minDurationMsThreshold: number;

  /**
   * Minimum heap memory growth in bytes required to trigger stage logging.
   * Default: 1,048,576 bytes (1 MB). Set to 0 to log regardless of memory growth.
   */
  minMemoryDeltaBytesThreshold: number;

  /**
   * Whether to unconditionally log exceptions regardless of duration or memory thresholds.
   * Default: true.
   */
  logAlwaysOnError: boolean;

  /**
   * Log verbosity level.
   * Default: 'info'. Set to 'silent' to disable output, or 'debug' to bypass all thresholds.
   */
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'silent';

  /**
   * Output format:
   * - 'bunyan': Structured JSON matching Bunyan schema.
   * - 'winston': Structured JSON matching Winston schema.
   * - 'text': Human-readable formatted string.
   * - 'both': Text summary accompanied by machine-readable JSON object.
   * Default: 'both'.
   */
  format: 'bunyan' | 'winston' | 'text' | 'both';

  /**
   * Optional custom Winston, Bunyan, or third-party logger instance.
   * When provided, log dispatches are routed through this logger.
   */
  customLogger?: IExternalLogger;

  /**
   * Maximum number of recent stage telemetry metrics to retain in memory history.
   * Default: 200.
   */
  maxHistoryRecords: number;
}

/**
 * Captures process memory usage snapshot in bytes.
 * Safely executes in Node.js (via process.memoryUsage()) and provides browser fallbacks.
 */
export function captureMemorySnapshot(): PipelineMemorySnapshot {
  if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
    try {
      const mem = process.memoryUsage();
      return {
        rss: mem.rss || 0,
        heapTotal: mem.heapTotal || 0,
        heapUsed: mem.heapUsed || 0,
        external: mem.external || 0,
        arrayBuffers: mem.arrayBuffers || 0
      };
    } catch {
      // In case process.memoryUsage() is restricted
    }
  }

  // Fallback for Chromium-based browser environments exposing window.performance.memory
  if (typeof window !== 'undefined' && (window.performance as any)?.memory) {
    try {
      const perfMem = (window.performance as any).memory;
      const heapUsed = perfMem.usedJSHeapSize || 0;
      const totalHeap = perfMem.totalJSHeapSize || 0;
      return {
        rss: totalHeap,
        heapTotal: totalHeap,
        heapUsed,
        external: 0,
        arrayBuffers: 0
      };
    } catch {
      // Fallback
    }
  }

  return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };
}

/**
 * Detailed pipeline stage logging utility.
 * 
 * Provides:
 * 1. Millisecond-accurate execution timing (performance.now() / Date.now()).
 * 2. Before/after memory difference tracking via Node.js process.memoryUsage().
 * 3. Deep contextual error logging capturing stage names, inputs, and stack traces.
 * 4. Conditional thresholding to eliminate CPU/IO overhead on 500MB+ document parsing.
 * 5. Native compatibility with Winston and Bunyan structured log schemas.
 */
export class PipelineStageLogger {
  private config: IngestionLoggerConfig;
  private history: PipelineStageMetrics[] = [];

  constructor(customConfig?: Partial<IngestionLoggerConfig>) {
    this.config = {
      minDurationMsThreshold: 50,
      minMemoryDeltaBytesThreshold: 1024 * 1024, // 1 MB
      logAlwaysOnError: true,
      logLevel: 'info',
      format: 'both',
      maxHistoryRecords: 200,
      ...customConfig
    };
  }

  /**
   * Retrieves active logger configuration
   */
  public getConfig(): IngestionLoggerConfig {
    return { ...this.config };
  }

  /**
   * Updates logger configuration options
   */
  public updateConfig(patch: Partial<IngestionLoggerConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  /**
   * Retrieves historical stage metrics
   */
  public getMetricsHistory(): PipelineStageMetrics[] {
    return [...this.history];
  }

  /**
   * Clears in-memory metrics history
   */
  public clearMetricsHistory(): void {
    this.history = [];
  }

  /**
   * Wraps and executes a pipeline stage action with full metrics and error telemetry.
   * 
   * @param stageName - Identifier for the stage (e.g. 'Parsing document structure...')
   * @param context - Contextual input parameters (fileName, fileSize, mimeType, hash, etc.)
   * @param stageFn - Asynchronous action to execute
   * @returns Result of the executed stage action
   * @throws Rethrows any caught exception after recording telemetry and contextual error logs
   */
  public async executeStage<T>(
    stageName: string,
    context: Record<string, unknown>,
    stageFn: () => Promise<T>
  ): Promise<T> {
    const startTimePerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const startTimeEpoch = Date.now();
    const memoryBefore = captureMemorySnapshot();

    let stageError: Error | null = null;
    let result: T;

    try {
      result = await stageFn();
      return result;
    } catch (err: unknown) {
      stageError = err instanceof Error ? err : new Error(String(err));
      throw stageError;
    } finally {
      const endTimePerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const endTimeEpoch = Date.now();
      const durationMs = Math.max(0, Math.round((endTimePerf - startTimePerf) * 100) / 100);
      const memoryAfter = captureMemorySnapshot();

      const deltaHeapUsed = memoryAfter.heapUsed - memoryBefore.heapUsed;
      const deltaRss = memoryAfter.rss - memoryBefore.rss;
      const deltaHeapTotal = memoryAfter.heapTotal - memoryBefore.heapTotal;
      const deltaExternal = memoryAfter.external - memoryBefore.external;

      const exceededDurationThreshold = durationMs >= this.config.minDurationMsThreshold;
      const exceededMemoryThreshold = Math.abs(deltaHeapUsed) >= this.config.minMemoryDeltaBytesThreshold;

      const metrics: PipelineStageMetrics = {
        stageName,
        startTime: startTimeEpoch,
        endTime: endTimeEpoch,
        durationMs,
        memoryBefore,
        memoryAfter,
        memoryDeltaBytes: {
          rss: deltaRss,
          heapUsed: deltaHeapUsed,
          heapTotal: deltaHeapTotal,
          external: deltaExternal
        },
        context: { ...context },
        exceededDurationThreshold,
        exceededMemoryThreshold
      };

      if (stageError) {
        metrics.error = {
          name: stageError.name || 'Error',
          message: stageError.message || 'Unknown stage execution error',
          stack: stageError.stack
        };
      }

      this.recordMetrics(metrics);
      this.evaluateAndEmitLog(metrics);
    }
  }

  /**
   * Appends metrics record to history buffer, maintaining max capacity
   */
  private recordMetrics(metrics: PipelineStageMetrics): void {
    this.history.push(metrics);
    if (this.history.length > this.config.maxHistoryRecords) {
      this.history.shift();
    }
  }

  /**
   * Evaluates conditional thresholds and emits structured log entry
   */
  private evaluateAndEmitLog(metrics: PipelineStageMetrics): void {
    if (this.config.logLevel === 'silent') {
      return;
    }

    const hasError = !!metrics.error;
    const isDebug = this.config.logLevel === 'debug';
    const shouldLog =
      (hasError && this.config.logAlwaysOnError) ||
      isDebug ||
      metrics.exceededDurationThreshold ||
      metrics.exceededMemoryThreshold;

    if (!shouldLog) {
      return;
    }

    // Determine target level
    let level: 'debug' | 'info' | 'warn' | 'error' = 'info';
    if (hasError) {
      level = 'error';
    } else if (metrics.durationMs > 5000 || Math.abs(metrics.memoryDeltaBytes.heapUsed) > 50 * 1024 * 1024) {
      level = 'warn';
    } else if (isDebug) {
      level = 'debug';
    }

    // Dispatch to custom logger if configured
    if (this.config.customLogger) {
      this.dispatchToCustomLogger(this.config.customLogger, level, metrics);
      return;
    }

    // Standard console output with Winston/Bunyan compliance
    this.dispatchToConsole(level, metrics);
  }

  /**
   * Formats a metrics snapshot into a Bunyan-compliant JSON object
   */
  public formatBunyan(metrics: PipelineStageMetrics): BunyanLogRecord {
    const levelCode = metrics.error ? 50 : metrics.durationMs > 5000 ? 40 : 30;
    return {
      name: 'nihiltheism-ingestion',
      hostname: typeof process !== 'undefined' && process.env?.HOSTNAME ? process.env.HOSTNAME : 'localhost',
      pid: typeof process !== 'undefined' && typeof process.pid === 'number' ? process.pid : 1,
      level: levelCode,
      msg: metrics.error
        ? `Stage '${metrics.stageName}' failed after ${metrics.durationMs}ms: ${metrics.error.message}`
        : `Stage '${metrics.stageName}' completed in ${metrics.durationMs}ms (heap delta: ${this.formatBytes(metrics.memoryDeltaBytes.heapUsed)})`,
      time: new Date(metrics.endTime).toISOString(),
      stage: metrics.stageName,
      durationMs: metrics.durationMs,
      memoryDeltaBytes: metrics.memoryDeltaBytes.heapUsed,
      memory: {
        before: metrics.memoryBefore,
        after: metrics.memoryAfter,
        delta: metrics.memoryDeltaBytes
      },
      context: metrics.context,
      err: metrics.error
    };
  }

  /**
   * Formats a metrics snapshot into a Winston-compliant JSON object
   */
  public formatWinston(metrics: PipelineStageMetrics): WinstonLogRecord {
    const level = metrics.error ? 'error' : metrics.durationMs > 5000 ? 'warn' : 'info';
    return {
      level,
      message: metrics.error
        ? `[Ingestion Pipeline] ${metrics.stageName} FAILED: ${metrics.error.message}`
        : `[Ingestion Pipeline] ${metrics.stageName} executed in ${metrics.durationMs}ms`,
      timestamp: new Date(metrics.endTime).toISOString(),
      service: 'ingestion-service',
      stage: metrics.stageName,
      durationMs: metrics.durationMs,
      memoryDeltaBytes: metrics.memoryDeltaBytes.heapUsed,
      memoryBefore: metrics.memoryBefore,
      memoryAfter: metrics.memoryAfter,
      context: metrics.context,
      error: metrics.error
    };
  }

  /**
   * Renders human-readable summary string
   */
  public formatText(level: string, metrics: PipelineStageMetrics): string {
    const deltaStr = this.formatBytes(metrics.memoryDeltaBytes.heapUsed);
    const prefix = `[Pipeline:${metrics.stageName}]`;
    if (metrics.error) {
      return `${prefix} [${level.toUpperCase()}] FAILED after ${metrics.durationMs}ms (Memory delta: ${deltaStr}) | Context: ${JSON.stringify(metrics.context)} | Error: ${metrics.error.message}\nStack: ${metrics.error.stack || 'No stack trace'}`;
    }
    return `${prefix} [${level.toUpperCase()}] Completed in ${metrics.durationMs}ms | Heap delta: ${deltaStr} | Context: ${JSON.stringify(metrics.context)}`;
  }

  private dispatchToCustomLogger(
    logger: IExternalLogger,
    level: 'debug' | 'info' | 'warn' | 'error',
    metrics: PipelineStageMetrics
  ): void {
    const bunyanPayload = this.formatBunyan(metrics);
    const textMsg = this.formatText(level, metrics);

    switch (level) {
      case 'error':
        logger.error(textMsg, bunyanPayload);
        break;
      case 'warn':
        logger.warn(textMsg, bunyanPayload);
        break;
      case 'debug':
        if (logger.debug) {
          logger.debug(textMsg, bunyanPayload);
        } else {
          logger.info(textMsg, bunyanPayload);
        }
        break;
      case 'info':
      default:
        logger.info(textMsg, bunyanPayload);
        break;
    }
  }

  private dispatchToConsole(level: 'debug' | 'info' | 'warn' | 'error', metrics: PipelineStageMetrics): void {
    const text = this.formatText(level, metrics);
    const payload = this.config.format === 'bunyan'
      ? this.formatBunyan(metrics)
      : this.formatWinston(metrics);

    switch (level) {
      case 'error':
        if (this.config.format === 'text') {
          console.error(text);
        } else if (this.config.format === 'both') {
          console.error(text, payload);
        } else {
          console.error(JSON.stringify(payload));
        }
        break;
      case 'warn':
        if (this.config.format === 'text') {
          console.warn(text);
        } else if (this.config.format === 'both') {
          console.warn(text, payload);
        } else {
          console.warn(JSON.stringify(payload));
        }
        break;
      case 'debug':
        if (this.config.format === 'text') {
          console.debug(text);
        } else if (this.config.format === 'both') {
          console.debug(text, payload);
        } else {
          console.debug(JSON.stringify(payload));
        }
        break;
      case 'info':
      default:
        if (this.config.format === 'text') {
          console.info(text);
        } else if (this.config.format === 'both') {
          console.info(text, payload);
        } else {
          console.info(JSON.stringify(payload));
        }
        break;
    }
  }

  private formatBytes(bytes: number): string {
    const sign = bytes >= 0 ? '+' : '-';
    const abs = Math.abs(bytes);
    if (abs < 1024) return `${sign}${abs} B`;
    if (abs < 1024 * 1024) return `${sign}${(abs / 1024).toFixed(2)} KB`;
    return `${sign}${(abs / (1024 * 1024)).toFixed(2)} MB`;
  }
}

// ============================================================================
// INGESTION OPTIONS & TIMEOUT HELPERS
// ============================================================================

export interface IngestionOptions extends ParserOptions {
  processingMode?: IngestionProcessingMode;
  stageTimeoutMs?: number;
  /** Optional logger configuration overrides for this ingestion run */
  loggerConfig?: Partial<IngestionLoggerConfig>;
}

const DEFAULT_STAGE_TIMEOUT_MS = 15000; // 15 seconds safety timeout per stage to guarantee zero UI hangs

/**
 * Runs a promise with an explicit stage safety timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, stageName: string): Promise<T> {
  let timer: any = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout: Ingestion exceeded ${ms / 1000}s limit at stage: '${stageName}'.`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Extracts up to 12 salient tokens (lowercase, alphanumeric, length >= 4, excluding stop words)
 */
function extractSalientTokens(text: string, maxTokens = 12): Set<string> {
  const STOP_WORDS = new Set([
    'this', 'that', 'with', 'from', 'have', 'were', 'which', 'their', 'there',
    'about', 'would', 'could', 'should', 'these', 'those', 'where', 'after',
    'before', 'under', 'between', 'through', 'into', 'being', 'other', 'another',
    'such', 'more', 'most', 'some', 'than', 'them', 'then', 'they', 'when',
    'also', 'each', 'very', 'only', 'even', 'over', 'both', 'here', 'just'
  ]);
  const tokens = new Set<string>();
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  for (const w of words) {
    if (w.length >= 4 && !STOP_WORDS.has(w)) {
      tokens.add(w);
      if (tokens.size >= maxTokens) break;
    }
  }
  return tokens;
}

/**
 * Builds linear O(N) semantic edges using an Inverted Token Index
 * Bounded to at most 25 candidates per node and requiring at least 2 shared salient keywords.
 */
function buildSemanticEdgesLinear(nodes: GraphNode[], fileHash: string): GraphEdge[] {
  const invertedIndex = new Map<string, string[]>();
  const nodeTokens = new Map<string, Set<string>>();

  for (const node of nodes) {
    if (node.nodeKind === 'document-hub') continue;
    const tokens = extractSalientTokens(`${node.label} ${node.title} ${node.content || ''}`, 12);
    nodeTokens.set(node.id, tokens);
    for (const token of tokens) {
      let bucket = invertedIndex.get(token);
      if (!bucket) {
        bucket = [];
        invertedIndex.set(token, bucket);
      }
      if (bucket.length < 100) {
        bucket.push(node.id);
      }
    }
  }

  const edges: GraphEdge[] = [];
  const seenPairs = new Set<string>();

  for (const node of nodes) {
    if (node.nodeKind === 'document-hub') continue;
    const tokens = nodeTokens.get(node.id);
    if (!tokens || tokens.size === 0) continue;

    const sharedCounts = new Map<string, number>();
    for (const token of tokens) {
      const peers = invertedIndex.get(token) || [];
      for (const peerId of peers) {
        if (peerId === node.id) continue;
        sharedCounts.set(peerId, (sharedCounts.get(peerId) || 0) + 1);
        if (sharedCounts.size >= 25) break;
      }
      if (sharedCounts.size >= 25) break;
    }

    for (const [peerId, overlap] of sharedCounts.entries()) {
      if (overlap < 2) continue; // Require at least 2 shared salient keywords
      const pairKey = node.id < peerId ? `${node.id}:${peerId}` : `${peerId}:${node.id}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const edgeId = generateScopedId('edge', fileHash, `sem_${pairKey}`);
      edges.push({
        id: edgeId,
        source: node.id,
        target: peerId,
        relationType: 'relates_to',
        edgeCategory: 'philosophical',
        confidenceStatus: 'strongly-supported-inference',
        label: 'relates to',
        weight: Math.min(1.0, 0.4 + overlap * 0.15)
      });
    }
  }

  return edges;
}

/**
 * Builds sequential section edges (prev -> next) across extracted sections
 */
function buildSequentialSectionEdges(nodes: GraphNode[], fileHash: string): GraphEdge[] {
  const sections = nodes.filter((n) => n.nodeKind === 'section');
  const edges: GraphEdge[] = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const s1 = sections[i];
    const s2 = sections[i + 1];
    const edgeId = generateScopedId('edge', fileHash, `seq_${s1.id}_${s2.id}`);
    edges.push({
      id: edgeId,
      source: s1.id,
      target: s2.id,
      relationType: 'precedes',
      edgeCategory: 'structural',
      confidenceStatus: 'source-explicit',
      label: 'precedes',
      weight: 0.8
    });
  }
  return edges;
}

// ============================================================================
// INGESTION ORCHESTRATOR SERVICE
// ============================================================================

export class IngestionService {
  public stageLogger: PipelineStageLogger;
  private parsers: FileParser[] = [
    new MarkdownParser(),
    new TextParser(),
    new JsonParser(),
    new CsvParser(),
    new PdfParser()
  ];

  constructor(stageLogger?: PipelineStageLogger | Partial<IngestionLoggerConfig>) {
    if (stageLogger instanceof PipelineStageLogger) {
      this.stageLogger = stageLogger;
    } else {
      this.stageLogger = new PipelineStageLogger(stageLogger);
    }
  }

  /**
   * Dispatches parser strategy based on MIME type and file extension
   */
  private selectParser(mimeType: string, fileName: string): FileParser {
    const ext = `.${fileName.split('.').pop()?.toLowerCase() || ''}`;
    for (const parser of this.parsers) {
      if (parser.canHandle(mimeType, ext)) {
        return parser;
      }
    }
    return this.parsers[1]; // Default fallback to TextParser
  }

  /**
   * Processes a single file through the 16-stage ingestion pipeline with live stage progress,
   * comprehensive metric tracking (timing + Node.js process.memoryUsage()), contextual error handling,
   * and threshold-based conditional logging.
   */
  public async ingestFile(
    file: File,
    options: IngestionOptions = {}
  ): Promise<IngestionBatchItem> {
    const fileId = generateScopedId('doc', Date.now().toString(), file.name);
    const stageTimeout = options.stageTimeoutMs || DEFAULT_STAGE_TIMEOUT_MS;

    // Apply per-invocation logger config overrides if specified
    if (options.loggerConfig) {
      this.stageLogger.updateConfig(options.loggerConfig);
    }

    const batchItem: IngestionBatchItem = {
      id: fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'text/plain',
      status: 'processing',
      stageLabel: 'Validating format & size guardrails',
      processingMode: options.processingMode || 'STRUCTURALLY_INGESTED',
      warnings: []
    };

    const updateStage = (label: string) => {
      batchItem.stageLabel = label;
      options.onProgress?.(label);
    };

    const fileContext = {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      initialMime: file.type || 'text/plain',
      processingMode: batchItem.processingMode
    };

    try {
      // Step 1: File Validation (Size check, 64-byte magic-byte inspection)
      updateStage('Validating format & size guardrails');
      await yieldToMain();

      const validation = await this.stageLogger.executeStage(
        'Validating format & size guardrails',
        fileContext,
        () => withTimeout(
          validateFileHeaderAndMime(file),
          stageTimeout,
          'Validating format & size guardrails'
        )
      );

      if (!validation.isValid) {
        batchItem.status = 'error';
        batchItem.errorMessage = validation.error || 'File validation failed.';
        updateStage(`Validation error: ${batchItem.errorMessage}`);
        return batchItem;
      }

      batchItem.mimeType = validation.detectedMime;
      updateStage('Computing SHA-256 fingerprint');
      await yieldToMain();

      // Step 2: Cryptographic Hashing (Composite 3-point streaming for > 8MB)
      const hash = await this.stageLogger.executeStage(
        'Computing SHA-256 fingerprint',
        { ...fileContext, detectedMime: validation.detectedMime },
        () => withTimeout(
          computeFileSha256(file),
          stageTimeout,
          'Computing SHA-256 fingerprint'
        )
      );
      batchItem.hash = hash;
      updateStage('Checking deduplication status');
      await yieldToMain();

      // Step 3: Deduplication Check
      const alreadyIngested = await this.stageLogger.executeStage(
        'Checking deduplication status',
        { ...fileContext, hash },
        () => GraphStorage.hasFileHash(hash)
      );

      if (alreadyIngested) {
        batchItem.status = 'duplicate';
        batchItem.stageLabel = 'Identical file already ingested (SHA-256 match)';
        batchItem.summary = `File '${file.name}' matches an existing fingerprint in the knowledge graph. Skipped duplicate re-ingestion.`;
        options.onProgress?.(batchItem.stageLabel);
        return batchItem;
      }

      // Step 4: Parser Strategy Dispatch with streaming slice reader
      updateStage('Parsing document structure...');
      await yieldToMain();

      const parser = this.selectParser(batchItem.mimeType, file.name);
      const parsedPayload = await this.stageLogger.executeStage(
        'Parsing document structure...',
        { ...fileContext, hash, detectedMime: batchItem.mimeType, parser: parser.constructor.name },
        () => withTimeout(
          parser.parse(file, hash, {
            ...options,
            onProgress: (label) => {
              updateStage(label);
            }
          }),
          stageTimeout * 2, // Allow extra time for huge documents up to 500MB
          'Parsing document structure'
        )
      );
      await yieldToMain();

      // Step 5: Semantic Discrimination & Philosophical Anchoring
      updateStage('Grounding philosophical coordinates & baseline relata');
      await yieldToMain();

      const nodes = parsedPayload.nodes;
      const edges = [...parsedPayload.edges];

      // Ensure processing mode is labeled on all nodes
      const mode = options.processingMode || 'STRUCTURALLY_INGESTED';
      for (const n of nodes) {
        n.processingMode = mode;
      }

      // Step 6: Baseline Grounding Links
      await this.stageLogger.executeStage(
        'Grounding philosophical coordinates & baseline relata',
        { ...fileContext, hash, extractedNodes: nodes.length, extractedEdges: edges.length },
        async () => {
          this.groundToBaselineTopology(nodes, edges, hash);
          await yieldToMain();
        }
      );

      // Step 7: Linear O(N) Inverted Token Index Semantic Edge Discovery
      updateStage('Synthesizing relational topology via Inverted Index');
      await yieldToMain();

      const { semanticEdges, sequentialEdges } = await this.stageLogger.executeStage(
        'Synthesizing relational topology via Inverted Index',
        { ...fileContext, hash, nodeCount: nodes.length },
        async () => {
          const sEdges = buildSemanticEdgesLinear(nodes, hash);
          const seqEdges = buildSequentialSectionEdges(nodes, hash);
          return { semanticEdges: sEdges, sequentialEdges: seqEdges };
        }
      );
      edges.push(...semanticEdges, ...sequentialEdges);

      // Step 8: Adjacency Topology Mapping
      await this.stageLogger.executeStage(
        'Connecting topology adjacency',
        { ...fileContext, hash, totalNodes: nodes.length, totalEdges: edges.length },
        async () => {
          const nodeMap = new Map<string, GraphNode>();
          for (const node of nodes) {
            nodeMap.set(node.id, node);
          }
          for (const edge of edges) {
            const srcNode = nodeMap.get(edge.source);
            const tgtNode = nodeMap.get(edge.target);
            if (srcNode && !srcNode.connectedNodeIds.includes(edge.target)) {
              srcNode.connectedNodeIds.push(edge.target);
            }
            if (tgtNode && !tgtNode.connectedNodeIds.includes(edge.source)) {
              tgtNode.connectedNodeIds.push(edge.source);
            }
          }
          await yieldToMain();
        }
      );

      // Step 9: Atomic Persistence to Storage
      updateStage('Committing atomic graph state');
      await yieldToMain();

      const docRecord: SourceDocument = {
        id: nodes[0]?.id || fileId,
        hash,
        fileName: file.name,
        fileSize: file.size,
        mimeType: validation.detectedMime,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versionCount: 1,
        sectionsCount: nodes.filter((n) => n.nodeKind === 'section').length,
        spansCount: nodes.reduce((sum, n) => sum + (n.sourceSpans?.length || 0), 0),
        summary: parsedPayload.summary,
        processingMode: mode
      };

      await this.stageLogger.executeStage(
        'Committing atomic graph state',
        { ...fileContext, hash, docId: docRecord.id, nodeCount: nodes.length, edgeCount: edges.length },
        () => withTimeout(
          GraphStorage.commitBatchExtraction(hash, nodes, edges, docRecord),
          stageTimeout,
          'Committing atomic graph state'
        )
      );
      await yieldToMain();

      // Step 10: Finalized Success State
      batchItem.status = 'success';
      batchItem.stageLabel = 'Ingestion complete & graph committed';
      batchItem.extractedNodes = nodes;
      batchItem.extractedEdges = edges;
      batchItem.summary = parsedPayload.summary;
      options.onProgress?.(batchItem.stageLabel);

      return batchItem;
    } catch (err: unknown) {
      batchItem.status = 'error';
      const msg = err instanceof Error ? err.message : 'Unknown ingestion error';
      batchItem.errorMessage = msg;
      batchItem.stageLabel = `Failed: ${msg}`;
      options.onProgress?.(batchItem.stageLabel);
      return batchItem;
    }
  }

  /**
   * Deterministically links newly extracted thematic nodes to corresponding baseline topology hubs
   */
  private groundToBaselineTopology(
    nodes: GraphNode[],
    edges: GraphEdge[],
    fileHash: string
  ): void {
    const docHub = nodes.find((n) => n.nodeKind === 'document-hub');
    if (docHub) {
      // Connect document hub directly to baseline knowledge engine
      const rootEdgeId = generateScopedId('edge', fileHash, `${docHub.id}_baseline_root_ground`);
      edges.push({
        id: rootEdgeId,
        source: docHub.id,
        target: 'mm_knowledge_engine',
        relationType: 'articulates',
        edgeCategory: 'structural',
        confidenceStatus: 'source-explicit',
        label: 'articulates',
        weight: 0.8
      });
      if (!docHub.connectedNodeIds.includes('mm_knowledge_engine')) {
        docHub.connectedNodeIds.push('mm_knowledge_engine');
      }
    }

    for (const node of nodes) {
      if (node.nodeKind === 'document-hub') continue;

      let targetBaselineId: string | null = null;
      let relationType = 'parallels';

      if (node.thematicGroup === 'Nihilistic Pivot') {
        targetBaselineId = 'mm_orientation';
        relationType = 'develops';
      } else if (node.thematicGroup === 'Apophatic Dynamics') {
        targetBaselineId = 'mm_apophatic_theology';
        relationType = 'articulates';
      } else if (node.thematicGroup === 'Phenomenological Void') {
        targetBaselineId = 'mm_phenomenological_bracketting';
        relationType = 'develops';
      } else if (node.thematicGroup === 'Historical Lineage') {
        targetBaselineId = 'mm_figure';
        relationType = 'interprets';
      } else if (node.thematicGroup === 'Epistemic Architecture') {
        targetBaselineId = 'mm_knowledge_engine';
        relationType = 'develops';
      }

      if (targetBaselineId) {
        const edgeId = generateScopedId('edge', fileHash, `${node.id}_${targetBaselineId}_ground`);
        edges.push({
          id: edgeId,
          source: node.id,
          target: targetBaselineId,
          relationType,
          edgeCategory: 'philosophical',
          confidenceStatus: node.confidenceStatus || 'strongly-supported-inference',
          label: relationType,
          weight: 0.7
        });
        if (!node.connectedNodeIds.includes(targetBaselineId)) {
          node.connectedNodeIds.push(targetBaselineId);
        }
      }
    }
  }

  /**
   * Processes a batch of files sequentially with real-time progress callbacks for every stage
   */
  public async processBatch(
    files: File[],
    onProgress?: (index: number, total: number, item: IngestionBatchItem) => void,
    options?: IngestionOptions
  ): Promise<IngestionBatchItem[]> {
    const results: IngestionBatchItem[] = [];
    const total = files.length;

    for (let i = 0; i < total; i++) {
      const file = files[i];
      await yieldToMain();

      // Signal that file i has started processing
      const activeItem: IngestionBatchItem = {
        id: `file_${i}_${file.name}`,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'text/plain',
        status: 'processing',
        stageLabel: 'Validating format & size guardrails',
        processingMode: options?.processingMode || 'STRUCTURALLY_INGESTED',
        warnings: []
      };

      if (onProgress) {
        onProgress(i, total, activeItem);
      }
      await yieldToMain();

      // Ingest file with active stage updates forwarded to onProgress
      const item = await this.ingestFile(file, {
        ...options,
        onProgress: (stageLabel) => {
          activeItem.stageLabel = stageLabel;
          if (onProgress) {
            onProgress(i, total, { ...activeItem, stageLabel });
          }
        }
      });

      results.push(item);

      if (onProgress) {
        onProgress(i, total, item);
      }
      await yieldToMain();
    }

    return results;
  }
}

export const ingestionService = new IngestionService();

/**
 * Canonical modal invocation function matching the contract:
 * const results = await processIngestionBatch(files, (idx, total, item) => { ... });
 */
export async function processIngestionBatch(
  files: File[],
  onProgress?: (index: number, total: number, item: IngestionBatchItem) => void,
  options?: IngestionOptions
): Promise<IngestionBatchItem[]> {
  return ingestionService.processBatch(files, onProgress, options);
}
