# Sim hooks (debug only)

The encounter, world, and lifetime engines are not written yet. This harness seeds an RNG, runs a stub adapter, and prints a JSON or CSV log. A release build does not ship `src/dev/`.

Set `SABRETOOTH_SIM=1`. Do not point a packaged build at this file.

```
SABRETOOTH_SIM=1 node src/dev/sim-hooks.js encounter --seed 8 --kind spar
SABRETOOTH_SIM=1 node src/dev/sim-hooks.js batch --seed 8 --kind spar --count 4
SABRETOOTH_SIM=1 node src/dev/sim-hooks.js world --seed 8 --seasons 4
SABRETOOTH_SIM=1 node src/dev/sim-hooks.js lifetime --seed 8 --days 20
```

Add `--csv` to any command for CSV. `--player` and `--opponent` set the encounter ids.

- `encounter` logs one seeded stub row unless `SABRETOOTH_ENCOUNTER_ENGINE=1`. The flag defaults off. With the flag, quick resolve uses the §8.2 bands: fight edges 50/71/90/10, hunt 55/50/30, and the courtship point roll. Sensible fight at equal strength is about 66%. A spar stops at 40 HP. Showdown is not simulated. Policy names stay `average`, `sensible`, `biteOnly`, `fleeAt30`, `steady`, `allBold`, and `readTraits`. `node src/dev/encounter-parity.js` prints the measured rates. Numbers live in `src/renderer/data/encounter-engine.json`.
- `batch` repeats the stub row unless `SABRETOOTH_ENCOUNTER_ENGINE=1`. With the flag it runs the approved engine. JSON and CSV include the batch seed and any failing trial seeds.
- `bands` prints the encounters v0.1.1 §8.3 table. Each line is `band 1` through `band 15` with PASS or FAIL against the target in `encounter-engine.json`. Band 6 is hunt steady at 55%, with its Energy and injury. Band 7 is hunt bold at 64%, and both costs are higher. Band 8 is showdown: identical seeds, no differences, and the engine still skips it. Band 9 is a spar that ends at 40 HP with no injury rolls. Band 10 is the traits-read courtship delta, at most +15 points. Band 12 is a reload of the same seed. Band 13 exposes HP and no other number. The game flag stays off.

Fight bands 1–5 in that table, and `node src/dev/encounter-parity.js`, use 2,000 fights per cell at ±3 percentage points. That is the regular check. A tighter pass is opt-in and is not part of `npm test`: 20,000 fights per cell at ±1 percentage point. When that flag is set, the band table prints the ±3pp lines and a `slow` line for each fight cell.

```
SABRETOOTH_SIM=1 SABRETOOTH_ENCOUNTER_ENGINE=1 node src/dev/sim-hooks.js encounter --bands --seed 8 --count 4000
SABRETOOTH_PARITY_SLOW=1 SABRETOOTH_SIM=1 SABRETOOTH_ENCOUNTER_ENGINE=1 node src/dev/sim-hooks.js bands --seed 8
```
- `world` starts from the map's real claims and logs holder, state, and claim strength for each season. The stub then records one placeholder change of hands (`todo: yes` in CSV). That change is not a territory rule.
- `lifetime` logs one row per day: deeds, witnesses, level, and title. Deed and witness text are template ids. The lifetime engine is not attached.

Replace `engines.encounter`, `engines.world`, and `engines.lifetime` in `src/dev/sim-hooks.js` when those systems exist. Keep the runners and the seed streams.
