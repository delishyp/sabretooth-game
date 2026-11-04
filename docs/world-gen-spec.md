# Sabretooth: World Generation Spec (v0.3.6, DRAFT, design-only)
Owner: Tundra (rules and numbers). Names data, lore and slot templates: Saga. Code: Flint (after the creator). QA: Tracker.
Ask: Anna via Director, 2026-11-04. **Anna decided (v0.2):** the 39 world cats are **39 fixed slots**. Each slot's exact age and skills are fixed every run; **coat genetics (all loci) and names are re-rolled every run.**
Related: genetics-spec v0.2 (§1, §3, §4, §6), lifecycle-spec v0.1 (§1.3, §2), loners-spec v0.8 (§1, §3.4, §5b), skills-spec v0.2 (§6 aptitude, §8.3–8.5, §10.1), needs-spec v0.1, cat-creator-spec v0.2 §5, main-menu-spec v1.4 §5, lore/world-and-prides.md, lore/loners.json v0.3, `src/renderer/data/names/` (names.json + README).
All numbers are starting values to tune. Labels: **Anna** = decided, **Director** = approved by Director 2026-11-04, **derived** = a value I chose where Saga's data has none.

## 1. Overview and seed
1.1 Each run has one `worldSeed`, an unsigned 32-bit int rolled at the creator's Start. It's stored in `run.json` and fixed for the run.
1.2 **Every Style (Director, 2026-11-04):** New Game gets a collapsed **Advanced** section with a "World seed" field (blank = random). `menu:newGame` gains an optional `worldSeed` (uint32); Director is logging it in main-menu-spec v1.4.2. The seed is shown on the run card and in the pause menu so a world can be replayed.
1.3 PRNG: one seeded generator (e.g. `sfc32`) with **named sub-streams** forked from the seed: `names`, `genes`, `personality`, `attraction` (v0.3.2), `het` (v0.3.3), `markings` (v0.3.4, genetics v0.4). There's no roster stream; the roster is static (§2). `Math.random` is never used in world gen.
1.4 **When:** on `menu:newGame`, after any replaced run is deleted and before the first save is written. It must take < 200 ms.
1.5 **Order:** (1) load the static slot table §2 → (2) roll founder genotypes in slotId order → (3) breed kin genotypes, parents before children → (4) personalities §5, founders first, then kin → (5) names in slotId order §3 → (6) state init §7 → (7) validate names/genes §3.5 → emit `world:generated`. No reroll loop: the roster checks are static (§2.4) and run as a unit test, not at runtime.
1.6 `mainCat` is the player. It's never a slot, and its name is reserved for the run (§3.2).
1.7 Same seed + same data-file versions = identical world. Player sex doesn't affect generation any more.

## 2. The 39 slots (static)
2.1 Totals (loners-spec §1): Highcrag 11, Bonefield 10, Mistwood 9, plus 9 loners. Columns:
   - **age** = `ageSeasons` at run start.
   - **sire/dam/mate** = slot ids. "—" means none; "off" means an off-roster or dead cat.
   - **narrative lean** = authoring-only lean as A/S/B/L/C (aggression, sociability, boldness, loyalty, curiosity). It was used once to pick the fixed perks, and it's never used in generation: personality is fully random each run (§5).
   - **skills** = each listed skill's milestone (1–4) and the slot's aptitude lean (§2.3). The fixed perk ids are in §2.3a.
   - **role names in quotes** are Saga's story roles. The displayed name is still random each run (§3).

| slot | pride | role | sex | age | sire | dam | mate | narrative lean A/S/B/L/C (not used in gen) | skills (top milestone per skill, perks in §2.3a; aptitude lean) | scar |
|---|---|---|---|---|---|---|---|---|---|---|
| hc01 | highcrag | leader "Ashmane" | F | 36 | off | off | hc03 | 45/40/60/75/45 | leadership 4, persuasion 3, stalk 2; social +10 | — |
| hc02 | highcrag | member "Stonebrow" (leader's son) | M | 16 | hc03 | hc01 | hc06 | 60/45/55/55/40 | saberStrike 2, stalk 1; fighting +5 | — |
| hc03 | highcrag | member, leader's mate | M | 39 | off | off | hc01 | 50/45/55/70/40 | stalk 3, bigGame 3, guard 2; hunting +10 | — |
| hc04 | highcrag | member "Thistle" (Bonefield-born foundling) | M | 12 | off | off | — | 50/55/60/50/60 | stalk 1; fighting +5 | — |
| hc05 | highcrag | member, hunter | F | 24 | off | off | — | 45/50/60/60/50 | stalk 3, preySense 2; hunting +5 | — |
| hc06 | highcrag | member, nursemaid | F | 20 | off | off | hc02 | 35/65/45/65/45 | grooming 2, hardiness 2; social +5 | — |
| hc07 | highcrag | member, guard | F | 31 | off | off | — | 60/40/60/60/40 | guard 3, saberStrike 2; fighting +5 | ear_notch_left |
| hc08 | highcrag | elder, keeper of the recitation | F | 51 | off | off | — | 30/55/40/75/55 | leadership 3, trailReading 3, thickCoat 2; tracking +5 | — |
| hc09 | highcrag | adolescent | M | 8 | hc03 | hc01 | — | 50/50/55/55/55 | stalk 1; hunting +5 | — |
| hc10 | highcrag | cub | F | 3 | hc02 | hc06 | — | 45/55/50/55/55 | none; social +5 | — |
| hc11 | highcrag | cub | M | 0 | hc02 | hc06 | — | 55/50/55/55/50 | none; neutral | — |
| bf01 | bonefield | leader "Scarjaw" | M | 32 | off | off | bf04 | 80/30/75/55/40 | saberStrike 4, intimidate 4, guard 3; fighting +15 | lip_split |
| bf02 | bonefield | member "Redthroat" | M | 20 | off | off | — | 70/40/65/50/45 | saberStrike 2, bigGame 2; fighting +5 | flank |
| bf03 | bonefield | member, hunter | M | 24 | off | off | — | 60/45/65/50/50 | bigGame 3, stalk 2; hunting +10 | — |
| bf04 | bonefield | member, leader's mate | F | 28 | off | off | bf01 | 60/45/60/60/40 | stalk 3, guard 2; hunting +5 | — |
| bf05 | bonefield | member, hunter | F | 23 | off | off | — | 55/50/60/45/50 | stalk 2, cleanKill 2; hunting +5 | — |
| bf06 | bonefield | member | F | 19 | off | off | — | 50/55/50/45/60 | trailReading 1, stalk 1; tracking +5 | — |
| bf07 | bonefield | elder, Tallgrass's old guard (bowed to Scarjaw without a fight; Saga owns the text) | M | 44 | off | off | — | 65/35/50/55/40 | guard 4, saberStrike 3, intimidate 3; fighting +5 | foreleg_left |
| bf08 | bonefield | adolescent | F | 7 | bf01 | bf04 | — | 70/40/65/55/40 | saberStrike 1; fighting +5 | — |
| bf09 | bonefield | cub | M | 3 | bf01 | bf04 | — | 70/40/65/55/40 | none; fighting +5 | — |
| bf10 | bonefield | cub | F | 0 | off | bf05 | — | 55/50/60/45/50 | none; neutral | — |
| mw01 | mistwood | leader "Hollowsong" (aging queen) | F | 39 | off | off | — (mate Longshadow drowned) | 30/60/40/70/50 | leadership 3, grooming 3, hardiness 3; social +10 | — |
| mw02 | mistwood | member, older scarred tom | M | 36 | off | off | mw04 | 45/45/50/65/45 | guard 3, thickCoat 3, stalk 2; survival +10 | flank (Breaking) |
| mw03 | mistwood | member, young scarred tom | M | 15 | off | off | — | 45/50/50/55/55 | endurance 2, trailReading 1; survival +5 | hind_leg_left |
| mw04 | mistwood | member | F | 27 | off | off | mw02 | 35/55/45/65/50 | stalk 2, preySense 2; tracking +5 | — |
| mw05 | mistwood | member, hunter | F | 20 | off | off | — | 40/50/55/55/55 | stalk 2, trailReading 2; tracking +5 | — |
| mw06 | mistwood | member | F | 16 | off | off | — | 35/60/40/60/60 | grooming 1, preySense 1; social +5 | — |
| mw07 | mistwood | elder, wise-cat | F | 55 | off | off | — | 25/60/35/70/60 | hardiness 4, grooming 3, trailReading 3; survival +5 | eye_right |
| mw08 | mistwood | adolescent (Longshadow's) | M | 8 | off_longshadow | mw01 | — | 35/55/50/65/50 | stalk 1; survival +5 | — |
| mw09 | mistwood | cub | F | 0 | mw02 | mw04 | — | 40/50/50/65/45 | none; neutral | — |
| ln01 | loner (origin highcrag, exiled) | "Greymantle", elder | M | 52 | off | off | — | 25/45/45/70/50 | leadership 4, thickCoat 4, trailReading 3 | forelegs |
| ln02 | loner (highcrag, left) | "Sorrel", young adult | F | 15 | off | hc07 | — | 30/75/50/45/60 | charm 2, stalk 1 | — |
| ln03 | loner (bonefield, exiled) | "Torncheek" | M | 28 | off_bf_sire | off | — | 80/25/75/40/40 | saberStrike 4, intimidate 3, guard 3 | cheek_torn, forelegs |
| ln04 | loner (bonefield, left) | "Nettle" | F | 32 | off | off | — | 70/50/60/75/45 | guard 3, stalk 3, saberStrike 2 | ear_notch_right |
| ln05 | loner (bonefield, left) | "Duskrunner", young adult | M | 16 | off_bf_sire | off | — | 30/75/55/35/75 | endurance 2, trailReading 2 | tail |
| ln06 | loner (mistwood, survivor) | "Lichen", elder | F | 48 | off | off | — | 25/75/40/60/55 | hardiness 4, grooming 3, preySense 3 | eye_left |
| ln07 | loner (mistwood, exiled) | "Ashfall" | M | 27 | off | off | — | 50/30/55/55/45 | thickCoat 3, endurance 3, stalk 2 | muzzle |
| ln08 | loner (mistwood, left) | "Sedge" | F | 24 | off | off | — | 50/50/50/65/50 | stalk 2, preySense 2 | lip_split |
| ln09 | loner (mistwood, survivor) | "Coldwater" | M | 20 | off_longshadow | off | — | 30/75/50/60/50 | endurance 2, grooming 1 | flank, hind_leg_left |

2.2 **Sources.** Loner ages, sexes, origins, departures and scars come from Saga's `loners.json` v0.3. Leaders' sexes and roles come from world-and-prides §2. The "Stonebrow", "Thistle" and "Redthroat" roles come from loners.md (reserved roster names). Every other pride value is **derived**.
2.3 **Skill blocks** (Anna: fixed per slot) live in `worldgen.slots.json` as `skills: {skillId: xp}`, `perks: {skillId: [perkId, ...]}` (one id per milestone reached, §2.3a) plus `aptitude: {branch: 80–120}`.
   - The number after each skill in §2.1 is its milestone. The XP at start is that milestone's threshold from skills-spec v0.2 §10.1 (M1 100, M2 300, M3 600, M4 1000). **No slot is past milestone 4.**
   - Unlisted skills are 0 XP.
   - "Aptitude lean +N" means that branch is 100 + N and the others are 100.
   - Cubs have 0 XP and no perks. Their aptitude follows §6.1 bred from their parents' fixed aptitude, which is fixed per slot as the parent average, rounded.
2.3a **Fixed perks per slot (v0.3.1, skills-spec v0.2 §8.3).** Each slot's perks per milestone are fixed every run, like its XP. They were **authored once**, at design time, with the skills-spec §8.4 weights using the slot's narrative lean, taking the highest-weight option (ties go to the first), then checked against the slot's role and Saga's lore review (`lore/perk-review.md`). **No runtime rule reads the narrative lean.** Perks read as history (what the cat learned), never as temperament. Cubs have none, and no slot is past milestone 4. Saga may swap a pick to fit a story (skills-spec §15.3).

| slot | role | perks by skill and milestone |
|---|---|---|
| hc01 | leader "Ashmane" | leadership: M1 `eat_last`, M2 `rally`, M3 `heir_trainer`, M4 `legacy_rally`; persuasion: M1 `read_mood`, M2 `calm_words`, M3 `envoy` (role swap: a leader's envoy over a Sim-only lure); stalk: M1 `patient_stalker`, M2 `second_lunge` |
| hc02 | member "Stonebrow" (leader's son) | saberStrike: M1 `first_strike`, M2 `fury`; stalk: M1 `patient_stalker` |
| hc03 | member, leader's mate | stalk: M1 `patient_stalker`, M2 `second_lunge`, M3 `cache_kill`; bigGame: M1 `throat_bite`, M2 `bold_charge`, M3 `carcass_guard`; guard: M1 `roll_with_it`, M2 `tough_hide` |
| hc04 | member "Thistle" (Bonefield-born foundling) | stalk: M1 `ambush` |
| hc05 | member, hunter | stalk: M1 `patient_stalker`, M2 `second_lunge`, M3 `cache_kill`; preySense: M1 `snow_tracks`, M2 `small_game` |
| hc06 | member, nursemaid | grooming: M1 `gentle_approach`, M2 `peacemaker`; hardiness: M1 `quick_healer`, M2 `stoic` |
| hc07 | member, guard | guard: M1 `roll_with_it`, M2 `tough_hide`, M3 `last_stand`; saberStrike: M1 `feint`, M2 `fury` |
| hc08 | elder, keeper of the recitation | leadership: M1 `eat_last`, M2 `rally`, M3 `heir_trainer`; trailReading: M1 `seek`, M2 `read_affinity`, M3 `rumor_web` (v0.3.5); thickCoat: M1 `winter_coat`, M2 `huddle_core` |
| hc09 | adolescent | stalk: M1 `ambush` |
| hc10 | cub | none (cub) |
| hc11 | cub | none (cub) |
| bf01 | leader "Scarjaw" | saberStrike: M1 `first_strike`, M2 `fury`, M3 `duelist`, M4 `killing_bite`; intimidate: M1 `roar`, M2 `bully`, M3 `banish`, M4 `warlord`; guard: M1 `roll_with_it`, M2 `fight_through`, M3 `last_stand` |
| bf02 | member "Redthroat" | saberStrike: M1 `first_strike`, M2 `fury`; bigGame: M1 `throat_bite`, M2 `bold_charge` |
| bf03 | member, hunter | bigGame: M1 `throat_bite`, M2 `bold_charge`, M3 `carcass_guard`; stalk: M1 `ambush`, M2 `second_lunge` |
| bf04 | member, leader's mate | stalk: M1 `patient_stalker`, M2 `second_lunge`, M3 `cache_kill`; guard: M1 `roll_with_it`, M2 `tough_hide` |
| bf05 | member, hunter | stalk: M1 `ambush`, M2 `second_lunge`; cleanKill: M1 `quick_kill`, M2 `scavenger` |
| bf06 | member | trailReading: M1 `scent_history`; stalk: M1 `ambush` |
| bf07 | elder, Tallgrass's old guard | guard: M1 `roll_with_it`, M2 `fight_through`, M3 `bodyguard`, M4 `scar_pride`; saberStrike: M1 `first_strike`, M2 `fury`, M3 `shoulder_to_shoulder`; intimidate: M1 `roar`, M2 `bully`, M3 `banish` |
| bf08 | adolescent | saberStrike: M1 `first_strike` |
| bf09 | cub | none (cub) |
| bf10 | cub | none (cub) |
| mw01 | leader "Hollowsong" (aging queen) | leadership: M1 `eat_last`, M2 `rally`, M3 `heir_trainer`; grooming: M1 `generous`, M2 `bond_maker`, M3 `soothe`; hardiness: M1 `quick_healer`, M2 `stoic`, M3 `healer` |
| mw02 | member, older scarred tom | guard: M1 `roll_with_it`, M2 `tough_hide`, M3 `bodyguard`; thickCoat: M1 `snow_sleeper`, M2 `snow_melt`, M3 `den_maker`; stalk: M1 `patient_stalker`, M2 `second_lunge` |
| mw03 | member, young scarred tom | endurance: M1 `night_walk`, M2 `second_wind`; trailReading: M1 `scent_history` |
| mw04 | member | stalk: M1 `patient_stalker`, M2 `dusk_hunter`; preySense: M1 `prey_map`, M2 `small_game` |
| mw05 | member, hunter | stalk: M1 `ambush`, M2 `second_lunge`; trailReading: M1 `scent_history`, M2 `shortcut` |
| mw06 | member | grooming: M1 `gentle_approach`; preySense: M1 `prey_map` |
| mw07 | elder, wise-cat | hardiness: M1 `herb_chewer`, M2 `stoic`, M3 `healer`, M4 `long_life`; grooming: M1 `generous`, M2 `bond_maker`, M3 `soothe`; trailReading: M1 `seek`, M2 `read_affinity`, M3 `exile_friend` |
| mw08 | adolescent (Longshadow's) | stalk: M1 `patient_stalker` |
| mw09 | cub | none (cub) |
| ln01 | "Greymantle", elder | leadership: M1 `eat_last`, M2 `rally`, M3 `heir_trainer`, M4 `kingmaker` (v0.3.5); thickCoat: M1 `winter_coat`, M2 `snow_melt`, M3 `den_maker`, M4 `warm_keeper`; trailReading: M1 `scent_history`, M2 `read_affinity`, M3 `exile_friend` |
| ln02 | "Sorrel", young adult | charm: M1 `first_impression`, M2 `constant`; stalk: M1 `ambush` |
| ln03 | "Torncheek" | saberStrike: M1 `first_strike`, M2 `fury`, M3 `duelist`, M4 `killing_bite`; intimidate: M1 `roar`, M2 `bully`, M3 `banish`; guard: M1 `roll_with_it`, M2 `fight_through`, M3 `last_stand` |
| ln04 | "Nettle" | guard: M1 `roll_with_it`, M2 `fight_through`, M3 `bodyguard`; stalk: M1 `patient_stalker`, M2 `second_lunge`, M3 `cache_kill`; saberStrike: M1 `feint`, M2 `fury` |
| ln05 | "Duskrunner", young adult | endurance: M1 `night_walk`, M2 `second_wind`; trailReading: M1 `seek`, M2 `shortcut` (v0.3.5) |
| ln06 | "Lichen", elder | hardiness: M1 `herb_chewer`, M2 `stoic`, M3 `healer`, M4 `long_life`; grooming: M1 `gentle_approach`, M2 `peacemaker`, M3 `soothe`; preySense: M1 `prey_map`, M2 `small_game`, M3 `water_finder` (v0.3.5) |
| ln07 | "Ashfall" | thickCoat: M1 `snow_sleeper`, M2 `snow_melt`, M3 `blizzard_walker`; endurance: M1 `long_stride`, M2 `second_wind`, M3 `long_patrol`; stalk: M1 `patient_stalker`, M2 `second_lunge` |
| ln08 | "Sedge" | stalk: M1 `patient_stalker`, M2 `second_lunge`; preySense: M1 `prey_map`, M2 `small_game` |
| ln09 | "Coldwater" | endurance: M1 `night_walk` (v0.3.5), M2 `second_wind`; grooming: M1 `gentle_approach` |
2.4 **Static checks (verified by hand on this table, v0.2):**
   - **Birth seasons:** every age is 0 or 3 mod 4 (spring or summer births only).
     - Cubs: 0 and 3.
     - Adolescents: 7 and 8.
     - Loner ages: 52, 15, 28, 32, 16, 48, 27, 24, 20.
   - **Stages:** these all match lifecycle §2. The elders are hc08 51, bf07 44, mw07 55, ln01 52 and ln06 48.
   - **Fertility at birth:** every parent was 12 or older at their cub's birth and within its fertile window (F ≤ 44, M ≤ 48).
     - hc01 was 20 at hc02's birth and 28 at hc09's.
     - hc03 was 23 and 31 for those two births.
     - hc02 was 13 at hc10's birth and 16 at hc11's.
     - hc06 was 17 and 20 for those two births.
     - bf01 was 25 at bf08's birth and 29 at bf09's.
     - bf04 was 21 and 25 for those two births.
     - bf05 was 23 at bf10's birth.
     - mw01 was 31 at mw08's birth.
     - mw02 was 36 at mw09's birth and mw04 was 27.
     - **v0.3.5 kin links:**
       - hc07 (F) was 16 at ln02's birth. ln02 is 15, born in summer, ≡ 3 mod 4 ✓.
       - The hidden sires `off_longshadow` (ln09 20, mw08 8) and `off_bf_sire` (ln03 28, ln05 16) are off-roster. Their birth spans of 12 seasons fit any sire who was 12–36 at the older cub's birth ✓.
   - **Kinship (v0.3.5):**
     - hc07–ln02 r = 0.5 (dam/daughter).
     - ln09–mw08 r = 0.25 (half-brothers via `off_longshadow`).
     - ln03–ln05 r = 0.25 (half-brothers via `off_bf_sire`).
     - All three pairs are now blocked by the incest gate (relationships §1.7). No fixed mate pair is affected.
   - **Mates:**
     - All mated pairs are currently fertile, with an age gap of 16 seasons or less: hc01–hc03 (3), hc02–hc06 (4), bf01–bf04 (4), mw02–mw04 (9).
     - No mated pair shares a parent, so r = 0 and there's no incest.
     - mateId is symmetric.
   - **Breeding floor** (≥ 2 breeding-age M and ≥ 3 breeding-age F): HC 3 M / 4 F, BF 4 M / 4 F, MW 2 M / 4 F. It holds.
   - **Loners:**
     - 5 M / 4 F, origins 2/3/4.
     - 2 young adults: ln02 (15) and ln05 (16). This differs from loners-spec §1.3's "both male" suggestion in v0.1, because it follows Saga's data.
2.5 **Mate guarantee, either player sex (static, holds):** each pride needs ≥ 2 fertile adults of the opposite sex, with ≥ 1 of them unmated and not the leader. The loners need ≥ 1.

| Group | Male player: fertile F (unmated, non-leader) | Female player: fertile M (unmated, non-leader) |
|---|---|---|
| Highcrag | hc01, hc05, hc06, hc07 (hc05, hc07) ✓ | hc02, hc03, hc04 (hc04) ✓ |
| Bonefield | bf04, bf05, bf06 (bf05, bf06) ✓ | bf01, bf02, bf03, bf07 (bf02, bf03, bf07) ✓ |
| Mistwood | mw04, mw05, mw06 (mw05, mw06) ✓ | mw02, mw03 (mw03) ✓ |
| Loners | ln02, ln04, ln08 ✓ (ln06 is 48, past fertility) | ln03, ln05, ln07, ln09 ✓ (ln01 is 52, past fertility) |

   Mistwood is the tight case for a female player: exactly 2 fertile toms, one of them unmated. That fits the lore ("few, scarred, not gone"). Any edit to the table must re-pass §2.4–2.5 in the unit test (§11.4).

## 3. Names (Anna: re-rolled every run)
3.1 Source: `src/renderer/data/names/names.json` (Saga; schema in the README beside it). It holds `male` 200, `female` 200 and `either` 260 full names, `prefixes` 83 and `suffixes` 78 (about 5,800 compounds), `reserved` 69, `blocklist` 243, `maxLength` 11, and optional `prefixLean`/`suffixLean`.
3.2 **Used set:** the lowercased `reserved` list plus `mainCat.name`. Every given name is added to it. No two cats in a run share a name (case-insensitive, trimmed).
3.3 **Pick** (slotId order): a whole name with p = `names.wholeRatio` (0.70), drawn from the cat's sex list plus `either`, weighted by list size. Otherwise a compound.
3.4 **Compound** = prefix + lowercase suffix ("Frost" + "jaw" → "Frostjaw"). Skip a part whose lean is the opposite sex. Reject and redraw when:
   - the length is outside 3..`maxLength` (11);
   - the prefix's last letter is the suffix's first letter;
   - one part contains the other;
   - the result matches the blocklist or the used set (case-insensitive).
3.5 **Fallback:** after 50 failed draws, switch methods. After 50 more, log an error and use the slot's role default (`Cat-<slotId>`). With about 6,400 candidates for 39 cats, this should never fire (§11.2).
3.6 Saga's role names (Ashmane, Torncheek…) are in `reserved`, so they never appear as random names. They survive only as role labels in Saga's templates (§8).

## 4. Coats (Anna: all loci re-rolled every run, including eyes, sabers and white)
4.1 **Founders** (every slot whose sire and dam are both "off") roll each locus as 2 independent draws from genetics-spec §1 frequencies (tunable `worldgen.alleleFreq`):
   - coat: tawny .30, sandy .25, greydun .25, russet .12, melan .04, leuc .04
   - dilute: D .75, d .25
   - marking: plain .40, spotted .25, faintstripe .17, rosette .10, barred .08 (genetics v0.4)
   - dorsal: ds .988, Ds .012
   - intensity: I+ .5, I- .5
   - white: none .735, socks .15, blaze .10, piebald .015
   - eyes: amber .40, gold .25, green .17, copper .10, blue .08
   - saber: ivory .70, creamy .22, stained .08
   - `het`: Het .88, het .12 (genetics v0.3 §1.8). It's rolled **after** all loci above, from the separate `het` stream, for founders and hidden off-parents. When a cat is het/het, `eyeRight` is rolled from the same stream per genetics §2.5. Kin inherit `het` Mendelian, and their mutation and eyeRight draws also use the `het` stream, so the existing `genes` stream sequence is unchanged.
   - **Undercoat and markings loci (genetics v0.4):** `under`, `underInt`, `tick`, `points`, `mask`, `tear`, and `barred` within `marking` (retuned frequencies per genetics v0.4 §1.3). The new loci are rolled from a separate **`markings` stream**, after `het`, so the `genes` and `het` sequences are unchanged. Note: the `marking` retune itself changes body-pattern outcomes for the same seed, because it uses the same `genes` draws with new cut-offs. That's the only non-reproducing change.
4.2 **Pride founder bias** (×, then renormalize; loners use the base table):
   - Highcrag: greydun ×2, d ×2.
   - Bonefield: russet ×2, I+ ×1.5.
   - Mistwood: melan ×2, faintstripe ×2.
4.3 **Kin** (any slot with a sire or dam slot) are bred from the parents' rolled genotypes via genetics §3.1–3.3: Mendelian, with 0.5% mutation (heterochromia is now the inherited `het` locus, genetics v0.3 §2.5). Where one parent is "off" (bf10, mw08), the missing parent is rolled as a hidden founder from the pride table and isn't stored as a cat.
4.4 Scars are not genetic. They're fixed per slot (§2.1, **Director**) and drawn on the scar layer every run. Ids come from Ochre's scar set v0.1 (`docs/art/scars.md`: 12 ids, `scar_<id>.png`, drawn under lineart, untinted). Loner scars were mapped to those ids: forelegs_both/forelegs_crossed → forelegs, flank_long → flank, ear_right → ear_notch_right.

## 5. Personality (Anna via Director, 2026-11-04: fully random)
5.1 **Founders** (sire and dam both "off") roll each trait as round_half_up(clamp(Normal(50, 15), 5, 95)) (matches genetics-spec §4.4) from the `personality` stream.
5.2 **Kin** use genetics §4.2: the parents' average + Normal(0, 8), clamped and rounded. Where one parent is "off", that parent is rolled as a hidden founder, as in §4.3. The table's "narrative lean" column is Saga's flavour only and is never applied; narration must read the rolled values (§12.2).
5.3 `prideLoyalty` (loners-spec §3.4): pride cats get 70 + (loyalty − 50) × 0.2, from the final loyalty, clamped 0–100. Loners get null.

5.4 **Attraction** (relationships-spec §1.8, Anna via Director): each slot rolls `opposite` 85% / `either` 10% / `same` 5% from the `attraction` stream in slotId order. Slots with a fixed mate and the §2.5 mate-guarantee candidates turn a `same` roll into `either`, so §2.5 still holds for both player sexes. It's a hidden per-cat field.
## 6. Ages and kinship (static)
6.1 `birthSeason` is counted back from run start (spring, Year 1) per lifecycle §1.3:
   - age ≡ 0 mod 4: spring of year 1 − age/4.
   - age ≡ 3 mod 4: summer of year 1 − (age + 1)/4.
6.2 Sire, dam and mate links are fixed per slot (**Director**). They're mapped to the run's `catId`s at generation. "off" parents are stored as `null`, plus a lore note in Saga's template (e.g. Longshadow).
6.3 **Loner kin links (v0.3.5, Director-approved):**
   - ln02's dam is hc07.
   - ln09 and mw08 share the hidden sire `off_longshadow` (Longshadow, dead).
   - ln03 and ln05 share the hidden sire `off_bf_sire`.

   A hidden `off_*` id is one founder genotype, rolled once per run (from its pride table, §4.3) and shared by its cubs. It's not stored as a cat, but kinship (genetics §5) counts it, so r is right. Other story links (Thistle and Tallgrass, Greymantle's secret) stay narrative only.
6.4 **Seeded history `seedFlags` (v0.3.6, merged format).** An optional per-slot list, stored on the **holder** slot:
`{ "holder": "ln03", "target": "bf01", "kind": "grudge|rivalry|crush|admiration|friendship|none", "mutual": bool, "value": int|null, "note": "..." }`
   - **`kind`:** `none` means a value-only entry (it replaces v0.3.5's `seedValues`).
   - **`value`:** if set, it's the pair's start value. It overrides the relationships §1.5 random seed, but it's always clamped to any floor (family ≥ +10, mates ≥ +20). If null, the kind's own seed rule applies.
   - **When they apply:** at world gen, after kin and mate seeds, in table order.
   - **Gates (relationships §1.5–1.8):**
     - Grudges, rivalries and value-only entries **always seed**, after the age and kinship gates.
     - A `crush` seeds only if that run's attraction roll makes the pair compatible; otherwise it's dropped silently.
     - `admiration` must meet its §1.4 entry rule.
     - A failed gate drops the entry and logs it. It never throws.

| # | Holder → target | kind | value | Note | Gates (static) |
|---|---|---|---|---|---|
| 1 | ln03 Torncheek ↔ bf01 Scarjaw | grudge (mutual) | −55 | The lost challenge, held on both sides. | adults, r 0 ✓ |
| 2 | ln04 Nettle → bf01 Scarjaw | grudge | −35 | The cub-killing law. | adults, r 0 ✓ |
| 3 | ln01 Greymantle → hc01 Ashmane | grudge | −35 | Exiled by Ashmane. | elder + adult, r 0 ✓ |
| 4 | ln01 Greymantle ↔ every other Highcrag adult/elder | none | +25 | Still warm toward his old pride. | adults/elders ✓ |
| 5 | mw01 Hollowsong ↔ ln07 Ashfall | none | −25 | Hollowsong exiled Ashfall; the guilt is Ashfall's (Reedsong secret); Saga confirmed. | adults, r 0 ✓ |
| 6 | ln02 Sorrel ↔ hc01 Ashmane | none | −25 | Refused her mate. | adults, r 0 ✓ |
| 7 | ln02 Sorrel ↔ hc07 (her dam) | none | +10 | Also refused her mate. Held at the family floor, with the strain in text only. | family floor holds |
| 8 | ln02 Sorrel ↔ bf02 Redthroat | crush (mutual) | +30 | Seeds only if both attraction rolls are compatible; otherwise `none` at +25 (warm). | adults (15, 20), r 0 ✓; attraction per run |
| 9 | ln02 Sorrel ↔ ln05 Duskrunner | friendship | +35 | Old friends. | adults, r 0 ✓ |
| 10 | ln03 Torncheek ↔ ln07 Ashfall | none | +25 | Band partners. | adults, r 0 ✓ |
| 11 | ln09 Coldwater ↔ ln05 Duskrunner | none | +25 | Band partners. | adults, r 0 ✓ |

   **Sources:**
   - Entries 1, 3 and 4 follow Director's and Saga's rulings.
   - Entries 2 and 5–10 come from `lore/loners.md` "Narrative relationships". Their values are my calls inside the bands Saga's text implies.

## 7. State init
7.1 Needs per needs-spec at full: Health, Hunger, Thirst, Energy and Warmth all 100. Contentment is 60 for pride cats, 50 for loners and 40 for exiles.
7.2 `affinityToPlayer` and `prideAffinity` follow loners-spec §2.4–2.5. `isRival` is set when final aggression ≥ 70. `bandId` is null.
7.3 Loner `homeZones` come from loners.json per slot (fixed). Territories are unchanged from lore.

## 8. Fixed vs random per trait
| Trait | Per run | Source |
|---|---|---|
| Slot count and pride sizes (11/10/9 + 9) | fixed | Anna (loners-spec §1) |
| Age (`ageSeasons`, exact) | fixed | Anna |
| Skills (XP ≤ milestone 4, fixed perks per milestone, branch aptitude) | fixed | Anna |
| Coat genetics, all loci (coat, dilute, marking, dorsal, intensity, white, eyes, saber, het + eyeRight) | random | Anna |
| Name | random | Anna |
| Sex | fixed | Director |
| Pride / loner status, origin, departure | fixed | Director |
| Role (leader, mate, hunter, elder…) | fixed | Director |
| Kin structure (sire, dam, mate slots) | fixed | Director |
| Kin genotypes | bred from parents' rolled genes | Director (follows from Anna) |
| Scars | fixed (Saga's lore scars) | Director |
| Personality | random (founders rolled, kin inherited) | Anna (via Director, 2026-11-04) |
| `prideLoyalty` | formula from final loyalty | loners-spec §3.4 |
| Backstory, secrets, sample lines, home zones | fixed | Director (Saga's templates) |

8.1 **Impact on Saga:** her character sheets become **slot templates** keyed by slotId. The backstory and secrets are fixed. Any look or name in the text becomes a token: `{name}`, `{coat}`, `{eyes}`, `{sabers}`, `{markings}`. A phrase like "silver-maned" or "red-gold russet" can't stay literal. The storyteller memory keys on slotId + catId. Phenotype words for the tokens come from genetics §2 tints (Saga's player-facing names).

## 9. Data output
9.1 Cat record:
```json
{ "catId": "c_0f3a91", "slotId": "hc01", "name": "Frostjaw", "sex": "female",
  "ageSeasons": 36, "birthSeason": {"year": -8, "season": "spring"},
  "genes": { "v": 1, "loci": { "coat": ["greydun","sandy"], "...": [] }, "eyeRight": null,
             "personality": {"aggression":47,"sociability":38,"boldness":66,"loyalty":72,"curiosity":41} },
  "skills": {"leadership": 1000, "persuasion": 600, "stalk": 300}, "aptitude": {"social": 110},
  "perks": {"leadership": ["eat_last","rally","heir_trainer","legacy_rally"], "persuasion": ["read_mood","calm_words","envoy"], "stalk": ["patient_stalker","second_lunge"]},
  "scars": [], "status": "pride", "prideId": "highcrag", "role": "leader",
  "sireId": null, "damId": null, "mateId": "c_77b2c0",
  "prideLoyalty": 74, "originPrideId": null, "departure": null, "homeZones": [],
  "affinityToPlayer": 0, "prideAffinity": {}, "isRival": false, "bandId": null,
  "needs": {"health":100,"hunger":100,"thirst":100,"energy":100,"warmth":100}, "contentment": 60,
  "flags": {"generated": true, "frail": false}, "seedFlags": [] }
```
   `lifeStage` is derived (lifecycle §2.5). The `catId` is "c_" + 6 hex from the `names` stream.
9.2 Static data lives in `src/renderer/data/worldgen.slots.json` (one record per §2.1 row) plus `worldgen.json` (tunables). `run.json` gains `worldSeed` and `worldGenVersion` ("0.3.6").
9.3 Event: `world:generated {worldSeed, worldGenVersion, catIds[39], warnings[]}`.

## 10. Tunables (`worldgen.json`)
| Key | Default |
|---|---|
| names.wholeRatio | 0.70 |
| names.length | 3..`maxLength` from names.json (11) |
| names.maxDraws | 50 + 50 |
| alleleFreq / prideBias | §4.1 / §4.2 |
| personality.founder / kinSd | Normal(50, 15) clamp 5–95 / 8 (kin clamp 0–100) |
| contentment.pride / loner / exile | 60 / 50 / 40 |
| slot table | `worldgen.slots.json` (static, not a tunable at runtime) |

## 11. Test checklist (Tracker)
1. **Same seed → same cats:** 100 seeds × 2 runs give byte-identical roster JSON.
2. **Names:** over 1,000 seeds there are no duplicates in any run (case-insensitive, including `mainCat.name`), no `reserved` or blocklist hits, every length is 3–11, and there are zero `Cat-<slotId>` fallbacks.
3. **Static fields identical across different seeds:** slotId, sex, pride/status, role, ageSeasons, birthSeason, sire/dam/mate slots, skills, perks, aptitude, scars, homeZones.
4. **Static table unit test:** §2.4–2.5 checks (counts, mod-4 ages, fertility at birth, mate rules, breeding floor, mate guarantee for both player sexes) all pass.
5. **Coats and names differ across seeds:** over 100 seed pairs, ≥ 95% of slots differ in at least one locus or phenotype, and ≥ 95% have a different name.
6. **Allele frequencies:** over 10,000 founder rolls, frequencies are within ±1.5 points of §4.1 × bias (rare alleles within ±0.5).
7. **Kin validity:** every kin allele comes from a parent's genotype (or is a logged mutation, about 0.5% per locus).
8. **Personality:** all ints are 0–100; founder means are ~50 (sd ~15) over 10k cats; kin are within 24 of the parent average; personalities differ across seeds; `prideLoyalty` matches §5.3; loners are null.
9. Generation takes < 200 ms, and `world:generated` fires once.

## 12. Open questions
12.1 (Saga) Confirm the slot table: ages, roles, skill blocks and scars (§2.1). Also confirm that the young-adult loners are ln02 + ln05, per your data.
12.2 (Saga) Convert the sheets to slot templates with `{name}`/`{coat}` tokens (§8.1), and make trait-dependent lines read rolled personality, e.g. "Torncheek" may roll low aggression. Also update the names README line "The 39 premade cats keep their authored names", which Anna's decision changes.
12.3 ~~Clamp alignment~~ CLOSED (Tundra call): founders clamp 5–95 as in genetics-spec §4.4, and kin clamp 0–100 as in genetics §4.2.

## Changelog
- v0.3.6 (2026-11-05, Tundra): `seedFlags` merged format (holder/target/kind/value/note; `kind: none` = value-only, replacing `seedValues`) with 10 entries (§6.4). Entry 4 note per Saga. Static gate checks: all 10 pass. Entry 2 is attraction-dependent per run. Backup: `world-gen-spec.v0.3.5.bak.md`.
- v0.3.5 (2026-11-05, Tundra; Saga's lore review + Director's rulings):
  - bf07 is recast as Tallgrass's old guard. Mechanics are unchanged, and his perks were checked: none assumes a lost challenge, so all are kept.
  - Perk swaps, each at the same skill and milestone: ln01 `legacy_rally` → `kingmaker` (M4 leadership), hc08 `exile_friend` → `rumor_web`, ln09 `long_stride` → `night_walk`, ln06 `scout` → `water_finder`, ln05 `read_affinity` → `shortcut`.
  - Kin links are approved and final: ln02 dam hc07; `off_longshadow` sire of ln09 + mw08; `off_bf_sire` sire of ln03 + ln05. Static checks re-run and they pass.
  - Added `seedFlags` (§6.4), with the first entry Torncheek → Scarjaw grudge.
  - Added `seedValues` (§6.5): Hollowsong ↔ Ashfall −25, no kind (Ashfall's guilt). Sorrel ↔ hc07 sits at the +10 family floor with the strain in text only, and the floor has no exception.
  - Perks were authored once from lean; no runtime rule reads lean.
  - The old v0.3.1 changelog wording "ex-leader" for ln01 should read "ex-counselor".
  - Backup: `world-gen-spec.v0.3.4.bak.md`.
- v0.3.4 (2026-11-05, Tundra): references genetics v0.4 for the undercoat and markings loci, on a new `markings` stream after `het`. The marking retune changes body patterns for old seeds; everything else reproduces. `worldGenVersion` is now "0.3.4". Backup: `world-gen-spec.v0.3.3.bak.md`.
- v0.3.3 (2026-11-04, Tundra): founders also roll the `het` locus (Het .88 / het .12, genetics v0.3), plus `eyeRight` when het/het. These draws come from a **new `het` sub-stream**, run after all existing loci, so every v0.3.2 draw (names, genes, personality, attraction) reproduces exactly for the same seed. Only the het/eyeRight values are new. `worldGenVersion` is now "0.3.3". Backup: `world-gen-spec.v0.3.2.bak.md`.
- v0.3.1 (2026-11-04, Tundra): skills follow skills-spec v0.2 (Anna via Director: milestones with perk picks). Each slot's rank-based skill block is now milestones plus fixed perk ids per milestone (§2.3, new §2.3a), chosen with the skills-spec §8.4 weights from each slot's narrative lean and role-checked (hc01 takes `envoy`, not `lure`). Cubs have none; no slot is past milestone 4. Loner ex-leader ln01 keeps pride perks (`heir_trainer`, `legacy_rally`) for story; they do nothing while he's a loner. §9.1 adds `perks`; §8 and test 3 include perks. Backup: `world-gen-spec.v0.3.bak.md`.
- v0.3 (2026-11-04, Tundra):
  - Personality is now fully random (Anna via Director): founders roll Normal(50, 15) and kin inherit.
  - The seed box is a collapsed Advanced option in every Style, with `menu:newGame.worldSeed` (Director, logged in main-menu-spec v1.4.2).
  - Fixed sex, pride, role, kin links and scars are Director-approved.
  - Scars now use Ochre's scars.md v0.1 ids.
  - §12 is trimmed.
  - Backup: `world-gen-spec.v0.2.bak.md`.
- v0.2 (2026-11-04, Tundra): Anna's decision applied. There are now 39 fixed slots with a static 39-row table (§2), with exact age and skills fixed and coats and names random. The roster stream and reroll loop are removed. The mate guarantee is now a static check, verified for both player sexes. §8 is now a fixed-vs-random table. Personality is OPEN with A/B/C. Names use the live names.json (maxLength 11, leans). Scars are fixed per slot. Tests updated.
- v0.1 (2026-11-04, Tundra): first draft (random roster templates). Backup: `world-gen-spec.v0.1.bak.md`.
- v0.3.2 (2026-11-04, Tundra): added the `attraction` stream and §5.4 (relationships v0.1.2). Existing streams are unchanged, so names, genes and personality from v0.3.1 still reproduce for the same seed.
- v0.3.6a (2026-11-05, Tundra): the §6.4 table is replaced with Saga's actual list (11 rows). The earlier reconstructed rows came from loners.md, not from Saga, and are gone. `friendship` is added as a seedable kind. Values: mutual grudge −55, one-sided grudge −35, cold −25, warm +25, friendship +35, crush +30 (falls back to warm).
