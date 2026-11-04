# Sabretooth: Needs Spec (v0.1, DRAFT, design-only, no build until frozen)
Owner: Tundra (rules and numbers). Need names, HUD labels and status text: Saga. HUD icons: Ochre. Code: Flint (after freeze).
Asked for by Anna via Director, 2026-11-04 (survival-sim needs like Lioden and WolfQuest). All numbers are first-pass and tunable.
Related: play-styles-spec v0.2 §2 (hunger drain, starvation, injury), lifecycle-spec v0.1 (stages, natural death), loners-spec §6.4 (contentment), main-menu-spec §7 (Sandbox needs drain).

## 0. Ground rules
0.1 **Time:** 1 turn = 1 day. A season is 20 days, locked: Anna confirmed it via Director on 2026-11-04 (`daysPerSeason`, also in lifecycle-spec). Needs tick at the end of each day.
0.2 **Scale:** every need is stored as an **integer** 0–100, per cat in the save, and **higher is always better** (Hunger 100 = full, Warmth 100 = warm). The HUD then reads the same way for every bar. Saga can label a bar something like "Fullness" if that reads better.
0.3 **Who has needs:** in v0.1 the player cat has all of them. Pride cats and loners track Health, injuries and illness only. Food for them is the pride food store in Standard, and per-cat hunger in Sim (play-styles §3.3). Other NPC needs are abstracted into contentment.
0.4 **Each day** the player takes **one main action**: hunt, rest, drink, shelter, groom or socialise, travel, patrol, or an event choice. Some restores come free with travel (§2.3).

## 1. Needs at a glance (Standard values)
| # | Need | Base decay per day | Main restores | Low (< 25) | Empty (0) |
|---|---|---|---|---|---|
| 1.1 | **Health** | none (damage only) | +5/day when Hunger, Thirst and Warmth are all ≥ 50 and there's no untreated injury; +10 instead on a rest day | warning on the HUD; hunt −10, fight strength ×0.8 | death, then the Death rule applies |
| 1.2 | **Hunger** | −12 | eat: small prey +25, medium +50, a large-kill share +80 | **Hungry**: hunt −5, Energy restores halved | **Starving** per play-styles §2.2: Story only weakened (Energy capped at 50); Standard −10 Health/day from day 3; Sim −15 Health/day from day 2 |
| 1.3 | **Thirst** | −20 | drink at water +100 (one action, or free when travelling through a water zone); eat snow +40 at −10 Warmth when water is frozen | **Thirsty**: Energy restores halved | **Parched**: Story Energy capped at 50; Standard −10 Health/day from day 1; Sim −15/day |
| 1.4 | **Energy** | spent by actions: hunt −30, fight −30, travel −15, patrol −15, socialise −5 | rest action +40; the overnight tick +25 | **Tired**: can't start a hunt or a fight | **Exhausted**: the next day is a forced rest |
| 1.5 | **Warmth** | by season: spring −5, summer 0, autumn −10, winter −20; blizzard day a further −15 | shelter/den rest +30; huddling with pride members +10 per adjacent cat, max +30, overnight; eating +5 | **Chilled**: Energy restores halved; illness chance ×2 | **Freezing**: Story Chilled only; Standard −10 Health/day; Sim −15/day |
| 1.6 | **Mood** | no decay; it equals the player cat's contentment (loners-spec §6.4 inputs, applied to the player) | groom/socialise +5, mate or close bond +10, successful hunt +5, being fed +10/season | **Low**: hunt −5, affinity gains ×0.8 | no extra effect (floor) |
| | | | | **High (≥ 75)**: hunt +5, affinity gains ×1.2 | |

1.6a **Named thresholds** (the save, the HUD and event triggers all use these ids):

| State id | Range | Notes |
|---|---|---|
| `ok` | 50–100 | normal |
| `low` | 25–49 | HUD warning |
| `critical` | 1–24 | the "Low (< 25)" effects in §1 apply |
| `empty` | 0 | the "Empty (0)" effects in §1 apply |

   Mood uses `low` (< 25), `normal` (25–74) and `high` (≥ 75). The exported helper is `needState(value) → id`, with the cut-offs in `needs.json` `thresholds`.
1.7 Lows don't stack beyond what's listed. Two "Energy restores halved" effects still halve it only once.

## 2. Injury and illness (status chips, not bars)
2.1 **Injury tiers** (from hunts, fights and hazards; chance scaled by play-styles §2.3):

| Tier | Health hit | Effect while active | Heal time (Standard days) |
|---|---|---|---|
| Minor | −10 | hunt −5 | 3 |
| Serious | −25 | hunt −15, fight ×0.7, travel costs 25 Energy | 10 |
| Crippling | −40 | can't hunt or fight; travel costs 30 Energy | 25 |

   Heal time is multiplied by play-styles §2.4 (Story ×0.5, Sim ×1.5). In Sim there's also a 10% chance per serious or crippling injury of infection (it becomes an illness) or a lasting scar or limp. Resting halves the remaining heal time for that day, so 2 days of healing pass instead of 1. A healed injury may leave a scar per Ochre's scar set.
2.2 **Illness:** each day, a base 1% chance when any of Hunger, Thirst or Warmth is below 25. That's ×2 if two of them are low, ×2 when Chilled, and ×2 for elders (§4). An ill cat has −5 Health per day and Energy restores halved for 5 days (×play-styles §2.4). Resting shortens it by 1 day each time. Story: illness never deals damage below 30 Health.
2.3 Neither tier stacks with itself: a second injury of the same tier raises it one tier instead.

## 3. Style scaling
3.1 **Needs drain multiplier** (applies to Hunger, Thirst and Warmth decay, plus action Energy costs): Story ×0.6, Standard ×1.0, Sim ×1.3. This is the same value as play-styles §2.1, which is now the general needs drain.
3.1a **Thirst by Style (Anna, 2026-11-04):** Thirst is **off in Story** and on in Standard and Sim. When it's off, Thirst doesn't decay. It counts as 100 for every check, including Health regen, illness and Thirsty, and the HUD shows four bars, with Thirst hidden. The drink action stays available as flavour with no stat effect. The setting is locked per run with Style.
3.2 **Sandbox needs drain** multiplies on top of it (main-menu-spec §7): off ×0 (needs never decay, though injuries still happen), low ×0.5, normal ×1.0.
3.3 **Damage at empty:** see §1. Story never takes Health damage from needs, only caps on Energy. In Story the player cat can't die from needs alone.
3.4 **Restores** are the same in every Style. Harshness comes from decay and damage, not from slower recovery.

## 4. Age stage modifiers (lifecycle-spec §2)
| Stage | Hunger decay | Thirst decay | Warmth decay | Energy costs | Health regen | Illness chance |
|---|---|---|---|---|---|---|
| Cub | ×0.7 (nursing fills it to 100 while the mother's Hunger is ≥ 50; after weaning at 2 seasons, pride food) | ×0.7 | ×1.5 | n/a (no actions) | ×1.0 | ×1.5 |
| Adolescent | ×1.2 (growing) | ×1.0 | ×1.0 | ×0.9 | ×1.2 | ×1.0 |
| Adult | ×1.0 | ×1.0 | ×1.0 | ×1.0 | ×1.0 | ×1.0 |
| Elder | ×0.9 | ×1.0 | ×1.3 | ×1.25 | ×0.5 | ×2.0 |

4.1 The player cat is never a cub. A player heir can be an adolescent (main-menu-spec §7), so the adolescent row applies to the player.

## 5. HUD (readability)
5.1 Five bars, in a fixed order: **Health, Hunger, Thirst, Energy, Warmth**. Mood is a single face/icon state (low, normal, high), not a bar. Injury and illness show as status chips under the bars, with the days left shown.
5.2 Bar states: ≥ 50 normal; 25–49 warning; < 25 critical (pulse, unless Reduced Motion is on); 0 empty (icon outline). Each state must be distinguishable without colour (icon or pattern), for colour-blind players.
5.3 Hover or focus on a bar shows its value, the day's expected change, and the active effects in one line each (Saga's text).
5.4 At most one "need" notification per day: the most severe newly crossed threshold. This avoids spam.
5.5 Ochre: one small icon per need (5 bars, Mood in 3 states, and an injury chip and an illness chip), readable at 24 px.

## 6. Data
6.1 Cat (player): `needs: { health, hunger, thirst, energy, warmth }` as integers 0–100, plus `mood` derived from contentment. `injuries: [{ tier, daysLeft, sourceEventId }]`, `illness: { daysLeft } | null`, and counters for starvation and freezing days.
6.2 Pride and loner NPCs: `health`, `injuries[]`, `illness`. Sim adds `hunger` per cat.
6.3 New run: the player starts with every need at 80, Health 100, and no injuries.

## 7. Tunables (`needs.json`, Style multipliers stay in `styles.json`)
| Key | Default |
|---|---|
| daysPerSeason | 20 |
| decay.hunger / thirst | 12 / 20 |
| decay.warmth (spring/summer/autumn/winter/blizzardExtra) | 5 / 0 / 10 / 20 / 15 |
| energy.cost (hunt/fight/travel/patrol/socialise) | 30 / 30 / 15 / 15 / 5 |
| energy.rest / overnight | 40 / 25 |
| eat (small/medium/largeShare) | 25 / 50 / 80 |
| drink / snow (warmth cost) | 100 / 40 (−10) |
| warmth.shelter / huddlePerCat / huddleMax / eat | 30 / 10 / 30 / 5 |
| health.regen / restRegen | 5 / 10 |
| damageAtEmpty (Standard / Sim) | 10 / 15 per day |
| starvation grace days (Standard / Sim) | 3 / 2 |
| thresholds (critical below / low below / mood high from) | 25 / 50 / 75 |
| illness.base / days / damagePerDay | 1% / 5 / 5 |
| injury.health (minor/serious/crippling) | 10 / 25 / 40 |
| injury.days (minor/serious/crippling) | 3 / 10 / 25 |
| start.needs / start.health | 80 / 100 |

## 8. Open for Director
8.1 ~~Is 20 days per season the right pacing?~~ ANSWERED (Anna via Director, 2026-11-04): 20 days per season, locked.
8.2 ~~Should Thirst exist in Story?~~ ANSWERED (Anna via Director, 2026-11-04): off in Story, on in Standard and Sim. See §3.1a.
- 2026-11-04: daysPerSeason = 20 locked (Anna via Director); §8.1 closed.
- 2026-11-04: Thirst off in Story (§3.1a), on in Standard/Sim (Anna via Director); §8.2 closed.
