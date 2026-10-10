import React, { useState, useEffect } from 'react';
import {
  Search,
  BookOpen,
  FileText,
  Upload,
  ArrowRight,
  ExternalLink,
  Info,
  Hash,
  Layers,
  X,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { api, type PassageContextResponse } from '../api';
import type { Passage, Source } from '../types';

export const CorpusExplorerView: React.FC = () => {
  const [query, setQuery] = useState<string>('void');
  const [passages, setPassages] = useState<Passage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(null);
  const [contextData, setContextData] = useState<PassageContextResponse | null>(null);
  const [contextLoading, setContextLoading] = useState<boolean>(false);

  // Ingestion form state
  const [showIngest, setShowIngest] = useState<boolean>(false);
  const [ingestFilename, setIngestFilename] = useState<string>('phenomenological_field_notes.txt');
  const [ingestText, setIngestText] = useState<string>(
    'The subject reports an immediate vertigo upon realizing that all moral scaffolding is historically contingent.\n\nSection 2: The cessation of internal dialogue occurs around hour 4 of silent observation.\n\nSection 3: Symmetrical scrutiny forces the mind to acknowledge that neither materialism nor mysticism can claim default victory.'
  );
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState<boolean>(false);

  const sampleQueries = [
    'void',
    'dark night',
    'predicate hygiene',
    'transcendence',
    'protention',
    'symmetrical scrutiny',
    'Eckhart',
    'Nagarjuna',
    'Heidegger'
  ];

  useEffect(() => {
    handleSearch('void');
  }, []);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    try {
      setLoading(true);
      const results = await api.searchPassages(searchQuery, 30);
      setPassages(results);
    } catch (err) {
      console.error('Failed to search passages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPassage = async (id: string) => {
    try {
      setSelectedPassageId(id);
      setContextLoading(true);
      const data = await api.getPassageContext(id);
      setContextData(data);
    } catch (err) {
      console.error('Failed to load passage context:', err);
    } finally {
      setContextLoading(false);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestFilename || !ingestText) return;
    try {
      setIngesting(true);
      const newSource = await api.ingestText(ingestFilename, ingestText);
      setIngestSuccess(`Ingested "${newSource.filename}" with SHA-256 hash ${newSource.sha256_hash.slice(0, 12)}... (${newSource.passage_count} passages created)`);
      setShowIngest(false);
      handleSearch(query);
    } catch (err: any) {
      alert(`Ingestion failed: ${err.message}`);
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Ingestion Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/90 border border-zinc-800 rounded-xl p-6">
        <div>
          <h2 className="text-xl font-serif font-bold text-zinc-100 flex items-center gap-2">
            <Search className="w-5 h-5 text-amber-500" />
            <span>Corpus Explorer & FTS5 Semantic Search</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Query across primary passages using SQLite full-text search. Examine raw text, offsets, and surrounding narrative context.
          </p>
        </div>

        <button
          onClick={() => setShowIngest(!showIngest)}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg border border-zinc-700 transition"
        >
          <Upload className="w-3.5 h-3.5 text-amber-400" />
          <span>Ingest Source Document</span>
        </button>
      </div>

      {/* Ingest Drawer / Card */}
      {showIngest && (
        <form onSubmit={handleIngest} className="bg-zinc-950 border border-amber-500/30 rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <span className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-500" />
              <span>Ingest Text Document into SQLite Corpus</span>
            </span>
            <button
              type="button"
              onClick={() => setShowIngest(false)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1">Source Filename</label>
              <input
                type="text"
                value={ingestFilename}
                onChange={(e) => setIngestFilename(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-end">
              <span className="text-xs text-zinc-400 font-mono">
                Ingestion auto-chunks by paragraph, computes SHA-256, and updates FTS5 index.
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">Document Text (Raw Passages)</label>
            <textarea
              rows={4}
              value={ingestText}
              onChange={(e) => setIngestText(e.target.value)}
              required
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowIngest(false)}
              className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={ingesting}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-zinc-950 font-semibold text-xs rounded shadow transition"
            >
              {ingesting ? 'Hashing & Ingesting...' : 'Confirm Ingestion'}
            </button>
          </div>
        </form>
      )}

      {ingestSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-mono text-emerald-400 flex items-center justify-between">
          <span>{ingestSuccess}</span>
          <button onClick={() => setIngestSuccess(null)} className="text-emerald-500 hover:text-emerald-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Input Bar & Quick Chips */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search FTS5 full-text index (e.g. 'void', 'Eckhart', 'predicate hygiene', 'nothingness')..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              handleSearch(e.target.value);
            }}
            className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 shadow-inner"
          />
        </div>

        {/* Quick Sample Query Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-mono text-zinc-400 mr-1">Quick Queries:</span>
          {sampleQueries.map((q) => (
            <button
              key={q}
              onClick={() => {
                setQuery(q);
                handleSearch(q);
              }}
              className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition ${
                query.toLowerCase() === q.toLowerCase()
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-bold'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Search Results Count */}
      <div className="flex items-center justify-between text-xs font-mono text-zinc-400 px-1">
        <span>
          Showing {passages.length} matching passage{passages.length === 1 ? '' : 's'}
        </span>
        <span>Ranked by SQLite FTS5 Match Score</span>
      </div>

      {/* Passages List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {passages.map((p) => {
          return (
            <div
              key={p.id}
              onClick={() => handleOpenPassage(p.id)}
              className="bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 cursor-pointer transition flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span className="text-amber-500/80 font-bold">PASSAGE #{p.passage_index}</span>
                  <span>{p.page_number !== null ? `p. ${p.page_number}` : 'summary_only (p. null)'}</span>
                </div>

                <p className="text-xs text-zinc-200 leading-relaxed line-clamp-4 font-serif group-hover:text-zinc-100 transition">
                  "{p.text}"
                </p>
              </div>

              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span className="truncate max-w-[180px]">{p.source_filename || p.source_id}</span>
                <span className="text-amber-400 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition">
                  <span>View context</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {passages.length === 0 && !loading && (
        <div className="p-12 text-center bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-2">
          <BookOpen className="w-8 h-8 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-serif font-bold text-zinc-300">No passages found</h3>
          <p className="text-xs text-zinc-500">Try a different search keyword or ingest new textual sources.</p>
        </div>
      )}

      {/* Passage Context Viewer Modal / Drawer */}
      {selectedPassageId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
              <div className="space-y-1">
                <div className="inline-flex items-center space-x-2 text-xs font-mono text-amber-400">
                  <span>PASSAGE CONTEXT VIEWER</span>
                  <span className="text-zinc-600">•</span>
                  <span>PRE / TARGET / POST</span>
                </div>
                <h3 className="text-base font-serif font-bold text-zinc-100">
                  {contextData?.source?.filename || 'Source Passage'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedPassageId(null);
                  setContextData(null);
                }}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs leading-relaxed">
              {contextLoading ? (
                <div className="py-12 text-center text-zinc-500 font-mono">Loading surrounding context...</div>
              ) : contextData ? (
                <>
                  {/* Preceding Passage */}
                  {contextData.prevPassage ? (
                    <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-1.5 opacity-70 hover:opacity-100 transition">
                      <div className="text-[10px] font-mono text-zinc-400 flex justify-between">
                        <span>PRECEDING PASSAGE #{contextData.prevPassage.passage_index}</span>
                        <span>Offset: {contextData.prevPassage.char_offset_start}–{contextData.prevPassage.char_offset_end}</span>
                      </div>
                      <p className="text-zinc-300 font-serif italic">"{contextData.prevPassage.text}"</p>
                    </div>
                  ) : (
                    <div className="text-[11px] font-mono text-zinc-500 italic">[Start of source document]</div>
                  )}

                  {/* Target Passage (Highlighted) */}
                  <div className="p-5 rounded-xl bg-amber-500/10 border-2 border-amber-500/50 space-y-2 shadow-lg">
                    <div className="flex items-center justify-between text-xs font-mono text-amber-400 font-bold">
                      <span>TARGET PASSAGE #{contextData.passage.passage_index}</span>
                      <span>
                        {contextData.passage.page_number !== null
                          ? `Page: ${contextData.passage.page_number}`
                          : 'Page: NULL (summary_only)'}
                      </span>
                    </div>
                    <p className="text-zinc-100 font-serif text-sm leading-relaxed">
                      "{contextData.passage.text}"
                    </p>
                    <div className="pt-2 border-t border-amber-500/20 text-[11px] font-mono text-amber-300/80 flex justify-between">
                      <span>Character Offsets: {contextData.passage.char_offset_start} – {contextData.passage.char_offset_end}</span>
                      <span>Passage ID: {contextData.passage.id}</span>
                    </div>
                  </div>

                  {/* Following Passage */}
                  {contextData.nextPassage ? (
                    <div className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-1.5 opacity-70 hover:opacity-100 transition">
                      <div className="text-[10px] font-mono text-zinc-400 flex justify-between">
                        <span>SUCCEEDING PASSAGE #{contextData.nextPassage.passage_index}</span>
                        <span>Offset: {contextData.nextPassage.char_offset_start}–{contextData.nextPassage.char_offset_end}</span>
                      </div>
                      <p className="text-zinc-300 font-serif italic">"{contextData.nextPassage.text}"</p>
                    </div>
                  ) : (
                    <div className="text-[11px] font-mono text-zinc-500 italic">[End of source document]</div>
                  )}

                  {/* Provenance Metadata Box */}
                  <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 text-[11px] font-mono text-zinc-400 space-y-1">
                    <div className="font-bold text-zinc-200">Source Provenance Details:</div>
                    <div>Source ID: {contextData.source?.id}</div>
                    <div>SHA-256: {contextData.source?.sha256_hash}</div>
                    <div>Completeness: {contextData.source?.content_completeness}</div>
                    <div>Extraction Method: {contextData.source?.extraction_method}</div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex justify-end">
              <button
                onClick={() => {
                  setSelectedPassageId(null);
                  setContextData(null);
                }}
                className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
