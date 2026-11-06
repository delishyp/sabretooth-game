/**
 * Seeded RNG (pure, UMD). mulberry32 over a 32-bit seed; `stream(seed, ...names)` forks a named sub-stream (world-gen §1.3 style),
 * so a roll depends only on (seed, names) and replays identically after save/load without storing generator state.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Rng = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function hash(str) {                      // FNV-1a 32-bit
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const stream = (seed, ...names) => mulberry32(hash(`${seed >>> 0}|${names.join('|')}`));
  /** true with probability pct/100. */
  const chance = (rng, pct) => rng() * 100 < pct;
  const pick = (rng, list) => list[Math.floor(rng() * list.length)];
  const newSeed = () => (Math.floor(Math.random() * 4294967296)) >>> 0;
  return { hash, mulberry32, stream, chance, pick, newSeed };
});
