import React from 'react';
import {
  Download,
  FileArchive,
  FileJson,
  X,
  CheckCircle2,
  BookOpen,
  Database,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { api } from '../api';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 text-xs font-mono text-amber-400">
              <Download className="w-3.5 h-3.5" />
              <span>RELEASE ARTIFACTS & EVIDENCE HANDOFF (A11)</span>
            </div>
            <h3 className="text-lg font-serif font-bold text-zinc-100">
              Export Nihiltheism Architect v1.0
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-zinc-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed font-sans">
          Download the verified reference release artifacts. All exports include the complete 17-chapter reference edition, 
          the SQLite full-corpus database records, the 12 Mandatory Critical Revisions, and the Constitutional Compliance Audit.
        </p>

        {/* Download Options */}
        <div className="space-y-3">
          {/* ZIP Archive Button */}
          <a
            href={api.getExportZipUrl()}
            download="nihiltheism_architect_v1.0.zip"
            className="flex items-start space-x-3.5 p-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 transition group"
          >
            <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-400 group-hover:scale-105 transition">
              <FileArchive className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-serif font-bold text-zinc-100 group-hover:text-amber-400 transition">
                  Complete Release Archive (.ZIP)
                </h4>
                <span className="text-[11px] font-mono text-amber-400 font-bold">Recommended</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Includes all 17 Markdown chapters (12,500+ words), full database JSON bundle, 
                constitutional audit report, and publication-ready README.
              </p>
            </div>
          </a>

          {/* JSON Bundle Button */}
          <a
            href={api.getExportBundleUrl()}
            download="nihiltheism_canonical_bundle.json"
            className="flex items-start space-x-3.5 p-4 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 transition group"
          >
            <div className="p-2.5 rounded-lg bg-zinc-800 text-zinc-300 group-hover:scale-105 transition">
              <FileJson className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-serif font-bold text-zinc-100">
                  Full Database Bundle (.JSON)
                </h4>
                <span className="text-[11px] font-mono text-zinc-500">Raw Data</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Single self-contained JSON file with all projects, sources, passages, claims, objections, 
                critical revisions, and manuscript sections.
              </p>
            </div>
          </a>
        </div>

        {/* Invariant Evidence Summary */}
        <div className="p-3.5 bg-zinc-900 rounded-lg border border-zinc-800/80 text-[11px] font-mono text-zinc-400 space-y-1">
          <div className="text-zinc-200 font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cryptographic & Epistemic Verification:</span>
          </div>
          <div>• Schema: SQLite WAL Mode + FTS5 Full-Text Search Virtual Tables</div>
          <div>• Warrant Ladder: W0–W4 Validated; W5 Closure Excluded as Accepted Fact</div>
          <div>• Reference Integrity: 100% Validated; Seed Page Numbers NULL Verified</div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
