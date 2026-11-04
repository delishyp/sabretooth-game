# Sabretooth: Genetics & Inheritance Spec (v0.4.4, DRAFT)
Owner: Tundra (rules and numbers). Art, layer files and final tints: Ochre. Code: Flint. Player-facing names for traits: Saga (ids below are internal only).
Not in the build yet. All numbers are starting values to tune. Probabilities checked in Python (scipy + 2M-sample Monte Carlo).
Related: main-menu-spec v1.3 §1, §5 (`mainCat.genes`), §7 (Free Customization); play-styles-spec v0.2 §3.3 (Sim inbreeding); loners-spec v0.4.

## 0. Ground rules
0.1 **Lineart is fixed. Genes change colour/tint only, never shape.** Every gene layer is a grayscale mask, tinted to `geneColor × shading` and drawn with a **normal** blend in Ochre's stack order, with the fixed lineart always on top, per Ochre's `docs/art/portrait-layers.md` (see §2.3).
0.2 Layer names match Ochre's contract: `base_coat`, `markings`, `eyes`, `sabers`, `scars`, `age`. Files live at `assets/portraits/<pose>/<layer>.png`; Ochre's contract wins on paths, stack order and manifest field names.
0.3 **Out of scope for v0.1:** saber length/shape, snapped sabers, ear/tail/body shape and size variants, since each one would need its own lineart.
0.4 No sex-linked genes in v0.1. Sex is 50/50 at birth.
0.5 **Life stages** are Cub, Adolescent, Adult and Elder (set by Anna, 2026-11-04). Ages and rules are in `lifecycle-spec.md`. Genes don't change with age; only the age layer and the elder saber stain do. Cubs inherit at birth per §3.

## 1. Loci
Dominance: **C** = complete (series listed dominant → recessive), **D** = incomplete/dosage (blends, 0/1/2 copies), **Co** = codominant (both show). Frequencies are allele frequencies in the starting population. Phenotype % is the expected Hardy-Weinberg share.

| # | Locus (`id`) | Alleles (freq) | Dominance | Blends? | Phenotypes (expected %) |
|---|---|---|---|---|---|
| 1.1 | Base coat (`coat`) | `tawny` .30, `russet` .12, `sandy` .25, `greydun` .25, `melan` .04, `leuc` .04 | C: tawny > russet > sandy > greydun > melan, leuc. `melan`/`leuc` together are Co → **ash** | Discrete | tawny 51.0, sandy 22.8, russet 15.4, grey-dun 10.3, ash 0.32, melanistic 0.16, leucistic 0.16 |
| 1.2 | Dilution (`dilute`) | `D` .75, `d` .25 | D (counts `d`) | Blends | full 56.3, light (1×d) 37.5, dilute (2×d) 6.3 |
| 1.3 | Body pattern (`marking`) | `spotted` .25, `rosette` .10, `barred` .08, `faintstripe` .17, `plain` .40 | C: spotted > rosette > barred > faintstripe > plain | Discrete | spotted 43.8, faint stripe 16.5, plain 16.0, rosette 14.0, barred 9.8 (v0.4 retune) |
| 1.4 | Dorsal stripe (`dorsal`) | `Ds` .012, `ds` .988 | C: Ds dominant | Discrete | dorsal stripe 2.4 (stacks on any marking type) |
| 1.5 | Marking intensity (`intensity`) | `I+` .50, `I-` .50 | D (counts `I+`) | Blends | faint 25, medium 50, bold 25 |
| 1.6 | White pattern (`white`) | `piebald` .015, `socks` .15, `blaze` .10, `none` .735 | C: piebald > socks, blaze > none; socks/blaze Co | Discrete | none 54.0, socks 24.3, blaze 15.7, socks+blaze 3.0, piebald 3.0 |
| 1.7 | Eye colour (`eyes`) | `amber` .40, `gold` .25, `copper` .10, `green` .17, `blue` .08 | C: amber > gold > copper > green > blue | Discrete | amber 64.0, gold 23.8, copper 6.0, green 5.6, blue 0.64 |
| 1.8 | Heterochromia (`het`) | `Het` .88, `het` .12 | C: Het (normal) > het; odd eyes only when het/het | Discrete | odd eyes 1.44, carrier 21.1 (v0.3, Anna: rare and inheritable; see 2.5) |
| 1.9 | Saber tint (`saber`) | `ivory` .70, `creamy` .22, `stained` .08 | C: ivory > creamy > stained | Discrete | ivory 91.0, cream-yellow 8.4, dark/stained 0.64 |
| 1.12 | Undercoat colour (`under`) | `cream` .35, `pale` .25, `off` .40 | C: cream > pale > off | Discrete | cream 57.7, pale 26.2, off (no layer) 16.0 |
| 1.13 | Undercoat intensity (`underInt`) | `U+` .50, `U-` .50 | D (counts `U+`) | Blends | opacity 0.35 / 0.60 / 0.85 = 25 / 50 / 25 (Director, v0.4.3) |
| 1.14 | Ticking (`tick`) | `Tk` .10, `tk` .90 | C: Tk dominant | Discrete | ticked 19.0 |
| 1.15 | Points (`points`) | `Pt` .70, `pt` .30 | C: Pt (none) > pt; shows when pt/pt | Discrete | points 9.0 (uncommon, Director 2026-11-05) |
| 1.16 | Facial mask (`mask`) | `Mk` .08, `mk` .92 | C: Mk dominant | Discrete | mask 15.4 |
| 1.17 | Tear lines (`tear`) | `Tl` .85, `tl` .15 | C: Tl (none) > tl; shows when tl/tl | Discrete | tear lines 2.25 |

1.10 **One body pattern, stacking overlays (v0.4).** A cat shows at most **one** body pattern (the `marking` locus), because patterns turn to mud when stacked. **Overlays** are each their own locus and stack freely with each other and with any body pattern: `dorsal`, `tick`, `points`, `mask`, `tear`. Dorsal matches loner lore ("dark ticked stripes along her back"). There are no tail rings, because the bobtail is too short to read (Ochre).
1.10a **Intensity:** `intensity` (1.5) sets the opacity of the body pattern **and every overlay**. Ticking draws at 0.6 × that opacity, because it's fine grain. The undercoat uses its own `underInt` (1.13).
1.10b **Masks and feasibility** are in Ochre's `docs/art/markings-proposal.md` (approved record: `markings-genes-proposal.md`).
1.11 **Starting population.** The 39 world (premade) cats' looks are **rolled every run from the world seed** (world-gen-spec v0.3+ §4): founders from these frequencies (with pride bias), and kin bred from their parents. Nothing is authored. New random cats (spawned loners, a non-customized player cat) roll every locus from the frequencies. The default menu cat (`data/menuDefaultCat.json`) is a fixed genome that Ochre picks, from common traits only.

## 2. Gene → layer mapping (tints are placeholders for Ochre to tune)
| Layer | Chosen by | File | Tint (hex) / intensity |
|---|---|---|---|
| `base_coat` | coat phenotype | `base_coat.png` (one mask) | tawny `#C8955A`, sandy `#D9BC8A`, russet `#B0623A`, grey-dun `#A39A88`, ash `#8A95A3`, melanistic `#141416`, leucistic `#EDE6DA` (Ochre coat-palette v1, `docs/art/coat-palette.md`) |
| `base_coat` (dilution) | `dilute` count | same layer | tint = mix(coat, `#F3EBDD`, t), with t = 0 / 0.15 / 0.35 for 0/1/2 × `d` |
| `undercoat` | `under` phenotype | `undercoat.png` (belly, chest, throat, inner legs, muzzle/chin; soft edge) | Per-coat undercoat hex (Ochre palette v1): tawny `#E6CFA6`, greydun `#CDC5B5`, russet `#DDB08C`, sandy `#EEDFC4`, melanistic `#1A1A1D`, leucistic `#F6F2EB`, ash `#BAC3CD`. **cream** = that hex; **pale** = mix(that hex, coat, 0.5) (subtler belly); **off** = no layer. Opacity comes from `underInt` (0.35 / 0.60 / 0.85) for bred and world cats. The creator fixes it at 0.85 (Director), the value Ochre tuned the palette at. Dilution mixes the undercoat toward `#F3EBDD` with the same t as the coat.. Opacity from `underInt`: 0.35 / 0.60 / 0.85 |
| `markings` | body-pattern phenotype | `markings_spotted.png`, `markings_rosette.png`, `markings_barred.png`, `markings_faintstripe.png`; plain = no layer | tint = final coat tint × 0.55 (darker), except ghost markings: melanistic `#24211F` (slightly warm and matte, showing in raking light), leucistic `#D8CCBA` (Ochre palette v1). Melanistic: `#1E1A17` (ghost markings, rim-lit). Leucistic: `#D2C3A8` (nearly invisible by design) |
| `ticking` / `points` / `mask` / `tearlines` | overlay present | `ticking.png`, `points.png`, `mask.png`, `tearlines.png` | marking tint rule; opacity from `intensity` (ticking × 0.6) |
| `markings` (dorsal) | `Ds` present | `markings_dorsal.png` | same tint rule as markings |
| `markings` (intensity) | `intensity` count | opacity on all marking layers | 0.35 / 0.60 / 0.85 for 0/1/2 × `I+` |
| `nose` | coat phenotype | `nose.png` | tawny, greydun and sandy `#4A3C38`, russet `#5A3A30`, melanistic `#19191B`, leucistic `#B89A9C` (pink-grey), ash `#4E5158` |
| `claws` | fixed | `claws.png` | `#D6CCB8` |
| `rim`, `sheen` (blend screen) | coat phenotype | `rim.png`, `sheen.png` | melanistic: rim `#4A5868` at 1.0 + sheen `#38424E` at 0.9; ash: sheen `#DCE3EA` at 0.25; every other coat: no layer. The full stack order and contract are in Ochre's `docs/art/portrait-layers.md`. |
| `white` (sub-layer of base coat group) | white phenotype | `white_socks.png`, `white_blaze.png` (both for socks+blaze), `white_piebald.png` | `#F7F4EE`, opacity 1.0; see 2.3 |
| `eyes` | eye phenotype | `eye_left.png`, `eye_right.png` | amber `#C98A1E`, gold `#D9B43A`, copper `#B5652A`, green `#8FA34A`, blue `#8EB6D1`. Heterochromia: see 2.5. `eye_left` and `eye_right` each take their own tint |
| `sabers` | saber phenotype | `sabers.png` (one mask, fixed shape) | ivory `#EFE7D2`, cream-yellow `#E3CF96`, dark/stained `#8C7A5A`. Elder: mix 15% toward `#8C7A5A` |
| `scars` | not genetic (injury list) | per Ochre's scar set | `#8E6F66` placeholder |
| `age` | `lifeStage` (lifecycle-spec §2: cub, adolescent, adult, elder) | cub and adolescent use their own pose folders (lifecycle-spec §6.2), with the same masks; elder uses `age_elder.png` (muzzle/brow greying) on the adult base. Adult has no age layer. | elder `#C9C4BC`, opacity 0.5; see 2.3 |

2.1 **Stack order:** see §2.3, which Ochre's contract confirms. White goes **above** markings, so white patches cover spots and stripes.
2.2 Every pose (male/female portrait, male/female lying) needs the same set of masks on the same canvas and anchor, so one resolver output works for every pose.
2.3 **Blending (settled by Ochre and Flint, 2026-11-04):** each gene layer is a PNG. Its alpha is the mask and its grayscale is the shading. The layer is tinted to `geneColor × shading` and drawn with a `normal` blend. Only `shadow` uses `multiply`, and any rim light uses `screen`. Every manifest layer has a `blend` field that defaults to `normal`. Stack, bottom to top (v0.4, Ochre): shadow, base_coat, **undercoat**, ticking, body pattern (`markings_*`), dorsal, points, mask, tearlines, white, eyes, sabers, scars, age_elder (opacity set by the gene), lineart. Dilution only changes the tint colour. There's no erase step, so white patches and elder greying draw on top of any coat.
2.4 **Lore mapping notes for Saga:** "smoke-grey rosettes" on a black coat would be lighter than the coat, so they can't be drawn; use "ghost rosettes": on black they read slightly **warmer and matte** in raking light, not darker (Ochre palette v1). "Snapped left saber" is shape, so it's out of scope (or becomes a scar-layer chip if Ochre wants that). "Blue-grey" = grey-dun + dilute. "Brindle"/"bark-mottled" map to faint stripe/spotted plus a bold intensity.
2.5 **Heterochromia (v0.3, Anna via Director 2026-11-04: rare and inheritable).**
   - **Locus `het`:** alleles `Het` (normal, dominant) and `het`. A cat shows odd eyes only when it's `het/het`. The founder allele frequency `het` .12 gives 1.44% expressed (rare tier), and 21% of cats are carriers.
   - **Colours:**
     - The left eye is always the `eyes` locus phenotype.
     - When `het/het`, the right eye is rolled **once at birth or creation** from the eye *phenotype* shares in 1.7 (amber 64, gold 23.8, copper 6.0, green 5.6, blue 0.64). It's rerolled until it differs from the left, then stored in `genes.eyeRight`, so it never changes for that cat.
     - Otherwise `genes.eyeRight` is null and both eyes match.
   - **Inheritance:** Mendelian per §3.1, and §3.2 mutation applies like any locus. The cub's right-eye colour is rolled fresh, not copied from a parent, so two odd-eyed parents give odd-eyed cubs with new pairs.
   - **Resolver:** `traits.eyes = {left, right}` (equal when not expressed). The `eye_left` layer gets the left tint and `eye_right` the right tint. Flint's compositor already draws them separately.
   - **Art caveat (Ochre):** on the three-quarter bases the far eye may be small or hard to read. Ochre is checking. If it reads poorly, a pose-level option is to swap which eye gets the odd colour. That's Ochre's call; the gene doesn't change.
2.6 **Rare coats confirmed (v0.3):** `melan` .04 and `leuc` .04 stay. Founders express melanistic 0.16%, leucistic 0.16% and ash (melan + leuc) 0.32%, all well under 3%. **Ash stays as a rare breeding goal** (Anna). Rare coats get more interesting colour through Ochre's palette later; there's no hex work in this version.
2.7 **Phase 1 vs later (art gating, v0.4).**
   - **Phase 1** (first post-PoC art pass): undercoat, rosette, dorsal, barred.
   - **Later:** ticking, points, facial mask, tear lines.
   - **Every locus is rolled, inherited and stored from v0.4**, whatever its art status. The resolver **skips any layer whose mask file doesn't exist** in the pose folder, and logs it once per session. When the art lands, cats gain the look with no data change.

## 3. Inheritance
3.1 **Mendelian:** for each locus, each parent passes one of its two alleles at random (50/50). Loci are independent (no linkage in v0.1).
3.2 **Mutation:** per locus per cub, a **0.5%** chance that one inherited allele (random parent's copy) is replaced by a different allele of that locus, picked uniformly. This is how rare alleles reappear after being lost.
3.3 **Heterochromia:** inherited through the `het` locus (2.5). The old 0.3% spontaneous rule is removed; new `het` alleles still appear via 3.2 mutation.
3.4 **Rare mutations list:** any rare-tier allele gained through 3.2. **v0.4:** 3.1 and 3.2 apply to every locus in §1, including `under`, `underInt`, `tick`, `points`, `mask` and `tear` (and `barred` within `marking`).
3.5 **Rarity tiers** (by expected phenotype share: common ≥ 10%, uncommon 3-10%, rare < 3%, mutation = never in the start pool):

| Tier | Traits |
|---|---|
| Common | tawny, sandy, russet, grey-dun; full and light dilution; spotted, rosette, faint stripe, plain; all intensities; no white, socks, blaze; amber, gold; ivory sabers; undercoat cream/pale/off and all undercoat intensities; ticking; facial mask |
| Uncommon | dilute (2×d); socks+blaze; copper, green eyes; cream-yellow sabers; barred; points |
| Rare | melanistic, leucistic, ash; dorsal stripe; piebald; blue eyes; heterochromia (odd eyes); dark/stained sabers; tear lines |
| Mutation | (none in v0.3) |

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
4.4 Random new cats roll each trait from Normal(50, 15), clamped 5-95. World (premade) cats are rolled from the world seed too (world-gen-spec v0.3+ §5), not authored.
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
            "eyes": ["amber","blue"], "saber": ["ivory","stained"], "het": ["Het","het"],
            "under": ["cream","off"], "underInt": ["U+","U-"], "tick": ["tk","tk"], "points": ["Pt","pt"],
            "mask": ["mk","mk"], "tear": ["Tl","tl"] },
  "eyeRight": null,
  "mutations": [ { "locus": "eyes", "from": "gold", "to": "blue", "gen": 3 } ],
  "personality": { "aggression": 70, "sociability": 55, "boldness": 62, "loyalty": 48, "curiosity": 81 },
  "sireId": "cat_0123", "damId": "cat_0456" }
```
```json
Phenotype resolver output (resolve(genes, sex, lifeStage, scars[], pose)), shaped like Ochre's manifest:
{ "pose": "female_lying",
  "traits": { "coat": "tawny", "dilute": 1, "marking": "spotted", "dorsal": false, "intensity": 1,
              "white": ["socks"], "eyes": {"left":"amber","right":"amber"}, "saber": "ivory",
              "undercoat": "cream", "undercoatInt": 1, "ticking": false, "points": false, "mask": false, "tearlines": false },
  "rarity": "common",
  "layers": [
    { "id": "base_coat",          "file": "assets/portraits/female_lying/base_coat.png",       "blend": "normal",          "tint": "#CEA26E", "opacity": 1.0 },
    { "id": "undercoat",          "file": "assets/portraits/female_lying/undercoat.png",       "blend": "normal",          "tint": "#E0C7A5", "opacity": 0.60 },
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
| het.rightEyeTable | 1.7 phenotype shares, reroll until ≠ left |
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
8.1 **Closed (Anna, 2026-11-04):** the creator shows 5 coats (tan, gray, brown, black, sandy) in every Style. **Sandbox-only** (Free Customization On) are pale, ash and odd eyes (Director's ruling, cat-creator-spec v0.3.1 §3c). Natural founder and breeding rates are unchanged.
8.2 **Closed (Anna):** heterochromia is rare and inheritable (§1.8, §2.5).
8.3 **Closed (Anna):** ash stays as a rare breeding goal (§2.6).

## Changelog
- v0.4.4 (2026-11-05, Tundra; Saga's review): §1.11 and §4.4 now say world cats' looks and personality are rolled from the world seed (world-gen v0.3), not authored. §2.4 ghost marks read warmer and matte in raking light, not darker (Ochre palette v1). Backup: `genetics-spec.v0.4.3.bak.md`.
- v0.4 (2026-11-05, Director-approved): folded in `markings-genes-proposal.md`:
  - New loci `under`, `underInt`, `tick`, `points` (uncommon 9%), `mask`, `tear`; `barred` added to the body-pattern locus, with the retune faintstripe .20→.17 and plain .45→.40.
  - One body pattern; overlays stack (§1.10). Intensity rules (§1.10a). `undercoat` layer between base_coat and markings, with the new stack (§2.3).
  - Phase 1/later art gating, with missing masks skipped (§2.7). Tiers, mutation scope and data shapes updated.
  - Backup: `genetics-spec.v0.3.1.bak.md`.
- v0.3.1 (2026-11-04): §8.1 wording now follows Director's ruling (black allowed in the creator in every Style). Undercoat and markings genes are proposed in `markings-genes-proposal.md` (planned for v0.4). Backup: `genetics-spec.v0.3.bak.md`.
- v0.3 (2026-11-04, Tundra, Anna's answers via Director): §8 closed. Added the `het` locus (Het .88 / het .12, 1.44% odd eyes, `genes.eyeRight`, resolver `eyes {left,right}`) and removed the `hetero` flag and the 0.3% spontaneous rule. Confirmed the melan/leuc/ash rates (§2.6). Backup: `genetics-spec.v0.2.bak.md`.
- v0.2 (2026-11-04): life stages added (§0.5 and the age layer row), per Anna via Director. Blending settled (§2.3).
- v0.4.1 (2026-11-05, Tundra): §2 hexes now come from Ochre's coat-palette v1 (black `#141416` with warm matte ghost marks, ash `#8A95A3` with a silver sheen, pale `#EDE6DA` with a pink-grey nose). Added per-coat undercoat, nose, claws, rim and sheen tints. The undercoat `cream` uses Ochre's hex, `pale` is mixed halfway toward the coat, and opacity comes from `underInt`.
- v0.4.2 (2026-11-05, Tundra, per Ochre): `underInt` opacities raised to 0.65 / 0.75 / 0.85 so the undercoat always reads. The creator uses 0.85.
- v0.4.3 (2026-11-05, Director ruling): reverts v0.4.2. `underInt` stays at 0.35 / 0.60 / 0.85 for bred and world cats, and only the creator fixes it at 0.85.
