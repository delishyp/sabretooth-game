# Event outcomes rule and audit v0.1

Status: the rule is **ANNA-APPROVED** (Anna via Director, 2026-11-15): "every event must end with a clear outcome." The per-event fixes below are **PROPOSED DEFAULT** and add no new numbers. Audited against v0.1.5 (25593084). Tundra, 2026-11-15.

## 1. The rule
1. Every event, encounter and conversation ends on a result beat that says what happened: who has the prey, who left, what was agreed or refused, what was learned.
2. "Left without deciding" is allowed only when it's the player's own choice (for example "Leave without answering."), and the result beat has to say so plainly.
3. A scene can't end on an argument that's still running, a question nobody answered, or an offer nobody accepted or refused.
4. **Flint check:** a test that walks every choice path in `data/events/*.json` and the encounter, follow-up and conversation scenes. It fails when a path reaches `eventResult` with an empty `resultLine` or summary, or with no outcome id.

## 2. Violations found
| # | Event | Problem | Fix |
|---|---|---|---|
| 1 | `m2.ford_prey_dispute` (Greywater Ford, Anna's Shalemark/Tuskscar report) | The `ending` field says "The argument remains unsettled when you move away." It ends that way after every choice. | See §3. |
| 2 | `encounter.wolf_pack.v1` | No flee resolver, so the result always plays as success. | The resolver from my room ruling of 2026-11-10: carcass loss, then a 40% Minor injury, otherwise a clean escape (map-v1 §10.1). This is a confirmed b9aacb4 bug that's already on the v0.1.6 list. |
| 3 | Recurring conversation `company` node ("Walk with me a while?", Anna's report #5) | `quiet`, `ask_first` and `press` don't clearly accept or decline. | Saga rewords the replies. At least one should plainly accept ("Yes, let's walk.") and one plainly decline. The outcome ids stay the same. |
| 4 | `first-season` season_end unmated line: "What might have been is still unsettled, and tomorrow is another day." | It reads as if the scene hasn't finished. | Saga states the outcome: you're still unmated, and here's what you can do next. When `yearLengthDays` is null, it can't promise that spring comes back. |
| 5 | Border petition deferral ("Hold those requests for now") | This is allowed, because a deferral is an outcome, but the player has to be told so. | The result line has to say the request is on hold and what would reopen it. |

Paths that already terminate cleanly: giant deer (abandoned or one resolved attempt), cave hyena (all 5 outcomes), the rest of the recurring conversation, slice-1 (all 37 events have a summary for every choice), and the ford follow-ups.

## 3. Greywater Ford resolution (PROPOSED DEFAULT, no new numbers)
The incident's faction deltas (HC→BF −20, BF→HC −10) and the +5 for each choice stay exactly as they are. There's no food for the player, no injury and no fight. The `ending` field is replaced by one result for each choice:
1. `help_bonefield_cat`: the carcass comes out on the Bonefield side. Two against one, the Highcrag cat backs off, and the Bonefield cat drags the carcass away. Outcome `ford_bonefield_keeps`.
2. `side_with_highcrag`: two against one, the Bonefield cat lets go and wades back across. The Highcrag cat hauls the carcass up the bank. Outcome `ford_highcrag_keeps`. This is the branch Anna played.
3. `stay_out`: while the two cats face off, the current pulls the carcass free and it goes downstream, and both of them leave with nothing. Outcome `ford_river_takes`.

The facts record who kept the prey. Participants get the follow-up and gossip versions that know they were there, which is Anna's report #3 and the participant-gossip fix.

## Changelog
- v0.1 (2026-11-15): first audit, from Anna's rule.
