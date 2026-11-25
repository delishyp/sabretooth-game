# UX simplification mockups: notes for Anna, Tundra, Flint and Saga

Ochre, 17 Nov 2026 (Asia/Jerusalem). These are mockups only. No game source was changed, and nothing was committed, pushed, merged or installed. No art was generated, upscaled or recoloured. Every image is an existing approved still that was already used in `/workspace/qa/ui-declutter-mockup/`: the landscape, the player sprite, the full-body panels, and the head and bust crops.

**Rulebook:** Tundra's `docs/design/ux-simplification-v0.1.md` **v0.1.5 (FINAL rules)**, local commit `66eaeb7` in `/workspace/sabretooth` (earlier passes followed v0.1.2 `b50286c` and v0.1.4 `e7b291f`). Applied:
- Anna's rulings: locked sections and actions show **greyed out** with an "opens when" line, and needs stay as **quiet bars**.
- v0.1.3/3a: choice screens (dialogue choices, encounter moves) have no gold primary, and map region names are at least 14px at 720.
- v0.1.4: only real action names; Map is Wilderness and Deeds sit in Lore (no rail items for either); greyed sections stay focusable and selectable by mouse, keys and pad.
- v0.1.5: the top-bar day is a label, "{Season} · Day {n}", with "· Mating season" while the window is open and no "/20". Locked actions under More are one line (name + Locked), and only the focused one shows its opens-when line. The encounter state line uses the threat's name. Ask to join shows for loners on a pride's held land once its leader is met.

**Copy:** Saga's final UI copy `/workspace/saga-narrative-voice/ui/ui-copy-v1.md` (sections B and C) and `ui-copy-v1.json`, re-read after her v0.1.4 update. No `[placeholder]` tags or dashed outlines remain.

**Before shots:** captured from **`ac2665d`** (the PR 2 tip) using a temporary read-only `git worktree` at `/tmp/st-ac2665d`. Captures were headless Electron at 1280×720 and 1920×1080, using `scripts/capture-before.js`. The main checkout was not touched.

## Files
| What | Where |
|---|---|
| Pages (HTML) | `den-day1`, `den-locked`, `den-actions`, `den-more-actions`, `den-later`, `den-later-actions`, `dialogue`, `dialogue-choices`, `encounter`, `traits`, `map` (`.html`) |
| Shared shell CSS | `shell.css` (frame, rail, top bar, goal line, primary slot, drawers, toast) |
| Per-screen CSS | `screens.css` |
| Harness | `scripts/build.py` writes every page from one shell template, `scripts/render.sh` renders stills with headless Chrome, and `scripts/audit.js` checks text size, clipping and the primary slot. `scripts/capture-before.js` takes the BEFORE shots. |
| Stills | `<page>-1080.png` and `<page>-720.png` (22 in total); BEFORE shots are in `before/` |
| Share | `share/<screen>-before-after-{720,1080}.jpg` for home, dialogue, encounter, traits and map, all 2580×770 (before at x=0, after at 1300,50, both 1280×720); plus `share/progressive-disclosure-*.jpg`, `share/den-action-panel-*.jpg`, `share/extra-states-*.jpg` and one jpg per still |
| Zoom crops (720, 2×) | `crops/` |
| Audit output | `audit.txt` |

## Shared shell rules (the same on every screen)
1. **Top left: Back.** On Home/Den, Back is hidden because there is nowhere to go back to, but the corner stays reserved.
2. **Top bar:** player head, the kicker ("A lone cat" or the pride name) and name, **place · season-day in words**, four **quiet need bars** with labels (Health, Hunger, Thirst, Energy), and one **Menu** button that holds Save and Main menu. A need in its Low band lights amber and shows the word **Low**. There are no numbers.
3. **Goal line** sits directly under the top bar on every screen and always shows. When a need is Low, the urgent line (`goalLine.urgent.*`) appears in front of it. **Guide** at the right opens the goal's Guide entry. In the creator, the same slot carries the step line.
4. **Places rail (left):** all 12 sections, always in the same order. On day one, **Home, Wilderness, Smilodons and Lore** are active.
   - Locked sections are **greyed** `#9c8c78` (5.7:1 on the rail, legible at 720) with a small lock glyph. They never show the word "Unavailable".
   - Greyed items are **still selectable** (mouse, keys, pad; `cursor:pointer`). They have a hover/focus state (brighter label, outline) and a selected state (solid border).
   - Selecting one shows its "opens when" line, plus the first-time tip "Greyed sections" (see `den-locked`, Breeding selected).
   - There is no Map or Deeds rail item: Map is Wilderness and Deeds live in Lore (v0.1.4).
   - An unlock shows a **"New: {section}" toast** with the first-use tip, and a dot on the rail until the section is opened (see `den-later`).
5. **Primary action:** one gold button that is **always fixed bottom right**, at the same size and position on every screen: Choose today's action, Continue, Next, Travel here. Choice screens (dialogue choices, encounter moves) have none while choices show (v0.1.3 exception).
6. **Secondary content** sits behind **one drawer pattern**. These are pill buttons with ▸ on a bottom-left shelf ("About this place", "Earlier in this talk", "Round log", "Today's report"), plus dashed **More** expanders inside panels. Everything is closed by default.
7. **Type:** root size is 16px at 720 (21px at 1080). Body text is 16px or more, the smallest label is 12.8px, and map region names are 14.9px at 720 ("You are here" 13.4px), meeting v0.1.3a. Player-facing prose has no numbers, and counts show as pips.

## Spec mapping per screen

### 1. Home / Den: `den-day1`, `den-actions`, `den-more-actions`, `den-locked`, `den-later`, `den-later-actions`
**What moved where:**
- **Region facts:** the stat panel (Prey, Danger, Water, Unclaimed, two paragraphs) moved into the **About this place** drawer.
- **Action dock:** Hunt sizes, Rest, the six Travel destinations and the rest moved behind the primary **Choose today's action**.
- **Hotspots:** the "The Den" and "The Wilderness" scene hotspots were removed, since the rail covers both.
- **Version stamp:** removed.
- **Unavailable rows:** they are now greyed rail items.
- **Tutorial card:** it is now a single situation line.

**Spec rules met:**
- §4A: full-width scene and cat on the ledge, goal line, rail with locked sections greyed, primary "Choose today's action" that opens the §3 panel, quiet need bars that light up when Low, and an About this place drawer.
- Den (`den-later`): the same frame with a short row of member portraits plus **More**.
- §3.1: the panel shows the **action that suits the goal in the primary slot**, labelled "Suits your goal" (Hunt, for "Eat"), then 3 more: Rest, Travel, Watch. Everything else is under **More actions**.
- §3.1–3.3 (v0.1.5): day one (a lone cat) lists Scent sign first under More actions, then **Spar, Court and Found** as one-line rows reading name + "Locked" (dimmed, with a lock). Only the **focused** row (Court in `den-more-actions`) shows its opens-when line. There is no Drink and no Scout the border; neither is an action. Patrol and Mark never show for a loner. Ask to join is correctly absent: The Split Rock is unclaimed, and no leader has been met.
- `den-later-actions`: the pride holder's panel shows **Patrol, Mark, Rest**, with Hunt in the primary slot as the action that suits "Feed your pride, and hold your land." 
- §3.3: each action has a one-line description, and costs are words.
- §2: `den-later` shows Pride, Den and Breeding unlocked, the "New: Den" toast with `tip.place.den`, and the rail dot.
- `den-locked`: Breeding selected, showing "Opens when you take a mate." and the rewritten `tip.place.unavailable` ("Greyed sections").

**Not met / judgement calls:**
- When the action panel is open, the suggested action *becomes* the primary button. There is no separate "Go" button, which saves a click.
- The rail has **12 items**, which is more than the "5 before More" panel rule. I treated the rail as navigation, not a panel, because Anna asked for every section to show. At 720 it fills the full height. If one more section is added, it will need to scroll or be grouped.

### 2. Dialogue / event: `dialogue` (a beat), `dialogue-choices`
**What moved where:**
- **Scrolling log:** the Disco Elysium scrolling log is now **one paragraph per page**, and earlier lines sit in the **Earlier in this talk** drawer (the coloured log lives there).
- **Choice numbers:** the "1. 2. 3." numbers are gone, and choices are plain sentences.
- **Region panel:** removed from this screen.

**Spec rules met:**
- §4B: portrait on the left and a text card on the right with one paragraph per page and pager dots.
- **Continue** is the primary between beats.
- Up to 4 choices, shown as plain sentences.
- Bond and mood show as one word under the portrait: "Friendly" (v0.1.4).
- Tapping the portrait or "About this cat" opens the Smilodons entry.
- The voice colours are the approved ones (narrator `#D9C6A3`, NPC gold `#F8CC6E`, player `#A9D4E8`).

**Note:**
- The choice page has **no gold primary**; the three answers stack in the bottom-right slot as equal buttons. This is now the approved v0.1.3 exception.
- **Anna should confirm** that she is happy losing the always-visible scrolling log she approved earlier.

### 3. Encounter: `encounter`
**What moved where:**
- **Moves:** the six move buttons are now **3 moves + Run + More moves**.
- **HP numbers:** "74 / 100" is now a word ("Hurt") above the red bar.
- **Round log:** the numbered round log moved into the **Round log** drawer.
- **Telegraph and state:** the telegraph line is in bold, with a one-line state above it.
- **Region panel and [PH] labels:** gone.

**Spec rules met:**
- §4C: the threat's portrait and name (the player's full-body panel is kept, since both 4:3 panels were approved), a state line in words, your Health as a word plus a bar, the telegraph in bold, at most 3 moves plus Run, no numbers, and the round log in a closed drawer.
- The yield marker on the foe bar is kept.

**Note:**
- As with dialogue, the bottom-right slot holds the move group rather than one gold button (approved v0.1.3 exception).
- The rail stays visible during a fight because the frame never moves. Flint should block navigation mid-fight, but the mockup does not show a disabled rail.

### 4. Trait picker: `traits`
**What moved where:**
- **Season row:** the four season buttons moved off this page. A one-line summary "Standard Vale · Change" sits under the portrait.
- **Tab counts:** the counts are gone ("Body 22" is now "Body").
- **The list:** 22 cards in a scroller became **5 cards + More body traits**.
- **Pick count:** the strength/flaw count is now **pips**, with a **budget bar** that reads **"Room for more"**.
- **Chosen traits:** they sit in a bottom tray as chips.
- **Detail:** one detail strip shows the focused trait's flavour line.
- **Primary:** **Next**, bottom right.

**Spec rules met:**
- §4D: Body, Mind, Social and Lineage tabs; cards showing name, a one-line effect and "Opposite: …"; a taken mark; a "You have its opposite" mark.
- Tray with the chosen traits and the budget as a filled bar with words.
- **Suggest for me**.
- Next as the primary.
- Inherit-only traits are not listed.
- The appearance text is its own step ("Telling" in the step pills).

**Not met / open:**
- Moving the season choice off this page is my call and needs Tundra's OK.
- Only the Body tab is mocked.
- With 22 Body traits, "More body traits" opens a long list. Grouping it into strengths and flaws might be kinder.

### 5. Map: `map`
**What moved where:**
- **Region detail:** the left text column of the built map, and the old always-open region card, became a **region drawer** on the right: Prey, Danger, Water and Claimed by in words, plus "A day's travel".
- **Gossip and lore:** gossip moved behind **What cats are saying**, and lore behind **About this place**.
- **Primary:** **Travel here**.
- **Layers and legend:** the legend shrank to a one-line key for the Prides layer only. Human camp, hyena den and council markers are **off by default** under **Show: Prides ▸**.
- **Leaders' council chip:** removed from the map. It belongs in the Councils section or the Show menu once that unlocks.

**Spec rules met:**
- §4E: regions, your position, pride borders, the region drawer with the four facts in words, Travel here, and layers under one Show control with only Prides on.

**Not met:**
- The open Show menu is not mocked.
- Region names are 14.9px at 720 (Ochre's fix, `.map-label{font-size:20px}`, `.you-are-here-svg{font-size:18px}`), meeting the v0.1.3a 14px minimum. "You are here" is 13.4px.

## Copy (Saga ui-copy-v1, final) and what is still open
Every former placeholder now uses Saga's words, with no visible tag:
- Action one-liners: Hunt, Rest, Travel, Watch from a vantage, Scent sign, Patrol, Mark. Costs: "Costs: the day" and "Costs: the day, or more".
- Opens-when lines: Spar, Court, Found (actions); Breeding (section).
- Rewritten `tip.place.unavailable`, titled "Greyed sections". The toast is `New: {section}`, here "New: Den" with `tip.place.den`.
- Den situation line: "Your pride is resting in the shade of The Split Rock."
- Bond/mood word "Friendly".
- Encounter: health word "Hurt" and state line "Sleetbark is circling. You're winded." (Saga's `{foe} is circling. You're winded.`, v0.1.5 uses the name).
- Court and Found one-liners ("Win over a Bonded cat.", "Start your pride here.") are the **open-action** lines (`action.court.line`, `action.found.line`). No mockup shows Court or Found open, so they don't appear; the locked rows keep the unchanged `action.*.opensWhen` lines.
- Map: Prey "Good" and Water "River".
- Creator: "Standard Vale".
- The coined UI labels (Today's action, Suits your goal, More actions, Your answer, Earlier in this talk, Round log, More moves, More body traits, Opposite:, Taken, You have its opposite, Show: Prides, What cats are saying, Today's report) are all confirmed in Saga's section C.

Other copy sources:
- Goal lines and urgent lines, Got it / Turn off tips: `tutorial/tips-copy-v2.json`
- Trait names, hints and flavour: `traits-copy-v1.json`
- The fight tell: `encounter-narration-v1.json`, `tells.pounce`
- Danger "Dangerous": `map-danger-gossip-v1.json`
- Greywater Ford arrival, first sentence: `region-arrivals-v1.json`
- The Sleetbark scene and the creator step line come from the earlier approved mockup. The Sleetbark scene was Anna's example, so Saga still owns its final words.

**Still open:**
1. **Day label (settled in v0.1.5):** every top bar reads "{Season} · Day {n}", plus "· Mating season" because spring days 1–20 are the mating window (milestone-2 §3.1): "Spring · Day 1 · Mating season" on day one, "Spring · Day 2 · Mating season" on dialogue, encounter and map, and "Spring · Day 14 · Mating season" on the later-run den. At 720 the label clears the need bars with room to spare.
2. **Mood word (Tundra):** "Friendly" is used per v0.1.4. There is still no approved mood list separate from the bond bands, so the portrait shows a single word.
3. **Section unlock lines (for Saga to confirm):** Saga's updated Pride line, "Opens when you catch a border scent, meet a patrol, join a pride or Found one.", matches v0.1.4 §2 (any of the four triggers). The Inventory ("Opens when you gain an item.") and Market ("Opens when you get a trade offer.") lines also match v0.1.4, so nothing conflicts. Saga's own note says `unlocks.js` at `3afe9da` only checks border scent for Pride, which is for Flint.
4. **Ask to join (settled in v0.1.5):** it shows for loners on a pride's held land once that pride's leader is met, so the day-one den at unclaimed The Split Rock correctly doesn't show it. No mockup shows it yet.
5. **Encounter state line (settled in v0.1.5):** it now uses the name, "Sleetbark is circling. You're winded."

## Check done before reporting (720 zoom)
- `audit.txt` covers all 11 pages at both sizes:
  - The smallest HTML text is **12.8px** at 720 (kickers and rail labels). Body text is 16px.
  - **No clipped or offscreen text** on any page after the copy swap.
  - The primary or choice group always ends at the same bottom-right corner: 1262,702 at 720 and 1897,1057 at 1080.
- The 2× crops in `crops/*-v2.png and *-v5.png` were checked by eye for the longer copy:
  - Action panels: one-liners now run full width with the cost on the name row, so every main row is one line.
  - More actions (v0.1.5): every row is one line, including Spar, Court and Found as name + Locked. Only the focused Court row shows its opens-when line, which is two sentences and wraps to two lines inside that row. The panel doesn't scroll at 720.
  - The greyed-section popover, the encounter state line and the trait tray fit with no overlaps.
  - Map region names at 14.9px fit their regions, but "The Frost Tongue" and "The Drowned Mere" run close to region edges.

## Open flaws (honest)
1. **BEFORE shots are partly synthetic.**
   - The built dialogue screen was reached by injecting a debug event ("A mixed line"), so it is a stub, not a real scene.
   - The encounter before shot shows the spar layout with `[PH]` move labels and the foe named "Hyena" over cat art. That comes from the repo's own shot hook (`scripts/ui-groups-shot.js:81-82`), which I copied; see ENCOUNTER-ART-AUDIT.md.
   - The map before shot has no region selected, because the click hook missed.
   - Day 6 home looked the same as day 1, so `before/home-day1` is the home before shot.
   - No "Den later" before shot exists, because the build has no founded-pride state reachable without a long play.
2. **Focused opens-when line:** Court's line wraps to two lines when Court is focused. Nothing else wraps, and the panel doesn't scroll at 720. A single-line version would need a shorter Saga line.
3. **1080 is the 720 composition scaled up** (rem-based). It is tidy, but it shows no extra content at 1080.
4. **Rail:** 12 items fill the 720 height, with no room for a 13th.
5. **Den-later and den-later-actions are illustrative.** The pride name "Ash pride", the members (Galestride is a Highcrag cat) and Little Reed (a cub stand-in still) are not real data.
6. The rail shows no disabled state during a fight. Flint should block navigation mid-fight; the mockup doesn't show it.
7. Not mocked: the open Show menu, the Mind/Social/Lineage tabs, the open drawers (About this place, Earlier in this talk, Round log) and the open More moves.
8. **Fixed (Anna review): art framing and pairing.** See the new section "Cat art, headshots and pairing".

## Cat art, headshots and pairing (Anna review, after "Looks pretty good")
- **No mid-body crops.** Every cat is either the whole 4:3 still (ears, sabers, all four paws, bobtail, with padding inside the frame) or the canonical head-and-shoulders crop (HEADSHOT-CROPS.md).
  - **Den ledge cat.** The old `player-cat.png` was a broken cut-out, front half only. It is replaced by the whole still `cat-6e2d788dd48ff440.png` (byte copy, `assets/player-ledge.png`), placed with the game's own box (`HomeScene.catBox`, `home-scene.js:51-60`: x 25–55%, paws at 68%).
  - **Den panels.** The situation card moved to the right, over empty valley. The Breeding opens-when pop narrowed to 15rem, which leaves a ≥20px gap to the tail at 720. Toast and action sheet don't touch the cat.
  - **Encounter and creator.** Panels pad the still 4–5% inside the frame. The foe is mirrored by CSS to face the player, as the game does.
- **Correct pairing (seed-8 run of ac2665d).**
  - Sleetbark = `hc07` → `cat-7c5ab14d9e51320a`. It was eec858, which belongs to Briarlight/Alderstep/Swiftbark.
  - Galestride = `bf01` → `cat-e67924de1f224fd0`.
  - Summercloud = `mw04` → `cat-f70f52f0f22da7fc`.
  - The player stays on `cat-6e2d788dd48ff440`.
  - Full table: ENCOUNTER-ART-AUDIT.md.
- **Headshots are all crops.** ac2665d has no separate headshot asset files; the game's "head" frame is a runtime crop of the full still (`portrait-view.js:171-186`, registry `staticHead`). Every speaker/member/avatar head here is the canonical crop of the cat's approved still:
  - Sleetbark (dialogue, dialogue-choices) `portraits/sleetbark-head.png`
  - Galestride, Summercloud (den-later members)
  - Little Reed (adult still `cat-4a74e453bae483ad` standing in for a cub; no cub art exists)
  - the player avatar `assets/player-headshot.png`
  - Head frames are rounded squares now, not circles, so no ear is clipped.
- **Still not perfectly clean.** On 26 of the 40 stills (Sleetbark's, Summercloud's and the player's included) the nose tip touches the canvas edge in the source art. This shows at the right edge of the headshots, and at the edge of the still inside the padded encounter/creator frames. It can't be fixed by cropping; it needs re-exported art with a margin.
