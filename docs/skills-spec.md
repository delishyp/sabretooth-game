# Sabretooth: Skills Spec (v0.2.3, DRAFT, design-only, no build until frozen)
Owner: Tundra (rules and numbers). Skill and perk names, flavour text and skill-screen copy: Saga. HUD, skill-screen and perk-card icons: Ochre. Code: Flint (after freeze).
Asked for by Anna via Director, 2026-11-04. **Anna decided (v0.2):** each skill has its own XP bar filled by use, and its ranks are **milestones** where the player **picks one perk from 2–3 options**. Perks are distinct effects (new actions, rule changes, situational triggers, once-per-season abilities, tradeoffs), not bigger numbers. All numbers are first-pass and tunable.
Related: needs-spec v0.1 (incl. §3.1a Thirst off in Story), play-styles-spec v0.2 §2–§3, lifecycle-spec v0.1 §2–§4, genetics-spec §4, loners-spec v0.8 (§2.4, §3, §4, §5, §5b, §6.4, §10), cat-creator-spec v0.2 (no change needed), main-menu-spec §7 (Heir, Sandbox), world-gen-spec v0.3.1 (§2.3 slot perks).

## 0. Ground rules
0.1 **Learn by doing.** XP comes only from actions the cat takes (§3). There are no points to spend; the only choice is which perk to take at each milestone.
0.2 **Six branches, three skills each, 18 skills.** Each skill has **4 milestones** (§9). At each milestone the cat gets a small **baseline gain** (§2) automatically, and the player **picks one perk** from 2 options.
0.3 **Every baseline modifies one named roll or value** from another spec. Perks add actions, change rules, or trigger in situations, always citing the rule they touch. Where a target roll has no formula yet, the bonus adds flat points to that future roll (§15.1).
0.4 **No perk removes a need or a Style rule.** Perks may shift a threshold, a cost or a chance, but every need still decays and every Style rule (death chance, starvation, injury scaling, Thirst off in Story) still applies. Perks that touch death or succession are marked **⚑** with the Permadeath and Heir interaction.
0.5 **Integers only** in the save (§13). Percent effects are applied as multipliers and rounded half up at the end of the roll.
0.6 **Thirst in Story** (needs §3.1a): any perk with a Thirst part lists a Story substitute, so no option is dead in Story.

## 1. Branches at a glance
| # | Branch (id) | Personality trait that speeds XP (§4) | What it's for |
|---|---|---|---|
| 1.1 | Hunting (`hunting`) | `boldness` | Landing kills and spending less Energy doing it |
| 1.2 | Tracking (`tracking`) | `curiosity` | Finding prey, cats and danger before they find you |
| 1.3 | Fighting (`fighting`) | `aggression` | Winning fights and getting hurt less |
| 1.4 | Survival (`survival`) | none (×1.0 for everyone) | Cold, endurance and illness |
| 1.5 | Social and Leadership (`social`) | `loyalty` | Loners, recruits and keeping the pride happy |
| 1.6 | Courtship (`courtship`) | `sociability` | Attracting a mate and winning approval to take one |

1.7 Survival has no trait on purpose. It's the branch every cat needs in the Ice Age, so no personality should be slow at it.


## 2. Skills, baselines and perks
2.0 **How to read the tables.** "Baseline per milestone" is gained automatically at each milestone, so at milestone 4 it's 4×. Each milestone (M) lists 2 perk options; the cat takes exactly one. **Lean** is the personality trait the AI pick rule uses (§8.4): A aggression, S sociability, B boldness, L loyalty, C curiosity, — none. Cooldowns are per cat. "1/season" resets at the start of each season (lifecycle §1.2).

### 2.1 Hunting

**Stalk** (`stalk`). Baseline per milestone: +3 hunt points (play-styles §2.5), all prey.

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `ambush` | Ambush | C | New hunt option at a water zone: +10 hunt points, but you skip that day's free drink (needs §1.3). In Story (Thirst off, needs §3.1a) the cost is −5 Mood instead. | — |
| 1 | `patient_stalker` | Patient Stalker | L | After seeing the hunt odds you may abort: costs 10 Energy, no injury roll, no XP. | — |
| 2 | `second_lunge` | Second Lunge | B | Reroll one failed hunt. | 1/season |
| 2 | `dusk_hunter` | Dusk Hunter | C | Tradeoff: +8 hunt points in autumn and winter, −3 in spring and summer. | — |
| 3 | `cache_kill` | Cache | L | Split a medium kill: +25 Hunger now, +25 stored for next day. Sim spoilage and theft still apply (play-styles §2.7). | — |
| 3 | `hunt_mentor` | Hunt Mentor | S | Adolescents hunting with you use ×0.75 instead of ×0.5 (lifecycle §3); you count as a teacher (§6.3) for Hunting. | — |
| 4 | `apex_stalker` | Apex Stalker | B | First small or medium hunt each season succeeds automatically. Energy cost and injury roll still apply. | 1/season |
| 4 | `provider` | Provider | L | Each successful hunt also adds +25 to the pride food store (Standard) or +25 Hunger to one chosen pride cat (Sim per-cat hunger, play-styles §3.3). | — |

**Big Game** (`bigGame`). Baseline per milestone: +2 hunt points on large prey.

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `pack_lunge` | Pack Lunge | S | Large hunt with at least 1 pride or band mate: +10 points, but your share is +50 Hunger, not +80. | — |
| 1 | `throat_bite` | Throat Bite | A | Tradeoff: large-hunt injury chance ×0.7, Energy cost +10. | — |
| 2 | `read_the_herd` | Read the Herd | C | Before a large hunt, see its exact success chance and switch to medium prey at no cost. | — |
| 2 | `bold_charge` | Bold Charge | B | Tradeoff: +8 points on large prey; a failed large hunt rolls injury at ×1.5. | — |
| 3 | `carcass_guard` | Carcass Guard | A | Your large kills can't be stolen by scavengers for 1 day; bear and wolf theft in Sim rolls at ×0.5 (play-styles §2.7). | — |
| 3 | `feast` | Feast | S | A large kill also gives up to 3 adjacent pride cats +5 contentment this season (loners §6.4, counts as "fed"). | 1/season |
| 4 | `giant_slayer` | Giant Slayer | B | New hunt target "giant prey" (Saga event): success adds 3 days of pride food and +10 morale; injury chance ×2. ⚑ Permadeath: fight-level risk. | 1/season |
| 4 | `old_scars` | Old Scars | L | Each healed Serious hunting injury gives +2 large-hunt points, max +6. | — |

**Clean Kill** (`cleanKill`). Baseline per milestone: −2 hunt Energy cost (needs §1.4).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `quick_kill` | Quick Kill | B | A successful hunt refunds half its Energy cost. | — |
| 1 | `lean_hunter` | Lean Hunter | A | Tradeoff: you may start a hunt while Tired (needs §1.4) at −10 points. | — |
| 2 | `scavenger` | Scavenger | C | New action Scavenge: +25 Hunger for 5 Energy; 20% chance of a rival or loner encounter (loners §2.3). | — |
| 2 | `no_waste` | No Waste | L | Eating a kill gives +10 Thirst too. In Story (Thirst off) it gives +5 Hunger instead. | — |
| 3 | `double_hunt` | Double Hunt | B | Take a second hunt in the same day. | 1/season |
| 3 | `sated_sleep` | Sated Sleep | L | After a successful hunt, the overnight Energy tick is +35 instead of +25. | — |
| 4 | `effortless` | Effortless | B | A failed hunt costs 0 Energy. | 1 per 5 days |
| 4 | `small_feeder` | Small Feeder | C | Small prey gives +35 Hunger instead of +25 (needs §1.2). | — |

### 2.2 Tracking

**Prey Sense** (`preySense`). Baseline per milestone: winter scarcity penalty −2 points (play-styles §2.6).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `prey_map` | Prey Map | C | The map shows prey level (rich, normal, poor) in adjacent zones. | — |
| 1 | `snow_tracks` | Snow Tracks | B | In winter, the first hunt in each zone per season gets +8 points. | — |
| 2 | `herd_calendar` | Herd Calendar | C | A hint one season ahead names the next season's rich zone; hunts there get +5 points. | — |
| 2 | `small_game` | Small Game | L | Tradeoff: small-prey hunts +10 points, large-prey −5. | — |
| 3 | `water_finder` | Water Finder | C | When water is frozen, find open water: drink +100 with no Warmth cost. In Story (Thirst off) it gives +10 Warmth instead. | 1 per 3 days |
| 3 | `scout` | Scout | S | Pride hunters (Standard/Sim roles) get +5 points in zones you visited this season. | — |
| 4 | `famine_path` | Famine Path | L | Lead the pride to a hidden zone: no winter scarcity there for 5 days. | 1/winter |
| 4 | `track_master` | Track Master | S | You teach Tracking at +2 aptitude per season instead of +1 (§6.3). | — |

**Threat Scent** (`threatScent`). Baseline per milestone: rival kill theft −2 points (loners §5.1).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `early_warning` | Early Warning | L | Band warning (loners §5b.4) comes 2 turns ahead instead of 1. | — |
| 1 | `read_rival` | Read Rival | C | On an encounter you see whether the cat is a rival and its aggression band (low, mid, high). | — |
| 2 | `sixth_sense` | Sixth Sense | B | Turn a rival attack on you (loners §5.1) into a normal encounter. | 1/season |
| 2 | `border_nose` | Border Nose | L | A patrol reveals every loner or band in your zones that day. | — |
| 3 | `false_trail` | False Trail | C | New action: lay false scent. For 1 season, a band targeting your pride has a 50% chance to retarget another eligible pride. | 1/season |
| 3 | `den_watch` | Den Watch | L | Rivals can't target cubs (loners §5.1) while you're within 1 zone of the den. | — |
| 4 | `know_the_enemy` | Know the Enemy | A | On a band warning you see both strengths, and `gather` gives ×1.25 instead of ×1.15 (loners §10). | — |
| 4 | `storm_sense` | Storm Sense | C | 1 day warning before blizzards; sheltering on a blizzard day gives +45 Warmth instead of +30. | — |

**Trail Reading** (`trailReading`). Baseline per milestone: loner encounter +1 point home zone, +0.4 adjacent (loners §2.3).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `seek` | Seek | S | New action: seek a named loner in its home zone, 50% to meet it that day. | — |
| 1 | `scent_history` | Scent History | C | On meeting a loner you learn its `originPrideId` and `departure`. | — |
| 2 | `read_affinity` | Read Affinity | S | See any attraction-compatible adult's affinity to you as a number, and whether they could be interested (relationships §1.8). | — |
| 2 | `shortcut` | Shortcut | B | Travel between two zones you've visited this season costs −5 Energy. | — |
| 3 | `rumor_web` | Rumor Web | S | All rumors (loners §10.2) arrive on the next turn. | — |
| 3 | `exile_friend` | Exile's Friend | L | A newly exiled cat's first meeting with you starts at +10 affinity. | — |
| 4 | `whole_region` | Whole Region | C | For 5 days, the map shows every loner's current zone. | 1/season |
| 4 | `old_trails` | Old Trails | B | Travel to any zone you know in one day for 30 Energy. | 1/season |

### 2.3 Fighting

**Saber Strike** (`saberStrike`). Baseline per milestone: own fight strength ×+0.03 (loners §5b.3), before stage multipliers.

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `feint` | Feint | L | Break off a fight before it resolves: counts as a loss, no injury or death roll. | 1 per fight |
| 1 | `first_strike` | First Strike | A | Tradeoff: ×1.1 strength in fights you start, ×0.95 when attacked. | — |
| 2 | `pin` | Pin | S | After winning against a loner or rival, choose to spare it: +10 affinity, and it rerolls rival status (loners §5.1). | — |
| 2 | `fury` | Fury | A | Tradeoff: ×1.15 strength while Health < 50. ⚑ Permadeath: tempts fights while hurt; death chance (play-styles §2.9) unchanged. | — |
| 3 | `duelist` | Duelist | B | Challenge a band's strongest member one-on-one instead of the group fight (loners §5b.5). Win counts as the band losing. | 1/season |
| 3 | `shoulder_to_shoulder` | Shoulder to Shoulder | L | In group fights, your side's total strength ×1.05. | — |
| 4 | `saber_legend` | Saber Legend | B | Rivals with aggression < 85 never attack you alone (loners §5.1). | — |
| 4 | `killing_bite` | Killing Bite | A | Standard/Sim only: choose lethal intent; foe's death chance ×2, your injury chance ×1.25, −5 contentment for pride cats with aggression < 40. ⚑ Permadeath/Heir: can kill world cats and heirs' rivals. In Story it does nothing (death chance 0%). | — |

**Guard** (`guard`). Baseline per milestone: fight injury chance ×−0.06 (play-styles §2.3).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `roll_with_it` | Roll With It | L | Minor fight injuries heal in 2 days instead of 3 (needs §2.1). | — |
| 1 | `den_shield` | Den Shield | L | When you choose `hide` on a band warning, you fight at full strength (not ×0.9). | — |
| 2 | `tough_hide` | Tough Hide | B | Your first injury of the season drops one tier (Minor → none). | 1/season |
| 2 | `fight_through` | Fight Through | A | Tradeoff: Serious injury fight penalty is ×0.85 instead of ×0.7 (needs §2.1), but its heal time +2 days. | — |
| 3 | `last_stand` | Last Stand | B | When a fight would kill you, survive at 1 Health with a Crippling injury. ⚑ Permadeath/Heir: one death save per life. | 1/life |
| 3 | `bodyguard` | Bodyguard | L | Name one pride cat; in fights you share, they get your Guard baseline too. | — |
| 4 | `unbroken` | Unbroken | L | Confront scuffles (loners §10.7) never injure you. | — |
| 4 | `scar_pride` | Scar Pride | A | Each scar you carry counts ×1.05 (max ×1.15) in band and rival deterrence checks only. | — |

**Intimidate** (`intimidate`). Baseline per milestone: rival attack on lone pride cats −1 point (loners §5.1).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `roar` | Roar | A | New encounter action: drive off a rival without fighting, 50%; failure starts the fight. | — |
| 1 | `stare_down` | Stare Down | A | Confront (loners §10.7) uses your aggression instead of boldness if higher. | — |
| 2 | `fearsome_mark` | Fearsome Mark | L | Rival attack chance is halved in zones you scent-marked this season. | — |
| 2 | `bully` | Bully | A | Tradeoff: chase off costs −10 affinity instead of −15 (loners §2.4), but pride cats with sociability ≥ 70 get −2 contentment. | — |
| 3 | `deterrence` | Deterrence | B | In a band's ≥ 0.8 strength check (loners §5b.4), you count ×1.2. Not in the fight itself. | — |
| 3 | `banish` | Banish | A | A driven-off rival stays away 3 seasons instead of 2 (loners §5.3). | — |
| 4 | `warlord` | Warlord | A | Demand a border zone from an AI pride whose defenders are < 0.8 of yours: you take it, relation −15. | 1/season |
| 4 | `unshaken` | Unshaken | L | Morale loss from losing a zone to a band is −5 instead of −10 (loners §5b.5). | — |

### 2.4 Survival

**Thick Coat** (`thickCoat`). Baseline per milestone: Warmth decay ×−0.05 (needs §1.5).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `snow_sleeper` | Snow Sleeper | B | Resting outside shelter gives +15 Warmth. | — |
| 1 | `winter_coat` | Winter Coat | — | Tradeoff: winter Warmth decay −5 more; summer Energy costs +2 per action (heavy coat).  | — |
| 2 | `snow_melt` | Snow Melt | — | Eating snow costs 5 Warmth instead of 10. In Story (Thirst off) it gives +5 Mood when eaten in winter instead. | — |
| 2 | `huddle_core` | Huddle Core | S | Huddling gives you +15 per adjacent cat (max +30) and each huddler +5 Warmth. | — |
| 3 | `blizzard_walker` | Blizzard Walker | B | You may travel on blizzard days, and the blizzard extra decay is halved. | — |
| 3 | `den_maker` | Den Maker | L | New action: dig a snow den; it counts as shelter in that zone for 5 days. | 1/season |
| 4 | `ice_born` | Ice Born | — | The Chilled illness multiplier (needs §2.2) is ×1.5 instead of ×2 for you. | — |
| 4 | `warm_keeper` | Warm Keeper | L | Cubs in your den use ×1.2 Warmth decay instead of ×1.5 (needs §4). | — |

**Endurance** (`endurance`). Baseline per milestone: travel and patrol −1 Energy; Thirst decay ×−0.03 (Standard/Sim).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `long_stride` | Long Stride | B | Travel 2 zones in one day for 25 Energy. | — |
| 1 | `night_walk` | Night Walk | C | Tradeoff: travel at night for 0 Energy, but that night's overnight tick is +10 instead of +25. | — |
| 2 | `second_wind` | Second Wind | B | Skip the forced rest day when Exhausted (needs §1.4). | 1/season |
| 2 | `deep_drinker` | Deep Drinker | — | After drinking, Thirst decay is halved the next day. In Story (Thirst off) a drink gives +10 Energy instead. | — |
| 3 | `long_patrol` | Long Patrol | L | A patrol covers 2 zones. | — |
| 3 | `forced_march` | Forced March | L | Moving the pride's den takes 1 day less. | — |
| 4 | `tireless` | Tireless | B | You can start a hunt or fight down to Energy 15 instead of 25. | — |
| 4 | `run_them_down` | Run Them Down | A | After a failed hunt, chase it the same day for 20 Energy at −10 points. | 1/day |

**Hardiness** (`hardiness`). Baseline per milestone: illness chance ×−0.08 (needs §2.2).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `quick_healer` | Quick Healer | — | Minor injuries heal in 2 days. | — |
| 1 | `herb_chewer` | Herb Chewer | C | New action: chew herbs; ends an illness 1 day sooner. | 1 per illness |
| 2 | `iron_gut` | Iron Gut | — | Sim: spoiled meat can be eaten for +25 Hunger, with a 10% illness roll. | — |
| 2 | `stoic` | Stoic | L | Tradeoff: illness no longer halves Energy restores, but lasts +1 day. | — |
| 3 | `survivor` | Survivor | B | Skip one day of empty-need Health damage (needs §1). ⚑ Permadeath: one delay, the need still has to be fixed. | 1/season |
| 3 | `healer` | Healer | S | Grooming a sick or injured pride cat cuts its heal time by 1 day. | 1/season per cat |
| 4 | `long_life` | Long Life | L | Your elder natural death chance is ×0.8 (lifecycle §4.3). ⚑ Heir: delays succession. | — |
| 4 | `hardened` | Hardened | — | Health regen +2 per day while all needs are `ok`. | — |

### 2.5 Social and Leadership

**Grooming** (`grooming`). Baseline per milestone: +1 affinity per groom or shared kill (loners §2.4).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `gentle_approach` | Gentle Approach | S | Groom unlocks at affinity ≥ 10 instead of 20. | — |
| 1 | `generous` | Generous | L | Sharing a kill also gives you +5 Mood. | — |
| 2 | `peacemaker` | Peacemaker | S | Mediate (loners §10.3) is always available, whatever your sociability. | — |
| 2 | `bond_maker` | Bond Maker | L | Grooming a pride cat counts as a close bond (+10 contentment, loners §6.4) that season. | — |
| 3 | `soothe` | Soothe | S | End one pride cat's warning signs now: its contentment is set to the Style threshold +5. | 1/season |
| 3 | `rival_tamer` | Rival Tamer | S | You may groom rivals at affinity ≥ −20; reaching affinity 0 clears rival status. | — |
| 4 | `heart_of_pride` | Heart of the Pride | S | Pride cats within 1 zone of you get +5 contentment per season. | — |
| 4 | `old_friends` | Old Friends | L | Affinity ≥ 60 with you never drifts (loners §2.4). | — |

**Persuasion** (`persuasion`). Baseline per milestone: +2 recruit join chance (loners §3.2) and +2 confront (§10.7).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `second_ask` | Second Ask | S | A failed recruit cooldown is 10 days instead of 1 season. | — |
| 1 | `read_mood` | Read Mood | C | See any cat's contentment number. | — |
| 2 | `promise` | Promise | S | Tradeoff: promise a role or mate for +15 join chance; if not kept within 1 season, that cat gets −20 contentment. | — |
| 2 | `calm_words` | Calm Words | L | A failed confront never starts a scuffle. | — |
| 3 | `envoy` | Envoy | S | New action: visit an AI pride's border for +10 relation. | 1/season per pride |
| 3 | `lure` | Lure | A | Sim only: lure one unhappy AI-pride cat (loners §6.4 lure rule, aimed at them). | 1/season |
| 4 | `silver_tongue` | Silver Tongue | S | Reroll one failed recruit or confront. | 1/season |
| 4 | `truce` | Truce | L | An AI pride at neutral or better agrees to no border fights with you for 2 seasons. | 1 per 2 seasons |

**Leadership** (`leadership`). Baseline per milestone: +1 contentment per season for every pride cat (loners §6.4).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `role_sense` | Role Sense | C | The roles screen shows which role fits each cat's top trait. | — |
| 1 | `eat_last` | Eat Last | L | Tradeoff: if you eat last, all pride cats +5 contentment; your meal gives −10 Hunger. | — |
| 2 | `rally` | Rally | B | Pride morale +10. | 1/season |
| 2 | `strict` | Strict | A | Tradeoff: pride cats' `prideLoyalty` never drops below 40, but all get −2 contentment per season. | — |
| 3 | `heir_trainer` | Heir Trainer | L | Your designated heir earns XP ×1.25. ⚑ Heir: makes the next player cat stronger; Permadeath: no effect on you. | — |
| 3 | `hold_the_young` | Hold the Young | L | Sim young-male dispersal (loners §6.4) is 30% instead of 50%. | — |
| 4 | `legacy_rally` | Legacy | L | When you die or are ousted, every pride cat gets +10 `prideLoyalty`. ⚑ Heir: the heir inherits a steadier pride; Permadeath: no effect. | on death |
| 4 | `kingmaker` | Kingmaker | S | A role change always gives +10 contentment (loners §10.4), not only when it fits the top trait. | — |

### 2.6 Courtship

**Display** (`display`). Baseline per milestone: +3 courtship acceptance (loners §4.1, base see formulas-spec v0.1).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `gift` | Gift | S | New courtship option: give a kill for +10 on that attempt. | — |
| 1 | `call` | Call | B | Court from an adjacent zone at −5. | — |
| 2 | `showdown` | Showdown | B | In a mate rival challenge, display instead of fighting: 50% + 10 × (your Display milestones − rival's), no injuries. | — |
| 2 | `persistent` | Persistent | L | A failed courtship attempt costs no affinity. | — |
| 3 | `again` | Again | S | One extra courtship attempt per season with the same cat. | — |
| 3 | `famous` | Famous | B | Eligible mates you've never met start at +10 affinity. | — |
| 4 | `chosen` | Chosen | S | One courtship attempt at affinity ≥ 60 succeeds automatically. | 1/season |
| 4 | `bonded_pair` | Bonded Pair | L | Your mate gets +10 contentment per season and can't be lured (loners §6.4). | — |

**Charm** (`charm`). Baseline per milestone: courtship affinity gains ×+0.05 (loners §2.4).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `first_impression` | First Impression | S | A first meeting with an eligible mate gives +10 affinity. | — |
| 1 | `playful` | Playful | C | Socialising with a cat you court costs 0 Energy and gives +5 Mood. | — |
| 2 | `constant` | Constant | L | Affinity with cats you court doesn't drift (loners §2.4) while you meet once a season. | — |
| 2 | `two_hearts` | Two Hearts | A | Tradeoff: court two cats at once at +5 affinity per meeting; each meeting has a 25% chance they find out (−20 with both). | — |
| 3 | `leader_charm` | Leader Charm | S | Pride leaders start at +10 affinity with you. | — |
| 3 | `sweet_talk` | Sweet Talk | S | A failed courtship can be retried after 5 days instead of next season. | — |
| 4 | `soulmate` | Soulmate | L | Having your mate gives +20 instead of +10 to both of your contentment (loners §6.4, needs §1.6). | — |
| 4 | `heartbreaker` | Heartbreaker | A | Tradeoff: a pride-cat mate joins without leader approval, but relation with that pride −20 instead of +20 (loners §4.2). | — |

**Standing** (`standing`). Baseline per milestone: +3 leader approval (loners §4.2, base see formulas-spec v0.1).

| M | Perk id | Name (placeholder) | Lean | Mechanics | Cooldown |
|---|---|---|---|---|---|
| 1 | `courtesy` | Courtesy | L | Meeting a pride leader gives +10 relation with that pride. | 1/season per pride |
| 1 | `right_of_challenge` | Right of Challenge | A | Call the mate rival challenge at once instead of waiting for an event. | — |
| 2 | `respected` | Respected | L | A failed leader approval costs no relation. | — |
| 2 | `proven` | Proven | B | +10 leader approval if you won a fight this season. | — |
| 3 | `alliance_mate` | Alliance Mate | S | A pride-cat mate gives +25 relation instead of +20. | — |
| 3 | `kin_follow` | Kin Follow | S | Tradeoff: a pride-cat mate brings 1 cat with affinity ≥ 40 to you as a recruit, no roll; relation gain +10 instead of +20. | — |
| 4 | `takeover` | Takeover | A | Alone, challenge a pride's resident male for `mates` (loners §10.5) at ×1.1 strength; win = found your pride there. ⚑ Permadeath: fight death chance applies; Heir: an ousted player ends the run as loners §5b.5. | 1/life |
| 4 | `elder_voice` | Elder Voice | L | As an elder, +15 leader approval and you teach at double rate (§6.3). | — |

2.7 **Stacking.** Baselines and perks add to the other modifiers in the same roll (Style, needs states, injuries, Mood) and multiply with other multipliers. Existing clamps (recruit 5–90%, confront 10–90%) still apply after them.
2.8 **Order in hunt and fight rolls.** Skill points and multipliers apply before the life-stage multiplier (lifecycle §3), so an adolescent learner's bonuses are halved with the rest of its hunt score.
2.9 **Balance.** At milestone 4 each baseline is worth at most one Style step (for example +12 hunt points, ×1.12 strength, ×0.8 Warmth decay). Perks are sidegrades: every pair is either two different playstyles or a tradeoff, so no option is strictly better. Tunable via `skills.json`.

## 3. Earning XP
3.1 **XP per action.** When an action resolves, its **primary skill** gets full XP and the two other skills in that branch get 25% (rounded half up). A success gives **10 XP** and a failure gives **4 XP**. Cats learn from failing, but slower.
3.2 **Which action feeds which skill:**

| Action or event | Primary skill | Notes |
|---|---|---|
| Hunt, small or medium prey | `stalk` | Energy-saving counts toward `cleanKill` via the 25% share |
| Hunt, large prey | `bigGame` | Success +15 XP instead of 10 |
| Hunt with Energy cost paid while Hunger is `low` or worse | `cleanKill` | Hard hunts teach economy |
| Hunt in winter, or a hunt in a zone visited for the first time this season | `preySense` | |
| Patrol, scent-marking, or a band warning or rival sign noticed | `threatScent` | |
| Travel into a zone with a loner's home range, or a loner encounter | `trailReading` | |
| Any fight or scuffle | `saberStrike` | A win is a success |
| Taking an injury and recovering from it | `guard` | 4 XP when the injury heals |
| Driving off a rival, or `gather`/`meet` on a band warning | `intimidate` | |
| A day ending with Warmth below 50, or a blizzard day | `thickCoat` | 4 XP, or 10 if sheltering that night |
| Travel or patrol | `endurance` | |
| A day with illness, or a day at `critical` Hunger, Thirst or Warmth survived | `hardiness` | 4 XP |
| Groom or share a kill (loners §2.4) | `grooming` | |
| Recruit ask, confront, or mediate (loners §3, §10.3, §10.7) | `persuasion` | Success or failure per the roll |
| Assigning roles, feeding order, or a warning-turn response for a pride member | `leadership` | Only after founding a pride |
| Courtship attempt | `display` | |
| Any positive act toward a cat being courted | `charm` | |
| Meeting a pride leader, or a mate rival challenge | `standing` | |

3.3 **Daily cap.** A skill can earn at most **20 XP per day** from all sources.
3.4 **Diminishing returns.** If the same primary skill was the primary on the previous day too, XP is ×0.75. On the third consecutive day and after, it's ×0.5. One day of doing anything else resets it. This rewards a varied life over grinding one action.
3.5 **Total multiplier.** Final XP = base × repetition (§3.4) × personality (§4) × aptitude (§6) × life stage (§5) × Style (§7), rounded half up, then capped by §3.3.

## 4. Personality (genetics-spec §4)
4.1 Each branch's linked trait (§1) gives an XP multiplier of **1 + (trait − 50) / 250**. That's ×0.88 to ×1.12 inside the normal creator range of 20–80 (cat-creator-spec §3b.2), and ×0.8 to ×1.2 at 0–100.
4.2 **Never a lock.** A low-aggression cat can still learn every Fighting skill. It just takes it about 25% longer than a high-aggression cat at the extremes. Personality shapes the cat; it never bars a path.
4.3 Personality does not change skill effects, only XP speed. Existing trait effects (for example sociability on recruit chance, boldness on confront) stay exactly as in their own specs and stack with skills.

## 5. Life stage (lifecycle-spec §2)
| Stage | XP multiplier | Other rules |
|---|---|---|
| Cub | earns none | Can receive teaching (§6.3) |
| Adolescent | ×1.25 | Learns fast. The 25% branch share (§3.1) applies as normal. Fight XP only from scuffles and training, because adolescents can't be challenged (lifecycle §3) |
| Adult | ×1.0 | |
| Elder | ×0.75 | No decay: milestones and perks are never lost |

5.1 **Why no skill decay for elders.** Elders already lose hunt score (×0.8) and fight strength (down to ×0.5) in lifecycle-spec §3, and get colder, tire faster and fall ill more (needs-spec §4). Taking their skills too would double-punish them. Their skills instead feed teaching (§6.3), which is the elder's role in the pride.
5.2 **Start of a run.** The creator cat starts at age 3 (lifecycle §2.6) with **all skills at 0 XP, no milestones and no perks**. A fresh lone cat having nothing yet gives the run its arc.

## 6. Inheritance and teaching
6.1 **What's inherited is aptitude, not milestones or perks.** Each cat has an **aptitude** per branch, an integer 80–120 used as a percent XP multiplier (100 = normal).
   - Cub value = round_half_up(clamp((parentA + parentB) / 2 + Normal(0, sd 5), 80, 120)), per branch, the same shape as genetics-spec §4.2.
   - Random new cats roll Normal(100, 8), clamped 80–120. Premade cats use Saga's authored values, defaulting to 100.
   - **The creator cat (decided by Anna via Director, 2026-11-04):** the creator has no aptitude control and doesn't show aptitude. On Start, `mainCat` rolls each branch from Normal(100, sd 5), rounded half up and clamped 80–120. It has no parents, and the roll uses its own seeded stream (`aptitude`), separate from the creator's look and personality streams. XP speed by difficulty comes only from the Style multipliers in §7.
   - **cat-creator-spec needs no change.** The roll happens at Start, behind the scenes.
6.2 **Why aptitude and not milestones.** Inheriting milestones or perks would let a lineage stack power each generation and make an heir start stronger than the founder, which breaks the lone-cat-to-pride arc. Aptitude is small (±20% speed at the extremes), still reads as "her mother's hunting blood", and has to be earned again by every cat.
6.3 **Teaching.** Each season, a cub or adolescent in the pride gets **+1 aptitude** (max +5 total per branch from teaching, still capped at 120) in one branch where a parent or elder in the pride has **milestone 3 or more** in any skill of that branch. If several branches qualify, it's the one with the highest teacher milestone (ties: the player's choice in Standard and Sim, automatic in Story). An adolescent who joins hunts as a learner alongside a milestone-3+ teacher also gets +2 XP per shared hunt, inside the daily cap.
6.4 The player cat can be a teacher. This gives a reason to keep a skilled elder around and makes the heir the player raised feel like theirs.

## 7. Style scaling (play-styles-spec)
| | Story | Standard | Sim |
|---|---|---|---|
| 7.1 XP multiplier | ×1.5 | ×1.0 | ×0.8 |
| 7.2 Skill effects | full | full | full |
| 7.3 Teaching (§6.3) | automatic | player picks ties | player picks ties |

7.4 Skill **effects** are the same in every Style. Harshness comes from the Style's own rules (needs-spec §3, play-styles §2); skills only change how quickly the cat gets better.
7.5 **Sandbox** uses the run's Style values. Free Customization On (main-menu-spec §7) doesn't edit skills in v0.1.

7.6 **Sandbox respec (Director, 2026-11-04).** Sandbox has an optional toggle, **Free perk respec**, which is off by default (`sandboxOptions.freePerkRespec`, main-menu-spec v1.4.3). When it's on, the player can swap any picked perk for the other option at the same milestone at any rest action, as often as they like. When it's off, and in Story, Standard and Sim, picks are permanent with no respec. Respec only applies to the player cat.

## 8. Picking perks
8.1 **When a milestone is reached** the baseline applies at once. The perk pick **waits**: a "Perk ready" chip shows on the HUD, and the choice modal (§11.2) opens at the cat's **next rest** (the rest action or a den rest). The player can also open it from the skill screen at any time. It's **never auto-picked for the player cat**, and closing the modal leaves the pick waiting. Several waiting picks queue in the order reached.
8.2 **Picks are permanent per cat** (except Sandbox respec, §7.6). Choosing at milestone 2 doesn't need a milestone-1 pick to be made first, but the modal shows the oldest waiting pick first.
8.3 **World cats (the 39 slots)** have fixed perks per milestone, listed in world-gen-spec v0.3.1 §2.3a. No slot is past milestone 4, and cubs have none.
8.4 **AI pride cats born in play** (and any NPC reaching a new milestone in play) auto-pick at the season tick. Each option gets weight **0.5 + trait / 50** for its Lean trait (§2.0), so 0.5 at trait 0, 1.5 at 50 and 2.5 at 100. An option with Lean "—" gets weight 1.5. The pick is a weighted draw from the run's seeded `perks` stream. A cat that would never use an option (for example `water_finder` in Story) still draws it; it just has no effect.
8.5 **NPC XP** comes from roles each season: hunter `stalk`/`bigGame`, guard `saberStrike`/`threatScent`, nursemaid `grooming`/`hardiness`, at **60 XP per season** to each, through the §3.5 multipliers and with no daily cap. NPC perks with player-only actions (new actions, map info, modals) have no effect on NPCs; their baselines still apply.

## 9. Heir switch (main-menu-spec §7, Heir Death rule)
9.1 **The heir keeps their own XP, milestones and perks.** The founder's are not copied. Any of the heir's waiting picks were auto-picked if they were an NPC (§8.4); picks reached after the switch wait for the player as in §8.1.
9.2 **Founder's lesson (replaces v0.1's +100 XP).** When the heir takes over, the player may choose **one of the founder's milestone-1 perks** and give it to the heir as an extra perk. It doesn't use one of the heir's milestones and is shown as "Founder's lesson" on the skill screen. If the heir already has that exact perk, it's +100 XP in that skill instead. Once per heir.
9.3 ⚑ Perks that act on death or succession: `last_stand` (one death save per life), `long_life`, `heir_trainer`, `legacy_rally`, `takeover`, `killing_bite`, `fury`, `giant_slayer`, `survivor`. In **Permadeath**, `heir_trainer` and `legacy_rally` do nothing for the player. In **Story**, death-chance perks do nothing (fight death chance is 0%, play-styles §2.9), and elders retire instead of dying (lifecycle §4.4).
9.4 An adolescent heir uses the adolescent row in §5 and lifecycle §3.

## 10. Milestones and pacing
10.1 **Four milestones at cumulative XP 100 / 300 / 600 / 1000.** v0.1's fifth rank (1500) is dropped.
10.2 **Why four.** A focused skill earns about 3–4 XP a day (Standard, adult). That puts M1 at about 1.5 seasons, M2 at about 4, M3 at about 8 (age 5) and M4 at about 14 seasons (age 6–7). The old 1500 sat at age 8, past the middle of most lives (lifecycle §4.3: most cats die 12–16), so few runs would ever see it. Four milestones also keep the thresholds world-gen already uses, and keep the perk table at 144 entries.
10.3 Over a life, a player cat can expect 2–3 skills at M4, 5–6 more at M1–M3, and about 15–25 perk choices in total. Story reaches each milestone about a third sooner; Sim about a quarter later.

## 11. Worked example: the hunt
The hunt base isn't defined yet (§15.1). Assume a placeholder base of **50 points**, Standard, medium prey, autumn.
11.1 **Fresh cat (age 3, day 1):** 50. Hungry (needs §1.2): 45.
11.2 **Hunter after 6 seasons of play:** about 380 Stalk XP (as in v0.1: about 48 hunts, boldness 60, aptitude 105), so **M2**: baseline +6. Picks: M1 `patient_stalker`, M2 `dusk_hunter`. On a normal autumn day: 50 + 6 + 8 = **64**. In spring: 50 + 6 − 3 = **53**. With a Serious injury (needs §2.1): 64 − 15 = **49**, about the same as a fresh cat. If the odds look bad, `patient_stalker` lets it abort for 10 Energy instead of risking injury.
11.3 Skills give a steady edge of about 5–15 points plus new choices. Needs and injuries still swing 5–15 points a day.

## 12. HUD and skill screen
12.1 **Skill screen:** six branch tabs in the order of §1. Each skill row shows icon, name, an XP bar to the next milestone, **4 milestone pips**, and under each reached pip the **picked perk's name** (or "Pick ready"). "Now / next milestone" lines show the baseline number (for example "Hunt +6 → +9"). The founder's lesson (§9.2) shows as a separate badge.
12.2 **Perk choice modal:** 2 cards side by side (3 if a future option is added): icon, Saga's name, 1–2 lines of mechanics with the concrete number, the cooldown, and a ⚑ tag where it applies. Buttons: Choose (asks once to confirm, because picks are permanent) and Later.
12.3 **Main HUD:** a "Perk ready" chip while any pick waits. A milestone toast counts as the day's single notification (needs §5.4) only if no need threshold was crossed that day. Cooldown perks show as small ready/used icons on the action bar.
12.4 **In rolls:** a roll breakdown shows one line per baseline and per perk, like "Stalk +6", "Dusk Hunter +8".
12.5 Readable without colour; keyboard and gamepad (Left/Right tabs, Up/Down rows, A to open a pick).
12.6 **Ochre:** 18 skill icons, 6 branch icons, and a generic perk-card frame. Per-perk icons later. Not urgent.

## 13. Data
13.1 Every cat:
```json
"skills": { "stalk": 380, "bigGame": 95, "...": 0 },
"perks": { "stalk": ["patient_stalker", "dusk_hunter"], "bigGame": [] },
"founderLesson": null,
"aptitude": { "hunting": 105, "...": 100 }, "aptitudeTaught": { "hunting": 0, "...": 0 }
```
   `skills` holds cumulative XP integers. Milestone is derived with `milestoneFor(xp)` (§10.1), never stored. `perks[skill]` holds picked perk ids in milestone order; `null` marks a waiting pick, so its length equals the milestone reached. Perk ids are stable snake_case strings.
13.2 Player only: `skillStreak`, `skillXpToday` (as v0.1), `perkCooldowns: { perkId: { usedSeason, usedDay } }`, `lastStandUsed: bool`.
13.3 Cub inheritance uses each parent's full `aptitude` (including taught), see §15.4.

## 14. Tunables (`skills.json`, Style values in `styles.json`)
| Key | Default |
|---|---|
| maxMilestone | 4 |
| milestoneXp (1/2/3/4) | 100 / 300 / 600 / 1000 |
| xp.success / failure / bigGameSuccess | 10 / 4 / 15 |
| xp.branchShare / dailyCapPerSkill | 25% / 20 |
| xp.repeat (day 2 / day 3+) | ×0.75 / ×0.5 |
| personality.divisor | 250 |
| stage.xp (cub/adolescent/adult/elder) | 0 / 1.25 / 1.0 / 0.75 |
| style.xp (story/standard/sim) | 1.5 / 1.0 / 0.8 |
| aptitude.min / max / inheritSd / randomMean / randomSd / playerStartSd | 80 / 120 / 5 / 100 / 8 / 5 |
| teach.minTeacherMilestone / perSeason / maxTotal / learnerHuntXp | 3 / 1 / 5 / 2 |
| npc.roleXpPerSeason | 60 |
| aiPick.weight (base / per trait point / unleaned) | 0.5 / 1⁄50 / 1.5 |
| heir.founderLessonFallbackXp | 100 |
| sandbox.freePerkRespec default | off (unlimited swaps at rest when on) |
| baselines | per §2 tables |
| perks | per §2 tables, keyed by perk id |

## 15. Open for Director
15.1 ~~Missing base rolls~~ **RESOLVED:** hunt success, courtship acceptance, leader approval and fight resolution are defined in `formulas-spec.md` v0.1. Skill points and perks plug in as listed there.
15.2 ~~Sandbox respec~~ ANSWERED (Director): a Free perk respec toggle in Sandbox, off by default, giving unlimited swaps at rest when it's on (§7.6).
15.3 **Premade-cat perks.** Saga can rename perks and check that each slot's fixed picks (world-gen §2.3a) fit its story.
15.4 **Aptitude compounding.** Teaching folds into inherited aptitude, so a lineage of teachers could drift toward 120. I'd check it in a long-run simulation before freezing.
15.5 **New content for Saga.** Some perks need new events or text: `giant_slayer` (giant prey), `false_trail`, `herd_calendar`, `famine_path`, `envoy`, `truce`, `warlord`.

## Changelog
- v0.2.3 (2026-11-05, Director): `read_affinity` now targets attraction-compatible adults and shows possible interest (relationships §1.8). Backup: `skills-spec.v0.2.2.bak.md`.
- v0.2.2 (2026-11-05, Tundra): §15.1 now points to `formulas-spec.md`. Backup: `skills-spec.v0.2.1.bak.md`.
- v0.2 (2026-11-04, decided by Anna via Director): ranks are now 4 **milestones** (100/300/600/1000) with a small baseline gain each, and the player **picks one of 2 perks** per milestone (§2, 144 perks with stable snake_case ids). Picks are permanent, wait for the next rest, and are never auto-picked for the player (§8.1). Sandbox respec is a Tundra rec (§7.6). World cats use fixed per-slot perks (world-gen v0.3.1 §2.3a); AI cats born in play auto-pick with a personality-weighted draw (§8.4). The heir keeps their own perks; the founder bonus is now the founder's lesson (§9.2). The save adds `perks` per skill (§13). The HUD adds the perk choice modal (§12). Use-based XP rules (§3) are unchanged. Removed the "learn-by-doing or tree" question (answered). Backup: `skills-spec.v0.1.bak.md`.
- v0.1 (2026-11-04, decided by Anna via Director): the creator has no aptitude control. The player cat's aptitude is rolled at Start from Normal(100, 5), clamped 80–120, on its own seeded stream, and isn't shown (§6.1). The Style XP multipliers stay at Story ×1.5, Standard ×1.0 and Sim ×0.8 (§7). cat-creator-spec needs no change.
- v0.2.1 (2026-11-04, Director): v0.2 approved. Sandbox respec is now a Free perk respec toggle, off by default with unlimited swaps at rest (§7.6). No respec anywhere else.
