import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Database, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { api, type StatsResponse } from './api';
import { Navbar, type ActiveTab } from './views/Navbar';
import { DashboardView } from './views/DashboardView';
import { HypermapDialecticView } from './views/HypermapDialecticView';
import { CorpusExplorerView } from './views/CorpusExplorerView';
import { ManuscriptView } from './views/ManuscriptView';
import { DialecticEngineView } from './views/DialecticEngineView';
import { CriticalRevisionsView } from './views/CriticalRevisionsView';
import { ResearchLoopView } from './views/ResearchLoopView';
import { AuditReportView } from './views/AuditReportView';
import { ExportModal } from './views/ExportModal';

interface HealthState {
  ai: { configured: boolean; model: string; provider: string } | null;
  database: string;
}

const TABS: ActiveTab[] = [
  'dashboard',
  'hypermap',
  'corpus',
  'manuscript',
  'dialectic',
  'revisions',
  'loop',
  'audit'
];

export function ArchitectShell() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [exportOpen, setExportOpen] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getStats();
      setStats(data);
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load corpus statistics.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const data = await api.getHealth();
      setHealth({ ai: data.ai ?? null, database: 'connected' });
    } catch {
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    void loadStats();
    void loadHealth();
  }, [loadStats, loadHealth]);

  const runAudit = useCallback(async () => {
    setActionError(null);
    setActionNote(null);
    try {
      const report = await api.runAudit();
      setActionNote(
        `Audit complete — ${report.metrics?.total_claims ?? 0} claims, ${report.metrics?.total_objections ?? 0} objections.`
      );
      await loadStats();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Audit failed.');
    }
  }, [loadStats]);

  const triggerLoop = useCallback(async () => {
    setActionError(null);
    setActionNote(null);
    try {
      const result = await api.runResearchLoopStep();
      setActionNote(
        `Research step complete — ${result.newClaimsCount ?? 0} new claims, ${result.newObjectionsCount ?? 0} new objections.`
      );
      await loadStats();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Research step failed.');
    }
  }, [loadStats]);

  const triggerLoopWithFocus = useCallback(
    async (focusArea: string) => {
      setActionError(null);
      setActionNote(null);
      try {
        const result = await api.runResearchLoopStep(focusArea);
        setActionNote(
          `Research step complete — ${result.newClaimsCount ?? 0} new claims, ${result.newObjectionsCount ?? 0} new objections.`
        );
        await loadStats();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Research step failed.');
      }
    },
    [loadStats]
  );

  const aiConfigured = Boolean(health?.ai?.configured);

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 selection:bg-amber-500/25 selection:text-amber-100">
      <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h1 className="font-mono text-sm uppercase tracking-[0.28em] text-amber-300">Nihiltheism Architect</h1>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">v1.0</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em]">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Database className="h-3 w-3 text-emerald-400" />
                SQLite
              </span>
              <span
                className={`flex items-center gap-1.5 ${aiConfigured ? 'text-emerald-300' : 'text-amber-300'}`}
                title={
                  health?.ai?.configured
                    ? `OpenRouter model: ${health.ai.model}`
                    : 'Set OPENROUTER_API_KEY to enable AI generation and densification.'
                }
              >
                {aiConfigured ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {aiConfigured ? `AI ${health?.ai?.model ?? 'ready'}` : 'AI offline'}
              </span>
              <a
                href="/"
                className="rounded-md border border-zinc-700 px-2.5 py-1 text-zinc-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
              >
                Hypermarkmap
              </a>
            </div>
          </div>
          <Navbar activeTab={activeTab} setActiveTab={setActiveTab} onExportClick={() => setExportOpen(true)} />
        </div>
      </header>

      {(actionError || actionNote) && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          {actionError ? (
            <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              <span>{actionNote}</span>
            </div>
          )}
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            stats={stats}
            loading={loading}
            onRefresh={() => void loadStats()}
            setActiveTab={setActiveTab}
            onRunAudit={() => void runAudit()}
            onTriggerLoop={() => void triggerLoop()}
          />
        )}
        {activeTab === 'hypermap' && <HypermapDialecticView onTriggerResearchLoop={(focus) => void triggerLoopWithFocus(focus)} />}
        {activeTab === 'corpus' && <CorpusExplorerView />}
        {activeTab === 'manuscript' && <ManuscriptView />}
        {activeTab === 'dialectic' && <DialecticEngineView />}
        {activeTab === 'revisions' && <CriticalRevisionsView />}
        {activeTab === 'loop' && <ResearchLoopView />}
        {activeTab === 'audit' && <AuditReportView />}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600">
          <span>Local-first research workbench · corpus in SQLite (WAL + FTS5)</span>
          <button
            type="button"
            onClick={() => void loadStats()}
            className="flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-amber-300"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </footer>

      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}

export default ArchitectShell;
