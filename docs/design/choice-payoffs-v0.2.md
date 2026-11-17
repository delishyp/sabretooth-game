# Choice payoffs v0.2: day 5, day 10, Let them watch
Status: PROPOSED DEFAULT (Tundra, 2026-11-10). Answers Tracker's d69115c finding 5. No new numbers, no new art. Everything below reuses choice-followups-v0.1 (once per run, receipt `runId/followup/{sourceEventId}/{choiceId}`, fires at the next meeting with that cat, pending cat gets action-8 priority as ordering only) and the §11.3 promise rules.

## 1. Day 5: Greyfall's question ("Just me" / "Give your name")
1.1 The reply records a fact on that cat: `introduce` → `knows_player_name`; `greet` ("Just me") → `player_said_alone`.
1.2 `knows_player_name` is gossip-eligible through `knowsFact` (§12), so pridemates can learn it the normal way.
1.3 Payoff A, next meeting with the same cat: the opener uses the player's name ("{playerName}. You came back."). No choice needed; it is the visible callback.
1.4 Payoff B, first meeting with a pridemate who knows the fact: that cat's opener is "You're the one {catName} spoke of." Once per run.
1.5 Payoff for "Just me", next meeting with the same cat: "Still walking alone?" Choices:
  - `for_now` "For now." → no effect, closes.
  - `not_by_choice` "Not by choice." → records `player_seeking_company`; gossip-eligible. A pridemate who later learns it may mention it in their opener (text only).
  - `leave` → nothing.
1.6 No affinity change anywhere in §1.

## 2. Day 10: "Meet me tomorrow"
2.1 From day 10 on, the first repeat meeting (a cat you have met before) ends with an extra choice. Once per run.
  - `ask_meet` "Meet me at {zoneName} tomorrow." → records `rendezvous {catId, zoneId, day+1}`.
  - `say_goodbye` → nothing.
  - `{zoneName}` is the zone where this meeting takes place (no other place is chosen).
2.2 Next day, Wait for a cat in that zone finds that cat first, using the Keep-watching rule (presence, no affinity gate, uses that day's approach receipt). Opener: "You came." If the cat is dead or gone, fall back to the normal roll.
2.3 If the player doesn't go there that day, the next meeting with that cat opens "I waited at {zoneName}." Choices: `explain`, `repair`, `leave`. Absence never breaks anything (§11.3.4), so no penalty, text only.
2.4 Tracker: to see the payoff, the replay needs to run to day 11.

## 3. Let them watch: closing beat and payoff
3.1 Result card = Saga's `presence.hunt.let_watch` line (pass-5, ends "pads away without a word") followed by the summary "The moment passes, and {catName} goes on about the day." No numbers on the card.
3.2 Records `watched_player_eat` on that cat.
3.3 Payoff, next meeting with that cat: "You ate the whole thing and never looked up." Choices:
  - `promise_share` "Next time, I'll share." → creates a `bring_prey` promise under §11.3 (kept by share +10, broken only by explicit refusal −5, no deadline). Existing numbers.
  - `my_kill` "It was my kill." → 0, records `refused_share` (same as Warn off).
  - `leave` → nothing.

## Changelog
- v0.2.1 (2026-11-10): §2.1 clarifies {zoneName} = the current meeting's zone (matches Flint's 4647955).
- v0.2 (2026-11-10): first version of this file; covers d69115c finding 5.
