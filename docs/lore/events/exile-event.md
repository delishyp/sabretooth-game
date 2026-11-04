# Event: A Cat Leaves a Pride (exile or departure)

Owner: Saga. Status: **DRAFT v0.1**, design-only.
Rules: `loners-spec.md` v0.8 §6.2 and §10.2 (witness or rumor). The same witness-or-rumor rule is used for bands forming (§10 "Band answers"; see `band-events.md`). Each season an AI pride may lose one cat to exile or departure, and that cat becomes a new loner. The roll, the odds, and who is picked are Tundra's. This file is only what the player reads.
Player-pride departures are a different rule (§6.4) and live in `pride-departure-events.md`.

## Event format (shared by all files in `lore/events/`)

Spec 6.2 doesn't set a format, so this is a draft for Flint and Tracker. Each event has:

| Field | Meaning |
|---|---|
| `id` | Dotted id, e.g. `exile.witness.crime`. |
| `trigger` | The spec rule that fires it. Saga does not invent triggers. |
| `styles` | Which play styles (`story`, `standard`, `sim`; `play-styles-spec.md` §1) can show it. |
| `mix` | `story`, `threat`, or `survival`, the event-mix bucket (play-styles §2.11). |
| `when` | Extra story conditions. Anything marked **Pending Tundra** needs a rule before it can be built. |
| `text` | Player-facing text. Tokens in `{braces}`. |
| `choices` | `id`, label, outcome text, and `effect`. An effect only points at an existing spec rule, or says `none`, or **Pending Tundra**. No new numbers here. |

**Tokens:** `{cat}` the cat, `{pride}` pride name, `{leader}` pride leader, `{player}` the player cat, `{zone}` a zone name. Pronoun tokens `{he}`, `{him}`, `{his}` resolve by the cat's sex (he/she, him/her, his/her). Sentences are written so the verb doesn't change with the pronoun.

**Pride flavor:** some lines have a `[highcrag]`, `[bonefield]`, or `[mistwood]` version. Use the one for `{pride}`.

## Reason keys

Saga picks the reason for the cat (spec §1.2 lets Saga choose). The reason picks the variant below and sets `departure` on the cat record.

| Reason key | departure | Fits best in |
|---|---|---|
| `exiled.crime` | exiled | any |
| `exiled.challenge` | exiled | Bonefield (law of challenge) |
| `exiled.law` | exiled | Highcrag (forbidden mate, broken custom) |
| `exiled.unjust` | exiled | any |
| `left.grief` | left | any, Mistwood most |
| `left.wanderlust` | left | young adults |
| `left.disagreement` | left | Bonefield, Highcrag |

---

## 1. `exile.rumor.<reason>` (player too far away to see it)

- **trigger:** §6.2 roll succeeds for `{pride}` and the player is not close enough to witness it. The rumor fires on the delay set in §10.2, sooner if the player and `{cat}` are close (§10.2).
- **styles:** story, standard, sim · **mix:** story
- **when:** not witnessed (see §2 below).
- **text (opener, pick one):**
  - scent: `The scent of {pride} has changed. One thread of it now runs away from the rest, toward the empty land.`
  - overheard: `Two {pride} cats are arguing at the border, too busy to notice you. One name keeps coming up: {cat}.`
  - sign: `At the Split Rock, a fresh scent mark from {pride} lies over an old one. It's {cat}'s, and it points away.`
- **opener for a cat the player knows well** (the sooner rumor in §10.2):
  > You hear it before the day is out, because you would have wanted to. {cat} is gone from {pride}.
- **then one line by reason:**

| Reason | Line |
|---|---|
| `exiled.crime` | {cat} took what was not {his} to take. {leader} drove {him} out, and no one stood beside {him}. |
| `exiled.challenge` | {cat} challenged {leader} and lost. The law of the grass is short: the loser leaves. |
| `exiled.law` | {cat} broke the old custom of {pride}. The pride turned its back, one cat at a time. |
| `exiled.unjust` | {leader} named {cat} the one to blame. Some of {pride} believe it. Some only pretend to. |
| `left.grief` | {cat} could not stay where the lost ones had slept. {cat} left without a word. |
| `left.wanderlust` | {cat} has gone to see what lies past the edge of the known valley. |
| `left.disagreement` | {cat} would not obey {leader} any longer, and walked away before it came to blood. |

Pride flavor closer (pick by `{pride}`):
- `[highcrag]` On the crag, the name {cat} will not be sung again.
- `[bonefield]` In the Bonefield they say {cat} ran. They say it loudly.
- `[mistwood]` In the Mistwood no one speaks of it. Someone has left a scent mark on the trail out, the old sign for "come back".

- **choices:** none. Afterwards {cat} appears as a loner (§10.2).

---

## 2. `exile.witness.<reason>` (only if the player sees it)

- **trigger:** §6.2 roll succeeds for `{pride}`.
- **styles:** story, standard, sim · **mix:** story
- **when:** the player cat is in the same zone as `{cat}` or an adjacent one that turn (§10.2). Otherwise use `exile.rumor`.

**`exiled.crime`**
> Snarls carry from {pride}'s ground. {cat} comes out of the long grass with the whole pride behind, ears flat, not running, not quite walking. {leader} stops at the scent line. {cat} does not look back until the last moment, and then only once.

**`exiled.challenge`**
> The fight is already over. {cat} lies in the trampled snow while {leader} stands over {him}, breathing hard. Then {leader} steps back, and the pride opens a path. It leads one way: out. {cat} gets up slowly and takes it.

**`exiled.law`**
> {pride} has gathered in a half-circle. Nobody snarls. Nobody moves. {cat} stands in the middle, and one by one the others turn their backs. When the last one turns, {cat} goes.

**`exiled.unjust`**
> {leader}'s voice is the only sound. {cat} says something back, quietly. You can't hear it, but you see two of the pride look at the ground. Then {cat} is walking toward the border, and no one follows.

**`left.grief`**
> At dusk {cat} stands at the edge of {pride}'s land for a long time, looking back at the dens. Then {cat} turns into the wind and keeps going.

**`left.wanderlust`**
> {cat} rubs cheeks with a few of {pride}, one after another, as if counting them. Then {cat} trots off toward the far end of the valley, light-footed, tail up.

**`left.disagreement`**
> {cat} and {leader} face each other, hackles up, sabers bared. For a long breath it could go either way. Then {cat} lowers {his} head, not in surrender, and walks away.

**Choices** (all allowed by existing rules):

| id | Label | Outcome text | effect |
|---|---|---|---|
| `watch` | Stay hidden and watch. | You keep low until the scent of {cat} fades. You will know {him} again. | none |
| `follow` | Follow at a distance. | You track {cat} to the empty land. {cat} knows you're there and lets you be. | none. {cat} appears as a loner (§10.2) and is met through normal encounters (§2.3). |
| `leave` | It isn't your business. Go. | You turn away. The valley is full of cats who were once something else. | none |

---

## 3. `exile.firstmeet.<reason>` (first meeting with the new loner)

- **trigger:** first loner encounter with `{cat}` (§2.3).
- **styles:** story, standard, sim · **mix:** story
- **text by departure type:**
  - exiled: `{cat} is thinner than when {pride} still had {him}. "If {pride} sent you, you can tell them I'm still breathing."`
  - left: `{cat} watches you come and doesn't move. "I'm not one of them now. I'm not anything yet."`
- **choices:** the normal loner actions from §2.4. Only the text below is new.

| id | Label | Outcome text | effect |
|---|---|---|---|
| `share` | Share your kill. | {cat} eats like a cat who has been alone a while. Then, quietly: "I won't forget that." | §2.4 share a kill |
| `ignore` | Pass by. | You keep walking. {cat} watches you go. | §2.4 ignore |
| `chase` | Drive {him} off. | {cat} gives ground, but not far, and not fast. | §2.4 chase off |
| `attack` | Attack. | It is short and ugly. {cat} limps away and will remember your scent. | §2.4 attack |

Groom (§2.4) is not offered at a first meeting because it needs affinity first. Recruit and courtship use their own systems (§3, §4).

## Open points
- A "speak for {cat}" choice during an exile would be good drama, but there's no rule for it. Proposal only.
