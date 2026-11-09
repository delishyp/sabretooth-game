# Choice follow-ups v0.1 DRAFT (Tundra, 2026-11-09). Every rule is PROPOSED DEFAULT unless it cites a spec, and every delta is an existing one.
## 0. Shared rules
1. Each choice already records a fact, or gains one here. A follow-up fires only from that fact, never from an invented memory (§12 effects whitelist).
2. A follow-up fires once per run, under receipt `runId/followup/{sourceEventId}/{choiceId}`, and Save/Continue can't replay it.
3. Personal deltas use the existing §11 conversation outcomes within the ±10 cap. Most follow-ups are 0 and change the options rather than the numbers (§11.3.6 requireMaterialFollowUp).
4. A follow-up triggers at the next eligible meeting with the named cat: Seek out, an action 8 approach or a random meeting. If that cat is dead or gone, there's no follow-up, and nothing is faked.
5. Action 8 priority: among eligible approachers, a cat with an unfired follow-up is chosen first. This changes ordering only, and the existing approach roll and the |value| >= 20 gate are unchanged.
## 1. Greywater Ford carcass dispute (`m2.ford_prey_dispute`). The existing choices and effects are unchanged: +5 to the cat you backed and 0 for stay_out.
1. `help_bonefield_cat`:
 a. The Bonefield cat, at the next meeting, recalls the ford. This unlocks one gossip line (a true Bonefield fact it `knowsFact`, via `wm.fact.learn`) and, on the first such meeting, the `confiding` branch. Delta 0.
 b. The Highcrag participant (a witness), at the next meeting, opens coldly about the ford. Choices: `explain` (0), `repair` (the existing §11 repair outcome) and `leave` (0). The other Highcrag cats learn the fact only through the existing 3-day rumour rule.
 c. Once that rumour lands, scouting Highcrag with action 4 gives a border report that names the deed: "They remember the ford."
2. `side_with_highcrag` is the exact mirror of 1 with the prides swapped.
3. `stay_out`: either participant, at the next meeting, asks "Why didn't you pick a side?" Choices: `neutral` (records the stance, and that cat stops offering pride gossip), `ask_what_happened` (`wm.fact.learn` the feud fact, with pride_known scope unchanged) and `leave` (0). Delta 0.
## 2. Horse meadows (`slice.region.horse_meadows`). Today it has only Continue, so it first gets real choices, each an existing action:
1. `stalk_foal` runs the existing hunt as the day's main action (Energy -30, the existing small/medium prey formula), with Saga's foal hit and miss scenes as the text. It records fact `hunted_at_meadows` (hit or miss), with any cats present as witnesses.
2. `watch_herd` runs action 7, Watch from a vantage (+20 Energy, and it lists the cats passing today). It records `watched_meadows`.
3. `move_on` spends no action and records nothing.
Follow-ups:
- `stalk_foal` hit, witnessed: the witness gets action 8 priority and opens with "I saw you take the foal." The choices are the existing `share` (needs today's kill, +10, §11.3.5) and `talk`. Missed and witnessed: the same cat teases you, with `talk` only and delta 0.
- `watch_herd`: the next day's action 8 approach prefers a cat that was seen passing, with the opener "You were on the hillside yesterday."
- `move_on`: no follow-up.
## 3. Cave hyena at the forks (`encounter.cave_hyena.v1`, milestone-2 §13 / v0.6.1). The existing deltas are unchanged: drive +5, share_remains +5 and warn_off +5 Highcrag standing, with standing_deed receipts.
1. `drive_off` (clean or partial): the hunter's next meeting recalls the drive. This unlocks `confiding` once and makes the hunter a petition relay voice ("I'll tell hc01 what I saw"), as text only. The permit path is unchanged (§3.8a).
2. `share_remains` after driving: as 1, plus the hunter offers a share at a later meeting, but only if the hunter's pride shares with the player under the existing membership rules. Otherwise it's text only.
3. `leave`: at the hunter's next meeting, "You watched and did nothing." Choices: `explain` (0), `repair` (the existing §11 repair outcome) and `leave` (0). No standing change.

Watch from a vantage (action 7) is needed for watch_herd. Spec: main action, primary `trailReading`, a half-rest giving +20 Energy (half of rest's +40), and it shows every cat that passes the zone today and what it was doing. Build just enough of it for this. Tests: fires once per run, fires only from recorded facts, no follow-up for a dead or absent cat, action 8 priority ordering, share +10 needs today's kill, and reload is idempotent.
