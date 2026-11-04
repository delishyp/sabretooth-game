# Sabretooth: Loners Spec (v0.2, DRAFT, design-only)
Owner: Tundra (rules and numbers). Backstories and all player-facing text: Saga. Not in the build yet; the menu is still the active build task.
All numbers are starting values to tune.

## 1. Population (LOCKED by Anna via Director, 2026-11-04)
1.1 39 premade cats: Pride A 11, Pride B 10, Pride C 9 (30 pride cats) and 9 loners. Saga assigns which named pride is A/B/C.
1.2 Every loner came from a pride: 2 from A, 3 from B, 4 from C (each pride started at 13). The smallest pride has shed the most cats, which is a story hook for Saga. Each loner record has `originPrideId` and `departure` (`left` | `exiled` | `survivor`; survivor is optional).
1.3 Suggested loner mix: 5 male / 4 female; 2 young adult, 5 adult, 2 elder.
1.4 Each pride keeps at least 2 breeding-age males and 3 breeding-age females, so no pride is doomed at game start.

## 2. Behavior
2.1 **Home range:** each loner has 1–2 home zones in neutral or border land. A loner never holds a claimed territory.
2.2 **Daily state:** each turn a loner rolls one of `roam` 40%, `hunt` 25%, `rest` 20%, or `scavenge` 15%. A hungry loner (hunger < 30) adds +20 to `hunt` and `scavenge`.
2.3 **Encounters:** the player meets a loner with a 15% chance per turn in that loner's home zone and 5% in adjacent zones.
2.4 **Affinity:** affinity toward the player runs from −100 to +100. It starts at 0, then shifts by +10 if `sociability` is 70 or higher and by −10 if `aggression` is 70 or higher.
   - Player actions: share a kill +10, groom +5 (requires affinity ≥ 20), help against a threat +15, ignore 0, chase off −15, attack −30.
   - Affinity drifts 2 points per season back toward its starting value if the two cats don't interact.
2.5 **Toward prides:** a loner has a pride affinity for its origin pride. It starts at −30 if exiled, 0 if left, and +10 if a survivor. A loner with affinity of −30 or lower avoids that pride's territory.

## 3. Recruitment (after the player founds a pride)
3.1 **Eligibility:** affinity ≥ 40, the loner is not an elder past their fertile age (elders may still join as non-breeders), and the pride is below its size cap.
3.2 **Join chance per ask:** `clamp(20 + (affinity − 40) × 1.5 + (sociability − 50) × 0.5, 5, 90)`%. A failed ask costs −5 affinity, and the player can't ask that loner again for 1 season.
3.3 **Consequence with the origin pride:** recruiting an exiled loner changes the player pride's relation with the loner's origin pride by −15. Recruiting a loner who left voluntarily changes it by −5. Recruiting a survivor changes nothing.
3.4 **After joining:** a recruited loner starts with loyalty 50 (out of 100), compared with 70 for cats born into the pride.

## 4. Mates
4.1 Loners are eligible mates before and after the player founds a pride, under the same courtship rules as pride cats.
4.2 **Tradeoff:** courting a loner skips the pride rival challenge and pride-leader approval, so it's easier and faster. It gives no alliance bonus. A pride-cat mate gives +20 relation with that cat's pride.
4.3 A loner who becomes the player's mate joins the pride automatically when it's founded, with no recruitment roll.

## 5. Rivals and threats
5.1 A loner with aggression ≥ 70 and affinity ≤ −20 is a **rival**. A rival may:
   - steal an unguarded kill, at 25% per encounter;
   - attack a lone pride member, at 10% per turn in a shared zone;
   - target cubs, possible only when no adult is guarding the den; risk rolled on the protection need.
5.2 A rival never claims territory or challenges for pride leadership.
5.3 Driving off a rival gives +5 pride morale. A driven-off rival leaves the player's zones for 2 seasons.
5.4 A loner with aggression below 70 is never a threat. At worst it scavenges, sharing a carcass with no loss to the pride.

## 6. World drift (keeps the population alive)
6.1 Each season, a loner has an 8% chance to rejoin a pride. Use the origin pride if pride affinity ≥ 0, otherwise a random pride with relation ≥ 0. A loner already recruited or mated is excluded.
6.2 Each season, each pride has a 5% chance to lose 1 cat to exile or departure, and that cat becomes a new loner. Saga provides the event.
6.3 Loners age and die under the normal lifecycle rules.

## 7. Data (additions)
```json
Cat: { "status": "pride|loner", "originPrideId": "string|null", "departure": "left|exiled|survivor|null",
       "homeZones": ["zoneId"], "affinityToPlayer": 0, "prideAffinity": { "prideId": 0 }, "isRival": false }
```

## 8. Tunables
| Key | Default |
|---|---|
| pride.sizes A/B/C | 11 / 10 / 9 |
| loner.count | 9 (origin 2 / 3 / 4) |
| encounter.homeZone / adjacent | 15% / 5% |
| affinity.recruitMin | 40 |
| recruit.failCooldownSeasons | 1 |
| recruit.relationPenalty exiled / left | −15 / −5 |
| rival.aggressionMin / affinityMax | 70 / −20 |
| rival.stealChance / attackChance | 25% / 10% |
| drift.loneRejoin / prideExile per season | 8% / 5% |

## 9. Questions for Anna (via Director)
9.1 (Decided: 11/10/9 + 9 loners.)
9.2 Can loners pair up and form a small 4th pride over time? This draft says no, to keep 3 prides.
9.3 Should the player's own cats ever leave and become loners (6.2 applied to the player pride)? This draft says no.
