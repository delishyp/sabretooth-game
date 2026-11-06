# Slice 1: "First season as a loner" (v1.0.1, Tundra, 2026-11-06)

Goal: smallest playable loop. Anything not listed under IN is OUT.

## IN
1. **Start:** the creator as it is (c30e539), then spring day 1 at `split_rock`. Standard style and permadeath only.
2. **Map:** all 30 regions from map-v1 §4 as data (`map.json`) in a functional UI: the current region's card (biome, this season's prey, danger 0–3, water, owner) and buttons for adjacent regions. Start claims are shown as labels only. No painted art.
3. **Day loop:** one action per day: **Hunt**, **Rest** or **Travel** to an adjacent region (map §5 days, −15 Energy per day). Drinking is free in water regions (map §8.1). Then the overnight tick. HUD shows day X/20.
4. **Needs (needs §1, Standard):** Health, Hunger, Thirst, Energy, plus the minor and serious injury chips from §2. Warmth is fixed at OK and Mood at normal.
5. **Hunt (formulas §1):** base, prey size (small/medium/large), region prey bonus (map §8.2), Hungry, Health < 50, and the Tired gate. No skills, perks or party. Success means eating at once (+25/+50/+80).
6. **Hazards:** map §6 daily rolls at day end, default outcomes only, spring-gated, Standard multiplier. Bear and wolves use the flee result only (no fight in the slice).
7. **Meetings:** trespass patrols (map §8.3: 10%, −5 relation; hostile means chased off, minor injury 30%) and loner or pride-cat meetings (loners §2.3). Each shows the cat's portrait plus Saga's offline event; choices change affinity only. `affinityIntent` deltas apply to that cat's affinity toward the player (loners §2.4 scale): improve **+5**, unchanged **0**, worsen **−5**. A cat can gain from improve once per day at most. Patrol choices change the individual cats' affinity only; the pride-relation trespass −5 stays separate. Tunables: `slice.affinityIntent.{improve,unchanged,worsen}`.
8. **Story events:** Saga's offline library, at most 1 per day, keyed by region or biome.
9. **Save/load:** 1 manual slot plus an autosave each day; the save carries `dataVersion`.
10. **End:** after day 20, a season summary (days survived, regions visited, cats met, best affinity). On death, the same summary with the cause.

## OUT
Courtship and mating, founding a pride, the territory contest (map §9; AI claims stay frozen at the start claims), skill and perk progression, Warmth, Mood, illness, fights (formulas §4), online and local storytellers, Story/Sim/heir/sandbox modes, painted map, weather, dire-wolf AI, relationship scenes beyond meetings, aging.

Note: map-v1 layout isn't approved by Anna yet; region data may change without code changes.

## Changelog
- v1.0 (2026-11-06): scope approved by Director.
- v1.0.1 (2026-11-06): affinityIntent deltas for Saga's events (+5 / 0 / −5).
