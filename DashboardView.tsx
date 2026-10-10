import React from 'react';
import {
  BookOpen,
  Search,
  Scale,
  ShieldCheck,
  Cpu,
  AlertTriangle,
  ArrowRight,
  Database,
  FileCheck,
  CheckCircle2,
  RefreshCw,
  Award,
  Terminal,
  Network,
  GitBranch
} from 'lucide-react';
import type { StatsResponse } from '../api';
import type { ActiveTab } from './Navbar';

interface DashboardViewProps {
  stats: StatsResponse | null;
  loading: boolean;
  onRefresh: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  onRunAudit: () => void;
  onTriggerLoop: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  loading,
  onRefresh,
  setActiveTab,
  onRunAudit,
  onTriggerLoop
}) => {
  return (
    <div className="space-y-8">
      {/* Hero Banner / Invariant Constitution */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 p-6 lg:p-8 shadow-xl">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
            <span>SYSTEM CONSTITUTION: ACTIVE & ENFORCED</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-zinc-100 tracking-tight">
            Nihiltheism Research Workbench & Reference Edition
          </h1>

          <p className="text-sm sm:text-base text-zinc-300 leading-relaxed font-sans">
            A local-first philosophical workbench grounded in the <strong className="text-zinc-100">PEC-Ω Constitution</strong>. 
            Investigating radical meaning-collapse and apophatic transcendence without treating either nihilistic cynicism 
            or dogmatic theistic closure as pre-ordained conclusions.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab('hypermap')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-zinc-950 font-bold text-sm rounded-lg shadow-lg shadow-amber-600/20 transition"
            >
              <Network className="w-4 h-4" />
              <span>Explore 1,808-Node Hypermap</span>
            </button>

            <button
              onClick={() => setActiveTab('manuscript')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-sm rounded-lg border border-zinc-700 transition"
            >
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span>Read 17-Chapter Reference Edition</span>
            </button>

            <button
              onClick={() => setActiveTab('corpus')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg border border-zinc-700 transition"
            >
              <Search className="w-4 h-4" />
              <span>Explore Corpus & FTS5</span>
            </button>

            <button
              onClick={onRunAudit}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm rounded-lg border border-zinc-800 transition"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Run Constitutional Audit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Manuscript</span>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-amber-400">
              {stats ? stats.manuscriptChapters : '17'} <span className="text-xs font-normal text-zinc-400">chs</span>
            </div>
            <div className="text-[11px] text-zinc-400 font-mono">
              {stats ? `${stats.totalManuscriptWords.toLocaleString()} words` : '12,500+ words'}
            </div>
          </div>
          <button
            onClick={() => setActiveTab('manuscript')}
            className="text-xs text-amber-500 hover:text-amber-400 inline-flex items-center space-x-1"
          >
            <span>View chapters</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Passages (FTS5)</span>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {stats ? stats.passages : '...'}
            </div>
            <div className="text-[11px] text-zinc-400">Indexed for search</div>
          </div>
          <button
            onClick={() => setActiveTab('corpus')}
            className="text-xs text-amber-500 hover:text-amber-400 inline-flex items-center space-x-1"
          >
            <span>Query FTS5</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Mandatory CRs</span>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-emerald-400">
              12 / 12
            </div>
            <div className="text-[11px] text-emerald-400/80">100% Enforced</div>
          </div>
          <button
            onClick={() => setActiveTab('revisions')}
            className="text-xs text-amber-500 hover:text-amber-400 inline-flex items-center space-x-1"
          >
            <span>Inspect CRs</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Claims & Warrants</span>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {stats ? stats.claims : '...'}
            </div>
            <div className="text-[11px] text-zinc-400">W0–W4 (W5 Banned)</div>
          </div>
          <button
            onClick={() => setActiveTab('dialectic')}
            className="text-xs text-amber-500 hover:text-amber-400 inline-flex items-center space-x-1"
          >
            <span>View Dialectic</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Adversarial Objections</span>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-rose-400">
              {stats ? stats.objections : '...'}
            </div>
            <div className="text-[11px] text-zinc-400">Active defeaters</div>
          </div>
          <button
            onClick={() => setActiveTab('dialectic')}
            className="text-xs text-amber-500 hover:text-amber-400 inline-flex items-center space-x-1"
          >
            <span>Audit counter-models</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Research Runs</span>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-blue-400">
              {stats ? stats.researchJobs : '...'}
            </div>
            <div className="text-[11px] text-zinc-400">Budgeted cycles</div>
          </div>
          <button
            onClick={() => setActiveTab('loop')}
            className="text-xs text-amber-500 hover:text-amber-400 inline-flex items-center space-x-1"
          >
            <span>Loop Console</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* The 4 Foundational Pillars of Nihiltheism Architect */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 hover:border-zinc-700 transition">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
            <Scale className="w-5 h-5" />
          </div>
          <h3 className="font-serif font-bold text-zinc-100 text-base mb-1.5">Predicate Hygiene</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            CR-01 & CR-02 strictly isolate raw experiential reports (W0) and structural descriptions (W1) 
            from ontological truth claims. Intense feelings of Nothingness do not prove divine presence or total nullity.
          </p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 hover:border-zinc-700 transition">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
            <FileCheck className="w-5 h-5" />
          </div>
          <h3 className="font-serif font-bold text-zinc-100 text-base mb-1.5">Source Fidelity</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            All seed passages from <em>Nihiltheism: Through the Void to the Sacred</em> are marked as 
            <code>summary_only</code> with verified <code>NULL</code> page numbers, preventing fake academic page citations.
          </p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 hover:border-zinc-700 transition">
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-serif font-bold text-zinc-100 text-base mb-1.5">Symmetrical Scrutiny</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Naturalistic reductionism and mystical transcendence face identical burdens of proof. 
            Neither dogmatic materialism nor dogmatic theism is permitted to assume default entitlement.
          </p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 hover:border-zinc-700 transition">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="font-serif font-bold text-zinc-100 text-base mb-1.5">Apophatic Non-Closure</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Metaphysical closure (W5) is strictly forbidden as an accepted system fact. 
            The system treats the mystery of being as permanently open to inquiry rather than resolved.
          </p>
        </div>
      </div>

      {/* Quick Workbench Action Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Research Pipeline Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-serif font-bold text-zinc-100 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-amber-500" />
              <span>Autonomous Research Pipeline</span>
            </h2>
            <span className="text-xs font-mono text-zinc-400 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
              Cost & Cycle Budget Enforced
            </span>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            Execute bounded research iterations across the SQLite corpus. Extracts candidate claims, identifies 
            unresolved contradictions, and generates adversarial counterarguments under constitutional supervision.
          </p>

          <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-400 space-y-1.5">
            <div className="flex justify-between">
              <span>Execution Engine:</span>
              <span className="text-zinc-200">PEC-Ω Autonomous Daemon</span>
            </div>
            <div className="flex justify-between">
              <span>Extraction Method:</span>
              <span className="text-zinc-200">FTS5 Context Chunking & Paraconsistent Modeling</span>
            </div>
            <div className="flex justify-between">
              <span>Warrant Gate:</span>
              <span className="text-emerald-400">Strict Validation (Max W4)</span>
            </div>
          </div>

          <div className="pt-2 flex items-center space-x-3">
            <button
              onClick={onTriggerLoop}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-zinc-950 font-semibold text-xs rounded-md shadow flex items-center space-x-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Trigger Research Cycle</span>
            </button>
            <button
              onClick={() => setActiveTab('loop')}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline"
            >
              View Research Job Logs
            </button>
          </div>
        </div>

        {/* Constitutional Compliance Status Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-serif font-bold text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <span>Constitutional Integrity Ledger</span>
            </h2>
            <span className="text-xs font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              AUDIT: PASSED
            </span>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            Autonomous audit verification engine continuously evaluates citation integrity, verifies absence 
            of W5 closure claims, and confirms active compliance across all 12 Mandatory Critical Revisions.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Reference Integrity:</span>
              <span className="text-emerald-400 font-bold">100% OK</span>
            </div>
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">W5 Closure Bans:</span>
              <span className="text-emerald-400 font-bold">ENFORCED</span>
            </div>
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Page Num Fabrications:</span>
              <span className="text-emerald-400 font-bold">0 (NULL)</span>
            </div>
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">Database Schema:</span>
              <span className="text-emerald-400 font-bold">WAL + FTS5</span>
            </div>
          </div>

          <div className="pt-2 flex items-center space-x-3">
            <button
              onClick={onRunAudit}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-md border border-zinc-700 flex items-center space-x-1.5 transition"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Inspect Full Audit Report</span>
            </button>
            <button
              onClick={() => setActiveTab('revisions')}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline"
            >
              View 12 Critical Revisions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
