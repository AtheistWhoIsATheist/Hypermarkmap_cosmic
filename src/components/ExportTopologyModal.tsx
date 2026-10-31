/**
 * Cosmic Glassmorphic Topology Export Modal
 * [REF: Export.UI.ModalComponent]
 * [REF: Export.Engine.Serialization]
 * [REF: Export.Browser.DownloadHelper]
 * Interactive UI allowing users to configure export scopes, format options,
 * inspect live payload statistics, and download serialized JSON topology files.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download,
  X,
  FileJson,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Database,
  Sliders,
  ShieldCheck,
  FileText
} from 'lucide-react';
import {
  GraphExportService,
  DEFAULT_EXPORT_OPTIONS
} from '../services/export/GraphExportService';
import { formatByteSize } from '../services/export/downloadHelper';
import type {
  TopologyExportOptions,
  TopologyExportScope,
  TopologyExportFormat,
  TopologyExportManifest,
  TopologyExportResult
} from '../types/export';

export interface ExportTopologyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportSuccess?: (result: TopologyExportResult) => void;
}

export const ExportTopologyModal: React.FC<ExportTopologyModalProps> = ({
  isOpen,
  onClose,
  onExportSuccess
}) => {
  const [scope, setScope] = useState<TopologyExportScope>('unified');
  const [format, setFormat] = useState<TopologyExportFormat>('beautified');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeSourceSpans, setIncludeSourceSpans] = useState(true);

  const [previewManifest, setPreviewManifest] = useState<TopologyExportManifest | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccessInfo, setExportSuccessInfo] = useState<{
    filename: string;
    byteSize: number;
  } | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch live payload preview metrics whenever options change
  const refreshPreview = useCallback(async () => {
    setIsLoadingPreview(true);
    setExportError(null);
    try {
      const options: TopologyExportOptions = {
        scope,
        format,
        includeMetadata,
        includeSourceSpans
      };
      const manifest = await GraphExportService.getExportPreview(options);
      setPreviewManifest(manifest);
    } catch (err) {
      console.error('[ExportModal] Preview calculation error:', err);
      setExportError('Unable to calculate export preview metrics.');
    } finally {
      setIsLoadingPreview(false);
    }
  }, [scope, format, includeMetadata, includeSourceSpans]);

  useEffect(() => {
    if (isOpen) {
      setExportSuccessInfo(null);
      setExportError(null);
      void refreshPreview();
      setTimeout(() => downloadButtonRef.current?.focus(), 50);
    }
  }, [isOpen, refreshPreview]);

  // Handle Escape key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && !isExporting) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  // Execute export and client download
  const handleExecuteExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccessInfo(null);

    try {
      const options: TopologyExportOptions = {
        scope,
        format,
        includeMetadata,
        includeSourceSpans
      };
      const result = await GraphExportService.exportTopology(options);
      setExportSuccessInfo({
        filename: result.filename,
        byteSize: result.byteSize
      });
      if (onExportSuccess) {
        onExportSuccess(result);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      setExportError(msg);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-[#0B0E14] border border-cyan-500/40 shadow-[0_16px_48px_rgba(0,0,0,0.85)] flex flex-col"
        style={{ contain: 'content' }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#121824]/90 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.3)]">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 id="export-modal-title" className="text-sm font-serif font-bold text-slate-100 tracking-wide flex items-center gap-2">
                Export Epistemic Topology
                <span className="text-[10px] font-mono text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                  JSON v2.0
                </span>
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Serialize IndexedDB topology nodes, edges, citations & provenance
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer disabled:opacity-50"
            title="Dismiss export modal"
            aria-label="Dismiss export modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[calc(85vh-140px)] overflow-y-auto">
          {/* Scope Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" /> Topology Export Scope
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => setScope('unified')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  scope === 'unified'
                    ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                    : 'bg-[#121824]/60 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="font-semibold text-cyan-300">Unified Graph</span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  Baseline + Ingested Documents + Custom
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope('ingested_only')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  scope === 'ingested_only'
                    ? 'bg-emerald-950/80 border-emerald-400 text-white shadow-[0_0_12px_rgba(52,211,153,0.25)]'
                    : 'bg-[#121824]/60 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="font-semibold text-emerald-300">User Corpus</span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  All Ingested Docs & Custom Nodes
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope('custom_only')}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  scope === 'custom_only'
                    ? 'bg-indigo-950/80 border-indigo-400 text-white shadow-[0_0_12px_rgba(129,140,248,0.25)]'
                    : 'bg-[#121824]/60 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="font-semibold text-indigo-300">Custom Only</span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  User-created concepts & links
                </span>
              </button>
            </div>
          </div>

          {/* Formatting & Content Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Format (Beautified vs Minified) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <FileJson className="w-3.5 h-3.5 text-purple-400" /> JSON Formatting
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-[#121824] p-1 rounded-xl border border-white/10 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setFormat('beautified')}
                  className={`py-1.5 px-2 rounded-lg text-center transition cursor-pointer ${
                    format === 'beautified'
                      ? 'bg-purple-950 text-purple-200 border border-purple-500/40 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Formatted (2 sp)
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('minified')}
                  className={`py-1.5 px-2 rounded-lg text-center transition cursor-pointer ${
                    format === 'minified'
                      ? 'bg-purple-950 text-purple-200 border border-purple-500/40 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Minified
                </button>
              </div>
            </div>

            {/* Inclusions */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" /> Export Inclusions
              </label>
              <div className="space-y-1.5 bg-[#121824]/60 p-2 rounded-xl border border-white/10 text-xs font-mono">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={includeMetadata}
                    onChange={(e) => setIncludeMetadata(e.target.checked)}
                    className="rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Include Citations & Metadata</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={includeSourceSpans}
                    onChange={(e) => setIncludeSourceSpans(e.target.checked)}
                    className="rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Include Verbatim SourceSpans</span>
                </label>
              </div>
            </div>
          </div>

          {/* Real-time Metric Preview Card */}
          <div className="rounded-xl p-3.5 bg-[#121824]/90 border border-cyan-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono border-b border-white/10 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                Live Payload Metrics
              </span>
              {isLoadingPreview ? (
                <span className="text-cyan-400 text-[11px] animate-pulse">Calculating...</span>
              ) : (
                <span className="text-cyan-300 text-[11px]">Ready for Serialization</span>
              )}
            </div>

            {previewManifest ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-center">
                <div className="p-2 rounded-lg bg-[#0B0E14]/80 border border-white/5">
                  <div className="text-lg font-bold text-cyan-300">{previewManifest.nodeCount}</div>
                  <div className="text-[10px] text-slate-400 uppercase">Nodes</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0B0E14]/80 border border-white/5">
                  <div className="text-lg font-bold text-emerald-300">{previewManifest.edgeCount}</div>
                  <div className="text-[10px] text-slate-400 uppercase">Edges</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0B0E14]/80 border border-white/5">
                  <div className="text-lg font-bold text-purple-300">{previewManifest.documentCount}</div>
                  <div className="text-[10px] text-slate-400 uppercase">Documents</div>
                </div>
                <div className="p-2 rounded-lg bg-[#0B0E14]/80 border border-white/5">
                  <div className="text-lg font-bold text-amber-300">{previewManifest.sourceSpanCount}</div>
                  <div className="text-[10px] text-slate-400 uppercase">Spans</div>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Strict Relational Integrity (0 orphan edges)
              </span>
              <span className="text-slate-300">
                MIME: application/json
              </span>
            </div>
          </div>

          {/* Feedback & Notifications */}
          {exportError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{exportError}</span>
            </div>
          )}

          {exportSuccessInfo && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                <span>Downloaded: {exportSuccessInfo.filename}</span>
              </div>
              <span className="text-[11px] text-emerald-400 font-semibold">
                {formatByteSize(exportSuccessInfo.byteSize)}
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#121824]/90 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            ref={downloadButtonRef}
            type="button"
            onClick={handleExecuteExport}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl text-xs font-mono font-semibold text-cyan-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-[0_0_16px_rgba(0,240,255,0.4)] transition-all duration-200 active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-cyan-950 border-t-transparent rounded-full animate-spin" />
                <span>Serializing Graph...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Topology JSON</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
