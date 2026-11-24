# Cat presence on quiet days v0.1 DRAFT (Tundra, 2026-11-10)

Status: PROPOSED DEFAULT. No new numbers, rolls or deltas. Fixes Tracker's "vantage / loose stone / small hunt have no cats".

## 0. Shared rules
1. **Present cat** = a living adult/elder NPC with `met = true` whose existing `zoneBand()` is `home` for the current region (`near` for vantage only). No affinity gate: being *seen* needs no bond. Speaking first (action 8) keeps its |value| ≥ 20 gate.
2. Pick order is the existing `approachOrder()` (follow-up priority first, then id). First present cat wins.
3. At most one presence scene a day, and it uses the day's `approach` receipt. If action 8 already fired today, these don't fire, and vice versa.
4. If no cat is present, the current scene plays unchanged. Never invent a cat.
5. Every presence scene records a `seen_by_player` fact (private) and puts that cat first in tomorrow's `priorityIds`.

## 1. Watch from a vantage (action 7)
The first present cat (`home` or `near`) becomes a sighting beat: what it is doing, taken from its existing state (hunting, patrolling, heading toward a zone, with another cat).
Choices:
- `go_down`: starts the normal meeting with that cat today (existing `slice.meeting.loner` / `m2.repeat_meeting` choices and deltas). Vantage's +20 Energy still applies.
- `keep_watching`: tomorrow's Seek out lands in that cat's zone (same effect as a Shadow reveal, no spotted roll). 0 delta.

## 2. Loose stone (`slice.region.wind_scree`) and the stone on East Saddle (`slice.region.east_saddle`)
When a cat is present, the falling stone was that cat. Choices:
- `call_out`: starts the normal meeting (existing greet/pass/drive and deltas).
- `hold_still`: records the sighting, with the same effect as `keep_watching`.
- `move_on`: no effect.
If no cat is present, the existing small-animal text plays.

## 3. Successful small hunt
The kill draws the first present cat (`home` only). Choices:
- `share`: existing share, which needs today's kill: +10, and it fulfils a pending `bring_prey` (§11.3.5).
- `warn_off`: 0 personal delta. Records a `refused_share` fact for follow-ups.
- `let_watch`: 0, with talk only.
If a pride owns the zone and the cat is from that pride, its opener is about trespass, but there's no extra trespass roll; the day's existing roll already ran.

## 4. Spar (Tracker open item 2)
Spar stays at value ≥ 20 (lone-cat-actions §3): it's a reward for a built bond. It becomes reachable through the presence scenes above, since each one leads to a real meeting. For cats below 20, show Spar as a locked choice with in-world text ("{name} doesn't know you well enough to wrestle with you yet") rather than hiding it.

## Changelog
- v0.1 DRAFT (2026-11-10): first version for Director's quiet-days ask.
