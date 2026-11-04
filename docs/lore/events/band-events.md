# Events: Bachelor Bands ("wanderings")

Owner: Saga. Status: **DRAFT v0.1**, design-only.
Rules: `loners-spec.md` v0.4 §5b. Challenge frequency by Style is in `play-styles-spec.md` §2.10, and fight death chance by Style in §2.9. All odds, strength, and cohesion are Tundra's. Nothing here adds a number.
Format, tokens, and fields: see `exile-event.md`, "Event format".
Lore: `loners.md`, "Bachelor bands".

**Extra tokens:** `{band}` the band's members as a list ("Brokentooth and Ashfall"), `{a}` and `{b}` single members, `{target}` the target pride, `{zone}` the contested zone, `{lead}` the band's strongest member.

---

## 1. Forming

### `band.form.world`
- **trigger:** §5b.2 band forms. · **styles:** story, standard, sim · **mix:** story
- **when:** the player is in or next to the band's home range, or has met a member.
> Two scents in the {zone}, and they no longer cross. They run side by side. {band} have started hunting together.
>
> The prides have a word for this: a wandering.
- **choices:** none.

### `band.form.witness` (variant)
- **when:** the player is in the band's home zone that turn. **Pending Tundra** (no witness rule).
> A carcass, half-eaten, and two toms on either side of it. A few days ago they would have fought over it. Tonight {a} lies down to eat, and {b} lies down beside {him}.

---

## 2. Joining (male player cat, before founding a pride)

### `band.invite`
- **trigger:** §5b.7 conditions are met (male player, no pride yet, affinity with every member high enough, band not full). · **styles:** story, standard, sim · **mix:** story
- **text by inviter** (use the member with the highest affinity to the player):
  - default: `{a} comes to meet you at the edge of the {zone}. "The hunting's better with three. You'd be the third."`
  - Brokentooth: `"You fight well enough. I need cats who fight well enough. Walk with us, and when the Bonefield falls, there's a place in it for you."`
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
- **trigger:** flavor, shown when cohesion is falling. Story-only beat; it adds no cohesion change of its own. **Pending Tundra** if it should.
- **styles:** story, standard, sim · **mix:** story
> {a} and {b} have been circling each other all day. At the carcass, {a} shoulders {b} aside. Sabers come out. Then both look at you.

| id | Label | Outcome text | effect |
|---|---|---|---|
| `side_a` | Stand with {a}. | {b} backs off and eats last, alone. | **Pending Tundra** |
| `side_b` | Stand with {b}. | {a} stalks away from the kill and doesn't come back until dark. | **Pending Tundra** |
| `between` | Step between them. | You take a swipe across the nose for it. Then all three of you eat. | **Pending Tundra** |

### `band.life.decide`
- **trigger:** a season in which the band could challenge (§5b.4) and the player is a member. Per §5b.7, the band never challenges on its own; the player decides.
- **styles:** story, standard, sim · **mix:** threat
> {lead} is watching {target}'s land from the ridge. "Their toms are slow this season," {lead} says. "We could take it. You say when."
- The text names `mates` or `territory` as §5b.4 chooses: mates: `"Their queens could be ours."` · territory: `"The {zone} could be ours."`

| id | Label | Outcome text | effect |
|---|---|---|---|
| `challenge` | Lead the challenge. | You go down the slope together, in the open, so they see you coming. | Start a challenge on {target} (§5b.4–5b.5). |
| `wait` | Not this season. | {lead} growls but stays. "Next season, then." | none |

---

## 4. A band challenges the player's pride

### `band.warning`
- **trigger:** §5b.4, the one-turn scent warning before a challenge on the player's pride. · **styles:** story, standard, sim · **mix:** threat
> There are strange toms' scents on your border, more than one, laid over your marks on purpose. Your pride smells it too. The cubs won't leave the den.
- Kind line by challenge type: mates: `They are not here for land.` · territory: `They are marking the {zone} as if it were already theirs.`
- **choices:** none required. In Standard and Sim the player may set guards and patrols with the normal pride tools (play-styles §3.2). In Story those run automatically (§3.1).
- Optional **proposed** choices (all **Pending Tundra**; §5b has no player options before the fight): `gather` (bring every adult to the den), `meet` (meet them at the border), `hide` (send queens and cubs deep into the territory).

### `band.challenge.player`
- **trigger:** §5b.4 challenge on the player's pride. · **styles:** story, standard, sim · **mix:** threat
> They come at dawn: {band}, walking in a line, unhurried. {lead} stops at the edge of your land and roars, and the sound rolls around the valley.
- **choices:**

| id | Label | Outcome text | effect |
|---|---|---|---|
| `fight` | Stand and fight. | You go to meet them, and your pride comes with you. | Resolve the fight (§5b.5). |
| `yield` | Let them have the {zone}. (territory only) | You call your pride back. {band} take the {zone} without a fight, and your cats see you do it. | **Pending Tundra** (no yield rule in §5b.5) |

### Outcomes (§5b.5)

**`band.result.defended`** (band loses)
> {band} break first. {lead} backs away, bleeding, and the others follow. They'll keep away from your land for a while. Your cats are already grooming each other's wounds.

**`band.result.territory_lost`** (band wins territory)
> When it's over, {band} lie down in the {zone} as if they had always been there. Your pride watches from the border. Nobody wants to be the first to look at you.

**`band.result.mates_lost`** (band wins mates; the player cat is not ousted)
> Your toms are driven out. {band} walk into the heart of your pride, and the queens don't run. You are still here, but your pride has new males now, and they know it.
- Ousted males become loners (§5b.5). A short goodbye per ousted male: `{cat} looks back once from the border. Then {cat} is just another scent in the empty land.`

**`band.result.player_ousted`** (band wins mates and the player cat is ousted; Death rule decides)
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
- **trigger:** a male player cat in a band founds a pride. The band ends, and members who trust him enough follow him with no recruitment roll (§5b.7). · **styles:** story, standard, sim · **mix:** story
- **for each member who follows:**
  > {cat} has been watching you mark the new land. Now {cat} walks over and marks it too, right beside yours. No one asks. It's already decided.
- **for each member who does not:**
  > {cat} sits at the edge of the new territory and watches for a while. "A pride's a heavy thing," {cat} says. "Carry it well." Then {cat} leaves.
- Named lines (optional):
  - Brokentooth follows: `"Good. Every king needs a tooth beside him. Mine's sharp enough."`
  - Coldwater follows: `"I wanted a home. I didn't think it'd be this one."`
  - Duskrunner doesn't follow: `"I'll visit! Maybe. Probably not. Maybe."`
  - Ashfall follows: `He just lies down at the den mouth, facing out.`
- **choices:** none (the rule decides who follows).

## Open points
- Whether the player can choose `mates` or `territory` for a challenge, or §5b.4 always picks. Text covers both.
- Quarrel choices, warning-turn choices, and yielding a zone have no rules yet. All marked **Pending Tundra**.
- `band.result.player_ousted` uses `{heir}`, which needs the Heir rule to name the successor.
