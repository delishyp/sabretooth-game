# UX redesign v0.2: "A big scene with simple, clear panels" (DRAFT for Anna's sign-off)
Owner: Tundra (layout and flow). Styling: Ochre. Copy: Saga. Status: PROPOSED DEFAULT unless a rule is tagged otherwise.
Supersedes the layout parts of ux-simplification-v0.1.md (v0.1.5). Its rules stay unless they're changed here: one gold primary, greyed locked sections that stay selectable with an opens-when line (ANNA-APPROVED), quiet need bars (ANNA-APPROVED), and word bands instead of numbers.
Sources: Anna's direction (Director, 2026-11-18), /workspace/qa/full-review-0.1.8/NOTES.md (Tracker P1/P2, Saga copy, Tundra notes), and tutorial §3a.

## 1. Structure
1.1 **Scene layer.** Region art fills the whole window at every size (cover-scaled around a focal point, never letterboxed, and no menu art showing). The player cat stands on a ground line in the lower third, drawn from the same portrait source as the creator, so the cat looks the same everywhere (fixes the three-cats P1). No new art.
1.2 **Safe area.** A centred 16:9 box sized to the window height holds every panel. On ultrawide the scene extends past it to the window edges, and panels anchor to the safe-area edges, not the window edges, so text never sits 3440px apart.
1.3 **Panels.** At most 3 visible at once: the top strip, one context panel, and one action area. They're solid and high-contrast (Ochre styles them). Nothing translucent sits behind text.
1.4 **Text size** at 1080 height: body 20px, labels 18px, headings 30px, scaling with window height. Floor at 720: body 16px, labels 15px. Map labels are at least 14px at 720 (APPROVED).
1.5 **One mode at a time.** The game is always in exactly one mode, and every panel belongs to one mode and closes when the mode changes. Nothing sticks across screens (fixes the stuck Today's action, Travel tip, day report and opens-when chips).
| Mode | What's on screen | Primary |
|---|---|---|
| Home | scene, top strip, rail, place card | Choose today's action |
| Choosing | Home plus the action panel instead of the primary | none; clicking a card is the choice |
| Scene (encounter or dialogue) | scene, top strip, bottom story panel; rail locked | none while choices show; Continue between beats |
| Book (any nav section) | dimmed scene, top strip, rail, full-height section panel | none; Close (X or Esc) goes back to Home |
| Day's end | dimmed scene, centred report card | Continue |
| Setup (New Game, creator) | menu scene, one centred panel | Next / Start |

## 2. Fixed parts
2.1 **Top strip** (full safe-area width, one row):
- Left: the cat's name, then the pride name only once one is founded. Loners show "Loner" (no more "Nameless pride").
- Centre: "{Season} · Day {n}", with "· Mating season" added during the window.
- Right: the four need bars (Health, Thirst, Hunger, Energy), each at least 140px wide at 1080 with a visible fill, the word band shown on hover or focus, and the Menu icon.
- "About this place" and Guide move out of the top strip: place facts go in the place card, and Guide lives in Lore.
2.2 **Goal line:** one centred line just under the top strip, always shown (ANNA-APPROVED, tutorial §4). The urgent line replaces it when a need is low.
2.3 **Rail** (left edge of the safe area): icon plus label, collapsing to icons below 1280 width.
- Locked sections are greyed and still selectable. Focus shows the opens-when line beside the item, and selecting one does not navigate and leaves no chip.
- Locked items sit below the unlocked ones after a thin divider, in unlock order, all greyed and visible (ANNA-APPROVED; Director reconfirmed 2026-11-22). They aren't hidden and there's no "More" in the rail.
- During Scene mode every item is locked with "Finish this first". Save and Settings stay usable as overlays (Tundra ruling, NOTES 1).
2.4 **Toasts:** Save shows "Saved" for about 2 seconds, top centre. Toasts never stack and never persist.
2.5 **Tips** anchor to their target with a dim, a ring and an arrow (tutorial §3a). They close on mode change and never follow the player.

## 3. Screens (wireframes at 1080; ultrawide is the same box with more scene at the sides)
### 3.1 Home
```
[Name · Loner]        [Spring · Day 3 · Mating season]      [Health▮▮▮][Thirst▮▮][Hunger▮▮▮][Energy▮▮] ≡
                         Goal: Meet the cats of the prides and the loners.
 Rail                                  (scene, cat on ground line)
 ◉ Home
 ○ Wilderness     ┌ Twin Forks ─────────────┐
 ○ Smilodons      │ Prey: Plenty  Danger: Low│                            ┌────────────────────────┐
 ○ Lore           │ Water: Yes   Claimed: —  │                            │  Choose today's action │  ← gold
 ◌ Pride (locked) └──────────────────────────┘                            └────────────────────────┘
```
### 3.2 Today's action (Choosing)
- The panel rises from the bottom right of the safe area, at most 40% of its width, and stays inside it.
- The cards are one column of identical cards, each with the action name in large text and one line under it. The suggested card goes on top with a small "Suits your goal" tag (only one per day).
- At most 5 cards, then "More actions", which expands inside the panel (it scrolls internally and never overlaps). Locked actions show the name plus "Locked", with the opens-when line on focus.
- Clicking a card does the action. Esc, clicking the scene or any rail item closes the panel.
### 3.3 Encounter (Scene)
- The scene shows region art, with the player cat on the left and the foe on the right of the ground line, both whole-body (Anna's rule: no mid-body crops, and every foe gets its own art).
- The bottom story panel spans the full safe-area width and up to 38% of its height. It holds the title (foe name), 2–4 lines of narration, the state line ("{name} is circling. You're winded.") and up to 4 large choice buttons in a 2×2 grid.
- No numbers in the prose: odds are words ("You could drive it off", "This is a bad fight"; Saga writes them). Leftover reports and chips are cleared on entry.
- **Odds words (Saga's redesign-copy-v0.2).** Map from the player's win chance in the forecast, where the engine gives one:
  - odds.easy at 80% or more
  - odds.good at 60–79%
  - odds.even at 40–59%
  - odds.bad at 20–39%
  - odds.hopeless below 20%

  For tier-only contests (the hyena drive): clean is easy, partial is good, a fail with no injury is bad, and a fail with injury is hopeless. The cutoffs are candidates, sim pending. Tracker checks the spread across Gentle to Ice Age in the gate.
### 3.4 Dialogue (Scene)
- The bottom story panel holds the speaker's headshot on its left (headshots only, ANNA-APPROVED rule), the name plus their regard as one word (Wary, Friendly, Bonded…; no −100 to 100 scale), the line, then up to 4 choices in a 2×2 grid, the same as encounters, clear of the rail. Leave is always the last choice.
- The scene behind it shows that region, with no full-body speaker art.
### 3.5 Day's end
- A centred card: "Day {n}", 3–5 short lines of what happened, overnight need changes as words, and a Continue primary. It's dismissed for good on Continue and never reappears after a load.
### 3.6 New Game (Setup)
- One centred panel (about 60% of the safe-area width) with three stacked groups. Each group is radio cards with the full text (wrap, never cut off), and the selected card gets a check mark plus a bright border.
- Groups, in order, matching the game (nav.js): **Difficulty** (Gentle, Standard, Harsh, Ice Age), **Play style** (Story, Balanced, Sim; "Balanced" is a display rename of the `standard` style, id unchanged, APPROVED by Director 2026-11-22), **When your cat dies** (Permadeath selectable; Heir and Sandbox greyed with "Not yet available"), and a **Tutorial** on/off toggle.
- Season start is not a choice, because every run starts in spring.
- The primary is Next. The line about these being fixed for the run sits under the group header.
### 3.7 Creator (Setup)
The Appearance step merges into Look, which removes the blank step. The steps are:
1. **Look and name:** picture choice (player-facing names, never "brown-brown"), coat and build words (Lean, etc.) with a selected state and the line "Changes how the story describes your cat", and the name field.
2. **Personality:** sliders with word ends (Calm / Fierce), no numbers.
3. **Traits:** two columns, Strengths and Flaws. Slot counters are labelled "Strengths 1 of 3" and "Flaws 0 of 3", with no unlabelled dots and no tab counts. A disabled trait says why on focus ("Clashes with Runt", "Your Strengths are full"). Picking traits is optional, and the footer says so.
4. **Review:** a big portrait, a summary of everything, and the primary Start.
Layout: the left 40% holds the large portrait (the same art the game uses), the right 60% holds the step content, the stepper sits on top, and Back / Next are bottom right. Stray lines are removed (the rerolls line, "Room for more", arrow hints).
### 3.8 Lore (Book; the same frame for every nav section)
- A full-height panel across about 70% of the safe area, over the scene dimmed by half. The list of entries is on the left and the open entry on the right, in large readable text. Close is top right.
- Entries fill every token (no "{name}"). Locked entries are listed as "Not yet learned".
- Every other section (Wilderness map, Smilodons, Deeds…) uses this same frame. Empty states say what will appear and how ("Cats you meet will appear here.").

## 4. Responsive checks (for Tracker's gate)
- At 720, 1080, 1440, 2560×1080, 3440×1440 and 2560×1440, and at 100–150% scaling: the scene fills the window, nothing overlaps or clips, text sizes stay within the §1.4 floors, the need bars visibly fill, and each mode has exactly one clear next action.
- A known risk for Ochre: the story panel at 720 plus 150% scaling needs 4 choices to fit without scrolling. If they don't fit, stack the choices one per row and let the narration scroll.

## 5. NOTES.md coverage
Every P1 is covered: overlays (§1.5, §2.3), invisible bars (§2.1), three cats (§1.1), the blank Appearance step (§3.7), the unreadable suggested action (§3.2), the stuck action panel (§1.5), the spotlight (§2.5) and {name} (§3.8). The P2s are covered by §2.1 (Nameless pride), §2.3 (locked chips), §2.4 (Save feedback), §3.3 (numbers in odds), §3.4 (regard scale), §3.5 (stale reports), §3.6 (cut-off text), §3.7 (traits, personality numbers) and §3.8 (empty states). Load list: rows show portrait, cat and pride name and "Last played" as a date only; empty slots say "New story".

## Changelog
- v0.2h (2026-11-22): Hunt fix (APPROVED, Tundra): one hunt chance function (the engine's, encounter-engine.js) used by both live and headless hunts; then apply the trait huntBand as a band shift (Keen Nose one band easier, Dull Nose one band harder) to both the odds word and the result tier. No cutoff or chance numbers change. Easy is then reachable via Keen Nose; Tracker re-sims after the rebuild.
- v0.2g (2026-11-22): Hunt odds cutoffs unchanged (candidate, sim pending). "This should be an easy catch." stays and shows only when the hunt chance reaches the easy band; Tracker sims a best-case hunter to see if it is reachable. Live and headless hunts must share one chance function (Tracker saw hopeless only in the live hunt).
- v0.2f (2026-11-22): Play style "Standard" displays as "Balanced" (id stays `standard`) so the New Game summary line never says Standard twice.
- v0.2e (2026-11-22): dialogue choices go in a 2×2 grid.
- v0.2d (2026-11-22): FINAL for mockups. Play style restored (it's a live choice in the game); all locked rail items greyed per Director's reversal.
- v0.2c (2026-11-22): Director calls. Play-style group dropped; rail shows only the next locked section.
- v0.2b (2026-11-22): §3.6 New Game groups match the game; §2.3 locked rail items go below a divider.
- v0.2a (2026-11-22): §3.3 odds-word mapping.
- v0.2 (2026-11-22): first draft from Anna's direction plus the full review.
