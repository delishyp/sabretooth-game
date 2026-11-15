# In-game tutorial v0.1.6 (ANNA-APPROVED 2026-11-15; Flint builds it as v0.1.7)

Status: **ANNA-APPROVED** (via Director, 2026-11-15): the player chooses tips at New Game, tips use the narrator's voice, there's a guided first day, there's a persistent current-goal line, and coverage must reach every action, menu and system. Everything else is **PROPOSED DEFAULT**. There are no game numbers and no new art. Built against v0.1.5 UI names. Tundra, 2026-11-15. Saga owns the text, Ochre the panels (reusing the existing event and hint panel styling), Flint the build, and Tracker the gate. v0.1.2's rulings for Saga are folded in.

## 1. Goal
A new player understands three things:
1. **How the game works:** the day loop, needs, regions, prides and borders, memory and bonds, and seasons.
2. **Everything they can do:** every daily action and every Places section, including Lore, Wilderness and Smilodons.
3. **What they're trying to do right now:** shown by the goal line (§4).

It's taught in play, in the narrator's voice, plain and clear, with no numbers.

## 2. Rules for all tutorial content
1. **Toggle (ANNA-APPROVED):** the New Game setup screen has a "Guided first day and tips" toggle, On by default (the default is PROPOSED). It's stored as `run.tutorial`, menu spec v1.4.5. Runs from before this feature read as Off.
2. **No effects:** tutorial content never rigs a roll, adds food or resources, locks or hides a choice, or advances time. It's text, highlights and UI only. With the same seed, the game state matches a run with tutorial off.
3. **Never mid-scene:** a tip waits until the current scene's result beat is done. At most one tip shows per in-game day, and extras queue for the next day. The exception is a tip for a screen the player has just opened (Places, §5.B), which shows right away on that screen.
4. **Once each:** fired tips are saved in `save.tutorial.seen[]`. "Got it" dismisses a tip, and "Turn off tips" ends tips and guidance for this run (`save.tutorial.off`).
5. **Re-reading:** every seen tip and every goal is listed under a "Guide" heading in Lore.
6. **Marking tips seen:** a guided step marks a tip seen only if its lines teach everything that tip does. Otherwise the tip still fires later.
7. **Wording:** use the UI's own names (Unclaimed, Run, Bonded, the "Day {n}" report, the Places names). Hide anything about a bar or section that's hidden in the current Style, for example Thirst in Story. While `yearLengthDays` is null, say nothing about next year or spring returning.
8. **Heir and new lineage:** seen tips carry over to the new cat. The guided day plays at most once per run.

## 3. Guided first day (absDay 1, `run.tutorial` on)
These are narrator beats and highlights on top of the normal day. The player can do anything at any step, and guidance moves to the matching step or steps aside. Any steps not done turn back into normal tips.
1. **Arrival (two beats, per Director; order as in Saga's copy v2):** 1a: you're alone at The Split Rock, which no pride claims. Highlight the goal line (§4) and say it always shows what to aim for. 1b: highlight the needs bars and Health, and say what each does; this marks `tip.needs` and `tip.health` seen.
2. **The land here:** highlight the region facts (Prey, Danger, Water, Claimed by) and say they change from place to place.
3. **The day's choice:** say each day is one choice. Highlight the action row and name Hunt, Rest, Travel and Watch from a vantage in one line. Suggest Hunt.
4. **After the action:** for a hunt, explain food and that kills can be shared. On a miss, say misses are normal. For any other action, give that action's one-line explanation from §5.A.
5. **Places:** highlight Places and say it holds everything outside the day's choice. Point to Wilderness (the wider land) and Smilodons (every cat you've met). Each section explains itself the first time it's opened (§5.B).
6. **Cats:** if a meeting happened, point to that cat in Smilodons and say cats remember what you say and do.
7. **Lore:** point to Lore and say the Guide there keeps everything explained so far.
8. **Day's end:** at the "Day {n}" report, mention Save, say needs change overnight, and say the mating season is short. No day count. The guided day ends here.

## 4. Current goal line (ANNA-APPROVED to exist; the states are PROPOSED)
1. **Where:** a single line under the day header, shown in every run, whether tips are on or off, and after "Turn off tips" (ANNA-APPROVED 2026-11-15). The urgent line (item 2) follows the goal line (APPROVED by Director). With tips off, the goal's Guide entry is still in Lore, and selecting the line still opens it. It's always visible on the day screen and in Places. Selecting it opens that goal's Guide entry, which explains why and how.
2. **Urgent line:** when any shown need, or Health, is in its Low band, a second line appears above the goal ("Eat first", "Rest first" and so on, in Saga's words). It clears when the need recovers. It's never shown during a scene. If several needs are Low, show only one, in this order: Health, then Thirst (when shown), then Hunger, then Energy.
3. **Goal states**, evaluated after each result beat. The first one that matches shows:

| # | Goal id | When | Aim |
|---|---|---|---|
| 1 | `goal.first_day` | absDay 1 | Get your bearings: eat, look at the land. |
| 2 | `goal.found_set` | founded a pride | Feed and protect your pride, and hold your land. Later seasons replace this. |
| 3 | `goal.found` | have a mate, no pride yet | Found a pride with {mateName} on Unclaimed land. |
| 4 | `goal.approval` | a pride cat accepted the courtship and approval or the rival challenge is pending | Win {leaderName}'s approval / face the challenge. |
| 5 | `goal.court` | in the mating window and some cat is Bonded and eligible | Court {catName}. |
| 6 | `goal.bond` | in the mating window and you've met at least one eligible cat | Grow closer to a cat you could take as a mate. |
| 7 | `goal.meet` | in the mating window, no eligible cat met yet | Meet the cats of the prides and the loners. |
| 8 | `goal.route_*` | mating window over, no mate, route chosen | Follows `player.routeIntent`: ask to join a pride, find loners, or survive on your own. |
| 9 | `goal.route_choose` | mating window over, no mate, no route yet | Choose your path: ask to join a pride, look for other loners, or go on alone. |

If no state matches, the default is "Stay alive." When several cats qualify for states 4 or 5, use the one with the highest bond. The goal never names a cat the player hasn't met.

## 5. Coverage: every action, section and system
Each row is taught by a guided-day step (G#) or a tip that fires at its trigger. Tip ids are `tip.<id>`.

**A. Daily actions**
| Action | Taught by | Trigger, if it's a tip |
|---|---|---|
| Hunt | G3–4, `hunt` | first Hunt result |
| Rest | G3, `rest` | first Rest, or the first time Energy is Low |
| Travel | G3, `travel` | first time Travel is opened: days pass on the way, and regions differ |
| Watch from a vantage | G3, `watch` | first Watch |
| Meetings and talking | G6, `meet` | first meeting ends |
| Scent sign | `scent` | first scent sign: what marks tell you and why they matter |
| Spar | `spar` | first time Spar is shown locked or open |
| Court | `court` | first time Court is shown (open or locked): mating window, Bonded, leader approval for pride cats |
| Found | `found` | first time Found is shown: needs a mate and Unclaimed land |
| Share a kill / promises | `share`, `promise` | first share choice; first promise made |
| Run (encounters) | `danger` | first predator or hazard encounter |
| Save / Continue | G8 | — |

**B. Places** (each tip shows the first time that section is opened)
| Section | Tip |
|---|---|
| Home | `place.home`: your resting place and the day screen |
| Pride | `place.pride`: your pride once you have one; until then, who holds what |
| Den | `place.den` |
| Wilderness | `place.wilderness`: regions, owners, danger, water |
| Smilodons | `place.cats`: every cat met, their pride, Bond stage and what they remember |
| Breeding, Market, Inventory | No tip until the screen does something (per Director). `place.unavailable` still fires the first time a section shows Unavailable. |
| Lore | `place.lore`: the Lore Book, rumours that may be false, and the Guide |

**C. Systems**
| System | Tip | Trigger |
|---|---|---|
| Needs | `needs` (G1) | first shown need in its warning band. Thirst eases where Water is Available, and the Thirst line is skipped when Thirst is hidden. |
| Health and injuries | `health`, `injury` | first Health drop; first injury: injuries and going hungry wear Health down, and rest restores it |
| Regions | (G2) | — |
| Prides, borders, trespass, patrols | `borders` | first time entering claimed land or meeting a patrol |
| Memory and gossip | `gossip` | first time a cat repeats news about you |
| Bonds | `bond` | first Bond stage change |
| Pride standing | `standing` | first change in how a pride sees you |
| Seasons and the mating window | (G8), `season_end` | first season_end scene, with no next-year promise while `yearLengthDays` is null |
| Goal line | (G1) | — |

Later systems (pregnancy, cubs, territory management, councils, reputation titles, quests, trade) each get their own tip and goal states when they ship. That's out of scope for v0.1.

## 6. Tracker gate
1. Every row in §5 is reachable and fires once at its trigger, never mid-scene, at most once a day (except Places tips).
2. The goal line shows the right state at each milestone in a scripted run (day 1, first meeting, Bonded, courtship, approval, mate, found, season_end unmated), and the urgent line appears and clears.
3. Seen tips survive save and reload, and "Turn off tips" holds. The goal line and urgent line still show with tips off and after "Turn off tips".
4. A seed run with tutorial on and one with it off produce identical state, apart from the tutorial fields.
5. No tutorial text contains a number or names a cat the player hasn't met.

## Changelog
- v0.1 (2026-11-15): first draft.
- v0.1.1 (2026-11-15): Anna's answers (New Game toggle, narrator voice) and the guided first day.
- v0.1.2 (2026-11-15): Saga's copy rulings (arrival wording, region facts and Wilderness, Smilodons, seen-only-if-fully-taught).
- v0.1.3 (2026-11-15): Anna's deeper-tutorial ask. Added the current goal line and urgent line (§4), expanded the guided day to 8 steps, and added the full coverage matrix of actions, Places and systems (§5).
- v0.1.4 (2026-11-15): Saga's gaps. Urgent line priority is Health, Thirst, Hunger, Energy. Added goal 9 `goal.route_choose`. Empty-section line accepted. Guided step 1 covers needs only, and Health moves to `tip.health`.
- v0.1.5 (2026-11-15): Aligned with Director. Guided step 1 is split into 1a (arrival and goal line) and 1b (needs and Health), matching Saga's copy. Breeding, Market and Inventory get no tip until they function.
- v0.1.6 (2026-11-15): Anna's ruling via Director. The goal line (and its urgent line) shows in every run, including with tips off.
- v0.1.6a (2026-11-15): Anna approved the plan and Saga's tips-copy-v2, so the status is now ANNA-APPROVED. Flint builds v0.1.7 from this.
