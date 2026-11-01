import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  List,
  CheckCircle2,
  HelpCircle,
  Link as LinkIcon,
  Shield,
  Copy,
  Check,
  Search
} from 'lucide-react';
import { api } from '../api';
import type { ManuscriptSection } from '../types';

export const ManuscriptView: React.FC = () => {
  const [chapters, setChapters] = useState<ManuscriptSection[]>([]);
  const [selectedChapterNum, setSelectedChapterNum] = useState<number>(1);
  const [currentChapter, setCurrentChapter] = useState<ManuscriptSection | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [showMetadata, setShowMetadata] = useState<boolean>(true);

  useEffect(() => {
    loadChapters();
  }, []);

  useEffect(() => {
    if (selectedChapterNum) {
      loadChapter(selectedChapterNum);
    }
  }, [selectedChapterNum]);

  const loadChapters = async () => {
    try {
      setLoading(true);
      const data = await api.getManuscriptChapters();
      setChapters(data);
      if (data.length > 0 && !currentChapter) {
        setSelectedChapterNum(data[0].chapter_number);
      }
    } catch (err) {
      console.error('Failed to load chapters:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadChapter = async (num: number) => {
    try {
      const data = await api.getManuscriptChapter(num);
      setCurrentChapter(data);
    } catch (err) {
      console.error('Failed to load chapter details:', err);
    }
  };

  const handleCopyMarkdown = () => {
    if (!currentChapter) return;
    navigator.clipboard.writeText(currentChapter.full_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredChapters = chapters.filter(
    (c) =>
      c.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.chapter_number.toString().includes(searchFilter) ||
      c.definitions_scope.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const totalWords = chapters.reduce((acc, c) => acc + c.word_count, 0);

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-10rem)]">
      {/* Sidebar: 17 Chapters Index */}
      <div className="w-full lg:w-80 flex-shrink-0 bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col h-[600px] lg:h-[calc(100vh-12rem)] lg:sticky lg:top-20">
        <div className="pb-3 border-b border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-amber-500" />
              <span>Reference Edition</span>
            </h2>
            <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
              17 Chapters
            </span>
          </div>

          <div className="text-[11px] text-zinc-400 font-mono flex justify-between">
            <span>Total Word Count:</span>
            <span className="text-amber-400 font-bold">{totalWords.toLocaleString()} words</span>
          </div>

          {/* Quick Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter chapters..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        {/* Chapters List */}
        <div className="flex-1 overflow-y-auto pt-2 space-y-1 pr-1 custom-scrollbar">
          {filteredChapters.map((ch) => {
            const isSelected = selectedChapterNum === ch.chapter_number;
            return (
              <button
                key={ch.id}
                onClick={() => setSelectedChapterNum(ch.chapter_number)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition flex flex-col gap-1 ${
                  isSelected
                    ? 'bg-amber-500/10 border border-amber-500/40 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-[10px] font-bold ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`}>
                    CHAPTER {ch.chapter_number.toString().padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {ch.word_count.toLocaleString()} w
                  </span>
                </div>
                <div className={`font-medium line-clamp-1 ${isSelected ? 'text-zinc-100' : 'text-zinc-300'}`}>
                  {ch.title}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chapter Content View */}
      <div className="flex-1 bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 lg:p-8 flex flex-col min-w-0">
        {currentChapter ? (
          <div className="space-y-6">
            {/* Chapter Header */}
            <div className="border-b border-zinc-800 pb-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-mono text-amber-400">
                  <span>CHAPTER {currentChapter.chapter_number.toString().padStart(2, '0')} OF 17</span>
                  <span className="text-zinc-600">•</span>
                  <span>{currentChapter.word_count.toLocaleString()} WORDS</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowMetadata(!showMetadata)}
                    className="text-xs px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition"
                  >
                    {showMetadata ? 'Hide Dialectic Meta' : 'Show Dialectic Meta'}
                  </button>

                  <button
                    onClick={handleCopyMarkdown}
                    className="text-xs px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 flex items-center space-x-1 transition"
                    title="Copy full chapter markdown to clipboard"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy MD</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-zinc-100 tracking-tight">
                {currentChapter.title}
              </h1>

              <div className="mt-2 flex items-center gap-2 text-xs font-mono text-zinc-400">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  {currentChapter.epistemic_status}
                </span>
                <span>Slug: {currentChapter.slug}</span>
              </div>
            </div>

            {/* Dialectic Metadata Card (Definitions, Argument, Counterargument, Reply) */}
            {showMetadata && (
              <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-lg p-5 space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-amber-500 font-bold flex items-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  <span>Constitutional Dialectic Framework</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1 bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                    <span className="font-mono text-amber-400 font-semibold block">Scope & Definitions:</span>
                    <p className="text-zinc-300 leading-relaxed">{currentChapter.definitions_scope}</p>
                  </div>

                  <div className="space-y-1 bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                    <span className="font-mono text-emerald-400 font-semibold block">Developed Argument:</span>
                    <p className="text-zinc-300 leading-relaxed">{currentChapter.developed_argument}</p>
                  </div>

                  <div className="space-y-1 bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                    <span className="font-mono text-rose-400 font-semibold block">Counterargument & Rival Model:</span>
                    <p className="text-zinc-300 leading-relaxed">{currentChapter.counterargument}</p>
                  </div>

                  <div className="space-y-1 bg-zinc-900/60 p-3 rounded border border-zinc-800/80">
                    <span className="font-mono text-blue-400 font-semibold block">Critical Reply & Revisions:</span>
                    <p className="text-zinc-300 leading-relaxed">{currentChapter.reply_or_revision}</p>
                  </div>
                </div>

                {/* Cross References & Open Questions */}
                <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-4 text-xs font-mono">
                  {currentChapter.cross_references && currentChapter.cross_references.length > 0 && (
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <LinkIcon className="w-3.5 h-3.5 text-amber-500" />
                      <span>Cross-Refs:</span>
                      {currentChapter.cross_references.map((ref) => (
                        <span key={ref} className="px-1.5 py-0.5 rounded bg-zinc-900 text-amber-400 border border-zinc-800">
                          {ref}
                        </span>
                      ))}
                    </div>
                  )}

                  {currentChapter.open_questions && currentChapter.open_questions.length > 0 && (
                    <div className="w-full mt-2 space-y-1">
                      <span className="text-zinc-400 flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Open Research Questions:</span>
                      </span>
                      <ul className="list-disc list-inside text-zinc-300 pl-2 space-y-0.5">
                        {currentChapter.open_questions.map((q, idx) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Chapter Full Text Display */}
            <div className="prose prose-invert max-w-none font-sans text-zinc-300 text-sm leading-relaxed space-y-4">
              {currentChapter.full_text.split('\n\n').map((paragraph, index) => {
                const trimmed = paragraph.trim();
                if (trimmed.startsWith('# ')) {
                  return (
                    <h1 key={index} className="text-2xl font-serif font-bold text-zinc-100 pt-4 pb-2 border-b border-zinc-800">
                      {trimmed.replace('# ', '')}
                    </h1>
                  );
                }
                if (trimmed.startsWith('## ')) {
                  return (
                    <h2 key={index} className="text-lg font-serif font-bold text-amber-400 pt-4 pb-1">
                      {trimmed.replace('## ', '')}
                    </h2>
                  );
                }
                if (trimmed.startsWith('### ')) {
                  return (
                    <h3 key={index} className="text-base font-serif font-semibold text-zinc-200 pt-2 pb-1">
                      {trimmed.replace('### ', '')}
                    </h3>
                  );
                }
                if (trimmed.startsWith('> ')) {
                  return (
                    <blockquote key={index} className="border-l-2 border-amber-500/60 pl-4 py-1 italic text-zinc-300 bg-amber-500/5 rounded-r">
                      {trimmed.replace('> ', '')}
                    </blockquote>
                  );
                }
                if (trimmed.startsWith('```')) {
                  return (
                    <pre key={index} className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg font-mono text-xs text-amber-300 overflow-x-auto">
                      {trimmed.replace(/```/g, '')}
                    </pre>
                  );
                }
                return (
                  <p key={index} className="text-zinc-300 leading-relaxed">
                    {trimmed}
                  </p>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="pt-6 border-t border-zinc-800 flex items-center justify-between">
              <button
                onClick={() => setSelectedChapterNum(Math.max(1, currentChapter.chapter_number - 1))}
                disabled={currentChapter.chapter_number <= 1}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-xs font-medium text-zinc-200 flex items-center space-x-1 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous Chapter</span>
              </button>

              <span className="text-xs font-mono text-zinc-400">
                Chapter {currentChapter.chapter_number} of 17
              </span>

              <button
                onClick={() => setSelectedChapterNum(Math.min(17, currentChapter.chapter_number + 1))}
                disabled={currentChapter.chapter_number >= 17}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-xs font-medium text-zinc-200 flex items-center space-x-1 transition"
              >
                <span>Next Chapter</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
            Select a chapter to begin reading.
          </div>
        )}
      </div>
    </div>
  );
};
