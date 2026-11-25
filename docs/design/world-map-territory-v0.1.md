# World map and dynamic territory v0.1.2
Status: **ANNA-APPROVED** (Anna via Director, 2026-11-10). §8 (councils) is superseded by `councils-v0.1.md`. It builds on map-v1 v1.0.1 (30 regions; already in `map.json`) and changes it only where marked **CHANGE**. Every number is PROPOSED DEFAULT unless it cites map-v1. Sim: `sim/world_territory_sim_v0.1.py` (500 seeds × 40 seasons, AI only).

## 1. Region graph
1.1 Use map-v1 §4–5 as-is: 30 regions, undirected edges, 1–2 days per edge (`winterDays` on glacier and alpine edges). Data lives in `map.json`; no new regions in v0.1.
1.2 The world map shows every region, coloured by holder, with hatching when contested. Regions the player hasn't visited show only name and biome until visited, or until heard about in gossip.

## 2. Travel cost
2.1 One travel day = one main action per day (needs §0.4), with the needs tick, Energy cost and free drink at water (map-v1 §5.2, §8.1).
2.2 A 2-day edge can't be cancelled. Winter edges use `winterDays`.
2.3 Every day ends with the hazard roll of the region the player ends in (map-v1 §6). Passing through without ending a day there rolls nothing.

## 3. Danger
3.1 **Danger** = hazard band from the region's single highest daily hazard, never the sum (map-v1 §6.4: 0 when daily hazard < 2%, 1 at 2–5%, 2 at 6–10%, 3 above 10%), +1 if another faction holds the region (claim ≥ `trespassClaimMin` 40), +1 if a band's home range includes it, +1 if it has a human camp or hyena den (§10). Clamp to 0–3. **CHANGE:** adds the trespass and band terms to §6.4.
3.2 Bands for Saga's arrival prose: 0 Safe, 1 Uneasy, 2 Dangerous, 3 Deadly (labels are Saga's).
3.3 Shown before travel, on the region panel. It is computed only from what the player knows (visited, heard, scent sign); unknown regions show "Unknown".

## 4. Claim strength
4.1 Claim 0–100 per faction per region, with holder, contested and wild states, upkeep, Mark, Patrol, skirmish, Yield and the core-den floor, all as map-v1 §9.1–9.5 and §9.8.
4.2 **CHANGE:** AI patrol-days per season are `ceil(adults / 3)`, not `ceil(adults / 2)` (map-v1 §9.3.3). In the sim, the /2 version freezes the map: in 1 run in 20 nothing changes for 31 seasons. The /3 version moves about one region a season and never lets one pride snowball (§7).
4.3 The player's pride uses My Pride daily orders and the player's own Patrol and Mark (my-pride-v0.1.1 §4.5).
4.4 My Pride claim words: Strong, Held, Slipping, Contested and Lost, with cutoffs as in my-pride §2.

## 5. AI expansion cadence
5.1 Once per AI pride per season, at season end, as map-v1 §9.6: expand when hungry or below target, retreat when fed and the region is costly. Temperament edges and wolves `activeAI: false` stay as written.
5.2 At most one Mark per AI pride per season, so no pride gains more than one region a season.
5.3 The player hears about a change through gossip or scent sign (a known fact), never through a global popup.

## 6. Ties to other systems
6.1 **Encounters:** a skirmish (map-v1 §9.5) that the player fights in uses the encounters-v0.1 fight engine as a scuffle (yield at 20 HP). Wild enemies come from the region's hazards (`bear`, `wolves`) and use encounters §2.8.
6.2 **Trespass:** map-v1 §8.3 is unchanged (a 10% patrol meeting); the meeting is a loner/pride scene, and a fight from it is an encounter.
6.3 **Councils:** see §8.
6.4 **Reputation:** winning or losing a skirmish and claiming or losing a region are deeds (reputation-v0.1).
6.5 **My Pride:** Territory, Patrol due and Threats lines (my-pride §2).

## 7. Sim results and Tracker pass bands
| Metric | Map-v1 §9.3.3 (/2) | **CHANGE (/3)** | Pass band |
|---|---|---|---|
| Holder changes per season (whole map) | 0.38 | 0.98 | 0.6–1.5 |
| Most regions any one pride holds (median / 95th percentile) | 6 / 6 | 5 / 5 | ≤ 7 (under 25% of the map), 95th percentile |
| Longest run of seasons with no change (median / 95th percentile) | 6 / 31 | 2 / 5 | 95th percentile ≤ 8 |
| Regions held after 10 years (HC / BF / MW) | 5.3 / 5.5 / 5.0 | 4.3 / 4.1 / 4.2 | each 3–6 (**CHANGE** from map-v1 §12's 2–4, **ANNA-APPROVED** 2026-11-10) |
Map-v1 §12 targets 2–4 still apply.
7.1 Sim shortcuts (PROXY, to be replaced by Flint's `simulateWorld`): skirmish win chance ∝ adult count; AI food = 20 per prey point held per season; hazard penalty = daily hazard % / 5. Tracker should rerun these bands on `simulateWorld`.

## 8. Councils (SUPERSEDED by `councils-v0.1.md`; kept for history only)
8.1 **When and where:** once a season, on the last day, at `split_rock` (neutral, central and safe; if it's held, the most central neutral region), before map-v1 §9.5 skirmishes and §9.6 expansion. It's a scene with no day cost. A council is skipped if no pair of factions has an agenda item (§8.3).
8.2 **Who:** the three AI pride leaders, plus the player once their pride is founded (`pride_founded`). Loners, bands and wolves never attend. Player roles for Saga's council scene: founded-pride leader = full party; a member of an AI pride = absent, but may be brought as observer by its leader if pair value ≥ 30 (no vote); loner = absent. Absent cats hear the outcome by gossip. If a leader can't attend (injured Serious or worse, or dead and not yet replaced), that pride makes no new deals this season.
8.3 **Agenda (at most 3 items, most urgent first):** each contested region (map-v1 §9.1); each pair at pride relation ≤ −30 (a feud); each expiring agreement. The player can raise one item of their own.
8.4 **Agreements:**
| Kind | Effect (existing rules only) | Lasts |
|---|---|---|
| Truce | no §9.5 skirmish roll and no §8.3 trespass fight between the pair | 1 season |
| Border deal | for one contested region: the side that cedes drops its claim to 20, under `contestMin`, and won't Mark it | 2 seasons |
| Alliance | needs relation ≥ 30 both ways. The pair never Marks each other's held regions, and each counts as the other's defenders vs a §5b.4 band (like the My Pride Guard rule) | until broken or relation < 0 |
8.5 **Acceptance (AI):** P = clamp(30 + relation/2 + 10 × (their strength < ours ? 1 : −1), 5, 90)%, using pride relation (formulas §4 table) and map-v1 §9.2 prideStrength. Temperament: Highcrag −10 (proud), Bonefield −10 for truces and deals but +0 for alliances, Mistwood +10 (it wants quiet). Same rule for AI–AI deals. The player accepts or refuses by choice.
8.5a **Ties (PROPOSED DEFAULT):** equal prideStrength gives the strength term 0. Agenda items of equal urgency go contested region, then feud, then expiring agreement, then the region nearest `split_rock`. If both sides of a contested region want the same border deal, the side with the lower claim cedes; at equal claim there is no deal this season.
8.6 **Keeping and breaking:** each agreement is a promise under milestone-2 §11.3 at the pride level: kept to expiry +5 pride relation, broken −5. Breaking also writes world fact `broke_{kind}` (whitelist §12), which every pride learns by gossip, and it's a reputation deed (Honour, negative). Any Mark, skirmish or fight against the other side breaks it.
8.7 **Memory:** `world.agreements[] = {id, kind, a, b, regionId?, startSeason, endSeason, state: active|kept|broken}`. Directory history and the narrator can reference them.
8.8 **Pass bands (Tracker, on `simulateWorld`):** councils don't freeze the map: §7 bands still hold with councils on. Over 10 AI-only years, every pride pair has 1+ agreement, and at least 1 breaks in 20% or more of runs (betrayal happens). No region stays under a border deal for more than 4 seasons in a row.

## 9. Rulings on Saga's region draft
9.1 `drowned_mere`: the map wins. It's neutral, rich and contestable. Lore calls it "old Mistwood border land, unclaimed now".
9.2 Shore loners: point each loner's `homeZones` at the place their lore actually describes (`mere_shore` / `island_mere`). Legacy ids stay valid.
9.3 Ashfall keeps `ash_hills` (with `bears_throat`) as home zones (Director 2026-11-10, final). A loner's home zone is never territory (map-v1 §8.3). It's a dangerous home: on days he ends in the hills he takes their `wolves` 10% hazard like anyone, and meeting him there carries that risk for the player.
9.4 Water `pool`: add it to the enum (steppe's seasonal pools). It drinks like `marsh`, and it's dry in winter only if it freezes.
9.5 `west_spur`: no hazard (decided). "— (1%)" in the spec means no listed hazard, so `map.json` is right.
9.6 Human camps and hyena dens: placed as features in §10 (Director 2026-11-10, replacing my earlier "not in v1").

## 10. Human camps and hyena dens (PROPOSED DEFAULT)
| Region | Feature | New hazard | Danger after §3.1 |
|---|---|---|---|
| `salt_flats` (tundra edge) | human camp | `humans` 3% | 2 |
| `camel_ridge` (far ash edge) | human camp | `humans` 4% | 3 |
| `tar_seeps` | hyena den (scavengers at the tar traps) | `hyenas` 5% | 3 |
| `south_range` | hyena den | `hyenas` 4% | 2 |
10.1 `humans` outcome: an encounter with humans (encounters §2.8: not fightable, Intimidate or Flee only). If the flee fails, a spear wound is a Serious injury (formulas §4.3 tier, Style multipliers apply), and the cat drops anything it's carrying. Humans never chase into another region. Story: the injury is minor at most.
10.2 `hyenas` outcome: an encounter with a lone hyena 70% of the time, or the hyena clan 30% (encounters §2.8 table). The player can fight or flee. While the player is carrying or eating a kill, the clan may take it like `wolves` does (lose 1 medium carcass) instead of fighting.
10.3 Neither feature can be claimed away, and neither one moves. Regions with them stay claimable, but AI expansion treats them as hazardous (map-v1 §9.6 hazardPenalty includes the new %). The player learns of a feature by visiting the region, by scent sign or by gossip, and then it shows on the map and in the Lore Book.
10.4 Balance: `split_rock` (start) is untouched, so map-v1 §12 target 1 holds. Tracker: in 20 days in `south_range`, a fresh Story loner sees 0–2 hyena encounters (90%), and in Standard dies of hyenas in under 5% of those runs.

## Changelog
- v0.1.5 (2026-11-10): Director reversed the summed-hazard ruling, so danger goes back to the single highest hazard (v0.1.3 text). v0.1.4 is withdrawn.
- v0.1.3 (2026-11-10): Tracker review. Danger uses the highest single hazard (`salt_flats` max 5% gives band 1, +1 camp = 2; `south_range` max 4% gives 1, +1 den = 2, so §10 stands); council tie rules (§8.5a); regions-per-pride band change from map-v1 §12 flagged.
- v0.1 (2026-11-10): first draft.
- v0.1.2 (2026-11-10): human camps and hyena dens (§10) in danger; council site and player roles; Ashfall keeps `ash_hills` as a dangerous home (Director final).
- v0.1.1 (2026-11-10): §8 councils (once a season, leaders only); §9 rulings on Saga's region draft.
- v0.1.4 (2026-11-10, Tundra): ANNA-APPROVED via Director. The 3–6 regions band is approved; §8 is superseded by councils-v0.1. Backup `world-map-territory-v0.1.pre-anna.bak.md`.
