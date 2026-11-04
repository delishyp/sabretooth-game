# Sabretooth: Play Styles Spec (v0.2, DRAFT)
Owner: Tundra (rules and numbers). Copy and labels: Saga. Gameplay isn't built yet; Flint only needs §1 and §4 for the menu (see main-menu-spec v1.3).

## 1. Two independent choices at New Game, both locked per run
1.1 **Style** is Story, Standard (the default), or Sim. It sets how harsh and how deep the game is.
1.2 **Death rule** is Permadeath, Heir (the default), or Sandbox, unchanged from before. It sets what happens when the player cat dies.
1.3 All 9 combinations are allowed. The Sandbox toggles (needs drain, threat frequency) multiply on top of the Style values. For example, Sim + Sandbox needs drain "low" = 1.3 × 0.5.

## 2. What each Style changes (Standard = 1.0 baseline)
| System | Story | Standard | Sim |
|---|---|---|---|
| 2.1 Hunger drain rate | ×0.6 | ×1.0 | ×1.3 |
| 2.2 Starvation | Weakened only (no damage) | Damage after 3 starving days | Damage after 2 days, death possible |
| 2.3 Injury chance (hunts, fights) | ×0.5 | ×1.0 | ×1.5 |
| 2.4 Injury heal time | ×0.5 | ×1.0 | ×1.5, plus 10% chance of infection or a lasting injury |
| 2.5 Hunt success | +15 points | base | −10 points |
| 2.6 Winter prey scarcity | −10% | −20% | −40% |
| 2.7 Carcass theft and spoilage | Off | Light (scavenger theft only) | Full (spoilage after 2 days, theft by scavengers, bears, and wolves) |
| 2.8 Cub mortality | ×0.5 | ×1.0 | ×1.5 |
| 2.9 Fight death chance | 0% | 5% | 10% |
| 2.10 Rival and bachelor-band challenges | ×0.5 | ×1.0 | ×1.25 |
| 2.12 Player-pride cats leave | Never | When unhappy for a long time, after warnings | More readily; can be lured away; young males disperse |
| 2.11 Event mix (story / threat / survival) | 60 / 20 / 20 | 40 / 30 / 30 | 25 / 35 / 40 |

Rules for 2.12 are in loners-spec §6.4.

## 3. Management depth
3.1 **Story:** the game assigns pride roles (hunter, guard, nursemaid) and suggests changes the player can accept or ignore. Patrols run automatically. Territory relations show as simple tiers (hostile, neutral, allied). Every Standard system still exists, but it's automated.
3.2 **Standard:** the player assigns roles, sets patrols and scent marking, manages relations with prides and loners, and controls feeding order.
3.3 **Sim:** everything in Standard, plus:
   - scent marks fade (zones need re-marking every 5 days);
   - den site choice and shelter matter in winter;
   - cub-rearing tasks;
   - an inbreeding penalty (a fitness hit when the parents' relatedness is ≥ 25%);
   - per-cat hunger instead of one pooled pride food store.
3.4 The storyteller gets the Style as a tone hint. Saga defines the prompt fields.

## 4. Data
- The run record gets `style: "story" | "standard" | "sim"`.
- The existing field `difficulty` stays as the Death rule key, so already-built code doesn't break.
- Tunables live in `styles.json`, keyed by style, with the values from §2.

## 5. Open questions
- 5.1 None blocking. The numbers are first-pass and will be tuned once gameplay exists.
