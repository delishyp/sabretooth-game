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
- `batch` repeats that row. The same seed and count always print the same rows.
- `world` starts from the map's real claims and logs holder, state, and claim strength for each season. The stub then records one placeholder change of hands (`todo: yes` in CSV). That change is not a territory rule.
- `lifetime` logs one row per day: deeds, witnesses, level, and title. Deed and witness text are template ids. The lifetime engine is not attached.

Replace `engines.encounter`, `engines.world`, and `engines.lifetime` in `src/dev/sim-hooks.js` when those systems exist. Keep the runners and the seed streams.
