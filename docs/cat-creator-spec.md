# Sabretooth: Make Your Sabrecat, Cat Creator Spec (v0.3.3, FROZEN by Director 2026-11-04; v0.3–v0.3.2 changes per Director's rulings, proof of concept)
Owner: Tundra (rules and numbers). Copy (labels, option names, default names): Saga, in `main-menu-copy.md`. Art masks: Ochre, per `docs/art/portrait-layers.md`. Code: Flint. QA: Tracker.
Scope set by Director, 2026-11-04. This spec is frozen once Director gives the OK.
Related: main-menu-spec v1.3.2 §2 and §5 (New Game setup, `mainCat`); genetics-spec v0.1 §1, §2 and §6 (loci, tints, genotype schema).

## 1. Where it sits
1.1 **Flow:** New Game setup → **Begin** → (slots-full dialog, if both run slots are used) → **Make Your Sabrecat**: step 1 **Look**, then **Next**, then step 2 **Personality** → **Start**, which creates the run.
1.2 **Replacing a run happens on Start, not on Begin.** If the player picked a run to replace, it is only deleted when they press Start. Backing out of the creator leaves it untouched.
1.3 **Back** (or Esc/B) returns, with no confirmation, to New Game setup with the Style, Death rule and Sandbox options as they were. Creator choices are discarded.

## 2. Layout
2.1 **Left:** live portrait preview, built by the layered compositor on the approved three-quarter bases (male or female, by Sex). Pose ids are `portrait-male` and `portrait-female` (confirmed by Ochre). The canvas is 1152×864, and the layers in `assets/portraits/<pose>/` are, bottom to top: shadow, base_coat, undercoat, markings_spotted / _rosette / _barred / _faintstripe, markings_dorsal (Sandbox), eye_left, eye_right, sabers, lineart. Ochre's `portrait-layers.md` wins on art details.
2.2 **Right panel, step 1 (Look), top to bottom:** Name, Sex, Coat, Undercoat, Markings, Eyes (plus the Sandbox rows in §3c), then a button row with Randomize, Back and Next.
2.2a **Right panel, step 2 (Personality), top to bottom:** a Preset row, five trait sliders (§3b), then a button row with Randomize, Back and Start. Back on step 2 returns to step 1 and keeps everything. Back on step 1 returns to New Game setup (§1.3).
2.2b A step indicator ("1 Look · 2 Personality", worded by Saga) sits above the panel. The preview portrait stays visible on both steps, since personality doesn't change the art.
2.3 The preview redraws on every change, within 100 ms. There's no animation, so Reduced Motion needs no special case.

## 3. Options and gene mapping
All ids are genetics-spec ids. The player sees Saga's names.

| # | Row | Options (id → genetics allele) | Default on open |
|---|---|---|---|
| 3.1 | Name | free text, 1–16 characters: letters, spaces, hyphen, apostrophe. Trimmed, with double spaces collapsed. | a random name from Saga's `creator.defaultNames` list (at least 20 names) |
| 3.2 | Sex | `male`, `female`. Swaps the base. | random 50/50 |
| 3.3 | Coat | `tan` → `tawny`, `gray` → `greydun`, `brown` → `russet`, `black` → `melan`/`melan`, `sandy` → `sandy` (v0.3.1: 5 coats in every Style, Director's ruling) | random, uniform |
| 3.3a | Undercoat (v0.3.2) | `cream` → `cream`, `pale` → `pale`, `off` → `off` (colour only; opacity fixed at 0.85, `underInt ["U+","U+"]`) | random, uniform |
| 3.4 | Markings (one body pattern) | `none` → `plain`, `spotted` → `spotted`, `faintstripe` → `faintstripe`, `rosette` → `rosette`, `barred` → `barred` (v0.3.2) | random, uniform |
| 3.5 | Eyes | `amber` → `amber`, `gold` → `gold`, `green` → `green` | random, uniform |

3.6 **Tints and layers:** use genetics-spec §2 exactly, at full colour (no dilution) and medium intensity, so marking opacity is 0.60. `black` uses the melanistic marking tint `#1E1A17` (ghost markings). Sandbox `pale` uses leucistic `#D2C3A8`, and `ash` uses the coat-derived rule. `none` draws no marking layer.
3.7 **Fixed, not shown:** no dilution, no dorsal stripe (except §3c.2a), medium intensity, no white, ivory sabers, adult life stage, no scars. There are no odd eyes unless the Sandbox options in §3c are used.
3.7a **Art gating (v0.3.2):** an option or row whose mask isn't in **both** adult pose folders is hidden, and Randomize skips it. Flint checks at creator open. Today, undercoat, rosette, barred and dorsal wait on Ochre's phase 1 masks (genetics v0.4 §2.7). Until then they fall back to the pre-v0.3.2 lists.
3.7b **Deferred (Director, 2026-11-05):**
   - **Facial mask** and **ticking** join the normal-Style creator when their art lands, as rows `mask` (off/on) and `ticking` (off/on).
   - **Points** and **tear lines** become Sandbox-only rare looks when their art lands, as rows `points` (off/on) and `tearlines` (off/on), and join the 10% rare pick (§3c.4).
3.8 **Rarity (v0.3.1, Director's ruling 2026-11-04):** every Style shows the 5 coats in §3.3, `black` included. It writes two melanistic copies, even though melanistic is rare in genetics §3.5. `green` eyes (uncommon) are allowed in every Style. Only `pale`, `ash` and odd eyes are Sandbox-only (§3c).

## 3c. Sandbox-only rare looks (Director's ruling)
3c.1 **When shown:** only when the Death rule is Sandbox **and** Free Customization is On (the Sandbox default; genetics §3.6). With Free Customization Off, the creator shows the common set as in the other Styles.
3c.2 **Extra Coat options**, added to the end of the Coat row:
   - `pale` → `leuc`/`leuc` (leucistic)
   - `ash` → `melan`/`leuc` (codominant ash)
3c.2a **Dorsal stripe (v0.3.2, rare):** a row `dorsal`, values `off` (default) and `on`, placed under Markings. It stacks on any body pattern. On → `dorsal ["Ds","Ds"]`, off → `["ds","ds"]`.
3c.3 **Odd eyes:** a new row, `oddEyes`, placed under Eyes, with values `off` (default) and `on`.
   - **On:** the Eyes row splits into **Left eye** and **Right eye** (`eyeLeft`, `eyeRight`). Each picks from `amber`, `gold`, `green`, and the two must differ (Right skips the Left value).
   - **Genes:** `eyes` = [left, left], `het` = [`het`,`het`], `genes.eyeRight` = right.
   - **Off:** `het` = [`Het`,`Het`] and `eyeRight` = null.
3c.4 **Randomize (Sandbox with §3c shown):** with a **10% chance**, the result includes exactly **one** rare look, picked uniformly from `pale` coat, `ash` coat, odd eyes (with a random differing right eye) and dorsal stripe (v0.3.2). Only options whose art exists (§3.7a) are in the pick. The other 90% of the time, it rolls uniformly over the common options only. Every other case (Story, Standard, Sim, or Sandbox with Free Customization Off) never rolls rare looks. **Natural rates** (genetics §1, §2.5) still apply to breeding and world-gen. The 10% is a creator-only convenience.
3c.5 **Saves:** a Sandbox run with rare looks saves and loads normally. The Style is locked per run, so there's no migration case.
3c.6 **Ids for Saga to label:** coats `black`, `sandy`, `pale`, `ash`; the row `oddEyes` with values `off`/`on`; the rows `eyeLeft` and `eyeRight`.
   - **v0.3.2:** the row `undercoat` with `cream`/`pale`/`off`; markings `rosette` and `barred`; the row `dorsal` with `off`/`on`.
   - **Deferred:** rows `mask`, `ticking`, `points`, `tearlines`.
   - Note: `pale` appears both as a coat id and an undercoat id. Saga should give them distinct labels (e.g. "Pale (leucistic)" vs "Pale belly").

## 4. Controls
4.1 **Randomize** rerolls Coat, Markings and Eyes, uniformly from the options above. It keeps the Name and Sex the player set. If the new result is identical to the current look, it rerolls once more so the button always visibly changes something.
4.2 **Start** is always enabled. If the Name is empty after trimming, Start fills in a random default name and goes ahead without showing an error. That way a gamepad player who never types still gets a named cat.
4.3 **Navigation** follows main-menu-spec §4:
   - Up/Down move between rows and the button row. Focus starts on Name, and lists wrap top to bottom.
   - Left/Right (A/D, D-pad or stick) cycle the options in Sex, Coat, Markings, Eyes and Preset, change a trait slider by ±5 (hold to repeat per main-menu-spec §4), and move between the buttons in the button row. Enter/Space/A also cycles an option row.
   - Name: with the keyboard, typing goes straight into the field while it's focused, and Left/Right move the text cursor. With the mouse, click the field. With a gamepad, A on Name picks a new random default name, because there's no on-screen keyboard in v0.1.
   - Esc/B is Back. Start on the gamepad is the Start button.
   - Mouse: click an option arrow or value to change it, and click the buttons. Hover never changes focus order.
4.4 Keyboard, gamepad and mouse can all reach every control.

## 5. Data written on Start
5.1 `menu:newGame` gains a `mainCat` field, so the payload is `{style, difficulty, replaceRunId?, sandboxOptions?, mainCat}`. Added in main-menu-spec v1.4 (Director OK, 2026-11-04).
5.2 `mainCat` = `{catId, name, sex, lifeStage: "adult", genes, scars: []}`. `catId` is a new unique id. The cat is **exactly 3 years old** (`ageSeasons` 12, a fresh adult; Anna via Director). The run's full Cat record stores `ageSeasons: 12`. The snapshot keeps only `lifeStage`.
5.3 `genes` follows genetics-spec §6:
   - `coat`, `marking` and `eyes` are **homozygous** for the chosen allele, for example `["greydun","greydun"]`.
   - Fixed loci: `dilute ["D","D"]`, `dorsal ["ds","ds"]`, `intensity ["I+","I-"]`, `white ["none","none"]`, `saber ["ivory","ivory"]`, `under` homozygous for the pick, `underInt ["U+","U+"]`, `tick ["tk","tk"]`, `points ["Pt","Pt"]`, `mask ["mk","mk"]`, `tear ["Tl","Tl"]`, `dorsal` per §3c.2a, `het ["Het","Het"]` with `eyeRight` null, unless §3c.3 applies. `mutations` is `[]`.
   - Sandbox rare coats write the pair in §3c.2 (ash is the only heterozygous coat). `black` writes `["melan","melan"]`.
   - Rolling hidden recessives (genetics-spec §1.11 and §3.6) is deferred until after the proof of concept.
5.4 `genes.personality` = the five slider values from step 2, as chosen. This replaces the v0.1 roll. Start also sets `prideLoyalty` per loners-spec §3.4 once the cat is in a pride.
5.5 The run's first save meta and the menu cat (main-menu-spec §1) read this `mainCat`, so the menu shows the cat the player made.

## 6. Out of scope (v0.1)
White patterns, dilution, dorsal stripe, intensity, saber tint, scars, rare and mutation traits beyond 3.8, the lying pose preview, an on-screen keyboard, and name validation beyond 3.1.

## 7. Test checklist for Tracker
1. All 2 × 5 × 3 × 5 × 3 = 450 common look combinations (sex × coat × undercoat × markings × eyes) render with no missing layer. In Sandbox with Free Customization On, `pale`, `ash` and odd-eye pairs render too. Over 10k Sandbox Randomizes, about 10% (±1) include exactly one rare look, spread evenly across the available ones. With a mask file removed, its option is hidden and never rolled, and normal Styles never show §3c options. Placeholder masks are fine until Ochre's art lands.
2. Changing Sex swaps the base and keeps Coat, Markings and Eyes.
3. Randomize keeps Name and Sex and always changes the look.
4. An empty or whitespace-only name gets a default on Start. A 17th character is rejected.
5. Back keeps the setup screen's choices, and a replaced run still exists after Back.
6. On Start, the save meta `mainCat` matches the preview, and the genes are homozygous as in 5.3.
7. Every control can be reached with keyboard only, gamepad only, and mouse only.
8. Each preset sets exactly the values in 3b.3. Moving a slider switches the Preset row to `custom`.
9. Sliders are clamped to 20–80, or to 0–100 for Sandbox with Free Customization On, in steps of 5. Randomize on step 2 stays inside that range, and Randomize on step 1 leaves personality alone.
10. Going Back from step 2 to step 1 and then Next keeps both the look and the personality.
11. On Start, `mainCat.genes.personality` equals the slider values exactly.

## Changelog
- v0.3.2 (2026-11-05, Director-approved): Undercoat row added in every Style (colour only: cream/pale/off, opacity fixed at medium). Markings gain `rosette` and `barred`. Dorsal stripe is Sandbox-only and joins the 10% rare pick. Every option is gated on its mask existing. Deferred: mask + ticking (normal Styles), points + tear lines (Sandbox). Follows genetics v0.4. Backup: `cat-creator-spec.v0.3.1.bak.md`.
- v0.3.1 (2026-11-04, **Director's ruling**, overrides v0.3): `black` (two melanistic copies) is restored, and `sandy` is kept: 5 coats in every Style. Sandbox-only (with Free Customization On) is now `pale`, `ash` and odd eyes. Sandbox Randomize rolls exactly one rare look 10% of the time. Natural rates are unchanged for breeding and world-gen. Backup: `cat-creator-spec.v0.3.bak.md`.
- v0.3 (2026-11-04, Director-approved; Anna's answers): `black` is removed from normal Styles and replaced by `sandy`. Added §3c Sandbox-only rare looks (black/pale/ash coats, odd eyes with separate left/right) with natural-rate Randomize. Genes now include `het` and `eyeRight`. Backup: `cat-creator-spec.v0.2.bak.md`.
- v0.1.1 (2026-11-04, Director OK): the player cat starts at exactly 3 years old (12 seasons). Back has no confirmation.
- v0.2 (2026-11-04, Director OK): Personality step added, with 5 traits, 5 presets and Randomize (§2.2a, §3b, §5.4).
- v0.3.3 (2026-11-05, Tundra, per Ochre): the Undercoat row writes `underInt` as two `U+` copies, for opacity 0.85.
