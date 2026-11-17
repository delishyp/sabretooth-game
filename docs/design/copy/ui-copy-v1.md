# UI copy v1

Saga, 17 Nov 2026 (Asia/Jerusalem). For Flint, Ochre and Tundra. Nothing here is built, merged, tagged or pushed in the game repo.

- **Placeholders:** every `[PH]` key in `uiHints` at `3afe9da` (`src/renderer/data/events/first-season-v0.6.2.json`). **Count: 57.** Also `ui.council.agenda.truce`, which is hardcoded in `councils.js` and is not in `uiHints`.
- **UX spec:** v0.1.3 (FINAL), local commit `7fea4cb`. Dialogue choices and encounter moves have no gold primary button. v0.1.3a (`a06f206`) only records Director's approval of that exception and a 14px map-name floor; triggers are unchanged.
- **Opens-when, toast, and `tip.place.unavailable`:** from §2 and §3, plus Spar from the mockup locked list and the approved Spar tip.
- **Mockups:** every `[placeholder]` listed in `/workspace/qa/ux-simplify-mockup/NOTES.md`, under `mockups`, keyed for Ochre to drop in.
- **Voice:** plain and clear, second person, one or two short sentences, contractions, no numbers or number words, no em dashes, no lists of three, no slogans. Opens-when lines start with "Opens when you" or "Opens after you".

The earlier 13 keys at `c4daae4` are a subset. Seven Lore keys from that list were later dropped from `uiHints` when `lore-book-copy-v2` was wired; they are in a short appendix.

## A. uiHints placeholders at `3afe9da` (57) plus the council agenda label

### Meters, directory, Pride, reputation, councils
| key | where it shows | line | source |
|---|---|---|---|
| `ui.meter.hunt` | Title of the hunt word-bar on encounter panels | Hunt | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1039; used by src/renderer/js/word-bar.js:10 |
| `ui.meter.court` | Title of the courtship word-bar on encounter panels | Courtship | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1040; used by src/renderer/js/word-bar.js:11 |
| `ui.meter.band` | Caption under the hunt or courtship bar. Leave blank. | *(blank; do not print digits)* | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1041; rendered in src/renderer/js/word-bar.js:61 |
| `ui.directory.choose` | Empty state of the Smilodons detail panel when no cat is selected | Choose a cat from the list to read about them. | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1099; src/renderer/js/directory-panel.js:10 |
| `ui.directory.detail` | Title of the Smilodons cat detail / portrait drawer | About this cat | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1100; UX §4B |
| `ui.pride.empty` | Empty Pride row when the player has not founded a pride | You don't have a pride yet. Found a pride on Unclaimed land, or join a pride. | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1101; src/renderer/js/directory-panel.js:19 |
| `ui.reputation.feed` | Reputation screen explainer | Deeds can earn you a name. Once you have one, it stays with you. | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1102; used in src/renderer/js/game-screen.js |
| `ui.council.sit` | Button to sit at a council | Sit with the leaders | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1103 |
| `ui.council.leave` | Button to leave a council, including the empty-agenda fallback | Leave the council | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1104; also hardcoded in src/renderer/js/councils.js:70 |
| `ui.council.agenda.truce` | Council agenda choice when a truce is on the table | A truce between {prideA} and {prideB} | 3afe9da:src/renderer/js/councils.js:82 and :89 (hardcoded, not in uiHints) |
| `ui.heir.death` | Continue-as-heir death beat | {name} is gone. The pride goes on, and you go on as {heirName}. | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1075; also hardcoded in src/renderer/js/slice.js:305 |

### Encounter moves and tells
These are equal-weight choices. None is a gold primary (UX v0.1.3 §1.1).

| key | where it shows | line | source |
|---|---|---|---|
| `ui.encounter.move.swipe` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Swipe | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1051 |
| `ui.encounter.move.bite` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Bite | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1052 |
| `ui.encounter.move.pounce` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Pounce | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1053 |
| `ui.encounter.move.defend` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Defend | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1054 |
| `ui.encounter.move.intimidate` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Intimidate | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1055 |
| `ui.encounter.move.flee` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Flee | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1056 |
| `ui.encounter.move.creep` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Creep | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1057 |
| `ui.encounter.move.rush` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Rush in | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1058 |
| `ui.encounter.move.freeze` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Freeze | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1059 |
| `ui.encounter.move.run` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Run it down | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1060 |
| `ui.encounter.move.sprint` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Sprint | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1061 |
| `ui.encounter.move.cut_off` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Cut it off | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1062 |
| `ui.encounter.move.throat` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Throat bite | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1063 |
| `ui.encounter.move.drag` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Drag down | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1064 |
| `ui.encounter.move.hamstring` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Hamstring | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1065 |
| `ui.encounter.move.groom` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Groom | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1066 |
| `ui.encounter.move.show_off` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Show off | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1067 |
| `ui.encounter.move.playful` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Playful | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1068 |
| `ui.encounter.move.gentle` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Gentle | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1069 |
| `ui.encounter.move.bold` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Bold | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1070 |
| `ui.encounter.move.gift_prey` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Gift prey | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1071 |
| `ui.encounter.move.back_off` | Encounter move button. Equal weight with the other moves; no gold primary (UX §1.1 v0.1.3). | Back off | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1072 |
| `ui.encounter.tell` | Fallback telegraph line on the encounter panel, shown in bold | It gathers itself. | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1073 |
| `ui.encounter.predictable` | Short mark when a tell is already known | Predictable | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1074 |

### Trait picker and appearance tags
| key | where it shows | line | source |
|---|---|---|---|
| `ui.traits.balance.short` | Trait picker budget line when flaws do not yet cover the taken strengths | Your flaws don't cover this yet. | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1076 |
| `ui.traits.balance.even` | Trait picker budget line when flaws exactly cover the taken strengths | Your flaws cover this. Nothing is left over. | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1077 |
| `ui.traits.balance.left` | Trait picker budget line when something remains unused | Something is left over, and it will be lost. | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1078 |
| `ui.traits.fightLock` | Trait picker lock when no more fight strengths may be added | You've taken all the fight strengths you're allowed. | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1079 |
| `ui.traits.lookTag` | Tag on a trait that affects appearance | This touches how you look. | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1080 |
| `ui.traits.portraitWins` | Note when appearance text disagrees with the portrait | Your portrait keeps the look you chose. This only changes how the story describes you. | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1081 |
| `ui.traits.colourNote` | Note that coat colour stays on the portrait | The portrait keeps the coat you chose. | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1082 |
| `ui.traits.geneNote` | Note when a described look is not in the rolled genes | That look is not in this cat's blood. | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1083 |
| `ui.traits.room` | Trait picker budget bar word when there is still room (spec also names the full state as 'Full') | Room for more | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1084; UX §4D |
| `ui.traits.tag.scarred_face` | Appearance tag chip on the creator telling step | Scarred face | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1085 |
| `ui.traits.tag.scarred_body` | Appearance tag chip on the creator telling step | Scarred body | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1086 |
| `ui.traits.tag.torn_ear` | Appearance tag chip on the creator telling step | Torn ear | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1087 |
| `ui.traits.tag.notched_ear` | Appearance tag chip on the creator telling step | Notched ear | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1088 |
| `ui.traits.tag.chipped_saber` | Appearance tag chip on the creator telling step | Chipped saber | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1089 |
| `ui.traits.tag.missing_tooth` | Appearance tag chip on the creator telling step | Missing tooth | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1090 |
| `ui.traits.tag.limp` | Appearance tag chip on the creator telling step | Limp | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1091 |
| `ui.traits.tag.large` | Appearance tag chip on the creator telling step | Large | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1092 |
| `ui.traits.tag.small` | Appearance tag chip on the creator telling step | Small | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1093 |
| `ui.traits.tag.lean` | Appearance tag chip on the creator telling step | Lean | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1094 |
| `ui.traits.tag.heavy` | Appearance tag chip on the creator telling step | Heavy | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1095 |
| `ui.traits.tag.odd_eyes` | Appearance tag chip on the creator telling step | Odd eyes | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1096 |
| `ui.traits.tag.clouded_eye` | Appearance tag chip on the creator telling step | Clouded eye | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1097 |
| `ui.traits.tag.unusual_coat` | Appearance tag chip on the creator telling step | Unusual coat | 3afe9da:src/renderer/data/events/first-season-v0.6.2.json:1098 |

## B. Opens-when lines, New toast, and `tip.place.unavailable`

Greyed Places sections from §2, plus Deeds as named in §2. Greyed actions: Court and Found from §3, and Spar from Ochre's locked list together with the approved Spar tip.

| key | where it shows | line | source |
|---|---|---|---|
| `place.pride.opensWhen` | Shown when a greyed Pride rail item is selected | Opens when you catch a border scent, meet a patrol, join a pride or Found one. | UX v0.1.3 §2, 7fea4cb:docs/design/ux-simplification-v0.1.md (Pride row) |
| `place.den.opensWhen` | Shown when a greyed Den rail item is selected | Opens after you Found a pride. | UX v0.1.3 §2 (Den) |
| `place.breeding.opensWhen` | Shown when a greyed Breeding rail item is selected | Opens when you take a mate. | UX v0.1.3 §2 (Breeding); example line in §1.6 |
| `place.inventory.opensWhen` | Shown when a greyed Inventory rail item is selected | Opens when you gain an item. | UX v0.1.3 §2 (Inventory) |
| `place.market.opensWhen` | Shown when a greyed Market rail item is selected | Opens when you get a trade offer. | UX v0.1.3 §2 (Market / trade); UI label is Market |
| `place.quests.opensWhen` | Shown when a greyed Quests rail item is selected | Opens when you accept a request. | UX v0.1.3 §2 (Quests) |
| `place.reputation.opensWhen` | Shown when a greyed Reputation rail item is selected | Opens after you earn a deed. | UX v0.1.3 §2 (Reputation) |
| `place.councils.opensWhen` | Shown when a greyed Councils rail item is selected | Opens when you're invited to a council, or after you lead a pride. | UX v0.1.3 §2 (Councils) |
| `place.deeds.opensWhen` | If Achievements (Deeds) is shown greyed. §2 says it lives in Lore, and the New toast teaches it. | Opens after you earn an achievement. | UX v0.1.3 §2 (Achievements (Deeds)) |
| `action.court.opensWhen` | Greyed Court row under More actions | Opens when you and a cat are Bonded, during the mating season. For a pride cat, you must also Ask the leader. | UX v0.1.3 §3.2; trigger from the approved tip.court / court hints, not restated in §3 |
| `action.found.opensWhen` | Greyed Found row under More actions, when Found is locked | Opens when you have a mate and stand on Unclaimed land. | UX v0.1.3 §3 (Court/Found when they're open); trigger from the approved tip.found and found.noMate / found.notWild hints |
| `action.spar.opensWhen` | Greyed Spar row under More actions | Opens when you and a cat know each other well enough. | Ochre mockup §3.2 locked list; trigger from approved tip.spar and presence.spar.locked |
| `toast.newSection` | Short toast when a Places section unlocks, with a dot on the rail until it is opened | New: {section} | UX v0.1.3 §2, 'An unlock shows a short "New: {section}" toast' |
| `tip.place.unavailable` | First-use tip when a greyed Places section is selected | Title: Greyed sections. Greyed sections open as the story moves on. Select a greyed section to see what opens it. | Rewrite of /workspace/saga-narrative-voice/tutorial/tips-copy-v2.json (tip.place.unavailable); UX v0.1.3 §2 |
| `guide.tip.place.unavailable` | Guide entry for tip.place.unavailable | Title: Greyed sections. When a Places section is greyed, it isn't open yet. It will open as the story moves on, and selecting it says what opens it. | Rewrite of tips-copy-v2.json guide.tip.place.unavailable; UX v0.1.3 §2 |

The tip and Guide entry no longer use the word Unavailable, because that on-screen state is retired.

## C. Mockups (`NOTES.md` placeholders)

For Ochre to drop into `/workspace/qa/ux-simplify-mockup/`. Shared opens-when lines, the toast, and the unavailable tip use the same keys as §B.

| key | where it shows | line | source |
|---|---|---|---|
| `action.hunt.line` | Hunt one-liner under Choose today's action / Suits your goal | Track prey in this region. | NOTES.md item 1, Tundra's §3.3 example; den-actions.html, den-more-actions.html |
| `action.rest.line` | Rest one-liner in the action panel | Rest the day away and get your Energy back. | NOTES.md item 1; aligned with tip.rest (Energy), den-actions.html |
| `action.travel.line` | Travel one-liner in the action panel | Walk to a neighbouring region. | NOTES.md item 1; den-actions.html |
| `action.watch.line` | Watch from a vantage one-liner in the action panel | See which cats pass this ground, and what they're doing. | NOTES.md item 1, adapted from tip.watch; den-actions.html uses the official action name Watch from a vantage |
| `action.scent.line` | Scent sign one-liner | See who has been on this ground. | NOTES.md item 1, adapted from tip.scent; den-more-actions.html |
| `action.spar.line` | Spar one-liner in the action panel | Wrestle with a cat who knows you well. | UX v0.1.4 (e7b291f) §3 action names |
| `action.court.line` | Court one-liner in the action panel | Win over a Bonded cat. | UX v0.1.4 (e7b291f) §3 action names |
| `action.found.line` | Found one-liner in the action panel | Start your pride here. | UX v0.1.4 (e7b291f) §3 action names |
| `action.askjoin.line` | Ask to join one-liner in the action panel | Ask this pride to take you in. | UX v0.1.4 (e7b291f) §3 action names |
| `action.patrol.line` | Patrol one-liner in the action panel | Walk your borders and watch for trouble. | UX v0.1.4 (e7b291f) §3 action names |
| `action.mark.line` | Mark one-liner in the action panel | Leave your scent so others know this land is held. | UX v0.1.4 (e7b291f) §3 action names |
| `action.cost.day` | Cost word on a same-day action (Hunt, Rest, Watch, and the like) | Costs: the day | NOTES.md item 2; den-actions.html |
| `action.cost.dayOrMore` | Cost word on Travel, when a trail may take more than the day | Costs: the day, or more | NOTES.md item 2; den-actions.html |
| `den.situation` | Den situation line on den-later, once a pride is founded | Your pride is resting in the shade of The Split Rock. | NOTES.md item 6; den-later.html. Place name taken from the built tutorial card, The Split Rock. |
| `dialogue.mood.friendly` | Mood word under the portrait on dialogue / event, beside the Bond word | Friendly | UX v0.1.4 (e7b291f) |
| `encounter.health.hurt` | Health word above the encounter bar (Fine / Hurt / Badly hurt) | Hurt | NOTES.md item 8; UX §1.4 and §4C; encounter.html |
| `encounter.state.circling` | Example encounter state line above the telegraph | {foe} is circling. You're winded. | NOTES.md item 8; UX §4C example (It's circling. You're winded.). encounter.html had He's circling. |
| `map.prey.good` | Prey word in the Map region drawer (Low / Fair / Good) | Good | NOTES.md item 9; UX §1.4; map.html |
| `map.water.river` | Water word in the Map region drawer | River | NOTES.md item 9; map.html |
| `creator.seasonSummary` | One-line season / style summary under the creator portrait, with Change | Standard Vale | NOTES.md item 10; traits.html |
| `label.todaysAction` | Action panel kicker | Today's action | NOTES.md item 11, coined UI labels |
| `label.suitsYourGoal` | Mark on the recommended action in the primary slot | Suits your goal | NOTES.md item 11 |
| `label.moreActions` | Expander for the rest of the day's actions, including greyed locked actions | More actions | NOTES.md item 11; UX §3.1 |
| `label.yourAnswer` | Kicker above dialogue choices (no gold primary on this screen) | Your answer | NOTES.md item 11; dialogue-choices |
| `label.earlierInThisTalk` | Drawer for earlier dialogue lines | Earlier in this talk | NOTES.md item 11; UX §4B |
| `label.roundLog` | Closed drawer for the encounter round log | Round log | NOTES.md item 11; UX §4C |
| `label.moreMoves` | Expander for extra encounter moves beyond the three shown plus Run | More moves | NOTES.md item 11; encounter.html |
| `label.moreBodyTraits` | Expander after the first five Body trait cards | More body traits | NOTES.md item 11; traits.html |
| `label.opposite` | Prefix on a trait card before the name of its opposite | Opposite: | NOTES.md item 11; UX §4D |
| `label.taken` | Mark on a trait card already chosen | Taken | NOTES.md item 11 |
| `label.youHaveItsOpposite` | Mark on a trait card whose opposite is already chosen | You have its opposite | NOTES.md item 11 |
| `label.showPrides` | Map layer control, closed, with Prides on by default | Show: Prides | NOTES.md item 11; UX §4E |
| `label.whatCatsAreSaying` | Map drawer for gossip | What cats are saying | NOTES.md item 11; map.html |
| `label.todaysReport` | Drawer for the day report | Today's report | NOTES.md item 11 |
| `dayWords.springNew` | Season-day in words in the top bar, at the start of spring | {Season} · Day {n} | NOTES.md item 11, 'Spring, the first day' style day words |
| `ui.traits.full` | Trait picker budget bar word when there is no room left, beside Room for more | Full | UX §4D, named with Room for more; not a [PH] key, included so the pair is complete |

Shared keys already written in §B: `action.spar.opensWhen`, `action.court.opensWhen`, `place.*.opensWhen` for Pride, Den, Breeding, Inventory, Market, Quests, Reputation and Councils, `tip.place.unavailable`, `toast.newSection`.

## Appendix. Lore keys only on `c4daae4`

These seven were part of the original 13 placeholders on the UI groups 1–5 branch. They are not in `uiHints` at `3afe9da`. Prefer `lore-book-copy-v2` on the PR 2 tip.

| key | where it shows | line | source |
|---|---|---|---|
| `ui.lore.common` | Lore Book section heading | Common knowledge | c4daae4:src/renderer/data/events/first-season-v0.6.2.json:1045; Anna-approved heading in tips-copy-v2 and lore-book-copy-v2 |
| `ui.lore.learned` | Lore Book section heading | Learned | c4daae4:src/renderer/data/events/first-season-v0.6.2.json:1046 |
| `ui.lore.rumours` | Lore Book section heading | Rumours | c4daae4:src/renderer/data/events/first-season-v0.6.2.json:1047 |
| `ui.lore.notes` | Lore Book section heading | Useful notes | c4daae4:src/renderer/data/events/first-season-v0.6.2.json:1048 |
| `ui.lore.empty` | Shared empty line for a Lore Book section on the UI groups 1–5 branch | There's nothing written here yet. It will fill as you travel and listen. | c4daae4:src/renderer/data/events/first-season-v0.6.2.json:1049; src/renderer/js/lore-book.js:14 |
| `ui.lore.learnedLine` | Fallback body for a Learned entry when the real fact line is not wired | Something you've learned. | c4daae4:src/renderer/data/events/first-season-v0.6.2.json:1050 |
| `ui.lore.rumour` | Fallback body for a Rumours entry when the real rumour line is not wired | A rumour you've heard. It may be false. | c4daae4:src/renderer/data/events/first-season-v0.6.2.json:1051 |

## Rulings applied

Tundra UX v0.1.4 (e7b291f): the spec unlock triggers stand (Flint updates unlocks.js). Map is Wilderness and Deeds stay in Lore. Drink and Scout the border are removed, and the official action names are used. The mood word is Friendly. Greyed items stay selectable.

## Open questions

UX v0.1.5 (66eaeb7) applied: the top bar label, Ask to join ("Opens once you've met this pride's leader. Stand on their land to ask."), the named threat, and "Locked" for locked actions.

2. **Flint.** Leave `ui.meter.band` blank and use band words, not digits. Wire `ui.council.agenda.truce`. Add keys for the opens-when lines, the toast and the new tip.

## Self-check

Passed: no digits and no em dashes in any player-facing line; every greyed section from §2 and every greyed action listed above has an opens-when line; `tip.place.unavailable` does not use the word Unavailable; all 57 uiHints keys are covered.

Advisory: no number words (`one`, `first`, and the rest) in player-facing lines.
