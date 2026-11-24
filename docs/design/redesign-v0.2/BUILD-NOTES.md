# Rebuild notes

Plain-reading calls and spec rulings made while building the v0.2 UI. LAYOUT.md and COPY.md stay the layout and copy sources. This file records where a later ruling overrides them.

## v0.2i text floor (Tundra, 2026-11-22)

The 18px minimum applies at every window size, including 720-tall windows and map labels. LAYOUT.md §1.4's old floors (body 16px and labels 15px at 720, map labels 14px at 720) are gone. STYLE.md and `mockups/check.py` already use 18u and WCAG AA (4.5:1, or 3:1 for text at least 24px or bold and at least 18.66px). The game e2e uses that same bar.

If four choices do not fit in the story panel at 720 with 150% scaling, use LAYOUT.md §4's fallback: one choice per row, and the narration scrolls. The rest of the layout is unchanged.

## 18px versus the first rebuild brief

The first rebuild brief said body text 16px or larger. The correction, and then v0.2i, set the floor at 18px everywhere. The e2e asserts 18px, not 16px.

## Fight win chance

The spec asks for a fight win-chance function so fights can use the same five odds bands, and it does not give a formula. The plain reading is a strength comparison around an even fight: 50% when the two strengths match, plus 100 points times (player strength / foe strength − 1), clamped to the hunt clamp already in `encounter-engine.json` (5–95). No new fight cutoff was added. The odds word is then the same band table as hunts, with the fight sentences from COPY.md.

## Scene scale

`--s` is `max(1px, window height / 1080 × UI scale)`. At 720 the unclamped unit would be about 0.67px and an 18u label would draw at 12px. The floor keeps every 18u label at 18px or larger, including map labels. At 720 with UI scale 1.5, story choices go to one column and the narration scrolls.

## Day's end

The day report is its own mode. Continue calls `dismissReport`, clears the report, and saves, so a load does not bring that day back. The dock no longer holds the report.

## Creator steps

The appearance text field is on Look. Ready is the confirm step and reads the text already stored from Look.

## Creator traits

`den_father` stays in the trait table so the existing 57-row count holds. The creator does not offer it. A third litter now grants `den_mother` for either sex. Sickly Line (`tainted_blood`) is shown as Frail Blood. The appearance text field is still on the Ready step, because that step's focus id is what the creator tests confirm. Look already carries coat, markings, and eyes, and both steps label the picture stand-in art.

## Encounter scenes

Hunt and the hyena fight both use `assets/game/snowy-plain.png`, so the ridge silhouettes are gone. A wolf fight uses `assets/game/forest-clearing.png` (mockup 04). Dialogue uses `assets/game/frozen-lake.png` (mockup 05). The deer and hyena bodies are `assets/encounters/giant-deer.png` and `assets/encounters/cave-hyena.png`. At 720 with UI scale 1.5, encounter choices stack one per row on the right and the narration scrolls, and the cats stand above the panel.

## New Game lock

While the slice lock is on, Story and Sim stay on the Play style row, greyed, with the same "Not yet available. It's coming in a later update." line as Heir and Sandbox. Only Balanced and Permadeath can be selected.

## Hunt chance

Live hunts and the headless engine both call `huntChance` in `encounter-engine.js`. The separate point formula in `slice.js` is no longer used for the chance number. Keen Nose and Dull Nose do not change that number. After the chance is computed, `huntBand` shifts the odds band by one step (Keen Nose easier, Dull Nose harder). The shifted band picks the odds word. The catch roll still uses the unshifted chance, so the published chance number and the band cutoffs stay put. Easy wording is reachable when Keen Nose lifts a good band.
