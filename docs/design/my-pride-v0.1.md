# My Pride screen v0.1.1
Status: v0.1 APPROVED by Director 2026-11-10 (with Scout + daily orders moved into v1); v0.1.1 additions PROPOSED DEFAULT (Tundra, 2026-11-10), from Anna's request via Director. Uses the cat-directory-v0.1 list, filters, favourites and detail view. v1 actions only hook into rules that already exist; no new numbers.

## 1. When it shows what
1.1 `player.status` is `loner` or `group`: empty state (Saga's copy). No actions.
1.2 `pride_founded` fires: the screen unlocks and opens once with the new pride. Members: player, mate, cubs, recruits.
1.3 `player.status === member` (joined an AI pride): members listed read-only, no management (you are not the leader).
1.4 Members are always "known" for every directory field except personality, which still follows cat-directory §2.

## 2. Summary header (words only, no numbers)
- **Size:** "{n} cats" plus adults / cubs / elders in words ("three adults, two cubs").
- **Territory:** one line per held region, claim (map-v1 §9) in words: ≥ 80 "Strong", 50–79 "Held" (`holdMin`), 30–49 "Slipping", or "Contested" (this wins over every other word) when another faction is within `contestGap` and ≥ `contestMin`; < 30 "Lost". "Patrol due" when the region has had no Patrol or Mark this season. Never on Lost ground (claim < 30): that line shows "Lost" only, and winning it back is a Mark under map §5, not a patrol.
- **Food:** days of food = pride store ÷ (12 × members), using needs §1.2 Hunger decay. Members = every living pride member, cubs and the player included. Under 1 "Nothing left", 1 to under 3 "Running low", 3 to under 6 "Enough for now", 6 or more "Plenty". Sim (per-cat hunger): the hungriest member's need band instead.
- **Threats:** only facts the player knows, newest first, max 2 lines: a §5b.4 band warning ("A band is watching"), scent sign read or a Scout report of another faction or band in or next to a held region ("{faction} scent at your border"), else "Quiet".
- **Pride food store (needed by Food and Hunter):** needs §0.3's Standard pooled store, as one integer `pride.food` in Hunger points. A kill brought home adds its eat value (needs §1.2: small 25, medium 50, large 80 per member present). A small or medium kill adds its value once, never per member: a Hunter's medium kill is +50 total. Each day, members eat 12 each in Feeding order until it runs out.

## 3. v1 actions (existing rules)
| # | Action | Where | Rule it uses |
|---|---|---|---|
| 1 | Assign role: Hunter, Guard, Scout, Cub-sitter (engine `nursemaid`); daily order Hunt / Patrol / Rest | detail view | play-styles §3.2; contentment "role fits personality +5" (loners §6.4); leadership XP (skills §10) |
| 2 | Feeding order | header | play-styles §3.2 (Standard) |
| 3 | Groom / Share food with a member | detail view | §6.4 player responses, same as meeting Groom/Share |
| 4 | Designate heir | detail view | heir mode + `heir_trainer` (skills §9.3); one heir at a time |
| 5 | Exile a member | detail view, needs confirm | becomes a loner per §6.4 "After leaving", but `departure: exiled`, origin = your pride, pride affinity −30 (loners §2.5). Not allowed for mate, heir or cubs. |
| 6 | Name / rename pride | header | `newPrideName`; text only, no effect |
| 7 | Patrol, Mark | stay player day actions | milestone-2 §3.6 / map-v1 §9 (link from the Territory line) |

3.1 Style: in **Story**, roles are auto-assigned and shown as suggestions the player can accept or ignore (play-styles §3.1). In **Sim**, feeding is per-cat, so Feeding order lists cats instead of a pool order (§3.3).
3.2 Role change uses the §10.4 rule when the cat is in a warning (counts as that cat's once-per-season response).

## 4. What each action does (one small effect, existing rules only)
| # | Action | Effect |
|---|---|---|
| 4.1 | **Hunter** | Each day the cat runs the formulas §1 hunt with its own skills on medium prey (the same roll as the player's Hunt; the encounter is auto-resolved). A success adds the kill to the store (§2). |
| 4.2 | **Guard** | Each Guard's own fight strength counts ×1.1 in the pride's defending strength for loners §5b.4 targeting and §5b.5 resolution (the band coordination bonus, reused), so bands target you less and lose more. |
| 4.3 | **Cub-sitter** (`nursemaid`) | With at least one cub-sitter, a cub's +10% starving death chance (lifecycle §4.1) applies only when the store is empty, and cubs take no harm from a lost §5b challenge. Only offered once the pride has cubs. |
| 4.4 | **Scout** | Each day the cat runs the player's Scout border outcome (lone-cat-actions action 4) on one held border region. Anything it finds becomes a known fact and feeds the Threats line. |
| 4.5 | **Daily order** (once per cat per day, overrides the role for that day) | **Hunt** = 4.1 for one day; **Patrol** = map-v1 §9 Patrol (+15 claim) on one held region, max one Patrol per region per day across the pride; **Rest** = the cat does nothing else and its injury or illness heals 1 day faster (needs §2.2 resting rule). |
| 4.6 | **Feeding order** | When the store can't feed everyone, cats eat in this order. An unfed cat counts a starvation day (needs §1.2: Standard −10 Health/day from day 3). Default: cubs, then the order shown. |
| 4.7 | **Groom / Share** | Same effects as in a meeting (loners §6.4 responses). |
| 4.8 | **Heir** | The designated cat is played next in Heir mode, ahead of main-menu §7's ranking, if still eligible; otherwise that ranking applies. |
| 4.9 | **Exile** | As §3 row 5. |
| 4.10 | **Name** | Text only. |
4.11 Role fit: a role that matches the cat's top trait gives "role fits personality +5" (loners §6.4): Hunter and Scout boldness, Guard aggression, Cub-sitter sociability.
4.12 No button ships without its effect. If an effect isn't built, the button doesn't show.

## 5. Later (needs a new system)
- Exiling the mate (needs a mate-bond break rule) and other members' reaction to an exile.
- Cub training orders (season 3 roadmap).

## 6. Directory note
"Gossip named the role" stays in v1: Saga tags role-naming gossip lines with `namesRole`, and hearing one sets role known.

## Changelog
- v0.1.3 (2026-11-10): "Patrol due" never shows on Lost ground (Saga question).
- v0.1.2 (2026-11-10): Tracker review. A kill adds its value once (large stays per member present); members for food include cubs and the player; food-word ranges made exact; Contested wins over other claim words; Guard ×1.1 is per guard, so two guards add two bonuses.
- v0.1 (2026-11-10): first version.
- v0.1.1 (2026-11-10): Director's changes: Scout and daily orders moved into v1; §4 effects per action; header cutoffs and the pride food store; gossip-names-role kept.
