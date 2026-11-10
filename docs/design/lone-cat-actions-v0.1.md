# Lone-cat daily actions (v0.1 DRAFT, Tundra, 2026-11-09)
Every rule is PROPOSED DEFAULT unless it cites an existing spec. Existing formulas, needs, consent gates, skill pacing (skills §3, 20 XP/day cap, repetition x0.75/x0.5) and receipts (milestone-2 §12.3) are unchanged. No new resources or art.
## 0. Shared rules
1. One main action per day stays (needs §0.4). Actions marked free don't use it, and each free action is once per day.
2. Energy uses the existing scale (needs §1.4): a light action is -5 and a field action -15. The style multiplier applies (needs §3.1).
3. XP uses the existing table (skills §3.1-3.5): success 10, failure 4, with the primary skill named per action.
4. Every value, standing or hunger change commits once under receipt `runId/{action}/{targetId}/{absDay}`, and reload never repeats it.
5. Each action produces a fact (`wm.fact.learn`) or a ledger line that the narrator and cats can reference later.
## 1. Read scent sign (free, 0 Energy, primary `threatScent`; success if anything is found, else 4 XP)
- In the current zone, reveal what passed through in the last 2 days: known cats and prides (names only if met), rival marks, a fresh kill if one exists, prey sign (the zone's current prey value as thin, fair or rich) and hazards.
- Deterministic: it reads saved world state with no roll. Unknown cats show as "a strange male/female".
- Unlocks Shadow and Steal targets (later) and gossip lines.
## 8. Cats come to you (NPC initiative; free, no player cost)
- Each day, at most one known cat in the player's zone with |value| >= 20 may approach first. Its traits choose the opener: sociable cats chat or gossip, aggressive rivals warn or taunt, loyal cats ask for help and curious cats ask questions. The approach reuses the existing loner encounter roll (loners §2.3) for that cat.
- Gossip: in any talk with a cat at value >= 20, the cat may share one fact it actually knows (§12 `knowsFact`), and the player may pass one on (`rumor_spread`). No invented facts.
- Requests ("bring me a hare", "keep away from my sister") are promises under milestone-2 §11.3, +5 if kept and -5 if broken, once each.
(Actions 2-7, which are not for this run, are Shadow, Spar, Scout border, Steal from kill, Help a pride cub and Watch from a vantage.)
