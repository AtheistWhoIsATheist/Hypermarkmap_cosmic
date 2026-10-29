import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Crosshair,
  Filter,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Share2,
  Quote,
  Shield,
  Layers,
  Sparkles,
  ChevronRight,
  Hash,
  Database
} from 'lucide-react';
import type { NodeCitation, NodeMetadataRecord, EpistemicTopologyNode } from '../types';
import { normalizeEpistemicNode } from './GroundedEpistemicTopologyData';

interface NodeInspectorDrawerProps {
  node: EpistemicTopologyNode | null;
  isOpen: boolean;
  onClose: () => void;
  onCenterNode?: (node: EpistemicTopologyNode) => void;
  onFilterConnected?: (node: EpistemicTopologyNode) => void;
  onSelectNode?: (nodeId: string) => void;
  allNodesMap?: Map<string, EpistemicTopologyNode>;
}

/**
 * Lightweight, zero-dependency, safe Markdown parser for node overview text.
 * Handles headers, bold, italics, blockquotes, lists, inline code, and links.
 */
const MarkdownOverview: React.FC<{ content: string }> = ({ content }) => {
  const blocks = useMemo(() => {
    if (!content) return [];
    return content.split(/\n\n+/).filter(b => b.trim().length > 0);
  }, [content]);

  const renderInline = (text: string) => {
    // Regex for bold, italic, code, and links
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    // Pattern matching **bold**, *italic*, `code`, [link](url)
    const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/;

    while (remaining.length > 0) {
      const match = remaining.match(pattern);
      if (!match) {
        parts.push(remaining);
        break;
      }

      const matchIdx = match.index ?? 0;
      if (matchIdx > 0) {
        parts.push(remaining.substring(0, matchIdx));
      }

      const fullMatch = match[0];
      if (fullMatch.startsWith('**')) {
        parts.push(
          <strong key={keyIdx++} className="font-semibold text-slate-100">
            {match[2]}
          </strong>
        );
      } else if (fullMatch.startsWith('*')) {
        parts.push(
          <em key={keyIdx++} className="italic text-slate-200">
            {match[3]}
          </em>
        );
      } else if (fullMatch.startsWith('`')) {
        parts.push(
          <code
            key={keyIdx++}
            className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300"
          >
            {match[4]}
          </code>
        );
      } else if (fullMatch.startsWith('[')) {
        parts.push(
          <a
            key={keyIdx++}
            href={match[6]}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition inline-flex items-center gap-0.5 break-all"
          >
            {match[5]}
            <ExternalLink className="w-2.5 h-2.5 inline ml-0.5" />
          </a>
        );
      }

      remaining = remaining.substring(matchIdx + fullMatch.length);
    }

    return parts;
  };

  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-300 break-words">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();

        // Headers
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-sans font-semibold text-xs uppercase tracking-wider text-slate-200 pt-2 pb-1 border-b border-slate-800/60">
              {trimmed.substring(4)}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-sans font-semibold text-sm tracking-wide text-slate-100 pt-2 pb-1">
              {trimmed.substring(3)}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="font-sans font-bold text-base text-slate-100 pt-2 pb-1">
              {trimmed.substring(2)}
            </h2>
          );
        }

        // Blockquotes
        if (trimmed.startsWith('> ')) {
          const quoteLines = trimmed
            .split('\n')
            .map(line => line.replace(/^>\s?/, ''))
            .join(' ');
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-cyan-500/50 pl-3 py-1.5 my-2 bg-cyan-950/20 rounded-r text-xs italic font-serif text-cyan-100/90 leading-relaxed"
            >
              {renderInline(quoteLines)}
            </blockquote>
          );
        }

        // Lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const items = trimmed.split('\n').filter(l => l.trim().startsWith('- ') || l.trim().startsWith('* '));
          return (
            <ul key={idx} className="space-y-1.5 my-2 pl-4 list-disc list-outside text-xs text-slate-300 marker:text-cyan-500/70">
              {items.map((item, itemIdx) => {
                const itemText = item.trim().replace(/^[-*]\s+/, '');
                return <li key={itemIdx}>{renderInline(itemText)}</li>;
              })}
            </ul>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} className="text-sm leading-relaxed text-slate-300">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

export const NodeInspectorDrawer: React.FC<NodeInspectorDrawerProps> = ({
  node,
  isOpen,
  onClose,
  onCenterNode,
  onFilterConnected,
  onSelectNode,
  allNodesMap
}) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const asideRef = useRef<HTMLElement | null>(null);

  // Animation and mount lifecycle states
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [selectedMetaCategory, setSelectedMetaCategory] = useState<'all' | 'system' | 'epistemic' | 'relational'>('all');

  // Normalize incoming node data defensibly
  const normalizedNode = useMemo(() => {
    return normalizeEpistemicNode(node);
  }, [node]);

  // Synchronize slide-in/out transitions and DOM mounting
  useEffect(() => {
    if (isOpen && normalizedNode) {
      setIsMounted(true);
      // Double rAF ensures the translate-x-full frame is painted before transitioning to translate-x-0
      const frame1 = requestAnimationFrame(() => {
        const frame2 = requestAnimationFrame(() => {
          setIsVisible(true);
          closeButtonRef.current?.focus();
        });
        return () => cancelAnimationFrame(frame2);
      });
      return () => cancelAnimationFrame(frame1);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setIsMounted(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, normalizedNode?.id]);

  // Escape key handler on document
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Copy node ID to clipboard
  const handleCopyId = useCallback(async () => {
    if (!normalizedNode) return;
    try {
      await navigator.clipboard.writeText(normalizedNode.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Fallback
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  }, [normalizedNode]);

  // Extract structured metadata records
  const metadataRecords: NodeMetadataRecord[] = useMemo(() => {
    if (!normalizedNode?.metadata) return [];
    if (Array.isArray(normalizedNode.metadata)) {
      return normalizedNode.metadata;
    }
    return Object.entries(normalizedNode.metadata).map(([label, value]) => ({
      label,
      value,
      category: 'epistemic' as const
    }));
  }, [normalizedNode]);

  const filteredMetadata = useMemo(() => {
    if (selectedMetaCategory === 'all') return metadataRecords;
    return metadataRecords.filter(m => (m.category || 'epistemic') === selectedMetaCategory);
  }, [metadataRecords, selectedMetaCategory]);

  const citations: NodeCitation[] = useMemo(() => {
    return normalizedNode?.citations || [];
  }, [normalizedNode]);

  const connectedIds: string[] = useMemo(() => {
    return normalizedNode?.connectedNodeIds || [];
  }, [normalizedNode]);

  if (!isMounted || !normalizedNode) {
    return null;
  }

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs z-40 sm:hidden transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-Out Inspector Drawer */}
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label={normalizedNode.title}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className={`fixed top-0 right-0 bottom-0 z-50 h-full w-full sm:w-96 md:w-[28rem] bg-slate-950/85 backdrop-blur-md border-l border-slate-800/80 hover:border-cyan-500/30 transition-all duration-300 ease-in-out flex flex-col shadow-[-16px_0_40px_rgba(2,6,23,0.85)] select-text ${
          isVisible ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        {/* ================================================================= */}
        {/* 1. Header Section (Sticky Top) */}
        {/* ================================================================= */}
        <header className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 px-5 py-4 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              {/* Primary Thematic Pill Badge & Stage */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-cyan-400 bg-cyan-950/40 border border-cyan-800/50 rounded px-2 py-0.5">
                  {normalizedNode.thematicGroup || normalizedNode.type || 'Epistemic Node'}
                </span>
                {normalizedNode.nodeKind && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 rounded px-1.5 py-0.5">
                    {normalizedNode.nodeKind}
                  </span>
                )}
                {normalizedNode.processingMode && (
                  <span className={`font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    normalizedNode.processingMode === 'SEMANTICALLY_ENRICHED'
                      ? 'bg-purple-950/60 border-purple-700/60 text-purple-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}>
                    {normalizedNode.processingMode === 'SEMANTICALLY_ENRICHED' ? 'AI-Enriched' : 'Structural'}
                  </span>
                )}
                {normalizedNode.confidenceStatus && (
                  <span className={`font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    normalizedNode.confidenceStatus === 'source-explicit'
                      ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                      : normalizedNode.confidenceStatus === 'strongly-supported-inference'
                      ? 'bg-cyan-950/40 border-cyan-800/40 text-cyan-300'
                      : 'bg-amber-950/40 border-amber-800/40 text-amber-300'
                  }`}>
                    {normalizedNode.confidenceStatus}
                  </span>
                )}
                {normalizedNode.systemStage && (
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    {normalizedNode.systemStage}
                  </span>
                )}
              </div>

              {/* Node Title */}
              <h2 className="font-sans font-semibold tracking-wide text-slate-100 text-lg leading-snug break-words">
                {normalizedNode.title}
              </h2>

              {/* Micro-Indicator: Connectivity Count & Origin Source */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-400 pt-0.5">
                <div className="flex items-center gap-1.5 text-cyan-400/90" title="Connected topological coordinates">
                  <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="tabular-nums font-medium">{connectedIds.length}</span>
                  <span className="text-slate-400">{connectedIds.length === 1 ? 'connection' : 'connections'}</span>
                </div>
                {normalizedNode.sourceFile && (
                  <span className="text-cyan-300 truncate max-w-[200px]" title={`Origin file: ${normalizedNode.sourceFile}`}>
                    · {normalizedNode.sourceFile}
                  </span>
                )}
                {normalizedNode.warrant && (
                  <span className="text-slate-400">
                    · Warrant: <strong className="text-cyan-300 font-semibold">{normalizedNode.warrant}</strong>
                  </span>
                )}
                {normalizedNode.level !== undefined && (
                  <span className="text-slate-500">· Depth {normalizedNode.level}</span>
                )}
              </div>
            </div>

            {/* Dedicated Dismissal Button */}
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close inspector"
              title="Close inspector (Esc)"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition shrink-0 active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ================================================================= */}
        {/* 2. Body Section (Scrollable, overscroll-contain) */}
        {/* ================================================================= */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-6">
          {/* Section A: Overview (Markdown-rendered text) */}
          <section className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800/60 pb-1.5">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                Epistemic Overview
              </span>
              <span className="text-[11px] text-slate-500 lowercase font-sans">verified prose</span>
            </div>
            <div className="pt-1">
              <MarkdownOverview content={normalizedNode.description || ''} />
            </div>
          </section>

          {/* Section B: Metadata Matrix */}
          <section className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800/60 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                Metadata Matrix
              </span>
              {/* Category Segmented Filter Buttons */}
              {metadataRecords.length > 0 && (
                <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-md border border-slate-800 text-[10px] font-sans">
                  {(['all', 'epistemic', 'system', 'relational'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedMetaCategory(cat)}
                      className={`px-2 py-0.5 rounded transition capitalize font-mono text-[10px] ${
                        selectedMetaCategory === cat
                          ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-700/50'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {filteredMetadata.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {filteredMetadata.map((record, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/70 hover:border-slate-700/80 transition flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="truncate">{record.label}</span>
                      {record.category && (
                        <span className="text-[9px] uppercase tracking-widest text-slate-500">
                          {record.category.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono font-medium text-slate-200 mt-1 break-words tabular-nums">
                      {typeof record.value === 'boolean'
                        ? record.value ? 'True' : 'False'
                        : String(record.value)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs font-mono text-slate-500 italic py-2">
                No metadata records defined in this category.
              </p>
            )}
          </section>

          {/* Section C: Citations & Provenance */}
          <section className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800/60 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Quote className="w-3.5 h-3.5 text-cyan-400" />
                Citations & Provenance
              </span>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                ({citations.length})
              </span>
            </div>

            {citations.length > 0 ? (
              <div className="space-y-2.5">
                {citations.map((citation) => (
                  <div
                    key={citation.id}
                    className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition space-y-2"
                  >
                    {/* Source Title & Link */}
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="font-sans font-medium text-xs text-slate-200 break-words flex-1 leading-snug">
                        {citation.sourceTitle}
                      </h5>
                      {citation.referenceUrl && (
                        <a
                          href={citation.referenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                          title="Open external source reference"
                          className="text-cyan-400 hover:text-cyan-300 p-1 rounded hover:bg-slate-800/60 transition shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {/* Author or Origin */}
                    {citation.authorOrOrigin && (
                      <div className="text-[11px] font-mono text-cyan-400/90 flex items-center gap-1.5">
                        <span className="text-slate-500 font-sans">Author:</span>
                        <span className="font-medium">{citation.authorOrOrigin}</span>
                      </div>
                    )}

                    {/* Italicized Quote Block */}
                    {citation.quoteSnippet && (
                      <blockquote className="border-l-2 border-cyan-500/50 pl-3 py-1 text-xs italic text-slate-300 font-serif leading-relaxed bg-cyan-950/20 rounded-r">
                        “{citation.quoteSnippet}”
                      </blockquote>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800/60 text-center">
                <p className="text-xs font-mono text-slate-400 italic">
                  No direct citations cataloged
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  This node represents an emergent or synthesized construct within the topology.
                </p>
              </div>
            )}
          </section>

          {/* Section D: Verbatim Source Spans (Provenance Records) */}
          {normalizedNode.sourceSpans && normalizedNode.sourceSpans.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800/60 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  Verbatim Source Spans ({normalizedNode.sourceSpans.length})
                </span>
                <span className="text-[11px] font-mono text-emerald-400/90 lowercase">provenance ground</span>
              </div>

              <div className="space-y-2.5">
                {normalizedNode.sourceSpans.map((span, sIdx) => (
                  <div
                    key={span.spanId || sIdx}
                    className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-1.5 text-xs font-mono"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400 border-b border-slate-800/50 pb-1">
                      <span className="text-cyan-300 truncate max-w-[220px]">
                        {span.headingPath?.length ? span.headingPath.join(' > ') : span.fileName}
                      </span>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        {span.pageNumber !== undefined && (
                          <span className="text-emerald-400 font-semibold">Page {span.pageNumber}</span>
                        )}
                        {span.lineStart !== undefined && (
                          <span>L{span.lineStart}{span.lineEnd && span.lineEnd !== span.lineStart ? `–${span.lineEnd}` : ''}</span>
                        )}
                        {span.charStart !== undefined && (
                          <span>c.{span.charStart}–{span.charEnd}</span>
                        )}
                        <span className="px-1 rounded bg-slate-800 text-[9px] uppercase">
                          {span.locationStatus}
                        </span>
                      </div>
                    </div>

                    <div className="font-serif italic text-slate-200 text-xs leading-relaxed bg-black/40 p-2.5 rounded border border-slate-800/60 select-text break-words">
                      “{span.verbatimText}”
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section E: Connected Coordinates Navigation */}
          {connectedIds.length > 0 && (
            <section className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800/60 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                  Connected Coordinates ({connectedIds.length})
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto overscroll-contain pr-1">
                {connectedIds.map((targetId) => {
                  const targetNode = allNodesMap?.get(targetId);
                  const displayLabel = targetNode?.title || targetId;
                  return (
                    <button
                      key={targetId}
                      onClick={() => onSelectNode?.(targetId)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/60 hover:bg-cyan-950/30 text-slate-300 hover:text-white transition flex items-center justify-between group active:scale-[0.99]"
                    >
                      <span className="truncate text-xs font-medium">{displayLabel}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0 ml-2 transition" />
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* ================================================================= */}
        {/* 3. Footer Actions (Sticky Bottom) */}
        {/* ================================================================= */}
        <footer className="sticky bottom-0 z-20 bg-slate-950/95 backdrop-blur-md px-5 py-3 border-t border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
          {/* Quick-action 1: Center in Graph */}
          <button
            onClick={() => onCenterNode?.(normalizedNode)}
            className="flex-1 px-3 py-2 rounded-lg bg-cyan-950/40 border border-cyan-700/50 hover:bg-cyan-900/40 hover:border-cyan-500 text-cyan-300 hover:text-cyan-200 text-xs font-medium flex items-center justify-center gap-1.5 transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            title="Pan and center camera onto this coordinate"
          >
            <Crosshair className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Center in Graph</span>
          </button>

          {/* Quick-action 2: Filter Connected Nodes */}
          <button
            onClick={() => onFilterConnected?.(normalizedNode)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition active:scale-95 focus:outline-none focus:ring-1 focus:ring-slate-500"
            title="Focus graph on connected relata"
          >
            <Filter className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span className="whitespace-nowrap hidden sm:inline">Filter Connected</span>
            <span className="whitespace-nowrap sm:hidden">Filter</span>
          </button>

          {/* Quick-action 3: Copy Entry ID */}
          <button
            onClick={handleCopyId}
            className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition active:scale-95 focus:outline-none ${
              copiedId
                ? 'bg-emerald-950/50 border-emerald-600/60 text-emerald-300'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
            title="Copy coordinate identifier to clipboard"
          >
            {copiedId ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap font-mono">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="whitespace-nowrap font-mono">Copy ID</span>
              </>
            )}
          </button>
        </footer>
      </aside>
    </>
  );
};
