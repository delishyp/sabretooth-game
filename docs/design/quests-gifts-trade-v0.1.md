# Quests, gifts and trade — v0.1.1
Status: **ANNA-APPROVED** (Anna via Director, 2026-11-10), with her §9 answers folded in. Detail rules below stay PROPOSED DEFAULT where marked. **No new art. No new tuned numbers:** every value below reuses an existing rule (cited); anything that would need a new number is marked `null` (off) until a sim backs it. No numbers in player-facing prose; Saga writes all words.

## 1. Goals
1. Give cats and prides reasons to come to you, and you reasons to go to them, between hunts and courtship.
2. Every request, gift and trade moves a number that already exists (cat affinity, pride standing, pride relation, reputation, pride food, region danger). No parallel meters.
3. Small first: v0.1 is 5 request kinds, 1 carried item at a time, 3 trade kinds.

## 2. Requests (one-off asks)
2.1 **Who asks:** a cat at value ≥ 20 (same gate as gossip, lone-cat-actions §8), or a pride leader for its pride at standing band neutral or better. Uses the existing NPC-initiative slot (lone-cat-actions §8): free, at most one ask a day, never interrupts a fight or courtship scene.
2.2 **Kinds (v0.1):**

| # | Kind | Done when | Fails when |
|---|---|---|---|
| R1 | `bring_prey` | you carry a kill of the named size (or larger) to the cat or its den | deadline passes |
| R2 | `scout_region` | you spend a day in the named region and come back | deadline passes; you die/flee there doesn't fail it |
| R3 | `drive_off` | you win or force a flee in a hyena encounter in the named region (encounters §2.8) | deadline passes, or you flee from it |
| R4 | `carry_word` | you talk to the named cat or leader; the message is a real world fact (§12 `knowsFact`, no invented facts) | deadline passes, or you tell a third pride first |
| R5 | `find_cub` | you go to the region the narrator names; the cub is walked home | deadline passes: the cub is found dead (§3.8) |

2.3 **Accepting is a promise** under milestone-2 §11.3 (+5 kept / −5 broken, once, same receipt format). Declining at the ask is free (same as the opening `leave`, §11.3a.3). Deadline: the existing season boundary (no new day count).
2.4 **Pride asks** apply the promise to `prideToPlayer` (`wm.standing.delta`, same ±5) instead of the cat's value.
2.5 **Limit:** at most one open request per asker, three open in total. The quest log lists them (§7).

## 3. Quest lines (multi-step)
3.1 A quest line is 2–4 requests from §2 chained by one premade cat's motive (from Saga's cat sheets, e.g. a rival to outdo, kin to protect, a grudge against a pride). Each step is a §2 request with its own promise receipt; the next step unlocks only after the previous one is kept.
3.2 **Start gate:** the cat's value ≥ 50 (the existing visit gate, milestone-2 §12.2.8) and the line not done this run.
3.3 **Branches:** at most one branch per line, chosen by an authored choice (e.g. tell the leader or keep the secret). Each branch writes a world fact from the §12 whitelist; Saga adds new fact ids to the whitelist, I review.
3.4 **Ending:** a kept line writes `quest_done_{lineId}` (scope per branch: private, witnessed or world) and is a reputation deed on the axis the line names (medium, reputation §5 sizes; no new size). A broken step ends the line with `quest_failed_{lineId}`.
3.5 **Memory:** `world.quests[] = {lineId, catId, step, branch?, state: active|done|failed, startAbsDay, endAbsDay}`. The directory history, lore book and narrator read it (lore-book-v0.1 entries are written from these facts).
3.6 **v0.1 scope:** Saga sketches 3 lines; ship those 3 only.
3.7 **Join-your-pride ending (ANNA-APPROVED, rare):** only a line Saga flags `joinEnding: true` can end with the questgiver leaving their pride to join yours, and only on its best branch with the cat at Drawn to you. At most one such line in v0.1. The cat leaves under the existing "After leaving" rule (loners §6.4, `departure: left`) and joins as a member (my-pride v0.1). It writes world fact `left_for_player_{catId}`, which their old pride learns by gossip and treats as a `seen_with_hostile_faction`-sized standing hit (existing value, no new number).
3.8 **Cub death (ANNA-APPROVED):** a failed `find_cub` means the cub died. It's a real death under the lifecycle rules (removed from the pride, kept in the lore book and lineage), writes `cub_lost_{catId}`, and gives the parents a mourning beat Saga writes with care. No extra penalty number; the loss is the cost. In sandbox it still happens unless sandbox death is off.

3.9 **Clarifications for Saga's three lines (Tundra, 2026-11-10):**
1. **Join standing (PROPOSED DEFAULT, candidate, sim pending):** "Drawn to you" in §3.7 means the questgiver's personal value toward the player is 75 or more, reusing the top Interest band cut (encounters §4.2). Courtship Interest itself is not used. The player must have founded a pride and can still say no.
2. **Declining a cub search (PROPOSED DEFAULT):** declining at the ask is free (§2.3), so the cub doesn't die. Her own pride brings her home off-screen. Only an accepted `find_cub` that fails kills the cub (§3.8).
3. **Pride cat leaving to join you:** exactly as §3.7. They leave under loners §6.4 "After leaving" with `departure: left`, then join as a member (my-pride v0.1). No recruit penalty and no extra bonus. Their old pride's hit is the §3.7 gossip hit only.
4. **Deed axis per line (PROPOSED DEFAULT):** each line names its own axis for the kept ending (§3.4). Past the Ledge is Mercy, Somebody Listening is Honour, and The Hyena at the Forks is Courage. Each step keeps its §6 hooks.
5. **New fact ids (APPROVED, whitelisted):** `wolf_sign_herd_trail` (private to the player when the scout finds it; delivering it by carry_word makes it `pride_known` to Bonefield; scouting alone is not a public event, milestone-2 §12 rumor rule), `bf06_credited_wolf_sign` (`pride_known` Bonefield), `player_reported_wolf_sign` (witnessed), `hyena_driven_twin_forks` (world; a fight is a public event), `mw03_secret_kept` (private), `mw03_leg_told_mw01` (witnessed).
6. **Join before founding:** if the join conditions are met but the player has no pride, she stays home. That still counts as a kept line.
7. **Scout facts:** a scout step writes a fact only when the line authors one for it from the whitelist. A carry_word step may deliver only a fact the player already holds.
8. **drive_off region:** R3 stays any region with a hyena encounter. In v0.1 that's Twin Forks only, so the line names it.
9. **Private branch facts:** private is a valid scope for a branch fact (§3.4 lists private, witnessed or world), so `mw03_secret_kept` is fine.

## 4. Gifts
4.1 **Items (v0.1):** prey (small, medium, large; already carried), plus three new carried items found while travelling: `herb`, `bone`, `trophy` (a tooth or claw from a won fight). One carried item at a time, same slot as a carcass; travelling or fleeing rules for dropping it are unchanged (map §10.1).
4.2 **Giving** reuses `gift_share` (milestone-2 §12.6 whitelist). Effect is the existing `affinityIntent` step: liked +5, neutral 0, disliked −5, inside the per-conversation absolute-10 cap. A gift to a leader for the pride moves standing by the same step.
4.3 **Preferences by personality (uses the trait-high line of 70, milestone-2 §11.5.2):**

| Trait ≥ 70 | Likes | Dislikes (backfires) |
|---|---|---|
| aggression | trophy, large prey | herb ("you think I'm sick?") |
| sociability | prey shared in front of others | trophy (blood brought to its den) |
| curiosity | bone, herb (odd finds) | the same item twice (already seen it) |
| none high | prey of any size, herb | nothing |

Ties: aggression wins, as in milestone-2 §11.5.2, then sociability, then curiosity. Saga writes the reaction lines; the cat's sheet can override one row.
4.4 **Other backfires:** a gift to a cat whose pride is hostile to yours can be seen (`seen_with_hostile_faction`, existing); a trophy taken from a cat's own pride is always disliked and writes a fact.
4.5 **Courtship:** a liked gift counts as the turn's courtship action (no extra bonus). A disliked gift during courtship is −5 like any rude choice. Gifts can't skip a bond stage.
4.6 **Repeat cap:** one gift per cat per day; the same item to the same cat twice in a season gives 0 the second time.

## 5. Trade and barter
5.1 Trade is an agreement under world-map-territory §8 (the council and agreement system), so it is kept or broken like any agreement (+5 / −5 pride relation, `broke_{kind}` fact, Honour deed, §8.6). It can be struck at a council or by talking to a leader at standing neutral or better.
5.2 **Kinds (v0.1):**

| # | Kind | You give | You get | Breaks if |
|---|---|---|---|---|
| T1 | `food_for_passage` | one kill delivered to their den | your pride crosses their ground without trespass (no `territory_trespass`) until season end | you Mark, hunt or fight there |
| T2 | `food_for_hunting` | one large kill now | your pride may hunt one named region of theirs until season end | you take more than the named region |
| T3 | `help_for_help` | a §2 request done for them | they do one for you (scout or drive_off) with an NPC result | either side fails its half |

5.3 **Food:** what you give leaves pride food at once (my-pride food rules); what you get never adds food directly. No resource injection.
5.4 **Danger:** a passage deal doesn't change region danger; it only removes the trespass patrol hazard for your cats.
5.5 **AI prides** may strike T1/T2 with each other at councils (world map §8.8 bands must still hold).

## 6. Hooks
- **Reputation:** kept requests and lines are Honour deeds (+); broken are Honour (−); `drive_off` is a Courage deed; `find_cub` is a Mercy deed. Sizes reuse reputation §5. A kept trade is the existing H7 row.
- **Map danger:** `drive_off` done lowers that region's hyena hazard word for the rest of the season only if `quests.driveOffLowersDanger` is set; v0.1 = `null` (off) until sim.
- **Pride food:** only §5.3 (gives). Rewards for requests are relationship and reputation, never food.
- **Lore book / world memory:** §3.5 and §2.3 receipts.

## 7. UI (existing art only; Ochre mocks up)
7.1 A **Requests** tab in the lore book or My Pride: open, done, failed, with the asker's existing portrait and the deadline as a season word.
7.2 **Gift / trade** is a choice in the existing talk screen, plus one small panel listing what you carry and the cat's reaction word after giving.

## 8. Pass bands (Tracker)
1. Every request kind can be completed and failed in a forced scenario; each writes one receipt and never double-applies on reload.
2. No gift path raises a cat's value more than the absolute-10 cap per conversation.
3. Trade never adds pride food.
4. Fun check: at least one request offered in the first 10 days of the seed-8 replay.

## 9. Anna's answers (2026-11-10)
1. Yes, rarely, on special lines only (§3.7).
2. Yes, a failed cub search can mean the cub dies (§2.2 R5, §3.8).
3. Herb, bone and trophy plus prey are enough to start (§4.1).

## Changelog
- v0.1.2a (2026-11-10, Tundra): §3.9.5–9 whitelists Saga's six facts (wolf sign private until carried), join before founding, scout facts, drive_off region, private branch facts. Backup `quests-gifts-trade-v0.1.2.bak.md`.
- v0.1.2 (2026-11-10, Tundra): §3.9 clarifications for Saga's quest lines (join standing, declined cub search, leaving rule, axis per line, fact whitelist). Backup `quests-gifts-trade-v0.1.1.bak.md`.
- v0.1.1 (2026-11-10, Tundra): ANNA-APPROVED with her answers: rare join ending §3.7, cub death §3.8, items confirmed. Backup `quests-gifts-trade-v0.1.bak.md`.
- v0.1 DRAFT (2026-11-10, Tundra): first draft from Anna's request via Director.
