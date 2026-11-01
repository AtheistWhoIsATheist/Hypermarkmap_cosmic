import React, { useState, useEffect } from 'react';
import {
  Scale,
  Shield,
  AlertTriangle,
  CheckCircle2,
  PlusCircle,
  Search,
  Filter,
  ArrowRight,
  Info,
  X,
  Layers,
  HelpCircle
} from 'lucide-react';
import { api } from '../api';
import type { Claim, AdversarialObjection, Contradiction, WarrantCategory } from '../types';

export const DialecticEngineView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'claims' | 'objections' | 'contradictions' | 'warrants'>('claims');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [objections, setObjections] = useState<AdversarialObjection[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [warrantFilter, setWarrantFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // New claim modal state
  const [showAddClaim, setShowAddClaim] = useState<boolean>(false);
  const [newClaimTitle, setNewClaimTitle] = useState<string>('');
  const [newClaimText, setNewClaimText] = useState<string>('');
  const [newClaimWarrant, setNewClaimWarrant] = useState<WarrantCategory>('W1');
  const [newClaimEpistemic, setNewClaimEpistemic] = useState<string>('SUPPORTED');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [c, o, ct] = await Promise.all([
        api.getClaims(),
        api.getObjections(),
        api.getContradictions()
      ]);
      setClaims(c);
      setObjections(o);
      setContradictions(ct);
    } catch (err) {
      console.error('Failed to load dialectic data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClaimTitle || !newClaimText) return;

    if (newClaimWarrant === 'W5') {
      const confirmW5 = window.confirm(
        'WARNING: Warrant W5 represents Metaphysical Closure, which is constitutionally prohibited as an accepted fact. Do you want to record this claim as a DISPUTED proposition under adversarial review?'
      );
      if (!confirmW5) return;
    }

    try {
      const created = await api.createClaim({
        project_id: 'proj_journal314_canonical',
        text: newClaimText || newClaimTitle,
        claim_type: 'phenomenological_description',
        fidelity_label: 'PROPOSED',
        warrant_category: newClaimWarrant,
        support_status: newClaimWarrant === 'W5' ? 'disputed' : 'unreviewed'
      });
      setClaims([created, ...claims]);
      setShowAddClaim(false);
      setNewClaimTitle('');
      setNewClaimText('');
    } catch (err: any) {
      alert(`Failed to create claim: ${err.message}`);
    }
  };

  const filteredClaims = claims.filter((c) => {
    const matchesWarrant = warrantFilter === 'ALL' || c.warrant_category === warrantFilter;
    const matchesSearch =
      c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.warrant_category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesWarrant && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Dialectic Header */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-mono text-amber-400 mb-1">
            <span>THE WARRANT LADDER (W0–W5) & ADVERSARIAL MATRIX</span>
          </div>
          <h2 className="text-xl font-serif font-bold text-zinc-100 flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-500" />
            <span>Philosophical Dialectic & Warrant Engine</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Audit proposition warrants, examine rival models, and resolve or record accepted antinomies.
          </p>
        </div>

        <button
          onClick={() => setShowAddClaim(true)}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-zinc-950 font-semibold text-xs rounded-lg shadow transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Propose Candidate Claim</span>
        </button>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center space-x-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveSubTab('claims')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeSubTab === 'claims'
              ? 'bg-zinc-800 text-amber-400 border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Claims & Propositions ({claims.length})
        </button>
        <button
          onClick={() => setActiveSubTab('objections')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeSubTab === 'objections'
              ? 'bg-zinc-800 text-rose-400 border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Adversarial Objections ({objections.length})
        </button>
        <button
          onClick={() => setActiveSubTab('contradictions')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeSubTab === 'contradictions'
              ? 'bg-zinc-800 text-amber-400 border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Antinomies & Paradoxes ({contradictions.length})
        </button>
        <button
          onClick={() => setActiveSubTab('warrants')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            activeSubTab === 'warrants'
              ? 'bg-zinc-800 text-emerald-400 border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Warrant Ladder Guide (W0–W5)
        </button>
      </div>

      {/* CLAIMS VIEW */}
      {activeSubTab === 'claims' && (
        <div className="space-y-4">
          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
            <div className="flex items-center space-x-1.5 overflow-x-auto text-xs font-mono">
              <span className="text-zinc-500 mr-1">Warrant:</span>
              {['ALL', 'W0', 'W1', 'W2', 'W3', 'W4', 'W5'].map((w) => (
                <button
                  key={w}
                  onClick={() => setWarrantFilter(w)}
                  className={`px-2 py-1 rounded text-xs transition ${
                    warrantFilter === w
                      ? 'bg-amber-500 text-zinc-950 font-bold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search claims..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Claims List */}
          <div className="space-y-3">
            {filteredClaims.map((claim) => (
              <div
                key={claim.id}
                className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 space-y-3 hover:border-zinc-700 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-0.5 rounded font-mono text-xs font-bold border ${
                        claim.warrant_category === 'W5'
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                          : claim.warrant_category === 'W4'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          : claim.warrant_category === 'W3'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      }`}
                    >
                      {claim.warrant_category}
                    </span>
                    <span className="font-serif font-bold text-zinc-100 text-sm">
                      {claim.id}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-zinc-400 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800">
                    {claim.support_status.toUpperCase()}
                  </span>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                  {claim.text}
                </p>

                {claim.warrant_category === 'W5' && (
                  <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                    <span>
                      CRITICAL INVARIANT: Warrant W5 (Metaphysical Closure) is registered as an adversarial target, NOT an accepted system fact.
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span>Type: {claim.claim_type}</span>
                  <span>Fidelity: {claim.fidelity_label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADVERSARIAL OBJECTIONS VIEW */}
      {activeSubTab === 'objections' && (
        <div className="space-y-4">
          <div className="text-xs text-zinc-400 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
            Symmetrical Scrutiny (CR-05) requires that every core thesis face structured counter-models. 
            Below are active adversarial defeaters and the workbench's critical replies.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {objections.map((obj) => (
              <div
                key={obj.id}
                className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-rose-400 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                      RIVAL DEFEATER ({obj.severity.toUpperCase()})
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400">
                      Target Claim: {obj.claim_id}
                    </span>
                  </div>

                  <h3 className="font-serif font-bold text-zinc-100 text-sm">
                    {obj.title}
                  </h3>

                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-300">
                    <span className="text-[10px] font-mono text-amber-400 font-semibold block mb-0.5">
                      Rival Model: {obj.rival_model}
                    </span>
                    {obj.counter_argument}
                  </div>

                  {obj.reply && (
                    <div className="p-2.5 rounded bg-emerald-500/5 border border-emerald-500/20 text-xs text-zinc-200">
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold block mb-0.5">
                        Constitutional Reply & Non-Closure:
                      </span>
                      {obj.reply}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-800 text-[11px] font-mono text-zinc-400 flex justify-between">
                  <span>Status: {obj.status.toUpperCase()}</span>
                  <span>ID: {obj.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ANTINOMIES & CONTRADICTIONS VIEW */}
      {activeSubTab === 'contradictions' && (
        <div className="space-y-4">
          <div className="text-xs text-zinc-400 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
            Nihiltheism embraces Graham Priest's Logic of Paradox (LP). 
            Tensions at the boundary of thought are not swept under the rug; they are formally documented as accepted antinomies.
          </div>

          <div className="space-y-3">
            {contradictions.map((ct) => (
              <div key={ct.id} className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                    PARADOX ({ct.conflict_type.toUpperCase()})
                  </span>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {ct.status.toUpperCase()}
                  </span>
                </div>

                <h3 className="font-serif font-bold text-zinc-100 text-sm">
                  {ct.relevant_senses}
                </h3>

                {ct.proposed_resolution && (
                  <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                    <strong className="text-emerald-400 font-mono">Proposed Resolution: </strong>
                    {ct.proposed_resolution}
                  </p>
                )}
                {ct.remaining_disagreement && (
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                    <strong className="text-amber-400 font-mono">Remaining Tension: </strong>
                    {ct.remaining_disagreement}
                  </p>
                )}

                <div className="pt-2 border-t border-zinc-800 text-[11px] font-mono text-zinc-500 flex justify-between">
                  <span>Claim A: {ct.claim_a_id}</span>
                  <span>Claim B: {ct.claim_b_id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WARRANT LADDER GUIDE VIEW */}
      {activeSubTab === 'warrants' && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-serif font-bold text-zinc-100">
              The Warrant Ladder (CR-04)
            </h3>
            <p className="text-xs text-zinc-400">
              The 6 epistemic strata governing all synthesis, claims, and inferences across the Nihiltheism Architect.
            </p>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-1">
              <div className="font-bold flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-rose-500 text-zinc-950 text-[10px]">W5</span>
                <span>METAPHYSICAL CLOSURE — PROHIBITED AS ACCEPTED FACT</span>
              </div>
              <p className="text-xs text-zinc-300 font-sans pl-6">
                Claims of final, comprehensive ontological truth (e.g. "God is proven to be Nothingness" or "It is certain that only atoms exist"). 
                Banned as verified facts; retained solely as adversarial targets under audit.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 space-y-1">
              <div className="font-bold flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-blue-500 text-zinc-950 text-[10px]">W4</span>
                <span>PRACTICAL & NORMATIVE COMMITMENT</span>
              </div>
              <p className="text-xs text-zinc-300 font-sans pl-6">
                Existential choices, ethical fidelity, and communal action adopted despite the absence of an ultimate cosmic guarantee.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 text-[10px]">W3</span>
                <span>EXPLANATORY HYPOTHESIS</span>
              </div>
              <p className="text-xs text-zinc-300 font-sans pl-6">
                Philosophical models constructed to explain observed phenomenological data. Must generate testable distinctions and acknowledge rivals.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 space-y-1">
              <div className="font-bold flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-purple-500 text-zinc-950 text-[10px]">W2</span>
                <span>RESEMBLANCE / STRUCTURAL RESONANCE</span>
              </div>
              <p className="text-xs text-zinc-300 font-sans pl-6">
                Cross-corpus parallels (e.g. Meister Eckhart's <em>Gottheit</em> and Nagarjuna's <em>Sunyata</em>). Prohibits claiming identity.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-1">
              <div className="font-bold flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-zinc-950 text-[10px]">W1</span>
                <span>PHENOMENOLOGICAL DESCRIPTION</span>
              </div>
              <p className="text-xs text-zinc-300 font-sans pl-6">
                Rigorous structural analysis of how experience appears (e.g. collapse of temporal protention, sense of falling).
              </p>
            </div>

            <div className="p-4 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 space-y-1">
              <div className="font-bold flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-zinc-400 text-zinc-950 text-[10px]">W0</span>
                <span>RAW EXPERIENTIAL REPORT</span>
              </div>
              <p className="text-xs text-zinc-400 font-sans pl-6">
                Unedited first-person testimony. Documents what was felt or uttered; carries zero metaphysical weight on its own.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Propose Claim Modal */}
      {showAddClaim && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateClaim}
            className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-serif font-bold text-zinc-100 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-500" />
                <span>Propose Candidate Claim</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddClaim(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1">Canonical Title / Label</label>
              <input
                type="text"
                required
                placeholder="e.g. Acute Protention Cessation in Grief"
                value={newClaimTitle}
                onChange={(e) => setNewClaimTitle(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-zinc-400 mb-1">Claim Text / Proposition</label>
              <textarea
                rows={3}
                required
                placeholder="State the proposition with precise predicate hygiene..."
                value={newClaimText}
                onChange={(e) => setNewClaimText(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-sans focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Warrant Level</label>
                <select
                  value={newClaimWarrant}
                  onChange={(e) => setNewClaimWarrant(e.target.value as WarrantCategory)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="W0">W0 - Raw Experiential Report</option>
                  <option value="W1">W1 - Phenomenological Description</option>
                  <option value="W2">W2 - Resemblance / Resonance</option>
                  <option value="W3">W3 - Explanatory Hypothesis</option>
                  <option value="W4">W4 - Practical / Normative</option>
                  <option value="W5">W5 - Metaphysical Closure (Disputed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Epistemic Status</label>
                <select
                  value={newClaimEpistemic}
                  onChange={(e) => setNewClaimEpistemic(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="SUPPORTED">SUPPORTED</option>
                  <option value="PLAUSIBLE">PLAUSIBLE</option>
                  <option value="UNDERDETERMINED">UNDERDETERMINED</option>
                  <option value="SPECULATIVE">SPECULATIVE</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-zinc-900 rounded-lg text-[11px] font-mono text-zinc-400">
              * Submitted claims are automatically audited against the 12 Mandatory Critical Revisions.
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddClaim(false)}
                className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-zinc-950 font-semibold text-xs rounded shadow transition"
              >
                Submit Proposition
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
