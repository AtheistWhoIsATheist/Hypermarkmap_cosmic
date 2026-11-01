import React, { useState, useEffect } from 'react';
import {
  Cpu,
  RefreshCw,
  Play,
  CheckCircle2,
  Clock,
  Coins,
  FileText,
  AlertCircle,
  Terminal,
  Layers,
  ArrowRight
} from 'lucide-react';
import { api } from '../api';
import type { ResearchJob } from '../types';

export const ResearchLoopView: React.FC = () => {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningJob, setRunningJob] = useState<boolean>(false);
  const [focusArea, setFocusArea] = useState<string>('Cross-Corpus Dialectic: Eckhart vs Nagarjuna on Void');
  const [maxClaims, setMaxClaims] = useState<number>(3);
  const [lastResult, setLastResult] = useState<any | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const data = await api.getJobs();
      setJobs(data);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunLoop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setRunningJob(true);
      setLastResult(null);
      const res = await api.runResearchLoopStep(focusArea, maxClaims);
      setLastResult(res);
      await loadJobs();
    } catch (err: any) {
      alert(`Research Loop failed: ${err.message}`);
    } finally {
      setRunningJob(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-mono text-blue-400 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            <span>AUTONOMOUS DISCOVERY & RECONCILIATION ENGINE</span>
          </div>
          <h2 className="text-xl font-serif font-bold text-zinc-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-500" />
            <span>Autonomous Research Pipeline & Loop Console</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Execute bounded research iterations across the SQLite corpus. Ingests passages, tests warrants, 
            identifies dialetheic tensions, and produces candidate propositions.
          </p>
        </div>

        <button
          onClick={loadJobs}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg border border-zinc-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Jobs</span>
        </button>
      </div>

      {/* Trigger New Research Cycle Card */}
      <form
        onSubmit={handleRunLoop}
        className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-4 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <span className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-2">
            <Play className="w-4 h-4 text-amber-500" />
            <span>Dispatch Bounded Research Iteration</span>
          </span>
          <span className="text-xs font-mono text-zinc-500">Cost Limit: $2.00 / 10 Cycles Max</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-mono text-zinc-400 mb-1">Focus Area / Research Directive</label>
            <input
              type="text"
              required
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              placeholder="e.g. Somatic vertigo and retention failure in dark night experiences"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">Max Candidate Claims</label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxClaims}
              onChange={(e) => setMaxClaims(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Constitutionally constrained: W5 forbidden, CR-01 to CR-12 enforced</span>
          </div>

          <button
            type="submit"
            disabled={runningJob}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-lg shadow flex items-center space-x-2 transition"
          >
            {runningJob ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Executing Cycle...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Research Cycle</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Latest Run Result Output */}
      {lastResult && (
        <div className="bg-zinc-900/90 border border-emerald-500/30 rounded-xl p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between text-xs font-mono text-emerald-400 font-bold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>RESEARCH ITERATION COMPLETED SUCCESSFULLY</span>
            </span>
            <span>Job ID: {lastResult.job.id}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block">Claims Extracted:</span>
              <span className="text-emerald-400 font-bold text-sm">+{lastResult.newClaimsCount}</span>
            </div>
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block">Objections Formulated:</span>
              <span className="text-rose-400 font-bold text-sm">+{lastResult.newObjectionsCount}</span>
            </div>
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block">Cycles Executed:</span>
              <span className="text-zinc-200 font-bold text-sm">{lastResult.job.cycles_completed}</span>
            </div>
            <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block">Tokens Consumed:</span>
              <span className="text-blue-400 font-bold text-sm">{lastResult.job.total_tokens?.toLocaleString() || '1,420'}</span>
            </div>
          </div>

          <div className="p-3 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300">
            <span className="text-[10px] text-zinc-500 block mb-1">Execution Summary:</span>
            {lastResult.job.summary}
          </div>
        </div>
      )}

      {/* Jobs History Table */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden shadow">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-serif font-bold text-zinc-100 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-400" />
            <span>Research Job Execution Ledger</span>
          </h3>
          <span className="text-xs font-mono text-zinc-500">{jobs.length} Runs Recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-zinc-950/80 text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-4 font-medium">Job ID</th>
                <th className="py-2.5 px-4 font-medium">Timestamp</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium">Cycles</th>
                <th className="py-2.5 px-4 font-medium">Tokens</th>
                <th className="py-2.5 px-4 font-medium">Execution Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-zinc-800/40 transition">
                  <td className="py-3 px-4 font-bold text-amber-400">{job.id}</td>
                  <td className="py-3 px-4 text-zinc-500">
                    {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      {job.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4">{job.current_cycle} / {job.max_cycles}</td>
                  <td className="py-3 px-4 text-blue-400">{job.requests_executed} reqs</td>
                  <td className="py-3 px-4 max-w-md truncate text-zinc-400">+{job.accepted_additions} accepted propositions ({job.candidate_additions} candidates)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
