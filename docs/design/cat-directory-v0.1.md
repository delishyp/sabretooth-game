# Cat directory v0.1 (Anna's "cats you've met")
Status: PROPOSED DEFAULT (Tundra, 2026-11-10), from Anna's request via Director. Display only: no rule, roll or number changes. Nothing hidden is ever shown as a number.

## 1. Who is listed
1.1 Only cats with `met === true`. Unmet cats never appear, not even as silhouettes.
1.2 Dead or gone cats stay listed with a "Gone" marker (existing portrait, dimmed). They can still be favourited.

## 2. Fields and when each counts as known
| Field | Shown as | Known when | Else |
|---|---|---|---|
| Portrait | existing head portrait | met | n/a (appearance gating rule still applies) |
| Name | name | met | n/a |
| Sex | Female / Male | met | n/a |
| Age group | Cub / Adolescent / Adult / Elder (from stage) | met | n/a |
| Age in words | from `ageSeasons` (lifecycle §2): 0–3 "A cub", 4–11 "Half-grown", 12–19 "Young adult" (lifecycle §2.3), 20–31 "In their prime", 32–39 "Getting grey", 40+ "An elder". Saga may reword; the 32 split is display only. Exact years later. | met | n/a |
| Faction | pride name or "Loner" | met | n/a |
| Role | Leader / Hunter / etc. (existing role) | repeat meeting with that cat, or a gossip fact naming the role that the player has heard | "Unknown" |
| Relationship | band label from the cat→player value (Neutral, A Welcome Face, Liked...) | met | n/a; never the number |
| Personality | trait words, e.g. "Bold", "Quick to anger" | a trait is known once a scene variant chosen by that trait (high or low band) has played for the player | "Nothing stands out yet" |
| Last seen | "Day 6, Wind Scree" | latest of `lastMeetDay` or a `seen_by_player` presence | n/a |
| History | Saga's templates, newest first, 10 shown, then "Show older" | from `conversationLog`, `memoryFacts`, `encounters` the player took part in | Saga's empty-state line |
| Aside / gossip | Saga's lines | aside: after the cat has used it as an opener. Gossip: only lines the player actually heard | hidden |

2.1 Never shown: affinity numbers, `attraction`, kinship `r`, mid-band personality, motives the cat has not voiced, facts the player does not know (`knowsFact` from the player's side).
2.2 A known field does not become unknown again.

## 3. Sort, filter, search
3.1 Sort: favourites first, then living before gone, then most recently seen, then name A–Z.
3.2 Filters (combine with AND): faction (each pride + Loner), sex, age group, relationship band, favourites only.
3.3 Search: case-insensitive "contains" on name. Filters and search are UI state only, not saved.

## 4. Save fields
4.1 New: `directory.favorites: catId[]` and `directory.traitSeen: { [catId]: traitId[] }`. Everything else is derived from fields already saved.
4.2 Migration: missing `directory` → `{ favorites: [], traitSeen: {} }`. No other save change.
4.3 Tests (Flint): favourite survives save/reload; filters AND correctly; an unmet cat never appears; an unknown role reads "Unknown"; no digits in any relationship or personality text.

## Changelog
- v0.1.1 (2026-11-10): Director/Anna: age shows in words from `ageSeasons`, not "Unknown".
- v0.1 (2026-11-10): first version.
