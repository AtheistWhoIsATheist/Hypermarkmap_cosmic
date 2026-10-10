import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  FileText,
  ExternalLink,
  Lock,
  Eye
} from 'lucide-react';
import { api } from '../api';
import type { MandatoryCorrection } from '../types';

export const CriticalRevisionsView: React.FC = () => {
  const [corrections, setCorrections] = useState<MandatoryCorrection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    loadCorrections();
  }, []);

  const loadCorrections = async () => {
    try {
      setLoading(true);
      const data = await api.getCorrections();
      setCorrections(data);
    } catch (err) {
      console.error('Failed to load corrections:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = corrections.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.source_assertion.toLowerCase().includes(search.toLowerCase()) ||
      c.critical_revision.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-mono text-emerald-400 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>12 / 12 CRITICAL REVISIONS CONSTITUTIONALLY ACTIVE</span>
          </div>
          <h2 className="text-xl font-serif font-bold text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            <span>Mandatory Critical Revisions Registry (CR-01 to CR-12)</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Formal epistemic constraints designed to prevent category errors, illegitimate metaphysical leaps,
            and premature closure throughout the Nihiltheism corpus.
          </p>
        </div>

        {/* Filter Input */}
        <div className="w-full sm:w-72 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search revisions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Revisions Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((cr) => (
          <div
            key={cr.code}
            className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-5 space-y-4 hover:border-zinc-700 transition flex flex-col justify-between"
          >
            <div className="space-y-3">
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold">
                  {cr.code}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Enforced</span>
                </span>
              </div>

              {/* Title */}
              <h3 className="font-serif font-bold text-zinc-100 text-base leading-snug">
                {cr.title}
              </h3>

              {/* Target & Problem */}
              <div className="text-xs space-y-2 font-sans">
                <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80">
                  <span className="text-[11px] font-mono text-rose-400 font-semibold block mb-0.5">
                    Original Source Assertion / Defect:
                  </span>
                  <p className="text-zinc-300 text-xs leading-relaxed">{cr.source_assertion}</p>
                </div>

                <div>
                  <span className="text-[11px] font-mono text-emerald-400 font-semibold block mb-0.5">
                    Constitutional Revision:
                  </span>
                  <p className="text-zinc-300 text-xs leading-relaxed">{cr.critical_revision}</p>
                </div>

                <div>
                  <span className="text-[11px] font-mono text-amber-400 font-semibold block mb-0.5">
                    Epistemic Rationale:
                  </span>
                  <p className="text-zinc-400 text-xs leading-relaxed">{cr.constitutional_rationale}</p>
                </div>
              </div>
            </div>

            {/* Audit Predicate Footer */}
            <div className="pt-3 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
              <span>Status: ACTIVE & ENFORCED</span>
              <span>Code: {cr.code}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
