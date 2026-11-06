# Sabretooth: Region Map v1 (DRAFT, Tundra, 2026-11-06)
Scope is Anna via Director: a lean map with regions the player can visit. Zone ids are Saga's draft ids from `lore/world-and-prides.md`, kept as they are because `loners.json` `homeZones` already uses all 10. Code is Flint's, art is Ochre's, flavour text is Saga's.

## 1. Regions

| id | Name | Held by | Prey (0–3) | Danger (0–3) | Water | Notes |
|---|---|---|---|---|---|---|
| `ice_wall` | The Ice Wall | neutral | 1 | 2 | meltwater (frozen in winter) | extra −10 Warmth per day spent here |
| `highcrag` | Highcrag | Highcrag Pride | 2 | 1 | upper river | home territory |
| `bonefield` | The Bonefield | Bonefield Pride | 3 | 1 | none | home territory, where the herds pass |
| `mistwood` | The Mistwood | Mistwood Pride | 2 | 1 | marsh | home territory |
| `greywater_ford` | Greywater Ford | border: Highcrag (claimed), Bonefield (disputes it) | 3 | 2 | river (never freezes) | contested hunting ground |
| `split_rock` | The Split Rock | neutral | 2 | 0 | none | neutral hunting ground and meeting place; player start |
| `drowned_mere` | The Drowned Mere | border: Mistwood | 2 (geese, spring–summer only; 1 otherwise) | 1 | lake (frozen in winter) | thin ice in spring (the Breaking) |
| `tar_seeps` | The Tar Seeps | neutral | 2 | 3 | none (tar isn't drinkable) | dangerous scavenging ground |
| `bears_throat` | The Bear's Throat | neutral | 1 | 3 | none | a short-faced bear dens here |
| `ash_hills` | The Ash Hills | dire wolves (not playable in v1) | 2 (camels in summer; 1 otherwise) | 3 | none | dangerous zone, wolf country |

## 2. Connections (both directions; cost in days of travel)

| From | To | Days |
|---|---|---|
| ice_wall | highcrag | 1 (2 in winter) |
| highcrag | greywater_ford | 1 |
| highcrag | split_rock | 1 |
| highcrag | bears_throat | 1 |
| greywater_ford | bonefield | 1 |
| greywater_ford | drowned_mere | 1 |
| bonefield | split_rock | 1 |
| bonefield | tar_seeps | 1 |
| bonefield | ash_hills | 2 |
| split_rock | mistwood | 1 |
| mistwood | drowned_mere | 1 |
| mistwood | bears_throat | 1 |
| tar_seeps | ash_hills | 1 |

Everything is reachable, and the longest trip between home territories is 2 hops.

## 3. Rules (these plug into needs-spec)
1. **Travel:** move to an adjacent region only. Each day of travel is a full travel action, with the normal Energy, needs tick and injury costs from needs-spec §1.4 and §2. A 2-day edge takes 2 consecutive days, and the trip can't be cancelled midway.
2. **Water:** in a region with water, drinking is the normal drink action. Travelling into a water region drinks for free (needs §1.3). When water is frozen, only the eat-snow rule applies.
3. **Prey:** a region's prey level adds to hunt points (formulas §1): 0 → −10, 1 → 0, 2 → +5, 3 → +10.
4. **Danger:** each day the player ends in a region, roll a hazard: danger 0 / 1 / 2 / 3 → 0 / 2 / 5 / 10%. A hit uses an existing event if one fits; otherwise it's a generic minor injury (needs §2). There are no new events in v1.
5. **Trespass:** ending a day in another pride's territory, a border region they hold, or a disputed one has a 10% chance of a patrol meeting. The meeting costs −5 pride relation with that pride, and a hostile pride starts a fight (formulas §4). Loner home zones aren't territory.
6. **Start:** the player starts at `split_rock` unless world-gen sets otherwise.
7. **Encounters:** the loner encounter chances in loners §2.3 (15% in a home zone, 5% in adjacent zones) use the §2 connections.

## 4. Data (`src/renderer/data/map.json`, owned by Flint, values owned by Tundra)
`{ "regions": [{ "id", "name", "holder": "highcrag|bonefield|mistwood|neutral|wolves", "disputedBy": null|prideId, "prey": 0-3, "preyBySeason": {"summer":2}?, "danger": 0-3, "water": "none|river|lake|marsh|meltwater", "freezes": bool, "warmthPerDay": 0 }], "edges": [{ "a", "b", "days", "winterDays"? }] }`

Region polygons come from Ochre's art JSON, keyed by `id`.
