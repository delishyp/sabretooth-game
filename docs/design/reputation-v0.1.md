# Reputation and renown v0.1.2 (DRAFT)
Status: **ANNA-APPROVED** (Anna via Director, 2026-11-10) (Anna's Q7 and Q9 answers folded by Tundra). Written by Saga (narrative owner), 2026-11-10, assigned by Director from Anna's brief. Numbers in §5, §7.2–7.3, §9.1 and §11 are **Tundra's v0.1.2 tuning (PROPOSED DEFAULT)**, from `sim/reputation_sim_v0.1.2.py` (commit `621ec4a`, output in `sim/reputation_sim_v0.1.2.out`). Every number in this file is **(proposed)** unless it cites an existing spec, the code or the sim; v0.1.2 numbers are **PROPOSED DEFAULT**. Player-facing words below are placeholders that Saga will finalise. No player-facing text contains a number.

Sources read: milestone-2-spec v0.6.3 §11–§13, lone-cat-actions v0.1, choice-payoffs v0.2.1, cat-directory v0.1.1, my-pride v0.1, encounters v0.1, map-v1 v1.0.1, world-map-territory v0.1.1, loners-spec v0.9, formulas v0.2.4, relationships v0.1.4, skills v0.2.3, lifecycle v0.1, world-gen v0.3.6, genetics v0.4.5, play-styles v0.2; code at `/tmp/st` `4647955` (`world-memory.js`, `lone-actions.js`, `encounter.js`, `pairing.js`, `conversation.js`, `slice.js`, `data/events/slice-1.json`); lore `docs/lore/loners.md`, `world-and-prides.md`, `slot-table-review.md`, Saga `motives-v1.json`; council draft `/workspace/saga-pairing-milestone/contract-v0.3/council-feud-draft.md`.

## 1. Goals and non-goals
1.1 **Goals**
1. Reputation is a slow, lifetime record of what a cat **did**, measured along a few moral axes.
2. Reputation is what others **know**. Every deed is a world-memory fact, and an observer's view of a cat only counts the deeds that observer knows (`knowsFact`, milestone-2 §12.4.4).
3. A single act barely moves it. A level needs a sustained pattern, and the pacing follows Tundra's sim (§5).
4. High renown earns a title ("{name} the Merciful"), and specific feats earn epithets ("{name} Hyena-Bane"). Both apply to the player and to NPCs.
5. It feeds into existing systems through small, capped modifiers: greetings, courtship, leader approval and councils, territory danger and AI targeting, and offspring.
6. It is words only on screen.

1.2 **Non-goals (v0.1)**
1. No new actions. Deeds come only from actions and events that already exist in code or in specs (§4). Desirable missing deeds are listed separately (§4.6).
2. No numbers, bars or percentages in the UI.
3. No change to existing affinity, standing, receipt or spillover numbers. Reputation is a separate store that only *reads* the same events.
4. It does not replace personality. Personality is what a cat is like; reputation is what others say it did.
5. No reputation decay in v0.1 (§5.5), and no free-text deeds.
6. The wolf faction and loner bands have no pride reputation (milestone-2 §12.1.3–4). Their members can still hold personal reputation.

## 2. Axes
2.1 Three axes (proposed). Each is a signed line with two named poles.

| Axis id | Negative pole | Positive pole | What it measures |
|---|---|---|---|
| `mercy` | Cruel | Merciful | harm vs kindness to the weak: cubs, the hungry, the beaten |
| `courage` | Cowardly | Brave | standing your ground vs leaving others to face danger |
| `honour` | Faithless | Honourable | keeping vs breaking your word |

2.2 **Why Honour is included.** The game already tracks promises as data with a pending/kept/broken state and receipts:
- `return_quiet` (conversation.js:96–375; milestone-2 §11.3a.5, .8),
- `bring_prey` (lone-actions.js:211–295, kept/broken with −5; choice-payoffs §3.3 `promise_share`),
- `approach_request` (lone-actions.js:493; lone-cat-actions §8 "Requests … are promises"),
- the "Meet me tomorrow" rendezvous (choice-payoffs §2),
- and pride-level agreements that are promises with kept/broken states (milestone-2 §12.9.6–7; world-map-territory v0.1.1 §8.6, which already names breaking as "a reputation deed (Honour, negative)").

So Honour costs no new system: every Honour deed is an existing kept or broken transition. It is also the axis Highcrag cares about most ("lineage, memory, order", world-and-prides §2.1).
2.3 **Rejected for v0.1:** a separate Fame or Strength axis (it would duplicate fight stat and standing) and Loyal ↔ Traitor (that overlaps `prideLoyalty`, loners §3.4). Feats of strength become epithets instead (§7.4).
2.4 **Pride values (lore, used in §10):** Highcrag values Honour, Bonefield values Courage, Mistwood values Mercy (world-and-prides §2.1–2.3: "lineage, memory, order"; "strength, courage"; "kinship … sorrow rather than anger").

## 3. Data model and save fields
3.1 **Deed ledger** (new, `worldMemory.reputation`):
```
reputation: {
  schemaVersion: 1,
  deeds: [ { deedRowId, receiptKey, absDay, actorId, prideId|null, axis, sign: +1|-1,
             deedId, weightClass: small|medium|big|legend, baseWeight, repeatIndex,
             applied, capped: bool, factId, seasonIndex } ],
  totals: { [actorId]: { mercy, courage, honour } },        // true points, signed, sum of applied
  feats:  { [actorId]: { [featId]: [factId, ...] } },        // epithet counters (§7.4)
  titles: { [actorId]: { [axis]: { pole, gainedAbsDay, lostAbsDay|null } } },
  gate:   { [actorId]: { [axis]: { deedsSinceLevel, daysSinceLevel: [absDay...] } } },
  seeded: bool                                              // lore seed applied (§9)
}
```
3.2 **Facts.** Each deed points to a world-memory fact (`worldMemory.facts` / `knowledge`, world-memory.js:85–200). If the source action already writes a fact (for example `pride_aid`, `aid`, `steal`, `refused_share`, standing deeds), the deed reuses that `factId`. If it doesn't, the deed writes one with `kind: 'rep_deed'` and scope per §4 and §6. Nothing new is stored about knowledge itself; it all goes through the existing `knowsFact`.
3.3 **Derived (never saved):**
- `knownPoints(observerId, actorId, axis)` = Σ `applied × sign` over deed rows whose `factId` the observer knows (`observerId` is a `catId`, a `prideId` or `player`).
- `level` (§5.3) and `title` (§7) are computed from known points.
- The player's view of an NPC is `knownPoints('player', npcId, axis)`.
3.4 **Receipts.** Deed receipt = `runId/rep/{actorId}/{axis}/{sourceReceiptKey}`. It is written in the same atomic commit as the source action's receipt (milestone-2 §11.3.7, §12.3.4). Replay, reload or a double-click never adds a second deed row.
3.5 **Ledger cap (proposed `reputation.deedCap=600`).** When it's exceeded, compact the oldest rows into `{actorId, axis, factScopeKey, netApplied, throughAbsDay, count}` per actor/axis and per identical knowledge set. Rows from the current season and any row that feeds the gate (§5.4) or a feat counter are never compacted. This is separate from `worldMemory.ledgerCap` (milestone-2 §12.3.5).
3.6 **Migration default.** A missing `worldMemory.reputation` becomes an empty store, with `seeded: false`. On load, apply the lore seed (§9) once under receipt `runId/rep/seed`. No retroactive deeds are created from old ledgers or facts, because the original witnesses and order can't be rebuilt. Old saves therefore start every non-seeded cat (including the player) at 0. `schemaVersion` sits beside `worldMemory.schemaVersion` (milestone-2 §12.1.5).

## 4. Deed catalogue (existing actions only)
Weight classes and weights come from the sim (`W`): **small 2, medium 5, big 10, legend 20 (proposed)**. "Built" means the action exists in code at `4647955`; "Spec" means it is specified but not yet built (the deed goes live when the action does).
**Scope** sets who learns at commit: **private** = participants only; **witnessed** = participants plus `witnessIds`, which spreads by the §6 rumor rule; **pride** = `pride_known` to the listed prides; **world** = `world_known`.

### 4.1 Mercy (Cruel ↔ Merciful)
| # | Deed (source) | Built | Pole | Class (weight) | Scope at commit |
|---|---|---|---|---|---|
| M1 | Guide a lost pride cub home: `resolveCub` `guide`, fact `pride_aid` (lone-actions.js:765–790; lone-cat-actions §6) | Built | Merciful | medium (5) | pride (cub's pride, via `prideIds`) |
| M2 | Share your kill with a cat: `shareKill` (lone-actions.js:800–812; presence `share` slice.js:1053; loners §2.4 +10) | Built | Merciful | small (2) | private |
| M3 | Ford: `help_bonefield_cat`, fact `aid` (world-memory.js:592–598; milestone-2 §12.6.6.2) | Built | Merciful | medium (5) | witnessed (the Highcrag cat) |
| M4 | Hyena: `share_remains`, `gift_share` (encounter.js:437; milestone-2 §13.6) | Built | Merciful | small (2) | witnessed (hunter) |
| M5 | Hyena: `take_the_kill`, `hunt_steal` (encounter.js:428–434; §13.6) | Built | Cruel | medium (5) | witnessed (hunter) |
| M6 | Steal from a kill: `beginSteal`, fact `steal` (lone-actions.js:702–725; lone-cat-actions §5) | Built | Cruel | small (2) | caught: private to the owner, then rumor. Success: private to the player only (see note) |
| M7 | Refuse to share: `warn_off` / `my_kill`, fact `refused_share` (slice.js:1063; lone-actions.js:918; choice-payoffs §3.3) | Built | Cruel | small (2) | private |
| M8 | First-meeting rudeness: `drive`, `dismiss`, `insult`, `sneer` (`affinityIntent: worsen`, data/events/slice-1.json meetings) | Built | Cruel | small (2) | private |
| M9 | Exile a pride member (my-pride §3 #5; loners §6.4 "After leaving") | Spec | Cruel | small (2) | pride (own pride), and the exile knows |
| M10 | Attack a loner (loners §2.4 attack −30) | Spec | Cruel | medium (5) | witnessed |
| M11 | Mediate a band quarrel, success (loners §10.3) | Spec | Merciful | small (2) | witnessed (band members) |
| M12 | Warning-turn groom or share for an unhappy member (loners §10.4) | Spec | Merciful | small (2) | pride (own) |

**Note on M6:** `beginSteal` lists the owner in `participants` even when the steal succeeds unseen. For reputation, a clean steal should be private to the player. **Flint:** please confirm, or tell me if the fact scope is meant this way.

### 4.2 Courage (Cowardly ↔ Brave)
| # | Deed (source) | Built | Pole | Class (weight) | Scope |
|---|---|---|---|---|---|
| C1 | Hyena `drive_off` that succeeds (`hyena_driven`, deed `drive_hyena`, encounter.js:396–416; §13.6) | Built | Brave | medium (5) | witnessed (hunter) |
| C2 | Hyena `drive_off` that fails (`hyena_keeps_kill`, encounter.js:409) | Built | Brave | small (2) | witnessed. It's still brave to try, but this writes no standing (§13.6 is unchanged) |
| C3 | Hyena `yield_kill` / `retreat` **while a pride hunter is cast** (encounter.js:418–425) | Built | Cowardly | small (2) | witnessed. With no ally present: no deed |
| C4 | Hyena `warn_off_trespasser` (`return_trespasser`, encounter.js:441–446) | Built | Brave | small (2) | witnessed |
| C5 | Mate rival challenge: `rival_won` / `rival_lost` (pairing.js:695–705; formulas §4.4) | Built | Brave | won: medium (5); lost: small (2) | witnessed (target, rival) |
| C6 | Patrol scene `defy` (slice-1.json `slice.patrol.*`) | Built | Brave | small (2) | witnessed (patrol cat) |
| C7 | Encounter fight Flee vs a cat while an ally is in the fight (encounters v0.1 §2.2) | Spec | Cowardly | small (2) | witnessed. Fleeing a wild enemy or the flee-only wolf pack is never a deed (§13.2) |
| C8 | Drive off a rival loner (loners §5.3) | Spec | Brave | medium (5) | witnessed |
| C9 | Band warning `meet` (loners band answers) | Spec | Brave | medium (5) | pride (own) |
| C10 | Yield a band territory challenge, or Yield a contested region (loners band answers; map-v1 §9.5) | Spec | Cowardly | medium (5) | world |
| C11 | Fight in a border skirmish: win / lose (map-v1 §9.5; world-map-territory §6.4) | Spec | Brave | win: medium (5); lose: small (2) | world |
| C12 | Leadership challenge as challenger: win / lose (formulas §4.4; relationships §5.4) | Spec | Brave | win: legend (20); lose: big (10) | world |
| C13 | Band challenge for `mates` as leader of the band, win (loners §5b.5, §10.5) | Spec | Brave | big (10) | world |

### 4.3 Honour (Faithless ↔ Honourable)
| # | Deed (source) | Built | Pole | Class (weight) | Scope |
|---|---|---|---|---|---|
| H1 | Promise `return_quiet` kept (conversation.js:368–375; §11.3a.8) | Built | Honourable | small (2) | private (the promisee) |
| H2 | Promise `bring_prey` kept (`keepBringPrey`, lone-actions.js:235–244) | Built | Honourable | small (2) | private |
| H3 | Promise `bring_prey` broken by refusal (`breakBringPrey` `refused`, −5) | Built | Faithless | medium (5) | private |
| H4 | Promise `bring_prey` broken because the kill went to someone else (`given_away`, lone-actions.js:261) | Built | Faithless | small (2) | private until `told` |
| H5 | `approach_request` kept / broken (lone-actions.js:493; lone-cat-actions §8) | Built | ± | small (2) | private |
| H6 | Rendezvous kept, "You came." (choice-payoffs §2.2). A miss is never a deed (§11.3.4: absence isn't breaking) | Built | Honourable | small (2) | private |
| H7 | Pride agreement kept to expiry / broken (milestone-2 §12.9.7; world-map-territory §8.6, fact `broke_{kind}`) | Spec | kept: Honourable medium (5) to the leader; broken: Faithless big (10) to the leader and the pride | world |
| H8 | Council testimony `cite_known_source` (council-feud-draft "accounts") | Draft | Honourable | small (2) | the attending leaders |

### 4.4 Pride-level deeds
H7, C10, C11 and C13 also add the same deed to the **pride pool** of the acting pride (§8.2). They come from world-map-territory §6.4 ("winning or losing a skirmish and claiming or losing a region are deeds"). Claiming or losing a region by Mark or upkeep isn't a moral act on any of the three axes, so it counts only toward the epithet feat `land_taker` (§7.4). **Tundra:** please confirm.

### 4.5 Not deeds (on purpose)
- Talk, groom and courtesy choices (`greet`, `introduce`, `listen`, `yield`, `withdraw`): these are manners, and they already move affinity.
- Spar (it's play), scout, shadow, watch, scent sign, hunting itself, Rest and Travel.
- Fleeing wolves or humans (flee is the sanctioned, sensible choice).
- `stay_out` at the ford, and `side_with_highcrag` (taking a side isn't mercy or cruelty).

### 4.6 Needs a new system (not in v0.1)
- Killing a cub during a pride takeover (Bonefield law, flagged "flavour only", world-and-prides §4) would be legend-class Cruel.
- Defending your own cubs from a rival (loners §5.1 "target cubs") would be Brave or Merciful, but it needs a defence scene.
- Sparing a beaten foe in a lethal fight would be Merciful, but it needs a "spare / finish" choice in encounters.
- Lying at council, or a false accusation, would be Faithless, but it needs a deception system.
- Carrying an injured pridemate home, or feeding elders first (the `eat_last` perk is passive) would be Merciful.
- Abandoning a mate or cubs would be Faithless (needs a mate-bond break by choice, my-pride §4).
- Taking down adult megafauna as a group would be a legend feat (needs pride hunts).
- Wolf pup `harm` (milestone-2 §13.2, unauthored) would be Cruel.

## 5. Gradual curve
5.1 **Accumulation (sim `add`):** `applied = min(weight × 0.5^repeatIndex floored at 1, span / 3)`.
- `repeatIndex` = how many times the **same `deedId`** by the same actor has already applied this season (20 days, map-v1 §2). So the same deed is worth full, then 1/2, then 1/4, never below 1 (proposed).
- `span` = the width of the actor's current level band on that axis (§5.3). Above level 5, `span` is 450 (as in the sim).
- One deed can never move more than a third of the current level (proposed, from the sim).
5.2 **Direction.** A deed adds `applied × sign` to the actor's signed total on that axis. An opposing deed moves the total back toward 0 first, then into the other pole. There's no extra multiplier for opposing deeds in v0.1 (that keeps it matched to the sim; see Q3).
5.3 **Level thresholds** on |known points| (sim `TH`, Tundra v0.1.2, PROPOSED DEFAULT): **L1 25, L2 90, L3 250, L4 550, L5 1000**. The pole is the sign. Below 25 a cat has no reputation on that axis.
5.4 **Sustained-pattern gate (Tundra v0.1.2, PROPOSED DEFAULT).** Before a level can rise, **both** of the following must be true, on top of the point threshold (§5.3). If either is short, points still accrue and the level waits. Neither rule replaces the other, and the seasonal repeat-halving in §5.1 also stays.
- **Minimum deeds** on that axis since the last level change: **4 to reach L1, 8 for L2, 12 for L3, 20 for L4, 30 for L5**.
- **At least 3 different days** with a deed on that axis since the last level change.
- The gate applies to known points per observer as well: an observer must know the same minimum number of deeds, spread over at least 3 different days, before its view of the level rises.
5.5 **Decay:** none (**ANNA-APPROVED**: reputation doesn't fade; the sim has none). A dead cat's reputation freezes and stays in memory and gossip.
5.6 **Big public moments count more** in two ways, without breaking the sim: their weight class (C12 legend, H7 big), and their scope (world-known deeds reach every observer at once, §6).
5.7 **Lifetime pacing target** (Tundra v0.1.2, PROPOSED DEFAULT; `sim/reputation_sim_v0.1.2.py`, output in `sim/reputation_sim_v0.1.2.out` @ `c0ffa19`; 1,500 lives per cell, seed 5, 10 years at 80 days/year, lifecycle §2). Each deed lands on one of three axes and one pole. PROXY styles from the sim: **focused** (one-pattern) = 70/15/15 axis split, 85% of deeds on the main pole; **balanced** (evenly spread) = 34/33/33, 75% main pole; **mixed** (mixed poles) = 34/33/33, 55% main pole. Both tables are copied from the .out (title = any axis at L3; level-arrival days are best axis). The .out does not report p10–p90.

| Profile × style (PROXY) | Title reached | Median year | Holding a title at 3 / 5 / 10y | Best-axis mean level at 5y |
|---|---|---|---|---|
| casual focused | 97.7% (1,466 of 1,500) | 7.5y | 0% / 0% / 98% | 2.0 |
| casual balanced | 0.0% | — | 0% / 0% / 0% | 1.2 |
| casual mixed | 0.0% | — | 0% / 0% / 0% | 0.7 |
| active focused | 100.0% | 4.2y | 2% / 87% / 100% | 2.9 |
| active balanced | 47.9% (719 of 1,500) | 9.0y | 0% / 0% / 48% | 2.0 |
| active mixed | 0.0% | — | 0% / 0% / 0% | 0.9 |
| npc focused | 0.3% (5 of 1,500) | 9.6y | 0% / 0% / 0% | 1.3 |
| npc balanced | 0.0% | — | 0% / 0% / 0% | 0.9 |
| npc mixed | 0.0% | — | 0% / 0% / 0% | 0.3 |

| Profile × style (best axis, 10y) | L1 | L2 | L3 (title) | L4 | L5 |
|---|---|---|---|---|---|
| active focused | 100%, med day 32 | 100%, med day 121 | 100%, med day 339 (~4.2y) | 75%, med day 722 | 0% |
| casual focused | 100%, med day 60 | 100%, med day 216 | 98%, med day 603 | 0% | 0% |

An active one-pattern player titles at median day 339 (~4.2 years, inside Anna's 3–5). A casual one-pattern player titles at median day 603 (~7.5 years) and does not reach L4. An active focused player reaches L4 in 75% of lives (median day 722) and L5 in none in 10 years. An active player who spreads deeds evenly across three axes titles late and only about half the time (47.9%, median 9.0y). Mixed poles never title (0.0%). Ambient npc titles are rare, not impossible: npc focused reaches a title in 0.3% of lives (5 of 1,500, median 9.6y); balanced and mixed 0.0%. The old 0% on that focused line was rounding, not a bug. P9 seed check in the same .out: an NPC seeded at L3 + 10% of span (250 + 10% of 300 = 280) on its main axis, then 7 years of ambient npc deeds, is still titled at 7y in 100% of lives in all three styles, reaches L4 0%, and never titles a second axis.

**Caveat (Tundra):** deed rates and play-style profiles are placeholders (PROXY). Tracker's P-bands must be checked against real play logs once reputation is built.

## 6. Witnesses and spread
6.1 **At commit**, the deed's fact gets the scope from §4. Participants and `witnessIds` know it at once (world-memory.js:126–138).
6.2 **Pride rumor (existing):** a fact witnessed by a current member of pride P becomes `pride_known` to P after 3 days (milestone-2 §12.4.5, `rumorDaysToPrideKnown=3`). That's unchanged, and deed facts use it as is.
6.3 **Cross-pride gossip (new, proposed):**
- A deed fact that is `pride_known` to P, with class medium or higher, becomes known to every pride whose held regions border P's after **20 days** (one season). It's carried at the season-end council or border contact (world-map-territory §8.1).
- Big and legend deeds become `world_known` after **10 days**.
- Small deeds never spread past the first pride by themselves.
- Receipt: `runId/rep_rumor/{factId}/{prideId}`.
6.4 **Loner gossip (existing):** in any talk at value ≥ 20, a cat may share one fact it knows, and the player may pass one on (lone-cat-actions §8, `disclose()`, `rumor_spread`). A shared deed fact counts for whoever learns it. Loners have no pride pool, so they spread only by talk.
6.5 **Player knowledge of NPC deeds:** the player learns NPC deeds by witnessing them, through gossip (§6.4), councils (as an attendee or by gossip, world-map-territory §8.2), scent sign and scout reports, and through `world_known` facts. The `rumor_web` perk (skills §2.2) makes rumors arrive on the next turn, and that applies to deed facts.
6.6 **Private deeds stay private.** A private deed counts only in its participants' view. A private kindness to one loner never raises a pride's view of the player (same rule as spillover, milestone-2 §12.4.1).

## 7. Levels, titles and epithets
7.1 **Display ladder (placeholders; Saga finalises).** `{name}` is the run name (world-gen §3, re-rolled each run).

| Level | Merciful | Cruel | Brave | Cowardly | Honourable | Faithless |
|---|---|---|---|---|---|---|
| L1 | "Said to be gentle" | "Whispered to be cruel" | "Said to have nerve" | "Whispered to be a coward" | "Said to keep their word" | "Whispered to break their word" |
| L2 | "Known as merciful" | "Known as cruel" | "Known as brave" | "Known as a coward" | "Known as true to their word" | "Known as faithless" |
| L3 title | "{name} the Merciful" | "{name} the Cruel" | "{name} the Brave" | "{name} the Craven" | "{name} the True" | "{name} Oathbreaker" |
| L4 | "Renowned for mercy" | "Feared for cruelty" | "Renowned for courage" | "Scorned as a coward" | "Renowned as true" | "Known everywhere as faithless" |
| L5 | "Sung of for mercy" | "A name to frighten cubs" | "Sung of for courage" | "A byword for cowardice" | "Sung of as true" | "A byword for betrayal" |

7.2 **Title threshold:** L3, which is 250 known points plus the gate (Tundra v0.1.2, PROPOSED DEFAULT). By the sim, an active focused (one-pattern) player reaches it at median day 339 (~4.2 years; holding a title at 3 / 5 / 10y: 2% / 87% / 100%); a casual focused player at median day 603 (~7.5 years; 0% / 0% / 98%). Ambient npc play almost never titles (0.3% focused, 5 of 1,500); notable NPCs hold a title from lore seeds (§9).
- Tundra agrees with Saga, and Director has ruled: the first level change gives words only ("Whispered to be…") and the title waits for L3, because Anna asked for a slow build.
7.3 **One title shown.** The meeting card shows one title: the highest-level axis (ties go Courage, then Mercy, then Honour). The same order selects the stranger greeting (E1). Settled by Tundra and Flint: Courage is the axis a stranger most likely heard of, and titles and greetings share the order. The directory shows every axis at L1 or higher as a word line, plus the title. Gossip lines use the title.
- **Title loss:** yes, but only through opposing deeds, never through time. A title is kept until known points fall below **80% of that level's threshold** (for an L3 title, below 200), so titles don't flicker. Opposite big/medium deeds in one season, from the .out: a cat at 280 (the L3 seed) drops below 200 after a median 14 deeds (min 11); at 250, median 8 (min 6); at 400, median 78 (min 78). Repeat-halving slows a single season; loss is faster across seasons. When one is lost, its `lostAbsDay` is set, and Saga writes a "once called…" gossip line.
- A cat whose total flips pole must climb back through L1 and L2 before earning the opposite title.
7.4 **Epithets from feats (proposed).** Feats are counters of **known** feat facts, so they never decay. An epithet shows only to observers who know at least the threshold number of those facts.

| featId | Counts | Threshold | Epithet (placeholder) |
|---|---|---|---|
| `hyena_bane` | `hyena_driven` outcomes (C1) | 3 | "{name} Hyena-Bane" |
| `cub_guide` | M1 guided cubs | 3 | "{name} Cub-Guide" |
| `kill_thief` | caught steals (M6) + `take_the_kill` (M5) | 3 | "{name} Kill-Thief" |
| `rival_breaker` | `rival_won` (C5) | 2 | "{name} Rival-Breaker" |
| `mammoth_bane` | `prey_taken` on `encounter.mammoth_calf.v1` (milestone-2 §13.3, large) | 3 | "{name} Mammoth-Bane" |
| `land_taker` | regions claimed from another pride (world-map-territory §6.4) | 2 | "{name} Land-Taker" |
| `challenge_won` | leadership challenge wins (C12) | 1 | "{name} who took {prideName}" ; if the place is unknown, "{name} who won the challenge" (**PROPOSED DEFAULT**) |

**challenge_won binding (Tundra, PROPOSED DEFAULT).** The feat fact stores the pride's name as it was at the time of the win; `{prideName}` is bound to that stored name. The player's own (founded) pride counts like any other pride, so it uses the same `{prideName}` form. If the place is unknown to the observer, use the general no-place line ("{name} who won the challenge"). If the observer knows several wins, show the most recent one they know. This replaces the earlier by-pride nicknames ("Crag-Taker" / "Field-Taker" / "Mist-Taker").

Priority on the meeting card: an L4+ axis title, then an epithet, then an L3 title (proposed).

## 8. Pride reputation
8.1 **Pride view** = for each axis, `0.4 × leader's known points + 0.6 × the mean known points of adult and elder members + the pride pool` (proposed), all from the observer's point of view. It uses the same level table and the same words, with "the pride" as the subject ("Highcrag is known as faithless").
8.2 **Pride pool.** This holds pride-level deeds (§4.4), credited to the pride itself with the same curve and gate. A council breach (H7) hits both the leader and the pool.
8.3 **Player's pride:** after `pride_founded`, the founded pride gets a pool. It also starts from the founders' known points through 8.1. My Pride's summary header gets one Reputation line in words (my-pride §2).
8.4 Loner bands, groups and wolves have no pride view (§1.2.6).

## 9. NPC starting reputation and NPC deeds
9.1 **Seeding.** At New Game, or on migration, each seed below writes one `lore_seed` deed row per axis, at `TH[level] + 10% of span` (Tundra v0.1.2, the same rule as the P9 sim: L1 = 25 + 10% of 65 = 31.5; L2 = 90 + 10% of 160 = 106; L3 = 250 + 10% of 300 = 280), with the scope given. The L3 value, 280, is the one Tundra ran. Names are random each run (world-gen §3), so seeds key on slot id. Personality is random each run (world-gen §5), so **no seed is taken from the narrative-lean column**. Seeds come from lore deeds only (world-and-prides, loners.md, and the pride roster notes those docs already cite). Director ruled that titles sit at L3 and that NPCs reach L3 only from seeded points, so a notable premade holds a title only if a public lore deed supports L3.
- **"Unknown"** means the lore is silent, and the cat starts at 0.
- **Secrets** (loners.md "Secret / hook") are **never** seeded as known. If a secret comes out later, it becomes a deed then.

| Slot | Seed (axis, pole, level, scope) | Lore grounds |
|---|---|---|
| hc01 | Honour + L3 (title, 280), world | "ruled for many winters"; she keeps Highcrag custom and refused a forbidden mate (world-and-prides §2.1; loners.md, Sorrel). The unjust exile of ln01 is a secret: not seeded |
| hc02 | unknown | the fallen cub is a secret |
| hc03 | unknown | lore gives a role, not deeds |
| hc04 | unknown | foundling; his origin is a secret |
| hc05 | unknown | hunter; no deeds in lore |
| hc06 | Mercy + L1 (31.5), pride (highcrag) | "could calm a storm if it came near the cubs" (motives gossip) |
| hc07 | Honour + L1 (31.5), pride (highcrag) | refused her own daughter under the law (loners.md, Sorrel) |
| hc08 | Honour + L1 (31.5), pride (highcrag) | keeps the recitation; struck a name by law (slot-table-review M7) |
| hc09, hc10, hc11 | unknown | young |
| bf01 | Courage + L3 (title, 280), world; Mercy − L2 (106), world | "won his place by challenge and has held it through three"; the law let him kill Tallgrass's cubs and Nettle was told to bring them (world-and-prides §2.2; loners.md, Nettle) |
| bf02 | unknown | his silence at the ford is a hook, not a deed |
| bf03 | Courage + L1 (31.5), pride (bonefield) | "more kills than scars, and in Bonefield that's rare" |
| bf04 | unknown | |
| bf05 | unknown | |
| bf06 | unknown | |
| bf07 | Courage − L2 (106), world | "bowed without a fight … half despises him for it" (world-and-prides §2.2) |
| bf08, bf09, bf10 | unknown | young |
| mw01 | Courage + L1 (31.5), world; Mercy + L3 (title, 280), world | "took the lead after the Breaking because no one else would"; "kept every kill for the nursing queens and cubs" in the hungry season, and drove out the cat who stole from that share (world-and-prides §2.3; loners.md, Ashfall) |
| mw02 | unknown | won't go near the Mere: trauma, not cowardice. Don't seed it |
| mw03 | unknown | |
| mw04 | unknown | |
| mw05 | unknown | |
| mw06 | unknown | |
| mw07 | unknown | wise-cat; no deeds in lore |
| mw08, mw09 | unknown | young |
| ln01 | unknown | exiled as careless (that's not one of the axes); his silence is a secret |
| ln02 | Honour − L1 (31.5), pride (highcrag) | left against Highcrag custom for a forbidden mate. Only Highcrag counts that as faithless |
| ln03 | Courage + L3 (title, 280), world | "challenged Scarjaw … and nearly won"; the pride named him for the wound, and the loser left under the law (loners.md, Torncheek) |
| ln04 | unknown | publicly she "left … tired of the noise"; the saved cub is a secret |
| ln05 | Courage − L1 (31.5), pride (bonefield) | Bonefield says a cat who leaves has "run"; he "never liked the training fights" |
| ln06 | unknown | Mistwood believes she's dead |
| ln07 | Mercy − L2 (106), world; Honour − L1 (31.5), pride (mistwood) | "caught dragging a goose away from the cubs' share … a real crime" |
| ln08 | unknown | |
| ln09 | unknown | turning back on the ice is a secret |

The result: 15 slots seeded, 24 unknown. Four cats start with a title: hc01 "{name} the True"; bf01 "{name} the Brave" (and "Known as cruel"); mw01 "{name} the Merciful"; ln03 "{name} the Brave". Lore supports these four from public deeds and no more. ln07's theft from the starving stays Mercy − L2 (one crime, and lighter than bf01's already-L2 cruelty); bf07's bow stays Courage − L2 (the field "half respects him for surviving and half despises him for it"); ln02 stays Honour − L1, and only with Highcrag. Secrets are never used, so ln01, ln04, hc02 and hc04 stay untitled.
9.2 **NPC deed simulation (proposed).**
- **When:** once a season, on the last day, in the same pass as loner drift (loners §6), skirmishes (map-v1 §9.5) and councils (world-map-territory §8.1). It's headless, from the `rep` sub-stream of `worldSeed`.
- **Ambient deeds:** each living adult or elder NPC draws ambient deeds at the sim `npc` rates times 20 days (expected per season: small 2, medium 0.6, big 0.12, legend 0.006; proposed).
  - The axis is uniform.
  - The pole uses personality (genetics §4): P(positive) = clamp(50 + (trait − 50) × 0.8, 10, 90)%. The trait is `100 − aggression` for Mercy, `boldness` for Courage and `loyalty` for Honour.
  - Ambient deeds are `pride_known` to the cat's own pride (loners: private to themselves plus anyone in the same zone) and spread by §6.3.
  - Each ambient deed writes a fact with a Saga template key (`rep.ambient.{axis}.{pole}.{class}`), so gossip can quote it.
- **Event deeds:** NPCs take part in real events that write deeds too. Skirmish fighters (C11), council keep/breach (H7), band and leadership challenges (C12, C13), and the exile event (loners §6.2: the leader who exiles gets M9).
- **Title changes for NPCs** follow §7. The player hears about them only through known facts.

## 10. Effects hooks (small, capped; all proposed)
Every hook reads the **observer's known level** (L0–L5, signed by pole) and never shows a number.

| # | System modified | Hook |
|---|---|---|
| E1 | **Stranger greetings**: first-meeting scenes `slice.meeting.*` (slice-1.json), the first stored pair value (relationships §3.3), cats come to you (lone-cat-actions §8) | Greeting variant chosen by the player's highest known axis at L2+ (text only). The first stored pair value gets ±3 per known level above L1 on an axis the cat's personality cares about (high aggression: Brave +, Cowardly −; high sociability: Merciful +, Cruel −; high loyalty: Honourable +, Faithless −). Cap ±6. |
| E2 | **Courtship**: formulas §2.2 points table (pairing.js:440–470), which also seeds encounters v0.1 §4 Interest | New term "Reputation": ±2 per known level above L1 on each axis the target's trait bands like or dislike (bands per genetics §4: high ≥70, low ≤30). High boldness likes Brave and dislikes Cowardly. Low aggression dislikes Cruel. High aggression doesn't mind Cruel (0) and likes Brave. High loyalty likes Honourable and dislikes Faithless. High sociability likes Merciful. Cap ±6. |
| E3 | **Leader approval**: formulas §3.2 (pairing.js `approvalPoints`) | ±2 per known level on the axis that pride values (§2.4: Highcrag Honour, Bonefield Courage, Mistwood Mercy), as known by that pride. Cap ±6. |
| E4 | **Councils**: AI acceptance in world-map-territory v0.1.1 §8.5; milestone-2 §12.9 (recognition, breach); world-memory.js `councilStatus` (returns `not-run`, "cadence, access, and numeric effects are pending"); Saga council-feud-draft (accounts and terms) | Acceptance P ±3 per known Honour level of the proposing leader. Cap ±9. A known Faithless L3+ leader's proposal draws Saga's distrust lines. **OPEN**, see Q6. |
| E5 | **Territory danger**: world-map-territory §3.1 | +1 danger (still clamped to 0–3) in a region whose holder pride is known to the player at Cruel L3+ (they're more likely to hurt a trespasser). Text only otherwise. |
| E6 | **AI expansion and targeting**: map-v1 §9.6 step 4, and loners §5b.4 band targeting | Feared prides are avoided: an AI pride needs a further +10% strength edge to Mark a region held by a pride it knows at Brave L3+, and a band needs 0.9× rather than 0.8×. Weak-seeming prides get challenged: −10% edge against a pride known at Cowardly L2+. |
| E7 | **Trespass**: map-v1 §8.3 (10% meeting, unchanged) | The patrol scene variant reads the player's reputation with that pride (text only). The meeting chance is unchanged. |
| E8 | **Offspring**: cub creation (genetics §4.2 runs alongside); heir switch (relationships §5.5) | A newborn cub's points per axis = 0.2 × its pride's view (§8.1, world view) + 0.1 × the mean of its parents' world points, capped below L2 (under 90), so nobody is born with a title. These are written as `inherited` deed rows with the pride's scope. An heir keeps its own reputation; the pride's reputation carries on through §8. |
| E9 | **Directory, meeting card, gossip**: cat-directory §2 | New directory field "Reputation" (known when the player knows any deed fact or a seed for that cat, else "Nothing said of them yet"), plus a title line. It never shows numbers (cat-directory §2.1). |

## 11. Pass bands for Tracker (`simulateLifetime`)
11.1 **`simulateLifetime({seed, profile, days=800, catId})`** must log, for each day (also report a year-7 / day-560 snapshot):
- `absDay`, `seasonIndex`;
- each deed: `{deedId, axis, sign, weightClass, baseWeight, repeatIndex, applied, capped, receiptKey, factId, scope, witnessIds}`;
- for each axis: `{truePoints, trueLevel, knownLevel[observer]}` for `player`, each pride, and three named observer cats;
- gate counters (`deedsSinceLevel`, distinct days);
- `titleGained` / `titleLost` / `featEarned` events;
- and a per-run summary (first day at each level per axis; deeds per level-up).

Profiles: the sim's `casual`, `active` and `npc`, each run with Tundra's PROXY styles `focused`, `balanced` and `mixed` (§5.7).
11.2 **Bands (1,000+ seeded lives per cell; proposed tolerance ±15% on the day medians in the .out).** Tundra's caveat: deed rates and play-style profiles are placeholders; these bands must be checked against real play logs once reputation is built.

| # | Check | Pass band |
|---|---|---|
| P1 | Most one deed can move a level | `applied ≤ span/3` on every deed. Level change ≤ 1 per day on every axis, in every seed. |
| P2 | Shortest run before a level changes | Every level-up has at least the §5.4 minimum deeds (4 / 8 / 12 / 20 / 30 to reach L1 / L2 / L3 / L4 / L5) and at least 3 distinct days since the last change. An adversarial same-day burst must not level. |
| P3 | First word level (L1), best axis | active focused median day 32; casual focused median day 60 (±15%). |
| P4 | First title (L3), best axis | active focused 100%, median day 339 (~4.2y), holding a title at 3 / 5 / 10y 2% / 87% / 100%; casual focused 98% (title reached 97.7%), median day 603 (~7.5y), 0% / 0% / 98%; active balanced 47.9%, median 9.0y, 0% / 0% / 48%; mixed poles 0.0%; npc focused 0.3% (5 of 1,500), median 9.6y; npc balanced and mixed 0.0%. Tolerance ±15% on the day medians. |
| P5 | L4 / L5, best axis | active focused: L4 in 75% of lives, median day 722; L5 none in 10 years. Casual focused: L4 0%, L5 0%. Seeded NPCs in the P9 check reach L4 0% at year 7, in all three styles. Tolerance ±15% on the day median. |
| P6 | Titles can be lost | Yes, but only after opposing deeds. No title is lost on a day with no opposing deed on that axis. After a loss, no regain within the same season. Opposite big/medium deeds in one season until below 200: at 280, median 14 (min 11); at 250, median 8 (min 6); at 400, median 78 (min 78). Repeat-halving slows a single season; loss is faster across seasons. |
| P7 | Knowledge | A private deed never raises any third party's known level. A witnessed deed reaches the witness's pride after exactly 3 days, and neighbouring prides after 20 (medium) or 10 (big). |
| P8 | Exactly once | Reload or replay of any source action adds no deed row (receipt §3.4). Seed applies once. |
| P9 | NPC world, 7 years (`simulateWorld` + reputation) | Ambient NPC titles are rare, not impossible: npc focused 0.3% (5 of 1,500), balanced and mixed 0.0%. An NPC seeded at 280 on its main axis is still titled at 7y in 100% of lives in focused, balanced and mixed, reaches L4 0%, and no second axis reaches L3. So all four seeded notables (hc01, bf01, mw01, ln03) still hold at year 7 and never reach L4. No pride's view sits at L4+ on every axis. |
| P10 | No numbers | No digits in any reputation word, title, gossip line or directory field. |

## 12. Open questions
Q1. **Done (Tundra v0.1.2, PROPOSED DEFAULT):** three-axis, two-pole rerun in `sim/reputation_sim_v0.1.2.py` @ `621ec4a`, output in `sim/reputation_sim_v0.1.2.out`. Thresholds 25 / 90 / 250 / 550 / 1000 and per-axis minimum deeds 4 / 8 / 12 / 20 / 30, with the 3-distinct-day gate and seasonal repeat-halving kept. P3–P5 and P9 retuned from that .out. Deed rates and play-style profiles remain placeholders; Tracker must check the P-bands against real play logs once reputation is built.
Q2. **Settled (Tundra agrees; Director ruled):** words only at L1–L2; the title waits for L3 (now median 4.2y for an active focused player, 7.5y for a casual focused one).
Q3. **Settled (Tundra):** plain sum, no extra weight.
Q3 (was). **Tundra:** should an opposing deed against a strong reputation count extra ("a hero's cruelty is remembered"), or keep a plain sum as in the sim?
Q4. **Tundra:** do Courage deeds for retreating (C3, C7) feel fair? I only count them when an ally is left behind.
Q5. **Tundra:** claiming or losing a region (world-map-territory §6.4) maps to no axis here, only to the `land_taker` epithet. Confirm that, or name an axis.
Q6. **Director, OPEN:** council standing (E4). The council rules are split across milestone-2 §12.9 (cadence by trigger), world-map-territory v0.1.1 §8 (once a season), world-memory.js `councilStatus` (`not-run`, effects pending) and my council-feud-draft (accounts and terms only, no balance). Which source should E4 bind to? Should Honour also change who may speak or be believed at council?
Q7. **ANNA-APPROVED:** reputation doesn't fade over a lifetime. Style scaling stays out of v0.1.
Q7 (was). **Director and Anna:** should reputation decay at all over a lifetime (v0.1 has none)? Should Style scale it (for example, Story spreads gossip faster)?
Q8. **Flint:** M6, should a clean steal stay private (the owner is currently in `participants` on success)?
Q9. **ANNA-APPROVED, later scope:** a secret coming out becomes a reputation moment once a reveal system exists. Not in v0.1.
Q9 (was). **Director and Anna:** secrets coming out (ln01's silence, ln04's saved cub, hc02's fallen cub) would be strong reputation moments, but there's no reveal system yet. Is that in scope later?
Q10. **Saga (me):** I'll finalise the §7 words and titles, the epithets, the greeting variants per axis and level, and the gossip lines for titles gained and lost after Q2 is settled.

## Changelog
- v0.1.3 (2026-11-10, Tundra for Saga): ANNA-APPROVED via Director. §5.5 and Q7: no decay. Q9: secret reveals become reputation moments later. Q6 is settled by councils-v0.1 §5.2. Backup `reputation-v0.1.pre-anna.bak.md`.
- v0.1.2 (2026-11-10, Saga): §7.4 challenge_won epithet ruling (Tundra, **PROPOSED DEFAULT**): the feat fact stores the pride's name at the time of the win; a founded pride counts like any other; if the place is unknown to the observer, use a general no-place line; with several known wins, show the most recent. Epithets: "{name} who took {prideName}" and "{name} who won the challenge".
- v0.1.2 (2026-11-10, Saga): §7.3 tie order settled (Tundra and Flint): Courage, then Mercy, then Honour. Courage is the axis a stranger most likely heard of; titles and greetings share the order.
- v0.1.2 (2026-11-10, Tundra figures from `c0ffa19`, folded by Saga): level-arrival day medians (best axis) added to §5.7 and P3–P5: active focused L1 day 32, L2 day 121, L3 day 339, L4 day 722 in 75% of lives, L5 none in 10y; casual focused day 60 / 216 / 603, no L4. Title-loss counts restored in §7 and P6 (at 280, median 14, min 11; at 250, median 8, min 6; at 400, median 78). npc focused title reach is 0.3% (5 of 1,500), not a rounded 0%; P9 now says ambient NPC titles are rare, not impossible, and seeded notables never reach L4 or title a second axis.
- v0.1.2 (2026-11-10, Tundra numbers, folded by Saga): three-axis, two-pole retune, **PROPOSED DEFAULT**. Thresholds 25 / 90 / 250 / 550 / 1000; per-axis minimum deeds 4 / 8 / 12 / 20 / 30; the 3-distinct-day gate and seasonal repeat-halving stay. Title loss stays at 80% hysteresis (an L3 title drops below 200). L3 seed is 280 (TH + 10% of span; L2 = 106, L1 = 31.5 by the same rule). Sim `sim/reputation_sim_v0.1.2.py` @ `621ec4a`: active focused title median 4.2y, casual focused 7.5y; active balanced 48% at median 9.0y; mixed poles never; ambient npc play never titles; all four seeded notables still hold at year 7. Q1 marked done. Deed rates and play-style profiles are placeholders; Tracker's P-bands must be checked against real play logs once reputation is built.
- v0.1.1 (2026-11-10, Saga): §9 seeds L3 titles on notable premades, after Director ruled that titles sit at L3 and that NPCs reach L3 only from seeded points. Four slots start with a title, each from a public lore deed only (hc01 Honour, bf01 Courage, mw01 Mercy, ln03 Courage). No seeds from personality, narrative-lean, or secrets. P9 now uses those seeded titles as the source of titled premades.
- v0.1.1 (2026-11-10, Tundra): thresholds 25 / 140 / 450 / 900 / 1600. The sustained-pattern gate is the per-level minimum deed counts 4 / 8 / 15 / 25 / 40 **and** at least 3 different days since the last level change; both stay, and so does seasonal repeat-halving (full, ½, ¼, floor 1). Title loss uses 80% hysteresis (an L3 title drops below 360). NPCs reach L3 only from seeded points. Sim `sim/reputation_sim_v0.1.1.py` (seed 4, 2,000 lives): L3 median day 309 active / 553 casual / 0% npc; L5 0% by year 10; title-loss median 17 opposite deeds.
- v0.1 (2026-11-10, Saga): first draft for Tundra's tuning, aligned to `sim/reputation_sim_v0.1.py` @ `437d2c5`. All numbers are proposed.
