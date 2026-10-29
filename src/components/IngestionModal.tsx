/**
 * Accessible Dark Cosmic Glassmorphic Ingestion Modal (src/components/IngestionModal.tsx)
 * Implements a deterministic 4-phase state machine (IDLE | QUEUED | PROCESSING | COMPLETED),
 * real-time visual progress telemetry, completion summary alert banner, quick test fixtures,
 * and a dynamic Call-to-Action (CTA) lifecycle.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  HardDrive,
  Trash2,
  Sparkles,
  ArrowRight,
  FileUp,
  PlusCircle,
  RotateCcw
} from 'lucide-react';
import type { IngestionBatchItem, IngestionProcessingMode } from '../types/graph';
import { processIngestionBatch } from '../services/ingestion/IngestionService';
import { GraphStorage } from '../storage/GraphStorage';

export type IngestionModalPhase = 'IDLE' | 'QUEUED' | 'PROCESSING' | 'COMPLETED';

interface IngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngestionComplete?: (results?: IngestionBatchItem[]) => void;
  onOpenGoogleWorkspace?: () => void;
}

// Sample Quick Test Fixtures for instantaneous verification
const SAMPLE_FIXTURES = {
  markdown: {
    name: 'pec_omega_prolegomena.md',
    mime: 'text/markdown',
    content: `---
title: "The Kenotic Void: Prolegomena to Nihiltheism"
author: "JOURNAL314 Ω Hermeneutic Core"
systemStage: "I: The Void / Unground"
thematicGroup: "kenosis"
---

# Prolegomena to the Active Void

The active void is not sheer ontological vacancy; it is the self-emptying ungovernable unground that precedes determinacy.

## Fundamental Theorems

- The [[Unground]] grounds all existential manifestations through absolute retraction.
- [[Kenotic Drift]] describes the gradual expenditure of metaphysical substance into pure relations.
- In contrast to passive nihilism, [[Active Void]] constitutes a creative catastrophe.

> "To think the void without falling into despair is the primary task of post-secular metaphysics." — Nihiltheistic Fragment 314
`
  },
  json: {
    name: 'autocatalytic_antinomies.json',
    mime: 'application/json',
    content: JSON.stringify(
      {
        system: 'Nihiltheism',
        stage: 'IV: The Autocatalytic Abyss',
        thematicGroup: 'abyss',
        entities: [
          {
            name: 'Autocatalytic Rupture',
            stage: 'IV: The Autocatalytic Abyss',
            thematicGroup: 'abyss',
            description: 'Self-accelerating ontological feedback loop leading to cosmic transfiguration.',
            relatedConcepts: ['Active Void', 'Kenotic Drift']
          },
          {
            name: 'Limit-Point Omega',
            stage: 'V: The Transfigured Cosmos',
            thematicGroup: 'resurrection',
            description: 'The transcendent convergence where total nihil reaches the threshold of theism.'
          }
        ]
      },
      null,
      2
    )
  },
  csv: {
    name: 'epistemic_categories.csv',
    mime: 'text/csv',
    content: `Concept Name,Stage,Thematic Group,Definition
Apophatic Negation,I: The Void / Unground,apophasis,The systematic negation of conceptual predicates to approach the unconditioned.
Kenotic Descent,III: The Kenotic Drift,kenosis,The downward movement of consciousness stripping illusions of permanence.
Recursive Resurrection,V: The Transfigured Cosmos,resurrection,The re-emergence of divine fullness from the bottom of the abyss.`
  }
};

export const IngestionModal: React.FC<IngestionModalProps> = ({
  isOpen,
  onClose,
  onIngestionComplete,
  onOpenGoogleWorkspace
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const appendFileInputRef = useRef<HTMLInputElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMode, setProcessingMode] = useState<IngestionProcessingMode>('STRUCTURALLY_INGESTED');
  
  // File queue and processing results
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [batchResults, setBatchResults] = useState<IngestionBatchItem[]>([]);
  const [activeStageLabel, setActiveStageLabel] = useState<string>('');
  
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Focus management & Escape key handling
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

  // Derived Batch Telemetry (useMemo)
  const telemetry = useMemo(() => {
    const totalFiles = selectedFiles.length;
    const settledItems = batchResults.filter(
      (item) => item.status === 'success' || item.status === 'duplicate' || item.status === 'error'
    );
    const processingItems = batchResults.filter((item) => item.status === 'processing');
    const committedCount = batchResults.filter((item) => item.status === 'success').length;
    const duplicateCount = batchResults.filter((item) => item.status === 'duplicate').length;
    const errorCount = batchResults.filter((item) => item.status === 'error').length;

    const rawNodes = batchResults
      .filter((item) => item.status === 'success')
      .reduce((acc, item) => acc + (item.extractedNodes?.length ?? 0), 0);

    const rawEdges = batchResults
      .filter((item) => item.status === 'success')
      .reduce((acc, item) => acc + (item.extractedEdges?.length ?? 0), 0);

    let progressPercent = 0;
    if (totalFiles > 0) {
      if (!isProcessing && settledItems.length === totalFiles) {
        progressPercent = 100;
      } else {
        progressPercent = Math.min(
          100,
          Math.round(((settledItems.length + processingItems.length * 0.5) / totalFiles) * 100)
        );
      }
    }

    return {
      totalFiles,
      settledItems,
      processingItems,
      committedCount,
      duplicateCount,
      errorCount,
      rawNodes,
      rawEdges,
      totalExtractedNodes: rawNodes.toLocaleString(),
      totalExtractedEdges: rawEdges.toLocaleString(),
      progressPercent
    };
  }, [selectedFiles.length, batchResults, isProcessing]);

  // Deterministic 4-Phase UI State Machine
  const modalPhase: IngestionModalPhase = useMemo(() => {
    if (isProcessing) return 'PROCESSING';
    if (telemetry.totalFiles === 0) return 'IDLE';
    if (telemetry.settledItems.length === 0) return 'QUEUED';
    if (telemetry.settledItems.length >= telemetry.totalFiles) return 'COMPLETED';
    return 'COMPLETED';
  }, [isProcessing, telemetry.totalFiles, telemetry.settledItems.length]);

  // Drag & Drop handlers
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

  // File selection: adds to queue (Phase 2: QUEUED)
  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0 || isProcessing) return;
    setSelectedFiles(files);
    setBatchResults([]);
    setActiveStageLabel('');
  };

  const handleAddMoreFiles = (files: File[]) => {
    if (files.length === 0 || isProcessing) return;
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleClearQueue = () => {
    if (isProcessing) return;
    setSelectedFiles([]);
    setBatchResults([]);
    setActiveStageLabel('');
  };

  const handleLoadFixture = (type: 'markdown' | 'json' | 'csv') => {
    if (isProcessing) return;
    const fixture = SAMPLE_FIXTURES[type];
    const file = new File([fixture.content], fixture.name, { type: fixture.mime });
    setSelectedFiles([file]);
    setBatchResults([]);
    setActiveStageLabel('');
  };

  // Execution: Triggers ingestion pipeline
  const handleStartIngestion = async (filesToIngest?: File[]) => {
    const files = filesToIngest || selectedFiles;
    if (files.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setActiveStageLabel('Validating documents & computing SHA-256 fingerprints...');

    // Initialize initial batch items with status 'processing'
    const initialItems: IngestionBatchItem[] = files.map((f, idx) => ({
      id: `file_${idx}_${f.name}`,
      fileName: f.name,
      fileSize: f.size,
      mimeType: f.type || 'text/plain',
      status: 'processing',
      stageLabel: idx === 0 ? 'Parsing document structure...' : 'Queued in pipeline...',
      processingMode
    }));
    setBatchResults(initialItems);

    try {
      const results = await processIngestionBatch(
        files,
        (idx, total, item) => {
          setActiveStageLabel(item.stageLabel || `Processing ${idx + 1} of ${total}...`);
          setBatchResults((prev) => {
            const next = [...prev];
            next[idx] = item;
            if (idx + 1 < total && next[idx + 1]?.status === 'processing') {
              next[idx + 1] = {
                ...next[idx + 1],
                stageLabel: 'Parsing document structure...'
              };
            }
            return next;
          });
        },
        { processingMode }
      );

      setBatchResults(results);
      setActiveStageLabel('Batch commit finalized.');
      // Auto-notify parent if needed
      onIngestionComplete?.(results);
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
      setSelectedFiles([]);
      setBatchResults([]);
      setShowResetConfirm(false);
      onIngestionComplete?.();
    } catch (err) {
      console.error('[IngestionModal] Reset failed:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Primary CTA Action for COMPLETED phase
  const handleViewUpdatedGraph = () => {
    onIngestionComplete?.(batchResults);
    onClose();
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
        className="w-full max-w-3xl max-h-[92vh] bg-slate-950/95 border border-cyan-500/30 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.2)] flex flex-col overflow-hidden text-slate-100"
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5 overscroll-contain">
          {/* Phase 4: High-Visibility Completion Summary Alert Banner */}
          {modalPhase === 'COMPLETED' && (
            <div
              className={`rounded-xl p-4 shadow-lg border transition animate-in fade-in duration-300 ${
                telemetry.committedCount > 0 || telemetry.duplicateCount > 0
                  ? 'bg-emerald-950/60 border-emerald-500/40 shadow-emerald-950/50 text-emerald-100'
                  : 'bg-rose-950/60 border-rose-500/40 shadow-rose-950/50 text-rose-100'
              }`}
            >
              <div className="flex items-start gap-3">
                {telemetry.committedCount > 0 || telemetry.duplicateCount > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-sans font-bold text-sm text-slate-100 leading-tight">
                    {telemetry.committedCount > 0
                      ? `✓ Batch Ingestion Complete: Committed ${telemetry.committedCount} document(s) (${telemetry.totalExtractedNodes} nodes, ${telemetry.totalExtractedEdges} edges) to epistemic storage.`
                      : telemetry.duplicateCount > 0 && telemetry.errorCount === 0
                      ? `✓ Batch Ingestion Complete: All ${telemetry.duplicateCount} document(s) matched existing SHA-256 fingerprints.`
                      : `Batch Ingestion Failed: ${telemetry.errorCount} document(s) encountered validation errors.`}
                  </h3>

                  {/* Secondary breakdown pill row */}
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <span className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-emerald-900/60 border border-emerald-500/40 text-emerald-200">
                      {telemetry.committedCount} Committed
                    </span>

                    {telemetry.duplicateCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-amber-900/60 border border-amber-500/40 text-amber-200">
                        {telemetry.duplicateCount} Duplicate{telemetry.duplicateCount > 1 ? 's' : ''} Skipped
                      </span>
                    )}

                    {telemetry.errorCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-rose-900/60 border border-rose-500/40 text-rose-200">
                        {telemetry.errorCount} Error{telemetry.errorCount > 1 ? 's' : ''} Isolated
                      </span>
                    )}

                    <span className="text-xs text-slate-300 font-sans ml-1">
                      {telemetry.committedCount > 0
                        ? 'Graph storage is synchronized and ready for visual inspection.'
                        : 'Review the file details below to inspect parsing diagnostics.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Global Determinate Progress Bar (Active when isProcessing or settledItems exist) */}
          {(isProcessing || telemetry.settledItems.length > 0) && (
            <div className="p-4 rounded-xl bg-slate-900/80 border border-indigo-500/30 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-2 text-slate-200 truncate">
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />
                      <span className="truncate">
                        Processing file {Math.min(telemetry.settledItems.length + 1, telemetry.totalFiles)} of{' '}
                        {telemetry.totalFiles}...{' '}
                        {activeStageLabel && (
                          <span className="text-cyan-400 font-sans">({activeStageLabel})</span>
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>All {telemetry.totalFiles} file(s) processed</span>
                    </>
                  )}
                </span>
                <span className="font-mono text-cyan-300 shrink-0 ml-2">
                  {telemetry.settledItems.length}/{telemetry.totalFiles} files • {telemetry.progressPercent}%
                </span>
              </div>

              {/* Glassmorphic progress track */}
              <div className="h-2.5 w-full rounded-full bg-slate-900/90 border border-indigo-500/30 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ease-out ${
                    modalPhase === 'COMPLETED'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-gradient-to-r from-indigo-500 via-cyan-400 to-teal-400'
                  }`}
                  style={{ width: `${telemetry.progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Dual-Mode Selector */}
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

          {/* Quick Test Fixtures & Drag-Drop Upload Area */}
          {modalPhase !== 'COMPLETED' && (
            <div className="space-y-3">
              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative p-7 rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer group ${
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

                <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-cyan-500/50 flex items-center justify-center text-cyan-400 mb-2.5 shadow-inner transition">
                  {isProcessing ? (
                    <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                  ) : (
                    <Upload className="w-5 h-5" />
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
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5 pt-3 border-t border-slate-800/60 text-[10px] font-mono text-slate-400">
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

              {/* Quick Test Fixtures Shortcut Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs">
                <span className="text-slate-400 font-mono flex items-center gap-1 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Quick Test Fixtures:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleLoadFixture('markdown')}
                    disabled={isProcessing}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 text-[11px] font-mono text-cyan-300 hover:text-white transition disabled:opacity-50"
                  >
                    + Sample .md
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadFixture('json')}
                    disabled={isProcessing}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 text-[11px] font-mono text-blue-300 hover:text-white transition disabled:opacity-50"
                  >
                    + Antinomies .json
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadFixture('csv')}
                    disabled={isProcessing}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 text-[11px] font-mono text-emerald-300 hover:text-white transition disabled:opacity-50"
                  >
                    + Categories .csv
                  </button>
                </div>
              </div>
            </div>
          )}

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

          {/* Queued Files Preview (Phase 2: QUEUED) */}
          {modalPhase === 'QUEUED' && (
            <div className="space-y-2.5 p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-indigo-300 font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  Files Queued for Ingestion ({selectedFiles.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => appendFileInputRef.current?.click()}
                    className="text-[11px] text-indigo-300 hover:text-white flex items-center gap-1 transition"
                  >
                    <PlusCircle className="w-3 h-3" /> Add More
                  </button>
                  <input
                    ref={appendFileInputRef}
                    type="file"
                    multiple
                    accept=".md,.markdown,.txt,.pdf,.json,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        handleAddMoreFiles(Array.from(e.target.files));
                      }
                    }}
                  />
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={handleClearQueue}
                    className="text-[11px] text-slate-400 hover:text-rose-400 transition"
                  >
                    Clear Queue
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {selectedFiles.map((f, i) => (
                  <div
                    key={`${f.name}_${i}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs font-mono"
                  >
                    <span className="text-slate-200 truncate">{f.name}</span>
                    <span className="text-slate-400 text-[10px] shrink-0 ml-2">
                      {(f.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Batch Ingestion Status List (During PROCESSING & COMPLETED) */}
          {batchResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5">
                <span>Batch Processing Status ({batchResults.length})</span>
                <span className="text-[11px] text-slate-500 lowercase">isolated per-file execution</span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto overscroll-contain pr-1">
                {batchResults.map((item) => (
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

                    {/* Summary or Extracted Stats */}
                    {item.summary && (
                      <p className="mt-1.5 text-[11px] text-slate-300 font-sans border-t border-slate-800/60 pt-1">
                        {item.summary}
                      </p>
                    )}

                    {item.status === 'success' && item.extractedNodes && (
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-emerald-400 font-mono">
                        <span>+{item.extractedNodes.length} nodes</span>
                        <span>•</span>
                        <span>+{item.extractedEdges?.length ?? 0} edges</span>
                      </div>
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

        {/* Modal Footer with Dynamic Phase-Aware CTA Lifecycle */}
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
            {/* Phase 1: IDLE */}
            {modalPhase === 'IDLE' && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-cyan-950/80 border border-cyan-500/60 hover:border-cyan-400 text-cyan-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-[0_0_12px_rgba(6,182,212,0.25)] active:scale-95 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Select Files</span>
                </button>
              </>
            )}

            {/* Phase 2: QUEUED */}
            {modalPhase === 'QUEUED' && (
              <>
                <button
                  type="button"
                  onClick={handleClearQueue}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-medium transition cursor-pointer"
                >
                  Clear Queue
                </button>
                <button
                  type="button"
                  onClick={() => appendFileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Add More Files</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartIngestion()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-indigo-600/30 active:scale-95 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Ingest {telemetry.totalFiles} File(s) & Update Graph</span>
                </button>
              </>
            )}

            {/* Phase 3: PROCESSING */}
            {modalPhase === 'PROCESSING' && (
              <>
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 text-xs font-medium cursor-not-allowed opacity-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled
                  className="px-5 py-2 rounded-xl bg-indigo-900/80 border border-indigo-500/50 text-indigo-200 text-xs font-semibold flex items-center gap-2 cursor-not-allowed opacity-90 shadow-inner"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  <span>
                    Ingesting {Math.min(telemetry.settledItems.length + 1, telemetry.totalFiles)}/
                    {telemetry.totalFiles}...
                  </span>
                </button>
              </>
            )}

            {/* Phase 4: COMPLETED */}
            {modalPhase === 'COMPLETED' && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-medium transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleClearQueue();
                    setTimeout(() => fileInputRef.current?.click(), 50);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-200 hover:text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ingest More Files</span>
                </button>
                <button
                  type="button"
                  onClick={handleViewUpdatedGraph}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition active:scale-95 cursor-pointer"
                >
                  <span>
                    View Updated Graph{' '}
                    {telemetry.committedCount > 0 ? `(+${telemetry.totalExtractedNodes} nodes)` : ''}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};
