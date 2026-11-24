# Sabretooth UI redesign mockups v0.2 (Ochre) — for Anna's sign-off, not built

Direction (Anna): "A mix: a big scene with simple, clear panels." Layout source: Tundra's `ux-redesign-v0.2.md` (87842d5, re-checked at v0.2d 65bbc8e: odds mapping, all-greyed locked rail; LAYOUT.md here is the same text). Copy: Saga's COPY.md / `redesign-copy-v0.2.md`, `ui-copy-v1.json`, and shipped game copy at ef443e5 (menu-copy, lore-book-copy-v2, traits-copy-v1, deeds-copy-v1, encounter-narration-v1, quest-lines-v1, tips-copy-v2). No new art; no game source touched.

- Screens: `01-home … 09-lore.html` (one HTML each, built by `build.py` from `src/style.src.css`). Style kit: `style.css`, `STYLE.md`.
- Renders: `renders/1080/NN-*.png` (1920×1080) and `renders/ultrawide/NN-*.png` (3440×1440). Contact sheets: `contact-1080.jpg`, `contact-ultrawide.jpg`.
- Re-run: `python3 build.py && ./render.sh && python3 check.py` (headless /usr/bin/google-chrome only, nothing installed).
- Gate: `check.py` → `check-report.json`. 18/18 renders PASS (rev 5, 9 screens × 2 sizes): no element overflow, no text outside its panel or the window, no overlapping panels, every panel inside the 16:9 safe area, no tooltip over another panel, no `{`/`}` in visible text, no text under 18px-at-1080, no text sitting straight on scene art, and WCAG AA contrast on every text run (lowest 6.97:1).

## Screens
| # | Screen | Mode (spec §1.5) | One next action |
|---|---|---|---|
| 01 | Home; every locked section greyed below a divider, Pride (next to open) focused with its opens-when line | Home | gold "Choose today's action" |
| 02 | Today's action, More actions open, Spar focused | Choosing | click a card |
| 03 | Encounter: giant deer hunt (nav locked, Lore focused). Odds: "It could go either way." (Saga hunt odds, even band) | Scene | 2×2 moves |
| 04 | Encounter: cave hyena drive. Odds: "You could drive it off." | Scene | 2×2 moves |
| 05 | Dialogue: both cats as equal 200px headshots (speaker left, player right), 2×2 choices, just after Save | Scene | 3 answers + Leave |
| 06 | New Game (v0.2d): Difficulty, Play Style, When Your Cat Dies, Tutorial | Setup | gold Next |
| 07 | Creator step 1: Look (appearance merged in; picture row tagged "Stand-in art") | Setup | gold Next |
| 08 | Creator step 3: Strengths and flaws | Setup | gold Next |
| 09 | Lore Book (Book frame for every nav section) | Book | Close / pick an entry |

## Rev 5 (Nov 22, 17:20 IST)
- **New Game:** the Play Style option "Standard" is renamed "Balanced". This is a display change only, per Director.
- **New Game sub-line:** "You picked Standard difficulty, the Balanced play style and Permadeath. You can't change any of them once the story starts."
- **Dialogue:** the 4th choice is now Saga's "“Your leg comes first. Let me see it.”"
- **Gate:** 18/18 PASS, with zero `[Saga:]` placeholders.

## Rev 4 (Nov 22, 17:15 IST)
- **New Game** follows Tundra's final v0.2d (65bbc8e), top to bottom:
  - Difficulty: Gentle, Standard, Harsh, Ice Age.
  - Play Style: Story, Standard (selected), Sim, with the game's own one-liners from ef443e5 menu-copy.
  - When Your Cat Dies: Permadeath selectable; Heir and Sandbox greyed with Saga's line.
  - Tutorial toggle, with Back and Next on the same row.
  - The panel is wider (1500px at 1080) so that no card text is cut off at either size.
- **New Game sub-line** is Saga's, filled in: "You picked Standard, Standard and Permadeath. You can't change any of them once the story starts." It's flagged because "Standard, Standard" reads badly.
- **Hunt odds** use Saga's hunt set, even band: "It could go either way." (the set runs from "This should be an easy catch." to "You won't catch this one.").
- **Dialogue** shows four choices in a 2×2 grid, at 22px:
  - The two quest lines from the game.
  - A placeholder, `[Saga: 4th choice]`, because neither the game nor Saga's copy has a fitting fourth line for this quest step.
  - "Leave", always last.
  - Both headshots stay at 200px.
  - The gap between the nav and the panel is 48px at 1080 and 62px at ultrawide.
- **Gate:** 18/18 PASS. The only `[Saga:]` placeholder is "4th choice".

## Rev 3 (Nov 22, 17:10 IST)
- **Nav (Director reversed):** on every screen, all locked sections are greyed and visible below a thin divider, each marked "Locked", in Tundra's sample first-run order: Pride, Reputation, Inventory, Breeding, Den, Quests, Market, Councils. Rows were tightened from 52 to 40px at 1080, with text kept at 20px. The 01b variant is removed.
- **Nav clears the story panel** (rail bottom vs panel top, px): hunt 658/733 at 1080 and 898/997 at ultrawide; fight 658/758 and 898/1031; dialogue 658/706 and 898/960.
- **Dialogue:** the player headshot is now 200px, the same as the speaker, on the right of the panel with the name under it. The choices are one column (one line each) between the two headshots.
- **Hunt odds:** Saga added hunt-specific words (COPY.md "Revisions"). The hunt uses the even band, "It could go either way."
- **New Game sub-line:** uses Saga's revision, "You picked Standard and Permadeath. You can't change either once the story starts." New Game stays at v0.2c (no Play style), as Tundra confirmed via Director.

## Rev 2 (Director's calls, Nov 22)
- **Dialogue:** no full-body cat in the scene. The speaker headshot is on the left, and the player headshot (`player-headshot.png`) sits beside "Your answer" above the choices.
- **Odds:** a gold "Odds" pill with Saga's words, mapped per Tundra §3.3 (4d03c63).
  - Hunt: sample forecast 40–59% gives odds.even.
  - Hyena drive (tier-only): sample tier "partial" gives odds.good.
  - Both use the existing giant-deer and cave-hyena encounter art.
- **Nav:** (superseded in rev 3) only the next locked section showed; 01b showed the all-visible variant.
- **New Game:** follows v0.2c (bbc43f0): Difficulty, When Your Cat Dies, Tutorial. Play Style is dropped and there is no season start. Heir and Sandbox are greyed with "Locked" plus Saga's line.
- **Creator:** step 4 is "Ready". The picture row is tagged "Stand-in art" and named Dark / Tawny / Pale.
- **Copy:** all 4 earlier `[Saga:]` gaps are filled from COPY.md, and no placeholders remain.

## NOTES.md problem → where it's fixed
| NOTES.md problem | Fix | Shown in |
|---|---|---|
| P1 Encounter/dialogue paint over nav pages | Scene mode locks every nav item, and focus shows "Finish this first." | 03 (Lore focused), 04, 05 |
| P1 One clear next action | Each screen has exactly one gold primary, or visible choices | all |
| P1 Need bars invisible | 150px bars with a solid fill in a dark trough | top strip |
| P1 Player cat is three different cats | One full-body source (creator, Home, hunt, fight) and its matching headshot (dialogue) | 01–05, 07, 08 |
| P1 Appearance is a blank step | Merged into Look: Sex / Coat / Build chips with a selected state, plus "Changes how the story describes your cat." | 07 |
| P1 Suggested action is an unreadable widget | Normal card with a small "Suits your goal" tag | 02 |
| P1 Today's action stays over other pages | The panel exists only in Choosing mode | 02 vs 09 |
| P1 Tips leak across screens | Nothing sticky on any screen (the anchored tip itself isn't mocked) | all |
| P1 `{name}` in Lore | Token filled; check.py fails on any `{` | 09 |
| P2 Disabled explains why | Greyed + "Locked" + opens-when / clash / why line | 01, 02, 06, 08 |
| P2 Choice feedback | Check mark + bright border on every selection | 06, 07, 08 |
| P2 New Game cards truncated | Full text wraps | 06 |
| P3 Only Permadeath shown | All three death rules shown; Heir and Sandbox greyed with the reason | 06 |
| P2 Creator "brown-brown" / stray lines / season chips | Picture names are player-facing; stray lines removed | 07 |
| P2 Personality raw 50s | Not mocked (step 2) | — |
| P2 Traits grid, tab counts, dots | Strengths/Flaws columns, plain tabs, "1 of 3" labels, clash reason, optional footer | 08 |
| P2 "Nameless pride" | Shows "Loner" | top strip |
| P2 Fight unreadable, stale DAY report | Whole-body player and foe only; no stale report | 04 |
| P2 Numbers in fight prose | Odds as words in a pill | 03, 04 |
| Leftover opens-when chips in a hunt | No chips anywhere | 03 |
| P2 Relationship meter −100..100 | One regard word ("Friendly") | 05 |
| P2 Save gives no feedback | "✓ Game saved." toast | 05 |
| P2 Locked sections look real then go nowhere | All locked sections greyed below a divider, marked "Locked"; focus shows the why beside the item; no navigation, no chip | 01, all |
| P2 Sections crowded by the action panel and tip | Book frame with nothing else on screen | 09 |
| Saga 2 leftover helper lines; Saga 6 numbers in prose | None present; numbers only in labels | all |

## Copy gaps still open
- "Tawny, spotted" isn't used: none of the existing stills reads as a spotted tawny cat. Flint still owes Saga the real picture list.
- New Game sub-line and dialogue 4th choice: resolved in rev 5.
- Labels taken from Tundra's spec rather than Saga's file: "Difficulty" (group heading), "Odds" (pill label), and "Strengths 1 of 3" / "Flaws 0 of 3".

## Honest flaws / open questions
1. **Ultrawide backgrounds are soft.** Scene art is 1280×720 to 1774×887, upscaled by the browser at 3440×1440. Left as is, per Director.
2. **New Game** now matches v0.2d (Play Style restored). Resolved.
3. **Unlock order** is Tundra's sample first-run order. Deeds is shown as open, matching Tracker's 0.1.8 run.
4. **The picture row is stand-in art:** the player art plus two NPC stills, now tagged as such.
5. **The odds values are samples.** Real values come from the engine forecast. The hunt now uses Saga's hunt words.
6. **Dialogue** at 1080 is the tightest screen. The nav clears it by 48px. The choice cells are about 300px wide, so the quoted answers wrap to two lines at 22px. A longer fourth line would wrap to three lines and push the panel up toward the nav.
7. **Not mocked:**
   - Personality and Ready steps
   - Day's end card
   - Load list
   - Anchored tutorial tip
   - 720 / 150% scaling
8. **Smaller issues:**
   - Story panels are sparse when narration is short.
   - Tabs reuse the chip style.
   - Speaker and leader names are sample fills.
