
## Design notes (Tundra, 2026-11-18)
Priority: P1 = fix in 0.1.9 or next small release · P2 = quick QoL · P3 = proposal for Anna (not a build).

1. **P1: Encounter/dialogue lock (ruling for the overlay bug).** While an encounter or dialogue is active, the nav sections are disabled, not hidden-and-restored. A disabled section shows "Finish this first" on focus. Save stays available, Settings is allowed as a modal on top, and the goal line stays visible. This is simpler and safer for saves than suspending a scene.
2. **P1: One clear next action.** Every screen state must have a gold primary or visible choices (ux-simplification §1). Tracker's list should flag any state with neither as a design fail, not polish.
3. **P2: Disabled always explains why.** This applies everywhere, not just traits: locked Places sections, locked actions, and the nav during scenes. The rule: greyed-out plus an "opens when" or "why" line on focus. No silent dead buttons.
4. **P2: Choice feedback.** Any choice that only changes flavour (Lean, build, coat descriptors) shows a selected state plus a one-line "changes how the story describes you". This matches Director's appearance-step ask, as a general rule.
5. **P2: Suggested action is a tag, not a different widget.** "Suits your goal" is a small tag on a normal action card, on the same card layout as the rest (matches Director's 0.1.9 ask). Only one action gets the tag per day.
6. **P2: Tutorial spotlight follows the targets in tutorial §3a (8bbc00c).** A missing target falls back to a centred tip.
7. **P3: Top-bar time wording.** "{Season} · Day {n}" stays for now. Saga's season-phase words ("Early spring") are a candidate if Anna wants fewer numbers, so ask her.
8. **P3: Still owed from design, needing sim before numbers change:** prey, hunger and rep-loss multipliers; trait inheritance 0.25; join ≥75; Keen Nose and Alluring; Quick Hackles +15; litter and lifespan steps. None of these block 0.1.9.

## Copy (Saga)

Source: `/workspace/qa/full-review-0.1.8/saga-copy-notes.md` (included verbatim below).

# Saga copy notes for the full review (v0.1.8)

Copy source: /workspace/saga-narrative-voice/ui/ui-copy-v1.json (follows UX v0.1.5, 66eaeb7). Tutorial copy: tutorial/tips-copy-v2.json.

1. **Lore placeholders (high).** "{name} leads Bonefield Pride" ships unfilled. Every Lore fact line needs its tokens filled from the save, or the line hidden until it's known. I'll rewrite any Lore line that can't be filled into a version without the token.
2. **Leftover helper lines (high).** "Rerolls personality only. Your look and name stay." and "Room for more" confused Anna. Remove them, or put the reroll note only on a real reroll button: "Reroll personality. Your look and name stay the same."
3. **Greyed sections and actions (medium).** The opens-when lines, the "New: {section}" toast, the "Locked" label and tip.place.unavailable are written in ui-copy-v1. Check that the build uses them and not code fallbacks.
4. **Appearance step (medium).** Each look choice needs a one-line note. Suggested: "This changes how the story describes you. Your portrait stays the same."
5. **Trait names (low).** Sickly Line now shows as Frail Blood. Den Mother shows as Den Father on males. Check that event and Lore text uses the same display names.
6. **Numbers in prose (ongoing).** Only labels may carry numbers, like the top bar "{Season} · Day {n}". Story, tips and Lore text stay number-free.

## QA (Tracker)

Full playthrough of v0.1.8 (`ef443e5`), 2026-11-18, Asia/Jerusalem (IST). Read-only. Worktree: `/workspace/qa/combined-b9e81056/src-ef443e5`. Shots: `/workspace/qa/full-review-0.1.8/shots/{1080,720}/`.

Coverage: one 1080 playthrough plus one 720 shot of every screen listed below (New Game, creator steps, tutorial, Home, Today's action, every nav section, hunt, fight, dialogue, save / Continue / load). Wide-screen and 150% checks skipped (usage cap). Credits and the install-update wizard were not in this run.

This is a redesign problem list: what goes wrong and why it confuses the player, not a patch queue. Anna-flagged issues already planned for 0.1.9 are included briefly, because they still describe what the current UI gets wrong. Copy already written under ## Copy (Saga) is cross-referenced, not repeated.

### New Game

- **P2 — Card text is cut off, so the player cannot actually compare the choices.** The Play Style and Season cards end in ellipses ("Survival and story in balance. Spend your…", "The ice has stepped back, and the herds ar…", "The ice comes south, and only the hard…"). On a screen that is supposed to explain how hard the run will be, the explanations are unreadable. Anna already flagged this. Shot: `shots/1080/newgame-setup.png`.
- **P3 — "When Your Cat Dies" only shows Permadeath.** A line says style and death rule "are locked for the whole run," but Heir and Sandbox never appear, so the player cannot tell whether other ways to play exist or have already been denied to them. Shot: `shots/1080/newgame-setup.png`.

### Creator

The player is trying to make *their* cat. Across these steps the left thumbnail (a dark standing sabretooth) and the large right-hand portrait (a pale lying one) never look like the same animal, and the picture row is labelled **"brown-brown"** — an internal name, not something a player would choose. "Entire cat" sits under the thumbnail with no explanation. Season chips from New Game stay on every step, so it is unclear whether the season can still be changed. Shots: `shots/1080/creator-look.png`, `creator-personality.png`.

- **P2 — Look / Name.** Name lives on this step and is fine, but "One of the supplied pictures. Coat and eyes do not choose it" tells the player their coat choices will not show on the cat they are staring at. That already breaks the promise of "this one is yours." Shot: `shots/1080/creator-look.png`.
- **P2 — Personality.** Every slider shows a raw **50**, with no sense of what the scale means. The footer says "Drag a slider or pick a preset, then **Start**," but the button on this step is **Next**, so the player looks for a control that is not there. The leftover "Rerolls personality only. Your look and name stay." line is already in ## Copy (Saga). Shot: `shots/1080/creator-personality.png`.
- **P2 — Traits.** Strengths and flaws are mixed in one grid, so Giant and Runt sit side by side with no sense of which kind of trait they are. Tabs read "Body 22", "Social 9" and so on — counts with no unit, so they look like points to spend. Unlabelled dots sit above the tabs. "This touches how you look." hangs over the list with no trait selected. "More body traits" is styled like a trait card. The step still shows the personality reroll line and "Click the arrows to change a row, then Next," even though there are no arrows and no Randomize button. Nothing says whether picking traits is required. Anna already flagged the picker; display names (Den Mother / Den Father, Sickly Line) are in ## Copy (Saga). Shot: `shots/1080/creator-traits.png`.
- **P1 — Appearance is a blank step.** The last step before Start is an empty gold-outlined box, the line "Room for more," and leftover hints about rerolls and arrows. Look choices such as Lean are not visible, and clicking Lean changes nothing on the screen, so the player cannot tell the click registered. A whole step exists whose only obvious action is to leave it. Anna already flagged Lean, the unlabelled box and stray lines; the "Room for more" / reroll copy is in ## Copy (Saga). Shots: `shots/1080/creator-appearance.png`, `creator-appearance-lean.png`.

### Tutorial

- **P1 — The tip talks about "your needs" but never shows the player where those needs are.** The first card, "Arrival and your needs," sits in the lower centre of the scene. There is no dim, no ring, and no arrow. The need bars it is trying to teach are tiny unfilled labels in the top bar, so the player is told to look at something they cannot find. Later, a **Travel** tip behaves the same way and, until it is dismissed, follows the player onto Lore, the Map, Deeds, and even after Continue. The lesson becomes a sticker on the wrong screen. Anna already flagged the missing spotlight. Shots: `shots/1080/tutorial-first.png`, `nav-lore.png`, `continue-loaded.png`.

### Home

- **P1 — Need bars are invisible even at 1080.** The top bar lists Health, Hunger, Thirst and Energy as small words with no readable fill. The player cannot tell how close they are to thirst, hunger or exhaustion, which is the first thing the tutorial and the goal line ask them to manage. Anna flagged empty bars on wide layouts; they are already empty on a normal 1080 screen. Shot: `shots/1080/home-day1-after-tips.png`.
- **P1 — The cat on Home is not the cat the player just made.** The creator showed a pale tan still and a dark brown thumbnail. Home shows a grey, striped sabretooth in the scene. The hunt later shows a third, almost black, illustrated cat. The player cannot recognise themselves, so the "this one is yours" promise is broken on the first day. Shot: `shots/1080/home-day1-after-tips.png` (compare `creator-look.png` and `encounter-hunt.png`).
- **P2 — A lone cat is already "Nameless pride."** The corner title names a pride that does not exist yet, which makes the long-term goal (found a pride, give it a name) feel already used up, and badly. This label follows the player into Load as "Birchclaw of Nameless pride." Shot: `shots/1080/home-day1-after-tips.png`.
- The top bar is doing too many jobs at once (pride, name, place, season, day, four needs, Menu, About this place, Guide), so the things that matter most — needs and the next action — are the hardest to see. "Choose today's action" is at least a clear next step once the tip is gone.

### Today's action

- **P1 — The suggested action is a different, unreadable widget, and it sits on top of the other choices.** "Suits your goal," "Hunt" and "Track prey in this region." are mashed into one pale gold block, in mixed sizes, with poor contrast. It is not a normal action card. When More actions is opened, that gold block covers "Help the cub" and hides the locked actions below. The player cannot read the action the game is recommending, and cannot see the rest of the list. Anna already flagged this. The 720 shot is tighter but the same problem. Shots: `shots/1080/todays-action.png`, `todays-action-more.png`, `shots/720/todays-action-more.png`.
- **P1 — The panel does not belong to Home.** Once opened, Today's action stays on screen through Lore, the Map, Smilodons, Deeds and other sections, covering the right side of whatever the player was trying to read. Choosing a day's action and looking something up become the same crowded surface. Shots: `shots/1080/nav-lore.png`, `nav-map.png`, `nav-deeds.png`.

### Encounter

- **P1 — Opening Lore (or another nav section) during a hunt or fight leaves the encounter painted on top of that page.** On Lore, the titles smash into "LORE BOOK" / "GIANT DEER," the deer and cat sit over the book text, and hunt choices interleave with entries such as The Mistwood and The Ash Hills. Neither screen can be used. The side nav stays clickable the whole time, so this is easy to hit. Anna already flagged it. Shot: `shots/1080/encounter-nav-lore.png`.
- **P2 — The fight is hard to read as a scene.** On the cave hyena encounter a cream headshot labelled Sunfern, a black full-body cat, and the hyena overlap, and "SUNFERN" is partly covered. It is unclear who is who — especially because the black cat does not match the grey cat from Home. A "DAY 1" report stays in the corner while the header already says Day 2. Shot: `shots/1080/encounter-fight.png`.
- **P2 — Odds are written as numbers in the fight prose.** "Your odds of driving it off look partial (fight 10 against 9)" breaks the rule that story text stays number-free; see ## Copy (Saga). The player is pulled out of the scene into a calculation. Shot: `shots/1080/encounter-fight.png`.
- Leftover "Opens after you earn a deed" chips can still be sitting on the hunt screen from earlier nav clicks, so a locked-section message appears in the middle of a deer hunt. Shot: `shots/1080/encounter-hunt.png`.

### Dialogue

- **P1 — The same overlay problem as encounters.** Open Lore (or stay on it) and the conversation card sits on top of the Lore Book. Greeting, relationship meter and choices are readable only by ignoring the book text showing through around them. The player cannot talk and cannot read. Shot: `shots/1080/dialogue-nav-lore.png`.
- **P2 — The relationship meter is a raw −100 / 0 / 100 scale.** "Personal," "Romance · Unknown" and "Faction · Unknown" with numeric end-stops feel like a spreadsheet, not how another cat regards you. A previous day's report ("DAY 2") can also stay on screen during a Day 3 conversation. Shots: `shots/1080/dialogue.png`, `save.png`.

### Wilderness

- **P2 — Clicking Wilderness barely changes the screen.** The same den scene stays up, with Today's action and any leftover Travel tip still in the way, so the player cannot tell what this section is for. Shot: `shots/1080/nav-wilderness.png`.

### Smilodons

- **P2 — The list is crowded out, and its own empty state is unclear.** "No other smilodons met yet" and "Choose a cat from the list to read about them" share a tight corner with Today's action and the Travel tip. The only name is the player, and "About this cat" has nothing to show, so the section feels broken rather than simply empty. Shot: `shots/1080/nav-cats.png`.

### Lore

- **P1 — Unfilled `{name}` in the book.** "{name} leads Bonefield Pride" (and the Highcrag and Mistwood leader lines) appear in the Lore text. The book looks unfinished, and the player cannot learn who leads a pride. Anna already flagged this; see ## Copy (Saga). The first screen is also covered by Today's action and the Travel tip, so even the readable entries are clipped. Shot: `shots/1080/nav-lore.png`.

### Pride, Den, Breeding, Inventory, Market, Reputation

- **P2 — Locked sections look like real destinations, then go nowhere.** Pride, Den, Breeding, Inventory, Market and Reputation all sit in the rail on day 1. Clicking them does not open a page (the last open section, often Lore or Deeds, stays on screen, and the highlight does not move). Instead, "Opens when…" chips stack up over the Travel tip and the current page ("Opens after you Found a pride," "Opens when you take a mate," "Opens when you get a trade offer," "Opens after you earn a deed."). The why-text exists — see ## Copy (Saga) — but it arrives as sticky leftovers on the wrong screen, so the player thinks the button is broken or that the current page has changed. Reputation in particular stays on Deeds. Shots: `shots/1080/nav-pride.png`, `nav-den.png`, `nav-breeding.png`, `nav-inventory.png`, `nav-market.png`, `nav-reputation.png`.

### Map

- **P2 — The map is a few named boxes on an empty field, then other UI covers it.** Regions are short labels with no land, paths or art, and Today's action plus the Travel tip hide the right and lower parts. A leftover "Opens when you get a trade offer" chip can sit on the map as if it belonged there. The player cannot use the map to understand where they are in the Vale. Shot: `shots/1080/nav-map.png`.

### Deeds

- **P2 — The deeds list is open, but Today's action covers it.** "0 / 34," the filters, and entries such as Blooded are partly hidden behind the action panel, and the Travel tip covers the scene. The section looks important and is immediately unreadable. Shot: `shots/1080/nav-deeds.png`.

### Save / Continue / load

- **P2 — Save does not tell the player it worked.** Clicking Save during a conversation leaves the same dialogue on screen, with no toast or confirmation, so it is easy to assume nothing happened. Shot: `shots/1080/save.png`.
- **P2 — Continue brings the leftover day with you.** After load, the header says Day 3 at Twin Forks, but a "DAY 2" report, the undismissed Travel tip, and the Today's action panel (with the same unreadable Hunt block) are all still up. The player cannot tell which day they are in or what they are meant to do first. Shot: `shots/1080/continue-loaded.png`.
- **P2 — The Load list is technical and nameless.** The run is "Birchclaw of Nameless pride," with "Generation 1 · Last played 11/18/2026, 12:06:39 AM · 1/3 saves." There is no portrait, and the second row is a greyed "Empty run / Run slot 2." It reads like a debug slot list, not a choice of stories. On the root menu, Continue and Load are also silent when there is not yet a save. Shots: `shots/1080/load.png`, `root-menu.png`.
- The install-update wizard Anna flagged was not part of this playthrough.


## QA (Tracker) — wide/150% addendum

Ship-quality gate smoke of v0.1.8 (`ef443e5`), 2026-11-22, Asia/Jerusalem (IST). Reduced matrix: every size at 100% and at 150% (1280×720, 1920×1080, 2560×1440, 2560×1080 wide, 3440×1440 ultrawide). 71 screens × 10 cells = 710 shots in `/workspace/qa/ship-gate/runs/ef443e5/shots/{size}@{scale}/`. Load and Continue were not captured (the Load button timed out). Later tutorial beats (Places, Smilodons, Lore, after the action, day's end) were not reached.

This is only what the deferred wide and 150% checks add. The 1080/720 problem list above still stands; those issues also appear at the new sizes.

Counts:

- **Letterbox + stale menu art: 71/71 screens** on wide and on ultrawide, at both 100% and 150% (284 of 710 rows). Side gutters are 320px at 2560×1080 and 440px at 3440×1440. **Zero** letterbox on 720, 1080 or 1440 at either scale.
- Overlay leak (hunt or dialogue still painted on another nav section): still 36 screens, at every size and both scales.
- Unfilled `{name}` in the Lore Book: still present at every size and both scales, wherever Lore is on screen.
- 150% added **no new auto-flag kinds** versus 100% at the same CSS size. The known unreadable screens stay unreadable; they do not overflow the window in a new way on this path. The Sandbox options panel was not in the run (New Game still offers only Permadeath).

### Top findings that are new at these sizes

1. **P1 — The den scene never fills a wide or ultrawide window, and the main-menu night art shows in the gutters.** The shell is a centred 16:9 stage (`min(width/1920, height/1080)`). On 2560×1080 and 3440×1440 the starry menu background, snow and trees sit as dark bars on both sides of the daylight den (or hunt) scene, so the game looks letterboxed and like two different places at once. This is the fail against Anna's "the scene fills the whole window at every size (no letterboxed column)." It happens on every captured screen at those widths, including 150%. Shots: `/workspace/qa/ship-gate/runs/ef443e5/shots/wide@1/home.png`, `ultrawide@1/encounter-hunt.png`.
2. **P1 — Extra ultrawide width is wasted, so New Game card text still clips.** On 3440×1440 the Play Style and Season cards still end in ellipses ("Spend your…", "the herds ar…", "only the hard…"). The cards stay in the 16:9 column; the sides are empty gutters. Anna already flagged the cutoff text at 1080; wide-screen does not fix it. Shot: `/workspace/qa/ship-gate/runs/ef443e5/shots/ultrawide@1/newgame-setup.png`.
3. **P1 — Need bars and the suggested action stay unreadable at 1440, wide, ultrawide and 150%.** Health, Hunger, Thirst and Energy still have no visible fill, even on 2560×1440 and at 150%. "Suits your goal" / Hunt is still a mashed gold block that covers the rest of Today's action. The extra pixels never reach those controls, so the 1080 failures are not a small-window problem. Shots: `/workspace/qa/ship-gate/runs/ef443e5/shots/wide@1/todays-action.png`, `720@1p5/todays-action-more.png`.


## QA (Tracker) — 70e7fb6 recheck

Recheck of `70e7fb6` against the ef443e5 wide/150% addendum above. Asia/Jerusalem (IST, UTC+2). Capture 17:28–17:43 IST on 22 Nov 2026 (~14.8 min). Harness Load/Continue timeout fixed first (`__menuDebug.show('load'|'continue')`, Save then Continue hash always logged). Matrix (requested cells only): 2560×1440, 2560×1080 and 3440×1440 at scale 1.0 and 1.5, plus 1280×720 and 1920×1080 at 1.5 — 8 cells, 72 screens each, **576 shots**. Artifacts: `/workspace/qa/ship-gate/runs/70e7fb6-recheck/` (shots, `logs/findings.jsonl`, compare crops). No other NOTES sections were edited. Game tree was a detached worktree; `/workspace/sabretooth` was not touched.

### Comparison vs ef443e5

| Item | Verdict | Notes |
| --- | --- | --- |
| Letterboxing and stale menu art | **PASS in-game, FAIL on menu/creator/Load** | In play, `#stage` fills the window (gutters 0) on wide and ultrawide, including Home, Today's action, hunt/fight/dialogue, every nav, Save and Continue. Menu, New Game, all creator steps, root-after-save and Load still letterbox: 320 px gutters at 2560×1080, 440 px at 3440×1440, with the starry menu art in those gutters. 8/72 screens per wide/ultrawide cell, at both 1.0 and 1.5. 16:9 cells (1440, 720@1.5, 1080@1.5) have no letterbox. Matches `menu.js` `scale()`: game branch sets stage to `innerWidth`×`innerHeight`; menu branch still uses a 1920×1080 plate. |
| New Game text clipping | **PASS** | Cards wrap in full. No ellipses on Play Style, Season, or death-rule copy, including 1280×720 at 150% and 3440×1440. Heir and Sandbox cards are visible (marked "Not yet available"). |
| Need bars readable | **PASS** | Health, Hunger, Thirst and Energy show visible fill on every checked cell, including 720@1.5 and ultrawide. |
| Hunt button readable | **PASS** | "Suits your goal" / Hunt is a full-width footer and is readable at 1440, wide, ultrawide and 1080@1.5. At 720@1.5 the kicker and title still sit tight (`GOALHuntTrack`) but no longer mash over the rest of Today's action. |
| Save then Continue round-trip | **PASS** | `game.json` byte-identical after Save then Continue at both scales (two run files each; SHAs unchanged). Load and `continue-loaded` screens captured. ef443e5 never reached this check (Load click timed out). |

150% added **no new auto-flag kinds** versus 100% at the same CSS size (1440, wide, ultrawide).

### Top remaining issues on 70e7fb6

1. **Menu and creator still letterbox on wide/ultrawide, with stale night-sky art in the gutters.** The in-game fail from the addendum is fixed (`11c0d47`). The main menu, New Game, creator, and Load still sit in a 16:9 column. Shots: `/workspace/qa/ship-gate/runs/70e7fb6-recheck/shots/ultrawide@1/root-menu.png`, `ultrawide@1/newgame-setup.png`, `ultrawide@1/load.png`.
2. **Small text (<16 px) is still flagged widely** (1,466 flags across 576 rows). Most HUD and nav labels stay under the 16 px bar, including some Home/Today labels at 720@1.5 and 1080@1.5.
3. **At 1280×720, some Today's-action card body copy still clips** (e.g. "Watch from a vantage" cuts off mid-line). Overlap and dead-button auto-flags also remain on nav and New Game; treat those as secondary to the three comparison items above.

Compare crops: `/workspace/qa/ship-gate/runs/70e7fb6-recheck/compare/`.
