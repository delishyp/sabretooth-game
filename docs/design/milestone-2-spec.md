# Milestone 2: "Twenty Days: find a mate, found a pride" (v0.6.3 DRAFT, Tundra, 2026-11-07)

**Status:** DRAFT — not frozen. Every rule is **ANNA-APPROVED** (Anna's words via Director), **APPROVED** (cites an existing spec section or a Director call), or **PROPOSED DEFAULT** (Tundra; changeable). Nothing proposed is presented as approved.

Anna (via Director), **ANNA-APPROVED**: *"Let's say you have 20 days to find a mate and start your own pride, so the goal by the end of those days is to have found a suitable cat and make them your mate."*

Anna (via Director, 2026-11-07), **ANNA-APPROVED**: *"The mating season is over if the 20 days are up. You'd have to either get accepted into another pride (hard), join a loner group, or survive on your own until the next year."*

**Reading of the two rulings:** the 20 days are the spring **mating window**, not the length of the run. Day 20 is a seasonal transition (`season_end`), not game over. After it the cat keeps living day by day. Year length is **not** specified (§3.1, §9).

**Breeding line:** the `mates` bond and founding with that mate are IN. Conception, litters, cubs, nursing and genetic inheritance stay OUT (Director: breeding deferred).

Owner: Tundra (rules). Copy/events: Saga. Code: Flint. QA: Tracker. Art: Ochre (not on the critical path). Related: slice-1-scope v1.0.1 (built as v0.1.4); map-v1 v1.0.1 DRAFT; needs-spec v0.1; formulas-spec v0.2.4; loners-spec v0.9; relationships-spec v0.1.4; lifecycle-spec v0.1; main-menu-spec (frozen; do not change).

## 1. Name, goal, definition of done

**Name:** Twenty Days: find a mate, found a pride.

**Goal:** Within the 20-day spring mating window, survive, meet cats, judge compatibility, build a bond through repeat meetings, and win mutual mate acceptance. Then found your own pride and keep it alive. A player who misses the window keeps playing by one of three routes (§3.8).

**Milestone states (no "win" flag; PROPOSED DEFAULT):** `mate_secured` (a completed `mates` bond) and `pride_founded` (Found completed). Each fires a non-terminal moment and is recorded on the run. Nothing ends the run except death (§3.7.5).

**Definition of done (player-facing):** A creator cat starting spring day 1 at `split_rock` can, inside the window, meet cats more than once, grow a bond through chosen scenes (not a silent threshold), court one eligible partner, and Found a pride on wild land with that mate. A `pride_founded` moment plays and play continues. At the end of day 20 a `season_end` scene plays (variant by state) and day 21 follows normally, with no time skip. An unmated player can then try pride admission (hard), join a loner group, or survive alone. Death from needs and hazards still ends a permadeath run. Portraits may use a head crop plus an Entire-cat view of a complete pre-rendered cat (Director/Anna: 40 shared male/female cats). Gameplay must not depend on layered genetic portraits.

## 2. Current state (code at local `8be56ec` / origin `eddd135`, v0.1.4)

Slice 1 already has the 20-day spring loop, hunt/rest/travel, Standard needs without Warmth/Mood, flee-only bear/wolves, trespass patrols, first meetings (3 pride greetings + 1 loner), `affinityIntent` +5/0/−5, 30 spring region moments, and a run-ending day-20 or death summary. Repeat loner meetings return no event. NPC affinity starts at 0 (no sociability/aggression or compat modifiers). `world-slots.json` has sex, stage, faction, age and loner `homeZones`, but no personality, attraction or kinship `r`. There is no courtship, Found, or bond-stage UI. Open PR #1 is home-scene portrait framing only; it does not add this objective.

## 3. IN scope

Menu spec stays frozen. New Game stays Standard + permadeath (`menuLock`, slice-1 IN §1). Hazards stay as the slice built them (bear/wolves flee).

### 3.1 The mating window and the calendar

1. **APPROVED** (map-v1 §2, lifecycle §1, needs §0.1): 1 day = 1 turn. A run starts at spring day 1, Year 1, at `split_rock`.
2. **ANNA-APPROVED:** the mating window is the 20 spring days. "The mating season is over if the 20 days are up."
3. **PROPOSED DEFAULT (data):** `calendar.json` gets `matingWindowDays: 20`, `matingWindowStartDay: 1` (spring day 1) and `yearLengthDays: null` (**TBD, Anna**, §9.1). The engine tracks `absDay` (1, 2, 3 …), never wraps, and computes `inMatingWindow = (dayOfYear ≥ start && dayOfYear < start + matingWindowDays)`. While `yearLengthDays` is null, `dayOfYear = absDay`, so only Year 1's window exists.
4. **PROPOSED DEFAULT:** no time skip of any kind. Day 21 follows day 20 like any other day. The next-year window opens only when normal day-by-day play reaches it. **Flag:** until year length is decided, the next-year window is not reachable in this build. That is acceptable for this milestone (Tracker: not a bug).
5. **PROPOSED DEFAULT:** this milestone does not name or simulate the seasons after spring. After day 20 the season label is "after the mating season" and prey, hazards and needs keep using the spring tables. Warmth, winter scarcity, illness and Mood stay unused (Mood stays `normal`). Map §9.3 per-season upkeep uses 20-day blocks (`absDay` 20, 40, 60 …), which matches the existing 20-day season.
6. **APPROVED** (slice-1 IN §3, §9): one main action a day (hunt / rest / travel, plus the new Seek out, Court-as-action, Found, Patrol, Mark and Ask to join below); free drink in water regions; 1 manual save + daily autosave. **PROPOSED DEFAULT:** the HUD shows "Mating season · day X/20" in the window, then "Day N · mating season over".
7. **APPROVED** (slice-1 IN §4–§6, needs §1/§2 Standard, formulas §1 without skills/party/mood): survive with Health, Hunger, Thirst, Energy and minor/serious injuries. Hunt, rest, travel and the existing hazard table stay as built.

### 3.2 Meetings, groom, share, Seek out

1. **APPROVED** (loners §2.3, map §8.4): 15% to meet a loner when the day ends in their home zone, 5% in an adjacent zone. Trespass patrols 10% on held land (map §8.3, −5 pride relation). At most one offline event per day (slice-1 IN §8). Meetings at day end do not cost a second day (slice-1).
2. **APPROVED** (loners §2.4, relationships §0.1, §1.3): affinity is the pair value (−100..+100). First stored pair starts at 0, then +10 if that cat's `sociability` ≥ 70 and −10 if `aggression` ≥ 70, plus compat/2 (relationships §3.3). Bands (`hostile` ≤ −50 … `close` ≥ +50) are internal ids.
3. **APPROVED** (loners §2.4): share a kill +10; groom +5 (requires affinity ≥ 20); chase off −15; attack −30. Talk uses slice-1 §7 `affinityIntent` (+5 / 0 / −5), improve once per cat per day.
4. **PROPOSED DEFAULT:** an already-met cat triggers `repeat_meeting` instead of a blank day. Groom and Share are choices on that card (no extra day). Share is offered only if today's action was a successful hunt. Groom also costs Energy −5 (needs §1.4 socialise).
5. **PROPOSED DEFAULT — Seek out** (needed so a focused player can hit the court gate; see §5): spend the day looking for one cat you have already met. You must be in that cat's home zone, or Seek out may spend the day travelling there along a legal 1-day edge (travel Energy −15; 2-day edges still take two travel days, then Seek out). If you end the day in their home zone, the meeting is guaranteed. Energy −5 if you were already there. Seek out cannot be used to find an unmet cat (first contact stays on the approved 15%/5% and patrol rolls). You cannot hunt the same day.

### 3.3 Bond stages (no auto-pairing)

Stage id `close` is this arc's name, not relationship band `close` (≥ 50). Reaching a number does nothing by itself; the player must choose through that stage's Saga beat. There is no "become mates" button that skips the ask.

| Stage | id | Numeric gate | Required beat the player chooses |
|---|---|---|---|
| Met | `met` | `first_meeting` completed | `first_meeting` |
| Acquainted | `acquainted` | value ≥ 15 (warm; relationships §1.3) | `acquainted` |
| Close | `close` | value ≥ 25 | `close` |
| Courting | `courting` | `close` beat done, and the player has asked (gates pass) | `courtship` |
| Mates | `mates` | formulas §2 accept, then §3.4 if a pride cat | `mates_confirmed` |

**PROPOSED DEFAULT:** Court is hidden until the `close` beat is done (stricter than formulas §2.1's value > −15, for pacing). Talk / groom / share may move the number on any meeting, including before the matching beat is chosen.

### 3.4 Mate eligibility (attraction + kin)

Checked before any Court or any scene that would set `crush` or `mates`. A failed gate is a gentle decline, no roll, no value loss (formulas §2.1).

1. **APPROVED** (formulas §2.1, relationships §1.6, lifecycle §2): both are adult or elder (`ageSeasons` ≥ 12).
2. **APPROVED** (relationships §1.8, Anna via Director): attraction-compatible. AI cats have hidden `attraction`: `opposite` 85% / `either` 10% / `same` 5%. `mates` needs compatibility both ways. The player has no trait and follows their choice; an incompatible AI uses tag `courtship_declined_attraction` with no loss.
3. **APPROVED** (formulas §2.1, relationships §1.7): `r` < 0.125. The created player is not roster kin, so `r` with premades is 0.
4. **APPROVED** (formulas §2.1): target is not already mated; pair value > −15.
5. **APPROVED** (formulas §2.1 / §2.4, Anna via Director): only during `breedingSeasons` (default spring = the 20-day mating window, §3.1). Out of the window, Court and new `mates` bonds are rejected. Same-sex mates use the normal bond with `breeding: false` and no cubs (relationships §1.8).
6. **OUT:** conception, litters, cubs, inheritance.

### 3.5 Courtship cadence and day costs

1. **APPROVED** (formulas §2.1): 1 Court attempt per 5 days per target, inside the mating window only.
2. **PROPOSED DEFAULT:** Court appears as a choice on a meeting after `close`. It uses the day already spent (no second day) and consumes the attempt. If the player is in the target's home zone (loner) or on that pride's held land (pride cat), has met them, and `close` is done, they may also pick Court as the day's action (Energy −5, guarantees the courtship scene).
3. **APPROVED** (formulas §2.2–§2.3): P(accept) = clamp(points, 5, 90)% (base 20, +0.4 × value, relationship bonuses, Display M = 0, personality, compat/2, standing, Mood 0, Style 0). Success → §3.6 if needed, then `mates`. Failure → −5 value.
4. **APPROVED** (relationships §1.4 / formulas §2.3): the bond needs mutual crush or value ≥ 50 to *stick*, but the ask itself is the §2 roll (about 35% at value 25 and about 50% at 50; formulas §2.5). Those are formulas §2.5 worked examples per ask, not run success rates (§5).

### 3.6 Pride-member candidates leaving

1. **APPROVED** (formulas §3.1a, loners §4.2): a pride cat becomes the player's mate only after leader approval type (a) (1 request per season per pride; failure pride relation −5) and the mate rival challenge if someone qualifies (strongest same-sex adult in that pride with value ≥ 15 toward the target; skipped if none). The challenge is non-lethal (formulas §4.4); loser −10 value with the target. Completing the bond gives +20 relation with that pride (loners §4.2).
2. **APPROVED** (loners §4.3): a **loner** mate joins automatically when the player founds, no extra roll.
3. **PROPOSED DEFAULT** (pride-cat leave-to-found is not written; loners §4.3 names loners only): when the player Founds after a completed pride-cat bond, that mate leaves the origin pride and joins as first member. Do not apply loners §3.3 recruit penalties; do not apply the +20 twice. This is still open for Anna (§9.2); not assumed approved.
4. Type (b)/(c) joining an AI pride, recruiting other loners, and co-founding without a mate are OUT this milestone.

### 3.7 Milestones, founding, pride survival, season end

1. **PROPOSED DEFAULT — milestones, not a win:** `mate_secured` fires on `mates_confirmed`; `pride_founded` fires when Found completes. Each plays its scene, is written to the run record (`milestones[]` with `absDay`) and returns to the map. **No screen ends the run.**
2. **APPROVED** (map-v1 §9.4.4, §9.7): Found is available once the player has a mate. If the current region is wild, it gains claim 60 and becomes the den. The mate is the first member (loners §4.3 / §3.6.3). **PROPOSED DEFAULT:** the player names the pride on the Found screen (`prideName`). Found spends the day's action, except that the `mates_confirmed` scene on wild land may offer Found at no extra day.
3. **Founding sites, APPROVED** (map-v1 §4.2 neutrals; layout not yet approved by Anna, ids may change): `ice_wall`, `frost_tongue`, `blue_caves`, `wind_scree`, `north_pass`, `salt_flats`, `south_range`, `split_rock`, `twin_forks`, `west_spur`, `drowned_mere`, `mere_shore`, `island_mere`, `east_saddle`, `bears_throat`, `claw_gorge`, `tar_seeps`, `camel_ridge`. Not wild: `highcrag`, `horse_meadows`, `upper_greywater`, `greywater_ford` (disputed), `bonefield`, `herd_trail`, `tallgrass`, `mistwood`, `fog_paths`, `reedbank`, `ash_hills`, `wolf_run`. Core dens cannot be founding sites while their faction exists (map §9.1). **PROPOSED DEFAULT:** contest/skirmish is not built, so Found is disabled on held or contested land (hint: travel to wild land).
4. **PROPOSED DEFAULT — founding after the window:** a mated player who has not founded by day 20 may still Found later. Founding is not breeding, so the spring gate does not apply.
5. **APPROVED** (slice-1 IN §10, needs empty-Health): death from needs or hazards opens the death summary and ends a permadeath run. The mate's death does not end the run. This milestone adds no new death rules and does not unlock Heir.
6. **Ongoing pride survival** (after `pride_founded`):
   - **APPROVED** (map-v1 §9.3–§9.4): upkeep, Mark (+25, 1 day) and claim decay (−5 upkept / −20 missed per season) apply to the player's pride. **PROPOSED DEFAULT:** season end is every 20 `absDay`s (§3.1.5). Patrol is a player action (1 day, +15 claim in a held region). Upkeep owed = regions held (+1 if contested), so a 1-region pride owes 1 patrol-day per 20 days.
   - **PROPOSED DEFAULT — feeding:** the AI mate hunts for itself (no pride larder). Share with your mate gives +10 value as before. Den loss (claim < 50) makes the pride homeless: the mate stays, `prideFounded` stays recorded, and Found may be used again on wild land.
   - **PROPOSED DEFAULT — protecting:** trespass patrols (map §8.3) and bachelor bands (loners §5b, already approved) may target the player's pride as written. No new fight types.
7. **PROPOSED DEFAULT — `season_end` (end of day 20, once per window):** a non-terminal transition scene. Variant `mated_founded`, `mated_unfounded` or `unmated`. It recaps days survived, cats met and the best stage reached, closes courtship for the year, and explains the routes left (§3.8 for unmated; "you can still found" for mated_unfounded). Then day 21 starts. No New run prompt. Buttons (v0.3.2 ruling): `mated_founded` and `mated_unfounded` show Continue only; `unmated` shows the three intent choices (`route_pride`, `route_group`, `route_alone`), each of which sets `player.routeIntent` (no lock, no cost) and then acts as Continue.

### 3.8 After the window: routes for a cat without a pride

**ANNA-APPROVED:** "get accepted into another pride (hard), join a loner group, or survive on your own until the next year." All three are always available; none is a choice the player locks in.

**(a) Admission into an existing pride**
1. **ANNA-APPROVED:** it is hard.
2. **APPROVED** (formulas §3.1b, §3.2–§3.3): uses leader approval type (b), lone player asks to join, request −10, 1 request per season per pride, failure −5 pride relation.
3. **PROPOSED DEFAULT:** action "Ask to join", 1 day, only on that pride's held land with its leader met. Outside the mating window add `outOfSeasonJoin: −15`. Standard example, fresh player at Highcrag (relation 0, leader value 0): 30 − 10 − 15 − 10 = 5% (floor). Mistwood after 2 seasons in range: 30 − 10 − 15 + 4 = **9%**. A cultivated player (relation +20, leader value 30) at Mistwood: 30 + 10 + 9 − 10 − 15 + 4 = **28%**.
4. **PROPOSED DEFAULT:** cooldown: 1 request per pride per 20-day season (the approved cadence). After a refusal, add a further −5 per prior refusal to that pride (`admissionRefusals[prideId]`, max −15).
5. **PROPOSED DEFAULT:** on accept the player becomes a member (`status: member`, `player.prideId` = that pride). No rank, duties or pride AI are added in this milestone: membership removes trespass rolls on that pride's land and allows sharing its kills (Hunger +20 once per day on its land). Courting inside that pride next window uses §3.6 as written. A mated-but-unfounded player cannot use this route (type (c) stays OUT).

**(b) Join a loner group**
6. **APPROVED** (loners §5b): the only loner groups that exist are bachelor bands: 2–3 adult male loners, no territory or den, at most 2 at once, forming at 20% per season when two adult male loners share a home zone with mutual affinity ≥ 30. There is no female or mixed group, and no rule for the player joining one.
7. **PROPOSED DEFAULT (minimal, open for Anna §9.4; Director: not narrowed to male-only):** a loner group (`lonerGroup`) is 2–3 adult loners with no territory or den, of **any sex mix**. Existing bachelor bands (loners §5b) are one instance; the §5b.2 formation roll applies to any two adult loners sharing a home zone with mutual affinity ≥ 30 (PROPOSED widening of §5b, which today forms male bands only). The player of either sex may join an existing group whose members have all met the player at pair value ≥ 25 (action "Ask to join group", 1 day, in its home range, and the group must have fewer than 3 members). The roll is 20 + 0.4 × the average value, clamp 5–90%, with −5 value with each member on refusal and 1 ask per group per season. All numbers PROPOSED, not approved.
8. **PROPOSED DEFAULT — what a group gives:** trespass patrol chance on held land falls from 10% to 5% (strength in numbers), Share among members works as Share (+10 each), and group strength uses loners §5b.3 for any band challenge (no new fight rules). The player can leave at any time (1 day, no penalty). Groups never Found; a player who mates later leaves the group to Found.
9. **Data dependency:** Flint persists `lonerGroups[]` (id, memberIds, homeZones) and runs the §5b.2 formation roll at season end; Saga writes `loner_group` copy (§10).

**(c) Survive alone**
10. **ANNA-APPROVED:** surviving alone is a route. **APPROVED:** the existing loop (hunt / rest / travel / meetings / hazards) simply continues. **PROPOSED DEFAULT (bond carry-over):** meet, Seek out, Talk, Groom and Share keep working out of season, so bonds carry into the next window. Court and the `courtship` beat stay locked until it opens.

### 3.9 Saves and portraits

1. **PROPOSED DEFAULT:** `saveVersion` 2. `migrate` accepts v0.1.4 (`saveVersion` 1): keep region, day (→ `absDay`), needs, injuries, claims, relations, NPC names/affinity/`met`/`usedEvents`. Add `status: loner`, no mate, no pride, bond stages unset, `milestones: []`, `seasonEndShown: false`, `lonerGroups: []`. In-progress saves keep playing. A v0.1.4 save that ended by **death** stays ended. A v0.1.4 save that ended only because day 20 finished is **reopened**: it shows `season_end` (`unmated`) and continues at day 21 (the old ending no longer exists). Newer saves than this build still throw.
2. **PROPOSED DEFAULT:** a save on day 20 before the day resolves reloads on day 20 in the window. A save after `season_end` reloads on day 21 with `seasonEndShown: true` (the scene never replays).
3. **APPROVED** (Director/Anna): use complete-cat PNGs from `assets/portraits/registry.json` when present; missing files fall back to the current draw path.

## 4. Edge cases

1. **v0.1.4 migration** — as §3.9.1.
2. **Death mid-event** — if Health hits 0 during a hazard or choice, drop remaining choices; no mate or Found is applied.
3. **Court success on day 20** — `mates_confirmed` and `mate_secured` apply that day; `season_end` then plays `mated_founded` (if Found was chosen on wild land) or `mated_unfounded`.
4. **Mid-courtship at day 20** — a courtship, approval or rival chain that started on day 20 resolves that day before `season_end`. Nothing carries into day 21: an accepted pride-cat ask still awaiting approval at the end of day 20 lapses (no bond, no penalty, the 5-day attempt is spent). The bond stays at `close` for next year.
5. **Rival challenge pending at day 20** — resolves on day 20 if triggered; it is never scheduled after the window. If unresolved, it lapses like (4).
6. **Mate dies after the window** — `player.mateId` clears, the `mate_secured` milestone stays recorded, the pride persists if founded (player alone holds the claim), and a new mate is possible only next window.
7. **Out-of-season Court** — Court is hidden; any forced call is rejected with the not-in-season hint and no day or attempt is spent (formulas §2.1).
8. **Found on non-wild land** — reject without spending the day.
9. **Gate failure / refusal** — no bond; attraction decline costs nothing; court failure −5 value and spends the 5-day attempt; approval or admission failure −5 pride relation and spends the season's request.
10. **Ineligible bind** — the engine only offers Court / crush / mates beats for cats who pass §3.4 (relationships §7).
11. **Member or group player who gets mated next window** — joining a pride as member does not block a later mate. Leaving to Found keeps loners §3.3 penalties off.

## 5. Reachability and balance

**Target (PROPOSED DEFAULT, qualitative):** a focused Standard player who picks one compatible loner, stays in that cat's home zone and uses Seek out should usually secure a mate inside the window. A careless player (wandering, skipping repeats, courting late or never) usually should not. Missing the window is no longer a fail state: it leads to §3.8 and the next window. The loner path is the balance target because it skips approval and the rival challenge (loners §4.2, APPROVED). Pride cats are the harder optional route.

**Pacing logic (no success rates claimed):** first contact relies on the approved 15% home / 5% adjacent rolls (loners §2.3), so a player who only waits can reach few repeat meetings in 20 days. Four scenes (met, acquainted, close, court) plus a possible failed ask need more than that. Seek out (§3.2.5) makes repeat meetings a player choice after first contact. With a 5-day ask cadence, an early first meeting allows several asks before day 20; a late first meeting allows one or none. Per-ask odds come from formulas §2.2 as written. Admission odds out of season are the §3.8.3 point totals (formula arithmetic, not run rates).

**Sim needed (Tracker/Flint, before freeze):** a headless Monte Carlo of the loop over the 39 slots (focused vs careless policy; Standard) reporting mate-by-day-20 rate, founding rate and death rate. Any target percentage waits for that sim. The v0.2 percentages were hand estimates and are withdrawn.

Players should hunt in the home zone on non-Seek-out days (Hunger −12/day vs a 55% small hunt). A few Seek-out/Court days after a week of hunting should be survivable from start Hunger 80 (sim to confirm).

## 6. Acceptance tests (Tracker)

1. New run: spring day 1, `split_rock`, HUD "Mating season · day X/20".
2. **Day 21 continues:** end day 20 unmated; `season_end` (`unmated`) plays once, then the HUD shows "Day 21 · mating season over" and all day actions work. No epilogue, no New run prompt.
3. **No time skip:** across `season_end`, `absDay` increases by exactly 1 per day action; nothing jumps to the next spring. With `yearLengthDays: null`, play to day 60: `inMatingWindow` stays false.
4. **Founding does not end the run:** Found on `split_rock` names the pride, sets claim 60, den = `split_rock`, mate joins, `pride_founded` plays, and the next day is playable. Found is disabled at `highcrag` and `greywater_ford`, allowed at `camel_ridge`.
5. **Found after the window:** a pair mated on day 20 on held land can travel and Found on day 22.
6. **Out-of-season ask rejected:** on day 21+, Court is not offered; a forced call returns `court.notInSeason`, spends no day, no attempt and no value.
7. **Admission is harder out of season:** same state, Ask to join in window vs out: points differ by exactly −15 (`outOfSeasonJoin`); a refusal applies −5 relation, blocks that pride until the next 20-day block, and the next ask gets −5 more.
8. Bond carry-over: Talk/Groom/Share on day 25 change value as in window; `bondStage` persists.
9. Day-20 edge cases §4.3–§4.5: an accept on day 20 resolves before `season_end`; a pride-cat chain still pending lapses with no bond.
10. Save on day 20 before resolving reloads to day 20; save after reloads to day 21 and `season_end` does not replay.
11. v0.1.4 migration: in-progress continues; day-20-ended save reopens into `season_end` → day 21; death save stays ended.
12. `repeat_meeting` on a second encounter; Seek out guarantees a met cat's meeting and is not offered for unmet cats; value 25 without the `close` beat does not unlock Court.
13. Cub/adolescent, `r` ≥ 0.125, incompatible attraction, already-mated and value ≤ −15 never roll; attraction decline does not change value. Over 100k Standard asks at value 30, sociability 50, compat 0, relation 0: accept ≈ formulas §2.6 value ± 1%.
14. Pride-cat courtship does not set `mates` until approval (and any rival) completes. Death mid-courtship applies no mate. Slice hunt/rest/travel/hazard/first-meeting tests still pass.
15. Mate death after the window: run continues, milestone kept, pride kept.

## 7. Blockers vs future

| Item | Blocks this milestone? | Owner |
|---|---|---|
| Personality (5 traits), hidden attraction and kinship `r` on the 39 slots (world-gen §5–§6) | **Yes** (gates, first-pair modifiers, Saga voice variants) | Flint, using world-gen-spec |
| `calendar.json` (`matingWindowDays`, `yearLengthDays: null`) and `absDay` | **Yes** (new) | Flint |
| `lonerGroups[]` persistence and §5b.2 formation at block end (any sex mix) | Yes for route (b) only; (a) and (c) ship without it | Flint |
| Memory fields in §10 (`meetCount`, `lastMeetDay`, `lastTalkIntent`, `lastArrival`) | No — Saga lines that use them stay disabled until present | Flint |
| Saga copy for §10 (stubs allowed) | No | Saga |
| Next-year mating window reachable | No — needs Anna's year length (§9.1); flagged | Anna / Director |
| 40 complete-cat PNGs; PR #1; map layout approval | No | Ochre / Flint / Anna |
| Warmth, named later seasons, recruiting, co-found, pride larder, Heir, new fights, skills, cubs | No — **future / deferred** | — |

**Scope note (Director, 2026-11-07):** Flint's current QA / 40-portrait milestone does **not** depend on any blocker in this table. The personality, attraction, kinship, calendar, `lonerGroups[]` and memory-field work belongs only to the following relationship / season milestone. Saga's contract-v0.2 is content, not proof of runtime support.

## 8. Asks

**Flint (≤ 5).** (1) Persist world-gen personality, hidden `attraction` and `r` per NPC at `newRun` and through migration. (2) Add `absDay`, `calendar.json` and `inMatingWindow`; no rollover or skip. (3) `season_end` at end of day 20 (once), then continue; Found fires `pride_founded`, not a run end. (4) New `action.type`s: Seek out, Court, Found, Patrol, Mark, Ask to join, Ask to join group, Leave group. (5) Persist the §10 fields, including the memory fields.

**Saga (≤ 5).** See §10.1 mismatches: rename route triggers, add `season_end.mated_founded`/`mated_unfounded`, add admission and group results, split pride tokens, keep memory lines behind their fields.

## 9. Open decisions for Anna (≤ 4)

1. **How long is a year (how many 20-day seasons) before the next mating season opens?** Proposed default: undecided; the build stores `yearLengthDays: null` and the next window is not reachable until you choose. No skip will be added.
2. **When the player founds, does a pride-cat mate leave their origin pride to be the first member?** Proposed default: yes (§3.6.3). If no, only loner mates can found with the player.
3. **Does a same-sex mate (approved as non-breeding, relationships §1.8) count as securing a mate for this goal?** Proposed default: yes.
4. **Who can form or join a loner group?** Proposed default (§3.8.7): any adult loner of any sex; groups may be male, female or mixed; the player of either sex may ask to join. Today only male bachelor bands are written (loners §5b), so this widens them. Not assumed approved.

Everything else in this spec is a proposed default that Tundra owns.

## 10. Content contract for Saga

One reusable arc, bound by the engine to whichever eligible cat is being courted, plus season-end routes. Reconciled with Saga's `contract-v0.2` (13 families). **Flint is not blocked on these scenes.**

Common keys (APPROVED, slice-1): `id`, `trigger`, `stage`, `cast` (`A` player, `B` candidate, `C` only when noted), `beats[]`, `choices[]` of `{ id, label, summary, result }`, optional `voiceVariants[]` of `{ when, replaceBeat, speaker, text }`, `summary` ≤ 100 characters with a 12-character name. Never infer from a reply: a new relationship type, trespass rights, food beyond Share, membership, or immunity. The engine owns routing, numbers and time.

| Stage | `trigger` | Results / variants | Cast | Notes |
|---|---|---|---|---|
| First meeting | `first_meeting` | reuse slice entries | A, B | Saga's `m2.first_meeting.reuse` accepted. |
| Repeat meeting | `repeat_meeting` | — | A, B | PROPOSED; replaces a blank day. Accepted. |
| Acquainted | `acquainted` | — | A, B | value ≥ 15, player chooses. |
| Close | `close` | — | A, B | value ≥ 25; unlocks Court. UI label "Bonded" (Director: reversible wording, not a blocker; Saga may change it). |
| Courtship | `courtship` | `accepted` / `declined` / `declined_attraction` | A, B | In window only. |
| Leader approval | `leader_approval` | `approved` / `refused` | A, B, C = leader | |
| Mate rival | `mate_rival` | `challenge_start` / `won` / `lost` | A, B, C = rival | Non-lethal. |
| Mates confirmed | `mates_confirmed` | choices `acknowledge`, `found_here` (wild only) | A, B | Fires `mate_secured`. |
| Pride founded | `pride_founded` | — | A, B | **Non-terminal** celebration; any day, in or out of window. Replaces `founding`. |
| Season end | `season_end` | `mated_founded` / `mated_unfounded` / `unmated` (unmated recap keyed by `{bestStage}`) | A, optional B = mate or best pair | End of day 20, once; then day 21. |
| Pride admission | `pride_admission` | `attempt` / `accepted` / `refused` | A, C = leader | Out-of-season join (§3.8a). |
| Loner group | `loner_group` | `meet` / `join` / `refused` | A, C = group member | §3.8b. |
| Solo continue | `solo_continue` | — | A | Flavour for route (c). Plays once if the player picks the alone intent. |

### 10.1 Reconciliation with Saga's contract-v0.2 (Tundra rulings)

1. **`repeat_meeting`, `acquainted`, `close`, `courtship`, `leader_approval`, `mate_rival`, `mates_confirmed`:** ids and result sets match. Accepted as stubs.
2. **`founding` → rename `pride_founded`.** Saga's text is already celebration-only; keep it.
3. **`season_end`:** accepted as the trigger id (no longer pending). **Saga must change:** key variants by `mated_founded` / `mated_unfounded` / `unmated`; keep the six `{bestStage}` recap lines inside `unmated` (the `mates` line becomes `mated_unfounded`); add a `mated_founded` line. The three route choices (`route_pride`, `route_group`, `route_alone`) are accepted as **intent only** (set `player.routeIntent`, no lock, no cost). In `mated_unfounded`, swap them for a "you can still found" line (founding after the window is allowed, §3.7.4 PROPOSED).
4. **`route_start.pride` / `route_start.loner_group` / `route_start.solitary`, stage `post_season`:** **Saga must change** to `pride_admission.attempt`, `loner_group.meet` and `solo_continue`. Add results `pride_admission.accepted` / `refused` and `loner_group.join` / `refused`. Stage field for these = `post_window`.
5. **Talk choice ids:** Saga's `talk_warm` / `talk_plain` / `talk_curt` (and `stay`/`speak`/`go`) map to results `talk_improve` / `talk_unchanged` / `talk_worsen` = slice-1 `affinityIntent` +5/0/−5. Accepted. Existing slice first-meeting ids stay as they are.
6. **Personality variants:** supported once Flint persists world-gen personality (§7 blocker). Bands, PROPOSED: `high` ≥ 70, `low` ≤ 30 on `aggression`, `sociability`, `boldness`, `loyalty`, `curiosity`. Saga's sociability, aggression and boldness selectors are accepted. No selector may read `attraction` or `r` (hidden). Personality never routes accepted/declined.
7. **Seek-out arrival variant:** supported via `lastArrival` = `seek_out` | `chance`. Accepted.
8. **Prior-choice memory:** supported through the new fields `meetCount[id]`, `lastMeetDay[id]`, `lastTalkIntent[id]` (`improve`/`unchanged`/`worsen`/`groom`/`share`, last meeting only). Lines may read those fields only. No free-text memory.
9. **Pride tokens:** `{originPrideName}` = the cat's AI pride (replaces `{faction}`/`{prideName}` for the origin). `{newPrideName}` = the player-named pride from Found. **Saga must change** `{prideName}` in founding to `{newPrideName}`.
10. **UI hints:** accepted. Add `court.notInSeason` (in use after day 20), `join.cooldown`, `group.full`.

**Variables:** `{catName}`, `{playerName}`, `{region}` / `{regionName}`, `{day}`, `{originPrideName}`, `{newPrideName}`, `{leaderName}`, `{rivalName}`, `{groupName}` (optional, else "the loners"), `{band}`, `{bestStage}` (`none`/`met`/`acquainted`/`close`/`courting`/`mates`). There is no `{season}` name after spring (§3.1.5).

**Persist (engine):** pair `value` / `kinds` / flags, `met`, `bondStage[id]`, `courtshipLastDay[id]`, `meetCount[id]`, `lastMeetDay[id]`, `lastTalkIntent[id]`, `lastArrival`, `leaderApproval[prideId]`, `admissionLastBlock[prideId]`, `admissionRefusals[prideId]`, `rivalChallenge[id]`, `player.mateId`, `player.status` (`loner`/`member`/`group`/`founder`), `player.prideId`, `player.groupId`, `player.routeIntent`, `player.denRegion`, `newPrideName`, `milestones[]`, `seasonEndShown`, `absDay`, `lonerGroups[]`, `usedEvents`, `pendingArc`. **PROPOSED DEFAULT** (§11.3–§11.4, `conversation.persistPending=true`): additionally persist per-cat `conversationLog[]`, `memoryFacts[]`, `activeFactIdsByTopic`, `followUpHooks[]`, `lastConversationDay`, `lastInitiatedDay`; run `conversationSlotDay`, `conversationSequence`, `appliedConversationChoiceIds`; extend `pendingArc` with `catId`, `arcInstanceId`, `nodeId`/`beatIndex`, `pendingChoiceIds`, `presentedFactIds`, `startedAbsDay`, `slotCharged`, accumulated absolute delta and completion marker. Keep world-gen identity/name/personality unchanged; fact/receipt ids survive display-log pruning. **PROPOSED DEFAULT** (§12): also persist `worldMemory` `{ schemaVersion, prideToPlayer, prideToPride, ledger[], factKnowledge{}, agreements[], councils[], lastCouncilAbsDay }` (cat→player value is the existing pair/`affinity` number, not a second store). **PROPOSED DEFAULT** (§13): also persist `encounters` `{ log[], cooldowns{}, pendingEncounter }` and reuse `injuries[]`.

**Choice consequences:** `talk_*` +5/0/−5; `groom` +5 if ≥ 20; `share` +10 after a hunt; `court` consumes the attempt and the engine rolls; `accepted`/`declined` as formulas §2.3; `declined_attraction` no change; `approved`/`refused` as formulas §3.3; `challenge_won`/`lost` as formulas §4.4; `pride_admission.refused` −5 relation; `loner_group.refused` −5 value with each member; `route_*` intents and `acknowledge` no delta. A choice never sets `mates`, membership or Found unless it is the engine-selected result.

## §11 Recurring conversations (gameplay rules)

**ANNA-APPROVED** (Anna via Director, team instruction 2026-11-07): “recurring consistent characters and real ongoing conversations, rather than one-line pass-bys.” New numbers below are tunable proposals, not approvals; engine-field names are suggestions for Flint, not claims of runtime support.

### 11.1 Repeat-meeting access
1. **APPROVED** (loners §2.1/§2.3; §3.2.1): chance meetings use existing home zones and home/adjacent encounter rolls; no new population or encounter rolls.
2. **PROPOSED DEFAULT** (`conversation.catCooldownDays=2`, `conversation.maxPerDay=1`): after talking on day D, that cat is eligible on D+2; one conversation globally per day, including first contact. Show next eligible day and legal meeting location on the known-cat card; an encounter during cooldown is a greeting only, not an arc reset.
3. **PROPOSED DEFAULT** (`conversation.seekOutGuarantee=true`): reuse §3.2.5 Seek out for known, living cats off cooldown: retain its main-action/travel/Energy costs and guarantee arrival meeting when legally reachable. Disable with reason before spending an action if cooldown, daily slot or route blocks it; no guaranteed first contact. This is the reliable cadence; random meetings are not its substitute.
4. **PROPOSED DEFAULT** (`conversation.prideAccess='border_or_neutral'`): an unadmitted player meets pride cats only at a legal border/neutral rendezvous adjacent to their range. Seek out/Court travel there rather than an interior den (access refinement of §3.2.5/§3.5.2); admission permits interior meetings. Bonds confer no entry rights and trespass rules remain separate.
5. **PROPOSED DEFAULT** (`conversation.npcInitiateMinValue=50`, `conversation.npcInitiateCooldownDays=5`): a known cat at value ≥50 may offer one visit when the player ends a day in its home/rendezvous zone. Use the existing meeting event slot and both cooldowns; choose oldest due follow-up, then catId. Declining is neutral, does not spend the conversation slot, and still stamps the visit cooldown; no map-wide teleport or spam.

### 11.2 Time, needs and interruptions
1. **PROPOSED DEFAULT** (`conversation.timeMode='side_slot'`, `conversation.baseBeats=4`, `conversation.minBeats=3`, `conversation.maxBeats=5`): one multi-turn conversation slot alongside the single main action, not a second day or fractional calendar turn. Each beat presents authored choices and a response; moving through beats never ticks the calendar. Seek out remains a main action; an incidental conversation may accompany Hunt/Rest/Travel.
2. **PROPOSED DEFAULT** (`conversation.energyCost=3`, `conversation.hungerCost=2`, `conversation.thirstCost=1`): charge these once when the player accepts the first conversational choice, in addition to ordinary overnight needs and any Seek out/groom cost. Greeting/decline costs zero. The slot/day and per-cat cooldown start on that first commitment, including an early exit; resume never charges again.
3. **PROPOSED DEFAULT** (`conversation.leaveEarlyDelta=0`): offer neutral leave at every beat; keep committed facts/effects, do not invent unfinished answers or complete unchosen stage beats. Later meetings resume the saved arc node, not the greeting. Readability constraint only (`conversation.uiKeepCastAndChoicesVisible=true`): speaker/name/portrait remain visible while long text scrolls; choices stay reachable on-screen.
4. **PROPOSED DEFAULT** (`conversation.hungerCriticalBelow=10`, `conversation.interruptOnHazard=true`): critical Hunger blocks new talk and pauses active talk at the next choice boundary; an existing hazard takes priority and pauses before any unchosen effect. No extra hazard roll or overnight tick per beat. Resume at the next eligible meeting; no penalty for interruption; death discards pending choices (§4.2).
5. **PROPOSED DEFAULT** (`conversation.eventBudget='existing_one'`): replace, never add to, slice-1's one daily offline event; resolve hazards first. Offer a safe meeting before the overnight/season-end transition. If interrupted before a choice, preserve it pending rather than awarding a response.

### 11.3 Consequences and meaningful follow-ups
1. **APPROVED** (slice-1 IN §7; §10.1.5): authored `affinityIntent` improve/unchanged/worsen remains +5/0/−5; reuse `talk_warm/plain/curt` → `talk_improve/unchanged/worsen`, `stay/speak/go`, and original first-meeting choice ids unchanged.
2. **PROPOSED DEFAULT** (`conversation.affinityMode='slice_exact'`, `conversation.maxImprovePerCatDay=1`, `conversation.absDeltaCap=10`): each committed beat may carry that intent, but only the first improve per cat/day gives +5; later improve beats give 0 numerically while still recording stance. Cap the sum of absolute conversation deltas at 10 (no alternating-sign farming), including hooks, share and groom; pair/day caps, floors and grudge limits still apply (relationships §2.4/§1.4). In this slice, no personality multiplier on these exact talk deltas; this explicitly overrides relationships §2.2 for talk only.
3. **PROPOSED DEFAULT** (`conversation.factSchema=1`): record `{factId,catId,topicId,stanceId,sourceChoiceKey,absDay,sequence,promise,insult,help,supersedesFactId,status}`; promise status is pending/kept/broken, other flags are explicit booleans. IDs derive from run/cat/arc-instance/node/choice/fact-key; not text or translated labels. Saga authors topic/stance keys; Flint validates them.
4. **PROPOSED DEFAULT** (`conversation.promiseKeptDelta=5`, `conversation.promiseBrokenDelta=-5`): next eligible meeting offers a follow-up based on a recorded promise. Keeping the agreed share/help condition gives +5 once; explicitly breaking it gives −5 once. Absence or a hazard delay never means broken. Resolving a promise is a terminal fact transition, not a repeatable reward.
5. **APPROVED** (loners §2.4; §3.2.3/§3.2.4): `share` requires today's successful hunt and gives +10; groom requires value ≥20 and gives +5, with its proposed Energy cost retained. **PROPOSED DEFAULT** (`conversation.shareReplacesPromiseBonus=true`): a share that fulfils a promise uses +10 only, not +15; gift/share requests create no inventory or free food. No additional help-against-threat system is introduced.
6. **PROPOSED DEFAULT** (`conversation.requireMaterialFollowUp=true`): at least one remembered fact must change available choice ids or their outcome (e.g. kept promise unlocks confiding; broken promise offers repair instead). A callback greeting alone does not pass. New contradictory stance supersedes the prior active fact by `(absDay,sequence)`; retain both in history, surface only the active truth. Character biography cannot be rewritten by player assertion.
7. **PROPOSED DEFAULT** (`conversation.idempotentChoices=true`): commit consequence ids, fact changes, affinity/rewards/costs, cursor and choice receipt atomically under `runId/catId/arcInstanceId/nodeId/choiceId`. Double-click, Enter, reopen and load reuse the same receipt; no second application. Save before commitment keeps that choice pending; save after commitment keeps its effects and next cursor, never rolls them again.

### 11.3a Outcome mapping for Saga's `m2.repeat_meeting.conversation` (v0.4.1, PROPOSED DEFAULT, tunable `conversation.outcomeDelta.<outcomeId>`)
1. **Affinity applies once per conversation at its terminal outcome**, not per beat (supersedes per-beat wording in §11.3.2 for authored arcs). One receipt: `runId/catId/arcInstanceId/outcomeId`. Still subject to the absolute-10 cap and pair caps.
2. **Beat count:** 3–5 is a maximum guideline, not a minimum. Arcs may end at 2–3 choices.
3. **Early exit / charging:** the opening `leave` (`left_politely`, `later_left`) is a decline: 0 affinity, no needs cost, no slot use, no cooldown. Any other opening choice is the first commitment: it charges −3/−2/−1 once, uses the slot and starts the 2-day cooldown, even if the cat or a hazard ends it later.
4. **First meeting:** +5 for `quiet_company`, `gave_space`, `repaired_pressure`, `asked_about_trust` and `asked_about_hunting`. 0 for `quiet_no_promise`, `prefers_direct_words` and `prefers_solo_hunts`. −5 for `dismissed_boundary`. `left_politely` is 0.
5. **Promise:** `quiet_company` via `return_quiet` records promise `return_quiet` (pending). Coming back to that cat later, at any meeting, resolves it as kept: +5, inside that conversation's cap. It never resolves as broken (absence isn't breaking, §11.3.4).
6. **Later meeting:** +5 for `quiet_renewed`, `space_understood`, `boundary_respected`, `trust_response`, `direct_understood` and `later_listen`. −5 for a follow-up that repeats the original offense (`need_words` after `dismissed_boundary` only). Every other later outcome is 0, including `later_left`. No later outcome rewrites first-meeting facts; it adds a newer fact for the same topic.
7. Saga keeps outcome ids stable. Any new outcome id defaults to 0 until I map it.
8. **Promise receipt (v0.4.2):** the `return_quiet` promise is kept only when the player comes back to that cat and commits a non-leave opening choice. Then it gives +5 once, within that conversation's cap, under receipt `runId/catId/promiseFactId`. An immediate free Leave keeps it pending: no reward, no charge, no cooldown.
9. **First-contact greet (v0.4.2):** when `slice.meeting.loner` `greet` flows into an authored arc in the same meeting, greet's +5 is not applied separately. That conversation's whole affinity result is the terminal outcome delta (plus the promise, if any), under one receipt. `pass`/`drive` and a greet that doesn't enter an arc keep the slice-1 +5/0/−5 as is.
10. **Third meeting (v0.6.4, PROPOSED DEFAULT, per item 7):** +5 for `third_confide_listen` and `third_repair_offer`. 0 for `third_confide_limit`, `third_distance`, `third_neutral_go` and `third_neutral_stay`. These reuse the later-meeting values, with no new number. The label "I'll come back and find you" is fine because it is the tracked `return_quiet` promise (items 5 and 8).

### 11.4 Gameplay memory
1. **PROPOSED DEFAULT** (`conversation.logMaxEntries=30`): per-cat `conversationLog[]` records conversationId, day, topic/choice/fact ids and summary, pruning oldest display entries only. Keep separate `memoryFacts[]`, `activeFactIdsByTopic`, `followUpHooks[]`, `lastConversationDay` and `lastInitiatedDay`; log pruning must not erase unresolved promises, active facts or deduplication receipts.
2. **PROPOSED DEFAULT** (`conversation.memoryDecayDays=null`): no conversation-memory decay in this milestone; existing affinity decay is a separate relationship rule. Next-meeting recall priority: due promise resolution → unresolved insult/repair → recent help/share → newest active stance → personality greeting; ties use newest sequence, then factId. Capture prior memory before updating meetCount/lastMeetDay/lastTalkIntent (§10.1.8).
3. **PROPOSED DEFAULT** (`conversation.persistPending=true`): extend `pendingArc`, not a parallel story runner, with catId, arcInstanceId, nodeId/beatIndex, pendingChoiceIds, presentedFactIds, startedAbsDay, slotCharged and accumulated absolute delta. Persist `conversationSlotDay`, monotonic `conversationSequence` and `appliedConversationChoiceIds`; Continue resumes the same person and cursor. A completed arc never restarts on a repeat greeting.

### 11.5 Personality influence
1. **APPROVED** (world-gen §1.3, §5, §9): personality is rolled at world generation and saved per cat; neither greeting, meeting, Continue nor loading rerolls it. Use run names/slot identities, never narrative-lean values as runtime personality.
2. **PROPOSED DEFAULT** (`conversation.traitHigh=70`, `conversation.aggressiveBeatLimit=3`, `conversation.sociableBeatLimit=5`): aggression ≥70 limits voluntary talk to 3 beats; otherwise sociability ≥70 permits 5, baseline 4. Aggression wins ties; neutral leaving remains available. Mandatory remembered resolution replaces a filler beat, not the memory itself. Other traits select Saga voice/stances, not extra numerical rewards; exact deltas remain §11.3.

### 11.6 Mating window and continuing survival
1. **PROPOSED DEFAULT** (`conversation.useExistingBondGates=true`): exchanges may carry §3.3 acquainted/close beats at value ≥15/≥25, but only a chosen, completed beat advances stage; numbers alone do not. Bond scenes must not auto-set friendship kinds, crushes or mates.
2. **APPROVED** (§3.4; formulas §2.1/§2.4): Court may be an in-conversation branch only after eligibility and the existing 5-day attempt gate. Out-of-window talk still builds bonds but cannot create a new mates bond. **PROPOSED DEFAULT** (`conversation.windowBoundary='before_season_end'`): resolve day-20 conversation before season_end; if transition interrupts it, resume neutral dialogue on day21, revalidate Court on commit, and lapse pending courtship chains per §4.4–5. No backdating.
3. **ANNA-APPROVED** (Anna via Director, quoted at top): “The mating season is over if the 20 days are up.” **PROPOSED DEFAULT** (`calendar.yearLengthDays=null`): retain §3.1 calendar, no invented year length/skip, no breeding; days21+ preserve these conversation rules and survival actions.

### 11.7 Input and shared contract
1. **PROPOSED DEFAULT** (`conversation.inputMode='authored_choices'`): authored choice ids are the baseline, using §10 `beats[]`/`choices[]` and existing trigger/result ids; Saga supplies branching text, stable facts and voice, Flint owns validated routing/persistence. This extends §10.1.8's limited memory, not proof any draft selector already runs. Free-text was not specified by Anna.

### 11.8 Tracker acceptance gate (authored-choice baseline)
All ten are **PROPOSED DEFAULT** gate cases (`conversation.acceptanceProfile='recurring_v1'`), testing the rules above; none claims a completed runtime pass.
1. Meet the same slot three times via normal play; preserve run name, portrait identity, stable facts and all five personality traits across save/Continue; never read authoring lean as personality.
2. Save before a choice: same pending choice and no effect after Continue. Save after: correct next node, committed memory/affinity and exactly one time/needs charge.
3. Double-click/Enter/reopen/load the same choice: affinity, rewards, fact transition, costs and slot charge occur once only; display-log pruning does not remove deduplication protection.
4. Repeat greetings/cooldown encounters cannot restart or re-reward the arc; completing it keeps its end marker after Continue.
5. A remembered kept/broken promise changes options or outcome next meeting; no expired-but-unresolved promise is falsely declared broken.
6. Supersede a stance, then reload: only newest active fact surfaces, both remain in history, stable biography stays unchanged; deterministic recall priority holds.
7. Incidental talk plus Hunt/Rest/Travel uses one main action and one overnight tick; 3/4/5 beats have one side-slot charge; early leave/interruption retains committed effects without a second charge.
8. D+2 per-cat cooldown, global one/day and 5-day high-bond visit cooldown hold; off-cooldown legal Seek out guarantees a known-cat meeting, and pride interiors stay gated by admission.
9. Day20 transition mid-conversation: normal talk survives into day21 if paused, season_end fires once, Court never commits out of window, lapsed chains follow §4, yearLengthDays stays null and play continues.
10. Exact talk deltas, one improve/day, absolute-10 conversation cap and existing pair caps hold; long text keeps cast/choices reachable; hazards/critical Hunger interrupt without fabricated replies. Free-text has no acceptance claim: any future mode needs a separate parsing/validation/continuity gate before enabling it.

### 11.9 Smallest vertical slice
1. **PROPOSED DEFAULT** (`conversation.sliceCatIds=['ln05']`, `conversation.sliceMeetingCount=3`): use the existing Duskrunner-role slot ln05 (world-gen §2; lore homeZones ice_wall/split_rock), with the run-generated name and personality. One cat is sufficient; no new roster. Meeting1 reuses `slice.meeting.loner` (`greet/pass/drive`) and records a chosen topic/promise; meeting2 reuses `m2.repeat_meeting` and resolves it through a meaningful branch; meeting3 remembers that resolution and offers confiding or repair. Seek out makes repeats reachable; Saga writes text and assigns existing talk/share/stay/speak/go ids where appropriate, not Tundra.
2. **PROPOSED DEFAULT** (`conversation.reuseDrafts=true`): extend Saga's contract-v0.3 and slice-polish sources, not a disconnected pack. This rules slice depends on Flint's persisted identity/personality, §10 fields, pendingArc and atomic receipts; it does not authorize a competing writer or assert the portrait checkpoint ships it.

### 11.10 Open decision for Anna
1. **PROPOSED DEFAULT** (`conversation.inputMode='authored_choices'`): keep authored choices for this milestone, or request a separately scoped free-text mode? No other new Anna decision; tunables remain Tundra's proposals and existing §9 questions stay unresolved.


## §12 World memory: relationships and factions

**Scope (Director, relaying Anna, 2026-11-07):** a persistent world-memory foundation for CYOA roleplay — remembered player choices, a distinct personal relationship with each cat, and faction relationships between prides. This is storage and update rules, not a large simulation. First consumers: the ln05 three-meeting proof (§11.9, personal) and one authored faction consequence (§12.6.5). Flint integrates on the gameplay branch (versioned entity IDs, ledger, receipts, save migration). Saga writes story conditions/effects that read and write this state and distinguishes world facts from what a cat knows. Tracker tests isolation, directionality, migration, exactly-once application, and known-vs-unknown facts. Does **not** gate the portrait checkpoint at `9f38415`. No new art, no breeding, no free-text input, no invented year length (`yearLengthDays` stays `null`, §3.1 / §9.1).

Every rule below is labeled **ANNA-APPROVED**, **APPROVED** (spec citation), **APPROVED-by-Director / pending Anna** (Director wording not separately approved by Anna), or **PROPOSED DEFAULT** (tunable). Unresolved balance stays proposed; foundational storage is not delayed for those numbers.

### 12.1 Entities and stable IDs

1. **APPROVED** (world-gen §2, §6.2): every premade cat has a stable `catId` (`hc01`…`hc11`, `bf01`…`bf10`, `mw01`…`mw09`, `ln01`…`ln09`). The player cat's stable id is `player.catId`, assigned at New Game and unchanged on Continue.
2. **APPROVED** (world-gen §2 / slot `prideId`): the three AI prides are `highcrag`, `bonefield`, `mistwood`. **PROPOSED DEFAULT:** the player's founded pride uses `player.prideId`, set at Found to `founded` (one player pride this milestone). Display name remains `newPrideName` (§10). Until Found, the player has no pride entity.
3. **APPROVED** (loners §5b.1): a loner group / bachelor band is not a pride. **PROPOSED DEFAULT:** groups keep `groupId` from `lonerGroups[]` / `bandId` (§3.8.9, loners §5b.8). They do not receive `prideToPride` records. Member `catToPlayer` values remain the personal store; a separate `groupToPlayer` standing is deferred.
4. **APPROVED** (map-v1 §8–§9): the `wolves` map faction is not a playable pride. Wolf stance records are deferred.
5. **PROPOSED DEFAULT (`worldMemory.schemaVersion=1`):** persist `worldMemory.schemaVersion` beside the existing `saveVersion` (§3.9). Bumping `saveVersion` itself is Flint's call if the save envelope requires it. Entity IDs never reuse a retired id in the same run.

### 12.2 Directed records

Direction is `from → to`. Opposite directions are separate records, except where an existing approved system is symmetric.

**A. Personal meter: cat → player (`catToPlayer`)**

1. **APPROVED** (loners §2.4, relationships §0.1, this spec §3.2.2 / §11): the personal number **is** the existing pair value / `affinity` (−100..+100, integer). There is no parallel meter. First stored pair starts at 0, then +10 if that cat's `sociability` ≥ 70 and −10 if `aggression` ≥ 70, plus compat/2 (relationships §3.3).
2. **ANNA-APPROVED** (Anna via Director, 2026-11-07): the cat→player meter uses the range −100…+100 and the negative / zero thresholds below. **APPROVED** (loners §2.4): existing affinity is already this range and starts at 0. Migration is 1:1 (§12.7). Never reinterpret a neutral midpoint as +50.
3. **No separate `playerToCat` value (PROPOSED DEFAULT, prefer only what is needed).** Relationships §0.2 (**APPROVED**) keeps pair *value* symmetric; asymmetry already lives in flags (crush, grudge). The player's stance is their chosen actions, not a second hidden number. Do not store `playerToCat`.
4. **Romance / bond stages stay separate (APPROVED, §3.3).** `met` / `acquainted` / `close` / `courting` / `mates` keep their own gates and chosen beats. Reaching a personal-meter label never auto-advances a bond stage, and a bond stage never overwrites this meter.
5. **Faction standings stay separate (PROPOSED DEFAULT).** `prideToPlayer` and `prideToPride` are different records with their own bands (§12.2 C–D). A personal label does not rename or recode a pride standing.
6. **Band membership (Tracker: evaluate in this order; clamp first to −100..+100).** Negative bands use `value ≤ threshold` and take the **lowest** (most severe) matching threshold. Positive bands use `value ≥ threshold` and take the **highest** matching threshold. Neutral is the open interval (−15, +15).

| `bandId` | Label | Membership (after clamp) | Label status |
|---|---|---|---|
| `permanent_rival` | Permanent Rival | `value <= -100` (only −100) | **ANNA-APPROVED** |
| `hated` | Hated | `-100 < value <= -80` | **ANNA-APPROVED** |
| `despised` | Despised | `-80 < value <= -60` | **ANNA-APPROVED** |
| `disliked` | Disliked | `-60 < value <= -30` | **ANNA-APPROVED** |
| `eyesore` | An Eyesore | `-30 < value <= -15` | **ANNA-APPROVED** |
| `neutral` | No Opinion/Neutral | `-15 < value < 15` (i.e. −14..+14) | **ANNA-APPROVED** (zero point and the open interval) |
| `welcome` | A Welcome Face | `15 <= value < 30` | **APPROVED-by-Director / pending Anna** |
| `liked` | Liked | `30 <= value < 60` | **APPROVED-by-Director / pending Anna** |
| `close_friend` | Close Friend | `60 <= value < 80` | **APPROVED-by-Director / pending Anna** |
| `cherished` | Cherished | `80 <= value < 100` | **APPROVED-by-Director / pending Anna** |
| `unbreakable` | Unbreakable Bond | `value >= 100` (only +100) | **APPROVED-by-Director / pending Anna** |

   Boundaries owned by the named non-neutral band: −100, −80, −60, −30, −15, +15, +30, +60, +80, +100. Examples: −15 = An Eyesore (not Neutral); +15 = A Welcome Face; 0 = No Opinion/Neutral; +50 = Liked; −50 = Disliked.
7. **`permanent_rival` is a label only (PROPOSED DEFAULT).** Do not add an irreversible lock, blocked recovery, or special decay freeze beyond existing grudge rules (relationships §1.4 / §2.3). Whether Permanent Rival should later become a lock is an **open question for Anna** (§12.11).
8. **§11 visit threshold vs these bands.** **PROPOSED DEFAULT** (`conversation.npcInitiateMinValue=50`, §11.1.5): a known cat at value ≥ 50 may offer a visit. That cut sits inside Liked (30..59), above A Welcome Face and below Close Friend (60). It still reads as a high-Liked personal gate, not a faction gate. **Do not silently snap it** to 30 or 60 this pass. Note for Director/Anna: snapping to Liked (≥ 30) or Close Friend (≥ 60) is a later tunable if they want the visit gate on a named edge.
9. Player-facing copy of labels is Saga's; `bandId` values above are the engine/Saga condition ids. Legacy relationship internal bands (`hostile` ≤ −50 … `close` ≥ +50, relationships §1.3) remain the ids for pair-kind / contentment rules and for faction records. They are **not** the personal-meter labels.

**B. Cat → cat**

10. **APPROVED** (relationships-spec §1): cat↔cat already exists as a sparse symmetric pair record plus directional flags. **PROPOSED DEFAULT:** do not add a second directed `catToCat` store this milestone. Existing pairs, `seedFlags` (world-gen §6.4) and kinds stay as written.

**C. Pride → player standing (`prideToPlayer`)**

11. **APPROVED** as the existing “pride relation with the player” (formulas §3.2, map-v1 §8.3 trespass −5, loners §4.2 mate +20, formulas §3.3 / this spec §3.8 admission refusal −5). Range −100..+100, integer, clamp after every change.
12. **Directed `pride → player` only (PROPOSED DEFAULT).** Do not store `player → pride`; the player's stance toward a pride is their actions.
13. **Starting default (PROPOSED DEFAULT, derived from existing examples):** each AI pride starts at 0 toward the player (formulas §3.4 / this spec §3.8.3 worked examples use relation 0). After Found, `founded →` is not used as standing toward the player (the player *is* that pride).
14. **Standing bands (PROPOSED DEFAULT):** reuse relationships §1.3 *internal* ids and cuts, not the personal-meter labels: `hostile` ≤ −50, `cold` −49..−15, `neutral` −14..+14, `warm` +15..+49, `close` ≥ +50. Player-facing standing copy is Saga's.

**D. Pride → pride faction stance (`prideToPride`)**

15. **PROPOSED DEFAULT:** store `A → B` and `B → A` separately. They may differ. Keys are `(fromPrideId, toPrideId)` with `from != to`. Range −100..+100, same standing-band table as §12.2.14.
16. **Starting default (PROPOSED DEFAULT):** every directed pair among `highcrag`, `bonefield`, and `mistwood` starts at 0 unless a later lore seed is approved. No hostility is invented here.
17. **On Found (PROPOSED DEFAULT):** create `founded → P` and `P → founded` for each AI pride `P`, each initialized to that pride's current `prideToPlayer` standing (the loner-era reputation becomes the new pride's opening faction stance). Subsequent personal events do not auto-copy again.
18. Loner groups and `wolves` are omitted (§12.1.3–4).

### 12.3 Cause ledger and receipts

1. **PROPOSED DEFAULT — stored value plus ledger (audit), not “default + sum of every delta” as the live read.** Live reads use the stored integer (pair value, `prideToPlayer`, `prideToPride`). The ledger is append-only audit and the exactly-once record. Justification: v0.4.x saves already store affinity / relations as current numbers with no historical events; recomputing from a reconstructed sum would require inventing history and risks mismatch. The ledger still lets Tracker prove what changed.
2. **Event shape:**
```
{ eventId, absDay, sourceType, actor, target, recordKind, delta, receiptKey,
  factId?, knowledgeScope?, witnessIds? }
```
   `recordKind` is `catToPlayer` | `prideToPlayer` | `prideToPride`. `actor` / `target` are `catId`, `prideId`, or `player`. `sourceType` whitelist: `conversation_outcome`, `promise_kept`, `promise_broken`, `admission_ask`, `admission_refusal`, `territory_trespass`, `hunt_steal`, `fight`, `mate_bond`, `gift_share`, `pride_aid`, `pride_report`, `rumor_spread`, `spillover`, `seen_with_hostile_faction`, `council_convene`, `council_agree`, `council_disagree`, `council_fulfil`, `council_breach`, `migration`, `compaction`.
3. **Exactly-once (PROPOSED DEFAULT, reuse §11.3a receipt format):** if `receiptKey` is already applied, skip the value change **and** the ledger append. Conversation outcomes keep `runId/catId/arcInstanceId/outcomeId`; promises keep `runId/catId/promiseFactId` (§11.3a.8). Those same keys also stamp the `catToPlayer` ledger line (one receipt, one delta). Other keys: `runId/trespass/{prideId}/{absDay}`, `runId/admission/{prideId}/{blockIndex}`, `runId/mate_bond/{prideId}/{catId}`, `runId/spillover/{prideId}/{sourceReceiptKey}`, `runId/seen_with/{observerPrideId}/{factId}`, `runId/rumor/{factId}/{prideId}`, `runId/council/{councilId}/{action}/…`, `runId/migration/{recordKind}/{fromId}/{toId}`, `runId/standing_deed/{prideId}/{deedId}`, `runId/encounter/{encounterId}/{encounterInstanceId}/{choiceId}`.
4. **Apply atomically** with any paired §11 conversation receipt (affinity, facts, costs, cursor). A save before commit leaves the change pending; a save after never reapplies it (§11.3.7).
5. **Ledger cap (PROPOSED DEFAULT, `worldMemory.ledgerCap=200`):** when length would exceed 200, compact the oldest events into one `compaction` summary per affected record key `{recordKind, from, to, netDelta, throughAbsDay, compactedCount}` and drop the originals. Never drop an event whose `receiptKey` is still needed to reject a duplicate of an in-flight choice (keep any event from the current `pendingArc` and the last 30 keys). Display-log pruning (§11.4.1) must not touch this ledger.

### 12.4 Spillover and knowledge

**Key rule (Director / Anna intent, stated as PROPOSED DEFAULT until Anna confirms wording):** personal dislike does **not** automatically equal whole-pride hostility. A single cat at `hated` or `permanent_rival` does not move that pride's standing to `hostile`. Pride standing changes only through explicit ledger events (trespass, admission, mate bond, public spillover, council, faction consequence).

1. **When personal → pride standing may spill (PROPOSED DEFAULT).** After a `catToPlayer` delta for cat C of current pride P (`status: pride` and `prideId = P`; loners and departed cats do not spill to an origin pride):
   - the pride must **know** the cause through a recorded fact: `knowsFact(P, factId)` is true because the fact is `witnessed` by a current P member, `pride_known` to P (rumor or disclosure), or `world_known`. Rank never substitutes for knowledge (v0.5.2): a private talk with P's leader stays private and writes no spillover until a witnessing or disclosure event makes it known.
   - rank only sets the coefficient below.
2. **Coefficients and caps (PROPOSED DEFAULT):**
   - leader (`role === 'leader'`): `spilloverCoeffLeader=0.5`
   - high-rank (the leader's mate, or `role === 'elder'`): `spilloverCoeffHighRank=0.35`
   - other members: `spilloverCoeffMember=0.2`
   - no spill if `|personalDelta| < spilloverMinAbs` (5)
   - per-event standing delta = clamp(round_half_up(personalDelta × coeff), −`spilloverEventCap` , +`spilloverEventCap`) with `spilloverEventCap=5`
   - per 20-day block, spillover from one cat into one pride is clamped to ±`spilloverCatBlockCap` (10)
   - write `recordKind: prideToPlayer`, `sourceType: spillover`, receipt `runId/spillover/{prideId}/{sourceReceiptKey}`
   - **rounding (PROPOSED DEFAULT, v0.5.1):** `round_half_up` here means round half **away from zero** (symmetric): +2.5 → +3, −2.5 → −3, −1.4 → −1. A result of 0 writes nothing.
   - **cap scope (PROPOSED DEFAULT, v0.5.1):** `spilloverEventCap` applies to the **combined** spillover into one pride from one source event. Exactly one spillover line per (pride, source receipt) regardless of how many witnesses there are or which cat is the actor; the receipt key above enforces this across reloads. Private events (`knowledgeScope: private`) write no spillover, whatever the actor's rank.
3. **Pride → pride changes only from pride-level events (PROPOSED DEFAULT):** fights between prides, origin-recruit penalties (loners §3.3, when that system is in play), council agree/fulfil/breach (§12.9), and the seen-with-hostile-faction consequence (§12.6.3). A private conversation never writes `prideToPride`.
4. **Minimal knowledge hook (PROPOSED DEFAULT)** for Saga and Flint: `knowsFact(subjectId, factId) -> boolean` where `subjectId` is a `catId` or `prideId`. Persist `factKnowledge[factId] = { scope, participantIds[], witnessIds[], prideIds[], learnedAbsDay }`.
   Scopes:
   - `private`: only `participantIds` (default: player + the spoken-to cat). Default for §11 conversation facts, including the ln05 arc.
   - `witnessed`: participants plus `witnessIds[]`.
   - `pride_known`: every current member of each listed `prideIds` entry, and `knowsFact(prideId, factId)` is true for those prides.
   - `world_known`: every living cat and every pride.
5. **Rumor spread (PROPOSED DEFAULT, `rumorDaysToPrideKnown=3`):** if a fact is `witnessed` by at least one current member of pride P, then on `absDay >= learnedAbsDay + 3` promote that fact to `pride_known` for P (`sourceType: rumor_spread`, receipt `runId/rumor/{factId}/{prideId}`). No automatic promotion to `world_known`; that scope is set only by an explicit public event (fight, trespass patrol, council, or a Saga/engine effect). Absence of witnesses is not a rumor.

### 12.5 Read hooks and effects whitelist

Saga conditions may read only these hooks (PROPOSED DEFAULT):

| Hook | Returns |
|---|---|
| `affinity(catId)` / `affinityBand(catId)` | cat→player value; §12.2.6 `bandId` |
| `standing(prideId)` / `standingBand(prideId)` | pride→player value; §12.2.14 band |
| `factionStance(fromPrideId, toPrideId)` / `factionStanceBand(...)` | directed pride→pride value and band |
| `hasFact(catId, factId)` | the cat has the fact in history (known or not) |
| `knowsFact(subjectId, factId)` | §12.4.4 |
| `promiseState(catId, promiseFactId)` | `pending` / `kept` / `broken` (§11.3.3) |
| `lastEventOfType(filter, sourceType)` | most recent matching ledger event, or null |
| `agreementState(agreementId)` / `activeAgreements(prideId)` | §12.9 records |

**Effects whitelist (PROPOSED DEFAULT).** Saga may request only: existing §11 / §10 conversation outcomes and promise kept/broken; existing pair effects that already change the personal value (talk/share/groom and relationships §7 `rel.*` when those scenes run); plus `wm.standing.delta` (pride→player), `wm.faction.delta` (pride→pride), `wm.fact.learn` (scope / witnesses / prideIds), `wm.agreement.propose` / `.activate` / `.fulfil` / `.breach`. No free-form memory text. A later meaningful choice must branch on these hooks, not on an invented recollection. World facts (`scope`) are distinct from what an individual cat knows (`knowsFact`).

### 12.6 Where the numbers bite

1. **Admission (do not change frozen formula terms).** **APPROVED** (formulas §3.2): leader approval already adds `+ prideRelation / 2`. `prideToPlayer` **is** that pride relation. **APPROVED** (formulas §3.3; this spec §3.8.2–4): request (b) −10, failure −5 relation, 1 ask per season per pride; **PROPOSED DEFAULT** `outOfSeasonJoin: −15` and extra −5 per prior refusal (max −15) stay as written. No additional admission term is added here.
2. **Trespass tolerance (PROPOSED DEFAULT overlay; base numbers unchanged).** **APPROVED** (map-v1 §8.3): 10% patrol meeting on held land → −5 pride relation; a hostile pride may start a fight. Keep `trespassMeetPct=10` and the −5 write (`sourceType: territory_trespass`). Overlay: if `standing >= 15` (`warm`+), multiply meet chance by `trespassWarmMeetMult=0.5`; if `standingBand === hostile`, the existing “may start a fight” path is eligible. Membership in a pride still removes trespass on that pride's land (§3.8.5).
3. **Visit eligibility.** Personal gate remains §11.1.5 (value ≥ 50; see §12.2.8). **PROPOSED DEFAULT (`visitBlockedIfPrideHostile=true`):** a pride cat does not initiate a visit while that pride's `standingBand` is `hostile`, even if personal affinity ≥ 50. Private liking does not override public hostility.
4. **Personal consequence (first consumer, already specified):** the ln05 three-meeting arc (§11.9 / Saga `recurring-conversation` revision 3). Facts default to `private`. Talking with ln05 (a loner, origin bonefield, departure `left`) does **not** spill to Bonefield standing. Promise `return_quiet` and terminal outcomes stay §11.3a.
5. **Faction consequence example for Saga (PROPOSED DEFAULT, second consumer):** befriending a cat of pride A writes nothing to pride B. If pride B **knows** the player was with a current member of A (`knowsFact(B, factId)`) **and** `factionStanceBand(A, B) === 'hostile'`, write `prideToPlayer` for B by `seenWithEnemyDelta=-3` (`sourceType: seen_with_hostile_faction`, receipt `runId/seen_with/{B}/{factId}`). Private talk with the A-cat does not qualify. Because starting `prideToPride` is 0 (not hostile), Saga should pair this with a pride-level hostile-cross or fight fact, not invent a starting war.

6. **Border introduction policy and the event that sets it (PROPOSED DEFAULT, v0.5.3; for Saga's `m2.border_introduction`).**
   1. **One rule (v0.5.5, supersedes the v0.5.3 mapping and the v0.5.4 wording).**
      - **Two separate records:** the *feud* is the numeric `highcrag → bonefield` edge plus its ledger causes (set only by pride-level events such as the ford dispute). The *ruling* is a committed Highcrag-leader decision event (Saga's request → relay → review). **Only the ruling controls the border response.** The feud is an input to the ruling and is never read directly by the scene.
      - **Scope:** the ruling applies only to requests whose topic explicitly involves Bonefield (`topic.prideId === bonefield`). Unrelated Highcrag introductions ignore both the ruling and the feud.
      - **Ruling selector, first match wins:**
        1. `highcrag → bonefield` ≤ −15 **and** the leader knows a source event for it: `defer_relay`, cause = that event. A ruling **cannot** override a known feud.
        2. `highcrag → player` ≤ −15: `defer_relay`, cause = standing. A ruling cannot override the standing gate either.
        3. `highcrag → player` ≥ +15 (warm or better): `permit_relay`.
        4. Otherwise, use the leader's saved `curiosity`: ≥ 50 (`borderPolicyCuriosityPermitAt`) is `permit_relay`, < 50 is `defer_relay` (caution, not hostility).
        5. If the leader's personality is missing, the review stays unresolved and flagged.
      - **Re-petition:** a `defer_relay` from selector step 4 may be re-reviewed after `borderRepetitionDays` (5) through the same request route. That's how a cautious leader can still reach permit in any seed once the player has earned warm standing (step 3). A step-1 or step-2 deferral stands until its cause changes.
      - **Both outcomes are reachable in ordinary play on every seed.** Defer: trigger the ford dispute, then petition. Permit: petition with no dispute and a curious leader, or earn warm Highcrag standing through the §13.6 witnessed deeds (not talk spillover) and re-petition.
      - Rulings are frozen at commit (no live random draw) and versioned. A new ruling supersedes the old one only through a new committed review event.
   2. **Policy-setting event `m2.ford_prey_dispute`** (no starting feud; stances still start at 0):
      - **Where/when:** the first time the player is in `greywater_ford` on `absDay >= 2`. Map-v1 DRAFT already lists the ford as Highcrag-held and `disputedBy: bonefield` from day 1; this is existing lore, not a new war. Once per run, receipt `runId/ford_dispute/highcrag/bonefield`.
      - **Cast:** one living adult Highcrag member and one living adult Bonefield member, supplied by the engine (saved names, personalities, portraits). If either pride has no eligible adult, the event does not fire.
      - **Fixed faction effect, whatever the player chooses** (the player witnesses it; they don't start it): `highcrag → bonefield` −20 (lands in `cold`), `bonefield → highcrag` −10 (stays `neutral`; directionality demo). `sourceType: hunt_steal`, scope `pride_known` to both prides, `world_known` not set.
      - **Player choices (personal effects only, each a §11.3a-style receipt):** `help_bonefield_cat` gives the Bonefield cat +5 and records fact `player_aided_bonefield` witnessed by the Highcrag cat (so Highcrag knows it after the 3-day rumor rule, §12.4.5); `side_with_highcrag` gives the Highcrag cat +5 and records the mirror fact witnessed by the Bonefield cat; `stay_out` changes nothing. No choice writes a faction delta, and no choice spills over unless §12.4's knowledge gate passes. Saga writes trait-aware lines for both cats.
   3. **Result:** before the dispute, ordinary play reaches `permits_introduction`. After it, Highcrag defers. Saga's `deferred_known_cause` needs that Highcrag guard B individually to know `player_aided_bonefield` (B was the witness, or a disclosure/relay entry exists); otherwise it's `deferred_no_knowledge`. Same personal values plus a changed Highcrag→Bonefield edge give a different branch, which is Tracker's §12.6.5 test.
   4. Recovery: the dispute does not decay in M2. Raising the edge back above −15 needs a later pride-level event (council §12.9), not personal talk.

### 12.7 Migration (existing saves)

1. **Personal meter:** map existing pair value / NPC `affinity` / `affinityToPlayer` 1:1 onto `catToPlayer`. **APPROVED** (loners §2.4): already −100..+100 starting at 0. Do not rescale, do not treat 0 as +50, do not snap onto a band edge.
2. **Pride standing:** if the save already has `relations[prideId]` (§3.9.1), copy 1:1 into `prideToPlayer`. If missing, seed 0.
3. **Faction stance:** if missing, seed the directed AI-pride pairs at 0. If the player has already founded, also seed `founded ↔ P` from current `prideToPlayer[P]` (§12.2.17).
4. **Ledger:** start empty, then append one `migration` event per imported record `{ sourceType: migration, delta: importedValue, receiptKey: runId/migration/{recordKind}/{fromId}/{toId} }`. That event is audit only; do not add `delta` a second time on top of the imported store.
5. **Knowledge / agreements / councils:** empty defaults. `worldMemory.schemaVersion = 1`. Conversation facts, promises, and receipts from §11 migrate unchanged (private unless already scoped).
6. **Personality on old saves (PROPOSED DEFAULT, note for Flint).** **APPROVED** (world-gen §5, this spec §11.5 / §11.9): personality is rolled at world generation from the `personality` stream and persisted per cat; greeting, meeting, Continue, and load never reroll a present value. The slot table's narrative-lean column is Saga flavour only and is **never** applied (world-gen §5.2) — for ln05 that unused lean is 30/75/55/35/75. Founders (both parents `off`) roll each trait `round_half_up(clamp(Normal(50, 15), 5, 95))` (world-gen §5.1). ln05 has hidden sire `off_bf_sire` and dam `off`, so it follows world-gen §5.2 (hidden parents rolled as founders, then the kin formula). Recovery must replay that exact hidden-parent + kin calculation in world-gen §1.5 order; applying §5.1 directly to ln05 is wrong. A save that is missing personality must **deterministically regenerate** it from the saved `worldSeed` plus world-gen §5, never from an invented value, a lean column, or a fresh random draw.

### 12.8 Tuning table

| Key | Default | Status |
|---|---|---|
| personal meter range / start | −100..+100 / 0 | **ANNA-APPROVED** range; **APPROVED** start (loners §2.4) |
| personal negative / zero labels | §12.2.6 | **ANNA-APPROVED** |
| personal positive labels | §12.2.6 | **APPROVED-by-Director / pending Anna** |
| `permanent_rival` lock | none (label only) | **PROPOSED DEFAULT**; open question |
| `playerToCat` store | not stored | **PROPOSED DEFAULT** |
| `conversation.npcInitiateMinValue` | 50 (inside Liked) | **PROPOSED DEFAULT** (§11.1.5); not snapped to a band edge |
| `visitBlockedIfPrideHostile` | true | **PROPOSED DEFAULT** |
| standing / faction range and bands | −100..+100; relationships §1.3 cuts | **PROPOSED DEFAULT** (reuse) |
| initial `prideToPlayer` / `prideToPride` | 0 / 0 | **PROPOSED DEFAULT** |
| `spilloverCoeffLeader` / `HighRank` / `Member` | 0.5 / 0.35 / 0.2 | **PROPOSED DEFAULT** |
| `spilloverMinAbs` / `spilloverEventCap` / `spilloverCatBlockCap` | 5 / 5 / 10 | **PROPOSED DEFAULT** |
| `rumorDaysToPrideKnown` | 3 | **PROPOSED DEFAULT** |
| `seenWithEnemyDelta` | −3 | **PROPOSED DEFAULT** |
| `borderPolicyCuriosityPermitAt` / `borderRepetitionDays` / warm-standing permit | 50 / 5 / ≥ +15 | **PROPOSED DEFAULT** |
| `standingDeedDelta` / Highcrag deed set | +5 each; single producer `encounter.cave_hyena.v1`: `drive_hyena`, then `share_kill` + `return_trespasser` (once each, witnessed) | **PROPOSED DEFAULT** (§13.6) |
| `hyenaThreatStat` / `encounterRepeatDays` / proof death cap | 9 / 3 / serious + Health floor 1 | **PROPOSED DEFAULT** (§13) |
| `borderPolicyDeferAtOrBelow` / ford dispute HC→BF / BF→HC / choice personal delta | −15 / −20 / −10 / +5 | **PROPOSED DEFAULT** |
| `trespassWarmMeetMult` | 0.5 | **PROPOSED DEFAULT** overlay; base 10% and −5 unchanged |
| `worldMemory.schemaVersion` / `ledgerCap` | 1 / 200 | **PROPOSED DEFAULT** |
| `council.minDaysBetween` | 20 | **PROPOSED DEFAULT** |
| `council.maxPerBlock` | 1 | **PROPOSED DEFAULT** |
| `council.durationDays` | 20 | **PROPOSED DEFAULT** |
| `council.recognizeMinNonColdPrides` | 2 (standing > −15) | **PROPOSED DEFAULT** |
| `council.fulfilDelta` | +5 each directed pair among signatories | **PROPOSED DEFAULT** |
| `council.breachDeltaBreakerToOthers` | −15 | **PROPOSED DEFAULT** |
| `council.breachDeltaOthersToBreaker` | −10 | **PROPOSED DEFAULT** |
| `council.disagreementDelta` | 0 | **PROPOSED DEFAULT** |

### 12.9 Leader councils

**ANNA request (via Director, 2026-11-07), rules PROPOSED DEFAULT:** occasional political gatherings of all pride leaders to settle feuds and make arrangements, with persistent agreements and consequences. No fixed year length; cadence is in `absDay` terms and event triggers.

1. **Cadence.** A council may fire at day-resolution (after hazards, never interrupting `pendingArc`) when all of the following hold:
   - `lastCouncilAbsDay` is null or `absDay - lastCouncilAbsDay >= council.minDaysBetween` (20);
   - this 20-day block (`floor((absDay - 1) / 20) + 1`) has not already hosted a council (`council.maxPerBlock=1`);
   - a trigger is latched: any `prideToPride` value **crosses into** the `hostile` band (from > −50 to ≤ −50), or a pride-level `fight` / agreement `breach` ledger event occurred since the last council (or since run start).
   If the event slot is busy, keep the latch and try the next free day in the same block; if the block ends first, the latch carries forward (still at most one council after it fires). Councils use the existing one-offline-event budget; no extra calendar turn and no year wrap. `yearLengthDays` stays `null`.
2. **Who sits.** Every current pride leader: `hc01`, `bf01`, `mw01`, and the player if `player.status === 'founder'` (the player is leader of `founded`). If an AI leader is dead this milestone, that pride sends no substitute (deferred).
3. **Player access tiers (do not treat a loner as a voting leader):**
   - **Loner** (no founded pride): not present. May be **summoned** only if a seated leader invites them, as `subject` (being discussed) or `petitioner` (asking something). No vote.
   - **Mate of a pride cat** (a `mates` bond with a current pride member, player is not founder): may attend as **companion** without a vote.
   - **Member** of an AI pride (admission route, not leader): not seated; their leader speaks for that pride. Invite as subject/petitioner only.
   - **Founded-pride leader:** seated, with voice. **Voting only if recognized.** Recognition: at least `council.recognizeMinNonColdPrides` (2) AI prides have `prideToPlayer` standing > −15 (not `cold` or `hostile`). An unrecognized founder may speak and hear terms but cannot ratify; their pride cannot be a signatory until recognized.
4. **Agreement record:**
```
{ agreementId, councilId, absDay,
  parties: [{ prideId, leaderCatId }],
  terms, durationDays, status, knowledgeScope }
```
   `terms` whitelist only: `border_truce`, `shared_hunting_ground`, `non_aggression`, `admission_courtesy`, `return_of_trespasser`. `status`: `proposed` | `active` | `fulfilled` | `breached` | `expired`. Default `durationDays=20`. `knowledgeScope` is `pride_known` to every signatory pride, or `world_known` if the council was public (default `world_known`).
5. **Outcomes.** A council can end with **no agreement** (`council_disagree`, `council.disagreementDelta=0`, no `agreements[]` row becomes `active`). If every voting seated leader whose pride would be a party accepts, the record becomes `active` (`council_agree`). Authored choices only; no free text.
6. **Breach detection** reads the ledger while status is `active`:
   - `border_truce` / `non_aggression`: a `fight` or `territory_trespass` by a signatory pride (or its member acting for it) against another signatory;
   - `shared_hunting_ground`: `hunt_steal` on the named shared ground against a signatory;
   - `admission_courtesy`: an `admission_refusal` toward a petitioner the agreement covered;
   - `return_of_trespasser`: harming (`fight`) the named trespasser instead of returning them.
   First matching event sets `breached` under receipt `runId/council/{councilId}/breach/{eventId}`.
7. **Consequences (faction ledger deltas, both directions, with receiptKeys):**
   - **Fulfil:** duration elapsed with no breach (for truce / non-aggression / shared-hunting / admission_courtesy), or the specific act completed (`return_of_trespasser`). Each directed pair among signatories gets `council.fulfilDelta` (+5), `sourceType: council_fulfil`.
   - **Breach:** breaker → each other signatory `council.breachDeltaBreakerToOthers` (−15); each other signatory → breaker `council.breachDeltaOthersToBreaker` (−10); `sourceType: council_breach`.
   - **Expired:** used when a term needed a specific act (e.g. `return_of_trespasser`) and duration ended with neither fulfil nor breach. No standing delta.
8. Persist `councils[]` (id, absDay, trigger, attendeeIds, inviteeIds, outcome) and `agreements[]`. No new art.

### 12.10 Tracker checks (this foundation)

All **PROPOSED DEFAULT** cases for the storage layer; none claims a runtime pass.

1. Personal value isolation: changing cat A's meter does not change cat B's; changing a personal meter does not change `prideToPlayer` unless a §12.4 spillover receipt is written.
2. Directionality: `P→Q` and `Q→P` can differ; writing one does not write the other.
3. Band edges: −15 is An Eyesore, −14 and +14 are Neutral, +15 is A Welcome Face, +50 is Liked, +60 is Close Friend, −100 is Permanent Rival and is still raisable.
4. Migration: a v0.4.x affinity of 0 stays 0 (not +50); 40 stays 40; missing standings become 0; ledger migration events do not double-apply.
5. Exactly-once: replaying a §11.3a receipt or a spillover/council receipt does not change stored values again.
6. `knowsFact`: a private ln05 fact is unknown to Bonefield and to other cats; a witnessed-by-P-member fact becomes `pride_known` to P only after 3 days, once.
7. Conflicting / superseded conversation facts still follow §11.3.6; world-fact scope is independent of the active-topic pointer.
8. Personality: regenerated-missing values match a fresh roll from the same `worldSeed` via world-gen §5; the ln05 lean column is never stored as personality.

### 12.11 Open questions

1. **Anna:** should Permanent Rival ever become an irreversible lock, or stay a label at −100?
2. **Anna:** approve or rewrite the positive personal labels (currently Director wording, §12.2.6)?
3. **Anna / Director:** snap the §11 visit gate (50) to Liked (≥ 30) or Close Friend (≥ 60), or leave it mid-Liked?
4. **Anna / Saga:** any starting `prideToPride` seeds from lore, or keep 0 until play writes them?
5. Existing §9 questions (year length, pride-cat mate leaving, same-sex mate counting for the goal, loner-group sex mix) and §11.10 (authored choices vs free text) are unchanged. Councils do not depend on year length.

## §13 Prey and threat encounters (v0.6.1, PROPOSED DEFAULT)

**Director (2026-11-07), relaying Anna:** supplied images are actual prey/enemy encounter assets. Define a bounded, species-appropriate plan with clear prey/threat roles, choices and risk. Do **not** treat all adults or calves as automatically hostile or as identical combat targets. Roles and balance numbers in this section are **PROPOSED DEFAULT**, not user-approved. No new art (use the supplied originals unchanged). No breeding, no free-text input. `yearLengthDays` stays `null`. Wolves stay flee-only this milestone (slice-1 IN §6 / this spec §3: bear/wolves flee); do not add pack combat.

**Ownership:** Tundra pins roles, eligibility, checks, yields, injury caps, standing deeds and receipts. Saga authors beats/choices/outcomes and trait-coloured lines (her `encounters-v0.1` pair is the first-proof text). Flint integrates on the existing cloud stream after the current checkpoint (no restart, no debug spawn). Ochre checks that the original PNG fills the encounter panel; originals are not cropped or replaced. Tracker gates reachability, the exact supplied image, save/reload persistence and exactly-once consequences.

**Assets checked (2026-11-07) in `/workspace/shared-art/`:** all thirteen files are present (`human-enemy.png`, `old-pack-enemy.png`, `wolf-pup.png`, `woolly-mammoth.png`, `mammoth-calf.png`, `woolly-rhinoceros.png`, `woolly-rhinoceros-calf.png`, `giant-deer.png`, `antlerless-deer.png`, `spotted-fawn.png`, `american-lion.png`, `maneless-lion.png`, `cave-hyena.png`). **Missing: none.** Display labels: `old-pack-enemy.png` → "Wolf pack enemy"; `american-lion.png` → "American Lion". Persist `assetId` (filename) on the encounter instance; the renderer must show that file, not a cat portrait or a generated substitute.

### 13.1 Roles (not hostility-from-image)

| Role | Meaning |
|---|---|
| `prey` | Ordinary hunt target. |
| `easy_prey` | Lower difficulty, low yield. |
| `dangerous_prey` | Hunt-eligible but risky (antlers, size). Not an automatic fight. |
| `guardian_prey` | A calf/juvenile whose adults may be present. High yield, guardian retaliation. Never assume the adult is absent. |
| `not_solo_prey` | Adult megafauna. A lone cat does not take them as a solo kill. Observe / retreat / (if a calf is actual cast) stalk the calf at guardian risk. |
| `predator_competitor` | Contests space or kills. Not automatically an attack. |
| `scavenger` | Contests an existing carcass (kleptoparasite). |
| `apex_competitor` | Other large felids. Distinct encounters; not pride members. |
| `human_threat` | Rare, avoid-first. Humans are never hunt targets. |
| `juvenile_sighting` | Watch/leave by default. Harm is not the offered default. |

A warning display, an antlered silhouette or a calf image does not by itself start combat or award food.

### 13.2 Encounter table

`frequencyWeight` is a relative table weight (not a claimed appearance rate). `absDayMin` is a gate, not a season name. Regions cite map-v1 §4 ids and biomes. Spring tables apply after day 20 (§3.1.5).

| encounterId | asset | display label | role | behaviour | biomes / primary regions | absDayMin | weight |
|---|---|---|---|---|---|---|---|
| `encounter.giant_deer.v1` | `giant-deer.png` | Giant deer | `dangerous_prey` | Antlered large prey. Observe/approach/abandon; a kill only from the hunt resolver. Image is never reused for antlerless deer or the fawn. | steppe / pinewood / lakeshore: `split_rock`, `tallgrass`, `mistwood`, `west_spur`, `twin_forks`, `mere_shore` | 1 | 6 |
| `encounter.antlerless_deer.v1` | `antlerless-deer.png` | Antlerless deer | `prey` | Standard medium prey. Lack of antlers does not prove sex or helplessness and does not reuse giant-deer stats. | same deer regions plus `horse_meadows` | 1 | 8 |
| `encounter.spotted_fawn.v1` | `spotted-fawn.png` | Spotted fawn | `easy_prey` | Easy, low yield. Do not invent a parent on the cast. | pinewood / steppe: `mistwood`, `fog_paths`, `split_rock`, `tallgrass` | 1 | 4 |
| `encounter.woolly_mammoth.v1` | `woolly-mammoth.png` | Woolly mammoth | `not_solo_prey` | Adult defensive herd animal. Observe, test-the-herd (risky), retreat. No solo `prey_taken`. `stalk_calf` only if a calf is actual saved cast. | steppe / tundra: `tallgrass`, `salt_flats`, `herd_trail`, `bonefield`, `wind_scree` | 3 | 2 |
| `encounter.mammoth_calf.v1` | `mammoth-calf.png` | Mammoth calf | `guardian_prey` | High yield if taken; guardian retaliation if an adult is present (do not invent one). A loner should usually retreat. | same as adult mammoth | 3 | 3 |
| `encounter.woolly_rhinoceros.v1` | `woolly-rhinoceros.png` | Woolly rhinoceros | `not_solo_prey` | Same solo-avoid rule as adult mammoth. No automatic charge. | steppe / tarlands: `south_range`, `herd_trail`, `tar_seeps`, `bonefield` | 3 | 2 |
| `encounter.woolly_rhinoceros_calf.v1` | `woolly-rhinoceros-calf.png` | Woolly rhinoceros calf | `guardian_prey` | High yield, guardian risk; adult must be actual cast. | same as adult rhino | 3 | 3 |
| `encounter.wolf_pack.v1` | `old-pack-enemy.png` | Wolf pack enemy | `predator_competitor` | Warning display, then withdraw. **Flee-only** (existing wolves hazard, map-v1 §6 / slice-1). No attack, duel, charge or surrender-carcass choice in this milestone. Not the pup scene. | any region whose hazard list includes `wolves` (nearest from start: `greywater_ford`; also `herd_trail`, `south_range`, `tar_seeps`, `camel_ridge`, `ash_hills`, `wolf_run`; winter also `horse_meadows`, `bonefield`) | 1 | hazard |
| `encounter.wolf_pup.v1` | `wolf-pup.png` | Wolf pup | `juvenile_sighting` | Choices: `leave`, `observe`. Not a default kill. A later authored `harm` (not in the initial proof) would set `wolfPackHostile` and raise later `wolves` hazard weight; wolf faction stance stays deferred (§12.1.4). | `south_range`, `herd_trail`, `wolf_run` edges | 4 | 2 |
| `encounter.cave_hyena.v1` | `cave-hyena.png` | Cave hyena | `scavenger` | Contests an existing carcass; not identical pack combat. Initial useful host for witnessed Highcrag standing deeds (§13.6) when the carcass is a Highcrag kill. | riverine / tarlands / gorge: `twin_forks`, `tar_seeps`, `claw_gorge` | 1 | 4 |
| `encounter.american_lion.v1` | `american-lion.png` | American Lion | `apex_competitor` | Other large felid. Not a pride member; not automatically hostile. Observe, give space, withdraw; contest only if later authored. | alpine / gorge / steppe: `east_saddle`, `claw_gorge`, `south_range`, Highcrag edges | 5 | 2 |
| `encounter.maneless_lion.v1` | `maneless-lion.png` | Maneless lion | `apex_competitor` | Distinct encounter and asset. Presentation may read as a female or younger variant; **do not assert sex, age, species or kinship** beyond the display label. | pinewood / steppe / alpine: `mistwood`, `tallgrass`, `east_saddle` | 5 | 2 |
| `encounter.human.v1` | `human-enemy.png` | Human | `human_threat` | Rare, high-danger, avoid-first (fire/spears as flavour of an already-dangerous threat — do not invent a new weapon system). **No hunting humans**; there is no `commit_hunt` / `prey_taken` path. | `herd_trail`, `tar_seeps`, `salt_flats`, `south_range` | 8 | 1 |

### 13.3 Resolution, costs, yields, injury

1. **Action phase (PROPOSED DEFAULT).** One encounter replaces, never adds to, the day's main action / one-offline-event budget (§11.2.5). Observation and approach beats are not extra days and not a second hunt (Saga `sharedRuntimeContract.costs`).
   - **Hunt-entered prey** (`encounter.giant_deer.v1` and other hunt-table rows): the player has already chosen Hunt. Charge Energy **−10** on encounter start (search). Charge the remaining hunt Energy **−20** only on `commit_hunt` (total −30, needs §1.4). `observe` / `stalk` / approach text / `leave` / `break_off` do not add Hunger or a second Energy tick. `prey_attempt_abandoned` awards no food and does not refund the day; if only the −10 search was spent, the −20 is not charged. UI must say the day is spent.
   - **Hazard-entered threat** (`encounter.wolf_pack.v1`): bind to the existing `wolves` hazard or to the first-sighting rule in §13.5. Do not charge a second Travel/Hunt and do not re-roll the same hazard.
2. **Observe is free inside the encounter.** No accuracy bonus, hidden-odds reveal, injury, food or pride knowledge from watching (matches Saga `observe` / `watch` effect notes).
3. **Prey resolver.** On `commit_hunt` / equivalent, call the **existing** formulas §1 hunt resolver once (`use_existing_hunt_resolver`). The story does not pick success. Persist the resolver receipt before display (Saga `saveContinue`). Map results onto Saga's renderer ids where they exist:
   - success, no injury → `prey_taken`
   - success + injury → `prey_taken` + `injuryOverlay`
   - fail, no injury → `prey_escaped`
   - fail + injury → `prey_escaped` + `injuryOverlay`
   - Health would hit 0 → §13.3.6 cap, not a narrated death from this proof
   - abandon outcomes → `prey_attempt_abandoned` (no food)
   Size terms (formulas §1.2 / needs §1.2), PROPOSED mapping: spotted fawn = **small** (+5 hunt points, Hunger **+25**); antlerless deer = **medium** (0, **+50**); giant deer, calves of mammoth/rhino = **large** (−20, **+80** large-kill share). Adult mammoth/rhino never yield `prey_taken` to a loner (`not_solo_prey`). Party bonuses apply only when actual companions are in the hunt (none are spawned by these scenes).
4. **Deterministic readout (for Tracker, not a new success-rate claim).** After points are summed with formulas §1.2 (region prey bonus from map-v1 §4, Hungry −5, Health < 50 −10, injury −5/−15, stalk milestone if present), bands are: `clean` if points ≥ 60, `partial` if ≥ 45, `fail` if ≥ 30, else `fail_injured`. These bands are optional diagnostics; live resolution stays the formulas §1.4 roll unless Flint is asked to swap in the bands for a headless fixture. **No run-level success percentage is claimed here.** A worked example (not a rate): a fresh Standard loner at `split_rock` in spring (prey 2 → +5) committing on giant deer (large −20) has hunt points **35** before Hungry/injury (50+5−20). That is a risky large hunt, which is intended.
5. **Wolf flee resolver.** `give_ground` and `withdraw` → Saga outcome `resolve_existing_flee` (the existing flee-only wolves hazard, map-v1 §6: lose a tracked carried carcass if one exists, or the existing flee/injury path). `keep_cover` → `resolve_existing_flee_with_cover`. If the engine has no cover input, `keep_cover` uses the same flee resolver with **no invented bonus** (different text only). Omit `watch` / `keep_cover` when `coverAvailable` is false; do not invent shelter. No new combat roll, no pack diplomacy, no death invented by prose. Injury, pursuit, carcass loss or death text appear only when the existing resolver actually wrote that result. **This milestone still caps proof-encounter death per §13.3.6** (serious injury, Health floor 1) even if a future hazard table could kill.
6. **Injury cap (PROPOSED DEFAULT, difficulty modes later).** A single initial-proof encounter (`encounter.giant_deer.v1`, `encounter.wolf_pack.v1`, `encounter.cave_hyena.v1`) cannot kill the player. Downgrade any crippling result to **serious**; floor Health at 1. Injury tiers otherwise reuse needs-spec §2.1: minor (−10 Health, hunt −5, 3 days) and serious (−25 Health, hunt −15, travel Energy 25, 10 days). Rest still halves remaining heal time that day. Existing Health-empty death from needs/other hazards is unchanged (§3.7.5).
7. **Contest checks (hyena and later authored contests).** Use the existing fight **stat** from formulas §4.1 (Saber Strike, `aggression`, stage, Health < 50, injury) as a deterministic compare, not a lethal duel. PROPOSED `hyenaThreatStat=9`. Tiers vs the hyena: player stat ≥ 11 `clean` (hyena leaves; v0.6.2: was 12, unreachable for a Standard creator, max 11.2); ≥ 9 `partial` (hyena leaves, extra Energy −10); ≥ 6 `fail` (hyena keeps the carcass, no injury); else `fail` + minor injury. A fresh player stat is 10 (formulas §4.5) → `partial`. Loner cannot use `call_pridemates` (omit / disable with reason).
8. **Personality.** Animal-only narration stays sensory and does not invent the player's feelings (Saga `personality`). If a real pride cat is present (hyena deed cast), supply that cat's saved id, name, portrait and all five traits (`aggression`, `sociability`, `boldness`, `loyalty`, `curiosity`) at every beat. Colour text with the existing bands (high ≥ 70, low ≤ 30, §10.1.6). Traits never change numeric deltas.

### 13.4 Save schema, receipts, knowledge

1. **Persist** `encounters: { log[], cooldowns{}, pendingEncounter }` beside existing needs/injuries. Each log row: `{ encounterId, encounterInstanceId, assetId, regionId, absDay, nodeId, choiceId, outcomeId, resolverReceipt, yieldHunger, injuryTier }`. Reuse `injuries[]` (needs §6.1) with `sourceEventId` = `encounterInstanceId`. `cooldowns[encounterId] = nextEligibleAbsDay` (proof rows are once-through; afterwards the weight table may pick them again subject to a PROPOSED `encounterRepeatDays=3` cooldown).
2. **Exactly-once.** Choice receipt `runId/encounter/{encounterId}/{encounterInstanceId}/{choiceId}`; resolver receipt `runId/encounter/{encounterInstanceId}/resolver`. If a `receiptKey` is already applied, skip the value change and the ledger append (§12.3.3). Save before commit keeps the pending node/choices; save after never rerolls, respawns, refunds or awards food twice.
3. **Knowledge (Director).** A private wildlife action (a lone hunt, a lone flee) writes **no** `prideToPlayer` and no automatic leader knowledge. Only actual participants and `witnessIds` learn the incident until an explicit relay/`pride_report` / `knowsFact` promotion. This matches Saga `sharedRuntimeContract.knowledge` and §12.4.

### 13.5 Initial reachable proof (Flint)

Use Saga's authored pair as the required first proof. The cave hyena is the optional third and the host for witnessed standing deeds. No debug injection, no guaranteed hunt success.

| # | encounterId | asset | ordinary trigger | notes |
|---|---|---|---|---|
| 1 | `encounter.giant_deer.v1` | `giant-deer.png` | First Hunt at `split_rock` on `absDay >= 1` presents this encounter (before the hunt resolver). Later hunts in §13.2 deer regions use the weight table. | Choices/outcomes: §13.7. Day spent as Hunt. |
| 2 | `encounter.wolf_pack.v1` | `old-pack-enemy.png` | First time the player **ends a day** in a region whose map-v1 hazard list includes `wolves`, with a free event slot, present this scene once (`receiptKey` `runId/encounter/encounter.wolf_pack.v1/first_sighting`) instead of a silent percent roll. Nearest legal path: Travel `split_rock` → `greywater_ford` (1-day edge) on **absDay 1**. | Flee-only. `coverAvailable` is true at the ford (riverine brush); omit cover choices if a later region has none. **Do not** fire `m2.ford_prey_dispute` on absDay 1 (that event still requires `absDay >= 2` in the ford, §12.6.6.2). |
| 3 (required) | `encounter.cave_hyena.v1` | `cave-hyena.png` | First Hunt or Travel that **ends** in `twin_forks` on `absDay >= 1` (map-v1 edge `split_rock`—`twin_forks`, 1 day; also from `greywater_ford`, unused on this path). The carcass is an existing Highcrag kill (hunter `hc05` if alive, else any living Highcrag adult), not a spawned hunt companion and not an invented extra hyena pack. | **Required** host of the §13.6 standing deeds and the cautious-leader +15 proof. |

**Slot conflicts:** hazards / species encounters resolve first (§11.2.5). If `m2.ford_prey_dispute` would also fire (player ends a day in `greywater_ford` on `absDay >= 2`) and the slot is busy, **latch** the dispute to the next day the player ends in `greywater_ford` with a free slot. The dispute receipt remains once per run. This does not change the v0.5.5 ruling selector.

### 13.6 Highcrag standing: why +15 was blocked, and the authored fix

**Selector unchanged (v0.5.5, §12.6.6.1).** Warm permit is still `highcrag → player` ≥ **+15**. That threshold is not lowered. Defer step 1 (known HC→BF feud ≤ −15) and step 2 (standing ≤ −15) still cannot be overridden.

**How standing can rise today.** Direct writes already in spec: trespass −5 (`territory_trespass`, map §8.3), admission refusal −5, mate bond +20 (loners §4.2), `seen_with_hostile_faction` −3, council fulfil/breach, and **spillover** (§12.4) after a `catToPlayer` delta when the pride `knowsFact` the cause. Spillover coeffs: leader 0.5, high-rank (leader's mate or elder) 0.35, member 0.2. No spill if `|delta| < 5`. Combined per pride per source event cap ±5. Per cat per pride per 20-day block cap ±10. Rounding half away from zero. Private talk writes **no** spillover, including talk with the leader.

**Once-per-cat conversation improves cannot reach +15.** Slice / §11 talk improve is +5 per cat (and private by default → **0** spillover). Even if every Highcrag first-meeting +5 were incorrectly treated as known (they are not):

| cat | rank | +5 × coeff | rounded |
|---|---|---|---|
| hc01 | leader | 2.5 | +3 |
| hc03 | mate (high-rank) | 1.75 | +2 |
| hc08 | elder (high-rank) | 1.75 | +2 |
| hc02, hc04, hc05, hc06, hc07 | member × 5 | 1.0 each | +5 |
| **total** |  |  | **+12** |

hc09 is an adolescent; hc10/hc11 are cubs and are not conversation targets. +12 < +15, and the per-cat block cap (10) is not the binding limit here — the once-per-cat +5 × rank is. Director also forbids farming +15 from repeated greeting or conversation gains. Therefore the permit path needs **pride-level authored deeds**, not a spillover tweak.

**PROPOSED DEFAULT — one standing-deed producer.** The only enabled source of the three +5 Highcrag deeds is `encounter.cave_hyena.v1` (Saga `encounters-v0.2.json`). Each writes `prideToPlayer` **+5** only when a living Highcrag adult is in `witnessIds` and Highcrag `knowsFact` the deed (`knowledgeScope: witnessed`). A private wildlife action never writes standing. A failed `drive_off` (`resolve_hyena_contest` tier `fail` → `hyena_keeps_kill`, or opening `yield_kill` / `retreat`) earns **nothing** — no `after_drive` node, no deeds. Each deed has its own `receiptKey`; replaying it no-ops. There is no repeat, no 3-day farm, and no greeting grind. The three direct +5 lines are not rank spillover and are not collapsed into `spilloverEventCap`.

| deedId (receipt leaf) | Choice / when it pays | Cast / knowledge | sourceType | delta | receiptKey |
|---|---|---|---|---|---|
| `drive_hyena` | Opening `drive_off` resolves `resolve_hyena_contest` to tier `clean` or `partial` → outcome `hyena_driven`, then node `after_drive`. Selecting `drive_off` alone does not pay. | Highcrag adult in `witnessIds` (prefer `hc05`, else any living Highcrag adult). | `pride_aid` | +5 | `runId/standing_deed/highcrag/drive_hyena` |
| `share_kill` | After a successful drive, `after_drive` choice `share_remains` (cooperative retention of a Highcrag share; no extra Hunger unless separately specified). | Same hunter in `witnessIds`. | `gift_share` | +5 | `runId/standing_deed/highcrag/share_kill` |
| `return_trespasser` | After a successful drive, `after_drive` choice `warn_off_trespasser` (speech `cache_request` → `outsider_request` → `cache_ack`). Pays only if a distinct living eligible adult loner or Bonefield cat is actually present and departs, witnessed by the hunter. | Hunter in `witnessIds`. No HC→BF write. | `pride_aid` | +5 | `runId/standing_deed/highcrag/return_trespasser` |

`share_remains` and `warn_off_trespasser` may be taken in **either order**. Completing one must not hide the other; `finish` → `leave_after_aid` exits with no extra award. `take_the_kill` → `player_takes_kill` is not a +5 deed: Hunger +50 and Highcrag −5 (`hunt_steal`, receipt `runId/standing_deed/highcrag/steal_kill`), once.

**Retired / unused variants (not a second producer).**
- The v0.6 standalone border `return_trespasser` travel trigger and the post-`prey_taken` own-kill share follow-up are **retired** for this proof. If later re-authored they must reuse the same receipts (`share_kill` / `return_trespasser`) and cannot pay a second +5.
- Saga's `service.highcrag.wolf_warning.v1` (`highcrag-standing-service-draft.json`; route ids `retain_warning`, `offer_report`, `report`, `keep_private`, `account`, `give_account`, `withdraw_account`, `relay_requested`, `actual_relay`, `leader_acknowledges`, `return_acknowledgement`; reward key `runId/service/highcrag/wolf_warning`) is an **unused alternative**. If played, it writes **0** `prideToPlayer`. The wolf sighting itself (`encounter.wolf_pack.v1` outcomes `resolve_existing_flee` / `resolve_existing_flee_with_cover`) also writes 0. Do not enable it as a fourth deed.

If the Highcrag witness or the outsider cast is missing, omit the corresponding deed and do not invent a cat (Saga: report the reachability gap). Fresh Standard start: fight stat 10 vs `hyenaThreatStat=9` → `partial` (formulas §4.5), so `after_drive` is reachable without injection.

**Permit arithmetic (independent of the ford dispute).** Start `highcrag → player` = 0. Successful drive + both follow-ups: 0+5+5+5 = **+15** (warm) on the hyena day. After standing is +15, a Bonefield-topic petition with **no** known feud hits selector step 3 (`permit_relay`) even if the leader's `curiosity` < 50. Standing +15 is not itself a ruling: `m2.border_introduction` still needs request → actual relay → leader review. The player may also petition before any deeds if curiosity ≥ 50 (step 4) — that path is unchanged.

**Canonical day-by-day path (map-v1 edges only; no Ford; no Highcrag interior).** `split_rock` starts the run (neutral). `split_rock`—`twin_forks` is a 1-day edge (§5). `twin_forks` is neutral and neighbours Highcrag-held `upper_greywater` (and `greywater_ford`, which this path never enters), so it is a legal §11.1.4 border/neutral rendezvous. Trespass (map §8.3, −5) applies on held land only; staying in `twin_forks` incurs **no** trespass penalty. Do not travel into `highcrag`, `horse_meadows`, `upper_greywater`, or `greywater_ford`.

| absDay | Region (after the action) | Main action | Event | Standing / ruling |
|---|---|---|---|---|
| 1 | `twin_forks` | Travel from `split_rock` | Required `encounter.cave_hyena.v1`. `drive_off` → `clean`/`partial` (`hyena_driven`, `drive_hyena` +5), then `share_remains` and `warn_off_trespasser` in either order (+5 each). `finish` optional. | 0+5+5+5 = **+15**. No ruling yet. |
| 2 | `twin_forks` | Seek out the already-met hunter (`hc05` or the fallback adult). **PROPOSED:** a species encounter does not start `conversation.catCooldownDays` (that gate is for §11 conversation slots), so the same hunter is eligible the next day. Energy −5 (already in their rendezvous). | `m2.border_introduction` request (Bonefield topic), then ask that contact to relay to the current Highcrag leader. Queue one named relay; the leader does not know yet. | Still +15. No permit committed. |
| 3 | `twin_forks` | Rest (or any action that keeps the cat here). | **Actual relay** delivers the queued request to the living leader (`hc01` if alive). Leader review uses the unchanged v0.5.5 selector: no known feud, standing ≥ +15 → step 3 `permit_relay`. Reply may render the same day via the contact/messenger at this rendezvous (`return_acknowledgement` text is Saga's; it must not write a second standing delta). | Ruling committed: `permit_relay`. |

**Earliest absDay:** standing +15 on **absDay 1**; permit ruling on **absDay 3**. If Tracker later treats hyena speech as a §11 conversation commit, `hc05` would next be eligible on absDay 3 and the permit would move to **absDay 4** — call that out rather than injecting a second contact. `borderRepetitionDays` (5) is not needed on this path (first review already hits step 3). A 5-day re-petition remains the recovery for a step-4 caution deferral.

**Map notes / unused wolf route.** The retired warning service's ford-bypass (`split_rock` → `bonefield` → `south_range` → `wolf_run`, all 1-day edges; return via `wolf_run` → `south_range` → `bonefield` → `split_rock` → `salt_flats` → `wind_scree`; `wind_scree` neighbours `horse_meadows`) is valid topology, but `bonefield` is Bonefield-held (trespass risk) and that service writes 0 standing. It is not part of this proof. No other adjacency is assumed.

**Defer stays reachable (selector unchanged).**
- **Step 1:** end a day in `greywater_ford` on `absDay >= 2` to fire `m2.ford_prey_dispute` (HC→BF −20, known). A later Bonefield-topic petition defers; warm standing does **not** override a known feud.
- **Step 2:** standing ≤ −15, e.g. three trespass days (−5 each) or `take_the_kill` (−5) plus further trespasses.
- **Step 4:** no feud, standing < 15, leader curiosity < 50.

**Flint handoff (normal actions only).**

1. `encounter.giant_deer.v1` — first Hunt @ `split_rock`, `absDay >= 1`. Hunt Energy/resolver only. Standing: none.
2. `encounter.wolf_pack.v1` — first end-of-day in a `wolves` hazard region (nearest: Travel to `greywater_ford` on absDay 1). Flee-only. Standing: none (including any unused warning-service playthrough).
3. `encounter.cave_hyena.v1` — **required.** First end-of-action in `twin_forks`, `absDay >= 1`. Cast: `hc05` (fallback any living Highcrag adult) in `witnessIds`; outsider separately if `warn_off_trespasser` is offered. Opening choices: `drive_off`, `yield_kill`, `take_the_kill`, `retreat`. After `hyena_driven` only: `share_remains`, `warn_off_trespasser`, `finish`. Receipts as the table. Contest: formulas §4.1 vs `hyenaThreatStat=9`. No extra day or base Energy beyond the originating Travel/Hunt; `partial` adds Energy −10.
4. Petition: day-after-deeds Seek out at `twin_forks`; relay delivers the next day; one ruling receipt; no second standing write.
5. Unused: do not hook `runId/service/highcrag/wolf_warning` to a standing delta.

**Tracker repro (normal actions, no injected standing).**
1. **Giant deer:** New Game, Hunt at `split_rock` on day 1. See `giant-deer.png`. `leave` / `observe`→`leave`: `prey_attempt_abandoned`, no food. `stalk`→`commit_hunt`: one resolver receipt; food only on `prey_taken`. Save before/after: no second award.
2. **Wolf pack:** New Game, Travel to `greywater_ford` on day 1. See `old-pack-enemy.png`. Flee-only choices. Dispute does not fire (absDay 1). Standing unchanged.
3. **+15 then permit:** New Game, Travel `split_rock` → `twin_forks` on day 1. See `cave-hyena.png`. Successful `drive_off` then `share_remains` and `warn_off_trespasser` (either order). Three +5 ledger lines, non-empty `witnessIds`, standing **+15**. Reload after each deed: no replay. Failed `drive_off` (force via injured/low Health fixture if needed) yields 0 deeds. Day 2: Seek out the hunter, Bonefield-topic request, relay queued, standing still +15 (not yet permit). Day 3: actual relay + review = `permit_relay`. Reload after the ruling: still permit, no second +5. Never enter the ford or Highcrag interiors on this path.
4. **Defer:** New Game, Travel to `greywater_ford` on day 2 (or stay through the end of day 2): `m2.ford_prey_dispute` fires, HC→BF = −20. Bonefield-topic petition → `defer_relay` (step 1) even if standing is later +15.
5. **Isolation:** a giant-deer hunt or a wolf flee alone does not change `prideToPlayer`. `take_the_kill` writes −5 once.

### 13.7 Content contract for Saga

**Match these existing ids from `encounters-v0.1.json` (do not rename):**

`encounter.giant_deer.v1`
- Nodes: `opening`, `observe`, `approach`
- Choices: `observe` (→ `observe`), `stalk` (→ `approach`), `leave` (→ `prey_attempt_abandoned`), `commit_hunt` (→ `resolve_one_large_prey_attempt`), `break_off` (→ `prey_attempt_abandoned`)
- Outcomes / renderer: `prey_attempt_abandoned`, `resolve_one_large_prey_attempt` → `prey_taken` / `prey_escaped` / `injuryOverlay`
- Trait colour: none required (no companion). Personality must not route the resolver.

`encounter.wolf_pack.v1`
- Nodes: `opening`, `watch`
- Choices: `give_ground` (→ `resolve_existing_flee`), `watch` (→ `watch`, requires `coverAvailable`), `withdraw` (→ `resolve_existing_flee`), `keep_cover` (→ `resolve_existing_flee_with_cover`)
- No combat choice in this milestone.
- Trait colour: none required.

**Match `encounter.cave_hyena.v1` from `encounters-v0.2.json` (required proof; do not rename):**
- Nodes: `opening`, `after_drive`
- Opening choices: `drive_off` (→ `resolve_hyena_contest`), `yield_kill` (→ `hyena_keeps_kill`), `take_the_kill` (→ `player_takes_kill`), `retreat` (→ `hyena_retreated`)
- Contest tiers: `clean` / `partial` → outcome `hyena_driven`, next `after_drive`, deed `drive_hyena`; `fail` → `hyena_keeps_kill`, speech `failed`, `noDeeds`
- After-drive choices: `share_remains` (deed `share_kill`, speech `share`, stays on `after_drive`), `warn_off_trespasser` (deed `return_trespasser`, speech `cache_request` / `outsider_request` / `cache_ack`), `finish` (→ `leave_after_aid`)
- Other outcomes: `hyena_keeps_kill`, `player_takes_kill`, `hyena_retreated` (player leaves; not a defeated hyena), `leave_after_aid`
- Speech ids: `opening`, `driven`, `failed`, `share`, `cache_request`, `outsider_request`, `cache_ack`, `steal`, `exit`
- Traits: hunter (and outsider when present) use saved `aggression`, `sociability`, `boldness`, `loyalty`, `curiosity` (high ≥ 70, low ≤ 30). Do not add free-text.

**Id mismatches / notes for Saga:**
- Deer/wolf md headings from v0.1 still differ from JSON (`stalk` vs “approach”; `leave`/`break_off` vs “abandon”; `watch`/`keep_cover`/`withdraw`/`give_ground` vs “warning, cover, withdraw”). JSON wins.
- v0.2 `status` and `openDesignChecks` still call the hyena family “optional third”; this spec marks it **required** for the +15 proof.
- v0.2 still mentions standalone `return_trespasser` and own-kill share as alternate §13.6 triggers; those are now **retired unused variants** (same receipts if revived, no extra +5).
- Choice id `share_remains` vs deed id `share_kill`; choice `warn_off_trespasser` vs deed `return_trespasser`; `drive_off` pays only after `hyena_driven`, not on click.
- `service.highcrag.wolf_warning.v1` and `runId/service/highcrag/wolf_warning` stay unused with 0 standing (matches v0.2 `supersession.wolfWarningService`). No `report_wolf_warning` id exists in v0.2.
- Antlerless deer remains a separate unauthored table row, not the prey proof.

Remaining eleven assets stay routing + role pins (§13.2) until Saga drafts families. Juvenile/adult pairs (mammoth, rhino, wolf pup vs pack, fawn vs deer) must not share stats or images.

### 13.8 Art notes for Ochre

Use each row's original PNG as the encounter panel image. Do not replace, restyle or swap historical assets. Contain the whole supplied animal (giant-deer antlers; wolves' feet; full bodies). Approved UI/scene backing only. No new art in this pass.

### 13.9 Open for Anna

Encounter roles, weights, Energy splits, yield mapping, hyena threat stat, injury cap, deed deltas (+5 × 3), the `twin_forks` trigger, “encounter speech does not start conversation cooldown”, and next-day petition / following-day actual relay are **PROPOSED DEFAULT**. Existing §9 / §12.11 questions are unchanged (`yearLengthDays` still `null`; no invented seasons-of-year).


### 13.x Season-1 implementation rulings (v0.6.3)
1. **APPROVED** (relationships §1.5, world-gen §6.4): runs seed cat-to-cat pairs at world gen. The mate rival is chosen from actual pair value ≥ 15; skip only if none qualifies. Never manufacture a challenger.
2. **APPROVED** (formulas §4.3): the mate rival challenge rolls injuries (loser 40%, winner 15%, × Style × Guard; tiers 60/30/10 and 80/20/0), with no death roll. `showdown` replaces it injury-free. The §13 hyena cap does not apply here. Persist each injury result once.
3. **PROPOSED DEFAULT** (formulas §3 Mistwood temperament): persist `mistwoodSeasonsInRange` (int, start 0). At each `season_end`, add 1 if the player ended at least one day that window in a region Mistwood held at that time. The term is +2 × count, capped at +10. Visited windows count, not cumulative residence days, and no season length is needed. Season 1 reads 0.

## Changelog
- v0.6.4 (2026-11-10, Tundra): §11.3a.10 maps the ln05 third-meeting outcomes. Backup `milestone-2-spec.v0.6.3.bak.md`.
- v0.6.3 DRAFT (2026-11-08, Tundra): season-1 rulings on rival seeding, mate-challenge injuries and the Mistwood count (§13.x). Backup: `milestone-2-spec.v0.6.2.bak.md`.

- v0.5 DRAFT (2026-11-07, Tundra): added §12 world memory — directed personal/faction records, Anna's cat→player meter bands (−100…+100, 1:1 affinity migration), cause ledger and receipts, knowledge-gated spillover, leader councils (§12.9), and personality regen-from-seed for old saves. Backup: `milestone-2-spec.v0.4.2.bak.md`.
- v0.5.1 (2026-11-07, Tundra): §12.4 pinned spillover rounding (half away from zero) and cap scope (combined per pride per source event, one line per receipt). Backup: `milestone-2-spec.v0.5.bak.md`.
- v0.5.2 (2026-11-07, Tundra): §12.4 removed the leader/high-rank bypass of the knowledge gate (rank sets only the coefficient); §12.7.6 ln05 recovery must replay the hidden-parent + kin roll, not §5.1. Backup: `milestone-2-spec.v0.5.1.bak.md`.
- v0.5.3 (2026-11-07, Tundra): §12.6.6 border introduction policy mapping and the `m2.ford_prey_dispute` policy-setting event (Greywater Ford, absDay ≥ 2, HC→BF −20 / BF→HC −10). Backup: `milestone-2-spec.v0.5.2.bak.md`.
- v0.5.4 (2026-11-07, Tundra): §12.6.6.5 reconciled with Saga's border-policy-producer: leader ruling event; known-source edge ≤ −15 defers, else leader curiosity ≥ 50 permits. Backup: `milestone-2-spec.v0.5.3.bak.md`.
- v0.5.5 (2026-11-07, Tundra): §12.6.6.1 one border rule: the ruling controls, the feud is an input; Bonefield-topic scope only; known feud/standing can't be overridden; warm standing permits; 5-day re-petition guarantees both paths per seed. Backup: `milestone-2-spec.v0.5.4.bak.md`.
- v0.6 DRAFT (2026-11-07, Tundra): added §13 prey/threat encounters (Saga's giant deer + flee-only wolf pack as the initial proof; optional cave hyena); all 13 supplied assets indexed and verified present; witnessed once-only Highcrag standing deeds so +15 is reachable without conversation farming (selector and +15 threshold unchanged). Backup: `milestone-2-spec.v0.5.5.bak.md`.
- v0.6.1 DRAFT (2026-11-07, Tundra): §13.6 reconciled to Saga `encounters-v0.2` — single hyena standing-deed producer (`drive_hyena`, then `share_remains` / `warn_off_trespasser` in either order); hyena proof required; failed drive pays 0; wolf-warning service marked unused (0 standing); pinned ford-free day-by-day path through request and actual relay (earliest standing day 1, earliest permit day 3). Selector and +15 threshold unchanged. Backup: `milestone-2-spec.v0.6.bak.md`.
- v0.6.2 DRAFT (2026-11-07, Tundra): §13 hyena contest `clean` threshold 12 → 11 (PROPOSED DEFAULT), so the strongest Standard creator (fight stat 11.2) can reach `clean` while a fresh stat 10 stays `partial`. Partial still pays `drive_hyena`; deeds, receipts and selector unchanged. Backup: `milestone-2-spec.v0.6.1.bak.md`.

- v0.4.2 DRAFT (2026-11-07, Tundra): §11.3a.8–9 settle promise receipt on return+commit and greet folded into terminal delta. Backup: `milestone-2-spec.v0.4.1.bak.md`.

- v0.4.1 DRAFT (2026-11-07, Tundra): §11.3a maps Saga's recurring-conversation outcomes to effects: once per outcome, opening leave is free, first commit charges. Backup: `milestone-2-spec.v0.4.bak.md`.

- v0.4 DRAFT (2026-11-07, Tundra): added §11 recurring-conversation access, side-slot costs, bounded consequences, persistent factual memory, authored-choice continuity gate and one-cat/three-meeting slice; extended §10 persistence. All new tunables proposed, not approved. Backup: `milestone-2-spec.v0.3.2.bak.md`.

- v0.3.2 DRAFT (2026-11-07, Tundra): resolved §3.7/§10.1 conflict Saga flagged — season_end `unmated` offers 3 intent choices that each act as Continue; mated variants Continue only.

- v0.3.1 DRAFT (2026-11-07, Tundra): per Director — loner groups no longer male-only by default (any sex mix, §3.8.7, §9.4 reworded); 'Bonded' label is a reversible wording call; blockers scoped to the next relationship/season milestone, not Flint's current QA/portrait work; admission and courtship numbers remain PROPOSED. Backup: `milestone-2-spec.v0.3.bak.md`.

- v0.3 DRAFT (2026-11-07, Tundra): Anna's ruling — day 20 ends the mating window, not the run. Added `season_end`, the calendar params (`yearLengthDays` TBD, no time skip), milestone states instead of a win, Found after the window, ongoing pride upkeep, and three post-window routes (admission −15 out of season, loner groups via bachelor bands, solo). Withdrew unsimmed success percentages. Reconciled §10 with Saga contract-v0.2. Backup: `milestone-2-spec.v0.2.bak.md`.
- v0.2 DRAFT (2026-11-07, Tundra): rewritten around Anna's 20-day "find a mate and start your own pride" objective. Added bond stages, Seek out, same-day Found on accept, reachability math and a day-20 ending (superseded in v0.3). Backup: `milestone-2-spec.v0.1.bak.md`.
- v0.1 DRAFT (2026-11-07, Tundra): first pass; aimed at year-long survival and broader pride play. Missed Anna's 20-day mate-and-found goal.
