# In-game copy (Saga)

In-game interface strings, in the same `strings` format as `main-menu-copy.md`. Flint merges them on sync.

## 1. Court action (formulas-spec v0.2)

```json
{
  "strings": {
    "action.court": "Court",
    "action.court.outOfSeason": "Courting waits for {seasons}. Until then, spend time together.",
    "action.court.cooldown": "{targetName} needs time. Try again in {days} days.",
    "action.court.cooldownOne": "{targetName} needs time. Try again tomorrow.",
    "season.spring": "spring",
    "season.summer": "summer",
    "season.autumn": "autumn",
    "season.winter": "winter",
    "season.listJoin": " or "
  }
}
```

Notes for Flint:
- `outOfSeason` is the hint on the greyed-out Court action. Build `{seasons}` from the `breedingSeasons` tunable, using the `season.*` names joined with `season.listJoin` (by default it reads "Courting waits for spring."). Capitalise only at the start of a sentence.
- Use `cooldown` while that target's `attemptCooldownDays` is running, or `cooldownOne` when 1 day is left. `{targetName}` is the cat's current name.

## 2. Relationship bands (relationships-spec v0.1.2; Director 2026-11-05: players see these labels, not raw band ids)

```json
{
  "strings": {
    "rel.band.hostile": "Bad Blood",
    "rel.band.cold": "Wary",
    "rel.band.neutral": "Indifferent",
    "rel.band.warm": "Friendly",
    "rel.band.close": "Close",
    "rel.band.unmet": "Strangers",
    "rel.band.withValue": "{band} ({value})",
    "rel.couldBeInterested": "Could be drawn to you",
    "rel.notInterested": "Not drawn to you"
  }
}
```

Notes for Flint:
- Use `unmet` instead of `neutral` for a pair with no stored record, meaning they've never interacted.
- `withValue` and the two `rel.*Interested` lines show only for a player with `read_affinity`, and the interest lines only toward adults (Director 2026-11-05).
