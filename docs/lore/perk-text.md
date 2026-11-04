# Perk Text: Seven Perks with New Content (skills-spec v0.2.1 §15.5)

Owner: Saga. Status: **DRAFT v0.1**, 2026-11-04. Mechanics and numbers are Tundra's (skills-spec §2). The perk card's mechanics line, with its concrete number, comes from the spec (§12.2). The lines here are the name, the one-line description, and the flavour line shown when the perk is picked.
None of these relies on Thirst, so all seven work in Story (needs §3.1a). Events are in `events/perk-events.md`.

The JSON block is the data for `menu-copy`-style sync (keys `perk.<id>.name|desc|pick`). Every `desc` is 140 characters or fewer.

```json
{
  "strings": {
    "perk.giant_slayer.name": "Giant-Feller",
    "perk.giant_slayer.desc": "Once a season, hunt a giant: a mammoth calf, a ground sloth, a bison bull. It feeds the pride for days, if it doesn't kill you.",
    "perk.giant_slayer.pick": "The old bones in the Bonefield were hunted once, by someone. You mean to learn how.",

    "perk.false_trail.name": "False Trail",
    "perk.false_trail.desc": "Once a season, lay false scent along your border, so a wandering may turn toward another pride instead of yours.",
    "perk.false_trail.pick": "Scent is the one thing the Vale believes. So you've learned to lie with it.",

    "perk.herd_calendar.name": "Herd-Memory",
    "perk.herd_calendar.desc": "You sense where the herds will gather next season, and your hunts there go better when it comes.",
    "perk.herd_calendar.pick": "The herds walk the same old roads every year. You've started to remember them before they do.",

    "perk.famine_path.name": "Hunger Trail",
    "perk.famine_path.desc": "Once a winter, lead your pride to a hidden hollow where the cold hasn't thinned the prey, for a few days.",
    "perk.famine_path.pick": "Somewhere the snow lies thinner and the deer still feed. You found it. You'll tell no one but your own.",

    "perk.envoy.name": "Border Envoy",
    "perk.envoy.desc": "Once a season for each pride, walk to its border to talk instead of fight. That pride thinks better of yours.",
    "perk.envoy.pick": "A pride that has heard your voice at the border hasn't needed to hear your roar.",

    "perk.truce.name": "Border Truce",
    "perk.truce.desc": "Ask a pride that bears you no ill will for peace on the borders. For two seasons, neither side fights there.",
    "perk.truce.pick": "Two prides, one scent line, and a promise both will keep. For now.",

    "perk.warlord.name": "Border-Taker",
    "perk.warlord.desc": "Once a season, demand a border from a weaker pride. They give it up, and they won't forget who took it.",
    "perk.warlord.pick": "You don't ask for the land. You lie down on it, and wait to see who argues."
  }
}
```

## Notes for Tundra and Flint
- `giant_slayer`'s "giant prey" is a Saga event target. The three kinds are mammoth calf, ground sloth and old bison bull (world-and-prides §1, Prey). Which one appears could follow the season: calves in spring and summer, sloths any time, bulls in autumn and winter. That's flavour only, with one rule and one roll per spec, and Tundra decides whether to use it.
- `envoy` and `truce` text is written so it works for a player pride or a lone cat before founding. If `envoy` should need a founded pride, say so and I'll trim the "lone" variants.
- `warlord` text assumes the zone is always taken, because the spec has no refusal. The "won't forget" is flavour for the −15 relation.
