import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, X, Sparkles, Layers, Link as LinkIcon, AlertCircle } from 'lucide-react';
import type { EpistemicTopologyNode } from '../types';

export interface CreateNodeFormData {
  title: string;
  category: 'concept' | 'baseline' | 'supernode' | 'tension' | 'unresolved';
  description: string;
  parentId?: string;
}

export interface CreateNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateNodeFormData) => void;
  availableNodes: Array<{ id: string; title: string }>;
  defaultParentId?: string;
}

const CATEGORY_OPTIONS: Array<{
  id: CreateNodeFormData['category'];
  name: string;
  color: string;
  accentBg: string;
  borderColor: string;
}> = [
  {
    id: 'concept',
    name: 'Concept Cluster',
    color: '#818cf8',
    accentBg: 'bg-indigo-950/60 text-indigo-300',
    borderColor: 'border-indigo-500/40'
  },
  {
    id: 'baseline',
    name: 'Baseline Ontology',
    color: '#38bdf8',
    accentBg: 'bg-cyan-950/60 text-cyan-300',
    borderColor: 'border-cyan-500/40'
  },
  {
    id: 'supernode',
    name: 'Document Supernode',
    color: '#34d399',
    accentBg: 'bg-emerald-950/60 text-emerald-300',
    borderColor: 'border-emerald-500/40'
  },
  {
    id: 'tension',
    name: 'Dialectical Tension',
    color: '#f43f5e',
    accentBg: 'bg-rose-950/60 text-rose-300',
    borderColor: 'border-rose-500/40'
  },
  {
    id: 'unresolved',
    name: 'Unresolved Reference',
    color: '#fbbf24',
    accentBg: 'bg-amber-950/60 text-amber-300',
    borderColor: 'border-amber-500/40'
  }
];

export const CreateNodeModal: React.FC<CreateNodeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  availableNodes,
  defaultParentId
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CreateNodeFormData['category']>('concept');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string>(defaultParentId || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setCategory('concept');
      setDescription('');
      setParentId(defaultParentId || '');
      setErrorMessage(null);
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, defaultParentId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Concept title cannot be empty.');
      titleInputRef.current?.focus();
      return;
    }

    onSubmit({
      title: trimmedTitle,
      category,
      description: description.trim(),
      parentId: parentId || undefined
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-node-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0B0E14] border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] p-6 text-slate-100 flex flex-col space-y-5"
        style={{ backgroundColor: '#0B0E14' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/70 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(129,140,248,0.25)]">
              <PlusCircle className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 id="create-node-modal-title" className="font-sans font-bold text-base text-white">
                Add Conceptual Entity Node
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Spawn coordinates into the epistemic topology
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
            aria-label="Dismiss modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Node Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>Title / Label *</span>
              {errorMessage && (
                <span className="text-[11px] font-mono text-rose-400 flex items-center gap-1 normal-case tracking-normal">
                  <AlertCircle className="w-3 h-3" />
                  {errorMessage}
                </span>
              )}
            </label>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="e.g. Apophatic Horizon of Consciousness"
              className={`w-full px-3 py-2 rounded-xl text-sm text-white placeholder-slate-500 bg-[#121824] border transition outline-none ${
                errorMessage
                  ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                  : 'border-white/10 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400'
              }`}
            />
          </div>

          {/* Epistemic Accent & Thematic Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Epistemic Taxonomy Accent
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCategory(opt.id)}
                  className={`p-2 rounded-xl border text-xs font-mono transition text-left flex items-center gap-2 cursor-pointer ${
                    category === opt.id
                      ? `${opt.accentBg} ${opt.borderColor} font-semibold shadow-sm`
                      : 'bg-[#121824]/60 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/20'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: opt.color, boxShadow: `0 0 6px ${opt.color}` }}
                  />
                  <span className="truncate">{opt.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Parent Node Edge Link */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
              Link to Anchor / Parent Node (Optional)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono text-white bg-[#121824] border border-white/10 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition cursor-pointer"
            >
              <option value="">None (Free-floating Coordinate)</option>
              {availableNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title} ({n.id})
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-slate-300">
              Description / Phenomenological Overview
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed thesis or philosophical warrant..."
              className="w-full px-3 py-2 rounded-xl text-xs text-white placeholder-slate-500 bg-[#121824] border border-white/10 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-mono text-slate-300 hover:text-white bg-[#121824] hover:bg-slate-800 border border-white/10 transition cursor-pointer active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 shadow-[0_0_15px_rgba(129,140,248,0.35)] transition cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create Node</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
