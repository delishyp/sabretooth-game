# Achievements, difficulty levels, traits and appearance — v0.1.3
Status: **ANNA-APPROVED** (Anna via Director, 2026-11-10) for everything except the §3.2 expanded trait list, which is DRAFT awaiting her sign-off. Detail rules stay PROPOSED DEFAULT where marked. No new art. No numbers in player-facing prose; Saga writes all names and flavour lines (ids below are working ids).
Fight numbers come from `sim/traits_difficulty_sim_v0.1.py` (output `.out`, eng4 `sensible` policy, 4,000 fights a cell). Numbers marked **candidate, sim pending** have no sim yet and must not be built until I post one.

## 1. Achievements
1.1 **Storage:** `achievements.json` in the app data folder, separate from save slots, so earned ones survive deleting a save. Each entry `{id, earnedAt, runId, difficulty}`. Earned once; never revoked.
1.2 **Visibility:** visible (name and hint shown), hidden (shows ??? until earned), hard (visible, marked as a challenge). 
1.3 **Mode rules (ANNA-APPROVED):** sandbox earns no achievements at all. Hard ones need Standard or harsher and permadeath or heir. Each entry records the level it was earned on.
1.4 **Screen:** one grid using existing portrait/UI art: earned, locked, ??? tiles; filter by category; a counter of earned out of total. Ochre mocks up.
1.5 **List (34):**

| # | id | Earned when | Kind |
|---|---|---|---|
| A1 | first_kill | first successful hunt | visible |
| A2 | big_game | kill large prey | visible |
| A3 | feast | pride food word reaches Plenty | visible |
| A4 | lean_season | your pride ends a season with no member starving while food was Nothing left at some point | hidden |
| A5 | first_blood | win your first fight | visible |
| A6 | hyena_bane | drive off or beat a hyena clan | visible |
| A7 | lion_slayer | beat an American lion | hard |
| A8 | read_you | win a fight using Defend against a shown Pounce three times | hidden |
| A9 | bloodless | end an encounter by Intimidate alone | visible |
| A10 | spear_dancer | escape humans without a wound | hidden |
| A11 | first_friend | any cat reaches Warming to you | visible |
| A12 | mated | form a mate bond | visible |
| A13 | heartbreaker | be refused by two cats, then bond with a third | hidden |
| A14 | across_lines | bond with a cat from a pride hostile to yours | hidden |
| A15 | founder | found your own pride | visible |
| A16 | loner_king | found a pride as a loner within one season with no deaths | hard |
| A17 | three_banners | hold regions bordering all three prides at once | visible |
| A18 | holdfast | hold your core den region through a full year of challenges | visible |
| A19 | expansion | hold six regions | hard |
| A20 | first_council | attend a council | visible |
| A21 | peacemaker | keep three agreements to expiry | visible |
| A22 | grand_council | win an agenda item against all three prides at one council | hard |
| A23 | oathbreaker | break an agreement | hidden |
| A24 | titled | earn any reputation title | visible |
| A25 | legend | reach the top level on any reputation axis | hard |
| A26 | two_faces | hold a positive title on one axis and a negative one on another | hidden |
| A27 | first_litter | your first cubs are born | visible |
| A28 | full_den | raise a litter of five or more to adulthood | hard |
| A29 | grandsire | see a grandcub born | visible |
| A30 | dynasty | play an heir in the fourth generation | hard |
| A31 | rare_coat | a cub is born showing any rare-tier coat, pattern or eye trait (genetics §3.5, melanistic included) | hidden |
| A32 | errand_cat | complete five requests | visible |
| A33 | storyteller | complete all three quest lines | visible |
| A34 | gift_gone_wrong | give a gift that backfires | hidden |

Counts: 18 visible, 9 hidden, 7 hard. Triggers read existing world memory, ledger and fact records only; no new tracking except a per-run death counter (A16) and a per-fight Defend counter (A8).

1.6 **Trigger clarifications (APPROVED, Tundra minor calls 2026-11-10, for Saga's deeds copy):**
1. Hints stay wordless on counts ("several", "every"); exact counts live only in this table. No number words on tiles.
2. A7: any adult lion encounter counts, the maneless lion included. Hint says "lion".
3. A11: any cat's standing toward the player reaching Warming, not only courtship Interest.
4. A14: mate bond only, same as A12/A13.
5. A16: counts deaths of the player's cat and any cat travelling with or joining the player during that season. Prey and foes don't count.
6. A18: hold the core den region for four consecutive seasons without losing it; formal challenges in that span must all fail or none come.
7. A24: L3 named titles only; L2 "Known as..." does not count.
8. A25: the L5 word on any axis, dark axes (cruelty, cowardice etc.) included.
9. A30: generation 1 is the founder; the fourth generation is an heir born to a grandcub.
10. A33: the three quest lines Saga ships (quests-gifts-trade §3.6), each ending `quest_done_{lineId}`; the §3.7 join ending is a kept ending. "Finish every long trail of asks" is right.

## 2. Difficulty levels
2.1 Levels sit on top of the death rules (permadeath, heir, sandbox), chosen together at new game. Stored in the save; it can't change mid-run (sandbox may change it freely).
2.2 **Standard is the game as specced.** Every encounters §8.3 pass band is measured at Standard and must stay valid.
2.3 **Knobs:**

| Knob | Gentle | Standard | Harsh | Ice Age | Evidence |
|---|---|---|---|---|---|
| Foe strength: lone foes and rival cats (×S) | 0.9 | 1.0 | 1.0 | 1.0 | sim §2.4 |
| Foe strength: lions (×S) | 0.9 | 1.0 | 1.05 | 1.1 | sim §2.4 |
| Foe strength: hyena clans and wolf packs (×S) | 0.9 | 1.0 | 1.1 | 1.15 | sim §2.4 |
| Prey per region (× base prey) | 1.25 | 1.0 | 0.85 | 0.7 | candidate, sim pending |
| Hunger drain (× per day) | 0.8 | 1.0 | 1.15 | 1.3 | candidate, sim pending |
| Reputation loss (× seasonal halving speed) | 0.5 | 1.0 | 1.25 | 1.5 | candidate, sim pending (rerun `reputation_sim_v0.1.2`) |
| Event forgiveness | bad events can be refused once a season; injuries one tier lighter | as specced | no change | bad events can stack; no refusal | rules only |

2.4 **Fight results at each level (ANNA-APPROVED "keep it realistic"; sensible player, no traits, win %; `sim/iceage_realistic_sim_v0.1.py`):**

| Level | Equal cat | Scarjaw | Dire wolf | Hyena clan | Lion | Wolf pack |
|---|---|---|---|---|---|---|
| Gentle | 83 | 35 | 95 | 44 | 45 | 29 |
| Standard | 62 | 16 | 82 | 22 | 24 | 11 |
| Harsh | 62 | 16 | 82 | 10 | 16 | 3 |
| Ice Age | 62 | 16 | 82 | 6 | 10 | 2 |

Predator logic, not punishment: a rival cat or a lone wolf is as hungry as you are, so those odds don't change. Hunger makes packs, clans and lions bolder, so a lone cat mostly loses to them, and in an Ice Age almost always. Harshness otherwise comes from prey, hunger, reputation and events. A capped min-max build at Ice Age wins 81 / 33 / 94 against equal, Scarjaw and dire wolf, and 15 / 24 / 7 against clan, lion and pack, so it's still bounded. The v0.1.1 flat ×1.2 (equal cats 22%) is withdrawn.
2.5 **Flavour (Saga writes the final words):** Gentle, a mild interglacial, herds are thick. Standard, the Vale as it is. Harsh, a long winter, the herds thin. Ice Age, the ice comes south, and only the hard survive.

## 3. Traits
3.1 **Creator:** the player starts with 0 points. Taking a negative trait gives its points; positive ones cost points. At most 3 positive and 3 negative, and points left over are lost. No pair of opposites (e.g. Swift and Lame Paw).
3.2 **Trait list (v0.1.2, 56 traits; Saga names them, ids are working ids).** Kinds: **+** costs points, **−** gives points, **P** play-only (never bought). "Opp." are opposites that can't be held together. "Inh." = can be inherited (§3.5). Tags link to §3b. Every effect reuses an existing rule; values with no sim are marked **(c)** = candidate, sim pending; fight-modifier rows marked **(f)** need Flint's `simulateEncounter` run before build.

**Body: strength, health, senses, size**

| # | id | Kind | Pts | Effect | Opp. | Tag | Inh. | Gained / lost in play |
|---|---|---|---|---|---|---|---|---|
| T1 | iron_jaw | + | 2 | fight strength ×1.05 (sim §4) | chipped_saber | – | yes | – |
| T2 | broad_shoulders | + | 2 | fight strength ×1.05 (sim §4) | runt | heavy | yes | – |
| T3 | giant | + | 2 | +1 Intimidate M (f); −1 Endurance M | runt | large | yes | – |
| T4 | runt | − | 1 | −1 Intimidate M (f) | giant, broad_shoulders | small | yes | – |
| T5 | swift | + | 1 | +1 Endurance M for Flee and the hunt chase | lame_paw | lean | yes | – |
| T6 | lame_paw | − | 2 | fight strength ×0.95; −1 Endurance M | swift | limp | no | gained: Serious leg wound heals badly |
| T7 | thick_hide | + | 1 | +1 Guard M (f) | thin_skinned | – | yes | – |
| T8 | thin_skinned | − | 1 | −1 Guard M (f) | thick_hide | – | yes | – |
| T9 | hardy | + | 2 | injury rolls one tier lighter (formulas §4.3) | sickly | – | yes | – |
| T10 | sickly | − | 2 | injury rolls one tier worse | hardy | lean | yes | lost: a full year with no Serious wound |
| T11 | keen_nose | + | 1 | hunt escape word starts one band better (c) | dull_nose | – | yes | – |
| T12 | dull_nose | − | 1 | hunt escape word starts one band worse (c) | keen_nose | – | yes | – |
| T13 | sharp_eyes | + | 1 | vantage and scouting also show neighbouring regions' danger words | one_eyed | – | yes | – |
| T14 | one_eyed | − | 1 | vantage shows only your own region; can't take sharp_eyes | sharp_eyes | clouded_eye | no | gained: Serious face wound |
| T15 | long_sabers | + | 1 | +1 Intimidate M (f) | chipped_saber | – | yes | – |
| T16 | chipped_saber | − | 1 | −1 Intimidate M (f) | iron_jaw, long_sabers | chipped_saber | no | gained: Serious face wound in a fight you lose |
| T17 | frost_hardy | + | 1 | winter weather events can't injure you | – | heavy | yes | – |
| T18 | big_eater | − | 1 | counts as two members for pride food | – | heavy | yes | – |
| T19 | fertile | + | 1 | litter roll one step larger (c) | small_litters | – | yes | – |
| T20 | small_litters | − | 1 | litter roll one step smaller (c) | fertile | – | yes | – |
| T21 | long_lived | + | 1 | elder stage starts one season later (c) | short_lived | – | yes | – |
| T22 | short_lived | − | 1 | elder stage starts one season earlier (c) | long_lived | – | yes | – |

**Mind and temperament**

| # | id | Kind | Pts | Effect | Opp. | Inh. | Gained / lost in play |
|---|---|---|---|---|---|---|---|
| T23 | short_tempered | − | 1 | aggression +15 (c); may snap at a rude choice | even_tempered | yes | lost: a season with no fights started |
| T24 | even_tempered | + | 1 | a rude choice aimed at you never starts a scuffle | short_tempered | yes | – |
| T25 | craven | − | 1 | Flee always offered first; first flee each season is a Courage deed (−) | fearless | no | lost: three Courage deeds (+) in one season |
| T26 | fearless | + | 2 | can't be Shaken (f); can't Flee in the first round | craven | no | gained: Courage title |
| T27 | reckless | − | 1 | Flee isn't offered while your HP is above the foe's | patient | yes | – |
| T28 | patient | + | 1 | one hunt Wait per hunt without the escape word worsening (c) | reckless, restless | yes | – |
| T29 | restless | − | 1 | can't Rest two days running | patient | yes | – |
| T30 | curious | + | 1 | travel days can turn up a herb or bone (c); +1 gossip fact per talk | – | yes | – |
| T31 | cunning | + | 2 | once per fight, the narrator flags whether the foe's tell is a feint (f) | gullible | no | – |
| T32 | gullible | − | 1 | false rumours reach you without the narrator's doubt line (lore-book rule) | cunning | no | – |
| T33 | proud | − | 1 | yield and withdraw choices aren't offered to you | humble | yes | – |
| T34 | humble | + | 1 | yield to a leader counts as a liked choice (+5) | proud | yes | – |
| T35 | vengeful | − | 1 | your grudges never decay (relationships grudge rule); rivals sense it | forgiving | yes | – |
| T36 | forgiving | + | 1 | a repair talk with a cat holding a grudge counts as liked (+5) | vengeful | yes | – |
| T37 | loyal | + | 1 | every kept promise is also an Honour deed (+); breaking an agreement needs a second confirm | – | yes | lost: break an agreement |
| T38 | grieving | P | – | narration turns heavier; affinity-neutral | – | no | gained: mate or cub dies; lost: next bond or litter |

**Social**

| # | id | Kind | Pts | Effect | Opp. | Inh. | Gained / lost in play |
|---|---|---|---|---|---|---|---|
| T39 | silver_tongue | + | 1 | first-meeting greet counts as liked (+5) | tongue_tied | no | – |
| T40 | tongue_tied | − | 1 | first-meeting greet counts as neutral (0) | silver_tongue | no | – |
| T41 | beloved | + | 2 | first stored pair +10 with every cat (sociability ≥ 70 rule) | outcast_scent | no | gained: Mercy title |
| T42 | outcast_scent | − | 1 | first stored pair −10 with pride cats (aggression ≥ 70 rule) | beloved | no | gained: exile; lost: a season living in a pride |
| T43 | alluring | + | 2 | courtship Interest word starts one band warmer (c) | off_putting | yes | – |
| T44 | off_putting | − | 1 | courtship Interest word starts one band colder (c) | alluring | yes | – |
| T45 | gossip | + | 1 | pass on two facts per talk instead of one; your own secrets spread faster | – | no | – |
| T46 | born_leader | + | 2 | at a council your raised item counts as most urgent | lone_heart | yes | gained: found a pride and hold it a year |
| T47 | lone_heart | − | 1 | voluntary talk limited to the aggression beat limit (milestone-2 §11.5) | born_leader | yes | – |

**Lineage and scars**

| # | id | Kind | Pts | Effect | Tag | Inh. | Gained / lost in play |
|---|---|---|---|---|---|---|---|
| T48 | pride_born | + | 1 | pick a birth pride: its cats start +10, its rivals −10 (existing rules) | – | no | – |
| T49 | nameless_stray | − | 1 | no birth pride; pride leaders' first approval is one step colder (admission rule) | – | no | – |
| T50 | heir_of_legend | P | – | start at the first level of a parent's titled axis | – | auto | gained at birth if a parent held a title |
| T51 | tainted_blood | − | 1 | your cubs roll sickly at the inheritance chance even if you aren't | – | yes | – |
| T52 | battle_scarred | P | – | +1 Intimidate M (f) | scarred_body or scarred_face | no | gained: win three lethal fights |
| T53 | spear_marked | P | – | humans: Flee is offered first; humans remember you | scarred_body | no | gained: survive a failed human flee |
| T54 | torn_ear | P | – | flavour only; rivals taunt it | torn_ear | no | gained: Serious wound in a pride fight |
| T55 | elder_wisdom | P | – | +1 gossip fact per talk; fight strength ×0.95 | – | no | gained: reaching the elder stage |
| T56 | den_mother / den_father | P | – | own-pride cats start +10 with you (sociability rule) | – | no | gained: raise three litters to adulthood |

**Creator limits (PROPOSED DEFAULT):** at most 3 bought positives and 3 negatives (play-only traits don't count), no opposites, leftover points lost.
**Fight-trait limit:** at most 2 positive traits marked (f) or with a fight-strength effect. Rows marked (f) change Guard, Intimidate, Shaken or tells, which `sim/eng4.py` doesn't model, so they go through Flint's `simulateEncounter` against the §4 bands before build.
3.3 **Fight-strength cap (unchanged):** all traits together, play-only ones included, can move fight strength by at most ×1.10 up or ×0.95 down. Difficulty multiplies foes, not the player.
3.4 **NPCs:** each premade cat gets 0–2 traits from Saga's sheet (fits their story, no point rule). Random loners roll 0–1. Traits feed Saga's voice notes.
3.4a **Rumoured until met (ANNA-APPROVED):** before you meet a cat, the detail screen shows its traits as rumours, learned through gossip (lone-cat-actions §8) and logged in the lore book. A rumour can be wrong, using the lore book's false-rumour rule: a wrong rumour names the trait's opposite or a trait the cat doesn't have. After the first meeting, true traits show as confirmed and wrong rumours are struck through. Play-only traits gained later spread as rumours the same way.
3.4b **Rulings for Saga's copy (PROPOSED DEFAULT, v0.1.3a):**
1. Trait reactions share the §3b.6 remark budget: one appearance-or-trait remark per conversation, and per cat once a season after the first meeting. They can fire in first meetings, repeat meetings, courtship and rival taunts. A trait with a linked tag plays its own line or the tag's line, never both.
2. A wrong rumour names the trait's opposite when it has one, otherwise any trait the cat doesn't have.
3. The player never sees rumours about themselves. NPCs learn the player's traits as facts: tag-linked traits on sight at the first meeting, and the rest (including play-only traits gained later) through `knowsFact` gossip, so a cat only reacts to a trait it could know about.
3.5 **Inheritance:** each parent trait marked Inh. passes to a cub with chance **0.25, candidate, sim pending** (separate from the personality average plus noise, which is unchanged). Short-Tempered also nudges the inherited aggression through the existing personality math, nothing extra.

3.5a **Inheritance-only traits (Anna's request via Director 2026-11-10; PROPOSED, awaits Anna; numbers candidate from `sim/inherit_only_sim_v0.1.py`):**
1. **Which:** six of the approved 56, with no new traits. They can't be picked at creation and only reach cubs through blood: `giant` (T3), `long_sabers` (T15), `frost_hardy` (T17), `fertile` (T19), `long_lived` (T21) and `tainted_blood` (T51). Sandbox with Free Customization can still pick them, the same as rare coats. Creator point costs and the §3.3 cap don't change. Taking `giant` and `long_sabers` out of the creator only removes min-max options.
2. **States:** each cat either shows the trait, carries it hidden, or has neither. A carrier gets no effect but can pass it on. Carriers aren't shown, so the Lore Book only knows them as rumours (§3.4a).
3. **Rolls per cub, per trait** (`oneParent` and `bothParents` here mean the parents who *show* it):
| Parents | Cub shows | Cub carries |
|---|---|---|
| both show (`bothParents`) | 70% | 30% |
| one shows, other carries | 50% | 40% |
| one shows, other neither (`oneParent`) | 35% | 40% |
| both carry | 25% | 50% |
| one carries, other neither | 10% | 40% |
| neither | `spontaneous` 1% (shows) | 0% |
4. **`canSkip: true`** for all six, through carriers. `tainted_blood` keeps its own rule: a cat showing it passes `sickly` at the §3.5 chance.
5. **Premade cats (by slot id, because names are random each run):** for each trait, 1 premade shows it and 2 carry it, spread across the three prides. `tainted_blood` has none showing and 2 carrying, as a hidden family flaw. Saga picks slots that fit the lore. A cat holds at most one shown inherit-only trait.
6. **Player's founder:** has an unknown bloodline and rolls `spontaneous` (1%) to show each one, plus a hidden 10% to carry each one. The player only finds out through their cubs.
7. **Sim (crude, random mating, 39 cats, 2,000 runs):** seeded at 1 showing and 2 carrying, a trait shows in a median of 1 cat in the first generation and 4 by the tenth (90th percentile 12). It dies out in 9–17% of runs, and the 1% spontaneous rate can bring it back. Tracker should rerun this on Flint's real breeding once it's wired.
8. **Fields for Flint:** `inheritOnly: true`, `showBoth 70`, `showOne 35`, `showOneCarrier 50`, `showBothCarry 25`, `showCarrierOnly 10`, `carryRates` as in the table, `canSkip: true`, `spontaneous 1`, `founderCarry 10`, and per premade slot `{traitId, state: shows|carries}`.

3.6 **Gained and lost in play:** as listed in the §3.2 tables. Each change writes a world fact and a lore book line, and adds or removes its linked tag.

## 3b. Appearance description (creator step)
3b.1 **Step:** after the look and trait pickers, the player may write a short description of their cat (optional), capped at **280 characters** (ANNA-APPROVED). Saved as `player.appearanceText` with `player.appearanceTags[]`; NPC cats get tags from Saga's sheets and Ochre's scar layers.
3b.2 **Tag set (v0.1, 14):** `scarred_face`, `scarred_body`, `torn_ear`, `notched_ear`, `chipped_saber`, `missing_tooth`, `limp`, `large`, `small`, `lean`, `heavy`, `odd_eyes`, `clouded_eye`, `unusual_coat`.
3b.3 **Extraction:** a fixed keyword-and-synonym list per tag (Saga writes it, I review), run the same way in all three AI modes so tags never depend on the online service. Negations ("no scars") are skipped. Size tags (`large`, `small`, `lean`, `heavy`) match phrases only, never a bare size word (so "a small scar" doesn't tag `small`). `unusual_coat` covers leucistic, ash and piebald only. Melanistic doesn't count, because black is one of the creator's five ordinary coats (`creator.js`, main-menu spec). Dorsal stripe and tear lines are markings and get no tag in v0.1. `odd_eyes` is true heterochromia only (`het/het`, genetics §2.5). Both tags still need the genes, never just the text. The player sees the found tags as chips and can remove any before confirming; nothing is added that they didn't write or pick. At most 4 tags.
3b.4 **The portrait wins:** coat colour, markings and eye colour come from genes, so text that names a different colour gets no tag, and the creator shows a gentle note. `odd_eyes` and `unusual_coat` are only allowed when the genes have them. Scar, ear and saber tags show in text only until Ochre has matching layers (no new art now).
3b.5 **Traits:** Lame Paw adds `limp` automatically. Fight scars gained in play (formulas §4.3 Serious wounds) add `scarred_body` or `scarred_face`. Broad Shoulders adds `heavy`; Swift adds `lean`. A typed tag never grants a trait or any number, so the description can't be min-maxed.
3b.6 **Where it's used:** first meetings (prefer one remark), courtship, rival taunts and occasional later dialogue. Online and local storytellers read `appearanceText` directly plus the tags. Offline lines key on tags only, at most one appearance remark per conversation and per cat per season after the first meeting. Reactions are flavour only: no affinity change of their own, and the cat's personality picks the tone (an aggressive cat respects scars, a sociable one asks about them).
3b.7 **Tracker checks:** every reaction matches a confirmed tag or the written text; none names a colour, eye or marking that contradicts the portrait; a description with no tags produces no appearance remarks.

## 4. Balance check: min-maxing (Standard, sensible player, win %)

| Build | Equal cat | Scarjaw | Dire wolf | Hyena clan | Lion | Wolf pack |
|---|---|---|---|---|---|---|
| Lame Paw | 52 | 10 | 74 | 15 | 16 | 7 |
| No traits | 62 | 16 | 82 | 22 | 24 | 11 |
| One strength trait (×1.05) | 73 | 24 | 90 | 31 | 34 | 18 |
| **Min-max, capped (×1.10)** | **81** | **33** | **94** | **42** | **43** | **26** |
| Uncapped (×1.15, not allowed) | 88 | 44 | 97 | 53 | 54 | 34 |

Verdict: at the cap, a min-maxed cat is strong against equals but still loses most fights against Scarjaw, a hyena clan, a lion or a wolf pack, so fights aren't trivial. Without the cap, clans and lions become coin flips or better, which is why the cap is ×1.10. It also costs 4 points, which means taking about three negative traits.
Pass band for Tracker: at Standard with the capped build, the equal-cat win rate stays at or below 85% and clan, lion, Scarjaw and pack stay below 50%.

## 5. Anna's answers (2026-11-10)
1. Ice Age: keep it realistic (§2.3–2.4, resimmed).
2. Sandbox earns no achievements (§1.3).
3. Traits show as rumours until you meet the cat, and rumours can be wrong (§3.4a).
4. 280 characters is right (§3b.1).
5. More traits: the 56-trait list in §3.2 is back with her for sign-off.

## Changelog
- v0.1.3d (2026-11-10, Tundra): §3.5a inheritance-only traits (six of the 56; show/carry/spontaneous rolls; premade and founder seeding), from `sim/inherit_only_sim_v0.1.py`. Awaits Anna. Backup `achievements-difficulty-traits-v0.1.3c.bak`.
- v0.1.3c (2026-11-10, Tundra): §1.6 trigger clarifications for A7, A11, A14, A16, A18, A24, A25, A30, A33; tile hints keep no number words. Backup `achievements-difficulty-traits-v0.1.3b.bak`.
- v0.1.3b (2026-11-10, Tundra): `unusual_coat` = leucistic, ash, piebald (not melanistic, an ordinary creator coat); no tag for dorsal or tear lines; A31 uses the full genetics rare tier. Backup `achievements-difficulty-traits-v0.1.3a.bak.md`.
- v0.1.3a (2026-11-10, Tundra): §3.4b rulings for Saga's copy (shared remark budget, wrong rumour prefers the opposite trait, NPC knowledge of player traits); §3b.3 size words match phrases only, unusual coat and odd eyes tied to A31's rare genes. Backup `achievements-difficulty-traits-v0.1.3.bak.md`.
- v0.1.3 (2026-11-10, Tundra): ANNA-APPROVED except §3.2. Ice Age resimmed to predator logic (lone foes unchanged, lions ×1.1, groups ×1.15; Harsh 1.0 / 1.05 / 1.1); sandbox earns none; traits rumoured until met; 280 characters. Backup `achievements-difficulty-traits-v0.1.2.bak.md`.
- v0.1.2 DRAFT (2026-11-10, Tundra): trait list expanded from 11 to 56 across body, mind, social and lineage, with opposites, tags, inheritance and play-only traits; fight-trait limit added. Backup `achievements-difficulty-traits-v0.1.1.bak.md`.
- v0.1.1 DRAFT (2026-11-10, Tundra): §3b appearance description step from Anna via Director. Backup `achievements-difficulty-traits-v0.1.bak.md`.
- v0.1 DRAFT (2026-11-10, Tundra): first draft. `sim/eng4.py` gains the §8.1 `sensible` policy (the old `reader` reproduced 53% instead of 63%); backup `sim/eng4.py.v0.1.2.bak`.
