import React, { Component, type ReactNode } from 'react';
import { TopologyVisualizer } from './components/TopologyVisualizer';
import { RotateCcw, AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Topology App] Uncaught rendering exception:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-[#0B0E14] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="p-4 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-400 mb-4 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-serif font-bold text-slate-100 mb-2">
            Epistemic Topology Visualization Interrupted
          </h1>
          <p className="text-xs font-mono text-slate-400 max-w-md mb-6">
            {this.state.error?.message || 'An unexpected rendering error occurred within the visual canvas.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-mono flex items-center gap-2 cursor-pointer transition active:scale-95 shadow-md"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reload Topology</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <div className="w-screen h-screen overflow-hidden bg-[#0B0E14]">
        <TopologyVisualizer />
      </div>
    </ErrorBoundary>
  );
}
