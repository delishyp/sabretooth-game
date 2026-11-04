# Sabretooth: Genetics & Inheritance Spec (v0.1, DRAFT)
Owner: Tundra (rules and numbers). Art, layer files and final tints: Ochre. Code: Flint. Player-facing names for traits: Saga (ids below are internal only).
Not in the build yet. All numbers are starting values to tune. Probabilities checked in Python (scipy + 2M-sample Monte Carlo).
Related: main-menu-spec v1.3 §1, §5 (`mainCat.genes`), §7 (Free Customization); play-styles-spec v0.2 §3.3 (Sim inbreeding); loners-spec v0.4.

## 0. Ground rules
0.1 **Lineart is fixed. Genes change colour/tint only, never shape.** Every gene layer is a grayscale mask, tinted to `geneColor × shading` and drawn with a **normal** blend in Ochre's stack order, with the fixed lineart always on top, per Ochre's `docs/art/portrait-layers.md` (see §2.3).
0.2 Layer names match Ochre's contract: `base_coat`, `markings`, `eyes`, `sabers`, `scars`, `age`. Files live at `assets/portraits/<pose>/<layer>.png`; Ochre's contract wins on paths, stack order and manifest field names.
0.3 **Out of scope for v0.1:** saber length/shape, snapped sabers, ear/tail/body shape and size variants, since each one would need its own lineart.
0.4 No sex-linked genes in v0.1. Sex is 50/50 at birth.

## 1. Loci
Dominance: **C** = complete (series listed dominant → recessive), **D** = incomplete/dosage (blends, 0/1/2 copies), **Co** = codominant (both show). Frequencies are allele frequencies in the starting population. Phenotype % is the expected Hardy-Weinberg share.

| # | Locus (`id`) | Alleles (freq) | Dominance | Blends? | Phenotypes (expected %) |
|---|---|---|---|---|---|
| 1.1 | Base coat (`coat`) | `tawny` .30, `russet` .12, `sandy` .25, `greydun` .25, `melan` .04, `leuc` .04 | C: tawny > russet > sandy > greydun > melan, leuc. `melan`/`leuc` together are Co → **ash** | Discrete | tawny 51.0, sandy 22.8, russet 15.4, grey-dun 10.3, ash 0.32, melanistic 0.16, leucistic 0.16 |
| 1.2 | Dilution (`dilute`) | `D` .75, `d` .25 | D (counts `d`) | Blends | full 56.3, light (1×d) 37.5, dilute (2×d) 6.3 |
| 1.3 | Marking type (`marking`) | `spotted` .25, `rosette` .10, `faintstripe` .20, `plain` .45 | C: spotted > rosette > faintstripe > plain | Discrete | spotted 43.8, faint stripe 22.0, plain 20.3, rosette 14.0 |
| 1.4 | Dorsal stripe (`dorsal`) | `Ds` .012, `ds` .988 | C: Ds dominant | Discrete | dorsal stripe 2.4 (stacks on any marking type) |
| 1.5 | Marking intensity (`intensity`) | `I+` .50, `I-` .50 | D (counts `I+`) | Blends | faint 25, medium 50, bold 25 |
| 1.6 | White pattern (`white`) | `piebald` .015, `socks` .15, `blaze` .10, `none` .735 | C: piebald > socks, blaze > none; socks/blaze Co | Discrete | none 54.0, socks 24.3, blaze 15.7, socks+blaze 3.0, piebald 3.0 |
| 1.7 | Eye colour (`eyes`) | `amber` .40, `gold` .25, `copper` .10, `green` .17, `blue` .08 | C: amber > gold > copper > green > blue | Discrete | amber 64.0, gold 23.8, copper 6.0, green 5.6, blue 0.64 |
| 1.8 | Heterochromia (`hetero` flag) | not an allele: spontaneous mutation only | n/a | Discrete | 0 in start pool; 0.3% per cub |
| 1.9 | Saber tint (`saber`) | `ivory` .70, `creamy` .22, `stained` .08 | C: ivory > creamy > stained | Discrete | ivory 91.0, cream-yellow 8.4, dark/stained 0.64 |

1.10 Dorsal stripe is its own locus (not in the marking series) so it can stack, e.g. plain + dorsal stripe. This matches loner lore ("dark ticked stripes along her back").
1.11 **Starting population.** The 39 premade cats get **authored visible phenotypes** (from Saga's sheets) stored as fixed genotypes. Their *hidden* recessive alleles are rolled per run from the frequencies above, conditioned on the phenotype, so carriers differ between runs. New random cats (spawned loners, a non-customized player cat) roll every locus from the frequencies. The default menu cat (`data/menuDefaultCat.json`) is a fixed genome that Ochre picks, from common traits only.

## 2. Gene → layer mapping (tints are placeholders for Ochre to tune)
| Layer | Chosen by | File | Tint (hex) / intensity |
|---|---|---|---|
| `base_coat` | coat phenotype | `base_coat.png` (one mask) | tawny `#C8955A`, sandy `#D9BC8A`, russet `#B0623A`, grey-dun `#A39A88`, ash `#7D776F`, melanistic `#3A332E`, leucistic `#EFE6D6` |
| `base_coat` (dilution) | `dilute` count | same layer | tint = mix(coat, `#F3EBDD`, t), with t = 0 / 0.15 / 0.35 for 0/1/2 × `d` |
| `markings` | marking phenotype | `markings_spotted.png`, `markings_rosette.png`, `markings_faintstripe.png`; plain = no layer | tint = final coat tint × 0.55 (darker). Melanistic: `#1E1A17` (ghost markings). Leucistic: `#D2C3A8` |
| `markings` (dorsal) | `Ds` present | `markings_dorsal.png` | same tint rule as markings |
| `markings` (intensity) | `intensity` count | opacity on all marking layers | 0.35 / 0.60 / 0.85 for 0/1/2 × `I+` |
| `white` (sub-layer of base coat group) | white phenotype | `white_socks.png`, `white_blaze.png` (both for socks+blaze), `white_piebald.png` | `#F7F4EE`, opacity 1.0; see 2.3 |
| `eyes` | eye phenotype | `eye_left.png`, `eye_right.png` | amber `#C98A1E`, gold `#D9B43A`, copper `#B5652A`, green `#8FA34A`, blue `#8EB6D1`. Heterochromia: left = phenotype colour, right = blue (if phenotype is blue, right = amber) |
| `sabers` | saber phenotype | `sabers.png` (one mask, fixed shape) | ivory `#EFE7D2`, cream-yellow `#E3CF96`, dark/stained `#8C7A5A`. Elder: mix 15% toward `#8C7A5A` |
| `scars` | not genetic (injury list) | per Ochre's scar set | `#8E6F66` placeholder |
| `age` | life stage (elder only) | `age_elder.png` (muzzle/brow greying) | `#C9C4BC`, opacity 0.5; see 2.3 |

2.1 **Stack order** (bottom → top), unless Ochre's contract says otherwise: base_coat → white → markings → markings_dorsal → eyes → sabers → scars → age → lineart.
2.2 Every pose (male/female portrait, male/female lying) needs the same set of masks on the same canvas and anchor, so one resolver output works for every pose.
2.3 **Blending (settled by Ochre and Flint, 2026-11-04):** each gene layer is a PNG. Its alpha is the mask and its grayscale is the shading. The layer is tinted to `geneColor × shading` and drawn with a `normal` blend. Only `shadow` uses `multiply`, and any rim light uses `screen`. Every manifest layer has a `blend` field that defaults to `normal`. Stack, bottom to top: shadow, base_coat, markings, white, eyes, sabers, scars, age_elder (opacity set by the gene), lineart. Dilution only changes the tint colour. There's no erase step, so white patches and elder greying draw on top of any coat.
2.4 **Lore mapping notes for Saga:** "smoke-grey rosettes" on a black coat would be lighter than the coat, so they can't be drawn; use "ghost rosettes, darker than the coat". "Snapped left saber" is shape, so it's out of scope (or becomes a scar-layer chip if Ochre wants that). "Blue-grey" = grey-dun + dilute. "Brindle"/"bark-mottled" map to faint stripe/spotted plus a bold intensity.

## 3. Inheritance
3.1 **Mendelian:** for each locus, each parent passes one of its two alleles at random (50/50). Loci are independent (no linkage in v0.1).
3.2 **Mutation:** per locus per cub, a **0.5%** chance that one inherited allele (random parent's copy) is replaced by a different allele of that locus, picked uniformly. This is how rare alleles reappear after being lost.
3.3 **Heterochromia:** **0.3%** per cub, spontaneous, not inherited (cubs of a heterochromatic cat roll normally).
3.4 **Rare mutations list:** heterochromia (only through mutation), plus any rare-tier allele gained through 3.2.
3.5 **Rarity tiers** (by expected phenotype share: common ≥ 10%, uncommon 3-10%, rare < 3%, mutation = never in the start pool):

| Tier | Traits |
|---|---|
| Common | tawny, sandy, russet, grey-dun; full and light dilution; spotted, rosette, faint stripe, plain; all intensities; no white, socks, blaze; amber, gold; ivory sabers |
| Uncommon | dilute (2×d); socks+blaze; copper, green eyes; cream-yellow sabers |
| Rare | melanistic, leucistic, ash; dorsal stripe; piebald; blue eyes; dark/stained sabers |
| Mutation | heterochromia |

3.6 **Free Customization** (main-menu-spec §7, player cat at creation only): **Off** = common tier only, with personality sliders at 20-80. **On** = every tier including mutation, with sliders at 0-100. Uncommon and rarer traits still reach every run through breeding and premade cats. Creation writes a genotype consistent with the picked phenotype; any hidden recessives are rolled per 1.11.

## 4. Personality inheritance (Anna's rule)
4.1 There are five traits, each 0-100, stored as integers.

| Trait | Affects |
|---|---|
| `aggression` | Fight start and damage, rival status (≥ 70, loners §5), loner affinity −10 at ≥ 70 |
| `sociability` | Starting affinity +10 at ≥ 70, recruit chance (loners §3.2), bond formation speed |
| `boldness` | Stand-vs-flee against threats, willingness to hunt big prey, scouting new zones |
| `loyalty` | Disposition. Sets the starting `prideLoyalty` and resists departure and lure (loners §6.4) |
| `curiosity` | Exploration and discovery events, hazard exposure, cub wandering risk |

4.2 **Cub value** = round_half_up(clamp((parentA + parentB) / 2 + Normal(0, sd 8), 0, 100)), rolled per trait independently.
4.3 **Worked example:** parents at aggression 89 and 50 average to 69.5, so the cub is likely aggressive. With the integer store, P(cub ≥ 60) = **89.4%**, P(cub ≥ 70) = **50.0%**, and P(cub < 50) = 0.6%. (Before rounding, the continuous values would be 88.2% and 47.5%. The integer figures are the true ones, because "≥ 70 stored" means raw ≥ 69.5.)
4.4 Random new cats roll each trait from Normal(50, 15), clamped 5-95. Premade cats use Saga's authored values.
4.5 **Cross-spec note:** loners-spec §3.4/§6.4's "loyalty 50/70" is the *state* toward the current pride. Proposal: rename it `prideLoyalty`, starting at 70 (born) or 50 (recruited) + (loyalty − 50) × 0.2. Adopted in loners-spec v0.6 (Director OK, 2026-11-04).

## 5. Relatedness and inbreeding
5.1 **Kinship** f(A,B), computed recursively over the pedigree with memoization:
   - f(A,A) = ½ (1 + F_A);
   - otherwise, let B be the younger cat (not an ancestor of A): f(A,B) = ½ [f(A, sire_B) + f(A, dam_B)];
   - unknown parent → 0. Pedigree depth cap is 6 generations. Premade cats are unrelated unless Saga's sheets give parents.
5.2 **Relatedness** r(A,B) = 2 f(A,B). A cub's inbreeding coefficient F = f(sire, dam).
   Reference values: parent/offspring and full sibs r = 0.50, half sibs and grandparent r = 0.25, first cousins r = 0.125.
5.3 **Sim penalty** (play-styles §3.3), applied when r(parents) ≥ 0.25: cub mortality × (1 + 2r), so ×1.5 for half sibs and ×2.0 for full sibs. The cub also gets a `frail` flag with chance r × 40% (10% / 20%): −10 max health and injury heal time ×1.2.
5.4 Story and Standard have no mechanical penalty. `r` is passed to the storyteller as a hint in every Style.
5.5 Hook: `breeding.inbreedingPenalty(r, style) → {mortalityMult, frailChance}`, which returns {1, 0} outside Sim.

## 6. Data schemas
```json
Genotype (Cat.genes; also main-menu-spec mainCat.genes):
{ "v": 1,
  "loci": { "coat": ["tawny","melan"], "dilute": ["D","d"], "marking": ["spotted","plain"],
            "dorsal": ["ds","ds"], "intensity": ["I+","I-"], "white": ["socks","none"],
            "eyes": ["amber","blue"], "saber": ["ivory","stained"] },
  "hetero": false,
  "mutations": [ { "locus": "eyes", "from": "gold", "to": "blue", "gen": 3 } ],
  "personality": { "aggression": 70, "sociability": 55, "boldness": 62, "loyalty": 48, "curiosity": 81 },
  "sireId": "cat_0123", "damId": "cat_0456" }
```
```json
Phenotype resolver output (resolve(genes, sex, lifeStage, scars[], pose)), shaped like Ochre's manifest:
{ "pose": "female_lying",
  "traits": { "coat": "tawny", "dilute": 1, "marking": "spotted", "dorsal": false, "intensity": 1,
              "white": ["socks"], "eyes": ["amber","amber"], "saber": "ivory" },
  "rarity": "common",
  "layers": [
    { "id": "base_coat",          "file": "assets/portraits/female_lying/base_coat.png",       "blend": "normal",          "tint": "#CEA26E", "opacity": 1.0 },
    { "id": "markings_spotted",   "file": "assets/portraits/female_lying/markings_spotted.png","blend": "normal",          "tint": "#71593D", "opacity": 0.60 },
    { "id": "white_socks",        "file": "assets/portraits/female_lying/white_socks.png",     "blend": "normal",          "tint": "#F7F4EE", "opacity": 1.0 },
    { "id": "eye_left",           "file": "assets/portraits/female_lying/eye_left.png",        "blend": "normal",          "tint": "#C98A1E", "opacity": 1.0 },
    { "id": "eye_right",          "file": "assets/portraits/female_lying/eye_right.png",       "blend": "normal",          "tint": "#C98A1E", "opacity": 1.0 },
    { "id": "sabers",             "file": "assets/portraits/female_lying/sabers.png",          "blend": "normal",          "tint": "#EFE7D2", "opacity": 1.0 } ] }
```
6.1 `rarity` = the highest tier among the visible traits. Layer order in `layers` is the draw order (lineart is drawn last by the compositor and isn't listed). Field names follow Ochre's `manifest.json` once it's final.
6.2 Tints and allele frequencies are data in `data/genetics.json`, not code.

## 7. Tunables (`data/genetics.json`)
| Key | Default |
|---|---|
| alleleFreq.* | §1 table |
| mutation.perLocusPerCub | 0.5% |
| mutation.heterochromia | 0.3% |
| dilute.mixT (1×d / 2×d) / target | 0.15 / 0.35 / `#F3EBDD` |
| markings.darken / intensity.opacity | ×0.55 / 0.35, 0.60, 0.85 |
| rarity.common / uncommon threshold | ≥ 10% / ≥ 3% |
| personality.cubSd / clamp | 8 / 0-100 |
| personality.randomMean / sd / clamp | 50 / 15 / 5-95 |
| freeCustom.offSlider | 20-80 |
| pedigree.maxDepth | 6 |
| sim.inbreeding r threshold / mortality k / frail k | 0.25 / 2 / 0.40 |
| frail.maxHealth / healMult | −10 / ×1.2 |
| elder.saberStain | 15% |

## 8. Open questions for Anna (via Director)
8.1 With Free Customization Off, should the player cat be limited to **common** traits only (my reading of menu §7), or should uncommon traits be allowed too?
8.2 Should heterochromia stay purely spontaneous (0.3%, never inherited), or should it be inheritable so a player can breed for it?
8.3 Is a rare **ash** coat (melanistic × leucistic carrier cross) wanted as a fun hidden breeding goal, or should we keep strictly the 6 listed coats?
