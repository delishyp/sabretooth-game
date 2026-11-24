# Councils v0.1.3
Status: **ANNA-APPROVED** (Anna via Director, 2026-11-10), with her two answers folded into §1 and §2. Sim: `sim/councils_sim_v0.2.py` (see §7). §3.4–3.5, §5.1a and §9 are PROPOSED DEFAULT on top of Anna's approval. Originally drafted by Tundra, 2026-11-10. This merges the two existing council rule sets into one spec and replaces both: milestone-2 §12.9 (trigger cadence, access tiers, agreement record, breach and ledger deltas) and world-map-territory v0.1.3 §8 (season council, agenda, acceptance, territory agreements, pass bands). **No new numbers.** Every value cites one of those two sources and keeps their label: PROPOSED DEFAULT unless marked. It also settles reputation v0.1.2 Q6 (E4). Text and the scene are Saga's, and the UI is Ochre's (existing art only).

## 1. Cadence (one council per season, plus emergencies: ANNA-APPROVED)
1.1 A season is 20 days (needs §0.1, ANNA-APPROVED), so milestone-2's "one council per 20-day block" and world-map's "once a season" are the same limit. **At most one council per season.**
1.2 **Scheduled:** on the last day of the season, at `split_rock` (or the most central neutral region if it's held), before map-v1 §9.5 skirmishes and §9.6 expansion. It's a scene with no day cost. It's skipped if the agenda (§3) is empty.
1.3 **Called early:** if a milestone-2 §12.9.1 trigger latches mid-season (a pride relation crosses into hostile at −50, a pride-level fight, or a breach), the season's council moves up to the next free day-resolution slot. It never interrupts a `pendingArc`. That council *is* the season's council, so none is held at season end.
1.4 A pride whose leader is Serious-injured or worse, or dead and not yet replaced, sits out and makes no new deals that season.

## 2. Who sits (ANNA-APPROVED: only pride leaders attend)
Only pride leaders attend: the three AI leaders and, once founded, the player as leader of their own pride. This replaces milestone-2 §12.9.2–3's summoned, companion and observer roles and world-map §8.2.
| Player status | At the council |
|---|---|
| Loner | Not present and can't ask to come. A loner who is the subject of an item (for example Return of trespasser) is decided about in absence. |
| Mate of a pride cat, not a founder | Not present. |
| Member of an AI pride | Not present; their leader speaks for the pride. |
| Founded-pride leader | Seated with a voice. **Votes only if recognised:** at least 2 AI prides hold `prideToPlayer` above −15 (APPROVED, m2 §12.9.3). |
Everyone else hears the outcome through gossip (lore book §2). Bands and wolves never attend. Flint: drop the `summoned`, `companion` and `observer` attendance states.

## 3. Agenda (world-map §8.3, §8.5a)
3.1 At most 3 items, most urgent first: a contested region, then a feud (pride relation −30 or below), then an expiring agreement. Ties go to the region nearest `split_rock`.
3.2 A seated, recognised player can raise one item of their own.
3.3 **Shared-ground item (PROPOSED DEFAULT, from the sim):** a pride that is hungry (food need 2 or more, map-v1 §9.6) asks the neighbour holding its best adjacent hunting region for a Shared hunting ground. It ranks after the three kinds in §3.1. Without it, AI-only councils meet about 3 seasons in 40 because AI prides rarely contest the same land.

3.4 **Pact item (PROPOSED DEFAULT, candidate):** if two prides have both fought the same third pride within the last 2 seasons, they get a Truce item between them. This is how distant neighbours (Highcrag and Mistwood) come to the table.
3.5 **Fight item:** a pride-level fight calls the council early (§1.3), and its agenda carries a Truce item for that pair.

## 4. Agreements (the two term lists merged)
| Kind | Effect (existing rules only) | Lasts | Was |
|---|---|---|---|
| Truce | no §9.5 skirmish roll and no §8.3 trespass fight between the pair | 1 season | world `Truce`, m2 `border_truce` and `non_aggression` |
| Border deal | for one contested region, the side that cedes drops its claim to 20 and won't Mark it there | 2 seasons | world `Border deal` |
| Shared hunting ground | both may Hunt in one named region without counting as trespass or `hunt_steal` | 1 season | m2 `shared_hunting_ground` |
| Alliance | needs relation 30 or more both ways; neither Marks the other's held regions, and each defends the other against a §5b.4 band | until broken or relation drops below 0 | world `Alliance` |
| Admission courtesy | the signatories hear a named petitioner's admission request instead of refusing on sight | 1 season | m2 `admission_courtesy` |
| Return of trespasser | a named trespasser is walked back unharmed | until done, or the season ends | m2 `return_of_trespasser` |
4.1 Season lengths replace m2's `durationDays=20`, which comes to the same thing.
4.2 Record: `world.agreements[] = {id, councilId, kind, parties, regionId?, catId?, startSeason, endSeason, state: active|kept|broken|expired, knowledgeScope}`. Scope is `world_known` by default and `pride_known` to the signatories if the council was private (m2 §12.9.4).

## 5. Acceptance (world-map §8.5 plus reputation E4)
5.1 AI P(accept) = clamp(30 + relation/2 + 10 × (their strength < ours ? 1 : −1), 5, 90)%, with strength 0 at a tie. Temperament: Highcrag −10, Bonefield −10 for truces and deals but 0 for alliances, Mistwood +10. AI–AI deals use the same rule.
5.1a **Truce after blood (PROPOSED DEFAULT, candidate):** for a Truce item, the `30 + relation/2` part is replaced by a flat 50, so prides that have just fought can still agree to stop. Strength and temperament still apply.
5.2 **Honour (settles reputation Q6, PROPOSED DEFAULT):** ±3 per *known* Honour level of the proposing leader, capped at ±9 (reputation E4). Honour changes how likely you are to be believed, not who may speak; access is §2 only.
5.3 No agreement is allowed (m2 §12.9.5, `council_disagree`, no standing change).

## 6. Keeping and breaking (m2 §12.9.6–7 and world-map §8.6, merged)
6.1 Breach detection is m2 §12.9.6. A Mark, skirmish or fight against a signatory breaks every agreement between those prides. The first matching event breaks it, once, with a receipt.
6.2 **Kept to the end:** +5 each way between signatories (m2 `fulfilDelta`, which matches world-map's +5).
6.3 **Broken:** the breaker → each signatory −15, each signatory → the breaker −10 (m2 deltas; these replace world-map's flat −5). This writes world fact `broke_{kind}`, which spreads by gossip, and it's a negative Honour deed (reputation).
6.4 **Expired:** a task-type term (return of trespasser) that ran out with neither done nor broken. No change.
6.5 Every agreement is a promise at pride level (milestone-2 §11.3), and the lore book lists it under Promises and debts while it's active.

## 7. Tracker pass bands and sim result (`sim/councils_sim_v0.2.py`, 500 seeds × 40 seasons, AI only)
| Band | Target | Before §9 (no ambition) | **With §9** |
|---|---|---|---|
| Holder changes per season (world-map §7) | 0.6–1.5 | 0.98 | **1.19** |
| Most regions one pride holds, p95 | ≤ 7 | 5 | **6** |
| Longest freeze, p95 | ≤ 8 | 5 | **5** |
| Regions held after 10 years | each 3–6 | 4.0–4.3 | **3.9–4.0** |
| Pride-vs-pride fights per 10 years | candidate ≥ 4 | 0.7 | **6.0** |
| Pair makes 1+ agreement: Bonefield–Highcrag, Bonefield–Mistwood | ≥ 80% of runs | 88%, 88% | **85%, 87%** |
| Pair makes 1+ agreement: Highcrag–Mistwood (they touch only at the Greywater Ford / Reedbank edge) | ≥ 50% of runs (**APPROVED** by Director, distant pair, no map change) | 48% | **57%** |
| AI-only deal broken at least once (Director split) | 20–30% of runs (Director) | 0% | **26%** |
| Player's deals: broken in runs where the player founded and signed one (Director split, per (a)) | ≥ 20% of those runs | not simmed | **Tracker, on `simulateWorld` with a player script** |
| No border deal over 4 seasons in a row | max ≤ 4 | 2 | **4** |
| At most one council per season | always | pass | **pass** (about 6 early councils per 10 years) |
Breach deltas stay −15/−10 (APPROVED). Mean pride relation settles near −2, so prides are wary of each other without being at war.
7.1 **Highcrag–Mistwood.** Geography caps this pair: their only shared edge is the Greywater Ford / Reedbank edge, and Bonefield usually holds the ford. Pushing them past about 55% would need a map change (for example an Upper Greywater–Reedbank edge), which needs Anna. I'd rather keep them as the distant pair.

## 8. Anna's answers and open item
1. **ANNA-APPROVED:** once a season, plus an early one when a feud boils over.
2. **ANNA-APPROVED:** only pride leaders attend, and a loner can't ask to come (§2).
3. **Director ruled (2026-11-10):** do both, with (b) first. §9 makes the AI contest land, and §7 splits the break target into an AI-only band and the player's 20% band.
4. **Director ruled (2026-11-10):** Highcrag–Mistwood stays the distant pair at 50% or more, with no map change. AI-only breaks are held to 20–30% of runs.

## 9. AI border ambition (PROPOSED DEFAULT, candidate numbers from the sim)
9.1 Each season, a pride with no claim it is pressing starts one with chance `ambition × temperament`: `ambition = 0.25`, temperament Bonefield ×1.2, Highcrag ×1.0, Mistwood ×0.8. It picks a neighbour's held region next to its own, never a core den, and prefers more prey and a weaker hold.
9.2 It Marks that region every season (map-v1 Mark, +25) until it holds it, the region stops being held by a pride, or 4 seasons pass. That builds a contest, and a contest brings the existing §9.5 skirmish rolls.
9.3 If a Truce, Border deal on that region, or Alliance with the holder blocks the Mark, the pride breaks it with chance `0.10` (an AI breach, §6.3 applies), or otherwise waits.
9.3a **Restraint:** two AI prides with any live agreement skip the §9.5 skirmish roll over a contested region. With chance `0.15` one side fights anyway, which breaks every deal between them (§6.1).
9.4 Flint: `council.ambition 0.25`, `ambitionTemperament {bonefield 1.2, highcrag 1.0, mistwood 0.8}`, `pressSeasons 4`, `ambitionBreakPct 10`, `dealSkirmishBreakPct 15`, `truceAcceptBase 50`, `pactItemWindowSeasons 2`.

## Changelog
- v0.1.3 (2026-11-10, Tundra): per Director, AI-only breaks cut from 42% to 26% of runs. §9.3's break chance goes to 0.10, and §9.3a adds restraint (pairs with a live deal skip skirmishes, breaking 15% of the time). Fights stay at 6.0 per 10 years, and every band passes. Sim `councils_sim_v0.2.py` v0.2.1. Backup `councils-v0.1.2.bak.md`.
- v0.1.2 (2026-11-10, Tundra): per Director, §9 AI border ambition, §3.4 pact item, §3.5 fight item and §5.1a truce-after-blood acceptance (all PROPOSED DEFAULT, candidate). §7 rerun on `sim/councils_sim_v0.2.py`: every band passes, Highcrag–Mistwood is held at 56% by geography (§7.1), and the player's 20% band goes to Tracker. Backup `councils-v0.1.1.bak.md`.
- v0.1.1 (2026-11-10, Tundra): ANNA-APPROVED via Director. Folded her answers into §1, §2 (leaders only; summoned, companion and observer roles removed) and §8. Added §3.3 shared-ground item (PROPOSED DEFAULT). §7 now holds the council sim results: territory bands pass, two council bands fail, −15/−10 confirmed. Backup `councils-v0.1.pre-anna.bak.md`.
- v0.1 (2026-11-10, Tundra): first standalone spec. It merges milestone-2 §12.9 and world-map-territory §8, settles reputation Q6, and makes no new numbers. The −15/−10 breach deltas are flagged sim pending.
