# Sabretooth: Breeding & Cubs Spec (v0.1f, DRAFT)
**Read §17b, then §17a, then §17e first:** Anna's growth ruling (§17b) and Director's interim defaults (§17a) override the sections they name.
Owner: Tundra (rules and numbers). Code: Flint. All player-facing text: Saga. Art and layers: Ochre. Gate: Tracker.
Assignment: Director, relaying Anna, 2026-11-27. Not in the build. Nothing here overrides an approved spec; where they disagree, the conflict is listed in §17 and the existing rule stands until Director/Anna rule, unless a line below is tagged PROPOSED DEFAULT and says otherwise.

**Tags.** ANNA-APPROVED = a source quotes Anna. APPROVED = Director-approved in its source. PROPOSED DEFAULT = mine, awaiting Director. **candidate, sim pending** = a new number with no sim behind it yet. Numbers marked *(sim S#)* come from `sim/breeding_sim_v0.1.py` (output `sim/breeding_sim_v0.1.out`, seed 20261127).

## 0. Status, scope, ground rules
0.1 **Scope:** conception, pregnancy, litters, how genes, personality and aptitude pass to cubs on Ochre's new layered portrait system, growth stages and aging, the cub-care loop, heirs, save data, portraits for young cats, Saga hooks, the build order and tests.
0.2 **Sources consolidated** (read these for anything not restated):
| Doc | What it gives this spec |
|---|---|
| `docs/genetics-spec.md` v0.4.6 | loci §1, gene→layer §2, Mendelian + mutation §3, personality §4, kinship §5, schemas §6, tunables §7, creator coats §8.1. **Predates layered-v2.** |
| `docs/lifecycle-spec.md` v0.1 | stages, ages, abilities, natural death, `lifecycle.json` |
| `docs/relationships-spec.md` | `mates`, `breeding` flag §1.8, age gate §1.6, no incest §1.7, heir §5.5 |
| `docs/formulas-spec.md` §2.4, §7.2 | breeding season, births in spring/summer |
| `docs/needs-spec.md` §4 | cub/adolescent need multipliers, nursing and weaning |
| `docs/skills-spec.md` §5–6, §13.3, §15.4 | stage XP, aptitude inheritance, teaching |
| `docs/play-styles-spec.md` §2.8, §3.3 | cub mortality by Style, Sim inbreeding |
| `docs/main-menu-spec.md` §7 | Heir and Sandbox rules |
| `docs/design/achievements-difficulty-traits-v0.1.md` | A27–A31, T19/T20/T38/T50/T51/T56, §3.5 / §3.5a inheritance |
| `docs/design/my-pride-v0.1.md` | Cub-sitter role, feeding order, food store |
| `docs/design/milestone-2-spec.md` §3.1, §9.1 | `absDay`, `yearLengthDays: null` (now 80, §17a.1), breeding OUT of season 1 |
| `docs/world-gen-spec.md` §4–6 | world kin bred with genetics §3; cub slots at 0 and 3 seasons |
| `/workspace/qa/layered-v2/` (README, `layers/`, `scratch90` r4, `scratch95` eyes2 / tiger3b / tiger3c / fareye_min) | the new layer set: 6 coat fills, shared shading/highlight, 12 eye colours, tiger stripes |
| `/workspace/qa/art-gate/*/REPORT.md` | Tracker's gates on those layers |
| Roadmap, ANNA-APPROVED 2026-11-08 (LATER roadmap) | S2 female pregnant with 1–7 cubs, territory; S3 cubs born, feed/defend, train skills; S4 adolescents get mature looks and help, then repeat; too little territory → overcrowding; profiles show personality, skills, history; a season is 20 days; `yearLengthDays` stays null (superseded: 80, ANNA-APPROVED 2026-11-27, §17a.1) |

0.3 **Ground rules** (carried, APPROVED in their sources):
1. Lineart is fixed. Genes only tint or toggle colour layers, never shape (genetics §0.1; layered-v2 README: only the coat fill changes per coat).
2. Shading and highlight layers are shared and not genetic (layered-v2 `shading.png`, `highlight.png`).
3. No numbers in player-facing prose; odds and stats are words (ux-redesign-v0.2 §3.3, §3.7). Personality shows as word ends, not values.
4. Saga owns every player-facing string; Ochre owns every layer, mask and tint; Flint owns code; Tracker gates. This spec names ids and facts only.
5. Every locus inherits whether or not its art exists; missing art falls back per §14.4 (genetics §2.7, APPROVED).
6. Season 1 code is untouched: breeding stays OUT of the current milestone (milestone-2 §0, APPROVED); this spec is for the season-2 build onward.

## 1. Mating and conception
1.1 **Who can conceive** (all existing rules):
- A `mates` bond with `breeding: true` (relationships §1.8; same-sex mates have `breeding: false`, APPROVED, ANNA-APPROVED via relationships v0.1.2).
- Both cats adult or elder and inside the fertile window: female `ageSeasons` ≤ 44, male ≤ 48 (lifecycle §2.4, §7 `fertileUntil`; world-gen §6 uses ≤). Cubs and adolescents never (lifecycle §3; relationships §1.6 hard reject).
- r(mates) < 0.125 is already required for the bond (relationships §1.7, APPROVED), so every conceiving pair has r < 0.125.
- The female is not already pregnant. (v0.1e: the old "no living cubs" gate is **dropped**, §17d.1.)
1.2 **When (§17b.2, ANNA-APPROVED 2026-11-27):** conception happens once a year for each eligible pair, on the first spring day the mated pair is together: the day they pair if that day is in spring, otherwise day 1 of spring (year-day 1). A pair that mates after spring waits for the next spring. The pregnancy stores `conceivedAbsDay`; birth follows on `dueAbsDay` = `conceivedAbsDay` + 20 (§2.1), always a summer day. Unmated cats still court only in spring (formulas §2.4, `breedingSeasons` `["spring"]`). AI prides add the spring capacity gate of §17e.4; the player's pride adds the gate of §17e.3 (APPROVED, Director 2026-11-27).
1.3 **Chance:** PROPOSED DEFAULT 100% for every eligible pair (player and AI). The roadmap states the female is pregnant; it doesn't make it a roll. Any lower AI rate is **candidate, sim pending**.
1.4 **Frequency:** at most one litter per female per year. `yearLengthDays` = 80 (4 seasons × 20 days, ANNA-APPROVED 2026-11-27, §17a.1), so every year has one spring, and a fertile female who isn't already pregnant can conceive each spring (the living-cubs gate is dropped, §17d.1). A founder who starts at 12 seasons can have up to 9 yearly litters (last fertile spring at age 44).
1.5 **Inbreeding:** kinship and F per genetics §5. Sim penalty (cub mortality ×(1 + 2r), `frail` chance r × 40%) applies when r(parents) ≥ 0.25 (genetics §5.3, play-styles §3.3). Because 1.1 forces r < 0.125, **the Sim penalty can never fire through a mates bond** (conflict, Q17.9). r is still passed to the storyteller in every Style (genetics §5.4).
1.6 **Player choices:** the player can't force or block conception in v0.1 (PROPOSED DEFAULT). Saga may write a "we want cubs / not yet" beat later; that is a design change, not this spec.

## 2. Pregnancy and litter
2.1 **Length:** one season, 20 days (roadmap S2, ANNA-APPROVED; `daysPerSeason` 20, LOCKED, lifecycle §7). **`birthAbsDay = conceivedAbsDay + 20`** (§17b.2), so conception in spring (year-days 1–20) gives birth in summer (year-days 21–40). The old fixed autumn birth day is withdrawn.
2.2 **Litter size:** 1–7 (roadmap, ANNA-APPROVED). Rolled at conception and stored on the pregnancy, so the storyteller can foreshadow it (PROPOSED DEFAULT). Distribution **candidate** (sim S5 shows its shape; the weights themselves are a proposal, not derived):
| Cubs | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Weight % (candidate) | 8 | 18 | 26 | 22 | 14 | 8 | 4 |
Mean 3.56, P(≥ 5) 26.1% *(sim S5)*. A28 `full_den` ("raise a litter of five or more") stays reachable but uncommon.
2.3 **Modifiers:** only those already approved: T19 `fertile` = roll one step larger, T20 `small_litters` = one step smaller (achievements §3 table, clamp 1–7). Means 4.52 / 2.65 *(sim S5)*. The dam's trait applies; if both parents carry a step, they add, clamped (PROPOSED DEFAULT). No food, age or Style modifier: none exists in any doc (Q17.6).
2.4 **Needs while pregnant:** no existing numbers, so none in v0.1. Hunger ×1.2 for the pregnant female is **candidate, sim pending** (it mirrors the adolescent "growing" row, needs §4) and is OFF by default.
2.5 **Miscarriage:** no existing numbers, so **none** in v0.1. If the dam dies before her `dueAbsDay` (= `conceivedAbsDay` + 20, §2.1) the litter is lost (PROPOSED DEFAULT; it fires the `litter_lost` hook §15).
2.6 **Sex:** 50/50 per cub (genetics §0.4, APPROVED).

## 3. Base coat on the layered system
3.1 Inheritance is unchanged: Mendelian per locus, 50/50 from each parent, independent loci, mutation 0.5% per locus per cub (genetics §3.1–3.2, APPROVED).
3.2 **Allele → layered-v2 coat fill** (the creator already uses this pairing in `creator.js` `COAT_GENES`):
| `coat` phenotype (genetics §1.1) | Layered-v2 coat | Fill hex in layered-v2 | genetics-spec hex | Art status |
|---|---|---|---|---|
| tawny | **Tan** | `#C2945E` | `#C8955A` | r4 approved by Anna |
| greydun | **Gray** | `#A39A88` | `#A39A88` | r4 |
| russet | **Brown** | `#B0623A` | `#B0623A` | r4 |
| sandy | **Sandy** | `#D9BC8A` | `#D9BC8A` | r4 |
| melan | **Black** | `#393532` | `#141416` | r4 |
| leuc | **Pale** | `#EEE8DC` | `#EDE6DA` | r4 |
| melan + leuc (Co) | **Ash** | none | `#8A95A3` | **no layered-v2 art** → §14.4 |
3.3 Tints come from Ochre's art, not genetics §2 (genetics §0.2: Ochre's contract wins). The three hex mismatches above (Tan, Black, Pale) are expected; `data/genetics.json` should take the layered-v2 values when the art ships.
3.4 **Dilution** (`dilute`, genetics §1.2) tints the coat fill: mix(coat, `#F3EBDD`, 0 / 0.15 / 0.35) (genetics §2, APPROVED). It needs no new mask, since layered-v2 changes only the flat fill (`compose.py '#RRGGBB'`), but Ochre must confirm the per-coat shading settings still read on diluted fills (Q17.7).
3.5 **Founder shares stay as genetics §1.1** (HW). Over 10 generations of random mating they hold within ±3 points; mutation slowly lifts the rare alleles (black 0.16 → 0.29%, ash 0.32 → 0.40% at gen 10) *(sim S1)*.
3.6 **Cross table** (parents picked by visible coat from founders; *sim S3*): Tan × Tan → Tan 82.8, Sandy 7.9, Brown 5.4, Gray 3.6; Tan × Black → Tan 58.7, Sandy 14.8, Gray 14.7, Brown 7.1, Black 2.4, Ash 2.4; Black × Black → Black 99.5; Black × Pale → Ash 99.5; Pale × Pale → Pale 99.5; Gray × Gray → Gray 95.9, Ash 1.9.

## 4. Markings: tiger layer and the old marking loci
4.1 **What layered-v2 has:** one tiger-stripe layer (scratch95 `tiger3b`, Tracker PASS 2026-11-27; `tiger3c` = r3c in progress, Anna-directed 3D wrap). It's composited into the coat fill **before** the shared shading, with a per-coat colour and strength (`stripe_settings.json`: tan `#3A2818` .78, sandy `#5B4127` .70, brown `#2A170D` .72, gray `#3F3A35` .62, pale `#8A7560` .56, black `#1A1B1F` .80). There's no Ash setting, and no spotted, rosette, barred, faintstripe or dorsal layer on the new base.
4.2 **Mapping** (all PROPOSED DEFAULT; Q17.1 decides):
| Old allele (genetics §1.3) | Founder share | Layered-v2 layer | Rule |
|---|---|---|---|
| `barred` | 9.8% | tiger | full intensity rule 4.3 |
| `faintstripe` | 16.5% | tiger | intensity rule 4.3 × 0.5 (candidate, Ochre to judge visually) |
| `spotted` | 43.8% | **none** | falls back to no marking (§14.4) |
| `rosette` | 14.0% | **none** | falls back to no marking |
| `plain` | 16.0% | none (correct) | — |
4.3 **Intensity:** `intensity` (genetics §1.5, 0/1/2 × `I+`) scales tiger strength by 0.35/0.85, 0.60/0.85, 1.0 = ×0.41 / ×0.71 / ×1.0 of the per-coat strength (derived from the approved opacity steps 0.35/0.60/0.85 so "bold" = Ochre's tuned strength). PROPOSED DEFAULT; Ochre confirms on the art.
4.4 **Composition with coat:** stripe colour is chosen by the coat phenotype from `stripe_settings.json`, after dilution. Ash: no stripe setting → use the Gray setting (PROPOSED DEFAULT) until Ochre tunes it.
4.5 **Fallback share:** with today's art, **57.4% of founders and bred cats carry a pattern with no layer** (spotted or rosette), and 60.2% need at least one fallback (coat, marking or eyes) *(sim S2)*. That's the biggest art gap in this spec.
4.6 **Overlays** (`dorsal`, `tick`, `points`, `mask`, `tear`, genetics §1.4, 1.14–1.17) and undercoat (`under`, `underInt`) keep inheriting; none has a layered-v2 mask yet, so all are skipped (§14.4).
4.7 **Creator mismatch** (not this spec's to fix): the creator offers markings none / spotted / faintstripe (`creator.js`). On layered-v2, spotted has no art. Q17.1.

## 5. Eyes
5.1 **Layered-v2 eye layer:** a separate recolourable layer drawn **above** the lineart, with near/far masks (scratch95 eyes2 + fareye_min; Tracker PASS). Twelve colour ids: `amber`, `gold`, `green`, `blue`, `brown`, `red`, `gray`, and black-undertone variants `bu_gold`, `bu_blue`, `bu_green`, `bu_red`, `bu_brown`.
5.2 **Mapping:**
| Old allele (genetics §1.7) | Share | Art id | Black-coat id | Note |
|---|---|---|---|---|
| amber | 64.0 | `amber` | `amber` (no bu) | |
| gold | 23.8 | `gold` | `bu_gold` | |
| copper | 6.0 | **none** | — | shows as `gold` / `bu_gold` (§17a.3, APPROVED interim) |
| green | 5.6 | `green` | `bu_green` | |
| blue | 0.64 | `blue` | `bu_blue` | |
| brown, red, gray (new alleles, §17a.3) | see §17a.3 | `brown`, `red`, `gray` | `bu_brown`, `bu_red`, `gray` | APPROVED interim, frequencies candidate |
5.3 **`bu_*` is not a gene.** It's a render variant picked by the coat: when the coat phenotype is melan (Black), use `bu_<id>` if it exists, otherwise the base id (PROPOSED DEFAULT). Ash and dilute black use the base ids until Ochre says otherwise.
5.4 **Odd eyes:** `het` locus unchanged (genetics §1.8, §2.5: rare and inheritable, ANNA-APPROVED). Near eye = `eyes` phenotype (`eye_left`); far eye = `genes.eyeRight` (`eye_right`, portrait-layers §6). The right colour is rolled fresh at birth from the §1.7 shares and rerolled until it differs (genetics §2.5). Odd × odd → 99.5% odd cubs; odd × normal (random carrier status) → 10.8% *(sim S3)*. In a 39-cat world at least one odd-eyed cub is born in 88% of 10-generation runs *(sim S1b)*.
5.5 **Creator rule stays:** odd eyes, Pale and Ash are Sandbox-only in the creator (genetics §8.1, ANNA-APPROVED 2026-11-04). **Bred cats aren't restricted** in any mode: any cub can be born with them at natural rates (genetics §8.1 "natural founder and breeding rates are unchanged").

## 6. Other gene layers (brief)
| Locus | Inherits | Layered-v2 art | v0.1 render |
|---|---|---|---|
| `saber` (ivory/creamy/stained, §1.9) | yes | `sabers_teeth` exists but has its **own fixed colour** (README: coat-invariant) | not tinted → Q17.5. Elder 15% stain (genetics §7) also waits on this. |
| `white` (§1.6) | yes | none | skipped |
| `under`, `underInt` (§1.12–1.13) | yes | none | skipped |
| `dilute` (§1.2) | yes | coat fill tint | applied (§3.4) |
| `dorsal`, `tick`, `points`, `mask`, `tear` | yes | none | skipped |
| inherit-only traits (achievements §3.5a: `giant`, `long_sabers`, `frost_hardy`, `fertile`, `long_lived`, `tainted_blood`) | yes, by that table (PROPOSED, awaits Anna) | none (shape traits are out of scope, genetics §0.3) | no portrait effect |
| Inheritable perks/traits marked Inh. | chance **0.25, candidate, sim pending** (achievements §3.5) | — | — |
| `attraction` | **not inherited**, rolled at birth 85/10/5 (relationships §1.8, ANNA-APPROVED) | — | — |

## 7. Mutation and rare looks
7.1 Mutation stays 0.5% per locus per cub (genetics §3.2). Rare tiers per genetics §3.5.
7.2 **Small-world drift:** in a 39-cat world with random mating, the melan allele is gone by generation 10 in 51.7% of runs, leuc 53.1%, blue eyes 28.6%, copper 24.8%. At least one Ash cub is born in 38.2% of runs *(sim S1b)*. So Ash stays the rare breeding goal Anna asked for (genetics §2.6), and mutation is the only way lost colours come back.
7.3 **Mutation drift upward:** because mutation picks a different allele uniformly, rare alleles slowly rise (odd eyes 1.45 → 2.02% by gen 10 in a large population, *sim S1*). That's acceptable at game scale; flag only if Tracker sees it in long Sandbox runs.
7.4 **Creator vs bred:** Pale, Ash and odd eyes are Sandbox-only **in the creator**; any mode can **breed** them. A31 `rare_coat` fires on any cub born showing a rare-tier coat, pattern or eye (achievements A31, includes melanistic).

## 8. Personality inheritance (Anna's rule)
8.1 **Formula, unchanged** (genetics §4.2, Anna's rule): cub trait = round_half_up(clamp((parentA + parentB) / 2 + Normal(0, 8), 0, 100)), per trait, independently, for all five traits.
8.2 **Worked example (Anna's):** parents at aggression 89 and 50 → average 69.5 → the cub is likely aggressive. P(≥ 60) 89.5%, P(≥ 70) 50.0%, P(< 50) 0.61% *(sim S4; genetics §4.3 says 89.4 / 50.0 / 0.6, matches within Monte Carlo error)*. Two 89 parents → mean 88.7, P(≥ 80) 88.2%.
8.3 **Drift over generations:** with random mating, population spread shrinks from sd 15 to sd 11.5 by generation 3 and then holds (theory 11.3). Cats at ≥ 70 fall from 10.2% to about 5% *(sim S4)*. So extreme personalities get rarer in bred lines unless the player pairs like with like. Selective breeding works but regresses: keeping the most aggressive of 3 cubs each generation with a random mate gives mean 64.3 after 5 generations *(sim S4)*. That fits "parents' average plus randomness"; no change proposed. If Anna wants more extremes in late game, raise `personality.cubSd` (genetics §7), Q17.8.
8.4 **Creator ranges don't apply to cubs:** bred cats use 0–100 (genetics §4.2); the 20–80 slider range and 5-step are creator-only (main-menu §7, creator `TRAIT_STEP`).
8.5 **Player-facing:** personality shows as words on the profile (roadmap: profiles show personality; ux-redesign §3.7). Saga's words; no digits.

## 9. Skills: start values and training
9.1 **Aptitude** per branch: cub = round_half_up(clamp((parentA + parentB) / 2 + Normal(0, 5), 80, 120)), using each parent's full aptitude including taught (skills §6.1, §13.3, APPROVED).
9.2 **XP:** every cub starts at 0 XP, no milestones, no perks. Cubs earn no XP; adolescents earn ×1.25; adults ×1.0; elders ×0.75 (skills §5).
9.3 **Training in S3 (roadmap "train cubs' skills toward adulthood"):** the existing tool is teaching (skills §6.3): each season a cub or adolescent gains +1 aptitude in one branch where a parent or elder has milestone 3+ (max +5 per branch, cap 120); ties are the player's pick in Standard and Sim, automatic in Story. Adolescents also get +2 XP per shared hunt with a milestone-3+ teacher. **Gap:** the roadmap says cubs train skills, but skills §5 says cubs earn no XP. PROPOSED DEFAULT: S3 "training" = the teaching pick, shown as a cub training order (my-pride "Cub training orders" is listed as future). Q17.10.
9.4 Aptitude compounding over a teaching lineage is an existing open item (skills §15.4); Tracker should rerun it once Flint's breeding is wired.

## 10. Growth stages and aging
10.1 **Stages and abilities stay as lifecycle §2–§3** (names set by Anna 2026-11-04): Cub, Adolescent, Adult, Elder; hunt ×0.5 learner / ×1 / ×0.8; fight ×0.6 / ×1 / ×0.85 down to ×0.5; breed adult to 44 (F) / 48 (M) seasons; heir from adolescent.
10.2 **[Superseded by §17b.1: adolescent 4, adult 8, ANNA-APPROVED.]** **Conflict with the roadmap.** Lifecycle has a cub for 4 seasons (0–3) and ages every cat 1 per season. The roadmap has cubs born in S3 and **adolescents with mature looks in S4**, one season later. PROPOSED DEFAULT (data only, `lifecycle.json`): `stageStart` cub 0, **adolescent 1**, adult 12, elder 40. Only the cub stage shortens; adult age, player start age 12 (ANNA-APPROVED), fertility and elder ages don't move. Consequences:
- Cubs spend 1 season as cubs. Standard survival to adolescence goes from 84.9% to 96.0% per cub (Sim ×1.5: 78.1% → 94.0%) *(sim S6)*.
- Weaning at "2 seasons" (needs §4) can't happen inside a 1-season cub stage. PROPOSED: nursing runs for the whole cub stage, and pride food starts at adolescence.
- World-gen cub slots aged 3 seasons (`hc10`, `bf09`) would read as adolescents. Saga/world-gen would set them to 0 or relabel them. Q17.2 covers both.
- If Director keeps lifecycle as written, only the data value changes; the code is the same.
10.3 **Aging:** +1 `ageSeasons` at the start of each season (every 20 absDays) for every cat (lifecycle §1.2). `lifeStage` is derived, never stored, except in the save-meta snapshot (lifecycle §2.5).
10.4 **Visual change per stage** (lifecycle §6.2, Ochre): cub and adolescent get their own pose folders (own lineart, same layer contract), because proportions and saber length differ. "Mature looks" in S4 = the switch to the adolescent pose. Adult has no age layer. Elder = `age_elder` overlay on the adult base, plus the 15% saber stain. **None of these exist on layered-v2 yet** (§14.3).
10.5 **Natural death** (lifecycle §4, per season, before Style): cub 4% (× play-styles §2.8 Story ×0.5 / Standard ×1 / Sim ×1.5, × inbreeding mult, +10% if starving); adolescent and adult 0.5%; elder 2% at 10 years + 2% per year after, cap 40%. Story: the player cat retires instead of dying of age (lifecycle §4.4).

## 11. Cub-care loop (S3)
11.1 **Feeding:** pride food store; each member, cubs included, eats 12 a day in Feeding order, cubs first by default (my-pride §4.6, needs §1.2). Cubs: Hunger ×0.7, filled to 100 by nursing while the mother's Hunger ≥ 50 (needs §4). An unfed cub counts a starvation day, and a starving cub gets +10% death that season (lifecycle §4.1).
11.2 **Cub-sitter** (`nursemaid`): with one, the starving +10% applies only when the store is empty, and cubs take no harm from a lost challenge (my-pride §4.3).
11.3 **Warmth:** cubs ×1.5 Warmth decay, ×1.2 with `warm_keeper` (needs §4, skills).
11.4 **Threats:** rivals can target cubs only when no adult guards the den (loners §5.1); `den_watch` blocks it while you're within 1 zone (skills); with `hide`, cubs can't be hurt in the fight (loners). Cub illness ×1.5 (needs §4).
11.5 **Overcrowding** (roadmap: too little territory causes overcrowding, ANNA-APPROVED). Numbers are **candidate (sim overcrowding v0.1)**; full rules and evidence in §17e:
- Capacity = 4 pride members per region the pride currently holds (cubs count). It is recomputed at every season check, so gaining, losing or being pushed off a region changes it at the next check (§17e.2).
- Over capacity at a season check: `seasonsOver` +1, and every adult gets contentment −5 × `seasonsOver`, never more than −20 in one season. Hunt yield per hunter is unchanged (no new food maths). Saga gets an `overcrowded` fact.
- At or under capacity: no effect, and `seasonsOver` resets to 0. Gaining a region or members leaving resolves it.
- Births: the player's pride doesn't conceive at a spring check while it's over capacity (§17e.3, APPROVED, Director 2026-11-27, changes §17d.2); AI prides use the room-limited gate (§17e.4).
11.6 **S4 adolescents help:** adolescents join hunts as learners (×0.5, lifecycle §3) and can take my-pride roles except Guard in challenges (they can't be challenged). PROPOSED DEFAULT; my-pride §4 roles already exist.

## 12. Heirs and death rules
12.1 **Heir** (main-menu §7, APPROVED): any living pride member adolescent or older, ranked by blood relation to the player cat, then age. Ties break on the higher average pride value toward the candidate (relationships §5.5). Cubs are never eligible (lifecycle §3).
12.2 **[Superseded by §17b.3: heir-eligible at adolescent, 4 seasons after birth.]** **Under the proposed 1-season cub stage**, a litter born in S3 is heir-eligible from S4.
12.3 **Permadeath:** player death ends the run (milestone-2 §3.7.5, APPROVED). Cubs don't change that.
12.4 **Continue as heir** (default): the player switches to the top heir. With no eligible heir (for example only cubs alive), the run ends on the Legacy summary (main-menu §7). PROPOSED DEFAULT: keep that. Waiting for a cub to grow is Q17.11.
12.5 **Sandbox:** "no game over" (main-menu §7). PROPOSED DEFAULT: Sandbox uses the heir pick; with no eligible heir, the run continues and the player picks a living pride cat once one is adolescent or older (the player cat is never a cub, needs §4.1). What happens in between is Q17.11.
12.6 **Achievements** that read this: A27 `first_litter`, A28 `full_den`, A29 `grandsire`, A30 `dynasty` (fourth-generation heir), A31 `rare_coat`. Sandbox earns none (achievements §1.3, ANNA-APPROVED).
12.7 **Traits at birth:** T50 `heir_of_legend` (a parent held a title); T38 `grieving` gained when a mate or cub dies, lost on the next bond or litter; T56 den_mother/den_father after raising three litters to adulthood (achievements table).

## 13. Data and save schema
13.1 **Cat record** (existing fields kept: `catId`, `name`, `sex`, `ageSeasons`, `birthSeason`, `genes`, `scars`). New, all PROPOSED DEFAULT:
```json
{ "catId": "cat_0789", "sex": "F", "ageSeasons": 0, "birthSeason": {"year": 2, "season": "summer"},
  "birthAbsDay": 101, "litterId": "lit_0003", "generation": 2,
  "genes": { "v": 2, "loci": { "...": "genetics §6" }, "eyeRight": null, "mutations": [],
             "personality": { "aggression": 70, "sociability": 55, "boldness": 62, "loyalty": 48, "curiosity": 81 },
             "sireId": "cat_0123", "damId": "cat_0456" },
  "aptitude": { "hunting": 103 }, "aptitudeTaught": { "hunting": 0 },
  "inheritOnly": { "fertile": "carries" }, "frail": false, "attraction": "opposite",
  "history": [ { "absDay": 101, "fact": "born", "litterId": "lit_0003" } ] }
```
- `generation`: founder or player creator cat = 1; cub = max(parents) + 1 (A30 reads it).
- `sireId`/`damId` stay inside `genes` (genetics §6). Unknown or off-roster parents stay null or `off_*` (world-gen §4.3).
13.2 **Pregnancy** on the dam: `pregnancy: { litterId, sireId, conceivedAbsDay, dueAbsDay, size }` or null. **Litter** records: `litters[]: { litterId, damId, sireId, bornAbsDay, size, cubIds[], survivedToAdult: int }`.
13.3 **Version:** `saveVersion` 1 → 2 (`slice-rules.json`, save-meta). Genotype `genes.v` → 2 for the new eye alleles (§17a.3); see §17d.3 for loading v1 saves. New markings (§17c) need no bump.
13.4 **Loading a v1 save** (PROPOSED DEFAULT; same rules as §17d.3):
- Every cat gets `litterId: null`, `pregnancy: null`, `generation: 1` and `history: []` when absent.
- `birthAbsDay` = first day of the save's current season − `ageSeasons` × 20. It counts back from the save's current season, not from run start. Example: a save at absDay 50 is in autumn of Year 1 (season starts on day 41), so a cat aged 12 gets 41 − 240 = −199.
- `genes.v` is rewritten from 1 to 2. No allele, genotype or personality value changes (v1 alleles are a subset of v2, §17a.3).
- `aptitude` when absent: skills §6.1, rolled once on load from a stream seeded by `catId`. Premade slots use Saga's authored values (default 100 per branch). The player's own cat uses the creator roll, Normal(100, sd 5). Any other cat rolls Normal(100, sd 8). All are rounded half up and clamped 80–120. (Skills §13.3 is cub inheritance from parents; it doesn't apply on load.) `aptitudeTaught` is 0 per branch.
- `inheritOnly` when absent: `{}`, the empty form of the §13.1 map (traitId → `"shows"` / `"carries"`). If achievements §3.5a ships, premade slots take their §3.5a.5 entries on load and the player's founder rolls §3.5a.6 once (seeded by `catId`).
- `frail` when absent: `false`.
- Pride: `overcrowding: { seasonsOver: 0, lastCheck: null }` (`lastCheck` = `{year, season}` once set). Pregnancies and litters start empty.
13.5 **Tunables** (`data/breeding.json`, new; existing keys stay in `genetics.json` / `lifecycle.json`):
| Key | Default | Tag |
|---|---|---|
| conception.chance | 1.0 | PROPOSED DEFAULT |
| pregnancy.days | 20 | ANNA-APPROVED (roadmap) |
| litter.weights (1..7) | 8/18/26/22/14/8/4 | candidate (sim S5 shape) |
| litter.traitStep | ±1 | achievements T19/T20 |
| pregnancy.hungerMult | 1.0 (1.2 candidate, off) | candidate, sim pending |
| lifecycle.stageStart.adolescent | 4 (unchanged) | ANNA-APPROVED 2026-11-27 (§17b) |
| lifecycle.stageStart.adult | 8 (was 12) | ANNA-APPROVED 2026-11-27 (§17b) |
| overcrowd.capacityPerRegion | 4 | candidate (sim overcrowding v0.1) |
| overcrowd.countsCubs | true | candidate (sim overcrowding v0.1) |
| overcrowd.contentmentStep (× `seasonsOver`) | −5 | candidate (sim overcrowding v0.1) |
| overcrowd.contentmentMax (per season) | −20 | candidate (sim overcrowding v0.1) |
| overcrowd.playerSpringGate | `"atOrUnder"` (no conception while over capacity) | APPROVED, Director 2026-11-27; value candidate (sim overcrowding v0.1) |
| overcrowd.aiSpringGate | `"room"` (a litter only if it fits under capacity) | candidate (sim overcrowding v0.1) |
| overcrowd.aiCrossPridePairChance | 0.5 per spring | candidate (sim overcrowding v0.1) |
| marking.faintstripeTigerMult | 0.5 | candidate (visual) |
| eyes.copperFallback | `gold` | APPROVED interim (Director 2026-11-27) |
| yearLengthDays | 80 | ANNA-APPROVED 2026-11-27 |

## 14. Portrait assembly for cubs, adolescents and elders
14.1 **Layered-v2 stack, bottom → top** (README): `coat_fill_<coat>` (with tiger stripes composited into the fill), `shading` (shared), `highlight` (shared), `mouth`, `nose`, `claws`, `sabers_teeth`, `lineart` (fixed), `eyes` (above lineart). This replaces genetics §2.3's stack when the art ships (genetics §0.2).
14.2 **Gene → layer** for any stage: coat → fill colour (§3); dilute → fill tint (§3.4); marking/intensity → tiger strength (§4); eyes/het → eye layer ids, `bu_*` on Black (§5); everything else → skipped until art exists (§6).
14.3 **Pose by stage** (lifecycle §6.2, `compositor.poseFor`/`loadPoseManifest` already fall back cub/adolescent → adult): cub → `portrait-<sex>-cub`, adolescent → `portrait-<sex>-adolescent`, adult → adult base, elder → adult base + `age_elder`. None of the cub, adolescent or elder art exists on layered-v2.
14.4 **Fallbacks** (genetics §2.7 rule, extended):
1. Missing pose folder → the adult pose of the same sex (existing code). A **cub shown on the adult lineart is wrong**, so PROPOSED: the profile adds Saga's stage word and the portrait is drawn at a smaller scale (Ochre to confirm). Q17.12.
2. Missing gene layer (spotted, rosette, dorsal, white, undercoat, overlays, `age_elder`) → skipped, logged once per session. The gene stays in the save, and the look appears when the art lands, with no data change.
3. Missing colour (Ash coat, copper eyes) → nearest art: Ash → Gray fill and Gray stripe settings; copper → `gold` (§17a.3).
4. Untintable layer (`sabers_teeth`) → drawn in its own colour; saber gene ignored (Q17.5).
14.5 The current in-game art (`assets/portraits/portrait-{male,female}`, old base) **does** have spotted, rosette and faintstripe masks, undercoat, rim and sheen. They don't fit the new lineart. Whether Ochre refits them or paints new ones is Q17.1.

## 15. Saga hooks (fact ids; no copy here)
| Fact / moment id | When | Payload |
|---|---|---|
| `pregnancy_known` | on `conceivedAbsDay` (a spring day) | dam, sire, litter size band (few / several / many), no digits |
| `pregnancy_progress` | once, at `conceivedAbsDay` + 10 | dam needs state |
| `litter_born` | on `dueAbsDay` = `conceivedAbsDay` + 20 (a summer day) | litterId, cubIds, sexes, standout looks (rare tier, odd eyes) |
| `cub_naming` | after `litter_born` | cubId; player names or accepts Saga's suggestion (names list §3 of world-gen) |
| `litter_lost` | dam dies before `dueAbsDay` | dam, sire |
| `cub_died` | any cub death | cause (starving, illness, threat, natural) |
| `cub_first_play` | first `cub_play` scene | relationships `cub_play` |
| `cub_taught` | each teaching tick | branch, teacher |
| `stage_up_adolescent` | cub → adolescent ("mature looks") | cubId |
| `first_hunt` | adolescent's first learner hunt | outcome |
| `stage_up_adult` | adolescent → adult | cubId; playmate → friendship conversions (relationships §1.4) |
| `stage_up_elder` | adult → elder | catId |
| `fertility_ended` | crossing `fertileUntil` | catId |
| `overcrowded` / `overcrowding_eased` | §11.5 | members, regions (as words) |
| `heir_named` | heir switch | heirId, generation |
| `natural_death` | lifecycle §4 death | catId, stage |
Personality, inheritance and looks reach narration as words and tags only (ux-redesign §3.7). Offline fallback lines are needed for every id above (Saga's library).

## 16. Build checklist (Flint) and tests (Tracker)
16.1 **Flint, in order** (branch + PR, no merge to master, no release without Anna's OK):
1. `breeding.js` (pure): `inheritGenes(sire, dam, rng)` per genetics §3 incl. mutation and fresh `eyeRight`; `inheritPersonality` §8.1; `inheritAptitude` §9.1; `inheritOnlyRoll` per achievements §3.5a; `kinship`/`r` per genetics §5; `inbreedingPenalty(r, style)`.
2. `lifecycle.js`: season tick, `lifeStageFor` from `stageStart` data, fertility, natural death with Style and inbreeding multipliers.
3. Conception on the pair's spring day together (§1.2), pregnancy record with `conceivedAbsDay`, litter roll with trait steps, birth on `dueAbsDay` = `conceivedAbsDay` + 20.
4. Cat creation for cubs (§13.1 fields), relationship seeding (family +40 parent/child, +30 siblings, relationships §1.5).
5. Needs for cubs/pregnancy, nursing, feeding order, Cub-sitter, starvation hook.
6. Teaching / cub training order (skills §6.3).
7. Overcrowding check and spring gates (§11.5, §17e), behind their tunables.
8. Heir pick incl. Sandbox path (§12).
9. Save v2 + migration (§13.3–13.4).
10. Compositor: layered-v2 mapping (§3–§5, §14), `bu_*` swap, tiger strength, fallbacks with one log per session.
11. Saga hook emission (§15).
16.2 **Tracker checks** (testable):
1. **Mendel:** for each locus, 100k cubs from fixed genotypes match the Punnett ratio within ±1 point (e.g. melan/tawny × melan/tawny → Black 25%).
2. **Population shares:** 20k founders → phenotype shares within ±1 point of genetics §1; after 10 random-mating generations within ±3 points (*sim S1*).
3. **Mutation rate:** 0.5% ± 0.05% per locus per cub over 1M cub-loci.
4. **Odd eyes:** `eyeRight` ≠ left on every het/het cub, null otherwise; odd × odd ≥ 99% odd.
5. **Personality:** 1M cubs of 89 × 50 → P(≥ 60) 89.4% ± 0.3, P(≥ 70) 50.0% ± 0.3; values are integers 0–100.
6. **Aptitude:** cub values within 80–120; mean of 100k = parent average ± 0.2.
7. **Fertility and gates:** no conception with a cub/adolescent, r ≥ 0.125, `breeding: false`, female > 44 or male > 48 seasons, or an already-pregnant dam.
8. **Timing:** over 200k rolls, conception on any spring day d (year-day 1–20) gives birth on d + 20, always a summer day (year-day 21–40); litter size 1–7; 200k rolls match §2.2 weights ± 0.5; `fertile` / `small_litters` shift one step.
9. **Stages:** stage derived from `stageStart` data; changing the data changes stages with no code change.
10. **Deaths:** cub death per season 4% × Style × inbreeding ± 0.3 over 100k cub-seasons.
11. **Save:** v1 save loads as v2 with the §13.4 / §17d.3 defaults; `genes.v` reads 2 and no allele changes; `birthAbsDay` counts back from the save's current season; v2 round-trips byte-stable.
12. **Portrait:** every coat × marking × eye combo composes without error; missing layers log once; Black uses `bu_*` where it exists; Ash renders with the Gray fallback.
13. **Copy:** no digits in any player-facing string from §15 hooks (regex `[0-9]` on rendered text); personality and odds shown as words.
14. **Heir:** with only cubs alive, Heir mode ends on Legacy; Sandbox follows §12.5.

## 17. Open questions (Director / Anna)
17.1 **[CLOSED: §17a.2, §17c.]** **Markings on the new base.** Only tiger stripes exist on layered-v2. Spotted (43.8% of cats) and rosette (14.0%) have no art, so 57% of cats would show no pattern. Options: (a) Ochre paints spotted/rosette on the new base; (b) retire them and make tiger a new allele (genes.v 2, needs Anna's frequency); (c) proposed default: barred → tiger, faintstripe → faint tiger, spotted/rosette fall back to plain until art lands. Also: the creator offers spotted, which has no art.
17.2 **[CLOSED: §17b, ANNA-APPROVED.]** **Growth timeline.** The roadmap (cubs S3 → adolescents S4) needs a 1-season cub stage; lifecycle has 4. And S3 births are autumn, while the 2026-11-05 ruling says births only in spring or summer. Proposed: adolescent at 1 season and birth on day 1 of S3. Which ruling wins? (This also changes world-gen cub slots aged 3 and the weaning rule.)
17.3 **[CLOSED: 80 days, ANNA-APPROVED.]** **Year length.** With `yearLengthDays` null, only one litter per run is possible, so "then the loop repeats" can't happen. formulas §2.4 already says "waiting a year (80 days)". Confirm 80?
17.4 **[CLOSED: §17a.3.]** **Eye colours.** Copper has no art; brown, red and gray have art but no allele. Map copper → brown? Add brown/red/gray as alleles (new frequencies), or keep them creator/Sandbox-only? Is `bu_*` meant for Black only?
17.5 **[CLOSED: §17a.4.]** **Saber tint.** `sabers_teeth` is fixed colour on layered-v2. Should the saber gene (ivory/cream/stained) and the elder stain tint it?
17.6 **Litter size.** Approve the candidate 1–7 weights (mean about 3.6)? Should food or the dam's age change it?
17.7 **Dilution and other coat genes on layered-v2.** Is a diluted fill acceptable on the per-coat shading, and does Ochre plan undercoat, white, ticking, points, mask, tear and dorsal masks for the new base?
17.8 **Personality spread.** Random mating narrows sd 15 → 11.5 in about three generations (fewer extreme cats). Keep sd 8, or raise it?
17.9 **[OPEN, Tracker confirmed unreachable; no code until answered.]** **Inbreeding penalty is unreachable.** Mates need r < 0.125, but the Sim penalty starts at r ≥ 0.25. Keep it as dead code (and the storyteller hint), lower the threshold, or drop it?
17.10 **Cub training.** Cubs earn no XP (skills §5). Is "training" in S3 the teaching pick, or should cubs earn some XP?
17.11 **Heir with only cubs.** End on Legacy (current rule), or skip time until a cub is adolescent? And what exactly does Sandbox "no game over" do here?
17.12 **Young-cat art.** No cub, adolescent or elder art on layered-v2. Until then a cub draws on adult lineart. Acceptable as a stopgap, or hide the portrait?
17.13 **[ANSWERED: §17e rules APPROVED, Director 2026-11-27 as the default; numbers candidate (sim overcrowding v0.1); Anna may overrule.]** **Overcrowding.** Approve capacity 4 per region and −5 contentment per season, or name the effect you want? Default: capacity 4 per region held (cubs count); contentment −5 × `seasonsOver`, max −20 a season; the player's pride doesn't conceive while over capacity (APPROVED, Director 2026-11-27).
17.14 **[ANSWERED: §17e.4 rules APPROVED, Director 2026-11-27 as the default; numbers candidate (sim overcrowding v0.1); Anna may overrule.]** **AI-pride breeding.** How do AI prides breed so they neither explode nor die out? Default: room-limited spring gate against capacity 4 × regions held, plus cross-pride pairing at 0.5 a spring for females with no unrelated partner at home. Needs a rule owner for cross-pride pairing (relationships-spec).

### 17a. Director's interim defaults (APPROVED by Director 2026-11-27; 17a.1 year length is ANNA-APPROVED; Q17.2 is closed by §17b)
17a.1 **Year length (overrides §1.4, Q17.3), ANNA-APPROVED 2026-11-27 (via Director):** `yearLengthDays` = 80 (4 seasons × 20 days, formulas §2.4). One mating window per year, so a female can have a litter every year and the loop repeats. Code reads it from data; don't hard-code it.
17a.2 **Spotted and rosette (overrides §4.2, §4.5, Q17.1):** both render as the tiger layer at their intensity strength (§4.3), the same as barred. Genotypes stay unchanged in the save, so real art can replace this later without touching any cat. Fallback share for markings drops to 0; the creator's "spotted" shows tiger on layered-v2. No new art until Anna asks for it.
17a.3 **Eyes (overrides §5.2, Q17.4):** copper renders as `gold` (`bu_gold` on Black). New alleles `brown`, `red`, `gray` join the §1.7 series so existing art can appear. Dominance: amber > gold > brown > copper > green > red > gray > blue. Frequencies **candidate, sim pending** (Hardy-Weinberg shares in brackets): amber .34 (56.4%), gold .22 (24.2%), brown .10 (7.8%), copper .08 (4.8%), green .12 (4.8%), red .04 (1.0%), gray .04 (0.6%), blue .06 (0.4%). Black coat uses `bu_brown`, `bu_red`; gray has no bu variant and uses `gray`. Genotype version `genes.v` → 2; v1 genes keep their alleles (no remap needed). Odd-eye reroll (§5.4) draws from these shares. Tracker check 16.2.1 covers the new loci.
17a.4 **Sabers (Q17.5):** saber colour and elder stain stay in the genes and save, data only. `sabers_teeth` draws in its own colour; nothing tints it yet.
17a.5 **Order:** Flint builds councils first; §16 comes after, on a branch. Ochre's §14 layers fall back as listed; nothing new is drawn until Anna asks.

17a.6 **Saga §15 copy calls (Tundra minor calls, 2026-11-27):** (1) litter words: 1 "a cub", 2–3 "a few", 4–5 "several", 6–7 "many". (2) Player is the dam and dies pregnant: one `litter_lost` line, then the normal death-rule flow (heir/permadeath); it never replaces it. (3) Story retirement gets its own hook `story_retire`; death lines never fire for it. (4) Rare coats read "a rare coat"; lines don't name coats. (5) `{needsWord}` = worst need at `critical`/`empty` (needs §1.6a), in order Health "worn", Thirst "thirsty", Hunger "hungry", Energy "tired", Warmth "cold"; else "well enough". (6) Overcrowding uses the general line; an optional region word from the `overcrowded` payload may be used, with the general line as the fallback.

### 17b. Growth timing, ANNA-APPROVED 2026-11-27 (via Director; closes Q17.2; adulthood counted from birth confirmed by Anna 2026-11-27)
17b.1 **Stages (overrides §10.2, lifecycle §2 table and §7):** `stageStart` cub 0, adolescent **4**, adult **8** (was 12), elder 40. A cub is a cub for 4 seasons and an adolescent for 4 more. The 1-season cub proposal in §10.2 is withdrawn. Player start age 12 (ANNA-APPROVED) is unchanged and still adult. Fertility starts at adult (8) and ends where it did (F 44 / M 48). Elder age and death rates don't move. Data only (`lifecycle.json`); §16.9 already checks that stages follow the data. **Adulthood is 8 seasons counted from birth** (ANNA-APPROVED 2026-11-27 via Director); the "adult at 12" alternative is withdrawn.
17b.2 **Births stay spring/summer (fixes the §2.1 clash; lifecycle §1.2 and formulas §7.2 win):** conception happens on the day a mated pair is together during spring. That's the day they pair if it's in spring, or day 1 of spring for a pair already mated. Pregnancy stays 20 days, so birth is on a summer day (earliest day 21 of the year, latest day 40). A pair that mates after spring waits for the next spring. With the 80-day year (§17a.1) that's year-day 1–20 of each year. This replaced the old fixed spring-end conception check and fixed autumn birth day (§1.2 and §2.1 now state this rule). The roadmap's "S2 pregnant, S3 cubs born" is read as story chapters, not calendar seasons. `litter_lost` (§2.5) fires if the dam dies before her birth day.
17b.3 **Heirs (overrides §12.2):** a cub becomes heir-eligible when it turns adolescent, 4 seasons after birth. A run whose only living kin are cubs still follows Q17.11 (open).
17b.4 **What it takes off the table:** world-gen cub slots aged 3 (`hc10`, `bf09`) stay cubs, so no relabel is needed (§10.2's bullet is void). Two adolescent slots at age 8 (`hc09`, `mw08` in `world-slots.json`) would now read as adults. They are set to 7 so they stay adolescents and the lore holds (data only; Flint confirmed at 9de250e that 7 works, and the committed `world-slots.json` still reads 8 until that data change lands). Under the confirmed ruling the value 7 stays as is; no other premade slot changes.
17b.5 **Tracker checks (adds to §16.8–16.9):** births only ever land in spring or summer over 200 simulated years; conception dates fall only in spring; a cub turns adolescent at exactly +4 seasons and adult at +8; `hc09`/`mw08` show as adolescent at run start.

### 17c. Markings stay open-ended (Anna via Director 2026-11-27: more markings are coming; the §17a.2 tiger fold is a temporary fallback)
17c.1 **Data, not code:** the `marking` locus and every overlay locus are read from `genetics.json` as a list of alleles, each with `id`, founder `freq`, `rank` (dominance, lower wins), `tier`, `layer` (portrait layer id or null) and `fallback` (layer to draw while art is missing; spotted and rosette use `tiger` per §17a.2). Adding a marking means one new list entry plus Ochre's mask, with no code change. Unknown ids in a save draw the fallback, never crash.
17c.2 **Saves never remap:** a cat keeps its allele ids forever. When art lands, existing spotted and rosette cats just start drawing their own layer. New alleles enter only through founders of new runs and through mutation (genetics §3.2), and frequencies are re-normalised with a sim before any ship (candidate, sim pending).
17c.3 **One body pattern per cat (genetics §1.10) stays:** things that cover the whole body are `marking` alleles; things that stack (face, legs, ears, back) are their own overlay loci.
17c.4 **Suggested new markings, for Anna to pick (names are Saga's; all candidate, no frequencies yet):** body patterns: *clouded* (large dark-edged blotches), *flecked* (fine scattered dots), *marbled* (swirled bands), *saddle* (dark back fading to plain flanks). Overlays: *leg bars* (bars on forelegs only), *cheek marks* (stripes from eye to jaw), *ear spots* (pale spot on the back of each ear). Already in genetics v0.4 but with no layered-v2 mask yet: dorsal, ticking, points, facial mask, tear lines, undercoat. No tail rings (bobtail).
17c.4a **Labels (Saga 2026-11-27):** names per Saga's list (Clouded, Flecked, Marbled, Saddleback; Barred legs, Cheek marks, Ear spots; Back stripe, Ticked, Dark points, Masked, Tear marks, Light underside). A marking's label follows the layer actually drawn, so a spotted cat drawn with the tiger fallback reads "Tiger" until spotted art exists.
17c.5 **Tracker check:** add a dummy allele to the data in a test build; it appears in founders and mutation, draws its fallback, and old saves load unchanged.

### 17d. Tracker breeding check fixes (Tundra, 2026-11-27)
17d.1 **Living-cubs gate dropped (fixes the yearly-litter contradiction).** With summer births and a 4-season cub stage, "no living cubs" blocks every other year, which breaks Anna's yearly loop (§17a.1). A female can conceive each spring if she isn't already pregnant. Tracker's sim: a founding pair reaches a median of about 25 cats in 10 years (14 with the gate). Overcrowding (§11.5) is the brake, so its numbers (Q17.13) need a sim against this growth before any ship. This is a design call and Director may overrule it.
17d.2 **[Superseded by §17e.3–17e.4 (v0.1f).]** **AI-pride breeding (new open item Q17.14):** with every fertile female breeding yearly, Tracker's stress run hits about 248 cats per pride in 10 years. Interim rule from v0.1d, now replaced: AI prides conceived only while at or under capacity, and the player's pride had no gate. Current rule (APPROVED, Director 2026-11-27): the player's pride doesn't conceive at a spring check while over capacity (§17e.3); AI prides use the room-limited gate plus cross-pride pairing (§17e.4).
17d.3 **Loading a v1 save:** `genes.v` is rewritten to 2 and no allele changes (v1 alleles are a subset of v2). `birthAbsDay` = start day of the current season − `ageSeasons` × 20 (counted back from the save's current `absDay`, not run start; replaces §13.4's formula). New fields when absent: `aptitude` per skills §6.1 founder rules as in §13.4 (rolled once on load, seeded by catId; §13.3 is cub inheritance and doesn't apply), `aptitudeTaught` 0 per branch, `inheritOnly` `{}` (the empty traitId → "shows"/"carries" map, §13.1), `frail` false. Overcrowding state on the pride: `overcrowding: { seasonsOver: 0, lastCheck: null }` (`lastCheck` = `{year, season}`).
17d.4 **Open questions still open:** Q17.6, Q17.7, Q17.8, Q17.9, Q17.10, Q17.11, Q17.12. Answered by default (v0.1f, §17e): Q17.13, Q17.14. Closed: Q17.1 (§17a.2/§17c), Q17.2, Q17.3, Q17.4, Q17.5 (§17a.4).


### 17e. Overcrowding sim (Tundra, 2026-11-27; answers Q17.13 and Q17.14 by default)
Sim: `sim/overcrowding_sim_v0.1.py` (output `sim/overcrowding_sim_v0.1.out`), seed base 20261127, 500 seeds per row, 20 years (year-10 figures come from the same runs). Figures are median (p10–p90). Every number below is **candidate (sim overcrowding v0.1)** unless tagged otherwise.

17e.1 **Rules used as written:** 80-day year (§17a.1); stages 4 / 8 / 40 (§17b.1); conception each spring, birth in summer (§17b.2); no living-cubs gate (§17d.1); litter weights (§2.2); Standard deaths (§10.5); incest gate r < 0.125 for every mates bond (relationships §1.7); AI pairing only in spring (formulas §2.4); contentment inputs (loners §6.4, relationships §5.1; born cats `prideLoyalty` 70, recruits 50, loners §3.4); start contentment 60 (world-gen §7.1); Standard leaving below 25 (2 seasons, then a warning season, then 30% a season, relationships §5.3 multipliers); mate and heir protected; Sim rules as loners §6.4; world drift 5% exile and 8% loner rejoin (loners §6.1–6.2). Assumptions the sim had to make (no rule exists) are listed in the script header as C1–C11. The two that matter most: the player's pride gains at most one outside mate per spring (chance 0.5, C2), and the player claims a new region once the pride has been over capacity for 2 seasons (chance 0.5 a season, up to 7 regions, C4).
**Calibration:** with no capacity, a founding pair whose cubs never find mates gives a median of 26 (20–32) cats at year 10. Tracker's figure is 25 (to 31). AI prides with Tracker's stopgap inputs and the §17d.2 gate give year-10 medians 25 / 18 / 16, max 59. Tracker's DELTA-v0.1e figures are 27 / 19 / 16, max 61. With no gate the sim gives 1084 / 1031 / 1039 against Tracker's 1034 / 1004 / 1017.

17e.2 **Capacity (Q17.13):** 4 pride members per region held, cubs included. "Held" means the pride is the region's `holder` in map-v1 §9 (a held region under contest still counts; wild regions and other prides' regions don't). It's recomputed at each season check, so gaining, losing or being pushed off a region moves capacity at the next check. Contentment: at a check over capacity, `seasonsOver` +1 and each adult gets −5 × `seasonsOver`, capped at −20 a season. At or under capacity, `seasonsOver` resets to 0.

17e.3 **Player's pride: a birth brake is needed (APPROVED, Director 2026-11-27; changes §17d.2's "the player's pride has no such gate").** At a spring check where members are over capacity, no pair in the player's pride conceives. Pairs at or under capacity all conceive, so one spring's litters can push the pride over (that overshoot is the pressure).
Why: contentment alone can't stop growth. The happiest cats are the breeding pairs (fed +10, mate +10), so they never come near the leaving threshold. Without the gate, with flat −5 and an expanding player, the pride reaches 67 (40–97) by year 10 and 715 (181–1691) by year 20. A stacking −5 penalty capped at −30 still leaves 236 (43–862) at year 20 on 1 region, with about 97 cats leaving per run. Evidence for the recommended set (gate on, capacity 4, −5 stacking, max −20, Standard):
| Start regions | Player | Size y10 | Size y20 | First over (year) | First warning (year) | Warning by y10 | Cats leaving / 20 y | Ends below half capacity |
|---|---|---|---|---|---|---|---|---|
| 1 | holds | 7 (5–10) | 5 (0–8) | 1.2 | 7.0 | 72% | 1.5 | 27% |
| 2 | holds | 11 (9–14) | 10 (6–15) | 3.2 | 7.2 | 91% | 2.8 | 6% |
| 3 | holds | 14 (12–19) | 15 (11–21) | 4.2 | 8.0 | 94% | 4.0 | 1% |
| 1 | expands | 32 (26–39) | 34 (26–47) | 1.2 | 12.8 | 8% | 3.8 | 0% |
| 2 | expands | 32 (26–40) | 33 (26–48) | 3.2 | 12.5 | 12% | 3.8 | 0% |
| 3 | expands | 32 (27–39) | 32 (26–47) | 4.2 | 12.0 | 19% | 4.2 | 0% |
So a pride that holds its land is overcrowded within 1–4 years and shows the first warning signs about 4–6 years after that, sheds 1 to 4 grown cats over 20 years, and doesn't collapse. In 1% of runs or fewer did a third of the adults leave within 4 seasons. The only low ends are 1-region prides, which can't hold more than four. A player who keeps claiming land grows to 7 regions by year 10, and warnings stay rare.

17e.4 **AI prides (Q17.14), pinned inputs:** starting rosters Highcrag 11, Bonefield 10, Mistwood 9 (`world-slots.json` at 9de250e, world-gen §2.4; the old "13 each" counted the 9 loners). Starting mates hc01–hc03, hc02–hc06, bf01–bf04, mw02–mw04 (world-gen §2.4). Starting claims from map-v1 §4.2: Highcrag 4 (counting disputed `greywater_ford`, startHolder Highcrag), Bonefield 3, Mistwood 3, so capacity starts at 16 / 12 / 12. Capacity = 4 × regions currently held, recomputed at each season check (§17e.2), so councils and skirmishes move it. Cubs count.
Recommended (candidate): (a) **room-limited spring gate.** Pairs go in random order, and a pair conceives only if members + cubs already conceived that spring + its rolled litter (§2.2) stay at or under capacity. (b) **Cross-pride pairing.** In spring, a fertile unmated female with no unrelated partner at home pairs, at 0.5 chance, with an unrelated unmated fertile male from another pride or the loner pool, and he moves to her pride. This is new behaviour with no rule yet; relationships-spec would own it.
| AI rule (cap 4, start claims 4/3/3) | y10 HC / BF / MW | y20 HC / BF / MW | In 8–20 at y20 | Below 6 at y20 | Max |
|---|---|---|---|---|---|
| **Room gate + cross-pride 0.5 (recommended)** | 14 / 10 / 10 | 14 / 10 / 10 | 97 / 83 / 82% | 2 / 11 / 12% | 21 / 18 / 18 |
| same, all prides at 4 regions (councils 10-year median) | 14 / 14 / 14 | 14 / 14 / 14 | 97 / 95 / 96% | 2 / 4 / 3% | 21 / 23 / 23 |
| §17d.2 whole-pride gate + cross-pride 0.5 | 25 / 16 / 17 | 20 / 14 / 14 | 35 / 52 / 61% | 16 / 28 / 23% | 51 / 39 / 40 |
| §17d.2 gate, Tracker stopgap (every fertile female breeds) | 25 / 18 / 16 | 21 / 15 / 13 | 34 / 54 / 40% | 13 / 20 / 39% | 59 / 56 / 51 |
| Room gate, no cross-pride pairing | 14 / 9 / 9 | 9 / 5 / 4 | 57 / 28 / 15% | 27 / 55 / 69% | 20 / 16 / 16 |
| No gate (stopgap) | 1084 / 1031 / 1039 | births cut off at 1500 | 0% | 0% | 4179 |
The §17d.2 whole-pride gate is bounded but swings: every female conceives in the spring the pride is under capacity, so it overshoots to about twice capacity and then drains. The room gate holds each pride just under capacity. Without cross-pride pairing, the incest gate starves closed prides of mates and they die out over 20 years.

17e.5 **Alternatives tried** (2 regions unless noted):
- **Flat −3 / −5 / −8 (the old candidate):** no warning sign by year 10 in 99% or more of runs, with or without the gate. Under loners §6.4 a fed pride cat gains at least +14 a season (fed +10, born loyalty +4), so a flat −8 or less never pulls contentment down. These values give no felt pressure.
- **Stacking step −3 / −5 / −8 (max −20):** results are almost the same. With the player expanding, warnings by year 10 run 5 / 12 / 23%. −5 is the middle.
- **Stacking max −15 / −20 / −30 / −50 (gate on):** a pride that holds 2 regions shows warnings by year 10 in 30 / 91 / 100 / 100% of runs, and loses 0.4 / 2.8 / 13 / 19 cats over 20 years. At −30 and −50, a third or more of the adults leave within 4 seasons in 72% and 99% of runs. −20 is the fair point.
- **Capacity 3 / 4 / 5 per region (recommended penalty):** a pride that holds 2 regions sits at 9 / 11 / 12 at year 10. With the player expanding it reaches 25 / 32 / 38 by year 10. For AI prides with the room gate, capacity 3 leaves Bonefield and Mistwood at about 6 by year 20 (about half of runs below 6), and capacity 5 holds them at 18 / 13 / 13. 4 keeps AI prides in the 8–20 band and still leaves room for founding cubs on 2 regions.
- **Other player gates:** the room gate makes the player's pride almost never overcrowded (5–22% of seasons) and stalls it at about 8 cats. The soft gate (chance (capacity / members)², C10) lets an expanding pride reach 65 (44–86) by year 20.
- **Sensitivity at the recommended set (2 regions, pride holds / expands):** if cubs don't count, size is 12 / 34 at year 10. Answering 2 warnings a season changes little (1.9 / 3.2 cats leave). Sim Style loses 6.6 / 16.2 cats over 20 years, dispersal included. With an outside-mate chance of 0, 0.25 or 1.0, a pride that holds sits at 9 / 10 / 13 at year 10. With no outside mates at all, about half of prides end below half capacity, because siblings can't mate. Under the **level reading** of contentment (C6), the recommended set gives no warnings by year 10.

17e.6 **Rule gaps found (Director / Anna):**
1. **Contentment has no decay or baseline** (loners §6.4; needs §1.6 "no decay"). Read literally, a fed pride cat climbs to 100 and stays there, so any small per-season penalty is invisible. The recommendation assumes this literal accumulator reading. If contentment is meant to be recomputed each season, the stacking cap would need to be much larger to show any pressure (not simmed). Loners-spec needs one line saying which reading is meant. **Interim rule (APPROVED, Director 2026-11-27): contentment stays put (no decay or baseline) until Anna rules; Director is taking the question to her.**
2. **No AI rule brings outside mates into a pride.** With r < 0.125 and in-pride pairing only, AI prides die out in 20 years (§17e.4). Cross-pride pairing is candidate here and needs an owner.
3. **The player's adult cubs need outside mates too.** The founding pair's cubs are all siblings, so the pride's growth is set by how many mates the player brings in (loners recruiting / courtship). No rate exists; the sim assumed 0.5 a spring.
4. **AI pairing chance and attraction** aren't specified for world drift (relationships §5.2). The sim pairs every eligible cat each spring as an upper bound.
5. **Contested regions (closed, Flint 2026-11-27):** map-v1 stores no contested field. `worldmap.js` derives it from claims (`contested` with `disputedBy` when the second claim is ≥ `contestMin` 30 and within `contestGap` 20 of the leader, `map.json`). The leader stays `holder`, so a contested region still counts toward its holder's capacity, as §17e.2 says.

17e.7 **Tracker checks (add to §16.2):** capacity follows regions held at the next season check after a gain or loss; `seasonsOver` resets at or under capacity and the penalty never exceeds −20; with the player gate on, no player-pride conception happens at a spring check while over capacity; AI room gate: no spring's conceived litters push the pride over capacity; 500-seed rerun of `sim/overcrowding_sim_v0.1.py` on Flint's engine stays within ±2 of the §17e.3–17e.4 medians.

## Changelog
- v0.1f (2026-11-27, Tundra): §17e overcrowding sim (`sim/overcrowding_sim_v0.1.py` + `.out`, 500 seeds × 20 years). Candidate (sim overcrowding v0.1): capacity 4 per region held (cubs count, recomputed each season check), contentment −5 × `seasonsOver` with a cap of −20 a season, player-pride spring gate (PROPOSED, changes §17d.2), AI room-limited gate with cross-pride pairing 0.5. Q17.13 and Q17.14 answered by default. §11.5 and the §13.5 `overcrowd.*` rows updated. Tracker DELTA-v0.1e fixes: AI inputs pinned (rosters 11/10/9, map-v1 claims 4/3/3); §13.4 rewritten to the §17d.3 rules (aptitude per skills §6.1, `inheritOnly` `{}`); §1.2 and §1.4 bodies rewritten; every fixed absDay-41 / absDay-20 timing replaced (§2.5, §13.1 example, §15 hooks, §16.1.3, §16.2.8, §16.2.11); Q17.1 and Q17.5 marked closed; §17a header updated. Backup `breeding-cubs-v0.1e.bak.md`.
- v0.1f.2 (2026-11-27, Tundra): Tracker DELTA-v0.1f fixes: §17d.2 body now states the replaced interim rule and the current one; §17d.3 aptitude cites skills §6.1 and `inheritOnly` is `{}`; "contentment stays put" interim rule added to §17e.6.1; §17e.6.5 closed with Flint's contested-region answer. Backup `breeding-cubs-v0.1f1.bak.md`.
- v0.1f.1 (2026-11-27, Tundra): Director approved the four §17e overcrowding rules as the default (capacity per region held, stacking contentment penalty, player spring gate, AI room gate with cross-pride pairing); tags updated in §1.2, §11.5, §13.5, §17e.3, Q17.13, Q17.14. Contentment decay goes to Anna; until then contentment stays put (§17e.6). Backup `breeding-cubs-v0.1f.bak.md`.
- v0.1f (2026-11-27, Tundra): Anna confirmed (via Director) that adulthood is 8 seasons from birth; §17b says so, the adult-at-12 alternative is withdrawn, and hc09/mw08 at 7 stay as they are.
- v0.1e (2026-11-27, Tundra): §17d fixes from Tracker's breeding check: living-cubs gate dropped for yearly litters; AI prides conceive only at or under capacity (Q17.14, sim pending); v1-save loading rules and missing defaults; §2.1 birth = conception + 20; stale §1.2, §1.4, §10.2, §14.4.3 and the question list marked. Backup `breeding-cubs-v0.1d.bak.md`.
- v0.1d (2026-11-27, Tundra): year length now ANNA-APPROVED; §17c keeps markings data-driven and lists suggested markings for Anna. Backup `breeding-cubs-v0.1c.bak.md`. §17c.4a logs Saga's labels.
- v0.1c (2026-11-27, Tundra): §17b folds in Anna's growth ruling (adolescent 4, adult 8) and fixes the birth-season clash (conception in spring, birth in summer). Backup `breeding-cubs-v0.1b.bak.md`.
- v0.1b (2026-11-27, Tundra): §17a.6 logs answers to Saga's six §15 copy questions. Backup `breeding-cubs-v0.1a.bak.md`.
- v0.1a (2026-11-27, Tundra): folded in Director's interim defaults as §17a (year 80 days, spotted/rosette → tiger, copper → gold, brown/red/gray eye alleles with candidate frequencies, sabers data-only). Q17.2 growth timing is with Anna. Backup `breeding-cubs-v0.1.bak.md`.
- v0.1 DRAFT (2026-11-27, Tundra): first consolidation for Director's assignment. Sim `sim/breeding_sim_v0.1.py` (+ `.out`): Mendelian shares and drift, layered-art fallback share, cross tables, personality example and drift, litter-size table, pride growth vs territory. No existing spec edited.
