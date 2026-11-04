# Sabretooth: Core Formulas Spec (v0.2, DRAFT, design-only)
Owner: Tundra (rules and numbers). Code: Flint. QA: Tracker. Resolves skills-spec §15.1.
Related:
- skills-spec v0.2.2: milestones M1–M4, perks.
- loners-spec v0.9: §4 mates, §5b bands, §10.
- relationships-spec v0.1.2: §1.8 attraction, §5.2.
- needs-spec v0.1: §1 states, §2 injuries.
- lifecycle-spec v0.1: §1.2, §3.
- play-styles-spec v0.2: §2.
- world-gen-spec: slot XP and milestones.

All numbers are starting values, kept in `formulas.json`. Every roll is a **sum of points, clamped**, then rolled once. "M" = a skill's current milestone (0–4 at start; slots ≤ 4). Order (skills §2.8): add every term, multiply by stage, apply the winter scarcity multiplier, then clamp.

## 1. Hunt success
1.1 **Gate:** the cat isn't Tired or Exhausted and has no Crippling injury (needs §1.4, §2.1).
1.2 **Points:**

| Term | Value |
|---|---|
| Base | 50 |
| Prey size | small +5, medium 0, large −20 |
| Party (medium/large only; counts other adults and adolescents in the hunt) | +5 per extra adult, +2 per adolescent learner, max +15 |
| Role | hunter role +5 (NPC roles, or the player in a role-tagged pride hunt) |
| Stalk | +3 × M (all prey) |
| Big Game | +2 × M (large only) |
| Perks | as written (ambush +10, dusk_hunter +8/−3, bold_charge +8 large, pack_lunge +10, small_game +10/−5, snow_tracks +8, herd_calendar +5, scout +5, lean_hunter −10) |
| Weather | blizzard day −10; otherwise 0 |
| Hunger | Hungry −5 (Prey Sense M3 removes it) |
| Health | below 50: −10 |
| Mood | Low −5, High +5 |
| Injury | Minor −5, Serious −15 (worst injury only) |
| Style (play-styles §2.5) | Story +15, Standard 0, Sim −10 |

1.3 **Multipliers, after the sum:**
   - **Stage:** adolescent × 0.5 (× 0.75 with `hunt_mentor`), elder × 0.8 (lifecycle §3).
   - **Winter scarcity:** × (1 − s), with s = Story 0.10, Standard 0.20, Sim 0.40 (play-styles §2.6). Prey Sense reduces s by 0.02 × M. Spring, summer and autumn use s = 0.
1.4 **P(success)** = clamp(points, 5, 95)%. `second_lunge` gives one reroll on a failure, so that hunt's P becomes 1 − (1 − P)². `apex_stalker` makes the first small/medium hunt each season automatic.
1.5 **Yield on success:**

| Prey | The hunter eats (needs §1.2) | Pride food store (Standard) | Party share |
|---|---|---|---|
| Small | +25 Hunger (`small_feeder` +35) | +0 | not shared |
| Medium | +50 | +50 | the hunter eats; the rest goes to the store |
| Large | +80 share each (`pack_lunge` +50) | +150 + 50 per party member | each member +80 |

   In Sim (per-cat hunger) the store value is split among chosen cats instead. Carcass theft and spoilage follow play-styles §2.7.
1.6 **Injury chance**, rolled after every hunt:
   - Base by prey: small 2%, medium 6%, large 15%.
   - × 1.5 on a failed hunt.
   - × Style (play-styles §2.3): 0.5, 1 or 1.5.
   - Large prey only: × (1 − 0.06 × Big Game M) (min × 0.7), with perks as written (`throat_bite` × 0.7, `bold_charge` × 1.5 on a failure, `giant_slayer` × 2).
   - Tier split: minor 70%, serious 25%, crippling 5% (needs §2.1).
1.7 **Targets and checks** (fresh 12-season player, solo, spring, needs ok, no skills):

| Hunt | Story | Standard | Sim |
|---|---|---|---|
| Small solo | 70% (50+5+15) | **55%** (50+5) | 45% (50+5−10) |
| Medium solo | 65% | 50% | 40% |
| Large solo | 45% | 30% | 20% |
| Small solo, winter | 63% (70 × 0.9) | 44% (55 × 0.8) | 27% (45 × 0.6) |

   These hit the brief's targets of 70 / 55 / 45 exactly.
1.8 **Worked examples (Standard):**
   - **Fresh player, medium deer, Hungry, autumn:** 50 + 0 − 5 = **45%**. Injury: 6% on a success, 9% on a failure.
   - **Veteran hc03** (Stalk M3, Big Game M3, hunter role), large bison with 2 adult pride mates, winter: (50 − 20 + 10 + 9 + 6 + 5) = 60 × 0.8 = **48%**. In spring it's 60%. Injury: 15% × 0.82 = 12.3% on a success, 18.5% on a failure.
   - **Second Lunge:** a 55% hunt becomes 80% once per season.

## 2. Courtship acceptance (the target accepts the suitor; one attempt)
2.1 **Gates** (fail = no roll, gentle decline, no loss):
   - Both cats are adult or elder (relationships §1.6).
   - Attraction-compatible (relationships §1.8; tag `courtship_declined_attraction`).
   - r < 0.125.
   - The target isn't mated.
   - Pair value > −15.
   - **Breeding season (Anna via Director, v0.2):** both cats are unmated and today falls in `breedingSeasons` (default `["spring"]`, days 1–20; §2.4).
   - **Attempts:** 1 per 5 days per target during the breeding season (so up to 4 per spring), or more with `again` and `sweet_talk`.
2.2 **Points:**

| Term | Value |
|---|---|
| Base | 20 |
| Pair value | + 0.4 × value (−6..+40) |
| Relationship bonuses (relationships §5.2) | +10 at value ≥ 50, +5 for 25–49, −10 at ≤ −15; +10 if the target holds a crush on the suitor |
| Display | +3 × M |
| Perks | `gift` +10, `call` −5, `chosen` = auto at value ≥ 60 |
| Target personality | + (target sociability − 50) / 5 (−10..+10) |
| Compatibility (relationships §3.2) | + compat / 2 (about −10..+10) |
| Suitor standing | + (the target's pride relation with the suitor's pride, or with the player when lone) / 10 (−10..+10). Loners targets skip this term |
| Suitor Mood | Low −5, High +5 |
| Style | Story +10, Standard 0, Sim −5 |

   **Charm** doesn't add here: it multiplies the courtship affinity gains (skills §2.6), so it acts through pair value.
2.3 **P(accept)** = clamp(points, 5, 90)%.
   - **Success:** the pair gets `mates` (relationships `rel.mates_bond`). A pride-cat target still needs leader approval (§3) and the mate rival challenge (§4.4), per loners §4.2. A loner target joins per loners §4.3.
   - **Failure:** −5 pair value (`persistent` makes it 0).
2.4 **Breeding season (Anna via Director, 2026-11-05):** a cat with no mate can only court during the breeding season. This applies to the player and AI cats, including widowed cats and cats after a bond break. The tunable `breedingSeasons` defaults to `["spring"]` in every Style.
   - Out of season, the Court action is shown greyed out with a "not in season" hint (Saga's copy). Crushes, grooming, sharing and other affinity actions keep working all year, so the player can build value ahead of spring.
   - Mated pairs (any `mates` bond) aren't season-gated for bonding or scenes. **Births stay spring or summer only** (lifecycle §1.2). Conception stays abstracted: a mated breeding pair can produce a litter in the next spring or summer per lifecycle rules.
   - AI world drift pairing (relationships §5.2) only forms new mates in spring.
   - The run starts on day 1 of spring, so the player's first breeding season is open from the start. Missing it means waiting a year (80 days) as a loner. That's intended pressure, and loners-spec survival already covers it.
   - The season term in §2.2 is removed, since every courtship now happens in spring.
2.5 **Targets (Standard; Story +10, Sim −5):** about 35% at warm (value 25) and about 50% at close (value 50), for a fresh suitor with average targets. 
2.6 **Worked examples (Standard):**
   - **Fresh player** courting hc05 (value 30, sociability 50, compat 0, Highcrag relation 0), spring: 20 + 12 + 5 + 0 + 0 + 0 = **37%**.
   - **Veteran player** (Display M3, value 60, a gift, Mood High, target holds a crush, relation +20), spring: 20 + 24 + 10 + 10 + 9 + 10 + 2 + 5 = **90%** (the cap).
   - **A cold pair** (value −10): 20 − 4 + 0 = 16%, before any bonuses.

## 3. Leader approval (pride-cat mate, or joining/staying in an AI pride)
3.1 **Used for:**
   - (a) taking a pride cat as mate (loners §4.2);
   - (b) a lone player asking to join an AI pride as a member;
   - (c) a mated player staying in the mate's AI pride before founding.

   It's rolled once per request, with 1 request per season per pride.
3.2 **Points:**

| Term | Value |
|---|---|
| Base | 30 |
| Pride relation with the player | + relation / 2 (−50..+50; Sandbox starting reputation feeds this) |
| Leader's pair value toward the player | + 0.3 × value |
| Standing | +3 × M; `proven` +10 (won a fight this season); `elder_voice` +15 |
| Pride temperament (lore) | Highcrag −10 (custom: mates from within); Bonefield +10 if the player won any fight this season, else −5; Mistwood +2 per season the player has been in its range, max +10 |
| Request type | (a) 0; (b) −10; (c) +10 |
| The target cat's support (a only) | +10 if the target's value toward the player is ≥ 50 |
| Style | Story +10, Standard 0, Sim −5 |

3.3 **P(approve)** = clamp(points, 5, 90)%. On a failure, pride relation −5 (`respected` makes it 0). `heartbreaker` skips approval as written.
3.4 **Worked examples (Standard):**
   - **Fresh player**, Highcrag (relation 0, leader value 10), request (a), target at 55: 30 + 0 + 3 − 10 + 10 = **33%**.
   - **Veteran** (Standing M3, `proven`, relation +30, leader value 40), Bonefield, won a fight: 30 + 15 + 12 + 9 + 10 + 10 = **86%**.

## 4. Fight and challenge resolution
Existing rules that I keep:
- loners §5b.3: band strength = Σ fight stats × 1.1.
- §5b.5: group fight with ±20% each side, and the loser retreats injured.
- §10: warning choices gather ×1.15, hide ×0.9, plus yield.
- §10.7: confront and scuffle.

**This section defines the missing fight stat, the 1-v-1 roll, and the injury and death rolls.**
4.1 **Fight stat** = 10 × the product of:
   - Saber Strike × (1 + 0.03 × M);
   - aggression × (1 + (aggression − 50) / 250), i.e. ×0.8..1.2;
   - stage (lifecycle §3): adolescent ×0.6, elder ×0.85 at 10 years, then −0.05 per year, min ×0.5;
   - Health < 50 ×0.8;
   - injury: Serious ×0.7 (Crippling can't fight);
   - perks as written (`first_strike`, `fury`, `shoulder_to_shoulder`, `takeover` ×1.1);
   - Standing × (1 + 0.02 × M), in the mate rival challenge only.
4.2 **Resolution** (1-v-1 or group): each side's strength × U(0.8, 1.2), and the higher wins (ties go to the defender). Equal strength wins 50%. A 10% edge wins about 71%. A 25% edge wins about 90%.
4.3 **After a fight:**
   - **Injuries:**
     - The loser rolls 40% and the winner 15%.
     - Both are × Style (play-styles §2.3) and × Guard (1 − 0.06 × M, min ×0.7).
     - Tier split: loser 60 / 30 / 10, winner 80 / 20 / 0 (minor / serious / crippling). `guard` M3 downgrades crippling once per season.
   - **Death:** the loser only, in lethal fights (leadership challenges, band `mates` fights, rival attacks), at play-styles §2.9: Story 0%, Standard 5%, Sim 10%. Confronts, scuffles, displays and `feint` are never lethal.
4.4 **Challenge types:**

| Challenge | Who | Stakes | Rules |
|---|---|---|---|
| Mate rival challenge (loners §4.2) | the suitor vs the strongest same-sex adult in the target's pride with value ≥ 15 toward the target (if none, it's skipped) | the right to court/mate | non-lethal; loser −10 value with the target; `showdown` may replace it (skills §2.6) |
| Leadership challenge (relationships §5.4; Bonefield lore) | an adult challenger vs the leader, 1-v-1 | the leader role | lethal; per pride custom, the loser leaves (Bonefield) or loses 1 season of prideLoyalty −20 (Highcrag, Mistwood) |
| Band challenge (loners §5b.4–5b.5) | group vs group | `mates` / `territory` | unchanged; uses 4.1 stats |
| Rival attack (loners §5.1) | rival vs a lone cat | none | lethal; the loser is driven off for 2 seasons (§5.3) |

4.5 **Worked examples:**
   - **Fresh player** (stat 10.0) vs Scarjaw bf01 (Saber Strike M4 ×1.12, aggression 80 ×1.12 → 12.5): the player wins about **10%**.
   - **Veteran player** (Saber Strike M3, aggression 60, `first_strike`: 10 × 1.09 × 1.04 × 1.1 = 12.5) vs the same Scarjaw: about **50%**.
   - **Two fresh males** (10 each) vs one veteran: 22.0 vs 12.5, so the band almost always wins. This fits the 5b.4 targeting rule (band ≥ 0.8 × defenders).

## 5. Tunables (`formulas.json`)
| Key | Default |
|---|---|
| hunt.base / prey small, medium, large | 50 / +5, 0, −20 |
| hunt.party per adult / adolescent / max | +5 / +2 / +15 |
| hunt.role / blizzard / healthLow / hungry | +5 / −10 / −10 / −5 |
| hunt.style / scarcity | +15, 0, −10 / 0.10, 0.20, 0.40 |
| hunt.clamp | 5–95 |
| hunt.yield store medium / large base / per member | 50 / 150 / 50 |
| hunt.injury small / medium / large / failMult | 2% / 6% / 15% / ×1.5 |
| hunt.injury tiers | 70 / 25 / 5 |
| court.base / valueK | 20 / 0.4 |
| court.sociabilityDiv / compatDiv / standingDiv | 5 / 2 / 10 |
| court.season spring / winter | +5 / −5 |
| court.style / clamp / failLoss | +10, 0, −5 / 5–90 / −5 |
| leader.base / relationDiv / leaderValueK | 30 / 2 / 0.3 |
| leader.temperament HC / BF / MW | −10 / +10 or −5 / +2 per season (max 10) |
| leader.request a / b / c / targetSupport | 0 / −10 / +10 / +10 |
| leader.style / clamp / failLoss | +10, 0, −5 / 5–90 / −5 |
| fight.base / aggressionDiv / random | 10 / 250 / U(0.8, 1.2) |
| fight.injury loser / winner | 40% / 15% |
| fight.tiers loser / winner | 60/30/10 / 80/20/0 |
| courtship.breedingSeasons | ["spring"] |
| courtship.attemptCooldownDays | 5 |

## 6. Test checklist (Tracker)
1. **Hunt targets:** over 100k simulated hunts (fresh cat, small, solo, spring), success is 55 ± 1% in Standard, 70 ± 1% in Story and 45 ± 1% in Sim. The winter table in 1.7 also holds.
2. Every roll stays inside its clamp, even with all bonuses or all penalties stacked.
3. Skills apply before the stage multiplier: an adolescent's Stalk bonus is halved.
4. `second_lunge` raises a 55% hunt to 80 ± 1% over 100k samples, and only once per season.
5. Courtship gates: a declined attraction gives no roll and no value loss. Cub/adolescent and r ≥ 0.125 attempts are impossible.
6. The §2.6, §3.4 and §4.5 worked examples reproduce exactly (as unit tests).
7. Fights: equal strength wins 50 ± 1%. 10 vs 12.5 wins 10 ± 1%. Non-lethal fights never kill.
8. Injury rates per hunt and per fight match §1.6 and §4.3 × Style, within ±1%.

## 7. Open questions (Director)
7.1 ANSWERED (Director): keep ±20%. Beating a leader should feel earned.
7.2 ANSWERED (Anna via Director): unmated cats can only court in the breeding season (spring by default). Mated pairs aren't gated, and births stay in spring and summer (§2.4).
7.3 ANSWERED (Director): keep the per-pride split, with Bonefield exiling the loser and Highcrag and Mistwood taking −20 loyalty. Saga writes around it.
7.4 ANSWERED (Director): yes, the player may join as a plain member (type b, −10). Joining through a mate stays the easier route.

## Changelog
- v0.1 (2026-11-05, Tundra): first draft. Resolves skills-spec §15.1 (hunt, courtship, leader approval) and fills the fight-stat and challenge gaps.
- v0.1.1 (2026-11-05, Director): §7.1, §7.3 and §7.4 answered with no number changes. §7.2 waits on Anna.
- v0.2 (2026-11-05, Anna via Director): breeding season gate added (§2.1, §2.4) with `breedingSeasons` default spring. Attempts are now 1 per 5 days per target in season. The season modifier is removed, so the fresh-player example drops from 42% to 37%.
