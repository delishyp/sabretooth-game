/**
 * Which picture an encounter foe gets.
 * A cat is that cat, composed from its genes. An animal uses its own file.
 * A species with no file on disk is text only, never another animal.
 * UMD.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EncounterArt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const FILES = {
    deer: 'encounters/giant-deer.png',
    giant_deer: 'encounters/giant-deer.png',
    wolf: 'encounters/old-pack-enemy.png',
    wolves: 'encounters/old-pack-enemy.png',
    wolf_pack: 'encounters/old-pack-enemy.png',
    hyena: 'encounters/cave-hyena.png',
    hyenas: 'encounters/cave-hyena.png',
    cave_hyena: 'encounters/cave-hyena.png',
    hyena_clan: 'encounters/cave-hyena.png'
  };
  const ENCOUNTER_SPECIES = {
    'encounter.giant_deer.v1': 'deer',
    'encounter.wolf_pack.v1': 'wolves',
    'encounter.cave_hyena.v1': 'hyena',
    'encounter.human.v1': 'human'
  };
  /** Named in the encounter index, but the PNG is not in assets/encounters. */
  const MISSING_FILES = {
    'human-enemy.png': 'human',
    'wolf-pup.png': 'wolf_pup',
    'woolly-mammoth.png': 'mammoth',
    'mammoth-calf.png': 'mammoth_calf',
    'antlerless-deer.png': 'antlerless_deer',
    'american-lion.png': 'lion',
    'maneless-lion.png': 'lion'
  };
  const GAPS = [
    'bear', 'lion', 'american_lion', 'human', 'humans',
    'mammoth', 'woolly_mammoth', 'mammoth_calf', 'wolf_pup', 'antlerless_deer',
    'horse', 'camel', 'bison', 'hare', 'goose', 'marmot',
    'rhino', 'scimitar', 'prey'
  ];
  const LABELS = {
    bear: 'The bear', lion: 'The lion', american_lion: 'The lion',
    human: 'The human', humans: 'The human',
    mammoth: 'The mammoth', woolly_mammoth: 'The mammoth', mammoth_calf: 'The mammoth calf',
    wolf_pup: 'The wolf pup', antlerless_deer: 'The deer',
    horse: 'The horse', camel: 'The camel', bison: 'The bison',
    hare: 'The hare', goose: 'The goose', marmot: 'The marmot',
    rhino: 'The rhinoceros', scimitar: 'The scimitar cat', prey: 'The prey',
    wolf: 'The wolf', wolves: 'The wolf', wolf_pack: 'The wolf',
    hyena: 'The hyena', hyenas: 'The hyena', cave_hyena: 'The hyena', hyena_clan: 'The hyena',
    deer: 'The giant deer', giant_deer: 'The giant deer'
  };
  const SKIP_KIND = { fight: true, spar: true, hunt: true, courtship: true, court: true };

  function norm(value) {
    return String(value || '').toLowerCase().replace(/[\s-]+/g, '_');
  }
  function fileName(row) {
    const raw = row && (row.asset || row.assetId || row.art) || '';
    const name = String(raw).split('/').pop();
    return name || '';
  }
  function speciesOf(row) {
    const input = row || {};
    const explicit = input.species || input.foeKind || input.prey;
    if (explicit) return norm(explicit);
    if (input.encounterId && ENCOUNTER_SPECIES[input.encounterId]) return ENCOUNTER_SPECIES[input.encounterId];
    const kind = norm(input.kind);
    if (kind && !SKIP_KIND[kind] && (FILES[kind] || GAPS.indexOf(kind) >= 0 || LABELS[kind])) return kind;
    const name = fileName(input);
    if (MISSING_FILES[name]) return MISSING_FILES[name];
    const file = name ? 'encounters/' + name : '';
    const owner = Object.keys(FILES).find((key) => FILES[key] === file);
    if (owner) return owner;
    return '';
  }
  function catOf(row) {
    const cat = row && row.cat;
    if (cat && (cat.catId || cat.id || cat.name || cat.portraitId)) return cat;
    if (row && (row.catId || row.foeId)) {
      return { id: row.catId || row.foeId, name: row.foeName || row.catName || null, portraitId: row.portraitId || null };
    }
    return null;
  }
  function animalKey(key) {
    return !!(key && key !== 'cat' && (FILES[key] || GAPS.indexOf(key) >= 0));
  }
  function textFor(key) {
    return {
      kind: key || 'unknown',
      art: null,
      portrait: false,
      cat: null,
      fallback: LABELS[key] || 'Something is here.',
      label: LABELS[key] || 'Something is here.',
      gap: true
    };
  }
  function resolve(row) {
    const input = row || {};
    const cat = catOf(input);
    const key = speciesOf(input);
    const catKind = input.kind === 'spar' || input.kind === 'courtship' || input.kind === 'court' || input.kind === 'fight' || key === 'cat';
    const askedCat = catKind && !animalKey(key);
    if (cat || askedCat) {
      if (!cat) return { kind: 'cat', art: null, portrait: false, cat: null, fallback: 'A cat', label: 'A cat', gap: true };
      return {
        kind: 'cat',
        art: null,
        portrait: true,
        cat: cat,
        catId: cat.catId || cat.id || null,
        fallback: null,
        label: cat.name || 'A cat',
        gap: false
      };
    }
    if (!key && input.kind === 'hunt') return textFor('prey');
    if (FILES[key]) {
      return { kind: key, art: FILES[key], portrait: false, cat: null, fallback: null, label: LABELS[key] || key, gap: false };
    }
    if (!key) return textFor('unknown');
    return textFor(key);
  }
  return { FILES, GAPS, LABELS, MISSING_FILES, ENCOUNTER_SPECIES, resolve };
});