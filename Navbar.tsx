import React from 'react';
import {
  BookOpen,
  Search,
  Scale,
  ShieldCheck,
  Cpu,
  Download,
  Flame,
  FileText,
  AlertTriangle,
  Layers,
  Network
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'hypermap'
  | 'corpus'
  | 'manuscript'
  | 'dialectic'
  | 'revisions'
  | 'loop'
  | 'audit';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onExportClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onExportClick }) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Overview', icon: <Layers className="w-4 h-4" /> },
    { id: 'hypermap', label: '1,808-Node Hypermap', icon: <Network className="w-4 h-4 text-amber-400" /> },
    { id: 'manuscript', label: '17-Ch Reference Edition', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'corpus', label: 'Corpus & Search', icon: <Search className="w-4 h-4" /> },
    { id: 'dialectic', label: 'Dialectic & Warrants', icon: <Scale className="w-4 h-4" /> },
    { id: 'revisions', label: '12 Mandatory CRs', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'loop', label: 'Autonomous Loop', icon: <Cpu className="w-4 h-4" /> },
    { id: 'audit', label: 'Constitutional Audit', icon: <AlertTriangle className="w-4 h-4" /> }
  ];

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 text-zinc-100 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Invariant Tags */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center space-x-2.5 text-left focus:outline-none group"
            >
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-zinc-950 font-black text-sm shadow-inner group-hover:from-amber-500 group-hover:to-amber-700 transition">
                Ω
              </div>
              <div>
                <span className="font-serif font-bold tracking-tight text-lg text-zinc-100 flex items-center gap-1.5">
                  Nihiltheism <span className="text-amber-500 font-sans font-medium text-xs px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">ARCHITECT v1.0</span>
                </span>
                <p className="text-[10px] text-zinc-400 font-mono tracking-wide hidden sm:block">
                  PEC-Ω Constitutional Research Workbench & Corpus
                </p>
              </div>
            </button>
          </div>

          {/* Nav Items */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-zinc-800 text-amber-400 border border-zinc-700 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick Actions & Export */}
          <div className="flex items-center space-x-2">
            <div className="hidden xl:flex items-center space-x-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>W0–W4 Active | W5 Banned</span>
            </div>

            <button
              onClick={onExportClick}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-zinc-950 font-semibold text-xs rounded-md shadow transition duration-150"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex items-center space-x-1 overflow-x-auto py-2 border-t border-zinc-800/60 no-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap flex items-center space-x-1 px-2.5 py-1 text-xs rounded transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-amber-400 font-medium'
                    : 'text-zinc-400 hover:bg-zinc-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
