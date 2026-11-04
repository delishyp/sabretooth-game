# Lore → Slot Templates: Conversion Plan

Owner: Saga. Status: **PLAN v0.1**, 2026-11-04. Nothing is converted yet. This lists every hard-coded name, look and temperament in the lore and how each one gets fixed.
Why: world-gen-spec v0.3.1 makes names, coats and personality random every run (§3, §4, §5). Sex, pride, role, family links, scars and perks stay fixed (§8). Anna wants the lore and character sheets to **not depend on temperament**. Each sheet becomes a **slot template** keyed by slotId (world-gen §8.1, §12.2).
Mismatches with the slot table are in `slot-table-review.md`. Perk fit is in `perk-review.md`.

## 1. Rules for every template
1. **Names are tokens.** `{name}` is the slot's own name. Other cats use slot cross-references: `{hc01.name}`, `{bf02.name}`, `{ln03.name}`. Pronouns use `{ln03.he}`, `{ln03.him}`, `{ln03.his}`, `{ln03.himself}` (scene-format §2.7). Role labels (Ashmane, Torncheek…) stay as **authoring labels only** and never reach the screen.
2. **Looks are tokens or nothing.** `{coat}`, `{eyes}`, `{sabers}` and `{markings}` (world-gen §8.1) fill from genetics §2 player-facing names. Scars are fixed, so they may be written, but **never with a side** (scene-format §3.5): say "the torn cheek", "the clouded eye", "the notched ear", "the stiff hind leg". Never write body size or shape ("heavy", "lanky", "silver-maned"); the lineart is fixed.
3. **History, not temperament.** A trait word is allowed only when the cat's fixed history earns it: bitterness from an unjust exile, guilt from a theft, grief from the Breaking. Words that are pure temperament ("cheerful", "ruthless", "warm", "fierce") move into **trait-band variants**.
4. **Trait-band variants** pick the voice, never the facts. Bands follow relationships-spec §3.1: `low` < 35, `mid` 35–69, `high` ≥ 70. Each templated line has a `default` plus 0–3 variants keyed `trait.band` (`aggression.high`, `sociability.low`…). The first matching variant in listed order wins; `default` always exists.
5. **No rival or trust claims.** Never write "never a rival", "likely rival", "easy to win over" or "hard to win over". `isRival` (world-gen §7.2) and first-meeting affinity (loners §2.4, rel-spec §3.3) come from rolled traits. History can set **who the cat cares about** (a grudge, a homesickness), not how warm it is.
6. **Dead and off-roster cats** (Longshadow, Tallgrass, Rushwater, Reedsong, the fallen cub) aren't slots, so they get no rolled name. Recommendation: they **keep fixed names**, which `reserved` already protects from collisions. They're memories, not cats on screen. *(Question for Director: OK?)*

## 2. Template shape (proposal for Flint; Saga owns the text)

```json
{
  "slotId": "ln03",
  "roleLabel": "Torncheek",
  "history": "{name} challenged {bf01.name} for Bonefield last autumn and nearly won. {bf01.name} drove {name}'s face into a mammoth jawbone and tore the cheek open to the saber root. Under Bonefield law the loser leaves.",
  "secret": "{name} counts the seasons as {bf01.name} ages, and would use any ally to get close to Bonefield again.",
  "appearance": "A {coat} tom with {markings}, {eyes} eyes, a cheek torn open to the root of one saber, and forelegs crossed with old scars.",
  "epithet": { "default": "the torn one", "note": "What Bonefield cats call {name} instead of saying the name." },
  "wants": "Bonefield back.",
  "voice": {
    "default": "Short sentences. Talks about {bf01.name} more than about {himself}.",
    "aggression.high": "Open threat. Measures every cat as a weapon or an obstacle.",
    "aggression.low": "Tired, not tame. Wants home more than revenge, and hates that.",
    "sociability.high": "Talks too much for an exile, then catches himself."
  },
  "sampleLines": {
    "default": "He gave me this face. Ask him what I'll give him back by spring.",
    "aggression.low": "He gave me this face. Some days I think I could live with it."
  },
  "kinNotes": [ { "slot": "ln05", "kin": "half_sibling", "note": "Shared sire, off-roster." } ],
  "bandNotes": { "ln07": "likely", "ln05": "unlikely", "ln09": "unlikely" }
}
```

Notes on the shape: `{markings}` must resolve to a phrase that reads after "with" ("faint spots", "no markings" → the template engine drops "with {markings}," when plain; Flint, a `{markings?}` optional-clause token is cleaner). Per-slot pronoun words in `voice` (like "himself" above) are authoring notes, not player text, so they can stay literal.

## 2a. Look-token vocabulary (what `{coat}`, `{undercoat}` and `{markings}` must cover)
Player-facing coat names come from cat-creator v0.3.1/0.3.2 and genetics §1, §2.4, §8.1. Each token resolves to a short phrase that reads after "a" or "with". Saga's phrase table (draft):

| Token | Gene id | Phrase |
|---|---|---|
| `{coat}` | tawny | tan |
| | greydun | gray (dilute: "blue-gray") |
| | russet | brown (dilute: "pale brown") |
| | sandy | sandy |
| | melan | black |
| | leuc (rare) | pale |
| | ash (rare, melan + leuc) | ash |
| `{undercoat}` | cream / pale / off | "a cream underside" / "a pale underside" / *(clause dropped)* |
| `{markings}` | spotted / rosette / barred / faintstripe / plain | "spots" / "rosettes" / "bars" / "faint stripes" / *(clause dropped)* |
| `{dorsal}` | Ds | "a dark stripe down the spine" (it's its own layer, so it isn't part of `{markings}`) |

**Black coats (Ochre, genetics §2.4 correction):** on a black coat the markings are **ghost markings**: slightly warmer, matte marks that show only in raking light. They are **not** darker than the coat. So `{markings}` on `melan` reads "ghost rosettes, warmer marks that show only in raking light" (likewise "ghost spots", "ghost bars", "ghost stripes"). On `leuc` (pale) the markings are nearly invisible, so they read "barely-there spots" and so on. `ash` uses the normal phrases.
*Note for Tundra:* genetics-spec §2.4 still says "ghost rosettes, darker than the coat", and the §2.2 melanistic markings tint `#1E1A17` is darker than the base. Both need Ochre's correction.

## 3. Inventory and fixes

Kinds: **N** = hard-coded name, **L** = look, **T** = temperament. Fix: **H** = root it in history or role, **V** = trait-band variants, **K** = tokenise, **X** = cut.

### 3.1 `world-and-prides.md`
| id | Where | Hard-codes | Fix |
|---|---|---|---|
| W1 | §2.1 Highcrag leader | N "Ashmane"; L "silver-maned queen"; T "has never been seen to hurry" | K `{hc01.name}`. X the mane. H: "has led the crag for many winters, and Highcrag custom says a leader never hurries." Patience is now the **custom**, not her nature. |
| W2 | §2.2 Bonefield leader | N "Scarjaw"; L "heavy tom" | K `{bf01.name}`. X "heavy". Keep "a split lip" (fixed scar) and "won his place by challenge and has held it through three" (history). |
| W3 | §2.3 Mistwood leader | N "Hollowsong"; "aging queen" | K `{mw01.name}`. "Aging" is fixed by age (39), so keep it. "took the lead because no one else would" is history, so keep it. |
| W4 | §2.1–2.3 "Temperament" bullets | T for whole prides | Rename the bullet to **Custom**. Pride culture is fixed lore; a cat's rolled traits decide how well it fits. Add one V line per pride for how a low-loyalty cat speaks of its custom. |
| W5 | §2.3 story state | N "Longshadow" | Rule 1.6: fixed name for a dead cat. |
| W6 | §2 "Rosters … TBD" | stale | Replace with a pointer to world-gen §2.1 and the slot templates (slot-table-review M12). |

### 3.2 `loners.md` + `loners.json` (per cat)
Every loner has the same five spots: **heading/`name`** (N), **Appearance/`appearance`/`looks`** (L), **Traits/`traits`** (T), **Narrative leaning** (T, trait levels), and other cats named in **Why/Secret** (N).

| Slot | N | L | T (old words) | Fix |
|---|---|---|---|---|
| ln01 Greymantle | own; Ashmane, Stonebrow, Nettle | grey-dun, greying, amber eyes, dark-stained sabers, foreleg scars | patient, proud, quietly bitter; "not a rival (aggression: low)" | K names. L → `{coat}`, `{eyes}`, `{sabers}`; greying comes from the age layer; keep the foreleg scars. H: bitterness comes from the unjust exile, pride from his years as keeper of the recitation. V: `aggression.high` the bitterness has teeth; `sociability.low` he answers in single words. X the rival claim. |
| ln02 Sorrel | own; Redthroat, Ashmane, "her mother" | red-gold russet, dorsal stripe, amber eyes, ivory sabers | warm, headstrong, hopeful; "easy to win over" | K, and `{bf02.name}` for Redthroat. Mother → `{hc07.name}` (approved by Director 2026-11-05). H: hope comes from waiting at the Split Rock, headstrong from leaving against custom. V: `sociability.high` warm and teasing; `sociability.low` proud and closed. X "easy to win over". |
| ln03 Torncheek | own; Scarjaw; "**the pride named him for the wound**" | sandy, faint spots, gold eyes, cheek torn, forelegs crossed | ambitious, ruthless, proud; "likely rival" | The naming line breaks random names. Fix: the name is rolled, and Bonefield calls him "**the torn one**" instead of saying it (an `epithet` field). L → tokens, keep both scars. H: ambition comes from the near-won challenge and wanting Bonefield back. V for "ruthless" (see the §2 example). X "likely rival"; the Broken Wandering hook stays as history. |
| ln04 Nettle | own; Scarjaw, Tallgrass, Thistle, "an old Highcrag tom" | tawny, brindle stripes, blaze, copper eyes, notched ear | fierce, loyal, secretive | K `{bf01.name}`, `{hc04.name}`, `{ln01.name}`; Tallgrass keeps his fixed name. H: secretive comes from the Thistle secret, loyal from her care for cubs. V: `aggression.high` fierce; `aggression.low` steady and quiet. |
| ln05 Duskrunner | own; Torncheek | tawny, faint spots, white socks, green eyes, tail scar | curious, restless, cheerful; "never a rival" | H: restless comes from walking past the Ice Wall and finding the pass. V: `sociability.high` cheerful; `sociability.low` a quiet, far-looking wanderer; `curiosity.low` he went once and won't talk about it. X the rival claim. |
| ln06 Lichen | own; Longshadow, Sedge | pale grey-dun, bark stripes, greying, amber eyes, stained sabers, **left** eye | wise, gentle, stubborn; "warm and quick to trust" | L → tokens; "the clouded eye", no side. H: wisdom comes from warning Longshadow, stubbornness from refusing to be carried. V: `sociability.low` stern rather than gentle. X the trust claim. |
| ln07 Ashfall | own; Hollowsong, Reedsong | melanistic, ghost rosettes, scarred muzzle, cream sabers, gold eyes | guilt-ridden, careful, kind in secret; "slow to trust" | L → tokens (no "black" in text; ghost-marking wording per §2a). H: guilt comes from the theft and Reedsong. V: `sociability.high` talks too much, then stops. X the trust claim. |
| ln08 Sedge | own; Rushwater, Lichen | sandy, faint stripes, split lip, ivory sabers, pale blue eyes | sorrowful, watchful, quietly dangerous | H: sorrow comes from losing her mate and cubs in the Breaking. V: `aggression.high` "quietly dangerous"; `aggression.low` simply lost. |
| ln09 Coldwater | own; Longshadow, Rushwater, Sedge | blue-grey dilute grey-dun, amber eyes, flank and **left** hind-leg scars | loyal, haunted, earnest; "never a rival", "easy to befriend" | L → tokens; "the stiff hind leg". H: haunted comes from turning back on the ice. V: `loyalty.low` he's starting to doubt home wants him. X the rival and trust claims. |
| all | — | `looks` block in `loners.json` | — | Cut everything except `scars` (coats are rolled). `appearance` becomes a template. `traits` becomes `voice` with variants. `narrativeLeaning` keeps story only, with no trait levels. `id` → `slotId`; `name` → `roleLabel`. |

Shared sections in `loners.md`:
| id | Where | Fix |
|---|---|---|
| L-R1 | "Narrative relationships" | K every name with slot refs. Keep the facts (they're history). |
| L-B1 | "Bachelor bands" table and "the player and bands" | K names. "Torncheek offers only if useful" → H (he needs fighters against `{bf01.name}`). "Duskrunner invites everyone" → V `sociability.high`; `default` "offers when the hunting is thin". "Ashfall never asks" → H (shame), so keep it. |
| L-T1 | "How the rules apply" → Rivals | Add: "Rival status comes from each run's rolled aggression. The lore never promises it." |
| L-T2 | "Each cat's Narrative leaning line…" intro | Rewrite: leanings now describe history and wants only. |
| L-O1 | Open points | Update the "Pride-cat names reserved for rosters" line: they're role labels now (world-gen §3.6). |

### 3.3 `events/band-events.md`
| id | Where | Hard-codes | Fix |
|---|---|---|---|
| E1 | Extra tokens, example "Torncheek and Ashfall" | N | Use a neutral example ("{a} and {b}"). |
| E2 | `band.invite` named lines (Torncheek, Coldwater, Duskrunner) | N, T | Key the lines by slot (`[ln03]`, `[ln09]`, `[ln05]`). The Torncheek line is H, so keep it. Coldwater "quieter with someone breathing nearby" is H (his loneliness), so keep it. Duskrunner "Come with us! Or don't." → V `sociability.high`, with a quieter default. |
| E3 | `band.follow` named lines | N, T | Same slot keys. Ashfall "lies down at the den mouth, facing out" is H, so keep it. Duskrunner "I'll visit! Maybe." → V `sociability.high`. |
| E4 | `band.world.homecoming` | N "Coldwater", "Sedge"; "his" | `{ln09.name}`, `{ln08.name}`, `{ln09.his}`. Trigger keyed on slot ln09 + target mistwood. |
| E5 | `band.challenge.world` story hook "if {band} includes Coldwater" | N | `includes slot ln09`. |

### 3.4 `events/exile-event.md`, `events/pride-departure-events.md`, `scene-format.md`
No hard-coded names or looks. Temperament gates already go through rules (§10.4 "fits the cat's top trait", `requires.trait`). No change.

## 4. Order of work
1. Tundra answers M3–M5 in `slot-table-review.md` and rule 1.6 (dead cats' names).
2. Saga converts `loners.json` to `docs/lore/slots/ln01.json` … `ln09.json` (shape §2), then writes the 30 pride slots (hc01–mw09). Most pride slots have one line of history today, so they'll mostly be new writing. `loners.md` becomes a readable view of the same data.
3. Saga updates `world-and-prides.md` (W1–W6) and `band-events.md` (E1–E5).
4. Flint confirms the token resolver handles `{slot.field}` cross-refs and the optional `{markings?}` clause, and adds a lint: no reserved role label may appear in player-facing template text.
5. Tracker check: render each template with 20 seeds and confirm no role label, no side word, and no coat or eye word outside tokens.
