# Lore Book v0.1
Status: **ANNA-APPROVED** (Anna via Director, 2026-11-10). Drafted by Tundra from Anna's brief. Reads only from world memory, gossip and the `directory` bag (cat-directory-v0.1.1). No new numbers except §3.3, which Anna approved. Text is Saga's; everything is shown in words, from your cat's point of view.

## 1. Sections and what creates an entry
| Section | Created when | "How you learned it" |
|---|---|---|
| 1.1 Common knowledge | run start: Saga's fixed set (the Vale, the three prides and their leaders at start, seasons, prey, dangers, customs, legends) | "Every cat knows this." |
| 1.2 Learned | the player gets a fact first-hand: visits a region (first time), meets a cat, witnesses an event (a scene the player was in that writes a §12-whitelist fact), sees a camp or den feature, attends a council, or confirms a rumour (§3) | the place or cat: "You saw it at {zoneName}." |
| 1.3 Rumours | the player hears a gossip line (`directory.heard`) about a fact they don't know first-hand | the teller: "{sourceName} told you." |
| 1.4 Useful notes | derived from known facts (§2) | from the facts behind it |
1.5 One entry per fact. Hearing a fact you already know adds nothing. Leader changes, deaths and agreements update the existing entry ("…once led Highcrag") rather than adding a contradicting one.
1.6 A Common-knowledge entry that later changes (a leader dies) gets a Learned follow-up only when the player learns of it; until then the old common knowledge stands. This is intended.

## 2. Useful notes (derived, recomputed daily)
2.1 **Good hunting ground:** 2+ successful hunts by the player in a region, keyed to the season ("Herds gather at Herd Trail in summer").
2.2 **Dangerous place:** the player took a hazard hit, fled an encounter, or learned of a camp or den there. It names the danger in words.
2.3 **Likes and dislikes:** each `directory.traitSeen` band, written as what the cat warms to (courtship moves in encounters §4.3 read the same bands).
2.4 **Promises and debts:** every open promise (milestone-2 §11.3) and active agreement (world-map-territory §8). Removed when kept or broken; Learned keeps the outcome.
2.5 Notes are never stored as text, only as their source facts, so they can't drift from the truth.

## 3. Rumour truth rules
3.1 Every rumour points to a world fact `factId` and has `true: true|false`, fixed when it's spread. The player never sees the flag.
3.2 Gossip spread from a recorded fact is true by default (loners §12 whitelist).
3.3 **False rumours (ANNA-APPROVED, 1 time in 4):** when a teller who is Disliked or worse toward the subject (pair value ≤ −15) passes on a fact, 25% of the time they pass on Saga's false variant of that fact type instead. Only fact types with a written false variant can be false. Kept rare and personal: lies come from grudges.
3.4 **Confirm:** the player witnesses the fact itself or its direct evidence (meets the cat, sees the place, sees the agreement kept). The entry moves to Learned with Saga's confirm line, and "how" becomes the first-hand source.
3.5 **Debunk:** the player witnesses something that contradicts it (meets the "dead" cat alive, finds the region held by someone else). The entry is struck through in Rumours with Saga's debunk line naming the teller. The teller gets the world fact `spread_false_rumour` (gossip-eligible, no automatic value change).
3.6 Hearing the same rumour from a second, different teller marks it "Widely told" but never confirms it; only witnessing does.
3.7 A rumour whose fact becomes moot (the subject dies) stays unconfirmed, with a "You'll never know now" line if it was never resolved.

## 4. Search, filters, links, marker
4.1 Search is case-insensitive "contains" over title and text. Filters: section, place, cat, pride, combined with AND (as the directory, §4).
4.2 Links: a cat opens their directory card; a place opens the map region; a deed or title opens reputation.
4.3 "New lore" marker: on any entry with `seen: false`; cleared when the entry is scrolled into view. A marker on the book button shows the count in words ("New lore").
4.4 Sort: newest first within a section; Common knowledge in Saga's order.

## 5. Save fields (inside the `directory` bag, migrated with defaults)
`directory.lore = { [entryId]: { section: 'common'|'learned'|'rumour', factId, catIds[], regionId|null, prideId|null, day, how: {kind: 'common'|'witnessed'|'visited'|'met'|'heard'|'council', sourceCatId|null, zoneId|null}, rumour: {true, tellers[], state: 'unconfirmed'|'confirmed'|'false'}|null, seen } }`.
Notes have no stored entries (§2.5). Older saves: common knowledge is seeded, and Learned is back-filled from known facts with "how: unknown" text ("You've known this a while.").

## 6. Tracker checks
6.1 No leak: no entry, filter value or search hit exists for a fact the player doesn't know (common, witnessed or heard).
6.2 A false rumour's flag is never visible (UI, tooltip or log text).
6.3 Confirm and debunk fire once, on the right evidence, and a debunk writes `spread_false_rumour` for that teller.
6.4 Notes vanish when their facts stop being true (a kept promise, a region no longer dangerous after the den is gone).
6.5 Save/reload keeps every state and the New marker.

## Changelog
- v0.1 (2026-11-10): first version.
- v0.1.1 (2026-11-10, Tundra): ANNA-APPROVED via Director, including §3.3's 25% false-rumour rule. Backup `lore-book-v0.1.pre-anna.bak.md`.
