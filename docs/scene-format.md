# Scene Format: Pride Scenes (visual-novel style)

Owner: Saga (format, text, AI output contract). Status: **DRAFT v0.2.1**, design-only. Not in the build.
Rules and numbers: Tundra's `relationships-spec.md` **v0.1.2** (rel-spec). Where this doc and that spec disagree, the spec wins on numbers, ids and tags.
Related: `lore/events/exile-event.md` (shared event format), `lore/courtship-lines.md` (courtship refusal text), `loners-spec.md` v0.8 §2.4 (affinity = the rel-spec pair value), §6.4 (contentment), `genetics-spec.md` §4 (personality), `lifecycle-spec.md` §2 (life stages), `needs-spec.md` §1 (need states), `play-styles-spec.md` §1–3 (styles, roles), `skills-spec.md` v0.2.1 (`read_affinity`).

## 0. What a scene is

A short moment between two or three cats: a few lines of dialogue, some narration, and sometimes a choice. Scenes show relationships (family, playmate, friendship, admiration, rivalry, crush, mates, grudge) and move them a little. They run in all three storyteller modes in **one format**:

- **Offline:** authored scenes from the library in `src/renderer/data/scenes/` (Flint's path).
- **Online / local:** the model returns a scene in the same JSON (minus `requires`); the game validates it, then runs it with the same runner.

**Where a scene plays (rel-spec §4.1, Director):**
- **In full** (VN view) when it's in the player's own pride, or the player's cat is in or next to that territory.
- **Off-screen** for any other AI pride: no VN view. If the scene has a choice, cat A's option is picked by personality weight (§2.4, the skills-spec §8.4 rule). The effects apply normally, and the log gets one line: the scene's `summary`, or the picked option's `summary`.

## 1. Layout intent (descriptive only; Ochre owns the visuals)

1.1 **Portraits:** 2 or 3 cats. Slot `left` and slot `right` face each other; an optional `centre` slot faces the speaker. 2-cat scenes use left/right. 3-cat scenes put the third cat in the centre.
1.2 **Mirroring (Ochre):** the right-side portrait is a horizontal flip of the finished portrait, so scars and markings show mirrored. Flint's compositor mirrors for free.
1.3 **Lines:** one line on screen at a time, advanced by click or key. The speaker's portrait is highlighted and the others dim. The speaker's name sits on the dialogue box.
1.4 **Narration:** short italic lines with no speaker, shown between lines, with no portrait highlighted.
1.5 **Choice:** optional, at the end or in the middle. 2–3 options as buttons in the dialogue box. After a mid-scene choice the scene branches into that option's own beats, then rejoins or ends.
1.6 **Expressions:** each line sets the speaker's `expression`: `neutral`, `happy`, `angry` or `sad` (Ochre's v0.1 set, rel-spec §4.5). Any other id, or missing art, falls back to `neutral`. Expressions never trigger effects. Candidates for later: `shy`, `hurt`. Non-speakers keep their last expression.
1.7 **Background:** the scene's zone background (Ochre's scene art), picked from the current zone. Scenes don't name a background.
1.8 **Side-blind (rel-spec §4.5):** a slot is a position only. No rule and no text depends on left, right or centre.

## 2. Schema

### 2.1 Top level

| Field | Type | Req | Meaning |
|---|---|---|---|
| `id` | string | yes | Dotted id: `scene.<trigger>.<slug>`, e.g. `scene.friendship.cold_watch`. AI scenes get `scene.ai.<runId>.<n>` from the game, not the model. |
| `type` | `"scene"` | yes | Separates scenes from events in the shared loader. |
| `trigger` | string | yes | One of the 15 trigger tags in §2.1a (rel-spec §4.2). |
| `relType` | string[] | yes | Relationship kinds the scene covers (§2.1b). Must be a subset of the trigger's kinds in §2.1a. `first_meeting` uses `[]`. |
| `tags` | string[] | no | Free flavour tags for picking and filtering: `hunt`, `den`, `winter`, `cubs`, `comic`, `tender`, `tense`. |
| `styles` | string[] | yes | `story`, `standard`, `sim` (same as events). |
| `mix` | string | yes | Event-mix bucket, normally `story` (play-styles §2.11). |
| `cast` | object | yes | Role slots, §2.2. |
| `requires` | object | no | Conditions, §2.3. **Authored scenes only.** The model never returns it. |
| `weight` | number | yes | Pick weight among eligible scenes of the same tag and priority (rel-spec §4.3). Default `1`. |
| `cooldown` | object | yes | `{ "scope": "pair"\|"trigger", "days": int }`. Use the trigger's row in §2.1a. `first_meeting` uses `{ "scope": "pair", "days": -1 }` (never repeats). |
| `beats` | array | yes | Ordered beats, §2.4. |
| `effects` | array | yes | Effects on scene end, §2.5. May be empty. |
| `followUp` | array | no | Scene hooks, §2.6. |
| `summary` | string | yes | **Log line** (rel-spec §4.1). One past-tense sentence, ≤ **100** characters after tokens fill (budget names at 12), cast tokens only (`{A.name}`, `{B.name}`…), never a side, no numbers. If the scene has a choice, this line covers the shared part, and each option adds its own `summary` (§2.4). |
| `fallback` | string | yes | One-paragraph plain-text version for when the scene can't be shown in full (missing art, text-only mode, Reduced Motion "skip scenes"). ≤ 300 chars. |
| `version` | int | yes | Format version, `2`. |

### 2.1a Trigger tags (rel-spec §4.2, §4.3)

| Tag | relType kinds | Eligible pair when | Cooldown (scope, days) | Priority |
|---|---|---|---|---|
| `first_meeting` | none | met = false, both present | pair, never repeats | 3 |
| `family_bond` | family | kin pair, value ≥ 15 | pair 30 | 2 |
| `cub_play` | playmate, family | ≥ 1 cub, both young | pair 20 | 2 |
| `friendship` | friendship | friendship kind or `warm` | pair 20 | 1 |
| `admiration` | admiration | admiration flag | pair 30 | 1 |
| `rivalry` | rivalry | rivalry kind | pair 15 | 2 |
| `rivalry_boils` | rivalry | rivalry and value ≤ −40 | pair 30 | 4 |
| `crush` | crush | crush flag, age gate | pair 20 | 2 |
| `courtship` | crush, mates | mutual crush, or player courting | pair 15 | 3 |
| `mates` | mates | mates kind | pair 30 | 1 |
| `mates_strain` | mates | mates and value ≤ 10 | pair 30 | 4 |
| `grudge` | grudge | grudge flag | pair 25 | 3 |
| `reconcile` | rivalry, grudge | rivalry or grudge and value ≥ −20 | pair 40 | 2 |
| `jealousy` | crush, mates | a crush holder sees its target with another cat's crush or mate | trigger 20 | 3 |
| `leader_doubt` | rivalry, grudge | a rival or grudge toward the leader | trigger 40 | 4 |

- A trigger-wide cooldown also applies: the same tag can't fire twice within 5 days per pride.
- On a scene day the game picks the highest-priority tag with an eligible pair off cooldown. Ties are a weighted draw by `weight`.
- **Priority 4 = drama** (`rivalry_boils`, `mates_strain`, `leader_doubt`). Its weight is ×0.5 in Story, ×1 in Standard and ×1.25 in Sim (rel-spec §6, §11.5). Story is light, not drama-free.

### 2.1b Relationship kinds (rel-spec §1.4)

`family`, `playmate`, `friendship`, `admiration`, `rivalry`, `crush`, `mates`, `grudge`. A pair has one value (−100..+100) and can hold several kinds.
- **One-sided:** `crush`, `grudge` and `admiration` are flags with a **holder** and a target. Write them so the target may not know: a crush can be unspoken, a grudge can be hidden.
- **Mates** carry a `breeding` flag (rel-spec §1.8). `breeding: false` bonds (same-sex mates) have every mates effect except cubs. **Elders can be mates** (Director 2026-11-05); whether an elder pair can breed follows Tundra's fertility curve, so the engine sets `breeding` and scenes only read it.
- **History seeding (Director 2026-11-05):** lore grudges and rivalries (an exile toward the leader who drove it out, and so on) are seeded at world gen. A lore **crush** is seeded only when that run's attraction roll makes the pair compatible. So no scene or event may assume a history crush exists. Gate on `requires.flag` instead.

### 2.2 `cast`

Role slots, never names. The runner binds slots to cat ids at pick time.

```jsonc
"cast": {
  "A": { "slot": "left",  "who": "pride" },
  "B": { "slot": "right", "who": "pride" },
  "C": { "slot": "centre", "who": "player", "optional": true }
}
```

- `who`: `pride` (member of the player's pride or the cats' shared pride), `player` (the player cat), `any` (pride cat, loner or player), `loner`, `visitor` (cat from another pride).
- The player can be a cast member (rel-spec §4.4: pairs with the player get ×1.5 weight). Lines **spoken by the player cat** are allowed but kept rare and short, so the player's own voice isn't taken over; choices are the main player voice.
- `optional: true` lets a slot stay unbound. Beats spoken by an unbound slot are skipped, and tokens for it aren't allowed outside those beats.
- Max 3 slots (A, B, C). Each cat binds at most once. A third cat is added only if the scene has a C slot; `jealousy` scenes require one (rel-spec §4.4).

### 2.3 `requires` (authored only)

All conditions are AND. Cut-offs live in the owning spec, not here.

```jsonc
"requires": {
  "rel":   [ { "pair": ["A","B"], "type": "friendship", "band": ["warm","close"] } ],
  "flag":  [ { "kind": "crush", "holder": "A", "target": "B" } ],
  "bond":  { "pair": ["A","B"], "breeding": true },
  "trait": [ { "cat": "A", "trait": "sociability", "band": "high" } ],
  "stage": { "A": ["adult"], "B": ["adolescent","adult"] },
  "need":  [ { "cat": "player", "need": "hunger", "state": ["low","critical"] } ],
  "season": ["winter"],
  "role":  { "B": ["hunter"] },
  "kin":   [ { "pair": ["A","B"], "kin": "none" } ],
  "flags": { "has": [], "not": [] },
  "met":   [ { "pair": ["A","B"], "met": true } ]
}
```

| Key | Values | Source |
|---|---|---|
| `rel.type` | the 8 kinds of §2.1b, or `none` | rel-spec §1.4 |
| `rel.band` | `hostile` (≤ −50), `cold` (−49..−15), `neutral` (−14..+14), `warm` (+15..+49), `close` (≥ +50) | rel-spec §1.3 |
| `flag` | one-sided kinds (`crush`, `grudge`, `admiration`) with `holder` and `target` slots | rel-spec §0.2, §1.4 |
| `bond.breeding` | `true` / `false`: the pair's mates bond can or can't have cubs | rel-spec §1.8. **Required on any scene with cub, litter or den-of-cubs lines between mates** (§3.9) |
| `trait` / `band` | `aggression`, `sociability`, `boldness`, `loyalty`, `curiosity`; bands `low` < 35, `mid` 35–69, `high` ≥ 70 | rel-spec §3.1 |
| `stage` | `cub`, `adolescent`, `adult`, `elder` (lifecycle §2); descriptor `young_adult` allowed | lifecycle-spec; gates below |
| `need.state` | `ok`, `low`, `critical`, `empty` (needs §1.6); Mood uses `low`, `normal`, `high` | needs-spec. Only the player has full needs; NPCs `health` only (needs §0.3) |
| `season` | `spring`, `summer`, `autumn`, `winter` | lifecycle §1.1 |
| `role` | `leader`, `hunter`, `guard`, `nursemaid` | play-styles §3.1 |
| `kin` | `none`, `parent`, `child`, `sibling`, `mate`, `related` (r ≥ 0.125) | genetics §5, rel-spec §1.7 |
| `met` | `true`/`false` | An unstored pair is never-met, value 0 (rel-spec §1.2). `first_meeting` scenes need `met: false`. |

**There is no `sex` key for crush, courtship, mates, mates_strain or jealousy scenes.** Who can feel what for whom is the engine's eligibility check (rel-spec §1.8 attraction, §1.6 age, §1.7 kin), never the scene's.

**Gates (hard rejects, rel-spec §1.6–1.8):**
- **Cubs** may only appear in `family` and `playmate` kinds (`family_bond`, `cub_play`, or as a non-pair third cat in other scenes).
- **Adolescents** may hold `friendship`, `admiration`, `rivalry`, `grudge`, `family`, and `playmate` with a cub **or another adolescent** (Director 2026-11-05). Never `crush` or `mates`.
- **Crush, courtship, mates, mates_strain, jealousy:** every cat in the romantic pair must be `adult` (young adults included) or `elder`, and the pair must be `kin: none` (r < 0.125). Close kin never get crush or mates by any path.
- `stage` must be set for both cats in the pair on every crush or mates scene (unless the slot is `player`, who is always adult).

### 2.4 `beats`

An ordered array. Three kinds:

```jsonc
{ "kind": "narration", "text": "..." }
{ "kind": "line", "speaker": "A", "expression": "happy", "text": "..." }
{ "kind": "choice", "prompt": "...", "options": [
    { "id": "praise", "label": "...", "lean": "sociability", "requires": { }, "beats": [ ], "effects": [ ], "summary": "..." }
] }
```

- `line.speaker`: a cast slot. `expression`: §1.6, default `neutral`.
- `choice` is offered to the player when the player cat is in the cast or is the pride leader watching. Off-screen (§0), cat A's option is drawn by `lean`: weight 0.5 + trait/50 for the option's lean trait, or 1.5 with no lean (skills-spec §8.4).
- Each option: `id`, `label` (≤ 40 chars), optional `lean` (one personality trait), optional `requires` (same keys as §2.3), optional `beats` (≤ 3, no nested choice), `effects` (≤ 2), and a required **`summary`** (≤ 100 chars, same rules as the top-level one) for the log.
- At most **one** choice per scene. If an option's `requires` fails it's hidden; at least one option must have no `requires`.
- Beats after a mid-scene choice play for every option (the rejoin).

### 2.5 `effects` (rel-spec §7)

Effects are **ids from the shared menu** `src/renderer/data/effects.json` (Tundra owns the values, Flint the code; one file for scenes and events, rel-spec §11.4). A scene names an id plus its targets, never a number.

```jsonc
{ "effect": "rel.up.small",    "pair": ["A","B"] }
{ "effect": "rel.shift",       "pair": ["A","B"], "from": "rivalry", "to": "friendship" }
{ "effect": "rel.grudge_start","holder": "A", "target": "B" }
{ "effect": "content.up.small","cat": "B" }
{ "effect": "flag.set", "flag": "A_owes_B_kill", "scope": "pair", "pair": ["A","B"] }
```

| Effect id | Target | Meaning (sizes in rel-spec §7) |
|---|---|---|
| `rel.up.small` / `.medium` / `.large` | pair | raise the pair value |
| `rel.down.small` / `.medium` / `.large` | pair | lower it |
| `rel.shift` | pair + `from`, `to` kind | move toward another kind |
| `rel.rivalry_start` / `rel.rivalry_end` | pair | add / remove `rivalry` |
| `rel.grudge_start` / `rel.grudge_end` | holder → target | set / clear a grudge |
| `rel.crush_start` / `rel.crush_end` | holder → target | set / clear a crush (gates apply) |
| `rel.admire_start` | holder → target | set admiration |
| `rel.mates_bond` | pair | form mates if eligible (the engine sets `breeding`) |
| `rel.mates_strain` | pair | strain a mates bond |
| `content.up.small` / `.medium`, `content.down.small` / `.medium` | cat | contentment |
| `mood.up.small` / `mood.down.small` | player | Mood |
| `loyalty.up.small` / `loyalty.down.small` | cat | `prideLoyalty` |
| `scuffle` | pair | non-lethal injury roll per Style (rel-spec §6) |
| `flag.set` / `flag.clear` | cat, pair or run | story flag |
| `none` | — | no change |

**Bounds:** ≤ **4** effects per scene, plus ≤ 2 per choice option. Per scene, total |rel change| ≤ 20, and per cat |contentment| ≤ 10 and |prideLoyalty| ≤ 3. Effects that break a gate are dropped and logged, never errors. The pair value is one number (rel-spec §0.2), so `rel.up.*`/`rel.down.*` take no `kind`.

### 2.6 `followUp`

```jsonc
"followUp": [ { "trigger": "rivalry", "sameCast": ["A","B"], "afterDays": [5, 20], "chance": "followUp.likely" } ]
```
`chance` is `followUp.unlikely`, `followUp.likely` or `followUp.certain` (rel-spec §4.6). Queued follow-ups take the next free scene day in their window, after priority 4.

### 2.7 Tokens

- **Names:** `{A.name}`, `{B.name}`, `{C.name}` (canonical; `{A}` is accepted as an alias). The player: `{player}`, `{player.name}`, or `{P.name}` (alias used in `courtship-lines.md`).
- **Pronouns:** `{X.he}`, `{X.him}`, `{X.his}`, `{X.himself}` for X = A, B, C, player or P. They resolve to he/she, him/her, his/her, himself/herself. A token is capitalised at the start of a line or after `. ! ?` and a space (Flint). Sentences are written so the verb doesn't change with the pronoun.
- **World:** `{pride}`, `{leader}`, `{zone}`, as in the event format.
- An unknown token fails validation.

## 3. Authoring rules (offline library)

3.1 **3–8 lines** (`line` beats) per scene, plus up to 4 narration beats. Total ≤ 12 beats including a branch.
3.2 **Length:** line text ≤ **140** characters (Ochre: 3 lines of ~60 chars at 28px) after tokens fill (budget names at 12). Narration ≤ 160. Choice labels ≤ 40. `summary` ≤ 100. One or two sentences per line.
3.3 **Bands, not numbers.** No digits, stats or game words ("affinity", "contentment", "XP") in any scene text. Show the relationship, don't report it. In the UI the player sees **Saga's band labels from `docs/game-copy.md` §2** (Director 2026-11-05): **Bad Blood** (hostile), **Wary** (cold), **Indifferent** (neutral), **Friendly** (warm), **Close** (close), and **Strangers** for a never-met pair. The raw band ids never show. Exact values show only with the `read_affinity` perk (rel-spec §11.3). Scene text never prints labels or values.
3.4 **Tone:** Warrior Cats warmth and drama (mentors, rivals, den gossip, loyalty), told in the Vale's voice: quiet, cold, ancient, a little mythic, plain English (world-and-prides). Cats speak of scent, prey, snow, the dens, the Ice Wall. No modern idioms, no human objects, no swearing beyond "fox-dung"-style mild cat curses.
3.5 **Never depend on side:** scars and markings appear mirrored on the right portrait, so text never says "left ear", "right saber" and so on. Say "the torn ear", "the old scar". The same goes for `summary` and `fallback`.
3.6 **No hardcoded names**, coats or ages. Names, coats and personality are rolled each run (world-gen v0.3.1). Describe looks only through tokens or not at all. No lore names except through tokens.
3.7 **Stage fit:** cubs speak simply; adolescents eager or sulky; elders slow and remembering. Use `requires.stage` so a line never lands on the wrong age.
3.8 **Personality fit:** if a line only makes sense for a bold or aggressive cat, gate it with `requires.trait`. Never build a scene's facts on temperament; temperament picks the voice.
3.9 **Crush, courtship, mates, mates_strain and jealousy work for any pairing** (Anna via Director; rel-spec v0.1.2 §1.8).
   - Tender, never explicit. **Crushes start at young adult.** Adolescents get **admiration** (hero-worship, not longing) and **rivalry**, never romance.
   - **Pronoun tokens only.** No sex-specific words in these scenes: no "tom", "queen", "she-cat", no "his mate's queen", no roles split by sex (who hunts, who nurses, who courts whom).
   - **Never assume cubs or a litter** in crush, courtship or mates beats. Any line about cubs, a litter, nursing or a den of young between the pair needs `requires.bond.breeding: true` on the scene, or on the option that carries the line.
   - Validation relies on the engine's eligibility check (attraction, age, kin), **not on sex**. A scene doesn't name a sex for its pair.
   - When an AI cat turns the player down for attraction, the game uses `courtship_declined_attraction` in `lore/courtship-lines.md` (gentle, no relationship loss, never hints at the trait).
3.10 **Fallback** is one short paragraph, past tense, a summary of the scene. **Summary** is one log line, past tense, ≤ 100 chars.
3.11 **Cadence (rel-spec §4.1, §4.4).** Authors should know how often scenes land, so the library has enough variety:
   - about 2.5 scenes per 20-day season for a 10-cat pride (Story ×1.25, Sim ×0.8);
   - at most 1 scene per day **per pride** (Director 2026-11-05), and **never on a day with a threat or challenge event**;
   - the **player is in at least 1 in 3** pride scenes when the player has any eligible pair, so every tag needs some scenes with a `player` slot;
   - before the player founds a pride, only `first_meeting` and `crush` loner scenes roll, and only when the player meets a cat.
3.12 **Story keeps drama at half weight** (rel-spec §11.5): `leader_doubt`, `mates_strain` and `rivalry_boils` still fire in Story, but less often. Write them so they can end soft.

## 4. AI generation contract (online and local)

4.1 **The game sends** (as one JSON context; prompt wording is Saga's, wiring Flint's):
- `seed`: `{ trigger, relType, tags, beatsTarget, choiceWanted: bool, choicePosition: "end"|"middle"|null, offscreen: bool }`. The game picks the trigger and cast; the model only writes.
- `cast`: per slot: `id`, `name`, `sex`, pronouns, `lifeStage`, `role`, pride, personality bands (not raw numbers), the slot template summary (history, wants, voice variant for the rolled bands), current `expression` set. **Not** the hidden `attraction` trait.
- `relationships` (rel-spec §8.3): per cast pair: kinds, band, met, kin, holder flags, and `breeding` for mates.
- `memory`: last ≤ 5 relevant memories per cast cat and pair (scene summaries, events, flags), one line each.
- `world`: season, zone, needs states that matter (player), recent pride events.
- `effectMenu`: the allowed effect ids for this trigger, with a one-line meaning each.
- `limits`: line count range, char caps, allowed expressions, `maxEffects` (4).

4.2 **The model returns** exactly the authored JSON **minus** `requires`, `id`, `weight`, `cooldown`, `styles`, `mix`, `version` (the game fills those). Required: `type`, `trigger`, `relType`, `tags`, `cast` (same slots as sent), `beats`, `effects`, `summary`, `fallback`; optional `followUp`. Options in a choice need `summary` and may carry `lean`. JSON only, no prose around it.

4.3 **Validation** (all must pass):
0. **Gates** (rel-spec §1.6–1.8): reject a crush/courtship/mates/mates_strain/jealousy scene unless both cats in the pair pass the engine's eligibility check for that kind (stage adult or elder, r < 0.125, attraction-compatible). Reject any scene that gives a cub a kind other than `family` or `playmate`, or gives an adolescent `crush` or `mates` (adolescent–adolescent `playmate` is allowed). Elders pass the romance stage gate. The game never seeds such a cast. Eligibility is never inferred from sex.
1. Parses as JSON; `type` is `scene`; `trigger` is one of §2.1a and matches the seed; `relType` is a subset of that trigger's kinds.
2. `cast` slots and `who` equal those sent. Every `speaker` is a cast slot. No other cat names in any text (checked against the run's name list and all world cats not in the cast). No new cats.
3. Tokens only from §2.7; names may appear only as tokens (literal cast names are accepted and turned into tokens).
4. Line count within `limits`; each text within its cap (line 140, narration 160, label 40, summary 100); ≤ 1 choice, ≤ 3 options, at least one option with no `requires`.
5. `expression` in the allowed set (otherwise coerced to `neutral`, not a failure).
6. Every effect id is in the sent `effectMenu`; targets are cast slots; ≤ 4 scene effects and ≤ 2 per option. No raw numbers anywhere in effects.
7. No digits in text (rule 3.3). No side words (`left`, `right`, `centre`) in any text. Banned-words list (game terms, modern words) per Tracker.
8. `summary` present (≤ 100) and, if there's a choice, a `summary` on every option. `fallback` present (≤ 300).
9. Romance scenes (rule 3.9): no sex-specific words, and no cub or litter words unless the seed's pair has `breeding: true`.

4.4 **Repair and retry:** small faults are fixed in place (trim to caps, coerce expression, drop bad effects, turn literal names into tokens, drop a side word). Otherwise retry once with the validator's error list appended. The budget is 1 try plus 1 retry, 20 s online and 45 s local, with a 60 s cap (Flint). If the second try fails or times out, run an **offline scene with the same trigger** whose `requires` pass for the bound cast. If none passes, skip the scene silently and log it with the trigger and world seed.

4.5 **Consistency:** the prompt tells the model to keep each cat to its template (history, wants, voice) and memory; not to resolve a relationship in one scene (no instant mates from strangers); and not to contradict memory (a cat who was attacked doesn't forget it). Accepted scenes are written to memory as their `summary` line, so later scenes can recall them. Tracker's in-character checks use the same templates.

## 5. Relation to the event format

Shared with `lore/events/*` (exile-event.md format): `id` (dotted), `styles`, `mix`, `{token}` style, pride flavour variants, choice `id` + label, and the rule that effects point at spec rules or menu ids, never invent numbers.

New in scenes:
- `type: "scene"`, a `trigger` tag + `relType` (events use `trigger` as a spec rule reference).
- `cast` slots with portrait positions, instead of the single `{cat}`.
- `beats` with speakers and `expression`, instead of one `text` block.
- Machine-checkable `requires`, instead of prose `when`.
- Effect ids from the shared menu, plus `followUp`.
- `weight`, `cooldown`, `summary`, `fallback`, `version`.
- Slot-scoped pronoun tokens `{A.he}` instead of `{he}`.

**Event JSON shell** (first used in `lore/events/perk-events.md`): `type: "event"` with the same `cast`/`beats`/`effects`/`summary`/`fallback`, plus `results` (one branch per rule outcome, each with `beats` and `summary`) and `byPride` (pride flavour text on a narration beat). Flint's one loader reads both. Older event files move to the shell when they're next touched.

## 6. Worked examples

All validated with Python `json.loads` and Saga's block checker (caps, tokens, sides, effect ids, gates, summaries). No numbers in effects; sizes come from the menu.

### 6.1 Friendship, 2 cats

```json
{
  "id": "scene.friendship.cold_watch",
  "type": "scene",
  "trigger": "friendship",
  "relType": ["friendship"],
  "tags": ["winter", "night", "tender"],
  "styles": ["story", "standard", "sim"],
  "mix": "story",
  "version": 2,
  "cast": {
    "A": { "slot": "left", "who": "pride" },
    "B": { "slot": "right", "who": "pride" }
  },
  "requires": {
    "rel": [ { "pair": ["A", "B"], "type": "friendship", "band": ["warm", "close"] } ],
    "stage": { "A": ["adult", "elder"], "B": ["adult"] },
    "season": ["winter"],
    "role": { "A": ["guard"] }
  },
  "weight": 1,
  "cooldown": { "scope": "pair", "days": 20 },
  "beats": [
    { "kind": "narration", "text": "Snow has buried the trail. {A.name} keeps the watch at the den mouth, alone, until a second shape settles beside {A.him}." },
    { "kind": "line", "speaker": "A", "expression": "neutral", "text": "Go back in, {B.name}. It's my watch, not yours." },
    { "kind": "line", "speaker": "B", "expression": "happy", "text": "Your watch, my fur. Two can stay warmer than one, even out here." },
    { "kind": "line", "speaker": "A", "expression": "neutral", "text": "If wolves come, you'll be the one they smell first." },
    { "kind": "line", "speaker": "B", "expression": "happy", "text": "Then they'll smell you close behind me. That's what friends are for." },
    { "kind": "narration", "text": "The wind drops. Neither cat says anything for a long while." },
    { "kind": "line", "speaker": "A", "expression": "happy", "text": "Stay, then. But if you snore, I'm telling the whole den." }
  ],
  "effects": [
    { "effect": "rel.up.small", "pair": ["A", "B"] },
    { "effect": "content.up.small", "cat": "A" }
  ],
  "summary": "{B.name} kept {A.name} company on a cold winter watch.",
  "fallback": "On a cold winter watch, {B.name} came out to sit beside {A.name} so {A.he} would not keep it alone. The two friends shared the long night."
}
```

### 6.2 Rivalry, 3 cats, player choice

```json
{
  "id": "scene.rivalry.whose_kill",
  "type": "scene",
  "trigger": "rivalry",
  "relType": ["rivalry"],
  "tags": ["hunt", "tense"],
  "styles": ["story", "standard", "sim"],
  "mix": "story",
  "version": 2,
  "cast": {
    "A": { "slot": "left", "who": "pride" },
    "B": { "slot": "right", "who": "pride" },
    "C": { "slot": "centre", "who": "player" }
  },
  "requires": {
    "rel": [ { "pair": ["A", "B"], "type": "rivalry", "band": ["cold", "hostile"] } ],
    "stage": { "A": ["adult"], "B": ["adult"] },
    "role": { "A": ["hunter"], "B": ["hunter"], "C": ["leader"] }
  },
  "weight": 1,
  "cooldown": { "scope": "pair", "days": 15 },
  "beats": [
    { "kind": "narration", "text": "A young horse lies at the river crossing. Two hunters stand over it, and neither will step back." },
    { "kind": "line", "speaker": "A", "expression": "angry", "text": "I drove it into the shallows. Without me, it would be halfway to the Bonefield." },
    { "kind": "line", "speaker": "B", "expression": "angry", "text": "And I took its throat while you were still splashing. Ask the blood whose sabers it knows." },
    { "kind": "line", "speaker": "A", "expression": "angry", "text": "{C.name}. You saw it. Tell {B.him}." },
    {
      "kind": "choice",
      "prompt": "Both hunters turn to you.",
      "options": [
        {
          "id": "side_a",
          "label": "{A.name} drove the hunt.",
          "lean": "loyalty",
          "beats": [
            { "kind": "line", "speaker": "B", "expression": "sad", "text": "So that's how it is. I'll remember whose ears you listen to." }
          ],
          "effects": [
            { "effect": "rel.up.small", "pair": ["C", "A"] },
            { "effect": "rel.down.small", "pair": ["C", "B"] }
          ],
          "summary": "{C.name} sided with {A.name} over a kill, and {B.name} took it hard."
        },
        {
          "id": "side_b",
          "label": "{B.name} made the kill.",
          "lean": "boldness",
          "beats": [
            { "kind": "line", "speaker": "A", "expression": "sad", "text": "Then next time, {B.name} can chase the herd alone." }
          ],
          "effects": [
            { "effect": "rel.up.small", "pair": ["C", "B"] },
            { "effect": "rel.down.small", "pair": ["C", "A"] }
          ],
          "summary": "{C.name} sided with {B.name} over a kill, and {A.name} took it hard."
        },
        {
          "id": "share",
          "label": "It took you both. Eat together.",
          "lean": "sociability",
          "requires": { "trait": [ { "cat": "C", "trait": "sociability", "band": "high" } ] },
          "beats": [
            { "kind": "narration", "text": "A long, stiff silence. Then {B.name} lowers {B.his} head to the kill, and after a moment, so does {A.name}." }
          ],
          "effects": [
            { "effect": "rel.shift", "pair": ["A", "B"], "from": "rivalry", "to": "friendship" }
          ],
          "summary": "{C.name} made rival hunters {A.name} and {B.name} share a kill."
        }
      ]
    },
    { "kind": "narration", "text": "Crows gather on the far bank. They will get their share, whatever the cats decide." }
  ],
  "effects": [
    { "effect": "rel.down.small", "pair": ["A", "B"] }
  ],
  "followUp": [ { "trigger": "rivalry", "sameCast": ["A", "B"], "afterDays": [5, 20], "chance": "followUp.likely" } ],
  "summary": "{A.name} and {B.name} quarrelled over a kill at the river.",
  "fallback": "{A.name} and {B.name} quarrelled over who had made a kill at the river crossing, and {C.name} was asked to settle it."
}
```

### 6.3 Crush, 2 cats (any pairing)

```json
{
  "id": "scene.crush.the_feather",
  "type": "scene",
  "trigger": "crush",
  "relType": ["crush"],
  "tags": ["spring", "mere", "tender", "comic"],
  "styles": ["story", "standard", "sim"],
  "mix": "story",
  "version": 2,
  "cast": {
    "A": { "slot": "left", "who": "pride" },
    "B": { "slot": "right", "who": "pride" }
  },
  "requires": {
    "flag": [ { "kind": "crush", "holder": "A", "target": "B" } ],
    "rel": [ { "pair": ["A", "B"], "type": "none", "band": ["warm"] } ],
    "stage": { "A": ["adult", "elder"], "B": ["adult", "elder"] },
    "kin": [ { "pair": ["A", "B"], "kin": "none" } ],
    "season": ["spring", "summer"]
  },
  "weight": 1,
  "cooldown": { "scope": "pair", "days": 20 },
  "beats": [
    { "kind": "narration", "text": "{A.name} comes back from the Mere with wet paws and a goose feather caught in {A.his} fur, very pleased with {A.himself}." },
    { "kind": "line", "speaker": "B", "expression": "happy", "text": "Did you catch a goose, or did a goose catch you?" },
    { "kind": "line", "speaker": "A", "expression": "neutral", "text": "It got away. Most of it. I brought you the part that didn't." },
    { "kind": "line", "speaker": "B", "expression": "happy", "text": "A feather. You waded the cold Mere to bring me a feather." },
    { "kind": "line", "speaker": "A", "expression": "sad", "text": "It sounded better in my head." },
    { "kind": "narration", "text": "{B.name} takes the feather gently in {B.his} jaws and lays it in {B.his} own nest." },
    { "kind": "line", "speaker": "B", "expression": "happy", "text": "Next time, bring the rest of the goose. But I'll keep this one." }
  ],
  "effects": [
    { "effect": "rel.up.medium", "pair": ["A", "B"] },
    { "effect": "content.up.small", "cat": "A" },
    { "effect": "flag.set", "flag": "kept_gift", "scope": "pair", "pair": ["B", "A"] }
  ],
  "followUp": [ { "trigger": "crush", "sameCast": ["A", "B"], "afterDays": [10, 30], "chance": "followUp.unlikely" } ],
  "summary": "{A.name} brought {B.name} a goose feather, and {B.name} kept it.",
  "fallback": "{A.name} brought {B.name} a goose feather from the Mere after the goose got away. {B.name} laughed, and kept it."
}
```

Note on 6.3: `rel.type: "none"` with a band just checks the band. The crush itself is the `flag` row, so the scene works whichever cats hold it.

### 6.4 Leader doubt (drama warning, rel-spec §5.4)

Fires at least 1 season before a `leader_challenge` roll can fire in the player's pride. The player is the leader (B). In Story it's at half weight (§3.12).

```json
{
  "id": "scene.leader_doubt.cold_kill",
  "type": "scene",
  "trigger": "leader_doubt",
  "relType": ["rivalry", "grudge"],
  "tags": ["tense", "den"],
  "styles": ["story", "standard", "sim"],
  "mix": "story",
  "version": 2,
  "cast": {
    "A": { "slot": "left", "who": "pride" },
    "B": { "slot": "right", "who": "player" },
    "C": { "slot": "centre", "who": "pride", "optional": true }
  },
  "requires": {
    "rel": [ { "pair": ["A", "B"], "type": "none", "band": ["cold", "hostile"] } ],
    "stage": { "A": ["adult"] },
    "role": { "B": ["leader"] }
  },
  "weight": 1,
  "cooldown": { "scope": "trigger", "days": 40 },
  "beats": [
    { "kind": "narration", "text": "The pride is at the kill. {A.name} eats first, before the leader, and makes sure everyone sees it." },
    { "kind": "line", "speaker": "C", "expression": "sad", "text": "{A.name}. That's not your place." },
    { "kind": "line", "speaker": "A", "expression": "angry", "text": "Places are for cats who earn them. Ask the pride who fed them this winter." },
    { "kind": "line", "speaker": "A", "expression": "neutral", "text": "I'm not challenging anyone, {B.name}. Not today." },
    {
      "kind": "choice",
      "prompt": "The whole pride is watching you.",
      "options": [
        {
          "id": "hear_out",
          "label": "Hear {A.name} out.",
          "lean": "sociability",
          "beats": [
            { "kind": "line", "speaker": "A", "expression": "neutral", "text": "You lead from the den. I hunt in the snow. That's all I'm saying." }
          ],
          "effects": [
            { "effect": "rel.up.small", "pair": ["A", "B"] },
            { "effect": "loyalty.up.small", "cat": "A" }
          ],
          "summary": "{B.name} heard out {A.name}'s complaint at the kill."
        },
        {
          "id": "face_down",
          "label": "Stand over the kill.",
          "lean": "aggression",
          "beats": [
            { "kind": "narration", "text": "You walk to the kill and stand over it until {A.name} backs away, slow and stiff." },
            { "kind": "line", "speaker": "A", "expression": "angry", "text": "Not today, then." }
          ],
          "effects": [
            { "effect": "rel.down.small", "pair": ["A", "B"] },
            { "effect": "content.down.small", "cat": "A" }
          ],
          "summary": "{B.name} faced {A.name} down over the kill."
        },
        {
          "id": "let_it_go",
          "label": "Let it pass.",
          "beats": [
            { "kind": "narration", "text": "You say nothing. {A.name} finishes eating, and several of the pride notice that you said nothing." }
          ],
          "effects": [
            { "effect": "loyalty.down.small", "cat": "A" }
          ],
          "summary": "{B.name} let {A.name} eat first, and the pride noticed."
        }
      ]
    }
  ],
  "effects": [],
  "followUp": [ { "trigger": "leader_doubt", "sameCast": ["A", "B"], "afterDays": [40, 80], "chance": "followUp.unlikely" } ],
  "summary": "{A.name} ate before the leader at the kill.",
  "fallback": "{A.name} ate first at the kill, ahead of {B.name}, and made sure the whole pride saw it."
}
```

Note on 6.4: the pair's rivalry or grudge toward the leader is the trigger's own eligibility (§2.1a), so `requires.rel` only narrows the band.

## 7. Open questions

**Tundra (relationships-spec)**
7.1 ~~Final relationship kinds and ids~~ **ANSWERED (rel-spec §1.4):** 8 kinds, one value per pair plus kinds; crush, grudge and admiration are one-sided flags (§2.1b).
7.2 ~~Band names and cut-offs, never-met default, decay~~ **ANSWERED (rel-spec §1.2, §1.3, §2.3):** 5 bands; never-met reads 0; decay 3 per season (1 with contact).
7.3 ~~Trigger tags, rel types, frequency, cooldowns~~ **ANSWERED (rel-spec §4.1–4.3):** §2.1a and §3.11.
7.4 ~~Effect sizes, `rel.shift`, per-scene caps, followUp chance ids~~ **ANSWERED (rel-spec §7, §4.6):** §2.5, §2.6.
7.5 ~~Personality band cut-offs~~ **ANSWERED (rel-spec §3.1):** < 35 / 35–69 / ≥ 70. Adolescent crushes: resolved (Director): none; crushes start at young adult.
7.6 ~~How scene effects feed contentment, mating, leaving and challenges~~ **ANSWERED (rel-spec §5).**
7.6a ~~Same-sex crushes and mates~~ **ANSWERED (Anna via Director, rel-spec v0.1.2 §1.8):** yes, at lower odds, through a hidden `attraction` trait. Same-sex mates form a non-breeding bond. Scenes follow §3.9.
7.6b ~~Band words on screen~~ **ANSWERED (Director 2026-11-05):** Saga's labels from `game-copy.md` §2, never raw ids (§3.3).
7.6c ~~Elder mates, adolescent playmates, scene cap scope, history crushes~~ **ANSWERED (Director 2026-11-05):** §2.1b, §2.3, §3.11.

**Flint**
7.7 ~~Runner location and loader~~ **Resolved (Flint):** one runner, `story/runner.js`, one loader for `type: event|scene`. Files in `src/renderer/data/scenes/` and `src/renderer/data/events/`; the effect menu is `src/renderer/data/effects.json`.
7.8 ~~Parse API, AI budget~~ **Resolved (Flint):** `parseScene` / `validateScene` accepted; 1 try + 1 retry, 20 s / 45 s, 60 s cap; failures logged with trigger and world seed.
7.9 ~~Token resolver~~ **Resolved (Flint):** `{X.he|him|his|himself}` for A, B, C and the player, capitalised at line start or after `. ! ?`. **New ask:** the `{X.name}` canonical form with `{A}` and `{P.*}` as aliases (§2.7), optional slots (§2.2), and option `lean` for off-screen picks (§2.4).

**Ochre**
7.10 ~~Portrait facing~~ **Resolved (Ochre, provisional):** the centre slot faces the current or last speaker and flips when the speaker changes; when the centre cat speaks, it faces the left slot. Text never names a side.
7.11 Expression set beyond the four: are `shy` and `hurt` next? Full head redraws or overlay layers?
7.12 Speaker highlight and dimming, and cub/adolescent portraits in scenes. **Partly resolved (Ochre, provisional):** the box is about 1500×240 at 1080p, 3 lines of about 60 chars, name tab above; the 140-char cap stays.

## Changelog
- v0.2.1 (2026-11-05, Saga): Director rulings: elders can be mates (breeding per fertility), adolescent–adolescent playmates, 1 scene per day per pride, band labels from game-copy §2, history grudges and rivalries seeded but history crushes only when compatible.
- v0.2 (2026-11-04, Saga): matched relationships-spec v0.1.2. 15 trigger tags with cooldowns and priorities (§2.1a); 8 kinds, one-sided flags and the `breeding` flag (§2.1b); 5 bands, `flag` and `bond.breeding` in `requires`, and the age, kin and cub gates (§2.3, §4.3); the rel-spec §7 effect menu with ≤ 4 effects per scene + 2 per option (§2.5); required `summary` on scenes and choice options, plus option `lean`, for off-screen AI-pride scenes (§0, §2.4); cadence and Story drama weight (§3.11, §3.12); any-pairing rules for romance scenes (§3.9); bands-not-numbers (§3.3); event JSON shell (§5); new worked example `leader_doubt` (§6.4); examples updated to validate. Closed §7.1–7.6.
- v0.1 (2026-11-04, Saga): first draft. Adolescents-no-crushes rule added (Director).
