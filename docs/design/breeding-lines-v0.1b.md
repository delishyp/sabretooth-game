# Breeding lines v0.1b (Saga, content only)

Source: Tundra's breeding and cubs spec, `docs/design/breeding-cubs-v0.1.md` **v0.1d DRAFT**, local commits `9cf44bc` (year final, open-ended markings) and `1daf10f` (marking labels). Built from the v0.1a pack to close Tracker's copy-review gaps. Content only: no commit, no push, no branch. The v0.1 and v0.1a packs are left in place.

Files:

- `breeding-lines-v0.1b.json`
- `breeding-lines-v0.1b.md` (this guide)
- `build_breeding_lines_v0.1b.py` (loads v0.1a and patches it; does not rewrite v0.1 or v0.1a)
- `scan_breeding_lines.py` (defaults to v0.1b when present; still scans v0.1a with the original gates if you pass that path)

The copy still names no durations, season counts, year length, coats, patterns (including spotted, rosette, or tiger), or saber colour. Anna's later growth and summer-birth rulings do not require a prose rewrite.

## What changed from v0.1a

1. **`natural_death` offline coverage.** Offline fallbacks now exist for **adolescent**, **adult**, and **player_no_heir**, alongside the existing cub, elder, mate, and player_heir paths. Each path has three narration variants. `player_no_heir` does not use `{heirName}` or `mateReactionPlayerDeath`. It hands off to the normal permadeath / game-over flow (`_then` on that leaf). `story_retire` stays its own hook, with no death wording.

2. **Size-1 birth grammar.** New key: `size1`, on `litter_born`. When `litterWordBySize` is `"a cub"` (litter size 1), Flint should use `size1.narration`, `size1.outcome`, `size1.mateReaction`, and `size1.offlineFallback` so verbs and pronouns agree ("the cub is" / "the cub", not "they're" / "them"). For size 2–7, use the main lines, which still say "they're". The token is still `{litterWord}`; there is no new spoken token, and the size is never printed as a number.

3. **Offline variants.** Every offline path has at least three narration variants, except **`litter_lost.playerDam`**, which stays the single ruled line "The cubs you were carrying are lost." (outcome: "The litter is lost."), then the normal death flow. Tracker's single-case gaps are filled too:

   - `fertility_ended` has **self** and **other**
   - `stage_up_elder` has **self** and **other**
   - `first_hunt` has **went_well** and **came_to_nothing**
   - `stage_up_adult` has **default** (no friendship beat) and **friendships**
   - `cub_died` has **starving**, **illness**, **threat**, and **natural**

   Related coverage, so a sire or dam player is not stuck on the wrong line: `pregnancy_known`, `pregnancy_progress`, and `litter_born` offline now branch on **playerDam** / **playerSire**.

   Wiring: `narration` on each leaf is an array. Flint may pick any entry. `outcome` and `mateSay` may be a shared string. Nested keys select the path. Documented in `idRules.offlineVariants`.

## Scan

```
python3 /workspace/saga-narrative-voice/breeding/scan_breeding_lines.py
python3 /workspace/saga-narrative-voice/breeding/scan_breeding_lines.py /workspace/saga-narrative-voice/breeding/breeding-lines-v0.1a.json
```

Result on v0.1b: **PASS** (752 player-facing strings). No digits, number words, em dashes, unfilled tokens, placeholders, saber colour, spotted/rosette, or duration wording. Every variant set has `base`. Every moment has an offline fallback. `story_retire` has no death words. The `needsWord` set and `litterWordBySize` map are complete. `natural_death` offline covers adolescent, adult, and player_no_heir. Every offline path has at least two variants except the fixed-by-ruling dam-side `litter_lost` line. `litter_born.size1` is present and singular.

Result on v0.1a with the same scanner: **PASS** (603 player-facing strings). The v0.1b-only gates are skipped when `version` is `v0.1a`.

## Tokens

`{playerName}`, `{mateName}`, `{damName}`, `{sireName}`, `{cubName}`, `{catName}`, `{litterWord}`, `{suggestedName}`, `{needsWord}`, `{standoutLook}`, `{sexWord}`, `{teacherName}`, `{branchWord}`, `{heirName}`, `{regionWord}`.

`{coatWord}` is not used. No new spoken token was added for size-1 births.

## Wiring notes for Flint

Same as v0.1a, with these additions:

- On `litter_born`, if the litter size is 1, use the `size1` block. Otherwise use the main narration, outcome, mate reactions, and offline lines.
- Pick one entry from each offline `narration` array. Nested keys (`playerDam` / `playerSire`, `self` / `other`, `went_well` / `came_to_nothing`, `default` / `friendships`, cub-death causes, and `natural_death` stages) select the path.
- `litter_lost.playerDam` is still one line, then the normal death flow. Do not add variants there.
- If the player dies with no heir, play `natural_death.player_no_heir`, then the normal permadeath / game-over flow. Do not play `heir_named` or `mateReactionPlayerDeath` on that path.
- Fire `story_retire` instead of `natural_death` when the player cat retires in Story mode. Do not also fire a death hook.


## v0.1b note: lowercase tokens

`{litterWord}` and `{needsWord}` resolve to lowercase words ("a cub", "thirsty"), so they never open a sentence. Birth lines read "You have {litterWord}", "{damName} has had {litterWord}" or "The pride has {litterWord}". The scan fails any sentence that starts with either token.
