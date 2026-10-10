/**
 * Seed Corpus for Nihiltheism Architect
 * Preserves the supplied Master Synthesis with strict provenance hygiene,
 * registers Mandatory Critical Revisions CR-01 through CR-12,
 * and provides the 17 substantive reference edition chapters.
 */

import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { MANUSCRIPT_CHAPTERS } from './manuscriptData.js';
import { generateCanonical1808HypermapNodes } from './hypermapData';

export function seedHypermapIfEmpty(db: DatabaseSync): void {
  try {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM hypermap_nodes').get() as any;
    if (countRow && countRow.count > 0) {
      return; // already populated
    }

    db.exec('SAVEPOINT seed_hypermap');

    const nodes = generateCanonical1808HypermapNodes('proj_journal314_canonical');
    const insertNode = db.prepare(`
      INSERT INTO hypermap_nodes (
        id, project_id, parent_id, root_tree_id, title, node_type,
        warrant_category, payload_text, epistemic_status, paradox_relation,
        fidelity_label, claim_id, passage_id, order_index, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    for (const n of nodes) {
      insertNode.run(
        n.id,
        n.project_id,
        n.parent_id,
        n.root_tree_id,
        n.title,
        n.node_type,
        n.warrant_category || null,
        n.payload_text,
        n.epistemic_status,
        n.paradox_relation || null,
        n.fidelity_label,
        null,
        null,
        n.order_index,
        now,
        now
      );
    }
    db.exec('RELEASE seed_hypermap');
    console.log(`[Hypermap Seed] Successfully populated ${nodes.length} canonical nodes in SQLite hypermap_nodes`);
  } catch (err) {
    db.exec('ROLLBACK TO seed_hypermap; RELEASE seed_hypermap');
    throw err;
  }
}

export function seedDatabase(db: DatabaseSync): void {
  db.exec('SAVEPOINT seed_database');
  try {
    seedDatabaseInternal(db);
    db.exec('RELEASE seed_database');
  } catch (error) {
    db.exec('ROLLBACK TO seed_database; RELEASE seed_database');
    throw error;
  }
}
function seedDatabaseInternal(db: DatabaseSync): void {

  // Check if project already seeded
  const checkProject = db.prepare('SELECT id FROM projects WHERE id = ?');
  const existing = checkProject.get('proj_journal314_canonical');
  if (existing) {
    seedHypermapIfEmpty(db);
    return; // already seeded
  }

  const now = new Date().toISOString();

  // 1. Project
  const insertProject = db.prepare(`
    INSERT INTO projects (id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertProject.run(
    'proj_journal314_canonical',
    'Journal314 Canonical Architecture',
    'Foundational project seeded from The Architecture of Nihiltheism: Master Synthesis v1.0, PEC-Ω inquiry kernel, and critical corrections register.',
    now,
    now
  );

  // 2. Mandatory Critical Revisions (CR-01 through CR-12)
  const insertCorrection = db.prepare(`
    INSERT INTO corrections (code, title, source_assertion, critical_revision, constitutional_rationale, enforced_in_system)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const correctionsList = [
    {
      code: 'CR-01',
      title: 'Universality of Nihilistic Rupture',
      source_assertion: 'Universal Nihilistic Event (UNE) is an objective invariant undergone by all consciousness.',
      critical_revision: 'UNE is the source text\'s theoretical model for a proposed structure of meaning-collapse, not established empirical evidence that all human persons undergo the identical event.',
      rationale: 'Constitutional Constraint A (Predicate Hygiene) and Invariant 8 (Adversarial Symmetry). Claim downgraded from ontological invariant to phenomenological model requiring empirical and hermeneutic validation.',
    },
    {
      code: 'CR-02',
      title: 'Phenomenology vs. Clinical Classification',
      source_assertion: 'UNE is fundamentally distinct from clinical depressive disorder as an authentic ontological revelation.',
      critical_revision: 'The text\'s distinction between UNE and depression is not a medically validated clinical diagnostic category. The system must never classify user psychological distress as metaphysical disclosure or rule out psychiatric consultation.',
      rationale: 'Ethical boundary & Product Definition. The workbench is an epistemic research instrument, not a psychiatric or diagnostic system.',
    },
    {
      code: 'CR-03',
      title: 'Non-Prescriptive Embodiment',
      source_assertion: 'Extreme asceticism, fasting stages, and sleep deprivation are valid operational instructions to become the "architect of your own ontological collapse".',
      critical_revision: 'Somatic deprivation descriptions are recorded strictly as historical or phenomenological reportage. The system forbids operational directives prescribing self-harm, severe fasting, or destabilization as avenues to insight.',
      rationale: 'Constitutional Commitment E (No suffering-based epistemic privilege). Intensity or somatic deprivation does not establish truth.',
    },
    {
      code: 'CR-04',
      title: 'Warrant Categories are Not One Evidential Ladder',
      source_assertion: 'Warrant levels W0 through W5 represent a single linear ascending evidential hierarchy where higher index implies stronger epistemic proof.',
      critical_revision: 'W4 denotes practical commitment (praxis), which is not evidentially stronger than W3 (theoretical hypothesis). W5 (metaphysical closure) is an object of critique and analysis, strictly forbidden from being adopted as an established system conclusion.',
      rationale: 'Epistemic layer separation. Evidential support status and claim type must be tracked in distinct fields.',
    },
    {
      code: 'CR-05',
      title: 'Anti-Evasion Symmetry',
      source_assertion: 'Comfort-seeking interpretations are automatically false, while distress-inducing or terrifying interpretations are inherently authentic.',
      critical_revision: 'Comfort does not demonstrate falsity; distress does not demonstrate truth. Secular interpretations need not terminate in hopeless despair, and transcendent interpretations can themselves serve as evasive consolations.',
      rationale: 'Constitutional Commitment D (Symmetrical Scrutiny) and Anti-Evasion Symmetry.',
    },
    {
      code: 'CR-06',
      title: 'Anti-Hero Revision',
      source_assertion: 'Any value or practice that grants identity satisfaction, subjective joy, or heroic meaning must be excised as ego-scaffolding.',
      critical_revision: 'A value is not invalid merely because it brings satisfaction or strengthens selfhood. Evaluation must center on justification, interpersonal consequences, domination, self-exemption, and responsiveness to critique.',
      rationale: 'Axiological reform. Avoiding performative anti-hero purism that covertly installs an inverted moral pride.',
    },
    {
      code: 'CR-07',
      title: 'Ethical Non-Entailment',
      source_assertion: 'Compassion and non-cruelty follow as automatic metaphysical residues from ego dissolution and void awareness.',
      critical_revision: 'Compassion and non-cruelty are defensible normative commitments that require explicit normative premises; they do not logically follow from cosmic meaninglessness alone.',
      rationale: 'Constitutional Commitment F (Normative Transparency). The is-ought gap cannot be dissolved by sheer intensity of void-consciousness.',
    },
    {
      code: 'CR-08',
      title: 'Historical Precision in Heideggerian Mapping',
      source_assertion: 'Heidegger\'s Ereignis, Gestell, and Nichts map directly and synonymously to Nihiltheism\'s Divine Void and Transcendent Plenum.',
      critical_revision: 'Heideggerian concepts must not be equated automatically with a substantial Void or a theological reality. Ereignis is the historical event of appropriation; Gestell is technological enframing. Mappings must be classified as interpretations requiring textual support.',
      rationale: 'Hermeneutic fidelity. Respecting primary textual context without collapsing distinct philosophical projects into syncretic identity.',
    },
    {
      code: 'CR-09',
      title: 'Comparative Restraint in Eastern Traditions',
      source_assertion: 'Buddhist Sunyata, Advaitic Turiya, and Christian Divine Darkness are identical revelations of the Nihiltheistic Void-Deity.',
      critical_revision: 'Buddhist emptiness (Pratityasamutpada / Sunyata) is non-substantial dependent origination, distinct from Advaitic ultimate Brahman or apophatic theological Ground. Cross-cultural resonance must not be converted into metaphysical identity.',
      rationale: 'Triangulation Law & Invariant 8. Structural resonance is not ontological identity.',
    },
    {
      code: 'CR-10',
      title: 'Gödel Limitation',
      source_assertion: 'Gödel\'s Incompleteness Theorems mathematically prove that human prose philosophy cannot reach final closure.',
      critical_revision: 'Gödel\'s theorems formally apply strictly to axiomatic mathematical systems capable of Peano arithmetic. Any application to discursive prose metaphysics is an analogy, not a formal mathematical demonstration.',
      rationale: 'Technical integrity and anti-prestige vocabulary importation.',
    },
    {
      code: 'CR-11',
      title: 'Temporal and Spatial Phenomenological Precision',
      source_assertion: 'Felt collapse of protention physically suspends time; non-Euclidean transparency physically refashions cosmic space.',
      critical_revision: 'Phenomenological descriptions of collapsed anticipation or unbounded spatial transparency describe structures of lived human appearance, not altered physical space-time or broken physical causation.',
      rationale: 'Layer separation: Phenomenology (Layer I) must never be illicitly promoted into Objective Physics (Layer IV).',
    },
    {
      code: 'CR-12',
      title: 'No Fake Finality Metrics',
      source_assertion: 'The system has achieved "97.5% saturation" and "100% coherence" across all existential coordinates.',
      critical_revision: 'Numerical saturation and coherence figures asserted in source notes are recorded as unverified author assertions. The system replaces fabricated metrics with observable review states, unresolved objections, and explicit uncertainty boundaries.',
      rationale: 'Constitutional Commitment C (Non-closure) and Invariant 9 (Uncertainty is information).',
    }
  ];

  for (const c of correctionsList) {
    insertCorrection.run(c.code, c.title, c.source_assertion, c.critical_revision, c.rationale, 1);
  }

  // 3. Seed Source: Master Synthesis v1.0 (labeled summary_only, no fabricated page numbers)
  const masterSynthesisRawText = `MASTER_SYNTHESIS version="1.0"
TITLE: The Architecture of Nihiltheism: A Complete Expert Synthesis
PURPOSE: Single-sitting expert upgrade: novice -> functional expert in the phenomenology and metaphysics of the Void-Encounter.
ABSTRACT: This document synthesizes the conceptual architecture of Nihiltheism, defined by the non-evasive inhabitation of the Universal Nihilistic Event (UNE). It maps the micro-phenomenology of the rupture (temporal collapse, spatial dissolution, somatic stripping, affective topology), establishes a constitutive logical framework based on paradox and apophatic epistemology ("knowledge through unknowing"), and delineates the interpretive bifurcation between Worldly and Transcendent modalities. Key deliverables include a warrant ladder for epistemic claims, a predicate hygiene protocol to prevent metaphysical smuggling, cross-traditional invariant mapping, an axiology of value without ground, and speculative frontiers regarding AI and quantum mechanics.

[TOPIC 1: UNIVERSAL NIHILISTIC EVENT]
The Universal Nihilistic Event (UNE) is a proposed structural rupture where ordinary scaffolds of meaning, selfhood, and worldhood collapse, exposing groundlessness. It distinguishes Nihiltheism from mere intellectual pessimism; anchors the philosophy in lived structure. Dependencies: Collapse of Protention, Objectless Dread. A sudden realization that future projects are metaphysically weightless, accompanied by temporal vertigo. Common failure mode: Treating it as clinical depression rather than an ontological disclosure.

[TOPIC 2: INTERPRETIVE MODALITIES]
Nihiltheism distinguishes between the event itself and its two primary interpretive modalities:
1. Worldly Nihilism: Interprets the collapse as terminal deficit, futility, and ruin.
2. Transcendent Nihilism: Interprets the rupture as a "negative sacrament" or disclosure-horizon, where the silence of the Void is experienced as a plenum or pregnant fullness.
Constitutional constraints: Anti-Evasion, Disclosure is not Proof, Non-Closure.

[TOPIC 3: CONSTITUTIONAL CONSTRAINTS]
Predicate Hygiene: The strict discipline of distinguishing between experience-descriptions ("I felt timelessness") and metaphysical claims ("Reality is timeless"). Prevents Metaphysical Inflation. Keeps the system intellectually honest and rigorously apophatic.
Disclosure != Proof: Experience discloses reality to human awareness but does not automatically demonstrate an ontology.
Anti-Evasion: Comfort-seeking interpretations must be evaluated with the same rigor as distress-seeking ones.

[TOPIC 4: TEMPORAL PHENOMENOLOGY]
Temporal Strata: Rupture (collapse of protention), Oscillation, Stabilization, Deepening, Integration. Protention is the structural anticipation of the future that organizes present experience. In the UNE, the future ceases to pull, creating an acute temporal vertigo.

[TOPIC 5: SPATIAL PHENOMENOLOGY]
Spatial Strata: Boundary collapse, infinite expansion, non-Euclidean transparency, dissolution, plenum. Space ceases to function as a container of separate objects; boundaries between the subject and the ambient environment thin.

[TOPIC 6: EMBODIMENT AND AFFECT]
The body as scaffolding revealed through deprivation. Affective Topology: Dread (objectless), Despair (terminal vs dynamic), Awe, Bliss, Compassion. Ascetic practice (fasting, deprivation) exposes self-maintenance rather than proving divine intervention.

[TOPIC 7: FIVE PARADOXES]
Paradox Alpha: All meaning is meaningless (Self-refutation handled as Exposure Report).
Paradox Beta: Willing Non-Will (Handled as Transformational Gradient).
Paradox Gamma: Ineffability (Handled via Negative and Indicative language).
Paradox Delta: Certainty vs License (Phenomenological certainty does not equal metaphysical entitlement).
Paradox Epsilon: Emptiness as Plenum (Experience-quality vs Substance-claim).

[TOPIC 8: WARRANT CATEGORIES]
W0: Raw report ("I experienced darkness").
W1: Phenomenological description ("The horizon of expectation dissolved").
W2: Resemblance ("This report mirrors Eckhart\'s desert").
W3: Explanatory hypothesis ("Nothingness has a generative structure").
W4: Practical commitment ("I resolve to live with non-cruelty without ground").
W5: Metaphysical closure ("The Void is definitively the Godhead") - strictly prohibited as a settled system fact.

[TOPIC 9: HEIDEGGER-RELATED CONCEPTS]
Nichts (GA 9: das Nichts nichtet), Angst (SZ §§40-44, discloses the Nothing), Gestell (technological enframing), Ereignis (event of appropriation), Gelassenheit (releasement / letting-be), Ab-grund (abyssal groundless ground), aletheia (unconcealment amidst concealment), and profound boredom (tiefe Langeweile in GA 29/30).

[TOPIC 10: RESEARCH METHODOLOGY]
Extraction, organization, relationship mapping, synthesis, contradiction testing, and recursive densification. Iterative deepening until claims are tested against rival perspectives.

[TOPIC 11: AXIOLOGY]
Value without ground: Values that survive exposure (honesty, non-cruelty). Anti-Hero Test: Does this value function to grant me identity-salvation or spiritual specialness? Renunciation of ontological overinvestment.

[TOPIC 12: COMPARATIVE & SPECULATIVE FRONTIERS]
Cross-traditional mappings: Christian mysticism (Dark Night), Buddhist Sunyata (emptiness), Advaitic Turiya, Taoist Wu Wei. Speculative frontiers: AI consciousness and the prerequisite for UNE (subjectivity, temporal projection); quantum vacuum fluctuations as physical analogy (not proof).
Unverified Source Assertions: Claims of "97.5% saturation" and "100% coherence" are recorded as unverified author assertions.`;

  const sourceHash = crypto.createHash('sha256').update(masterSynthesisRawText).digest('hex');

  const insertSource = db.prepare(`
    INSERT INTO sources (id, project_id, filename, media_type, sha256_hash, import_timestamp, extraction_method, content_completeness, extraction_warnings, storage_path, passage_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSource.run(
    'src_master_synthesis_v1',
    'proj_journal314_canonical',
    'master_synthesis_v1.0.txt',
    'text/plain',
    sourceHash,
    now,
    'supplied_compressed_synthesis',
    'summary_only', // explicit summary_only label per A02
    JSON.stringify(['Summary-only corpus seed: no PDF pagination fabricated.', 'Numerical saturation claims recorded as unverified assertions.']),
    'seed/master_synthesis_v1.0.txt',
    12
  );

  // 4. Passages for the seed source (strictly null page_number to satisfy A02)
  const passagesList = [
    {
      id: 'pas_une_01',
      index: 1,
      heading: 'Topic 1: Universal Nihilistic Event',
      text: 'The Universal Nihilistic Event (UNE) is a proposed structural rupture where ordinary scaffolds of meaning, selfhood, and worldhood collapse, exposing groundlessness. It distinguishes Nihiltheism from mere intellectual pessimism; anchors the philosophy in lived structure. Dependencies: Collapse of Protention, Objectless Dread.',
    },
    {
      id: 'pas_modalities_02',
      index: 2,
      heading: 'Topic 2: Interpretive Modalities',
      text: 'Nihiltheism distinguishes between the event itself and its two primary interpretive modalities: Worldly Nihilism (interprets the collapse as terminal deficit, futility, and ruin) and Transcendent Nihilism (interprets the rupture as a negative sacrament or disclosure-horizon, where the silence of the Void is experienced as a plenum or pregnant fullness).',
    },
    {
      id: 'pas_constraints_03',
      index: 3,
      heading: 'Topic 3: Constitutional Constraints',
      text: 'Predicate Hygiene: The strict discipline of distinguishing between experience-descriptions ("I felt timelessness") and metaphysical claims ("Reality is timeless"). Prevents Metaphysical Inflation. Disclosure is not Proof: Experience discloses reality to human awareness but does not automatically demonstrate an ontology.',
    },
    {
      id: 'pas_time_04',
      index: 4,
      heading: 'Topic 4: Temporal Phenomenology',
      text: 'Temporal Strata: Rupture (collapse of protention), Oscillation, Stabilization, Deepening, Integration. Protention is the structural anticipation of the future that organizes present experience. In the UNE, the future ceases to pull, creating an acute temporal vertigo.',
    },
    {
      id: 'pas_space_05',
      index: 5,
      heading: 'Topic 5: Spatial Phenomenology',
      text: 'Spatial Strata: Boundary collapse, infinite expansion, non-Euclidean transparency, dissolution, plenum. Space ceases to function as a container of separate objects; boundaries between the subject and ambient environment thin.',
    },
    {
      id: 'pas_body_06',
      index: 6,
      heading: 'Topic 6: Embodiment and Affect',
      text: 'The body as scaffolding revealed through deprivation. Affective Topology: Dread (objectless), Despair (terminal vs dynamic), Awe, Bliss, Compassion. Ascetic practice exposes self-maintenance rather than proving divine intervention.',
    },
    {
      id: 'pas_paradoxes_07',
      index: 7,
      heading: 'Topic 7: Five Paradoxes',
      text: 'Paradox Alpha: All meaning is meaningless (Self-refutation handled as Exposure Report). Paradox Beta: Willing Non-Will. Paradox Gamma: Ineffability. Paradox Delta: Certainty vs License (Phenomenological certainty does not equal metaphysical entitlement). Paradox Epsilon: Emptiness as Plenum.',
    },
    {
      id: 'pas_warrants_08',
      index: 8,
      heading: 'Topic 8: Warrant Categories',
      text: 'W0: Raw report. W1: Phenomenological description. W2: Resemblance. W3: Explanatory hypothesis. W4: Practical commitment. W5: Metaphysical closure ("The Void is definitively God") - strictly prohibited as a settled system fact.',
    },
    {
      id: 'pas_heidegger_09',
      index: 9,
      heading: 'Topic 9: Heidegger-Related Concepts',
      text: 'Nichts (GA 9: das Nichts nichtet), Angst (SZ §§40-44, discloses the Nothing), Gestell (technological enframing), Ereignis (event of appropriation), Gelassenheit (releasement / letting-be), Ab-grund (abyssal groundless ground), aletheia (unconcealment amidst concealment), and profound boredom (tiefe Langeweile in GA 29/30).',
    },
    {
      id: 'pas_methodology_10',
      index: 10,
      heading: 'Topic 10: Research Methodology',
      text: 'Extraction, organization, relationship mapping, synthesis, contradiction testing, and recursive densification. Iterative deepening until claims are tested against rival perspectives.',
    },
    {
      id: 'pas_axiology_11',
      index: 11,
      heading: 'Topic 11: Axiology and the Anti-Hero Test',
      text: 'Value without ground: Values that survive exposure (honesty, non-cruelty). Anti-Hero Test: Does this value function to grant me identity-salvation or spiritual specialness? Renunciation of ontological overinvestment.',
    },
    {
      id: 'pas_comparative_12',
      index: 12,
      heading: 'Topic 12: Comparative and Speculative Frontiers',
      text: 'Cross-traditional mappings: Christian mysticism (Dark Night), Buddhist Sunyata (emptiness), Advaitic Turiya, Taoist Wu Wei. Speculative frontiers: AI consciousness and prerequisites for UNE (subjectivity, temporal projection); quantum vacuum fluctuations as physical analogy (not proof). Unverified source saturation claims (97.5% saturation, 100% coherence) recorded as unverified author assertions.',
    }
  ];

  const insertPassage = db.prepare(`
    INSERT INTO passages (id, source_id, passage_index, text, page_number, section_heading, char_offset_start, char_offset_end, warnings)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPassageFts = db.prepare(`
    INSERT INTO passages_fts (id, source_id, text, section_heading)
    VALUES (?, ?, ?, ?)
  `);

  let currentOffset = 0;
  for (const p of passagesList) {
    const start = currentOffset;
    const end = start + p.text.length;
    currentOffset = end + 2;

    insertPassage.run(
      p.id,
      'src_master_synthesis_v1',
      p.index,
      p.text,
      null, // page_number IS NULL (A02 compliance: no fake page numbers)
      p.heading,
      start,
      end,
      JSON.stringify([])
    );

    insertPassageFts.run(p.id, 'src_master_synthesis_v1', p.text, p.heading);
  }

  // 5. Seed Concepts
  const insertConcept = db.prepare(`
    INSERT INTO concepts (id, project_id, name, canonical_term, definition, senses, thesis, limit_condition, status, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const conceptsData = [
    {
      id: 'c_une',
      name: 'Universal Nihilistic Event',
      term: 'UNE',
      definition: 'A proposed phenomenological rupture wherein default cognitive, socio-cultural, and existential scaffolding collapses, exposing groundlessness.',
      senses: ['Experiential disruption of life orientation', 'Theoretical construct for cross-traditional comparative analysis'],
      thesis: 'Meaning-collapse operates as an epistemic disclosure of finitude rather than mere affective deficit.',
      limit: 'Must not be generalized as an empirical universal without sociological/psychological verification.',
      status: 'STATED',
      tags: ['phenomenology', 'rupture', 'core_axiom']
    },
    {
      id: 'c_predicate_hygiene',
      name: 'Predicate Hygiene',
      term: 'Predicate Hygiene',
      definition: 'The methodological rule demanding strict separation between experiential descriptions (Layer I) and metaphysical ontological assertions (Layer IV).',
      senses: ['Linguistic protocol for philosophical authoring', 'Epistemic barrier against metaphysical inflation'],
      thesis: 'First-person reports of vastness or timelessness do not license ontological claims of cosmic infinitude.',
      limit: 'Must not be used to dismiss lived experience, but to prevent premature ontological leaps.',
      status: 'STATED',
      tags: ['methodology', 'epistemology', 'constraint']
    },
    {
      id: 'c_transcendent_nihilism',
      name: 'Transcendent Nihilism',
      term: 'Transcendent Nihilism',
      definition: 'An interpretive modality that encounters radical groundlessness not as terminal futility (Worldly Nihilism), but as an apophatic horizon of sacred openness.',
      senses: ['Interpretive stance toward existential collapse', 'Apophatic theology freed from dogmatic closure'],
      thesis: 'The Void can be inhabited as a generative horizon without asserting dogmatic theological substance.',
      limit: 'Subject to Anti-Evasion Symmetry; must not smuggle compensatory theological comfort.',
      status: 'STATED',
      tags: ['modality', 'transcendence', 'apophasis']
    },
    {
      id: 'c_protention',
      name: 'Protention',
      term: 'Protention',
      definition: 'The lived phenomenological intentionality by which consciousness continually leans forward into an anticipated future horizon.',
      senses: ['Husserlian time-consciousness component', 'Lived expectation destroyed in existential vertigo'],
      thesis: 'The collapse of protention constitutes the core temporal mechanism of the Universal Nihilistic Event.',
      limit: 'Applies to the phenomenology of anticipation; does not alter physical time.',
      status: 'STATED',
      tags: ['time', 'phenomenology', 'husserl']
    },
    {
      id: 'c_anti_hero',
      name: 'Anti-Hero Test',
      term: 'Anti-Hero Test',
      definition: 'An axiological filter questioning whether a moral conviction or philosophical posture functions primarily to grant the ego identity-salvation or moral prestige.',
      senses: ['Axiological filter', 'Ego-scaffolding diagnostic'],
      thesis: 'Values that survive radical de-centering are those oriented toward honesty and non-cruelty without demanding cosmic reward.',
      limit: 'Must not become inverted pride or cynical suppression of legitimate human joy.',
      status: 'STATED',
      tags: ['axiology', 'ethics', 'praxis']
    },
    {
      id: 'c_heisman_limit',
      name: 'The Heisman Limit',
      term: 'Heisman Limit-Case',
      definition: 'The catastrophic limit-case of unintegrated nihilistic despair (e.g. Mitchell Heisman), demonstrating the peril of ungrounded existential rupture without integration.',
      senses: ['Philosophical limit-case', 'Warning against unintegrated kenosis'],
      thesis: 'Rationalized self-destruction represents a failure of integration rather than the heroic zenith of nihiltheistic insight.',
      limit: 'Requires compassionate, non-exploitative analysis and robust ethical guardrails.',
      status: 'INFERRED',
      tags: ['limit_case', 'ethics', 'integration']
    },
    {
      id: 'c_ereignis',
      name: 'Ereignis',
      term: 'Ereignis',
      definition: 'Heidegger\'s term for the Event of Appropriation wherein Being and human Dasein are mutually brought into their own clearing.',
      senses: ['Historical-ontological event in late Heidegger', 'Contemplative turning point in post-metaphysical thought'],
      thesis: 'Ereignis describes an appropriation to finitude and clearing, not an assertion that Nothingness is a substantial deity.',
      limit: 'Must not be equated with cosmic theism or Eastern monism without rigorous textual qualification.',
      status: 'STATED',
      tags: ['heidegger', 'ontology', 'historical']
    }
  ];

  for (const c of conceptsData) {
    insertConcept.run(
      c.id,
      'proj_journal314_canonical',
      c.name,
      c.term,
      c.definition,
      JSON.stringify(c.senses),
      c.thesis,
      c.limit,
      c.status,
      JSON.stringify(c.tags),
      now,
      now
    );
  }

  // 6. Seed Claims with strict fields and provenance
  const insertClaim = db.prepare(`
    INSERT INTO claims (id, project_id, text, claim_type, fidelity_label, source_attributions, premise_claim_ids, concise_inference_summary, warrant_category, support_status, objection_ids, revision_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const claimsData = [
    {
      id: 'clm_une_structure',
      text: 'The Universal Nihilistic Event is characterized by a structural collapse of protention and objectless dread.',
      type: 'phenomenological_description',
      fidelity: 'STATED',
      attributions: [
        {
          passage_id: 'pas_une_01',
          source_id: 'src_master_synthesis_v1',
          source_name: 'master_synthesis_v1.0.txt',
          quoted_text: 'The Universal Nihilistic Event (UNE) is a proposed structural rupture where ordinary scaffolds of meaning, selfhood, and worldhood collapse, exposing groundlessness.',
          page_number: null,
          reference_integrity: true,
          semantic_support: 'supported',
          review_note: 'Directly stated in Topic 1 of master synthesis.'
        }
      ],
      premises: [],
      inference_summary: null,
      warrant: 'W1',
      support: 'supported',
      objections: ['obj_une_universality'],
      revision_status: 'current'
    },
    {
      id: 'clm_predicate_hygiene',
      text: 'Experiential reports of vastness or nothingness must not be converted into ontological proofs of metaphysical reality without distinct warrant.',
      type: 'methodological_rule',
      fidelity: 'STATED',
      attributions: [
        {
          passage_id: 'pas_constraints_03',
          source_id: 'src_master_synthesis_v1',
          source_name: 'master_synthesis_v1.0.txt',
          quoted_text: 'Predicate Hygiene: The strict discipline of distinguishing between experience-descriptions ("I felt timelessness") and metaphysical claims ("Reality is timeless").',
          page_number: null,
          reference_integrity: true,
          semantic_support: 'supported',
          review_note: 'Foundational methodological directive.'
        }
      ],
      premises: [],
      inference_summary: null,
      warrant: 'W1',
      support: 'supported',
      objections: [],
      revision_status: 'current'
    },
    {
      id: 'clm_transcendent_modality',
      text: 'Nihilism permits a bifurcation into Worldly Nihilism (terminal ruin) and Transcendent Nihilism (apophatic disclosure).',
      type: 'comparative_interpretation',
      fidelity: 'STATED',
      attributions: [
        {
          passage_id: 'pas_modalities_02',
          source_id: 'src_master_synthesis_v1',
          source_name: 'master_synthesis_v1.0.txt',
          quoted_text: 'Nihiltheism distinguishes between the event itself and its two primary interpretive modalities: Worldly Nihilism (interprets the collapse as terminal deficit, futility, and ruin) and Transcendent Nihilism',
          page_number: null,
          reference_integrity: true,
          semantic_support: 'supported',
          review_note: 'Foundational distinction in Topic 2.'
        }
      ],
      premises: [],
      inference_summary: null,
      warrant: 'W3',
      support: 'supported',
      objections: ['obj_transcendence_evasion'],
      revision_status: 'current'
    },
    {
      id: 'clm_w4_commitment',
      text: 'Commitment to honesty and non-cruelty in the wake of meaning-collapse is a practical existential resolution, not an evidential proof of cosmic benevolence.',
      type: 'normative_commitment',
      fidelity: 'INFERRED',
      attributions: [
        {
          passage_id: 'pas_axiology_11',
          source_id: 'src_master_synthesis_v1',
          source_name: 'master_synthesis_v1.0.txt',
          quoted_text: 'Value without ground: Values that survive exposure (honesty, non-cruelty). Anti-Hero Test: Does this value function to grant me identity-salvation or spiritual specialness?',
          page_number: null,
          reference_integrity: true,
          semantic_support: 'supported',
          review_note: 'Derived from axiology and CR-04 / CR-07.'
        }
      ],
      premises: ['clm_predicate_hygiene'],
      inference_summary: 'Because meaninglessness does not entail specific ethics, ethical commitments remain W4 praxis rather than W5 metaphysical deductions.',
      warrant: 'W4',
      support: 'supported',
      objections: ['obj_is_ought'],
      revision_status: 'current'
    },
    {
      id: 'clm_void_is_god_unwarranted',
      text: 'The statement "The Void is God" represents a W5 metaphysical closure that exceeds epistemic entitlement when asserted as a factual identity.',
      type: 'metaphysical_hypothesis',
      fidelity: 'UNCERTAIN',
      attributions: [
        {
          passage_id: 'pas_warrants_08',
          source_id: 'src_master_synthesis_v1',
          source_name: 'master_synthesis_v1.0.txt',
          quoted_text: 'W5: Metaphysical closure ("The Void is definitively God") - strictly prohibited as a settled system fact.',
          page_number: null,
          reference_integrity: true,
          semantic_support: 'supported',
          review_note: 'Classified as an object of analysis, not accepted doctrine.'
        }
      ],
      premises: ['clm_predicate_hygiene'],
      inference_summary: 'Predicate hygiene forbids converting experiential openness into dogmatic theological identity.',
      warrant: 'W5',
      support: 'disputed',
      objections: ['obj_theistic_projection'],
      revision_status: 'current'
    }
  ];

  for (const cl of claimsData) {
    insertClaim.run(
      cl.id,
      'proj_journal314_canonical',
      cl.text,
      cl.type,
      cl.fidelity,
      JSON.stringify(cl.attributions),
      JSON.stringify(cl.premises),
      cl.inference_summary,
      cl.warrant,
      cl.support,
      JSON.stringify(cl.objections),
      cl.revision_status,
      now,
      now
    );
  }

  // 7. Seed Objections
  const insertObjection = db.prepare(`
    INSERT INTO objections (id, project_id, claim_id, title, counter_argument, rival_model, severity, status, reply, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const objectionsData = [
    {
      id: 'obj_une_universality',
      claim_id: 'clm_une_structure',
      title: 'Sociological and Cultural Particularity',
      counter: 'The purported "Universal Nihilistic Event" may be a specific modern Western cultural artifact born of secularization and existential literature, rather than an anthropological invariant.',
      rival: 'Cultural Constructivism / Sociology of Modernity',
      severity: 'serious',
      status: 'addressed',
      reply: 'Nihiltheism adopts CR-01: UNE is treated strictly as an analytical model for investigating structured reports of collapse, not an empirical dogma of universal occurrence.'
    },
    {
      id: 'obj_transcendence_evasion',
      claim_id: 'clm_transcendent_modality',
      title: 'Psychological Comfort Evasion (Anti-Evasion Test)',
      counter: 'Re-framing radical nihilistic meaninglessness as a "negative sacrament" or "sacred plenum" is an evasion technique designed to smuggle comforting religious hope into pure emptiness.',
      rival: 'Reductive Materialist Naturalism',
      severity: 'fatal',
      status: 'retained_disagreement',
      reply: 'Nihiltheism acknowledges this danger under CR-05 and Paradox Delta. Transcendent Nihilism is maintained only as an open apophatic hypothesis, never as a guaranteed consolation.'
    },
    {
      id: 'obj_is_ought',
      claim_id: 'clm_w4_commitment',
      title: 'Naturalistic Fallacy / Is-Ought Separation',
      counter: 'If the cosmos is devoid of objective purpose, no normative mandate towards non-cruelty or honesty can be logically derived from it.',
      rival: 'Moral Nihilism / Emotivism',
      severity: 'serious',
      status: 'addressed',
      reply: 'Accepted per CR-07: ethical commitments are explicitly acknowledged as W4 existential practical choices based on shared mortal vulnerability, not metaphysical entailments.'
    },
    {
      id: 'obj_theistic_projection',
      claim_id: 'clm_void_is_god_unwarranted',
      title: 'Theological Smuggling into the Void',
      counter: 'Calling the Void "Divine" or "God" merely rehabilitates traditional theistic vocabulary to placate religious nostalgia.',
      rival: 'Strict Apophatic Skepticism / Atheology',
      severity: 'fatal',
      status: 'addressed',
      reply: 'Under CR-04 and Predicate Hygiene, W5 closure is strictly banned. The system treats the term "Divine" only as a historical symbol for the limit-horizon of inquiry.'
    }
  ];

  for (const o of objectionsData) {
    insertObjection.run(
      o.id,
      'proj_journal314_canonical',
      o.claim_id,
      o.title,
      o.counter,
      o.rival,
      o.severity,
      o.status,
      o.reply,
      now
    );
  }

  // 8. Seed Relations
  const insertRelation = db.prepare(`
    INSERT INTO relations (id, project_id, source_entity_id, source_entity_type, relation_type, target_entity_id, target_entity_type, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const relationsData = [
    {
      id: 'rel_01',
      src_id: 'c_predicate_hygiene',
      src_type: 'concept',
      type: 'qualifies',
      tgt_id: 'c_transcendent_nihilism',
      tgt_type: 'concept',
      notes: 'Predicate hygiene disciplines transcendent nihilism to prevent theological closure.'
    },
    {
      id: 'rel_02',
      src_id: 'c_protention',
      src_type: 'concept',
      type: 'depends_on',
      tgt_id: 'c_une',
      tgt_type: 'concept',
      notes: 'The breakdown of protention is the temporal indicator of UNE.'
    },
    {
      id: 'rel_03',
      src_id: 'c_anti_hero',
      src_type: 'concept',
      type: 'qualifies',
      tgt_id: 'clm_w4_commitment',
      tgt_type: 'claim',
      notes: 'Anti-hero test purifies practical commitments from spiritual self-aggrandizement.'
    },
    {
      id: 'rel_04',
      src_id: 'c_heisman_limit',
      src_type: 'concept',
      type: 'objects_to',
      tgt_id: 'c_une',
      tgt_type: 'concept',
      notes: 'Demonstrates the catastrophic failure mode of unintegrated collapse.'
    },
    {
      id: 'rel_05',
      src_id: 'c_ereignis',
      src_type: 'concept',
      type: 'analogous_to',
      tgt_id: 'c_transcendent_nihilism',
      tgt_type: 'concept',
      notes: 'Heideggerian Ereignis shares apophatic clearing structure, though not identical substance.'
    }
  ];

  for (const r of relationsData) {
    insertRelation.run(
      r.id,
      'proj_journal314_canonical',
      r.src_id,
      r.src_type,
      r.type,
      r.tgt_id,
      r.tgt_type,
      r.notes,
      now
    );
  }

  // 9. Seed Contradictions
  const insertContradiction = db.prepare(`
    INSERT INTO contradictions (id, project_id, claim_a_id, claim_b_id, relevant_senses, conflict_type, proposed_resolution, remaining_disagreement, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertContradiction.run(
    'cntr_01',
    'proj_journal314_canonical',
    'clm_transcendent_modality',
    'clm_void_is_god_unwarranted',
    'Transcendent disclosure of the Void versus the Prohibition against identifying the Void as God.',
    'apparent',
    'Resolved via Predicate Hygiene: Transcendent Nihilism is an open phenomenological posture (W3), whereas "The Void is God" is a dogmatic ontological equation (W5).',
    'Tension remains between personal religious vocabulary and strict apophatic agnosticism.',
    'resolved',
    now,
    now
  );

  insertContradiction.run(
    'cntr_02',
    'proj_journal314_canonical',
    'clm_une_structure',
    'clm_w4_commitment',
    'Total meaning-collapse versus the generation of resolute ethical commitments.',
    'normative',
    'Resolved via CR-07: Axiological autopoiesis. Values are not found in the cosmos but enacted by mortal agents in shared vulnerability.',
    'Whether such values are merely subjective conventions or structurally warranted practices remains open.',
    'accepted_tension',
    now,
    now
  );

  // 10. Seed Manuscript: 17 Required Chapters
  seedManuscriptSections(db, now);
  seedHypermapIfEmpty(db);
}

function seedManuscriptSections(db: DatabaseSync, now: string): void {
  const insertSection = db.prepare(`
    INSERT INTO manuscript_sections (id, chapter_number, title, slug, word_count, definitions_scope, developed_argument, counterargument, reply_or_revision, epistemic_status, cross_references, open_questions, full_text, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const ch of MANUSCRIPT_CHAPTERS) {
    const wordCount = ch.text.split(/\s+/).filter(Boolean).length;
    insertSection.run(
      `sec_${ch.num}`,
      ch.num,
      ch.title,
      ch.slug,
      wordCount,
      ch.definitions,
      ch.argument,
      ch.counter,
      ch.reply,
      ch.epistemic,
      JSON.stringify(ch.refs),
      JSON.stringify(ch.questions),
      ch.text,
      now
    );
  }
}
