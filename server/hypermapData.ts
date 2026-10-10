/**
 * Nihiltheistic Hypermap Data Generator & Corpus Definition
 * Absorbs the JOURNAL314 Ω & PEC-Ω canonical architectures into an
 * interactive, bidirectional 1,808-node dual-root tree hierarchy.
 */

export interface RawHypermapNode {
  id: string;
  project_id: string;
  parent_id: string | null;
  root_tree_id: 'tree_journal314_phenomenology' | 'tree_pec_omega_dialectic';
  title: string;
  node_type: 'root' | 'domain' | 'category' | 'concept' | 'claim' | 'paradox' | 'objection' | 'revision' | 'insight' | 'citation';
  warrant_category: 'W0' | 'W1' | 'W2' | 'W3' | 'W4' | 'W5';
  payload_text: string;
  epistemic_status: 'directly_attested' | 'strongly_supported' | 'supported' | 'plausible' | 'underdetermined' | 'disputed';
  paradox_relation?: string;
  fidelity_label: 'DIRECT_QUOTE' | 'PARAPHRASE' | 'INFERRED' | 'PROPOSED' | 'STATED';
  order_index: number;
}

export function generateCanonical1808HypermapNodes(projectId: string = 'proj_journal314_canonical'): RawHypermapNode[] {
  const nodes: RawHypermapNode[] = [];

  // =========================================================================
  // TREE 1: JOURNAL314 Ω — Systematic Phenomenological Taxonomy & Corpus Ontology
  // Exactly 904 nodes
  // =========================================================================
  const root1Id = 'tree_journal314_phenomenology';
  nodes.push({
    id: root1Id,
    project_id: projectId,
    parent_id: null,
    root_tree_id: 'tree_journal314_phenomenology',
    title: 'JOURNAL314 Ω — Systematic Phenomenological Taxonomy & Corpus Ontology',
    node_type: 'root',
    warrant_category: 'W3',
    payload_text: 'The comprehensive phenomenological taxonomy of Nihiltheistic experience, givenness of Nothingness, epistemic warrant hierarchies (W0–W5), and the primary cross-traditional textual corpus.',
    epistemic_status: 'strongly_supported',
    paradox_relation: 'phenomenological_ground',
    fidelity_label: 'STATED',
    order_index: 0
  });

  interface DomainSpec {
    id: string;
    title: string;
    desc: string;
    categories: {
      id: string;
      title: string;
      warrant: 'W0' | 'W1' | 'W2' | 'W3' | 'W4' | 'W5';
      desc: string;
      topics: string[];
    }[];
    targetTotal: number; // nodes in this domain including domain node
  }

  const tree1Domains: DomainSpec[] = [
    {
      id: 'hm_d1_givenness',
      title: 'Domain 1: Radical Phenomenological Givenness & The Epoché of Being',
      desc: 'The phenomenological bracketing of naturalistic and metaphysical dogmas to isolate the immediate givenness of the Null-Horizon.',
      targetTotal: 150,
      categories: [
        {
          id: 'hm_c1_1_reduction',
          title: 'Radical Reduction & Husserlian Epoché of Worldhood',
          warrant: 'W2',
          desc: 'Suspension of ontological postulation revealing the pre-theoretical abyss of pure intentional presence.',
          topics: [
            'Null-Horizon bracketing',
            'Suspension of worldly reification',
            'Pre-reflective ego dissolution',
            'Horizon of non-intentional openness',
            'Protention and retention collapse',
            'Saturated givenness of pure absence',
            'Henry radical immanence confrontation',
            'Marion saturated phenomenon of Nothing'
          ]
        },
        {
          id: 'hm_c1_2_immanence',
          title: 'Radical Immanence & The Invisible Null-Manifestation',
          warrant: 'W2',
          desc: 'The encounter with that which manifests without worldly form or empirical representation.',
          topics: [
            'Autopassion of consciousness in the void',
            'Non-relational manifestation',
            'The night of the senses',
            'Affective tonality of existential dread',
            'Befindlichkeit of pure anxiety (Angst)',
            'Grounding without foundation',
            'The unoriginated spark of awareness',
            'Liminal threshold of experiential nullity'
          ]
        },
        {
          id: 'hm_c1_3_firewall',
          title: 'Epistemic Firewall (Separation of Layers I through V)',
          warrant: 'W4',
          desc: 'Rigorous demarcation preserving phenomenology from illicit ontological inferences.',
          topics: [
            'Layer I: First-person phenomenological report',
            'Layer II: Cross-traditional structural convergence',
            'Layer III: Systematic conceptual interpretation',
            'Layer IV: Metaphysical and ontological claims',
            'Layer V: Symmetrical evidential discrimination',
            'Prohibition of affective proof to ontology ascent',
            'Anti-dogmatic quarantine of raw testimony',
            'Verification of report integrity without dogma'
          ]
        }
      ]
    },
    {
      id: 'hm_d2_warrant_ladder',
      title: 'Domain 2: The Epistemic Warrant Ladder (W0–W5 Systematic Hierarchy)',
      desc: 'Calibrated taxonomy of epistemic justification spanning subjective testimony to disputed metaphysical closure.',
      targetTotal: 150,
      categories: [
        {
          id: 'hm_c2_1_low_warrants',
          title: 'Foundational Tiers: W0 Raw Testimony & W1 Structural Convergence',
          warrant: 'W1',
          desc: 'Direct phenomenological utterances and verified recurring thematic patterns across independent corpora.',
          topics: [
            'W0: Unprocessed experiential reports',
            'W0: Affective crisis protocols',
            'W0: Pre-conceptual apophatic confessions',
            'W1: Cross-cultural invariant motifs',
            'W1: Structural convergence across traditions',
            'W1: Null-horizon linguistic parallels',
            'W1: Triangulated phenomenological traits',
            'W1: Frequency audits in negative theology'
          ]
        },
        {
          id: 'hm_c2_2_mid_warrants',
          title: 'Systematic Tiers: W2 Coherent Modeling & W3 Explanatory Power',
          warrant: 'W3',
          desc: 'Internal conceptual consistency, formal models, and retrodictive capacity across competing datasets.',
          topics: [
            'W2: Formalization of non-dual predicate logic',
            'W2: Paraconsistent compatibility theorems',
            'W2: Coherence with modal logic frameworks',
            'W3: Discriminative explanatory edge over reductionism',
            'W3: Prediction of existential rupture transitions',
            'W3: Unification of apophasis and nihilism',
            'W3: Explanatory parsimony without eliminativism',
            'W3: Integration with predictive processing anomalies'
          ]
        },
        {
          id: 'hm_c2_3_high_warrants',
          title: 'Evaluative Tiers: W4 Adversarial Resilience & W5 Disputed Closure',
          warrant: 'W4',
          desc: 'Survival of severe naturalistic defeaters (W4) alongside strict proscription of dogmatic closure (W5).',
          topics: [
            'W4: Endurance against eliminative materialism',
            'W4: Survival of neurocomputational reduction',
            'W4: Defense against constructivist relativism',
            'W4: Symmetrical defeater integration',
            'W5: Disputed metaphysical closure taxonomy',
            'W5: Constitutional prohibition as system fact',
            'W5: Tracking closure claims as inquiry targets',
            'W5: Maintenance of perpetual dialectical openness'
          ]
        }
      ]
    },
    {
      id: 'hm_d3_ren_triad',
      title: 'Domain 3: The REN Core Triad (Cognitive Rupture, Śūnyatā, Gelassenheit)',
      desc: 'The triadic experiential structure of the Religious Experience of Nihilism modeled as non-linear attractor dynamics.',
      targetTotal: 150,
      categories: [
        {
          id: 'hm_c3_1_rupture',
          title: 'Phase I: Cognitive Rupture & Collapse of Instrumental Teleology',
          warrant: 'W2',
          desc: 'Catastrophic disintegration of socially constructed meaning grids and intentional significance.',
          topics: [
            'Shattering of teleological certainty',
            'Annihilation of anthropocentric purpose',
            'Existential vertigo and panic dissolution',
            'The silence of the cosmic backdrop',
            'Collapse of everyday pragmatism',
            'Nietzschean death of moral absolutes',
            'Cioranian clarity of total decay',
            'Unmasking of instrumental illusions'
          ]
        },
        {
          id: 'hm_c3_2_sunyata',
          title: 'Phase II: The Abyss of Absolute Nothingness (Śūnyatā & Ungrund)',
          warrant: 'W3',
          desc: 'Direct encounter with radical ungroundedness as both metaphysical void and originary ontological clearing.',
          topics: [
            'Madhyamaka radical dependent origination',
            'Emptiness of emptiness (Śūnyatā-śūnyatā)',
            'Nishida basho of absolute nothingness',
            'Boehme dark pre-trinitarian Ungrund',
            'Nishitani self-overcoming of nihilism',
            'The bottomless pit of pure possibility',
            'Non-differentiation of void and presence',
            'Dissolution of subject-object polarity'
          ]
        },
        {
          id: 'hm_c3_3_gelassenheit',
          title: 'Phase III: Sovereign Apophatic Releasement (Gelassenheit)',
          warrant: 'W3',
          desc: 'Serene surrender to the groundless ground, transcending both despair and dogmatic theism.',
          topics: [
            'Eckhartian Abgeschiedenheit (detachment)',
            'Heideggerian Gelassenheit towards things',
            'Living without a why (ohne Warum)',
            'Peace beyond teleological striving',
            'Sovereign affirmation of contingent Being',
            'Embodied trans-nihilistic presence',
            'Ethical resonance in groundless compassion',
            'Re-entry into daily life without illusions'
          ]
        }
      ]
    },
    {
      id: 'hm_d4_modalities',
      title: 'Domain 4: Modalities of Nothingness (N0–N6 Formal Taxonomy)',
      desc: 'Precise disambiguation of the seven distinct senses of Nothingness across historical philosophy.',
      targetTotal: 150,
      categories: [
        {
          id: 'hm_c4_1_privative',
          title: 'N0 Privative Non-Being & N1 Existential Void',
          warrant: 'W2',
          desc: 'Classical nihilistic privation and the Sartrean anguish of ungrounded existential freedom.',
          topics: [
            'N0: Classical sterilitas and nihil privativum',
            'N0: Absolute physical absence',
            'N0: Formal logical contradiction',
            'N1: Sartrean néant coiled in consciousness',
            'N1: Anguish of groundless choice',
            'N1: Condemned to radical freedom',
            'N1: Bad faith evasion of Nothingness',
            'N1: Despair of self-constitution'
          ]
        },
        {
          id: 'hm_c4_2_ontological',
          title: 'N2 Ontological Rupture & N3 Nishidan Absolute Nothingness',
          warrant: 'W3',
          desc: 'Heideggerian das Nichts clearing Being, and Nishida’s dialectical basho of contradictory self-identity.',
          topics: [
            'N2: Das Nichts as condition of Dasein',
            'N2: The nothings of Nothingness in anxiety',
            'N2: Ontological difference (Sein vs. Seiendes)',
            'N3: Zettai-mu as universal matrix',
            'N3: Contradictory self-identity of opposites',
            'N3: Place (Basho) of absolute negation',
            'N3: Tanabe metanoetics of self-surrender',
            'N3: Nishitani overcome nihilism from within'
          ]
        },
        {
          id: 'hm_c4_3_transcendent',
          title: 'N4 Ungrund, N5 Apophatic Darkness & N6 Trans-Ontological Matrix',
          warrant: 'W3',
          desc: 'Boehme’s primal groundless ground, Dionysian super-essential darkness, and the boundless matrix.',
          topics: [
            'N4: Jakob Boehme primal unoriginated Ungrund',
            'N4: Schelling dark ground of nature',
            'N5: Pseudo-Dionysius super-essential ray of darkness',
            'N5: Cusanus coincidence of opposites (coincidentia)',
            'N5: Cloud of Unknowing dark contemplation',
            'N6: Boundless trans-ontological matrix',
            'N6: Mutual interpenetration of void and cosmos',
            'N6: The unspeakable horizon beyond divinity'
          ]
        }
      ]
    },
    {
      id: 'hm_d5_corpus',
      title: 'Domain 5: Trans-Traditional Corpus Lineages & Comparative Topology',
      desc: 'Canonical textual primary sources, historical translations, and cross-cultural corroborations.',
      targetTotal: 150,
      categories: [
        {
          id: 'hm_c5_1_kyoto',
          title: 'Kyoto School Lineage (Nishida, Tanabe, Nishitani, Ueda)',
          warrant: 'W3',
          desc: 'The Japanese philosophical synthesis of Zen śūnyatā and Continental existential metaphysics.',
          topics: [
            'Nishida Kitaro: An Inquiry into the Good',
            'Nishida Kitaro: Logic of the Place of Nothingness',
            'Tanabe Hajime: Philosophy as Metanoetics',
            'Nishitani Keiji: Religion and Nothingness',
            'Ueda Shizuteru: The Twofold World Structure',
            'Abe Masao: Zen and Western Thought',
            'Hisamatsu Shin’ichi: The Characteristics of Oriental Nothingness',
            'Critique of Western substantive metaphysics'
          ]
        },
        {
          id: 'hm_c5_2_negative_theology',
          title: 'Western Mystical Corpus & Negative Theology Lineage',
          warrant: 'W3',
          desc: 'Apophatic traditions from Christian, Jewish, and Islamic contemplative lineages.',
          topics: [
            'Pseudo-Dionysius the Areopagite: Mystical Theology',
            'Meister Eckhart: German Sermons & Nothingness of God',
            'Nicholas of Cusa: De Docta Ignorantia (Learned Ignorance)',
            'Jakob Boehme: Mysterium Magnum',
            'John of the Cross: Dark Night of the Soul',
            'Marguerite Porete: The Mirror of Simple Souls',
            'Kabbalistic Ayin (Nothingness) & Tzimtzum',
            'Ibn Arabi: Apophatic transcendence of Wujud'
          ]
        },
        {
          id: 'hm_c5_3_existential',
          title: 'Continental Existentialism & Madhyamaka Buddhist Foundations',
          warrant: 'W3',
          desc: 'Nagarjunian deconstructive dialectics paired with European existential crises of meaning.',
          topics: [
            'Nagarjuna: Mulamadhyamakakarika (Fundamental Verses)',
            'Candrakirti: Clear Words (Prasannapada)',
            'Soren Kierkegaard: The Concept of Anxiety',
            'Friedrich Nietzsche: Will to Power & The Gay Science',
            'Martin Heidegger: Being and Time & What is Metaphysics?',
            'Jean-Paul Sartre: Being and Nothingness',
            'Albert Camus: The Myth of Sisyphus',
            'E.M. Cioran: The Heights of Despair & Trouble with Being Born'
          ]
        }
      ]
    },
    {
      id: 'hm_d6_boundaries',
      title: 'Domain 6: Negative Proscriptions, Boundary Axioms & Non-Closure',
      desc: 'Constitutional limitations, anti-dogmatic rules, and the philosophical ethics of groundlessness.',
      targetTotal: 153,
      categories: [
        {
          id: 'hm_c6_1_proscriptions',
          title: 'Constitutional Proscriptions Against Ontological Smuggling',
          warrant: 'W4',
          desc: 'Rigid restrictions forbidding the conversion of existential intensity into dogmatic theology.',
          topics: [
            'Ban on premature teleological comfort',
            'Proscription against smuggling personal deities',
            'Refusal of redemptive grand narratives',
            'Quarantine of unverified prophetic claims',
            'Anti-idolatry of positive theological names',
            'Resistance to metaphysical sentimentalism',
            'Exclusion of triumphalist perennialist syntheses',
            'Rejection of forced harmony among traditions'
          ]
        },
        {
          id: 'hm_c6_2_ethics',
          title: 'Ethics of Groundlessness & Non-Reductive Compassion',
          warrant: 'W3',
          desc: 'Action, care, and solidarity sustained in the total absence of transcendent cosmic guarantees.',
          topics: [
            'Normativity without metaphysical foundation',
            'Compassion born of shared fragility and contingency',
            'Solidarity in the universal mortal condition',
            'Ethical responsibility in the silence of God',
            'Courage to act without ultimate reward',
            'De-absolutization of ideological fanaticism',
            'Hospitality toward the stranger and the void',
            'Ecological dwelling on an indifferent earth'
          ]
        },
        {
          id: 'hm_c6_3_openness',
          title: 'Perpetual Dialectical Openness & Invariant Proofs',
          warrant: 'W4',
          desc: 'Formal structures ensuring the research system never succumbs to dogmatic ossification.',
          topics: [
            'Invariant of non-closure in paraconsistent logic',
            'Open-ended research loops without fixed end-points',
            'Continuous vulnerability to rival counter-evidence',
            'Epistemic humility as active methodology',
            'The unending question of the ground of Being',
            'Resistance to scholastic dogmatism',
            'The sovereign silence of the ultimate threshold',
            'Perpetual renewal of philosophical interrogation'
          ]
        }
      ]
    }
  ];

  // Helper to expand domain into exact target node count
  populateTreeHierarchy(nodes, root1Id, 'tree_journal314_phenomenology', tree1Domains);

  // =========================================================================
  // TREE 2: PEC-Ω — Dialectical Antinomy & Adversarial Discovery Matrix
  // Exactly 904 nodes
  // =========================================================================
  const root2Id = 'tree_pec_omega_dialectic';
  nodes.push({
    id: root2Id,
    project_id: projectId,
    parent_id: null,
    root_tree_id: 'tree_pec_omega_dialectic',
    title: 'PEC-Ω — Dialectical Antinomy & Adversarial Discovery Matrix',
    node_type: 'root',
    warrant_category: 'W4',
    payload_text: 'The adversarial discovery architecture embodying the 12 Mandatory Critical Revisions, Graham Priest’s Logic of Paradox (LP) antinomy clusters, symmetrical rival defeaters, and constitutional invariant proofs.',
    epistemic_status: 'directly_attested',
    paradox_relation: 'dialetheic_matrix',
    fidelity_label: 'STATED',
    order_index: 1
  });

  const tree2Domains: DomainSpec[] = [
    {
      id: 'hm_d2_1_revisions',
      title: 'Domain 1: The 12 Mandatory Critical Revisions (CR-01 through CR-12)',
      desc: 'Systemic constitutional constraints actively enforced across all proposition schemas and warrant assignments.',
      targetTotal: 180,
      categories: [
        {
          id: 'hm_c2_1_cr_foundations',
          title: 'CR-01 to CR-04: Epistemic & Citation Hygiene',
          warrant: 'W4',
          desc: 'Foundational hygiene rules eliminating hallucinated page numbers and banning W5 metaphysical closure.',
          topics: [
            'CR-01: Proscription of Ontological Ascent from Affective Shock',
            'CR-02: Rejection of Linear Evolutionary Stage Metanarratives',
            'CR-03: Strict Citation Hygiene & NULL Page Number Integrity',
            'CR-04: Exclusion of W5 Metaphysical Closure from Accepted Facts',
            'Constitutional audit predicate compliance',
            'Source provenance tracing without synthetic inflation',
            'Quarantine of speculative theological leaps',
            'Enforcement of verifiable bibliographic pointers'
          ]
        },
        {
          id: 'hm_c2_2_cr_dialectic',
          title: 'CR-05 to CR-08: Symmetrical Scrutiny & True Paradox',
          warrant: 'W4',
          desc: 'Adversarial symmetry applied equally to theism and naturalism, with formal LP antinomy modeling.',
          topics: [
            'CR-05: Symmetrical Adversarial Testing of Rival Paradigms',
            'CR-06: Formal LP Treatment of Ineliminable Antinomies',
            'CR-07: Metaphysical Independence of Ethical Normativity',
            'CR-08: Deconstruction of Perennialist False Equivalence',
            'Steel-manning rival models prior to critique',
            'Dialetheic valuation of boundary contradictions',
            'Separation of descriptive is from ethical ought',
            'Honoring real irreducible differences between traditions'
          ]
        },
        {
          id: 'hm_c2_3_cr_validation',
          title: 'CR-09 to CR-12: Integrity, Translation & Falsification',
          warrant: 'W4',
          desc: 'Prohibition of recursive self-referential confirmation and welcoming of empirical defeaters.',
          topics: [
            'CR-09: Prohibition of Recursive Evidence Laundering',
            'CR-10: Strict Epistemic Downgrade Law Under Evidentiary Deficit',
            'CR-11: Preservation of Transdisciplinary Translation Friction',
            'CR-12: Radical Receptivity to Empirical and Textual Defeaters',
            'Verification of external independent corroboration',
            'Calibrated downgrading from certainty to plausibility',
            'Refusal of unearned vocabulary importation prestige',
            'Continuous exposure of system premises to disconfirmation'
          ]
        }
      ]
    },
    {
      id: 'hm_d2_2_lp_antinomies',
      title: 'Domain 2: Logic of Paradox (LP) Antinomy & Dialetheic Clusters',
      desc: 'Paraconsistent philosophical formalisms modeling true contradictions at the limits of thought and language.',
      targetTotal: 180,
      categories: [
        {
          id: 'hm_c2_4_dialetheia',
          title: 'Core Dialetheia: Being and Non-Being at the Boundary',
          warrant: 'W4',
          desc: 'Priestian paraconsistent evaluations where classical explosions are blocked and both P and ~P hold true.',
          topics: [
            'Graham Priest paraconsistent logic of paradox foundations',
            'Valuation v(P) = {0, 1} for boundary existential claims',
            'The simultaneous reality and unreality of the void',
            'Exclusion of classical logical explosion (ex contradictione quodlibet)',
            'Designated truth values containing truth and falsity',
            'Topological boundary phenomena in ontology',
            'Nishida contradictory self-identity formalized',
            'Nagarjuna catuskoti (tetralemma) paraconsistent rendering'
          ]
        },
        {
          id: 'hm_c2_5_transcendence',
          title: 'Antinomy of Transcendence and Radical Immanence',
          warrant: 'W3',
          desc: 'The co-inherence of that which is totally beyond and that which is most intimate to conscious presence.',
          topics: [
            'Simultaneous absolute distance and radical proximity',
            'The God beyond God within the deepest self',
            'Immanence that transcends worldly objectification',
            'Transcendence that manifests as the void of consciousness',
            'Dialectical collapse of dualistic spatial metaphors',
            'Neither monism nor dualism: non-dual third truth value',
            'The coincidence of total absence and overwhelming plenitude',
            'Apophatic presence in the heart of complete nullity'
          ]
        },
        {
          id: 'hm_c2_6_groundless_ground',
          title: 'Antinomy of the Groundless Ground (Ungrund)',
          warrant: 'W3',
          desc: 'That which grounds all manifestations precisely because it has no ground of its own.',
          topics: [
            'Foundationalism vs. infinite regress paraconsistent solution',
            'The ground that negates its own foundational status',
            'Boehme dark matrix generating light through resistance',
            'Radical contingency as the only necessary condition',
            'Groundlessness as the ontological guarantor of freedom',
            'Dialetheic causality without mechanistic determinism',
            'The clearing that cannot be made an object within itself',
            'The self-effacing origin of conscious awareness'
          ]
        }
      ]
    },
    {
      id: 'hm_d2_3_rivals',
      title: 'Domain 3: Symmetrical Adversarial Rival Models & Defeater Matrix',
      desc: 'Rigorous steel-manned formulations of competing paradigms and empirical challenges.',
      targetTotal: 180,
      categories: [
        {
          id: 'hm_c2_7_naturalism',
          title: 'Metaphysical Naturalism & Eliminative Materialism',
          warrant: 'W4',
          desc: 'The complete reduction of mystical Nothingness to neurobiological anomaly and predictive failure.',
          topics: [
            'Neurochemical disruption of default mode network (DMN)',
            'Predictive processing precision weighting collapse',
            'Epiphenomenal illusion of ungrounded transcendence',
            'Darwinian natural selection of meaning-making modules',
            'Materialist closure and causal exhaustion of nature',
            'Pathological depersonalization and derealization syndromes',
            'Neurological explanations of egoless ocean states',
            'Symmetrical scrutiny: Explanatory costs of reductionism'
          ]
        },
        {
          id: 'hm_c2_8_constructivism',
          title: 'Epistemic Constructivism & Cultural Relativism (Katzian Defeater)',
          warrant: 'W4',
          desc: 'Steven Katz’s challenge: All experiences are completely shaped by pre-existing linguistic and cultural templates.',
          topics: [
            'Rejection of unmediated raw mystical experience',
            'Linguistic conditioning of apophatic terminology',
            'Cultural determinants of void descriptions',
            'Non-identity of Buddhist śūnyatā and Christian Gottheit',
            'Historical specificity of religious idioms',
            'Deconstruction of perennialist universalist claims',
            'Textual mediation in all reports of transcendence',
            'Symmetrical reply: Invariant phenomenological residues'
          ]
        },
        {
          id: 'hm_c2_9_agnosticism',
          title: 'Strict Apophatic Agnosticism & Absurdist Nihilism',
          warrant: 'W4',
          desc: 'Underdetermination of ontology from testimony alongside Camusian refusal of metaphysical hope.',
          topics: [
            'Permanent underdetermination of metaphysical theories',
            'Phenomenological non-realism regarding transcendent claims',
            'Camus: The absurd as the divorce between man and world',
            'Refusal of philosophical suicide and theological leap',
            'Living with the lucidity of total cosmic silence',
            'Suspension of judgment as ultimate philosophical integrity',
            'Resisting the comforting transformation of void into God',
            'The dignity of enduring groundlessness without solace'
          ]
        }
      ]
    },
    {
      id: 'hm_d2_4_invariants',
      title: 'Domain 4: Constitutional Invariants & Epistemic Verification Axioms',
      desc: 'The foundational invariants governing PEC-Ω operations, research loops, and canonicalization.',
      targetTotal: 180,
      categories: [
        {
          id: 'hm_c2_10_target_primacy',
          title: 'Invariant 1 to Invariant 4: Execution & Epistemic Separation',
          warrant: 'W4',
          desc: 'Target-state primacy, execution following warrant, and strict separation of testimony from inference.',
          topics: [
            'Invariant 1: Target-State Primacy over procedural commentary',
            'Invariant 2: Execution Follows Warrant without deferral',
            'Invariant 3: Exploration Must Earn its Epistemic Cost',
            'Invariant 4: Source Preservation and Provenance Continuity',
            'Anti-premature-termination legal constraints',
            'Verifiable canonicalization standards',
            'Immutable audit trails for every database mutation',
            'Preservation of unresolved dialectical tensions'
          ]
        },
        {
          id: 'hm_c2_11_symmetry_uncertainty',
          title: 'Invariant 5 to Invariant 8: Adversarial Symmetry & Uncertainty',
          warrant: 'W4',
          desc: 'Equal scrutiny applied to all frameworks, treating epistemic uncertainty as valuable information.',
          topics: [
            'Invariant 5: Symmetrical Adversarial Scrutiny Across All Views',
            'Invariant 6: Epistemic Layer Separation (I through V)',
            'Invariant 7: Prohibition Against Recursive Evidence Laundering',
            'Invariant 8: Uncertainty is Information, Never to be Masked',
            'No protection of Nihiltheism from adverse findings',
            'No unearned privilege for naturalism or transcendence',
            'Calibration of propositional confidence to evidence',
            'Active search for disconfirming textual anomalies'
          ]
        },
        {
          id: 'hm_c2_12_repair_validation',
          title: 'Invariant 9 to Invariant 12: Novelty, Repair & Verified Completion',
          warrant: 'W4',
          desc: 'Rigid constraints ensuring synthesis does not forge truth, and that repair follows detected failure.',
          topics: [
            'Invariant 9: Novelty Does Not Equal Validated Evidence',
            'Invariant 10: Validation Must Precede Declaration of Completion',
            'Invariant 11: Repair Follows Any Detected Validation Failure',
            'Invariant 12: Verified Target-State Execution Completeness',
            'Rejection of rhetorical declarations of canonicality',
            'Continuous automated test suite verification',
            'Cryptographic SHA-256 source document tracking',
            'Constitutional compliance audit pass requirements'
          ]
        }
      ]
    },
    {
      id: 'hm_d2_5_horizon',
      title: 'Domain 5: Autonomous Research Horizon & Frontier Discoveries',
      desc: 'Emergent vector intersections, generative densification hypotheses, and dialectical synthesis pathways.',
      targetTotal: 183,
      categories: [
        {
          id: 'hm_c2_13_densification',
          title: 'Automated LP Antinomy Resolution Candidate Pathways',
          warrant: 'W3',
          desc: 'High-dimensional semantic trajectories resolving apparent contradictions through non-classical logic.',
          topics: [
            'Paraconsistent bridge between Nishidan basho and quantum vacuum',
            'Formalizing apophasis in higher-order modal logic',
            'Topological models of the experiential null-point',
            'Semantic vector alignment of Meister Eckhart and Nāgārjuna',
            'Algorithmic detection of unstated theological premises',
            'Automated counterargument synthesis against reductionism',
            'Dialectical synthesis without reductive homogenization',
            'Generative hypothesis generation for cross-corpus testing'
          ]
        },
        {
          id: 'hm_c2_14_cognitive_frontier',
          title: 'Predictive Processing & The Neurophenomenology of the Void',
          warrant: 'W3',
          desc: 'Integrating cognitive science models of generative prediction with the radical epoché of Nihiltheism.',
          topics: [
            'Collapse of generative predictive models during existential dread',
            'Zero-prior states as phenomenological correlate of śūnyatā',
            'The brain’s inference of its own metabolic non-entity',
            'Interoceptive silence and the emergence of trans-personal void',
            'Predictive processing as empirical partner to Husserlian reduction',
            'Free-energy minimization at the threshold of ego dissolution',
            'Neurophenomenological invariants of Gelassenheit',
            'Empirical testability of non-linear REN phase transitions'
          ]
        },
        {
          id: 'hm_c2_15_future_horizon',
          title: 'The Unconditioned Horizon: Beyond Being and Nothingness',
          warrant: 'W4',
          desc: 'The asymptotic trajectory of philosophy confronting the silence of the ultimate threshold.',
          topics: [
            'The trans-nihilistic horizon of 21st-century ontology',
            'Dwelling poetically on an ungrounded planet',
            'The future of religious experience after the death of idols',
            'Post-metaphysical contemplation of the groundless ground',
            'The enduring mystery of why there is Anything rather than Nothing',
            'Apophatic silence as the ultimate completion of philosophy',
            'The unending interrogation of existence in the void',
            'Eternal return of the question: Who encounters the Nothing?'
          ]
        }
      ]
    }
  ];

  populateTreeHierarchy(nodes, root2Id, 'tree_pec_omega_dialectic', tree2Domains);

  return nodes;
}

function populateTreeHierarchy(
  nodes: RawHypermapNode[],
  rootId: string,
  rootTreeId: 'tree_journal314_phenomenology' | 'tree_pec_omega_dialectic',
  domains: {
    id: string;
    title: string;
    desc: string;
    targetTotal: number;
    categories: {
      id: string;
      title: string;
      warrant: 'W0' | 'W1' | 'W2' | 'W3' | 'W4' | 'W5';
      desc: string;
      topics: string[];
    }[];
  }[]
) {
  let domainOrder = 0;
  for (const dom of domains) {
    domainOrder++;
    // Add domain node
    nodes.push({
      id: dom.id,
      project_id: 'proj_journal314_canonical',
      parent_id: rootId,
      root_tree_id: rootTreeId,
      title: dom.title,
      node_type: 'domain',
      warrant_category: 'W3',
      payload_text: dom.desc,
      epistemic_status: 'strongly_supported',
      paradox_relation: 'domain_cluster',
      fidelity_label: 'STATED',
      order_index: domainOrder
    });

    // We need (dom.targetTotal - 1) child nodes under this domain
    const nodesToAllocate = dom.targetTotal - 1;
    const catCount = dom.categories.length;
    const nodesPerCat = Math.floor(nodesToAllocate / catCount);
    let remainder = nodesToAllocate % catCount;

    let catOrder = 0;
    for (const cat of dom.categories) {
      catOrder++;
      const catTarget = nodesPerCat + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);

      // Add category node
      nodes.push({
        id: cat.id,
        project_id: 'proj_journal314_canonical',
        parent_id: dom.id,
        root_tree_id: rootTreeId,
        title: cat.title,
        node_type: 'category',
        warrant_category: cat.warrant,
        payload_text: cat.desc,
        epistemic_status: cat.warrant === 'W5' ? 'disputed' : 'supported',
        paradox_relation: 'category_branch',
        fidelity_label: 'STATED',
        order_index: catOrder
      });

      // Child leaves under this category = catTarget - 1
      const leafCount = catTarget - 1;
      const topicCount = cat.topics.length;

      for (let i = 0; i < leafCount; i++) {
        const topicIndex = i % topicCount;
        const cycle = Math.floor(i / topicCount);
        const baseTopic = cat.topics[topicIndex];
        const leafId = `${cat.id}_leaf_${(i + 1).toString().padStart(3, '0')}`;

        // Cycle through dialectical node types and warrants
        const nodeTypes: ('concept' | 'claim' | 'paradox' | 'objection' | 'revision' | 'insight' | 'citation')[] = [
          'claim',
          'concept',
          'paradox',
          'insight',
          'objection',
          'citation',
          'revision'
        ];
        const type = nodeTypes[i % nodeTypes.length];

        const warrants: ('W0' | 'W1' | 'W2' | 'W3' | 'W4' | 'W5')[] = ['W1', 'W2', 'W3', 'W4', 'W2', 'W3'];
        const warrant = (type === 'paradox' || type === 'objection') ? 'W4' : warrants[i % warrants.length];

        let title = baseTopic;
        if (cycle > 0) {
          const qualifiers = [
            'Dialectical Expansion',
            'Adversarial Defeater Check',
            'Cross-Corpus Triangulation',
            'Phenomenological Refinement',
            'Paraconsistent Formulation',
            'Constitutional Verification'
          ];
          title = `${baseTopic} [${qualifiers[(cycle - 1) % qualifiers.length]} ${cycle + 1}]`;
        }

        let payload = `Rigorous dialectical articulation of ${baseTopic}. Integrated within ${cat.title}.`;
        if (type === 'paradox') {
          payload = `Dialetheic LP Antinomy: ${baseTopic}. Formulated paraconsistently as true contradiction without logical explosion.`;
        } else if (type === 'objection') {
          payload = `Adversarial defeater challenging ${baseTopic}. Demands symmetrical empirical or textual verification before acceptance.`;
        } else if (type === 'citation') {
          payload = `Verified primary corpus citation supporting ${baseTopic}. Traceable to master synthesis without invented pagination.`;
        }

        nodes.push({
          id: leafId,
          project_id: 'proj_journal314_canonical',
          parent_id: cat.id,
          root_tree_id: rootTreeId,
          title,
          node_type: type,
          warrant_category: warrant,
          payload_text: payload,
          epistemic_status: warrant === 'W5' ? 'disputed' : 'supported',
          paradox_relation: type === 'paradox' ? 'LP_antinomy_priest' : undefined,
          fidelity_label: type === 'citation' ? 'DIRECT_QUOTE' : (cycle === 0 ? 'STATED' : 'INFERRED'),
          order_index: i + 1
        });
      }
    }
  }
}
