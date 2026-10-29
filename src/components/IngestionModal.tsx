/**
 * Accessible Dark Cosmic Glassmorphic Ingestion Modal (src/components/IngestionModal.tsx)
 * Supports drag-and-drop file upload, format badges, granular progress, dual-mode toggle,
 * per-file error isolation, copyable error logs, and persistent graph reset.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Upload,
  FileText,
  FileCode,
  Table,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileUp,
  Trash2,
  HardDrive
} from 'lucide-react';
import type { IngestionBatchItem, IngestionProcessingMode } from '../types/graph';
import { processIngestionBatch } from '../services/ingestion/IngestionService';
import { GraphStorage } from '../storage/GraphStorage';

interface IngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngestionComplete?: (results?: IngestionBatchItem[]) => void;
  onOpenGoogleWorkspace?: () => void;
}

export const IngestionModal: React.FC<IngestionModalProps> = ({
  isOpen,
  onClose,
  onIngestionComplete,
  onOpenGoogleWorkspace
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMode, setProcessingMode] = useState<IngestionProcessingMode>('STRUCTURALLY_INGESTED');
  const [batchItems, setBatchItems] = useState<IngestionBatchItem[]>([]);
  const [progressIndex, setProgressIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Focus close button on open & handle Escape key
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isProcessing) {
          onClose();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isProcessing, onClose]);

  // Handle Drag & Drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
    }
  }, []);

  // Process selected files
  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setTotalFiles(files.length);
    setProgressIndex(0);
    setBatchItems([]);

    const itemsMap = new Map<string, IngestionBatchItem>();

    try {
      await processIngestionBatch(
        files,
        (idx, total, item) => {
          setProgressIndex(idx + 1);
          setTotalFiles(total);
          itemsMap.set(item.id, item);
          setBatchItems(Array.from(itemsMap.values()));
        },
        { processingMode }
      );

      // Trigger completion callback to rehydrate visual graph
      onIngestionComplete?.();
    } catch (err) {
      console.error('[IngestionModal] Batch processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHash(id);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch {
      setCopiedHash(id);
      setTimeout(() => setCopiedHash(null), 2000);
    }
  };

  const handleResetGraph = async () => {
    setIsResetting(true);
    try {
      await GraphStorage.clearIngestedGraph();
      setBatchItems([]);
      setShowResetConfirm(false);
      onIngestionComplete?.();
    } catch (err) {
      console.error('[IngestionModal] Reset failed:', err);
    } finally {
      setIsResetting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Document Ingestion & Epistemic Graph Pipeline"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => {
        if (!isProcessing) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] bg-slate-950/95 border border-cyan-500/30 rounded-2xl shadow-[0_0_35px_rgba(6,182,212,0.2)] flex flex-col overflow-hidden text-slate-100"
      >
        {/* Modal Header */}
        <header className="px-6 py-4 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-sans font-bold text-base text-slate-100 flex items-center gap-2">
                <span>Ingest Philosophical Manuscripts</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
                  PEC-Ω Grounded
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Markdown, Plaintext, PDF, JSON, and CSV ingestion with exact SourceSpan provenance.
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent hover:border-slate-700 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain">
          {/* Dual-Mode Selector (Invariant 8) */}
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-medium text-slate-200 block">Processing Mode</span>
              <span className="text-[11px] text-slate-400 font-mono">
                {processingMode === 'STRUCTURALLY_INGESTED'
                  ? 'Local Structural Mode: Deterministic parsing, 100% offline, zero AI calls.'
                  : 'AI-Enriched Semantic Mode: Schema-validated entity and proposition extraction.'}
              </span>
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setProcessingMode('STRUCTURALLY_INGESTED')}
                disabled={isProcessing}
                className={`px-3 py-1.5 rounded-md font-mono text-[11px] transition ${
                  processingMode === 'STRUCTURALLY_INGESTED'
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-600/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Local Structural
              </button>
              <button
                type="button"
                onClick={() => setProcessingMode('SEMANTICALLY_ENRICHED')}
                disabled={isProcessing}
                className={`px-3 py-1.5 rounded-md font-mono text-[11px] transition ${
                  processingMode === 'SEMANTICALLY_ENRICHED'
                    ? 'bg-purple-950 text-purple-300 border border-purple-600/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                AI Semantic
              </button>
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative p-8 rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer group ${
              isDragging
                ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                : 'border-slate-800 hover:border-cyan-500/40 bg-slate-900/30 hover:bg-slate-900/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".md,.markdown,.txt,.pdf,.json,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  handleFilesSelected(Array.from(e.target.files));
                }
              }}
            />

            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-cyan-500/50 flex items-center justify-center text-cyan-400 mb-3 shadow-inner transition">
              {isProcessing ? (
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>

            <p className="font-sans font-medium text-sm text-slate-200">
              Drag & drop philosophical documents here, or{' '}
              <span className="text-cyan-400 underline underline-offset-2">browse files</span>
            </p>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Supports .md, .markdown, .txt, .pdf, .json, .csv (Max 25 MiB per file)
            </p>

            {/* Format Capability Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 pt-3 border-t border-slate-800/60 text-[10px] font-mono text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 flex items-center gap-1">
                <FileText className="w-3 h-3 text-cyan-400" /> Markdown AST & [[Wikilinks]]
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 flex items-center gap-1">
                <FileCode className="w-3 h-3 text-blue-400" /> JSON Graph & Trees
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 flex items-center gap-1">
                <Table className="w-3 h-3 text-emerald-400" /> CSV Category Hubs
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 flex items-center gap-1">
                <FileText className="w-3 h-3 text-red-400" /> PDF Text Stream & Pages
              </span>
            </div>
          </div>

          {/* Google Workspace Direct Cloud Ingestion Trigger */}
          {onOpenGoogleWorkspace && (
            <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-900/60 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    Cloud Ingestion: Google Drive & Google Docs
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Directly pull Google Docs, Markdown, or text manuscripts stored in your Google Drive.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGoogleWorkspace();
                }}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-200 bg-blue-900/60 hover:bg-blue-800/80 border border-blue-400/50 transition active:scale-95 shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <HardDrive className="w-3.5 h-3.5 text-blue-300" />
                <span>Open Drive & Docs Hub</span>
              </button>
            </div>
          )}

          {/* Active Batch Progress Indicator */}
          {isProcessing && (
            <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Processing Batch ({progressIndex} of {totalFiles})
                </span>
                <span>{Math.round((progressIndex / Math.max(1, totalFiles)) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${(progressIndex / Math.max(1, totalFiles)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Batch Ingestion Status List */}
          {batchItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5">
                <span>Batch Processing Status ({batchItems.length})</span>
                <span className="text-[11px] text-slate-500 lowercase">isolated per-file execution</span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto overscroll-contain pr-1">
                {batchItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border text-xs font-mono transition ${
                      item.status === 'success'
                        ? 'bg-slate-900/60 border-slate-800'
                        : item.status === 'duplicate'
                        ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                        : item.status === 'error'
                        ? 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                        : 'bg-slate-900/40 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                        {item.status === 'duplicate' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                        {item.status === 'error' && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                        {item.status === 'processing' && <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />}

                        <div className="min-w-0">
                          <span className="font-semibold text-slate-200 truncate block">{item.fileName}</span>
                          <span className="text-[10px] text-slate-400 block">
                            {(item.fileSize / 1024).toFixed(1)} KB · {item.stageLabel || item.status}
                          </span>
                        </div>
                      </div>

                      {/* Hash Fingerprint Tag */}
                      {item.hash && (
                        <button
                          onClick={() => handleCopyText(item.hash!, item.id)}
                          title="Copy SHA-256 fingerprint"
                          className="px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 hover:text-white flex items-center gap-1 shrink-0 transition"
                        >
                          <span className="font-mono">{item.hash.substring(0, 8)}...</span>
                          {copiedHash === item.id ? (
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-2.5 h-2.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Summary or Error Message */}
                    {item.summary && (
                      <p className="mt-1.5 text-[11px] text-slate-300 font-sans border-t border-slate-800/60 pt-1">
                        {item.summary}
                      </p>
                    )}

                    {item.errorMessage && (
                      <div className="mt-1.5 p-2 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300 text-[11px] font-sans flex items-start justify-between gap-2">
                        <span>{item.errorMessage}</span>
                        <button
                          onClick={() => handleCopyText(item.errorMessage!, `err_${item.id}`)}
                          title="Copy error trace"
                          className="p-1 rounded hover:bg-rose-900/40 shrink-0 text-rose-400"
                        >
                          {copiedHash === `err_${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="px-6 py-3.5 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                disabled={isProcessing}
                className="text-xs font-mono text-slate-400 hover:text-rose-400 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Ingested Data</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-rose-400">Clear all ingested graph data?</span>
                <button
                  type="button"
                  onClick={handleResetGraph}
                  disabled={isResetting}
                  className="px-2.5 py-1 rounded bg-rose-950 border border-rose-700/60 text-rose-200 text-xs font-mono hover:bg-rose-900 transition"
                >
                  {isResetting ? 'Clearing...' : 'Yes, Reset'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-cyan-950/80 border border-cyan-500/60 hover:border-cyan-400 text-cyan-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition shadow-[0_0_12px_rgba(6,182,212,0.25)] active:scale-95 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Select Files</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
