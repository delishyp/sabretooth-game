# Turn-based encounters v0.1.1 (fights, hunting, courtship)
Status: ANNA-APPROVED via Director 2026-11-10 (f7ca407), on condition it passes §8.3 testing. Every number is PROPOSED DEFAULT unless it cites an approved spec. Fight numbers come from `sim/encounter_fight_sim_v0.1.py` (20,000 fights per cell; output in `.out`).
Design rule: **Quick resolve and average play reproduce today's approved odds; good play earns a bounded edge.** Formulas §1, §2 and §4 stay the source of truth for who is stronger.

## 1. Shared engine
1.1 Two sides, one bar each: HP (fight), Escape (hunt), Interest (courtship). Turns alternate; first actor is a coin flip (`first_strike` always first).
1.2 The player picks one move per turn from a grid of 4–6; the other side picks from its personality table (§5). Each move adds one turn-log line (Saga's narration).
1.3 **Quick resolve** on every encounter: fights play both sides with the average table, hunts use all Steady moves, courtship ends at current Interest. Keeps today's pacing for Story or impatient players.
1.4 Limits: fights 13 rounds, then higher HP % wins; hunts 3 phases; courtship = Patience turns.
1.5 Results write only through existing systems: injuries (needs §2, formulas §4.3), pair value, `memoryFacts`, `encounters.log`, world memory (§12 whitelist). No new reward types.
1.6 Engine is seeded and headless-runnable (`simulateEncounter`, Flint).

## 2. Fights
2.1 HP 100 each. Strength `S` = fight stat (formulas §4.1, unchanged). Stamina 5 max, +1 per own turn, +1 more after Defend.
2.2 Moves:
| Move | Stamina | Hit | Damage | Notes |
|---|---|---|---|---|
| Swipe | 1 | 95% | 18 | reliable |
| Bite | 2 | 75% | 30 | |
| Pounce | 3 | 55% | 45 | a miss leaves you Open: next hit on you ×1.25 |
| Defend | 0 | – | – | next hit on you ×0.5; the attacker takes a 9 counter (scaled like damage) |
| Intimidate | 1 | 50% × S_you/S_them, max 90%; +5 pts per Intimidate M | – | target Shaken for 2 attacks: hit −15 pts, damage ×0.8 |
| Flee | 0 | clamp(50 + 5 × Endurance M + (your HP% − their HP%)/4, 10, 90)% | – | success = loss with injury roll ×0.5 and no death roll; failure wastes the turn |
2.3 Damage = move damage × (S_att/S_def)^1.35 × U(0.85, 1.15). Guard: damage taken × (1 − 0.03 × M). Perks keep their written effects (`feint` = a Swipe that can't be countered).
2.4 Calibration (sim): average vs average wins 50% / 71% / 90% at 0 / +10% / +25% strength edge and 10% for a fresh player vs Scarjaw, matching formulas §4.2 and §4.5. Median fight 5–6 rounds, timeouts under 3% (13-round cap). The sensible pattern (§8.2) wins 63% at equal strength and 16% vs Scarjaw, while biting every turn wins only 55% / 11%: reading the foe is the skill edge.
2.4a **Reading the foe (v0.1.2, PROPOSED DEFAULT):** before each of your turns the narrator tells you what the foe is gathering to do (no numbers: "it sinks onto its haunches" means Pounce). It is honest 75% of the time; 25% it is a feint and shows a different move. Weight-of-the-cat lines are Saga's.
2.4b **Repetition (v0.1.2, PROPOSED DEFAULT):** using the same attack as your previous attack costs −10% hit, and −20% on the third and later in a row. Swipe, Bite and Pounce each count separately; Defend and Intimidate don't break or extend a run. The foe AI follows the same rule. **Flag for Anna.**
2.5 After the fight: formulas §4.3 unchanged (injury 40% loser / 15% winner, tier splits, death only in lethal fights at Style rates).
2.6 Kinds:
| Kind | Lethal | Ends | Replaces |
|---|---|---|---|
| Spar (lone action 3) | no | first side ≤ 40 HP yields | spar roll; keeps +5 once per cat per 5 days, no injury roll |
| Scuffle / confront (loners §10.7) | no | ≤ 20 HP yields | §10.7 roll |
| Mate rival challenge | no | 0 HP | §4.2 roll |
| Rival attack, leadership challenge | yes | 0 HP or flee | §4.2 roll |
| Wild enemy | yes | 0 HP or flee | flee-only wolf/hyena encounters |
2.7 Showdown and band/group fights (loners §5b) unchanged. Showdown pacing untouched.
2.8 Wild enemies (S vs a fresh player's 10.0; player win % average / sensible, sim):
| Enemy | S | Personality (aggr/bold) | Win % |
|---|---|---|---|
| Hyena (lone) | 7 | 40/30, flees at ≤ 30 HP | 98 / 99 |
| Dire wolf (lone) | 9 | 55/50 | 72 / 86 |
| Hyena clan | 12 | 70/50 | 15 / 25 |
| American lion | 12 | 65/80 | 16 / 26 |
| Wolf pack | 13 | 55/60, never flees | 7 / 13 |
| Humans | – | not fightable in v1: Intimidate or Flee only | – |
How often these start stays with the existing encounter rules and the map danger rule.
2.9 **Edge rulings (v0.1.3, PROPOSED DEFAULT; no balance effect in the sim):**
- The Defend counter lands only when the blow hits the defender. A miss gets no counter (as in `sim/eng4.py`).
- At the 13-round limit with exactly equal HP %, the cat defending its title, kill or ground wins. If there's no defender (a wild fight or a scuffle), both sides break off with no winner and nobody yields.
- A hyena clan never flees, just like a wolf pack. Only a lone hyena flees, at ≤ 30 HP.
- Humans: Intimidate succeeds 50% of the time, with no strength ratio. On success the humans back off and the encounter ends unhurt. On failure you take a spear jab (Minor injury) and the encounter continues. Flee uses the §2.2 formula with an HP difference of 0. A failed flee is map §10.1's Serious spear wound, and you drop what you're carrying.
- Humans get no next-move tells (§2.4a): they don't choose moves, so a tell would promise a choice that doesn't exist. Standoff mood lines are fine.

## 3. Hunting
3.1 **P** = formulas §1 P(success), unchanged (skills, perks, Style, winter included). Split over three phases, Stalk, Chase, Kill, with species weights `w` summing to 1. A Steady move succeeds at P^w, so three Steady moves = exactly P.
3.2 Escape bar = the prey's current chance to get away (1 − remaining success chance). Bar plus words, no number.
3.3 Moves per phase:
| Phase | Steady | Bold: P^(0.75w), Energy −5, injury ×1.25 each (max ×1.5) | Special |
|---|---|---|---|
| Stalk | Creep | Rush in | Freeze (once per hunt): no roll; next Stalk roll P^(0.7w), but 25% the prey drifts off (fail, no injury roll) |
| Chase | Run it down | Sprint | Cut it off: only with a hunting partner or Trail Reading M2+: P^(0.8w), no Energy cost |
| Kill | Throat bite | Drag down | Hamstring (large only): Steady odds, injury ×0.7 |
3.4 A failed phase ends the hunt as a failure. Yield and injury per formulas §1.5–1.6; `second_lunge` retries one failed phase.
3.5 Species:
| Prey | Size | w Stalk/Chase/Kill | Note |
|---|---|---|---|
| Fawn | small | 0.4/0.4/0.2 | |
| Deer | medium | 0.5/0.3/0.2 | skittish: Freeze drift 35% |
| Horse | medium | 0.2/0.6/0.2 | herd runs; Cut it off matters most here |
| Mammoth calf | large | 0.2/0.2/0.6 | guardian: flavour on the existing large-prey injury roll |
| Rhino calf | large | 0.2/0.3/0.5 | guardian, as mammoth |
3.6 Targets (Standard fresh solo player, spring): Steady = formulas §1.7 (small 55%, medium 50%, large 30%). All Bold: small 64%, medium 59%, large 41%, at Energy −15 and injury ×1.5. Bold is better odds at a real cost.
3.7 Replaces the one-roll hunt. `stalk_foal` opens this encounter as Horse.

## 4. Courtship
4.1 All formulas §2.1 gates unchanged (season, attraction, kinship, one attempt per 5 days).
4.2 Interest starts at formulas §2.2 points (bar, no number). Patience 3 turns; target sociability ≥ 70 → 4, ≤ 30 → 2.
4.3 Moves (target's trait band, genetics §4: high ≥ 70, low ≤ 30):
| Move | Liked (+5) | Disliked (−5) |
|---|---|---|
| Groom | high sociability | low sociability |
| Show off | high boldness | low boldness |
| Playful | high curiosity | low curiosity |
| Gentle | low aggression | high aggression |
| Bold | high aggression | low aggression |
| Gift prey | +5 flat, needs today's successful hunt; `gift` perk makes it +10 (replaces the perk's flat +10) | – |
| Back off | ends now: no roll, no −5, attempt still used | – |
Mid band = 0. Repeating a move gives half, then 0. Total move swing ±15. At the end, P(accept) = clamp(Interest, 5, 90)% as §2.3.
4.4 Targets: average play on a mid-band cat is ±0, so §2.5's ~35% (value 25) and ~50% (value 50) stand. A player who reads the cat's known traits gains up to +15 (fresh player vs hc05: 37% → up to 52%). Known traits come from the cat directory's traits seen, so getting to know a cat pays off. **Flag for Anna.**

## 5. Personality → the other side's moves
5.1 Weights over affordable moves: Bite 3, Swipe 3 − a, Pounce 2 + 1.5a + 0.5b, Defend 1.5 − a − 0.5b, Intimidate 1 + 0.5b, floor 0.1; a = (aggression − 50)/50, b = (boldness − 50)/50.
5.2 Boldness ≤ 30 tries Flee at ≤ 30 HP. In non-lethal fights, sociability ≥ 70 yields 10 HP earlier.
5.3 Hot-heads waste Stamina on Pounce; careful players beat them slightly more often (sim: 64–69% at equal S across bands).
5.4 Hidden values (attraction, r) never choose moves.

## 6. What changes
6.1 Replaced: hunt roll, spar roll, scuffle/confront roll, 1-v-1 §4.2 rolls, Court roll. Kept: their inputs, gates, receipts, XP (one award per encounter, skills §3), injuries, death and pair-value effects.
6.2 Save: `encounters.pendingEncounter` (already planned) holds an unfinished encounter so reload resumes the same turn and RNG state.
6.3 UI: HP is the only numeric bar.

## 7. Saga
Narration per move × outcome (hit, miss, blocked, countered, Open, Shaken, fled, yielded), per hunt phase × outcome, and courtship reactions per move × liked/neutral/disliked.

## 8. Sim policies and Tracker pass bands
8.1 Policies for `simulateEncounter` (Flint): `average` (§5.1 table at 50/50), `sensible` (fights: Defend when the foe shows Pounce, Pounce if the foe is Open or Shaken, swap Bite for Swipe after two Bites in a row, else Bite), `biteOnly`, `fleeAt30`; hunts `steady`, `allBold`; courtship `average` (random non-Back-off), `readTraits` (best liked moves first, no repeats).
8.2 The table that used to sit here is replaced by §8.3; same values.

8.3 **Numbered pass bands** (Part 1 sim gate: `simulateEncounter`, 2,000+ seeded runs per cell, fresh Standard player unless noted; ±3 points unless noted):
1. Fight, `average` v `average`: wins 50 / 71 / 90 / 10% at strength ratio 1.0 / 1.1 / 1.25 / 0.8. Quick resolve gives the same numbers.
2. Fight, `sensible` v `average`: 63 ±3% at 1.0 and 16 ±3% at 0.8. No policy beats `sensible` by more than 5 points, and `biteOnly` stays at least 6 points below `sensible` at 1.0 (sim: 55 vs 63).
3. Fight length: median 5–6 rounds; 13-round timeouts under 3%.
4. Personality bands: at equal strength, `average` v a 85/70 or 20/30 (aggression/boldness) opponent wins 47–53%.
5. Wild enemies, `average` / `sensible` (±4): hyena 98 / 99, dire wolf 72 / 86, hyena clan 15 / 25, American lion 16 / 26, wolf pack 7 / 13.
6. Flee: 50% on the first try at equal HP with Endurance 0; always within 10–90%. A successful flee never triggers a death roll.
7. Spar: always ends at the first side ≤ 40 HP, with zero injury rolls and zero deaths. The +5 is given at most once per cat per 5 days.
8. Showdown and band/group fights: outcomes and pacing identical to the current build on the same seeds (diff = 0).
9. Hunt `steady`: small 55 / medium 50 / large 30% (±2), exactly formulas §1.7.
10. Hunt `allBold`: small 64 / medium 59 / large 41%. Cost per hunt: Energy −15 and injury chance ×1.5 versus `steady`, checked against formulas §1.6 (±10% relative).
11. Hunt special moves: Freeze drifts off 25% (deer 35%); Cut it off only offered with a partner or Trail Reading M2+.
12. Courtship `average`: formulas §2.5 (about 35% at value 25, 50% at value 50, ±3).
13. Courtship `readTraits`: at most +15 over `average` on the same cat; never above 90%. Back off never costs value.
14. Reload mid-encounter (`pendingEncounter`): identical result on the same seed.
15. Visible numbers: HP is the only number in any encounter UI or log text (Part 2, hand-played, with move text readability).
A miss goes to the room with its seeds, and I retune.

## Changelog
- v0.1.1 (2026-11-10): Anna approval recorded; §8.3 numbered pass bands for Tracker's gate.
- v0.1.3 (2026-11-10): §2.9 edge rulings for Saga (counter on hit only, tie at round limit, clan never flees, humans, no tells for humans).
- v0.1.2 (2026-11-10): Tracker review. Bite-spam fix: telegraphed intent with 25% feints (§2.4a) and a repetition penalty (§2.4b). Sim `sim/eng4.py`, output `sim/encounter_fight_sim_v0.1.2.out`: average 50 / 71 / 90 / 11%, sensible 63 / 82 / 96 / 16%, biteOnly 55 / 76 / 92 / 11%, median 6 rounds, timeouts 1–3%. Round cap 12 → 13 so timeouts stay under 3% per Director (sim: 1.6% at equal strength, win rates unchanged). Wild enemies (average / sensible): hyena 98 / 99, dire wolf 72 / 83, clan 16 / 23, lion 17 / 24, pack 8 / 12.
- v0.1 (2026-11-10): first draft. Damage ×1.5 and exponent 1.35 (relative to the first sim draft; the §2 table already shows the final values) chosen by sim to keep fights at 5–6 rounds while matching §4.2.
