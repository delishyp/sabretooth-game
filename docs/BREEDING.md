# Breeding and cubs

The rules are in `docs/design/breeding-cubs-v0.1.md` (v0.1f.2). Player-facing lines are `src/renderer/data/events/breeding-lines-v0.1b.json`. The overcrowding figures come from `sim/overcrowding_sim_v0.1.py`.

## Calendar

A year is 80 days, four seasons of 20. A cub is a cub until 4 seasons, an adolescent until 8, and an adult from 8. The player still starts at 12 seasons. `hc09` and `mw08` are 7 seasons old so they stay adolescents.

Conception is on a spring day the mates are together. Birth is 20 days later, in summer. A female can conceive each spring if she is not already pregnant. Litter size is 1 to 7. The spoken size is `a cub`, `a few cubs`, `several cubs`, or `many cubs`. A litter of one uses the `size1` lines.

## Overcrowding

Capacity is 4 cats per region the pride holds, and cubs count. A contested region still counts for its holder. Each season over capacity adds 5 discontent, and the hit stops at 20. Contentment does not decay. The player's pride does not conceive while it is over capacity. An AI pride conceives a litter only when that litter still fits. A female with no unrelated mate at home may pair with a male from another pride, and he moves to hers.

## Genes and saves

Personality is the parents' average plus a small random swing. Aptitude is rolled once. Taught aptitude starts at 0. A marking is a data row with its own layer and a fallback layer. The label is the layer that is actually drawn, so a spotted cat drawn with the tiger fallback reads Tiger. The portrait compositor is unchanged.

A version 1 save becomes version 2. `genes.v` is rewritten to 2. `birthAbsDay` counts back from the current season. Older saves still load.

## Lines

`Breeding.momentLines` fills Saga's lines. `{needsWord}` is the worst need that is critical or empty, in the order worn, thirsty, hungry, tired, cold, and otherwise well enough. `{regionWord}` may be omitted. A sentence never starts with a token. `litter_lost` plays before the normal heir or permadeath flow. `story_retire` is its own hook and does not use a death line. Online, local, and offline paths are the nested keys in the line pack, including `offlineFallback`.
