# Sabretooth: Loners Spec (v0.4, DRAFT, design-only)
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

## 5b. Bachelor bands (decided by Anna via Director, 2026-11-04)
5b.1 **What a band is:** a temporary group of 2–3 adult male loners, like a male lion coalition. A band is not a 4th pride: it has no territory, no den, and no cubs. Female loners stay solitary.
5b.2 **Forming:** each season, if 2 or more adult male loners share a home zone and have mutual affinity ≥ 30, there's a 20% chance they form a band. At most 2 bands exist at once. A band's home range is the union of its members' home zones.
5b.3 **Band strength:** the sum of the members' fight stats × 1.1, a coordination bonus.
5b.4 **Challenges:** each season, a band picks a target pride (an AI pride or the player's). It can only target a pride where band strength ≥ 0.8 × the strength of that pride's defending adults.
   - It challenges with a 25% chance per season.
   - The player gets 1 turn of warning (scent sign) before a challenge on their pride.
   - The band challenges for either `mates` (resident males) or `territory` (one border zone). It picks `mates` if the pride's resident males are elders or injured, otherwise `territory`.
5b.5 **Resolution:** a group fight, band strength vs defender strength, each side ± 20% random. The loser retreats injured.
   - Death chance per fighter: 0% in Story, 5% in Standard, 10% in Sim (see play-styles-spec).
   - **Band wins `mates`:** the band joins the pride as its resident males and dissolves. Ousted males become loners. For the player's pride, if the player cat is ousted, the Death rule applies: it counts as a run end in Permadeath, an heir takes over in Heir, and the player becomes a loner in Sandbox.
   - **Band wins `territory`:** the band takes the zone as part of its roaming range for 2 seasons, and it can't be claimed during that time. The player pride gets −10 morale.
   - **Band loses:** −20 cohesion, and it leaves the target's zones for 2 seasons.
5b.6 **Cohesion and breakup:** cohesion runs 0–100 and starts at 60. It gains +10 per successful hunt or win and changes by −2 per season.
   - A band breaks up when cohesion is ≤ 20, when it drops to 1 member, or when it wins a `mates` challenge.
   - Each season there's also a 10% random breakup chance.
   - Members return to being solo loners.
5b.7 **The player and bands:** before founding a pride, a male player cat can join a band. That requires affinity ≥ 40 with every member and a band size below 3. A band with the player in it never challenges on its own; the player decides. Founding a pride ends the band, and members with affinity ≥ 40 may follow the player as recruits under §3, with no roll needed.
5b.8 **Data:** `Band { bandId, memberIds[], homeZones[], cohesion, formedAt, cooldowns {prideId: seasons} }`. A Cat gets `bandId: string|null`.

## 6. World drift (keeps the population alive)
6.1 Each season, a loner has an 8% chance to rejoin a pride. Use the origin pride if pride affinity ≥ 0, otherwise a random pride with relation ≥ 0. A loner already recruited or mated is excluded.
6.2 Each season, each pride has a 5% chance to lose 1 cat to exile or departure, and that cat becomes a new loner. Saga provides the event.
6.3 Loners age and die under the normal lifecycle rules.

6.4 **Player-pride departures (decided by Anna via Director: depends on Style; numbers are designer calls).** Each cat has `contentment` from 0 to 100. Inputs:
   - fed this season +10, starving −15;
   - has a mate or close bond +10;
   - role fits personality +5;
   - recently injured in a pride fight −5;
   - groomed or favoured by the player +5;
   - low loyalty: (loyalty − 50) / 5.
   **What each Style allows:**
   - **Story:** player-pride cats never leave.
   - **Standard:** if contentment stays below 25 for 2 seasons in a row, warning signs fire for 1 season (Saga events: sleeping apart, eating last, gazing at the border). If contentment is still below 25 after that, the cat has a 30% chance per season to leave.
   - **Sim:** the threshold is below 35 for 1 season, warnings last 1 season, and then the chance is 40% per season. Two more rules apply:
     - **Lure:** if a rival pride, band, or loner has affinity ≥ 40 with an unhappy cat (contentment below 50), there's a 15% chance per season they lure it away. A warning event fires first.
     - **Dispersal:** each young male reaching young-adult age has a 50% chance to disperse within 2 seasons. This doesn't apply if he's the designated heir or the pride has no other resident adult male.
   **Who is protected:** the player's mate and designated heir never leave in Standard. In Sim they leave only if their contentment is below 15.
   **Player responses:** during a warning, the player can groom, share food, change the cat's role, or confront it, at +5 to +15 contentment each, capped at once per season per cat.
   **After leaving:** a departed cat becomes a loner with `originPrideId` set to the player's pride and `departure: left`. It can be recruited back under §3, and its starting affinity is its contentment at departure minus 50.

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
| band.size / maxBands | 2-3 / 2 |
| band.formChance / challengeChance per season | 20% / 25% |
| band.strengthBonus / minStrengthRatio | 1.1 / 0.8 |
| band.cohesionStart / breakupAt / randomBreakup | 60 / 20 / 10% |
| leave.std threshold / seasons / chance | <25 / 2 / 30% |
| leave.sim threshold / seasons / chance | <35 / 1 / 40% |
| sim.lureChance / dispersalChance | 15% / 50% |
| drift.loneRejoin / prideExile per season | 8% / 5% |

## 9. Questions for Anna (via Director)
9.1 (Decided: 11/10/9 + 9 loners.)
9.2 (Decided: no 4th pride; temporary bachelor bands instead, see §5b.)
9.3 (Decided: it depends on Style. See §6.4 and play-styles-spec §2.12.)
