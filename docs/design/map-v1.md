# Sabretooth: Region Map v1.0.1 DRAFT (Tundra, 2026-11-06)

Owner: Tundra (rules and numbers). Code: Flint. Art / region polygons: Ochre. Flavour text: Saga.
Status: **DRAFT for Anna.** Do not build the map engine until Anna approves the layout.
Related: formulas-spec v0.2.4 (time, hunt, fights §4, challenge §2.7), needs-spec v0.1, loners-spec v0.9 §2 / §5b, world-gen-spec v0.3.6, lore/world-and-prides.md, lore/loners.json, docs/map-copy.md.
Reference: `docs/design/map-refs/anna-ref-regions.png` (painted top-down Vale; Anna: "probably a lot bigger").

Legacy zone ids from Saga (`ice_wall`, `highcrag`, `bonefield`, `mistwood`, `greywater_ford`, `split_rock`, `drowned_mere`, `tar_seeps`, `bears_throat`, `ash_hills`) stay exactly as they are so `loners.json` `homeZones` stays valid. New regions get new snake_case ids.

---

## Summary for Anna

- The Vale is a big painted world map (mountains, glaciers, lakes, rivers, forests, plains) cut into **30 irregular regions** across **11 biomes**, not a tiny board of 10 tiles.
- Every region has its own **prey-by-season, hazards, water, travel days, and a clear risk / reward / time tradeoff**, so choosing where to hunt or claim is a real decision.
- Territory is **dynamic**: prides contest, gain and lose regions over time; borders shift with scent, patrols and skirmishes.
- Claiming land **costs upkeep**. Skip patrols and the claim fades; over-claim and the pride starves or gets pushed.
- Early lone-cat play stays gentle (trespass meetings only). Contest pressure starts after you found a pride.
- The three AI prides begin with small cores; most of the map is wild / neutral, with dire wolves holding the southern ash country as a future faction hook.
- Everything is **data-driven JSON** (regions, biomes, hazards, adjacency, seasons/weather, ownership overlay). Ochre paints the map later and exports polygons; code draws ownership as a tint. Saves carry `dataVersion` so we can add regions later without a rebuild.
- This draft waits on your OK before Flint builds the engine or Ochre paints.

---

## 1. Design goals

1.1 Match Anna's painted top-down direction: many irregular regions on one illustrated Vale, "a lot bigger" than the hand-drawn ref.
1.2 Each region must feel different to play: prey, danger, travel cost and claim value are not interchangeable.
1.3 Territory war is a mid/late-game system. A fresh loner at `split_rock` is not crushed by contest pressure.
1.4 Data-driven and versioned. Adding a region, a season table, weather, or a dire-wolf faction later is a JSON + migration change, not a rebuild.
1.5 Keep Saga's 10 legacy ids. Saga rewrites blurbs once this list is approved (`map.region.<id>.description`).

---

## 2. Time and seasons (locked)

From needs-spec / formulas: **1 day = 1 turn**. **1 season = 20 days**. Run starts **spring day 1**. Seasons cycle spring → summer → autumn → winter.
Seeded rolls for map hazards and AI contest use a named sub-stream `map` forked from `worldSeed` (world-gen §1.3).

---

## 3. Biomes

Biomes are data rows. A region's biome supplies default warmth, freeze behaviour and hazard pools; the region may override.

| biome id | Name | Default warmth/day | Typical water | Notes |
|---|---|---|---|---|
| `glacier` | Glacier | −15 (extra cold) | meltwater (winter: frozen) | avalanche, thin ice on melt sheets |
| `alpine` | Alpine / crag | −8 | upper river / snowmelt | cliffs, dens, horse meadows |
| `tundra` | Open tundra | −10 | none / melt pools | starvation pressure, wind |
| `steppe` | Grassland / steppe | −5 | seasonal pools | herds, open fights |
| `riverine` | River corridor | −3 | river (never freezes at fords) | crossings, ambush, flood in spring |
| `pinewood` | Pine forest | −4 | marsh seeps | fog, deer, hidden trails |
| `wetland` | Marsh / reed | −2 | marsh | mosquitoes summer; geese spring–summer |
| `lakeshore` | Lake shore | −3 | lake (winter freeze) | thin ice in spring (the Breaking) |
| `gorge` | Gorge / canyon | −6 | none / seep | bear dens, rockfall |
| `tarlands` | Tar seeps | −4 | none (tar undrinkable) | tar trap, scavenging |
| `ashscape` | Dry ash hills | −5 | none | dire wolves, summer camels |

Tunable warmth offsets stack with needs-spec §1.5 season warmth.

---

## 4. Region catalogue (30)

**Prey** is 0–3 and feeds hunt points (formulas §1): 0 → −10, 1 → 0, 2 → +5, 3 → +10. `preyBySeason` overrides the base for that season.
**Risk/reward tier:** `safe` | `balanced` | `rich` | `hardship` | `deadly` (see §7).
**Water:** `none` | `river` | `lake` | `marsh` | `meltwater`. `freezes: true` → winter drink uses eat-snow (needs §1.3).
**Travel days** on an edge are in §5. Region column `travelHint` is the typical outbound cost to its main neighbours (1 or 2).

### 4.1 Full region table

| id | Name | biome | startHolder | adjacency (ids) | travelHint | prey base / spr / sum / aut / win | hazards (daily %) | water / freezes | tier |
|---|---|---|---|---|---|---|---|---|---|
| `ice_wall` | The Ice Wall | glacier | neutral | frost_tongue, blue_caves, wind_scree, north_pass | 1–2 | 1 / 1 / 1 / 1 / 0 | avalanche 4%, starvation 3%, cold_snap 5% | meltwater / Y | hardship |
| `frost_tongue` | The Frost Tongue | glacier | neutral | ice_wall, blue_caves, highcrag, wind_scree | 1 | 1 / 1 / 2 / 1 / 0 | avalanche 3%, thin_ice 2% (spr) | meltwater / Y | hardship |
| `blue_caves` | The Blue Caves | glacier | neutral | ice_wall, frost_tongue, highcrag, west_spur | 1 | 1 / 1 / 1 / 1 / 1 | cold_snap 4%, rockfall 2% | meltwater / Y | safe* |
| `wind_scree` | The Wind Scree | tundra | neutral | ice_wall, frost_tongue, horse_meadows, salt_flats | 1 | 1 / 1 / 1 / 1 / 0 | starvation 4%, cold_snap 3% | none / — | hardship |
| `north_pass` | North Pass | alpine | neutral | ice_wall, highcrag, east_saddle | 2 | 1 / 1 / 2 / 1 / 0 | avalanche 6% (win/spr), rockfall 2% | meltwater / Y | hardship |
| `highcrag` | Highcrag | alpine | highcrag | frost_tongue, blue_caves, horse_meadows, upper_greywater, north_pass | 1 | 2 / 2 / 2 / 2 / 1 | rockfall 1% | river / N | balanced |
| `horse_meadows` | Horse Meadows | alpine | highcrag | highcrag, wind_scree, upper_greywater, greywater_ford | 1 | 2 / 3 / 3 / 2 / 1 | wolves 1% (win) | meltwater / Y | rich |
| `upper_greywater` | Upper Greywater | riverine | highcrag | highcrag, horse_meadows, greywater_ford, twin_forks | 1 | 2 / 3 / 2 / 2 / 2 | flood 3% (spr) | river / N | balanced |
| `greywater_ford` | Greywater Ford | riverine | highcrag† | horse_meadows, upper_greywater, bonefield, twin_forks, split_rock, reedbank | 1 | 3 / 3 / 3 / 3 / 2 | wolves 2%, flood 2% (spr) | river / N | rich |
| `salt_flats` | The Salt Flats | tundra | neutral | wind_scree, tallgrass, split_rock, herd_trail | 1–2 | 1 / 1 / 1 / 1 / 0 | starvation 5%, cold_snap 2% | none / — | hardship |
| `bonefield` | The Bonefield | steppe | bonefield | greywater_ford, herd_trail, tallgrass, south_range, split_rock, tar_seeps | 1 | 3 / 3 / 3 / 2 / 1 | wolves 2% (win) | none / — | rich |
| `herd_trail` | The Herd Trail | steppe | bonefield | bonefield, salt_flats, tallgrass, south_range, camel_ridge | 1 | 2 / 3 / 3 / 3 / 1 | wolves 3%, starvation 2% (win) | none / — | rich |
| `tallgrass` | Tallgrass Reach | steppe | bonefield | salt_flats, bonefield, herd_trail, split_rock, mistwood | 1 | 2 / 2 / 2 / 2 / 1 | — (0) | seasonal pool / Y | balanced |
| `south_range` | South Range | steppe | neutral | bonefield, herd_trail, tar_seeps, claw_gorge, ash_hills, wolf_run | 1 | 2 / 2 / 2 / 2 / 1 | wolves 3%, bear 1% | none / — | balanced |
| `split_rock` | The Split Rock | steppe | neutral | greywater_ford, bonefield, tallgrass, salt_flats, mistwood, twin_forks | 1 | 2 / 2 / 2 / 2 / 1 | — (0) | none / — | safe |
| `twin_forks` | Twin Forks | riverine | neutral | upper_greywater, greywater_ford, split_rock, reedbank, drowned_mere | 1 | 2 / 3 / 2 / 2 / 2 | flood 3% (spr) | river / N | balanced |
| `reedbank` | Reedbank | wetland | mistwood | greywater_ford, twin_forks, mistwood, drowned_mere, mere_shore | 1 | 2 / 3 / 3 / 2 / 1 | flood 2% (spr) | marsh / N | balanced |
| `mistwood` | The Mistwood | pinewood | mistwood | tallgrass, split_rock, reedbank, fog_paths, west_spur, mere_shore, bears_throat | 1 | 2 / 2 / 2 / 2 / 1 | — (1% lost_trail) | marsh / N | balanced |
| `fog_paths` | Fog Paths | pinewood | mistwood | mistwood, west_spur, mere_shore, island_mere | 1 | 2 / 2 / 2 / 1 / 1 | lost_trail 3% | marsh / N | balanced |
| `west_spur` | West Spur | pinewood | neutral | mistwood, fog_paths, island_mere, blue_caves | 1–2 | 2 / 2 / 2 / 2 / 1 | — (1%) | none / — | safe |
| `drowned_mere` | The Drowned Mere | lakeshore | neutral§ | twin_forks, reedbank, mere_shore, island_mere, east_saddle | 1 | 2 / 3 / 2 / 1 / 1 | thin_ice 8% (spr), 2% (win on ice) | lake / Y | rich |
| `mere_shore` | Mere Shore | lakeshore | neutral | reedbank, mistwood, fog_paths, drowned_mere, island_mere | 1 | 2 / 3 / 3 / 2 / 1 | thin_ice 3% (spr) | lake / Y | balanced |
| `island_mere` | Island Mere | wetland | neutral | fog_paths, west_spur, drowned_mere, mere_shore | 1–2 | 2 / 3 / 2 / 2 / 1 | thin_ice 4% (spr), flood 2% | lake / Y | balanced |
| `east_saddle` | East Saddle | alpine | neutral | north_pass, drowned_mere, claw_gorge, ash_hills | 2 | 1 / 2 / 2 / 1 / 0 | avalanche 3%, rockfall 2% | meltwater / Y | hardship |
| `bears_throat` | The Bear's Throat | gorge | neutral | mistwood, claw_gorge, tar_seeps | 1 | 1 / 1 / 1 / 1 / 1 | bear 12%, rockfall 3% | none / — | deadly |
| `claw_gorge` | Claw Gorge | gorge | neutral | south_range, bears_throat, tar_seeps, ash_hills, east_saddle | 1 | 1 / 1 / 2 / 1 / 1 | bear 5%, rockfall 2% | none / — | deadly |
| `tar_seeps` | The Tar Seeps | tarlands | neutral | bonefield, south_range, bears_throat, claw_gorge, ash_hills | 1 | 2 / 2 / 2 / 2 / 2 | tar 10%, wolves 2% | none / — | rich |
| `ash_hills` | The Ash Hills | ashscape | wolves | south_range, claw_gorge, east_saddle, wolf_run, camel_ridge, tar_seeps | 1–2 | 2 / 1 / 3 / 2 / 1 | wolves 10%, starvation 2% (win) | none / — | deadly |
| `wolf_run` | Wolf Run | ashscape | wolves | ash_hills, camel_ridge, south_range | 1 | 1 / 1 / 2 / 1 / 1 | wolves 14% | none / — | deadly |
| `camel_ridge` | Camel Ridge | ashscape | neutral¶ | herd_trail, ash_hills, wolf_run | 1 | 1 / 1 / 3 / 2 / 0 | wolves 6%, starvation 3% (win) | none / — | rich |

Notes on the table:
- \* `blue_caves` is low prey but offers den shelter (+Warmth when resting); tier `safe` for shelter value, not hunting.
- † `greywater_ford` startHolder `highcrag` with `disputedBy: bonefield` (claim contested from day 1).
- ‡ `west_spur`–`blue_caves` is a long 2-day mountain skirt edge (optional path around Highcrag; listed in both adjacency rows).
- § `drowned_mere` is neutral; Mistwood has soft influence via adjacent claims, not ownership.
- ¶ `camel_ridge` is neutral but wolf-pressured (`pressureFaction: wolves`).
- Legacy 10 ids are the ones Saga already wrote blurbs for; the other 20 need new blurbs after approval.

### 4.2 Starting pride territories

| Pride / faction | Core den region | Starting claimed regions | Notes |
|---|---|---|---|
| Highcrag | `highcrag` | `highcrag`, `horse_meadows`, `upper_greywater`, `greywater_ford` (disputed) | Traditional, defensive. Won't expand fast. |
| Bonefield | `bonefield` | `bonefield`, `herd_trail`, `tallgrass`; disputes `greywater_ford` | Aggressive expander toward ford and south_range. |
| Mistwood | `mistwood` | `mistwood`, `fog_paths`, `reedbank` | Smallest; cautious; `mere_shore` starts wild (lost in the Breaking), its first reclaim target. |
| Dire wolves (faction) | `ash_hills` | `ash_hills`, `wolf_run` | Not a playable pride. Pressure on `camel_ridge`, `south_range`, `tar_seeps`. **v1: static holder, scent pressure + hazards only; never expands or retreats.** Pack AI later. |
| Player start | — | none | Starts at **`split_rock`** as a loner (world-gen may override). |

Neutral at start: `ice_wall`, `frost_tongue`, `blue_caves`, `wind_scree`, `north_pass`, `salt_flats`, `south_range`, `split_rock`, `twin_forks`, `west_spur`, `drowned_mere`, `mere_shore`, `island_mere`, `east_saddle`, `bears_throat`, `claw_gorge`, `tar_seeps`, `camel_ridge`.

---

## 5. Adjacency and travel

5.1 Move only to an adjacent region (undirected edges in `map.json`).
5.2 Each travel day is a full travel action (needs §1.4 / §2 Energy, needs tick, injury). A 2-day edge takes 2 consecutive days and cannot be cancelled midway.
5.3 Winter may raise edge cost via `winterDays` (default = `days`). Used on glacier/alpine edges.
5.4 **Edge list** (both directions; omit mirrors):

| a | b | days | winterDays |
|---|---|---|---|
| ice_wall | frost_tongue | 1 | 2 |
| ice_wall | blue_caves | 1 | 2 |
| ice_wall | wind_scree | 1 | 2 |
| ice_wall | north_pass | 2 | 3 |
| frost_tongue | blue_caves | 1 | 2 |
| frost_tongue | highcrag | 1 | 2 |
| frost_tongue | wind_scree | 1 | 1 |
| blue_caves | highcrag | 1 | 1 |
| blue_caves | west_spur | 2 | 3 |
| wind_scree | horse_meadows | 1 | 1 |
| wind_scree | salt_flats | 1 | 1 |
| north_pass | highcrag | 1 | 2 |
| north_pass | east_saddle | 2 | 3 |
| highcrag | horse_meadows | 1 | 1 |
| highcrag | upper_greywater | 1 | 1 |
| horse_meadows | upper_greywater | 1 | 1 |
| horse_meadows | greywater_ford | 1 | 1 |
| upper_greywater | greywater_ford | 1 | 1 |
| upper_greywater | twin_forks | 1 | 1 |
| greywater_ford | bonefield | 1 | 1 |
| greywater_ford | twin_forks | 1 | 1 |
| greywater_ford | split_rock | 1 | 1 |
| greywater_ford | reedbank | 1 | 1 |
| salt_flats | tallgrass | 1 | 1 |
| salt_flats | split_rock | 1 | 1 |
| salt_flats | herd_trail | 2 | 2 |
| bonefield | herd_trail | 1 | 1 |
| bonefield | tallgrass | 1 | 1 |
| bonefield | south_range | 1 | 1 |
| bonefield | split_rock | 1 | 1 |
| bonefield | tar_seeps | 1 | 1 |
| herd_trail | tallgrass | 1 | 1 |
| herd_trail | south_range | 1 | 1 |
| herd_trail | camel_ridge | 1 | 1 |
| tallgrass | split_rock | 1 | 1 |
| tallgrass | mistwood | 1 | 1 |
| south_range | tar_seeps | 1 | 1 |
| south_range | claw_gorge | 1 | 1 |
| south_range | ash_hills | 1 | 2 |
| south_range | wolf_run | 1 | 1 |
| split_rock | mistwood | 1 | 1 |
| split_rock | twin_forks | 1 | 1 |
| twin_forks | reedbank | 1 | 1 |
| twin_forks | drowned_mere | 1 | 1 |
| reedbank | mistwood | 1 | 1 |
| reedbank | drowned_mere | 1 | 1 |
| reedbank | mere_shore | 1 | 1 |
| mistwood | fog_paths | 1 | 1 |
| mistwood | west_spur | 1 | 1 |
| mistwood | mere_shore | 1 | 1 |
| mistwood | bears_throat | 1 | 1 |
| fog_paths | west_spur | 1 | 1 |
| fog_paths | mere_shore | 1 | 1 |
| fog_paths | island_mere | 1 | 1 |
| west_spur | island_mere | 1 | 2 |
| drowned_mere | mere_shore | 1 | 1 |
| drowned_mere | island_mere | 1 | 2 |
| drowned_mere | east_saddle | 2 | 2 |
| mere_shore | island_mere | 1 | 1 |
| east_saddle | claw_gorge | 1 | 1 |
| east_saddle | ash_hills | 2 | 2 |
| bears_throat | claw_gorge | 1 | 1 |
| bears_throat | tar_seeps | 1 | 1 |
| claw_gorge | tar_seeps | 1 | 1 |
| claw_gorge | ash_hills | 1 | 1 |
| tar_seeps | ash_hills | 1 | 1 |
| ash_hills | wolf_run | 1 | 1 |
| ash_hills | camel_ridge | 1 | 1 |
| wolf_run | camel_ridge | 1 | 1 |

Everything is reachable. Longest home-to-home pride trip is about 3 hops.

---

## 6. Hazards

6.1 Each day the cat **ends** in a region, roll every listed hazard independently at its daily %. Season tags gate the roll (e.g. `thin_ice` only in spring unless noted).
6.2 On a hit, pick a fitting existing event if Saga has one; else apply the default below. **No new event types required for v1 engine** beyond these mechanical outcomes.

| hazard id | Default outcome | Notes |
|---|---|---|
| `avalanche` | Serious injury 60% / minor 40%; block the edge used today for 3 days | alpine / glacier |
| `thin_ice` | Serious injury + forced swim (−20 Warmth, −30 Energy) or drown death in Sim only at 5% | lakeshore spring; the Breaking lore |
| `tar` | Escape roll: clamp(50 + 5×Endurance M, 20, 90)%. Fail → Serious injury + stuck 1 day | tarlands |
| `bear` | Encounter short-faced bear: flee (Endurance) or fight (formulas §4, lethal in Standard/Sim). Win → rare large carcass | gorge |
| `wolves` | Dire-wolf patrol: lose 1 medium carcass if carrying / hunting, or minor injury 40%, or flee | ashscape + winter pressure elsewhere |
| `starvation` | If Hunger already Hungry or worse: extra −10 Hunger (environmental scarcity), else no-op | hardship biomes |
| `cold_snap` | −15 Warmth today (stacks with blizzard) | glacier / tundra |
| `flood` | Travel out costs +1 day today; 20% minor injury | riverine spring |
| `rockfall` | Minor injury 80% / serious 20% | alpine / gorge |
| `lost_trail` | Waste the day (no hunt); −10 Energy | pinewood fog |

6.3 Style mult on injury hazards: Story ×0.5, Standard ×1, Sim ×1.5 (play-styles §2.3), same as fight injuries.
6.4 Region `danger` 0–3 from the lean draft is **derived** for UI as: max daily hazard % band → 0 (<2), 1 (2–5), 2 (6–10), 3 (>10). Flint may show either.

---

## 7. Risk / reward / time profiles

| Tier | Play intent | Typical prey | Typical daily hazard | Claim value |
|---|---|---|---|---|
| `safe` | Early roam, dens, meetings | 1–2 | ~0–2% | low |
| `balanced` | Everyday hunting / home | 2 | ~1–4% | medium |
| `rich` | Worth the trip or the fight | 3 (seasonal) | ~3–8% | high |
| `hardship` | Shortcut or story, not a home | 0–1 | cold / starve | very low |
| `deadly` | High-stakes scavenging or warpath | 1–3 situational | ≥10% or bear/wolves | high if cleared |

Time tradeoff: rich/deadly regions are often 1–2 days from safe dens. A 2-day edge into `ash_hills` for summer camels is a planned expedition, not a casual stroll.

---

## 8. Local rules (still apply)

8.1 **Water:** drink action, or free drink when travelling into a water region (needs §1.3). Frozen → eat-snow only.
8.2 **Prey → hunt points:** as formulas §1 (0/−10, 1/0, 2/+5, 3/+10), using the season's prey value.
8.3 **Trespass (loner / visitor):** ending a day in a region claimed by another pride (claim ≥ `trespassClaimMin`, default 40) or disputed: **10%** patrol meeting → −5 pride relation; hostile pride may start a fight (formulas §4). Loner `homeZones` are never treated as that loner's territory.
8.4 **Encounters:** loners-spec §2.3 (15% in home zone, 5% adjacent) uses §5 adjacency.
8.5 **Start:** player at `split_rock` unless world-gen says otherwise.

---

## 9. Territory contest system

### 9.1 Claim state per region

Each region stores, per prideId (and `wolves` faction):

```
claim[prideId] = 0..100   // scent / control strength
```

Derived:
- `holder` = pride with highest claim, if claim ≥ `holdMin` (default **50**); else `neutral` (or `wolves` if wolves lead).
- `disputedBy` = second pride if its claim ≥ `contestMin` (default **30**) and within `contestGap` (default **20**) of the leader.
- `state`: `wild` | `held` | `contested`.

Core den regions (`highcrag`, `bonefield`, `mistwood`, `ash_hills` for wolves) cannot fall below claim 60 for their home faction while that faction still has ≥ 3 adult members (soft floor). If the faction is wiped out, the den becomes wild.

### 9.2 Pride strength

`prideStrength` = Σ fight stat (formulas §4.1) over adult + elder members who are not Crippled, × `cohesion` (0.7–1.1 from morale/contentment average).
Bands (loners §5b) use band strength and can contest for `territory` as already specified; on a band territory win, the zone is marked `bandHeld` for 2 seasons (unclaimable by prides), then reverts to wild with residual scent 20.

### 9.3 Upkeep (scent-marking / patrol)

9.3.1 Each season, a pride owes **`upkeepCost = regionsHeld + (1 if any contested)`** patrol-days (tunable `upkeepPerRegion` default 1).
9.3.2 Player assigns Patrol actions (adults/adolescents). Each patrol-day spent in a held/contested region: claim +`patrolGain` (default **15**), capped 100.
9.3.3 AI auto-spends up to `ceil(adults/2)` patrol-days on highest-value held/contested regions.
9.3.4 End of season, for each held/contested region:
- If upkeep met for that region: claim −`decayUpkept` (default **5**).
- If upkeep missed: claim −`decayMissed` (default **20**).
- Wild regions with leftover scent: −`decayWild` (default **10**) per season toward 0.

Over-claim: if `regionsHeld > adults`, each excess region takes an extra −10 claim at season end (supply line strain).

### 9.4 Claiming and losing

9.4.1 **Mark (player action):** in a wild or enemy region, spend 1 day: claim +`markGain` (default **25**) for the player's pride (requires founded pride). First mark on a wild region sets claim 25.
9.4.2 **Hold:** when claim crosses `holdMin` and no rival is within `contestGap` above `contestMin`, region becomes `held`.
9.4.3 **Lose:** when holder claim falls below `holdMin`, holder clears; if a rival is ≥ `holdMin`, they become holder; else wild.
9.4.4 **Founding:** when the player founds a pride, their current region (if wild) gains claim 60 automatically as first den. If occupied, founding requires winning a contest or picking a wild neighbour.

### 9.5 Contested resolution (border skirmishes)

Each season, every `contested` region rolls once:

`P(skirmish) = clamp(30 + (leaderClaim − rivalClaim), 10, 80)`%

On skirmish:
1. Both sides commit up to `skirmishCap` (default 3) adults (AI picks strongest available; player is prompted if online that day, else AI-for-player uses top fighters).
2. Resolve as group fight (formulas §4.2). Non-lethal by default (injury as §4.3). Story: never lethal. Standard/Sim: 5%/10% lethal only if both leaders personally fight (rare).
3. Winner: claim +`skirmishWin` (default **20**). Loser: claim −`skirmishLose` (default **25**). Relation −5 between prides.
4. If after adjustment only one side remains ≥ `contestMin`, state becomes `held`.

Player may **Yield** a contested region: claim set to 0, rival +10, morale −10 (mirrors band yield tone).

### 9.6 AI expansion and retreat

At season end, each AI pride (Highcrag, Bonefield, Mistwood). In v1 the wolves faction skips §9.6 entirely (`factions.wolves.activeAI: false`): its claims stay fixed, it never marks or abandons, and it acts only through hazards and scent pressure.


1. Compute `foodNeed` = clamp( (mouths × 40 − store) / 40, 0, 3 ).
2. If `foodNeed` ≥ 2 or `regionsHeld` < `targetRegions` (HC 4, BF 5, MW 4): consider expansion.
3. Pick adjacent wild or weakly held region (enemy claim < 40) with highest `prey[season] − hazardPenalty`.
4. If `prideStrength ≥ 0.9 × defenderStrength` (wild defenderStrength = 0; wolves use pack strength tunable 40): spend a mark (+25 claim) automatically.
5. **Retreat:** if `foodNeed` ≤ 0 and a non-den held region has claim < 55 and hazardPenalty high, AI may drop claim to 0 (abandon) 25% of the season.

Temperament lean (lore): Highcrag expands rarely (+10 required strength edge). Bonefield expands eagerly (−10 edge). Mistwood prefers wetland/pinewood and abandons faster when starving.

### 9.7 Early-game shield (lone cat)

Until the player has founded a pride:
- Player cannot hold claim.
- AI does **not** target the player with contest marks.
- Only §8.3 trespass meetings apply when the player ends a day in held land.
- Founding is available once the player has a mate or has recruited ≥ 1 adult (existing loners / lifecycle rules). Exact founding gate stays with loners-spec; this map only supplies the land rules.

### 9.8 Player claiming and losing (summary)

| Action | When | Effect |
|---|---|---|
| Mark | Founded pride, in region | +25 claim |
| Patrol | Held/contested, founded | +15 claim, pays upkeep |
| Win skirmish | Contested | +20 / rival −25 |
| Miss upkeep | Season end | −20 claim |
| Yield | Contested | claim 0, morale −10 |
| Fall below holdMin | Any time | lose holder status |

---

## 10. Data model (`src/renderer/data/map.json`)

`dataVersion`: **1** for this draft. Owned values: Tundra. File ownership: Flint.

### 10.1 Schema (conceptual)

```json
{
  "dataVersion": 1,
  "biomes": [{ "id": "glacier", "warmthPerDay": -15, "defaultHazards": [] }],
  "hazards": [{ "id": "thin_ice", "seasons": ["spring"], "basePct": 8, "outcome": "thin_ice" }],
  "regions": [{
    "id": "split_rock",
    "name": "The Split Rock",
    "biome": "steppe",
    "tier": "safe",
    "prey": 2,
    "preyBySeason": { "spring": 2, "summer": 2, "autumn": 2, "winter": 1 },
    "water": "none",
    "freezes": false,
    "warmthPerDay": 0,
    "hazards": [],
    "startHolder": "neutral",
    "disputedBy": null,
    "coreDen": false,
    "pressureFaction": null,
    "polygonRef": "split_rock"
  }],
  "edges": [{ "a": "split_rock", "b": "mistwood", "days": 1, "winterDays": 1 }],
  "factions": [
    { "id": "highcrag", "kind": "pride", "coreDen": "highcrag", "targetRegions": 4, "expandEdge": 10 },
    { "id": "bonefield", "kind": "pride", "coreDen": "bonefield", "targetRegions": 5, "expandEdge": -10 },
    { "id": "mistwood", "kind": "pride", "coreDen": "mistwood", "targetRegions": 4, "expandEdge": 5 },
    { "id": "wolves", "kind": "pack", "coreDen": "ash_hills", "targetRegions": 2, "packStrength": 40, "activeAI": false }
  ],
  "startClaims": [
    { "regionId": "highcrag", "prideId": "highcrag", "claim": 80 },
    { "regionId": "horse_meadows", "prideId": "highcrag", "claim": 70 },
    { "regionId": "upper_greywater", "prideId": "highcrag", "claim": 65 },
    { "regionId": "greywater_ford", "prideId": "highcrag", "claim": 55 },
    { "regionId": "greywater_ford", "prideId": "bonefield", "claim": 45 },
    { "regionId": "bonefield", "prideId": "bonefield", "claim": 80 },
    { "regionId": "herd_trail", "prideId": "bonefield", "claim": 70 },
    { "regionId": "tallgrass", "prideId": "bonefield", "claim": 65 },
    { "regionId": "mistwood", "prideId": "mistwood", "claim": 80 },
    { "regionId": "fog_paths", "prideId": "mistwood", "claim": 70 },
    { "regionId": "reedbank", "prideId": "mistwood", "claim": 65 },
    { "regionId": "ash_hills", "prideId": "wolves", "claim": 75 },
    { "regionId": "wolf_run", "prideId": "wolves", "claim": 70 }
  ],
  "tunables": {
    "holdMin": 50,
    "contestMin": 30,
    "contestGap": 20,
    "trespassClaimMin": 40,
    "trespassMeetPct": 10,
    "upkeepPerRegion": 1,
    "patrolGain": 15,
    "markGain": 25,
    "decayUpkept": 5,
    "decayMissed": 20,
    "decayWild": 10,
    "skirmishBase": 30,
    "skirmishCap": 3,
    "skirmishWin": 20,
    "skirmishLose": 25,
    "playerStartRegion": "split_rock"
  },
  "overlay": {
    "ownershipTintAlpha": 0.35,
    "contestedStripe": true,
    "factionColors": {
      "highcrag": "#7A8B9A",
      "bonefield": "#A67C52",
      "mistwood": "#5B7F6A",
      "player": "#C4A35A",
      "wolves": "#6E6A66",
      "neutral": "#00000000"
    }
  }
}
```

### 10.2 Art / polygon contract (Ochre)

- Ochre paints one high-res top-down map in the ref's style (painted terrain, ornate border).
- Export `map-polygons.json`: `{ "dataVersion": 1, "image": "vale-map.png", "regions": [{ "id": "<regionId>", "points": [[x,y], ...] }] }` in image pixel space.
- `polygonRef` on each region defaults to `id`. Code tints the filled polygon by `overlay.factionColors[holder]` at `ownershipTintAlpha`. Contested regions get a stripe of holder + rival colours when `contestedStripe` is true.
- **No sketch until Anna approves this layout** (Director).

### 10.3 Save versioning / migration

- `run.map.dataVersion` stored in the save.
- On load, if save `dataVersion` < current `map.json` dataVersion, run `migrateMap(save, from, to)`:
  - New regions appear as wild with claim 0.
  - Removed ids (none expected soon) dump claim into nearest neighbour or wild.
  - Tunable renames apply defaults.
- Forward-compatible hooks already reserved in schema: `preyBySeason`, `hazards[].seasons`, `factions` (dire wolves), `winterDays`, weather stream (future: blizzard flags per region-day).

### 10.4 Copy keys (Saga)

Existing: `map.region.<legacyId>.description` in `docs/map-copy.md`.
After approval, Saga adds keys for the 20 new ids. Names in §4.1 are provisional working titles; Saga may rename display strings without changing ids.

---

## 11. Tunables summary (`map.tunables` / formulas cross-link)

| Key | Default | Role |
|---|---|---|
| holdMin | 50 | claim needed to hold |
| contestMin | 30 | claim to count as contestant |
| contestGap | 20 | max gap to stay contested |
| trespassClaimMin | 40 | claim that triggers trespass rolls |
| trespassMeetPct | 10 | daily patrol meet chance |
| upkeepPerRegion | 1 | patrol-days per held region / season |
| patrolGain / markGain | 15 / 25 | claim gains |
| decayUpkept / Missed / Wild | 5 / 20 / 10 | seasonal decay |
| skirmishBase / Cap / Win / Lose | 30 / 3 / 20 / 25 | border fights |
| playerStartRegion | split_rock | default spawn |
| preyPoints | {0:−10,1:0,2:+5,3:+10} | hunt (formulas §1) |

---

## 12. Balance targets (Tracker)

1. Fresh loner spring week at `split_rock`: expected hazard hits ≤ 1 in 20 days; trespass only if they walk into held land.
2. Highcrag vs Bonefield at `greywater_ford`: remains contested ≥ 60% of spring seasons under AI-only play.
3. Mistwood reclaims `mere_shore` (claim ≥ holdMin) within 2 seasons in ≥ 50% of AI-only runs, unless the player or Bonefield contests it.
4. Holding 6+ regions with 4 adults without patrols drops average claim below holdMin within 2 seasons.
5. Summer camel expedition `split_rock` → `camel_ridge` is 3–4 days one way; wolf hazard on the ash legs is real but not a guaranteed death in Story.

---

## 13. Resolved (Director, 2026-11-06)

1. 30 regions for v1. Data-driven, so we can grow it later.
2. Dire wolves in v1: scent pressure + hazards only (`activeAI: false`). Active pack faction is a later update.
3. `mere_shore` starts wild, contestable from day 1.

---

## Changelog

- v0.1 (2026-11-06, Tundra): lean 10-zone draft; legacy Saga ids; basic travel, prey, danger, trespass.
- v1.0 DRAFT (2026-11-06, Tundra): Anna's painted-map direction. 30 regions, 11 biomes, prey-by-season, hazard table, risk/reward tiers, full adjacency, dynamic territory contest (claim, upkeep, skirmish, AI expand/retreat), dataVersion + polygon/overlay contract, early-loner shield. Awaits Anna's approval before build/art.
- v1.0.1 DRAFT (2026-11-06, Tundra): Director's calls applied. `mere_shore` starts neutral; MW targetRegions 4; wolves static in v1 (`activeAI: false`); balance target 3 rewritten.
