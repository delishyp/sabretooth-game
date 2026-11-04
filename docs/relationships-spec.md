# Sabretooth: Relationships & Pride Scenes Spec (v0.1.4, DRAFT, design-only)
Owner: Tundra (rules and numbers). Scene format, text and AI contract: Saga (`scene-format.md` v0.1). Portraits and expressions: Ochre. Code: Flint. QA: Tracker.
Ask: Anna via Director, 2026-11-04. Visual-novel-style pride scenes where cats have their own friendships, rivalries, crushes, mates, grudges and family bonds.
Related:
- loners-spec v0.8: §2.4 affinity, §3.4 prideLoyalty, §4 mates, §5 rivals, §6.4 contentment, §10.7 confront.
- needs-spec v0.1 (Mood = contentment).
- lifecycle-spec v0.1 §2.
- world-gen-spec v0.3.1: kin links, random personality, r < 0.125.
- skills-spec v0.2: Social and Courtship perks.
- play-styles-spec v0.2.

All numbers are starting values to tune. Where this spec and scene-format disagree, this spec wins on numbers, ids and tags.

## 0. Ground rules
0.1 **One system.** The loners-spec §2.4 `affinity` **is** the pair value defined here; there's no parallel number. `affinityToPlayer` becomes a read of `rel(cat, player).value`. Every existing affinity rule and skill perk (groom +5, share +10, drift, `old_friends`, `two_hearts`…) now reads and writes this value.
0.2 Pairs are **unordered and symmetric** in value. Asymmetry lives only in **flags** (a crush has a holder, a grudge has a holder and a target).
0.3 Values are integers in −100..+100. Every change is rounded half up, then clamped.

## 1. Pair record and bands
1.1 **Record** (sparse; only pairs that have interacted are stored):
```json
{ "a": "c_01", "b": "c_02", "value": 12, "kinds": ["friendship"],
  "flags": { "crush": ["c_01"], "grudge": [], "rivalSince": null, "matesSince": null },
  "lastContactDay": 412, "createdDay": 300 }
```
   `a` < `b` (sorted catIds). The pair key is `a|b`.
1.2 **Never-met default:** an unstored pair reads as value **0**, kinds [], `met: false`. Kin pairs are seeded at creation (§1.5), so they always exist. The first interaction stores the pair. Existing first-meeting modifiers apply at that moment: loners §2.4 sociability/aggression ±10, `famous`, `first_impression`, `exile_friend`.
1.3 **Bands** (value): `hostile` ≤ −50, `cold` −49..−15, `neutral` −14..+14, `warm` +15..+49, `close` ≥ +50.
   Band names are **internal ids only**. Player-facing labels come from Saga's `game-copy.md`.
   `isRival` (loners §5.1, aggression ≥ 70) is a **runtime check on the run's rolled personality**, not a fixed slot field. A lore cat may or may not be a rival in a given run, which is intended.
1.4 **Kinds** (a pair can hold several; scene `relType` uses these ids):

| Kind | Entry | Exit | Notes |
|---|---|---|---|
| `family` | r ≥ 0.125 (genetics §5) or a parent/child/sibling link | never | Floor +10 on value (§2.3). Cubs only ever get `family` and `playmate`. |
| `playmate` | both cubs, cub + adolescent, or both adolescents (Director, v0.1.3); same pride, value ≥ 15 | when the older cat turns adult, playmate turns into `friendship` if value ≥ 15 | Young-cat friendship tag |
| `friendship` | value ≥ 25 after ≥ 3 positive contacts | value < 10 | |
| `admiration` | flag held by a younger cat (adolescent or young adult) toward an adult or elder with value ≥ 20 and a skill rank ≥ 3 or leader role | value < 10, or the holder becomes the senior's peer (both adult, age gap ≤ 8) | One-sided, holder → target. No romance. |
| `rivalry` | value ≤ −15 and an `effect.rivalry_start` or a lost contest, both cats same sex or both adolescents | value ≥ 0 for 1 season | A milder version of hostility. Can coexist with friendship ("friendly rivals") only via scene effect. |
| `crush` | flag, holder → target. Both cats are adult or elder (lifecycle §2; adults 12+ seasons, so crushes begin at young adult), attraction-compatible both ways (§1.8), r < 0.125, neither already a mate of the other, target value ≥ 20. Holder rolls 10% per season, ×(1 + (holder sociability − 50)/100) | target becomes mate; value < 10; or 4 seasons with no contact | One-sided allowed; mutual = both hold it |
| `mates` | via loners §4 courtship / pride pairing; both adult or elder (breeding follows lifecycle §2.4 fertility; elders past it bond as non-breeding mates), attraction-compatible both ways (§1.8), r < 0.125, mutual crush or value ≥ 50 | value ≤ −15 for 2 seasons (bond break, §5.2), death, or a cat leaves the pride | Floor +20 (§2.3). Max 1 mate per cat. |
| `grudge` | flag, holder → target: set by `effect.grudge_start` (injured by target, mate stolen, exiled, lost a challenge) | value ≥ +15, or 8 seasons passed | Holder's value toward target can't rise above +14 while the grudge is held |

1.5 **Seeding at world gen** (world-gen §6): parent/child pairs start at +40 `family`, siblings at +30 `family`, and mates at +60 `mates`. Every other pair in the same pride starts at value round(Normal(10, 12)) with no kinds, and it's stored only if |value| ≥ 15. Loners' pairs with their origin pride follow loners §2.5 at the pride level, not per pair.
   - **Seeded history (v0.1.4):** world-gen §6.4 `seedFlags` apply here, after kin and mate seeds, in table order. Format: `{holder, target, kind, value, note}`.
     - `kind` is `grudge`, `rivalry`, `crush`, `admiration`, `friendship` or `none` (value only). `mutual: true` sets the kind on both cats (the table shows it as ↔). The value is always symmetric. A grudge sets the holder flag and caps the value per §1.4. A rivalry adds the kind with value ≤ −15.
     - `value`, if set, replaces the random seed but never goes below a floor: family stays ≥ +10, mates ≥ +20. Strained kin such as Sorrel and hc07 sit at +10 with the strain in text only.
     - Grudges, rivalries and value-only entries **always** seed. A `crush` seeds only if that run's attraction roll (§1.8) makes the pair compatible. `admiration` must meet its entry rule.
     - Every entry must pass §1.6–1.7, or it's dropped and logged.
1.6 **Age gate (Director):** no `crush` or `mates` kind or flag, and no crush/mates scene, if either cat is a cub or adolescent. Adolescents may only hold `friendship`, `admiration`, `rivalry`, `grudge`, `family` and `playmate` (with a cub or another adolescent). Cubs may only hold `family` and `playmate`. A violation is a hard reject in the validator.
1.7 **No incest:** `crush` and `mates` need r < **0.125** (world-gen §6.2). Kin above that can't enter romance by any path, including AI scenes and player courtship.

1.8 **Attraction (Anna via Director, v0.1.2).** Every AI cat has a hidden `attraction` trait, either `opposite`, `either` or `same`. It's rolled at birth, it's fully random (not inherited, not affected by personality) and it never changes.
   - **Split:** `opposite` 85%, `either` 10%, `same` 5%. So most cats are opposite-sex only, and about 1 in 7 can form same-sex bonds.
   - **Compatible:** cat X is compatible with cat Y if X is `either`, or X is `opposite` and Y is the other sex, or X is `same` and Y is the same sex. `crush` needs the holder to be compatible with the target. `mates` needs compatibility both ways.
   - **World slots:** the trait is rolled from `worldSeed` on its own `attraction` stream (world-gen §5.4), so names, genes and personality don't change. Slots with a fixed mate, and the §2.5 mate-guarantee candidates, can't be `same`: a `same` roll becomes `either`, so the fixed pairs and the mate guarantee hold. Kits born in play roll from the run RNG.
   - **Player cat:** has no trait and follows the player's choices. It can court any adult that is compatible with it. An AI cat that isn't compatible turns the courtship down gently (Saga text, tag `courtship_declined_attraction`), with no relationship loss and no grudge.
   - **Visibility:** the trait is hidden. The `read_affinity` perk also shows "could be interested in you: yes or no" for the target.
   - **Age:** the trait is stored from birth but isn't read until young adult (§1.6).
   - **Same-sex mates:** they form the normal `mates` bond, with the same floor, contentment, courtship, bond-break, leaving and heir effects, but `breeding: false`, so no cubs. Heir rules don't change (any pride member qualifies, menu §7). World drift only counts opposite-sex mates toward a pride's breeding floor.
   - **Save:** `attraction` is a per-cat field. It's not stored for the player cat.
   - **Scenes (Saga):** crush, courtship, mates, mates_strain and jealousy scenes must work for any pairing. They must not assume sex roles.

## 2. Change rules
2.1 **Sources of change:**
   - loners-spec §2.4 player actions: share +10, groom +5, help +15, chase off −15, attack −30.
   - Scene effects (§4).
   - Ambient contact: same pride and same role on the same day gives +1 per day, capped at +3 per season.
   - World events: fought on the same side +5; injured by the other −20 plus `grudge_start`; stole a kill −10.
2.2 **Personality multiplier** on every positive change to the pair: × (1 + (avgSociability − 50)/200), range ×0.75–1.25. Negative changes are × (1 + (avgAggression − 50)/200).
2.3 **Decay (per season, at season start):** value moves toward its **anchor** by `decay` = 3 points, or by 1 point if there was any contact this season.
   - Anchor = 0 by default; +10 for `family`; +20 for `mates` (floors: decay never takes the value below the anchor). Negative values decay toward 0 at the same rate, but a held grudge stops the decay.
   - Skill perks (`old_friends`, `constant`) suspend decay as written.
2.4 **Caps:**
   - Per pair: at most ±20 total change per day from all sources, except attack, injury and challenge events.
   - Per scene: the total |rel change| across all effects is ≤ 20.
2.5 **Pruning:** a pair is deleted when value == anchor, it has no kinds or flags, and there's been no contact for 4 seasons. Pairs with a dead cat are kept (for memory) but frozen. They're pruned after 8 seasons unless the pair is `family` or `mates`.
2.6 **Store cap:** **1,500** live pairs (39 world cats + pride growth). If the cap is exceeded, prune the lowest |value − anchor| pairs with no kinds first, never the player's pairs, kin or mates.

## 3. Personality compatibility
3.1 Trait bands (for `requires.trait`): `low` < 35, `mid` 35–69, `high` ≥ 70.
3.2 **Compatibility** `compat(a, b)` ∈ about −20..+20, computed once per pair and cached:
   - +6 if both have sociability ≥ 60;
   - +4 if |loyalty difference| ≤ 15;
   - +4 if |curiosity difference| ≤ 15;
   - −8 if both have aggression ≥ 70 (rivalry risk);
   - −4 if |boldness difference| ≥ 40;
   - +4 complement: one has boldness ≥ 70 and the other sociability ≥ 70.
3.3 **Uses:**
   - It shifts the first-meeting value by compat / 2.
   - Ambient contact gains are +1 if compat ≥ 8, and 0 instead of +1 if compat ≤ −8.
   - Scene picking weights (§4.4).
   - The rivalry entry roll: when compat ≤ −8 and the pair has contact, there's a 10% chance per season of `rivalry_start` if value ≤ 0.

## 4. Scenes
4.1 **Frequency:** every pride rolls for a scene each day at p = base × sizeMult × styleMult. A scene **plays in full** (VN view) when it's the player's own pride or the player's cat is in or next to that territory. Otherwise it's an **AI-pride scene resolved off-screen** (Director, v0.1.1): no VN view, and cat A's choice is picked by personality weight (same rule as skills-spec AI perk picks). Its effects apply normally, and it adds one log line (Saga's `summary` text).
   - base = 1/8.
   - sizeMult = clamp(prideSize / 10, 0.5, 1.5).
   - styleMult: Story 1.25, Standard 1.0, Sim 0.8.
   - So a 10-cat pride gets about 1 scene every 8 days, or **about 2.5 per 20-day season**.
   - There's at most 1 scene per day **per pride**, and never on a day with a threat or challenge event.
   - Before the player founds a pride, loner scenes (`first_meeting`, `crush`) roll at 1/12 per day, only when the player meets a cat.
4.2 **Trigger tags** (snake_case; `trigger` field) and their kinds:

| Tag | relType kinds | Eligible pair when | Cooldown (scope, days) | Priority |
|---|---|---|---|---|
| `first_meeting` | none | met = false, both present | pair, never repeats | 3 |
| `family_bond` | family | kin pair, value ≥ 15 | pair 30 | 2 |
| `cub_play` | playmate, family | ≥ 1 cub, both young | pair 20 | 2 |
| `friendship` | friendship | friendship kind or warm | pair 20 | 1 |
| `admiration` | admiration | admiration flag | pair 30 | 1 |
| `rivalry` | rivalry | rivalry kind | pair 15 | 2 |
| `rivalry_boils` | rivalry | rivalry and value ≤ −40 | pair 30 | 4 |
| `crush` | crush | crush flag, age gate §1.6 | pair 20 | 2 |
| `courtship` | crush, mates | mutual crush, or player courting | pair 15 | 3 |
| `mates` | mates | mates kind | pair 30 | 1 |
| `mates_strain` | mates | mates and value ≤ 10 | pair 30 | 4 |
| `grudge` | grudge | grudge flag | pair 25 | 3 |
| `reconcile` | rivalry, grudge | rivalry or grudge and value ≥ −20 | pair 40 | 2 |
| `jealousy` | crush, mates | a crush holder sees its target with another cat's crush or mate | trigger 20 | 3 |
| `leader_doubt` | rivalry, grudge | a rival or grudge toward the leader | trigger 40 | 4 |

   A trigger-wide cooldown also applies: the same trigger can't fire twice within 5 days per pride.
4.3 **Priority:** on a scene day, pick the highest-priority tag with ≥ 1 eligible pair off cooldown. Ties are a weighted random draw by scene `weight`. Priority 4 tags are "drama", and in Story they fire at half the weight (§6).
4.4 **Cast picking:**
   - Weight each eligible pair by 1 + |value| / 25 + (1 if a cat hasn't been in a scene for 2 seasons) + compat / 20 (min 0.1). That favours strong ties and cats who haven't had a turn.
   - A third cat (C) is added only if the scene has a C slot. It's a cat with any stored pair to A or B, and for `jealousy` the third party is required.
   - **The player** is a valid cast cat. Pairs with the player get ×1.5 weight, and at least 1 in 3 pride scenes should include the player when the player has any eligible pair.
   - Each cat binds once per scene.
4.5 **Side-blind:** no rule depends on left, right or centre (Ochre mirroring). Slot = position only. Expressions are `neutral`, `happy`, `angry` and `sad` (scene-format §1.6); expression never triggers effects.
4.6 **Follow-ups** (scene-format §2.6) use menu ids: `followUp.unlikely` 20%, `followUp.likely` 50%, `followUp.certain` 100%. Queued follow-ups take the next free scene day in their window, after priority 4.

## 5. What relationships feed
5.1 **Contentment** (loners §6.4, per season) gets new inputs that replace "has a mate or close bond +10":
   - Has a mate: +10.
   - Each `close` tie in the pride: +3 (max +9).
   - Each `hostile` tie or held grudge toward a pride cat: −4 (max −12).
   - Rival in the same pride: −2.

   For the player cat, Mood gets the same contentment inputs per needs-spec.
5.2 **Mating:**
   - Courtship acceptance (loners §4) adds the bonuses below: +10 at value ≥ 50, +5 for 25–49, −10 at ≤ −15, +10 if the target holds a crush on the suitor.
   - **Bond break:** a mate pair that sits at value ≤ −15 for 2 seasons breaks. Both lose `mates`, the breaker gets `grudge` 30% of the time, and each gets −10 contentment. Story never breaks bonds; Sim breaks at value ≤ −5.
   - AI pride mate pairing (world drift) prefers the highest-value attraction-compatible adult with r < 0.125 (§1.8).
5.3 **Leaving** (§6.4 rolls): the per-season leave chance after warnings is × (1 + 0.15 × hostile ties) × (1 − 0.2 × close ties), clamped to ×0.4–1.6. A cat with a `mates` or `family` pair at ≥ 50 in the pride gets ×0.7 more. The **Lure** rule (Sim) uses the lurer's rel value ≥ 40 directly.
5.4 **Challenges:**
   - A pride cat with `rivalry` or `grudge` toward the leader, aggression ≥ 60 and adult stage rolls `leader_challenge` at 3% per season, +2% per 10 points below −30.
   - In AI prides this also feeds the drift challenge chance.
   - For the player's pride, it fires a `leader_doubt` scene first as a warning, at least 1 season before.
5.5 **Heir:** when the player switches to an heir (menu §7), the heir inherits nothing from the founder's pairs except its own existing pairs. Other cats' values toward the heir get +5 if they were ≥ 25 with the founder (respect carries over), and −5 if they held a grudge toward the founder. Heir picking ties break on the higher average pride value toward the candidate.

## 6. Style scaling
| Rule | Story | Standard | Sim |
|---|---|---|---|
| Scene rate (styleMult) | 1.25 | 1.0 | 0.8 |
| Priority-4 drama weight | ×0.5 | ×1 | ×1.25 |
| Negative rel changes | ×0.75 | ×1 | ×1.15 |
| Decay per season | 3 | 3 | 4 |
| Mate bond breaks at | never | ≤ −15 for 2 seasons | ≤ −5 for 2 seasons |
| Scuffle injury (effect `scuffle`) | none | minor 20% | minor 30%, serious 5% |

## 7. Effect menu (`src/renderer/data/effects.json`; Tundra owns values, Flint owns code)
Ids keep Saga's dotted style (scene-format §2.5). All effects target cast slots only. Personality multipliers (§2.2) and Style (§6) apply; caps from §2.4 apply.

| Effect id | Target | Value |
|---|---|---|
| `rel.up.small` / `.medium` / `.large` | pair | +3 / +8 / +15 |
| `rel.down.small` / `.medium` / `.large` | pair | −3 / −8 / −15 |
| `rel.shift` | pair + `from`, `to` kind | +5, and removes `from` if its exit holds |
| `rel.rivalry_start` | pair | add `rivalry`, value min(value, −15) |
| `rel.rivalry_end` | pair | remove `rivalry`, +5 |
| `rel.grudge_start` | holder → target | grudge flag, −10 |
| `rel.grudge_end` | holder → target | clear grudge, +5 |
| `rel.crush_start` | holder → target | crush flag (age gate and r gate; otherwise dropped) |
| `rel.crush_end` | holder → target | clear crush, −3 |
| `rel.admire_start` | holder → target | admiration flag, +3 |
| `rel.mates_bond` | pair | requires a mutual crush or value ≥ 50, both eligible; otherwise dropped. Sets `mates`, +10 |
| `rel.mates_strain` | pair | −8, mates kept |
| `content.up.small` / `.medium` | cat | +5 / +10 contentment |
| `content.down.small` / `.medium` | cat | −5 / −10 |
| `mood.up.small` / `mood.down.small` | player | +5 / −5 Mood |
| `loyalty.up.small` / `loyalty.down.small` | cat | `prideLoyalty` +3 / −3 |
| `scuffle` | pair | injury roll per §6 for each cat; no death; −5 rel |
| `flag.set` / `flag.clear` | cat, pair or run | story flag |
| `followUp.unlikely` / `.likely` / `.certain` | (followUp chance) | 20% / 50% / 100% |
| `none` | — | 0 |

   Bounds: ≤ 4 effects per scene + 2 per choice option. Total |rel change| ≤ 20, |contentment| ≤ 10 and |prideLoyalty| ≤ 3 per cat per scene. Effects that break a gate are dropped and logged, never raise errors.

## 8. Data
8.1 Save: `relationships: { "<a>|<b>": PairRecord }` (sparse, §1.1) and `sceneCooldowns: { "<tag>|<pairKey>": dayExpires }`.
8.2 Events: `rel:changed {pairKey, delta, value, source}`, `rel:kindChanged {pairKey, kind, added}`, `scene:played {sceneId, trigger, cast, effects}`.
8.3 Storyteller seed (scene-format §4.1): for each cast pair, send kinds, band, met, kin, and holder flags.

## 9. Tunables (`relationships.json`)
| Key | Default |
|---|---|
| value range / never-met | −100..100 / 0 |
| bands | ≤ −50, −49..−15, −14..14, 15..49, ≥ 50 |
| seed parent / sibling / mate / pride other | +40 / +30 / +60 / Normal(10, 12), store if abs ≥ 15 |
| anchors family / mates | +10 / +20 |
| decay / with contact | 3 (Sim 4) / 1 per season |
| prune idle / dead | 4 / 8 seasons |
| store cap | 1500 |
| caps per day / per scene | ±20 / 20 |
| ambient contact | +1 per day, max +3 per season |
| crush roll | 10% per season × sociability factor |
| kin cut (romance) | r < 0.125 |
| trait bands | low < 35, high ≥ 70 |
| compat terms | §3.2 |
| scene base / sizeMult / styleMult | 1/8 per day / clamp(size/10, 0.5, 1.5) / 1.25, 1, 0.8 |
| trigger cooldown per pride | 5 days |
| player share | ≥ 1 in 3 |
| contentment close / hostile / rival / mate | +3 (max 9) / −4 (max −12) / −2 / +10 |
| leave mult hostile / close / kin anchor | +0.15 / −0.2 / ×0.7, clamped 0.4–1.6 |
| challenge base / per 10 below −30 | 3% / +2% |
| effect values | §7 |

## 10. Test checklist (Tracker)
1. **Sparse save:** a new run stores only seeded kin, mates and pairs with |value| ≥ 15. Never-met pairs read 0 / met false.
2. **Age gate:** over 1,000 simulated seasons, cubs and adolescents never get crush or mates. AI scenes trying it are rejected.
3. **Incest gate:** no crush or mates with r ≥ 0.125, by any path (effects, courtship, AI pairing).
4. **Decay:**
   - An idle pair at +40 reaches 0 in 14 seasons.
   - Family stops at +10, mates at +20.
   - A grudge holds the decay.
5. **Caps:** no pair changes > 20 in a day (except attack, injury and challenge), and no scene exceeds its effect bounds.
6. **Frequency:** a 10-cat Standard pride over 100 seasons averages 2.5 ± 0.3 scenes per season, with no tag repeating inside its cooldown.
7. **Side-blind:** swapping left/right slots gives identical effects and state.
8. **Feeds:**
   - Contentment inputs match §5.1.
   - Mate bonds break per Style.
   - The leave multiplier is within 0.4–1.6.
   - A leader-challenge warning scene precedes the challenge.
9. **Pruning:** the store stays ≤ 1,500 over a 30-generation soak, and player, kin and mate pairs are never pruned.
10. **Migration:** loners' old `affinityToPlayer` reads equal `rel(cat, player).value`.
- [ ] Attraction split over 10,000 rolls is 85/10/5 ± 1%. Fixed-mate and guarantee slots never roll `same`, and the mate guarantee holds for both player sexes on 1,000 seeds.
- [ ] Same-sex mates never conceive. Incompatible courtship declines with no loss. The validator rejects crush/mates on incompatible pairs.

## 11. Open questions (for Director)
11.1 ANSWERED (Director): a scene plays in full when the player's cat is nearby or it's the player's own pride. AI-pride scenes are resolved off-screen, and only a log line is shown.
11.2 ANSWERED (Anna via Director): yes, at lower odds. A hidden random `attraction` trait (§1.8) allows same-sex crushes and non-breeding mates.
11.3 DECIDED (Tundra, minor call): the player sees bands only, for every cat. The `read_affinity` perk shows exact numbers.
11.4 DECIDED (Tundra, minor call): there's one shared `src/renderer/data/effects.json` for scenes and events, as Flint set the path. Saga's ids use the dotted format.
11.5 ANSWERED (Director): Story keeps `leader_doubt` and `mates_strain` at half weight. Story is light but not drama-free.
11.6 DONE: loners-spec v0.9 errata (Director OK).

## Changelog
- v0.1.4 (2026-11-05, Tundra): §1.5 seeded history uses the merged `seedFlags` format (`kind: none` = value only, floors never broken). Backup: `relationships-spec.v0.1.3.bak.md`.
- v0.1.3 (2026-11-05, Director's rulings): elders can be mates (fertility per lifecycle §2.4). Adolescents can be playmates with cubs or each other (§1.4, §1.6). The scene limit is per pride. Added the seedFlags rule (§1.5). Notes on `isRival` and band labels (§1.3). Backup: `relationships-spec.v0.1.2.bak.md`.
- v0.1 (2026-11-04, Tundra): first draft. Built on loners-spec §2.4 affinity; answers Saga's scene-format TBDs (kinds, bands, never-met, decay, tags, cooldowns, effect sizes).
- v0.1.1 (2026-11-04, Director): Director answered §11.1, §11.5 and §11.6. Tundra made minor calls on §11.3 (bands only) and §11.4 (one shared effects.json). §11.2 is waiting on Anna.
- v0.1.2 (2026-11-04, Anna via Director): added the hidden `attraction` trait (§1.8): opposite 85 / either 10 / same 5, random at birth and not inherited. Same-sex crushes and non-breeding mates are now allowed. World slots roll it on a separate seed stream, and fixed-mate and guarantee slots can't roll `same`. The player cat follows the player's choices.
