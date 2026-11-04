# Events: Cats Leaving the Player's Pride

Owner: Saga. Status: **DRAFT v0.1**, design-only.
Rules: `loners-spec.md` v0.8 §6.4, with rulings §10.4 (warning choices), §10.6 (lures), §10.7 (confront), §10.8 (heir), and `play-styles-spec.md` v0.2 row 2.12. Contentment, thresholds, timing, odds, lure, dispersal, and who is protected are all Tundra's. Nothing here adds a number.
Format, tokens, and fields: see `exile-event.md`, "Event format".

**Style coverage**
- **Story:** player-pride cats never leave, so none of these events fire. No `story` tag appears below.
- **Standard:** warning signs, win-back choices, and departure.
- **Sim:** all of Standard, plus lure warnings, lured departures, young-male dispersal, and the mate/heir variant.

**Extra tokens:** `{newHeir}` the auto-designated next heir (§10.8). `{lurer}` the rival pride, band, or loner doing the luring. `{lurerKind}` is `pride`, `band`, or `loner`. `{border}` is the nearest border zone in the lurer's direction, or any border.

---

## 1. Warning signs (§6.4 warning season)

The three required signs. Show one per warning season, rotated for variety. If a cat is warned again, use a different sign.

### `depart.warn.sleep_apart`
- **trigger:** §6.4 warning fires for `{cat}`. · **styles:** standard, sim · **mix:** story
> {cat} has started sleeping away from the others, at the mouth of the den where the wind comes in. When the pride piles together for warmth, {cat} stays where {he} is.

### `depart.warn.eat_last`
- **trigger:** same. · **styles:** standard, sim · **mix:** story
> At the kill, {cat} waits until everyone else has eaten, even the cubs, and then takes what's left without looking at anyone.

### `depart.warn.border_gaze`
- **trigger:** same. · **styles:** standard, sim · **mix:** story
> You find {cat} on the edge of your land again, staring out at the {border}. {cat} doesn't turn when you come up beside {him}.

### Win-back choices (on any warning sign)

These are the player responses from §6.4 and §10.4: groom, share food, change role, confront, or ignore. One action per cat per season. Effects are in §10.4 and §10.7; the text below only gives each one its own feel.

| id | Label | Outcome text | effect |
|---|---|---|---|
| `groom` | Groom {cat}. | {cat} stiffens at first. Then, slowly, {his} head drops against your shoulder, and the two of you stay like that a long time. | §10.4 groom |
| `share` | Bring {cat} the best of the kill. | You drop the meat in front of {cat}, in front of everyone. The pride sees that it's {his}. {cat} sees them seeing. | §10.4 share food |
| `reassign` | Make {cat} a hunter / guard / nursemaid. | See variants below. | §10.4 change role (counts only if the role fits the cat's top trait) |
| `confront` | Face {cat} about it. | See variants below. | §10.7 confront |
| `ignore` | Leave {cat} be. | You let it go. {cat} doesn't come to the pile tonight either. | §10.4 ignore |

**`reassign` variants** (§10.4):
- **role fits {cat}'s nature:** `{cat} listens. A pause. "All right." That night {cat} sleeps at the den mouth again, but this time facing out.`
- **role doesn't fit:** `{cat} does what you ask, all of it, without a word. It isn't what {cat} needed, and you can both tell.`

**`confront` variants** (§10.7; the roll weighs the player's boldness against {cat}'s, adjusted by {cat}'s loyalty to the pride, `prideLoyalty`):
- **success:** `{cat} bristles, then holds your eyes, and finally looks away first. "I don't know where I belong anymore," {cat} says. It's the first true thing {cat} has said in a season. By dusk, {cat} is back in the pile.`
- **failure:** `{cat} hears you out, then turns {his} back and walks to the far end of the den. You have made it worse.`
- **failure, aggressive cat (scuffle):** `{cat} doesn't back down. {cat} comes at you instead, ears flat, and the den scatters. It's short: claws, not sabers, and neither of you means to kill. When it's over you're both bleeding, and the pride has seen all of it.`
  - Non-lethal: injury only, using the Style's injury rules (§10.7, play-styles §2.3). No death text, in any Style.

### `depart.warn.recovered`
- **trigger:** the cat's contentment recovers so §6.4 no longer applies. · **styles:** standard, sim · **mix:** story
> {cat} is back in the warm middle of the pile tonight. Nobody mentions it.

---

## 2. Departure (§6.4 leave roll succeeds)

### `depart.leave`
- **trigger:** §6.4 leave roll succeeds after the warning season. · **styles:** standard, sim · **mix:** story
- **text** (pick one):
  - night: `In the morning, {cat}'s place at the den is cold. The scent goes out to the {border} and keeps going.`
  - goodbye: `{cat} comes to you at dusk and touches noses, the way cubs do. "I'm sorry," {cat} says, and walks out of your land.`
  - by the sign that fired: sleep apart: `{cat} slept apart one night too many. This time {cat} didn't come back.` · eat last: `{cat} didn't come to the kill today. {cat} won't come to the next one either.` · border gaze: `{cat} finally went where {he} was looking.`
- **closer (always):**
  > {cat} is a loner now. The valley is wide, and you will cross scents again.
- **choices:** none. Per §6.4, {cat} becomes a loner from your pride and can be recruited back later (§3). Starting trust when you meet again comes from §6.4.

### `depart.firstmeet` (first meeting after leaving)
- **trigger:** first encounter with a cat who left the player's pride (§2.3). · **styles:** standard, sim · **mix:** story
> {cat} sees you and stops. For a moment {cat} looks like {he} might come to you. Then {he} doesn't.
- **choices:** the normal loner actions (§2.4) and recruitment if eligible (§3). Recruit success line: `{cat} walks back into the pride without a word, and takes {his} old place in the pile.`

---

## 3. Lure (Sim only)

### `depart.lure.warn`
- **trigger:** §6.4 Sim lure warning for an unhappy `{cat}` liked by `{lurer}`. · **styles:** sim · **mix:** threat
- **text by `{lurerKind}`:**
  - pride: `{cat} smells of {lurer} again. {cat} has been meeting them at the border, and coming back slower each time.`
  - band: `{cat} has been hunting with {lurer}. You found their scents together at a kill that isn't yours.`
  - loner: `{lurer} has been waiting at the edge of your land. Not for you. For {cat}.`
- **choices:** the win-back choices from §1 (groom, share, reassign, confront, ignore), with the same outcome text. One extra line for `confront` here: `"They want me," {cat} says. "Do you?"`

### `depart.lure.leave`
- **trigger:** §6.4 lure succeeds. · **styles:** sim · **mix:** story
- by `{lurerKind}`:
  - pride: `{cat} has gone to {lurer}. You can see {him} on their side of the border, eating at their kill.`
  - band, and {cat} is a young-adult or adult male and the band has room (§10.6): `{cat} has gone with {lurer}. Three scents, now, where there were two. {cat} is one of the wandering now.`
  - band, any other case (§10.6: becomes a solo loner): `{cat} went to {lurer}, but they had no place for {him}. {cat} walks the empty land alone now.`
  - loner: `{cat} and {lurer} left together in the night. Their scents go side by side into the empty land.`

---

## 4. Young-male dispersal (Sim only)

### `depart.disperse.restless`
- **trigger:** a young male in the §6.4 dispersal window, which opens when he turns adult (lifecycle-spec §5.1). Flavor only; no warning is required by the spec. · **styles:** sim · **mix:** story
> {cat} is too big for the cub pile now and too young for anything else. {cat} spends the day pacing the border and fighting the wind.

### `depart.disperse.leave`
- **trigger:** §6.4 dispersal roll succeeds. · **styles:** sim · **mix:** story
> It was always going to happen. Young toms leave. {cat} goes at first light, without looking back, the way you did once.
- If {cat} is the player's son: `Your son walks out to find his own valley. Somewhere out there, your blood keeps going.`
- **choices:** none. Dispersal doesn't take the heir or the pride's only other adult male (§6.4).

---

## 5. Mate or heir leaves (Sim only, special variant)

In Standard a mate or heir never leaves. In Sim they can, only under §6.4's lower threshold. These replace the normal warning and departure text for that cat.

### `depart.bond.warn` (mate or heir)
- **trigger:** §6.4 warning for the player's mate or designated heir. · **styles:** sim · **mix:** story
- **mate:**
  > {cat} doesn't sleep against you anymore. When you lie down, {cat} gets up. When you speak, {cat} looks at the {border}.
- **heir:**
  > {cat} has stopped following you on patrol. You used to have to tell {him} to go back to the den. Now {cat} doesn't come at all.
- **choices:** the win-back choices from §1. Changed text for this variant:
  - groom (mate): `{cat} lets you, but doesn't groom you back. Not yet.`
  - confront (mate): `"You stopped seeing me," {cat} says. "Long before I stopped sleeping beside you."`
  - confront (heir): `"Everything I do is for when you're gone," {cat} says. "When do I get to be something now?"`
  - reassign (heir): `You give {cat} the lead on the next hunt. {cat} looks at you as if seeing you for the first time in a while.`

### `depart.bond.leave` (mate or heir)
- **trigger:** §6.4 leave roll succeeds for a mate or heir. · **styles:** sim · **mix:** story
- **mate:**
  > {cat} is gone. You follow the scent to the border and stop. You could follow it further. You don't. The den has never been so big.
- **heir:**
  > {cat} is gone. The one meant to carry your pride after you has chosen to carry nothing. Your pride is looking at you, waiting to hear who comes next.
- **closer:** `{cat} is a loner now. Some roads lead back.`
- **choices:** none.
- **heir only, notice line** (§10.8, the next heir in line is chosen automatically):
  > {newHeir} is your heir now. You can choose another.
- **heir only, if no one qualifies** (§10.8):
  > No cat in your pride can carry it after you. Not yet.

## Open points
- None from §10. Confront and lure outcomes, heir replacement, and win-back choices now follow §10.4, §10.6, §10.7, and §10.8.
