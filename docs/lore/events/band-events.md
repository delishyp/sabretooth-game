# Events: Bachelor Bands ("wanderings")

Owner: Saga. Status: **DRAFT v0.1**, design-only.
Rules: `loners-spec.md` v0.8 §5b, with rulings in §10.1 (young adults can band; a male can band once he is an adult, lifecycle-spec v0.1 §3), §10.3 (quarrels), §10.5 (stakes and takeover), §10.6 (lured males), and §10 "Band answers" (warning choices, yield, witnessing a band form). Challenge frequency by Style is in `play-styles-spec.md` §2.10, and fight death chance by Style in §2.9. All odds, strength, and cohesion are Tundra's. Nothing here adds a number.
Format, tokens, and fields: see `exile-event.md`, "Event format".
Lore: `loners.md`, "Bachelor bands".

**Extra tokens:** `{band}` the band's members as a list ("Torncheek and Ashfall"), `{a}` and `{b}` single members, `{target}` the target pride, `{zone}` the contested zone, `{lead}` the band's strongest member.

---

## 1. Forming

### `band.form.world`
Which version fires follows §10 "Band answers" (the same rule as exiles, §10.2): `band.form.witness` if the player is in the band's home zone or an adjacent zone that season, otherwise `band.form.rumor` a few turns later.

### `band.form.witness`
- **trigger:** §5b.2 band forms, and the player is in the band's home zone or an adjacent one that season. · **styles:** story, standard, sim · **mix:** story
> A carcass, half-eaten, and two toms on either side of it. A few days ago they would have fought over it. Tonight {a} lies down to eat, and {b} lies down beside {him}.
>
> The prides have a word for this: a wandering.
- **choices:** none.

### `band.form.rumor`
- **trigger:** §5b.2 band forms and the player was not near enough to see it. Fires on the rumor delay in §10 "Band answers". · **styles:** story, standard, sim · **mix:** story
- **text** (pick one):
  - scent: `Two scents in the {zone}, and they no longer cross. They run side by side. {band} have started hunting together.`
  - overheard: `At the border, two pride cats are muttering about the {zone}. "Two of them now," one says. "Hunting together." The other doesn't answer.`
  - sign: `You find a kill in the {zone} picked clean by more than one mouth. Both scents on it are toms, and you know them: {band}.`
- **closer:** `The prides have a word for this: a wandering.`
- **choices:** none.

---

## 2. Joining (male player cat, before founding a pride)

### `band.invite`
- **trigger:** §5b.7 conditions are met (male player, no pride yet, affinity with every member high enough, band not full). · **styles:** story, standard, sim · **mix:** story
- **text by inviter** (use the member with the highest affinity to the player):
  - default: `{a} comes to meet you at the edge of the {zone}. "The hunting's better with three. You'd be the third."`
  - Torncheek: `"You fight well enough. I need cats who fight well enough. Walk with us, and when the Bonefield falls, there's a place in it for you."`
  - Coldwater: `"It's quieter, with someone else breathing nearby. Stay a while, if you want."`
  - Duskrunner: `"Come with us! Or don't. But come with us."`

| id | Label | Outcome text | effect |
|---|---|---|---|
| `join` | Walk with them. | You fall in beside {band}. Nobody says anything. That's how it's done. | Join the band (§5b.7). |
| `decline` | Not yet. | {a} shrugs. "The offer smells the same tomorrow." | none |
| `refuse` | You walk alone. | {a} looks at you a long moment, then turns away. | none |

---

## 3. Life in the band

### `band.life.hunt`
- **trigger:** a band hunt resolves (§5b.6 counts successful hunts). · **styles:** story, standard, sim · **mix:** survival
- **success:**
  > Three hunters, one horse. {a} drives it, {b} turns it, and you take the throat. You eat side by side, and for a while no one is alone.
- **failure:**
  > The bison breaks the line and is gone. {a} snarls at nothing. {b} won't look at anyone. Hunger makes a band quiet in a bad way.
- **choices:** none. The outcome only shifts cohesion through §5b.6.

### `band.life.quarrel`
- **trigger:** a quarrel between two band members while the player is in the band (§10.3). · **styles:** story, standard, sim · **mix:** story
> {a} and {b} have been circling each other all day. At the carcass, {a} shoulders {b} aside. Sabers come out. Then both look at you.

| id | Label | Outcome text | effect |
|---|---|---|---|
| `side_a` | Stand with {a}. | You step to {a}'s shoulder. {b} backs off and eats last, alone, and doesn't look at either of you. | §10.3 side with one: affinity up with {a}, down with {b}, band cohesion down. |
| `side_b` | Stand with {b}. | You step to {b}'s shoulder. {a} stalks away from the kill and doesn't come back until dark. | §10.3 side with one: affinity up with {b}, down with {a}, band cohesion down. |
| `mediate` | Step between them. (only if the player is sociable enough or both trust him, §10.3) | Rolled under §10.3. See outcomes below. | §10.3 mediate |
| `stay_out` | Let them settle it. | You lie down a little way off and wait. It's settled, in the end, with teeth. The band eats in silence. | §10.3 stay out: band cohesion down. |

**`mediate` outcomes:**
- success: `You push in between them, shoulder to shoulder, and take a swipe across the nose for it. Then {a} laughs, a short huff, and all three of you eat.` (§10.3: cohesion up)
- failure: `You push in between them, and they both turn on you. When it's over, everyone eats apart, and nobody is happy with you.` (§10.3: cohesion down, both members like the player less)

### `band.life.decide`
- **trigger:** a season in which the band could challenge (§5b.4) and the player is a member. Per §5b.7, the band never challenges on its own; the player decides.
- **styles:** story, standard, sim · **mix:** threat
> {lead} is watching {target}'s land from the ridge. "Their toms are slow this season," {lead} says. "We could take it. You say what we fight for."

The player picks the stake (§10.5). `mates` is offered only if {target} has resident males (§10.5).

| id | Label | Outcome text | effect |
|---|---|---|---|
| `challenge_mates` | Fight to take their pride. | "Their pride, then. We take their place." You go down the slope together, in the open, so they see you coming. | Challenge {target} with stake `mates` (§5b.4–5b.5, §10.5). |
| `challenge_territory` | Fight for the {zone}. | "Just the land, then. For now." You go down the slope together, toward the {zone}. | Challenge {target} with stake `territory` (§5b.4–5b.5, §10.5). |
| `wait` | Not this season. | {lead} growls but stays. "Next season, then." | none |

### `band.result.takeover` (player's band wins `mates` before he has founded a pride)
- **trigger:** §10.5. This counts as founding a pride: the band members become its resident males and the ousted males become loners. · **styles:** story, standard, sim · **mix:** story
> When it's over, {target}'s old toms are limping toward the border. The rest of the pride watches you from the den mouth. They don't run, and they don't come closer.
>
> {lead} lies down beside you, breathing hard. "Well," {lead} says. "It's yours now. What do we call it?"
- Ousted males: `{cat} looks back once from the border. Then {cat} is just another scent in the empty land.`
- Then the normal pride-founding flow runs (pride naming and so on). §6 `band.follow` does not fire, since every band member is already a resident male.
- Fallen fighters (`standard`, `sim` only) use the same line as below.

### `band.result.lost_as_member` (player's band loses)
> {target} holds. You run with the others, bleeding, and nobody speaks until the {zone} is far behind.

---

## 4. A band challenges the player's pride

### `band.warning`
- **trigger:** §5b.4, the one-turn scent warning before a challenge on the player's pride. · **styles:** story, standard, sim · **mix:** threat
> There are strange toms' scents on your border, more than one, laid over your marks on purpose. Your pride smells it too. The cubs won't leave the den.
- Kind line by challenge type: mates: `They are not here for land.` · territory: `They are marking the {zone} as if it were already theirs.`
- **choices** (all Styles; §10 "Band answers", warning choices). The player picks one, or does nothing:

| id | Label | Outcome text | effect |
|---|---|---|---|
| `gather` | Gather the whole pride at the den. | Every adult comes in and stays in. Nobody hunts. By nightfall the cubs are whining with hunger, and the grown cats snap at each other over nothing. But when the band comes, they will find all of you together. | §10 warning choice `gather` |
| `meet` | Meet them at the border. | You lead your fighters out to the scent line and wait there in the open. If they want your land, they'll have to take it here. Beat them on their own ground, and they won't forget it soon. | §10 warning choice `meet` |
| `hide` | Send the queens and cubs deep into the territory. | The queens carry the cubs away to the far dens, where no stranger has ever walked. Fewer of you will stand when the band comes. But whatever happens at the border, it won't reach the little ones. | §10 warning choice `hide` |
| `nothing` | Do nothing. | You let the pride go about its day. Some of them keep looking at the border, then at you. | none (no warning choice, §10) |

- Standard and Sim still allow normal guard and patrol orders (play-styles §3.2). In Story those run automatically (§3.1).

### `band.challenge.player`
- **trigger:** §5b.4 challenge on the player's pride. · **styles:** story, standard, sim · **mix:** threat
- If the band includes a male who left or was lured from the player's pride (§10.6), add: `{cat} is with them. {cat} doesn't look at you.`
> They come at dawn: {band}, walking in a line, unhurried. {lead} stops at the edge of your land and roars, and the sound rolls around the valley.
- **choices:**

| id | Label | Outcome text | effect |
|---|---|---|---|
| `fight` | Stand and fight. | You go to meet them, and your pride comes with you. | Resolve the fight (§5b.5). |
| `yield` | Let them have the {zone}. (**territory challenges only**; never offered for `mates`) | See `band.result.yielded`. | §10 "Band answers", yield |

### Outcomes (§5b.5)

**`band.result.defended`** (band loses; if the player chose `meet`, use `band.result.defended_border` instead)
> {band} break first. {lead} backs away, bleeding, and the others follow. They'll keep away from your land for a while. Your cats are already grooming each other's wounds.

**`band.result.yielded`** (player yields a territory challenge; §10 "Band answers")
> You call your pride back from the border. {band} walk into the {zone} without a fight and lie down there as if they had always owned it. Nobody is hurt. Nobody looks at you, either.
- **bitter beat** (shown for the pride's most aggressive cats; who counts is §10's rule):
  > {cat} stays at the border long after the others have gone back. "We didn't even make them bleed," {cat} says, to no one, loud enough for you to hear.
- **closer:** `The {zone} is theirs for now. Whatever you do, you won't be able to claim it back until the band moves on.`

**`band.result.defended_border`** (band loses after the player chose `meet`)
> You turn them at the scent line. {band} back off across your border, bleeding, and keep going. Your fighters walk home with their heads up. It will be a long time before that band tests you again.

**`band.result.cubs_safe`** (add to any outcome when the player chose `hide`)
> When it's over, the queens bring the cubs back from the far dens. Every one of them is whole.

**`band.result.territory_lost`** (band wins territory)
> When it's over, {band} lie down in the {zone} as if they had always been there. Your pride watches from the border. Nobody wants to be the first to look at you.

**`band.result.mates_lost`** (band wins mates; the player cat is not ousted)
> Your toms are driven out. {band} walk into the heart of your pride, and the queens don't run. You are still here, but your pride has new males now, and they know it.
- Ousted males become loners (§5b.5). A short goodbye per ousted male: `{cat} looks back once from the border. Then {cat} is just another scent in the empty land.`

**`band.result.player_ousted`** (band wins mates and the player cat is ousted; Death rule decides)
- `{heir}` is the current designated heir (heir ranking per menu-spec §7, as used in loners-spec §10.8).
- **permadeath:**
  > You are driven out of the pride you made. Behind you, {lead} is lying where you used to lie. The story of {player} ends here, at the edge of your own land.
- **heir:**
  > You are driven out, and you don't come back. Your pride remembers. {heir} remembers most. Now {heir} must keep them alive.
- **sandbox:**
  > You are driven out. The cold is very large without a pride around you. But you have been alone before, and you started a pride before. You can do it again.

**Fallen fighters** (`standard`, `sim` only; Story has no fight deaths, play-styles §2.9)
> {cat} did not get up. The pride stays beside {him} until the cold comes in.

### `band.challenge.world`
- **trigger:** §5b.4 challenge on an AI pride. · **styles:** story, standard, sim · **mix:** story
- **when:** the player is near either side, or at the next encounter with that pride.
- **text by result:**
  - defended: `Roaring from {target}'s land all night. In the morning, {band}'s scent is gone, and {target}'s toms are licking fresh wounds.`
  - territory: `{band} now sleep in the {zone}. {target} has stopped marking it.`
  - mates: `{target} has new toms. {band} are pride cats now, and {target}'s old males walk the empty land.`
- Pride flavor for a mates win:
  - `[highcrag]` Highcrag does not sing about it. It will be in the song anyway, someday.
  - `[bonefield]` In the Bonefield, this is the law working as it should. The ousted ones say nothing.
  - `[mistwood]` Mistwood took them in without a sound. Some of the fog cats look relieved.
- **Story hook:** if `{band}` includes Coldwater and `{target}` is Mistwood, use `band.world.homecoming` below.

### `band.world.homecoming` (special)
> Coldwater walks into the Mistwood with a stranger's band at his back. It's the only way back he found. Sedge sees him from across the clearing and doesn't look away.

---

## 5. Breaking up (§5b.6)

### `band.breakup`
- **trigger:** a §5b.6 breakup. · **styles:** story, standard, sim · **mix:** story
- **text by cause:**

| Cause | Text |
|---|---|
| cohesion ran out | One morning {a} is gone. The scent leads away into the snow and doesn't turn back. The wandering is over. |
| too few members | With only {a} left, there's nothing to call a band. {a} hunts alone again. |
| won a mates challenge | No goodbye is needed. They are pride cats now. |
| random | Nothing happens. They just stop walking together, the way cats do. |

- **if the player was a member** (cohesion ran out, random):
  > {a} rubs past you once, briefly. "It was good hunting," {a} says. "Find your own valley." Then you are alone again.
- **choices:** none.

---

## 6. Following the player (§5b.7)

### `band.follow`
- **trigger:** a male player cat in a band founds a pride in the normal way (not by a takeover, see `band.result.takeover`). The band ends, and members who trust him enough follow him with no recruitment roll (§5b.7). · **styles:** story, standard, sim · **mix:** story
- **for each member who follows:**
  > {cat} has been watching you mark the new land. Now {cat} walks over and marks it too, right beside yours. No one asks. It's already decided.
- **for each member who does not:**
  > {cat} sits at the edge of the new territory and watches for a while. "A pride's a heavy thing," {cat} says. "Carry it well." Then {cat} leaves.
- Named lines (optional):
  - Torncheek follows: `"Good. A pride needs a face the wolves remember. Mine will do."`
  - Coldwater follows: `"I wanted a home. I didn't think it'd be this one."`
  - Duskrunner doesn't follow: `"I'll visit! Maybe. Probably not. Maybe."`
  - Ashfall follows: `He just lies down at the den mouth, facing out.`
- **choices:** none (the rule decides who follows).

## Open points
- None. The warning choices, yield, and band-forming witness rule now follow §10 "Band answers" (v0.7).
