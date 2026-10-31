import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X, RefreshCw, CheckCircle2 } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemDetails?: string[];
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  icon?: React.ReactNode;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  itemDetails,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  icon,
  isLoading = false,
  onConfirm,
  onCancel
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      border: 'border-rose-500/30',
      shadow: 'shadow-[0_0_35px_rgba(244,63,94,0.22)]',
      iconBg: 'bg-rose-950/70 border-rose-500/40 text-rose-400',
      title: 'text-rose-100',
      btn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)] border border-rose-400/40'
    },
    warning: {
      border: 'border-amber-500/30',
      shadow: 'shadow-[0_0_35px_rgba(245,158,11,0.22)]',
      iconBg: 'bg-amber-950/70 border-amber-500/40 text-amber-400',
      title: 'text-amber-100',
      btn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)] border border-amber-400/40'
    },
    primary: {
      border: 'border-cyan-500/30',
      shadow: 'shadow-[0_0_35px_rgba(0,240,255,0.22)]',
      iconBg: 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300',
      title: 'text-cyan-100',
      btn: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(0,240,255,0.3)] border border-cyan-400/40'
    }
  }[confirmVariant];

  const defaultIcon = icon || (
    confirmVariant === 'danger' ? (
      <Trash2 className="w-5 h-5" />
    ) : confirmVariant === 'warning' ? (
      <AlertTriangle className="w-5 h-5" />
    ) : (
      <RefreshCw className="w-5 h-5" />
    )
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md bg-[#0B0E14] border ${variantStyles.border} rounded-2xl ${variantStyles.shadow} p-5 text-slate-100 flex flex-col space-y-4`}
        style={{ backgroundColor: '#0B0E14' }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${variantStyles.iconBg}`}>
              {defaultIcon}
            </div>
            <div>
              <h3 id="confirm-modal-title" className={`font-sans font-bold text-base ${variantStyles.title}`}>
                {title}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Explicit User Action Required</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
            aria-label="Dismiss confirmation dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed font-sans">{message}</p>

        {itemDetails && itemDetails.length > 0 && (
          <div className="p-3 rounded-xl bg-[#121824] border border-white/10 max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
            {itemDetails.map((item, idx) => (
              <div key={idx} className="text-xs font-mono text-slate-300 flex items-center gap-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                <span className="truncate">{item}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-[#121824] hover:bg-slate-800 border border-white/10 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer ${variantStyles.btn}`}
          >
            {isLoading ? (
              <span className="animate-spin mr-1">◌</span>
            ) : null}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
