# Payoff fixtures (debug only)

These scenes are for Tracker. They are not in the game window, and a release build does not ship `src/dev/`.

Set `SABRETOOTH_PAYOFF_FIXTURES=1`. Do not set `SABRETOOTH_RELEASE`. Then:

```
SABRETOOTH_PAYOFF_FIXTURES=1 node src/dev/payoff-fixtures.js day10
SABRETOOTH_PAYOFF_FIXTURES=1 node src/dev/payoff-fixtures.js you-came
SABRETOOTH_PAYOFF_FIXTURES=1 node src/dev/payoff-fixtures.js i-waited
SABRETOOTH_PAYOFF_FIXTURES=1 node src/dev/payoff-fixtures.js let-watch
SABRETOOTH_PAYOFF_FIXTURES=1 node src/dev/payoff-fixtures.js gossip
```

Each command prints one seed-8 Ravenmark scene.

- `day10` is day 10 with Sleet already met. The card offers "Meet me tomorrow".
- `you-came` is the next day in that place: "You came."
- `i-waited` is the next day somewhere else: "I waited at".
- `let-watch` is the next meeting after Let them watch: "You ate the whole thing".
- `gossip` is a pridemate who heard Greyfall: "spoke of".

The offer still requires a cat who has already been met. An unmet cat does not get it.
