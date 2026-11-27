# Pride councils

Player-facing council text lives in `src/renderer/data/events/council-scenes-v2.json` (Saga's council scenes v2a). That file is the source. The engine reads `speechLocations` through `Speech.resolve`, and standing words through `standingOutcomes`. `subjectName` and `yourPride` are not council tokens.

## Voice

Each leader row has `focusTrait`, `base`, `high`, and `low`. `byCat` is unset, so a band can still be chosen.

| Leader | Pride | Trait |
| --- | --- | --- |
| `hc01` | `highcrag` | `loyalty` |
| `bf01` | `bonefield` | `aggression` |
| `mw01` | `mistwood` | `sociability` |

`high` is 70 or above. `low` is 30 or below. Anything else, or a missing personality, uses `base`.

## Standing (§10.5, §10.6, §13a)

One council moves a pride by at most 2 from stances: +2 if the player spoke for it, −2 if they spoke against it, and 0 if both or neither.

Walking out costs 2 with every seated pride, from the same pool, on top of a stance already taken in that council. In the offline scene, Leave is the choice instead of a stance, so only the walk-out applies.

`save.councils[prideId].lifetimeDelta` is the pool. It stays inside ±10. A shift that would cross the cap is cut to the room that is left (a pride at −9 that walks out moves to −10, and the receipt delta is −1). The line follows that applied change. Any nonzero applied change plays the warmer or cooler line and writes a receipt for the applied amount, even when the new total is exactly ±10. "{pride} has made up its mind about you." plays only when the applied change is 0. That line is narration and Lore Book only, and it writes no receipt.

Deal-break costs stay the old −15/−10 and do not touch this pool.

## Season

A pride sits at one council a season. `records.lastCouncilSeason` remembers that season, including after save and reload. An older save with no season stored can still sit. After this season's council, Go to the council uses the locked-action wording until the next season. A feud that boils over can still call the early council in that same season.

## Offline

`offlineFallback.id` is `council.offline.complete`. It can play with no storyteller. Every offered choice (`speak_for_a`, `speak_for_b`, `stay_out`, `leave`) has a branch. Speaking for Bonefield has Bonefield accept and Highcrag refuse, with the standing lines reversed. `{thirdPride}` is the seated pride that is not a party to the item. Leave stays last. A seated but unrecognised leader does not get Leave.

## Receipts

A real shift writes one ledger row, `sourceType` `council_stance` or `council_walk_out`, with the applied delta. The same receipt key does not apply twice after save and reload.
