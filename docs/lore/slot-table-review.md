# Slot Table vs Lore: Review (world-gen-spec v0.3.1 §2.1, §2.3a, §4.4; slot table unchanged through v0.3.4)

Owner: Saga. Status: review notes for Tundra, 2026-11-04. **No spec edits.** Lore checked: `world-and-prides.md`, `loners.md`, `loners.json` v0.3, `events/*`.
Ages use lifecycle-spec §2 (adolescent 4–11 seasons, young adult 12–19, adult 12–39, elder 40+).

## 1. What matches
- **Counts:** Highcrag 11, Bonefield 10, Mistwood 9, loners 9. Lost to loners 2 / 3 / 4. Loner mix is 5 M / 4 F, 2 young adult, 5 adult, 2 elder.
- **Loner ages, sexes, origins and departures** all match `loners.json`: ln01 52, ln02 15, ln03 28, ln04 32, ln05 16, ln06 48, ln07 27, ln08 24, ln09 20. Age notes ("about thirteen winters" and so on) agree with the seasons. ln09 Coldwater at 20 is just past young adult, which fits "only just past young".
- **Loner scars (§2.1, §4.4)** match `loners.json` exactly: ln01 `forelegs`, ln03 `cheek_torn` + `forelegs`, ln04 `ear_notch_right`, ln05 `tail`, ln06 `eye_left`, ln07 `muzzle`, ln08 `lip_split`, ln09 `flank` + `hind_leg_left`. The old ids `forelegs_both`, `forelegs_crossed`, `flank_long` and `ear_right` are gone from the lore.
- **Leaders:** hc01 Ashmane F, bf01 Scarjaw M with `lip_split` (lore: "torn lip"), mw01 Hollowsong F with Longshadow drowned. All match.
- **Story roles:** hc02 Stonebrow is Ashmane's son (sire hc03, dam hc01), hc04 Thistle is a Bonefield-born male foundling of about three years (12 seasons, so born about when Scarjaw took Bonefield), bf02 Redthroat is a young Bonefield tom, mw08 is Longshadow's (dam mw01). Mistwood's toms are "few, scarred, not gone" (mw02 flank from the Breaking, mw03 hind leg, mw08 adolescent).
- **Timeline:** the fallen cub was "two springs ago" (8 seasons). hc02 was then 8 seasons old, an adolescent minding a cub, which works.

## 2. Mismatches and gaps

| # | Slot(s) | Field | Spec says | Lore says | Suggested fix |
|---|---|---|---|---|---|
| M1 ✅ APPROVED (Director 2026-11-05: old guard who bowed to Scarjaw without a fight; lore in world-and-prides §2.2) | bf07 | role | "elder, old challenger", still in Bonefield | Bonefield law: "Any adult may challenge … **The loser leaves the pride**" (world-and-prides §2.2) | Either bf07 **won** a challenge long ago and later stepped down (then "old champion"), or he is Tallgrass's old guard who **never** challenged. Saga prefers "Tallgrass's old guard, who bent the knee to Scarjaw". Role label only; no number changes. |
| M2 | ln01 | role / perks | changelog calls him "Loner ex-leader ln01" and gives leadership M4 `legacy_rally` | Greymantle was Ashmane's **counselor** and keeper of the recitation, never leader | Either fix the changelog wording ("ex-counselor"), or swap perks (see `perk-review.md` P1). |
| M3 ✅ APPROVED (Director 2026-11-05: hc07 is Sorrel's mother; lore in loners.md) | ln02 + Highcrag | family link | no Highcrag slot is Sorrel's mother | "Ashmane refused her, **and so did her mother**" | Narrative link only (loners have no generated links, §6.3). Candidates by age: hc07 (31, 16 at Sorrel's birth) or hc08 (51, 36). Saga suggests **hc07**: the guard who refused her daughter. Tundra to confirm, or I cut "her mother". |
| M4 | ln09 / mw08 / mw01 | family link | mw08 sire "off" (Longshadow); ln09 has no links | Coldwater is **Longshadow's son** (`loners.json` secret), so he is mw08's half-brother (full brother if Hollowsong is his dam). Rushwater (dead) was his brother. | Not needed for gen, but the **incest gate** (rel-spec §1.7) reads r from links. Without a link, ln09 and mw08 count as r = 0 and could court once mw08 is adult. Ask: add Longshadow as a hidden shared sire (one `off` id), or a narrative `kinNote` that rel-spec treats as r = 0.25. |
| M5 | ln03 / ln05 | family link | no link | Torncheek and Duskrunner are **half-brothers** | Same as M4: the kin gate can't see it, so a crush or mates bond is possible in the engine now that same-sex bonds exist (Anna, 2026-11-04). Needs a shared hidden sire or a kin note. |
| M6 | hc04 / ln04 / bf (Tallgrass) | family link | hc04 sire and dam "off" | Thistle is **Tallgrass's son**, with a blood claim to Bonefield | Fine for gen. Tallgrass's other two cubs died, and no living slot is written as his kin, so r = 0 is right. No change. |
| M7 | hc08 / ln01 | role | hc08 "keeper of the recitation" | Greymantle "knew every name in the night recitation" | Not a conflict: hc08 took the duty after his exile, and it is she who struck his name from the song. I'll write it that way. No spec change. |
| M8 | bf02 | scar | `flank` (derived) | lore gives Redthroat no scar | No conflict. Saga will use it as a hook: the flank wound is why he never came to the Split Rock ("or worse"). |
| M9 | hc01 | age | 36 (9 years) | "has ruled for many winters" | Fine if she took the lead at about 5 years. No change. |
| M10 | mw01 | age / stage | 39, adult | "an aging queen" | She turns elder in season 2 of a run, which suits the lore. No change. Note for Tracker: her stage changes almost at once. |
| M11 | all slots | personality | narrative lean column is "never used in generation" | `loners.md` "Narrative leaning" and `traits` read as fixed temperament (Torncheek "likely rival", Duskrunner "never a rival") | Lore side: covered in `template-conversion-plan.md`. Spec side: see §3 below. |
| M12 | all prides | roster note | §2.1 has all 30 pride slots | `world-and-prides.md` §2 still says "Rosters: only the leaders are named here … TBD" | Saga's doc. I'll update it when the templates land (plan step 1). |
| M13 | ln06, ln04, ln09 | scar wording | ids are side-specific (`eye_left`, `ear_notch_right`, `hind_leg_left`) | `loners.md` prose says "left eye", "right ear", "left hind leg" | Ids are fine. Player-facing text can't name a side (scene-format §3.5), so the templates say "the clouded eye", "the notched ear", "the stiff hind leg". |

**No mismatches found** in sex, age, pride, or scar for any of the 39 rows apart from the items above.

## 3. World-gen fields that still assume a personality base
1. **§2.1 "narrative lean" column → §2.3a fixed perks.** The perks were chosen from the lean (§2.3a), but personality now rolls fresh. A run can give bf01 aggression 20 while he still holds `bully`, `banish`, `warlord` and `killing_bite`. That's acceptable if the perks are read as **history** (what he learned by holding Bonefield), not temperament. Perk text and lore must never say "because he is aggressive". `perk-review.md` lists the slots where a perk only makes sense from temperament.
2. **§7.2 `isRival` = final aggression ≥ 70.** Correct by the rules, but the lore assumes Torncheek is a rival and Duskrunner, Sorrel, Lichen and Coldwater "never" are. The lore has to drop "never a rival" and "likely rival" (plan item L-T1).
3. **§2.3 aptitude lean** (bf01 fighting +15, and so on) is fixed per slot. It's a talent, not a temperament, so it's fine, but it was also derived from the lean. No change asked.
4. **§5.2** says narration must read rolled values (§12.2). Agreed, and done in the plan.
5. **genetics-spec §4.4** still says "Premade cats use Saga's authored values", and **§1.11** says premade cats get "authored visible phenotypes … stored as fixed genotypes". Both contradict world-gen v0.3.1 (personality and coats random). That's genetics-spec, Tundra's to fix.
6. **skills-spec §6.1** says "Premade cats use Saga's authored values" for aptitude. Fine, since world-gen §2.3 fixes aptitude per slot, but the wording "Saga's authored" is stale: the values are Tundra's derived ones.
7. **loners-spec §2.4/§2.5** first-meeting affinity is shifted by sociability and aggression. These are rolled, so the lore's "easy to win over" or "hard to win over" can be wrong in a run. Covered in the plan (L-T2).
