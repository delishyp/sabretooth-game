# Sabretooth: Lifecycle Spec (v0.1, DRAFT, design-only)
Owner: Tundra (rules and numbers). Player-facing stage names and text: Saga. Age art: Ochre. Code: Flint.
Life stages set by Anna via Director, 2026-11-04. The age numbers are my drafts from Director's fossil-based ranges, and all of them are tunable.
Related: genetics-spec §2 and §6 (`lifeStage`, age layers), loners-spec §1.3, §5b and §6.4, main-menu-spec §7 (Heir), play-styles-spec §2.8 (cub mortality), cat-creator-spec §5.2.

## 1. Time
1.1 A year has 4 seasons: spring, summer, autumn and winter. Ages are stored in **seasons** (`ageSeasons`, an integer) and shown to the player in years.
1.2 Every cat ages by 1 at the start of each season. Cubs are born in spring or summer. Winter births are not allowed, and play-styles winter scarcity applies.
1.3 **Run start:** every run starts on day 1 of spring, Year 1. The player cat is exactly 12 seasons old, so its `birthSeason` is spring of Year −2. Premade cats and loners count their `birthSeason` back from that start date.

## 2. Life stages (`lifeStage`)
| # | Stage (id) | Age | ageSeasons | Notes |
|---|---|---|---|---|
| 2.1 | Cub (`cub`) | 0 to under 1 yr | 0–3 | Stays at the den and is fed by the pride. Can't hunt, fight or breed. Milk sabers. |
| 2.2 | Adolescent (`adolescent`) | 1 to under 3 yr | 4–11 | Sabers growing in. Stays with the family. Joins hunts as a learner and never fights in challenges. Can't breed. Can be named heir (main-menu-spec §7). |
| 2.3 | Adult (`adult`) | 3 to under 10 yr | 12–39 | Full sabers. Breeds, hunts, fights, leads. Ages 3 to under 5 (12–19 seasons) count as **young adult**, a descriptor only, for lore and loners-spec. |
| 2.4 | Elder (`elder`) | 10 yr and up | 40+ | Greying (age_elder layer). Females stay fertile to 11, males to 12, then neither breeds. |

2.5 The stage is derived from `ageSeasons` every season and never stored on its own, except in save-meta snapshots (`mainCat.lifeStage`), so the menu can draw the cat without the full save.
2.6 **New run:** the player cat always starts at exactly 3 years old, which is `ageSeasons` 12 and a fresh adult (Anna via Director, 2026-11-04). The creator makes adults only.

## 3. Abilities by stage
| | Cub | Adolescent | Adult | Elder |
|---|---|---|---|---|
| Hunt | no | learner (hunt score ×0.5) | full | ×0.8 |
| Fight strength | n/a | ×0.6, can't be challenged | ×1.0 | ×0.85 at 10, then −0.05 per year, min ×0.5 |
| Breed | no | no | yes | to 11 (F) or 12 (M) |
| Heir eligible | no | yes | yes | yes |
| Can disperse or join a band | no | no | males, at young adult | no |

## 4. Natural death (per season, before Style multipliers)
4.1 **Cub:** 4% per season. This is multiplied by play-styles §2.8 cub mortality (Story ×0.5, Standard ×1, Sim ×1.5) and by any inbreeding penalty (genetics-spec §5.3). Starving cubs get +10%.
4.2 **Adolescent and adult:** 0.5% per season from illness or accidents. Fights and hunger are handled separately.
4.3 **Elder:** 2% per season at age 10, plus 2% for each year after, capped at 40%. At 15 years that's 12% per season, so most cats die between 12 and 16.
4.4 **Story Style:** elders can't die of age while they're the player cat. They retire instead, and the heir rules apply.

## 5. Mapping older wording
5.1 Where loners-spec says "young adult" it means an adult aged 3 to under 5. The young-male dispersal roll (loners-spec §6.4) fires when a male turns adult (12 seasons).
5.2 The loner mix in loners-spec §1.3 (2 young adult, 5 adult, 2 elder) stays as it is. Saga picks exact ages inside those ranges.

## 6. Data
6.1 Cat gets `ageSeasons: int` and `birthSeason: {year, season}`. `lifeStage` is derived per 2.5.
6.2 **Portrait by stage (per Ochre):** cub and adolescent get their own pose folders, such as `portrait-male-cub/` and `portrait-male-adolescent/`, with their own lineart and masks under the same layer contract. That's because their proportions and saber lengths differ. Elder is an `age_elder` overlay on the adult base, and adults have no age layer. Until the cub and adolescent art lands, those stages fall back to the adult pose folder.

## 7. Tunables (`lifecycle.json`)
| Key | Default |
|---|---|
| seasonsPerYear | 4 |
| daysPerSeason | 20, LOCKED by Anna via Director, 2026-11-04 (1 turn = 1 day; see needs-spec §0.1) |
| stageStart (seasons) | cub 0, adolescent 4, adult 12, elder 40 |
| youngAdultUntil | 20 |
| fertileUntil (seasons) | F 44, M 48 |
| playerStartAge (seasons) | 12 (fixed by Anna) |
| death.cub / adult / elderBase / elderPerYear / elderCap | 4% / 0.5% / 2% / 2% / 40% |
| hunt.adolescent / elder | ×0.5 / ×0.8 |
| fight.adolescent / elderStart / elderPerYear / elderMin | ×0.6 / ×0.85 / −0.05 / ×0.5 |

## 8. Open for Director
8.1 Do Anna's stage names stay as Cub / Adolescent / Adult / Elder in the UI? That's Saga's copy, but Anna named them, so I'm checking.
- 2026-11-04: daysPerSeason = 20 locked (Anna via Director).
