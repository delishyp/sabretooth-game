# Events: Perks with New Content

Owner: Saga. Status: **DRAFT v0.1**, design-only, 2026-11-04.
Rules: skills-spec v0.2.1 §2 (each perk's mechanics), §9.3 (⚑ death and succession), play-styles §2.9 (no fight deaths in Story). Relations and effects: relationships-spec v0.1.2 §7. Nothing here adds a number; the perk's own rule resolves the outcome, and these events are the text over it.
Text: `perk-text.md`. Format: the shared event fields from `exile-event.md` (`id`, `trigger`, `styles`, `mix`, `when`, choices), written in the JSON event shell from `scene-format.md` §5, so Flint's one loader reads both.

**Shell notes (events only):**
- `trigger` names the spec rule that fires the event (events point at rules; scenes use rel-spec tags).
- `results` holds one branch per outcome of that rule (`success`/`failure`). The opener `beats` play first, then the branch. Each branch carries its own `summary`.
- `byPride` on a narration beat swaps the text for `{pride}`'s flavour (`highcrag`, `bonefield`, `mistwood`). `text` is the default for the player's own pride or an unknown one.
- A cast slot with `"optional": true` may be unbound (for example, a lone cat before founding). Beats spoken by an unbound slot are skipped, so every event still reads with the player alone.
- Thirst is never used, so all of these run in Story.

---

## 1. Giant-Feller (`giant_slayer`)

### `perk.giant_slayer.sloth`
- **trigger:** skills §2.1 `giant_slayer`, the player chooses the "giant prey" hunt. · **styles:** story, standard, sim · **mix:** survival · **when:** any season.

```json
{
  "id": "perk.giant_slayer.sloth",
  "type": "event",
  "trigger": "skills.giant_slayer.hunt",
  "styles": ["story", "standard", "sim"],
  "mix": "survival",
  "version": 1,
  "cast": {
    "A": { "slot": "left", "who": "player" },
    "B": { "slot": "right", "who": "pride", "optional": true }
  },
  "beats": [
    { "kind": "narration", "text": "A ground sloth has wandered down from the hills, slow and enormous, tearing at the willow scrub by the river." },
    { "kind": "line", "speaker": "B", "expression": "sad", "text": "That isn't prey, {A.name}. That's a hill with claws." },
    { "kind": "line", "speaker": "A", "expression": "neutral", "text": "Then we take the hill." }
  ],
  "results": {
    "success": {
      "beats": [
        { "kind": "narration", "text": "It takes the whole afternoon and all of your nerve. When the giant finally falls, the ground shudders under your paws." },
        { "kind": "line", "speaker": "B", "expression": "happy", "text": "The whole Vale will smell this. Let them. We eat for days." }
      ],
      "summary": "{A.name} brought down a giant ground sloth by the river."
    },
    "failure": {
      "beats": [
        { "kind": "narration", "text": "The claws come round faster than anything that big should move. You roll clear, bleeding, and the giant lumbers off into the scrub." },
        { "kind": "line", "speaker": "B", "expression": "sad", "text": "Next time. If there is a next time." }
      ],
      "summary": "{A.name} hunted a giant ground sloth and came away hurt."
    }
  },
  "effects": [],
  "summary": "{A.name} hunted a giant ground sloth.",
  "fallback": "{A.name} hunted a ground sloth by the river. The giant hunt's own rule decided how it ended."
}
```

### `perk.giant_slayer.calf`
- **trigger:** same. · **styles:** story, standard, sim · **mix:** survival · **when:** spring or summer (the calves are out).

```json
{
  "id": "perk.giant_slayer.calf",
  "type": "event",
  "trigger": "skills.giant_slayer.hunt",
  "styles": ["story", "standard", "sim"],
  "mix": "survival",
  "version": 1,
  "cast": {
    "A": { "slot": "left", "who": "player" },
    "B": { "slot": "right", "who": "pride", "optional": true }
  },
  "requires": { "season": ["spring", "summer"] },
  "beats": [
    { "kind": "narration", "text": "A mammoth calf has strayed from the herd to drink at the river. Its mother is out of sight. For now." },
    { "kind": "line", "speaker": "B", "expression": "sad", "text": "The mothers never forgive. You know that." }
  ],
  "results": {
    "success": {
      "beats": [
        { "kind": "narration", "text": "You drag the calf into the long grass before the herd's trumpeting reaches the water. The ground keeps shaking for a long time." },
        { "kind": "line", "speaker": "B", "expression": "happy", "text": "We'll feast. And we won't drink at this river again this season." }
      ],
      "summary": "{A.name} took a mammoth calf at the river."
    },
    "failure": {
      "beats": [
        { "kind": "narration", "text": "The mother comes over the bank like a falling cliff. You run, and you keep running long after the shaking stops." },
        { "kind": "line", "speaker": "B", "expression": "sad", "text": "She has our scent now. They always remember." }
      ],
      "summary": "{A.name} tried for a mammoth calf and fled its mother."
    }
  },
  "effects": [],
  "summary": "{A.name} hunted a mammoth calf.",
  "fallback": "{A.name} went after a mammoth calf at the river while its mother was away."
}
```

---

## 2. False Trail (`false_trail`)

### `perk.false_trail.lay`
- **trigger:** skills §2.2 `false_trail`, the player uses the action. · **styles:** story, standard, sim · **mix:** threat

```json
{
  "id": "perk.false_trail.lay",
  "type": "event",
  "trigger": "skills.false_trail.use",
  "styles": ["story", "standard", "sim"],
  "mix": "threat",
  "version": 1,
  "cast": {
    "A": { "slot": "left", "who": "player" },
    "B": { "slot": "right", "who": "pride", "optional": true }
  },
  "beats": [
    { "kind": "narration", "text": "At dusk you drag an old carcass along the border, then roll in a stranger's scent marks until you reek of somewhere else." },
    { "kind": "line", "speaker": "B", "expression": "angry", "text": "You smell like a stranger. I nearly went for your throat." },
    { "kind": "line", "speaker": "A", "expression": "happy", "text": "Good. So will they." }
  ],
  "effects": [],
  "summary": "{A.name} laid a false trail along the border.",
  "fallback": "{A.name} laid a false scent trail along the pride's border to lead any wandering astray."
}
```

### `perk.false_trail.turned`
- **trigger:** the `false_trail` 50% roll succeeds and a band retargets (skills §2.2, loners §5b.4). Replaces `band.warning` for that band. · **styles:** story, standard, sim · **mix:** threat

```json
{
  "id": "perk.false_trail.turned",
  "type": "event",
  "trigger": "skills.false_trail.retarget",
  "styles": ["story", "standard", "sim"],
  "mix": "threat",
  "version": 1,
  "cast": {
    "A": { "slot": "left", "who": "player" },
    "B": { "slot": "right", "who": "pride", "optional": true }
  },
  "beats": [
    { "kind": "narration", "text": "The strange toms' scent that had been gathering on your border is gone this morning. It runs off along your false trail." },
    { "kind": "line", "speaker": "B", "expression": "happy", "text": "They followed the lie. Let {target} meet them instead." },
    { "kind": "line", "speaker": "B", "expression": "sad", "text": "Though I'd not wish a wandering on any den with cubs in it." }
  ],
  "effects": [],
  "summary": "A wandering followed {A.name}'s false trail toward {target}.",
  "fallback": "A wandering that had been marking the pride's border followed {A.name}'s false trail and turned toward {target}."
}
```

---

## 3. Herd-Memory (`herd_calendar`)

### `perk.herd_calendar.hint`
- **trigger:** skills §2.2 `herd_calendar`, the season-end hint names next season's rich zone. · **styles:** story, standard, sim · **mix:** survival

```json
{
  "id": "perk.herd_calendar.hint",
  "type": "event",
  "trigger": "skills.herd_calendar.hint",
  "styles": ["story", "standard", "sim"],
  "mix": "survival",
  "version": 1,
  "cast": {
    "A": { "slot": "left", "who": "player" },
    "B": { "slot": "right", "who": "pride", "optional": true }
  },
  "beats": [
    { "kind": "narration", "text": "On the last evening of the season you lie on high ground and watch the herds drift. You know where they'll gather next: {zone}." },
    { "kind": "line", "speaker": "B", "expression": "neutral", "text": "How can you tell? They all look the same to me." },
    { "kind": "line", "speaker": "A", "expression": "neutral", "text": "The grass is turning there first. They follow the grass." }
  ],
  "effects": [],
  "summary": "{A.name} sensed the herds would gather in {zone} next season.",
  "fallback": "Watching the herds at season's end, {A.name} knew they would gather in {zone} next."
}
```

### `perk.herd_calendar.arrival`
- **trigger:** first day of the season named by the hint. · **styles:** story, standard, sim · **mix:** survival

```json
{
  "id": "perk.herd_calendar.arrival",
  "type": "event",
  "trigger": "skills.herd_calendar.arrival",
  "styles": ["story", "standard", "sim"],
  "mix": "survival",
  "version": 1,
  "cast": {
    "A": { "slot": "left", "who": "player" },
    "B": { "slot": "right", "who": "pride", "optional": true }
  },
  "beats": [
    { "kind": "narration", "text": "The herds are in {zone}, just as you knew they would be. The cold air is thick with their breath." },
    { "kind": "line", "speaker": "B", "expression": "happy", "text": "You knew. Every season you know. Where do you learn it?" }
  ],
  "effects": [],
  "summary": "The herds came to {zone}, as {A.name} foresaw.",
  "fallback": "The herds arrived in {zone} at the turn of the season, where {A.name} had said they would."
}
```

---

## 4. Hunger Trail (`famine_path`)

### `perk.famine_path.lead`
- **trigger:** skills §2.2 `famine_path`, used in winter. · **styles:** story, standard, sim · **mix:** survival · **when:** winter.

```json
{
  "id": "perk.famine_path.lead",
  "type": "event",
  "trigger": "skills.famine_path.use",
  "styles": ["story", "standard", "sim"],
  "mix": "survival",
  "version": 1,
  "cast": {
    "A": { "slot": "left", "who": "player" },
    "B": { "slot": "right", "who": "pride", "optional": true }
  },
  "requires": { "season": ["winter"] },
  "beats": [
    { "kind": "narration", "text": "The Vale is white and empty. You lead the pride a long way, through a gap in the rocks, into a hollow where the snow lies thin." },
    { "kind": "line", "speaker": "B", "expression": "happy", "text": "Deer. There are deer here, in this cold. How did you know?" },
    { "kind": "line", "speaker": "A", "expression": "neutral", "text": "Eat. And never speak of this place beyond our own scent line." }
  ],
  "effects": [],
  "summary": "{A.name} led the pride to a hidden hollow with prey in deep winter.",
  "fallback": "In the hungriest part of winter, {A.name} led the pride through the rocks to a hidden hollow where deer still fed."
}
```

### `perk.famine_path.ends`
- **trigger:** the `famine_path` window ends (skills §2.2). · **styles:** story, standard, sim · **mix:** survival

```json
{
  "id": "perk.famine_path.ends",
  "type": "event",
  "trigger": "skills.famine_path.end",
  "styles": ["story", "standard", "sim"],
  "mix": "survival",
  "version": 1,
  "cast": {
    "A": { "slot": "left", "who": "player" },
    "B": { "slot": "right", "who": "pride", "optional": true }
  },
  "beats": [
    { "kind": "narration", "text": "The hollow is grazed out and the deer have moved on. You lead the pride back the long way, fuller than they came." },
    { "kind": "line", "speaker": "B", "expression": "sad", "text": "I'll miss it. It's the first place this winter that felt warm." }
  ],
  "effects": [],
  "summary": "The hidden hollow ran out of prey, and the pride went home.",
  "fallback": "When the hidden hollow ran out of prey, {A.name} led the pride home again."
}
```

---

## 5. Border Envoy (`envoy`)

### `perk.envoy.visit`
- **trigger:** skills §2.5 `envoy`, the player visits an AI pride's border. · **styles:** story, standard, sim · **mix:** story · **when:** B is that pride's leader.

```json
{
  "id": "perk.envoy.visit",
  "type": "event",
  "trigger": "skills.envoy.use",
  "styles": ["story", "standard", "sim"],
  "mix": "story",
  "version": 1,
  "cast": {
    "A": { "slot": "left", "who": "player" },
    "B": { "slot": "right", "who": "visitor" }
  },
  "requires": { "role": { "B": ["leader"] } },
  "beats": [
    {
      "kind": "narration",
      "text": "{B.name} meets you at the border and waits for you to speak.",
      "byPride": {
        "highcrag": "{B.name} meets you at the foot of the crag, unhurried, and lets you speak first, as custom says a guest should.",
        "bonefield": "Two Bonefield cats block the trail until {B.name} calls them off with a single growl.",
        "mistwood": "You wait at the edge of the fog a long while before you notice {B.name} has been watching you all along."
      }
    },
    { "kind": "line", "speaker": "B", "expression": "neutral", "text": "You came to talk. Few do. Say it." },
    { "kind": "line", "speaker": "A", "expression": "neutral", "text": "Our borders touch. I'd rather our scents met than our claws." },
    { "kind": "line", "speaker": "B", "expression": "neutral", "text": "Words are light in the snow. But I'll remember that you came." }
  ],
  "effects": [],
  "summary": "{A.name} spoke with {B.name} at the border.",
  "fallback": "{A.name} went to {B.name}'s border to talk rather than fight, and was heard."
}
```

---

## 6. Border Truce (`truce`)

### `perk.truce.agreed`
- **trigger:** skills §2.5 `truce`, accepted by a pride at neutral or better. · **styles:** story, standard, sim · **mix:** story

```json
{
  "id": "perk.truce.agreed",
  "type": "event",
  "trigger": "skills.truce.use",
  "styles": ["story", "standard", "sim"],
  "mix": "story",
  "version": 1,
  "cast": {
    "A": { "slot": "left", "who": "player" },
    "B": { "slot": "right", "who": "visitor" }
  },
  "requires": { "role": { "B": ["leader"] } },
  "beats": [
    { "kind": "narration", "text": "You and {B.name} walk the border from end to end, side by side, marking it together as you go." },
    { "kind": "line", "speaker": "B", "expression": "neutral", "text": "No fighting on this line until the seasons turn twice. Break it, and the whole Vale hears." },
    { "kind": "line", "speaker": "A", "expression": "neutral", "text": "It will hold on my side." },
    { "kind": "line", "speaker": "B", "expression": "happy", "text": "Then perhaps we'll both see a quiet spring, for once." }
  ],
  "effects": [],
  "summary": "{A.name} and {B.name} agreed to a border truce.",
  "fallback": "{A.name} and {B.name} walked their shared border together and agreed to a truce."
}
```

### `perk.truce.ends`
- **trigger:** the `truce` period ends (skills §2.5). · **styles:** story, standard, sim · **mix:** story

```json
{
  "id": "perk.truce.ends",
  "type": "event",
  "trigger": "skills.truce.end",
  "styles": ["story", "standard", "sim"],
  "mix": "story",
  "version": 1,
  "cast": {
    "A": { "slot": "left", "who": "player" },
    "B": { "slot": "right", "who": "visitor" }
  },
  "beats": [
    { "kind": "narration", "text": "The truce with {B.name}'s pride has run its course. Fresh marks from both prides lie side by side on the border. No one has crossed them yet." }
  ],
  "effects": [],
  "summary": "The border truce with {B.name}'s pride ended quietly.",
  "fallback": "The truce with {B.name}'s pride ran out, and the border stayed quiet."
}
```

---

## 7. Border-Taker (`warlord`)

### `perk.warlord.demand`
- **trigger:** skills §2.3 `warlord`, the demand succeeds (the spec has no refusal). · **styles:** story, standard, sim · **mix:** threat

```json
{
  "id": "perk.warlord.demand",
  "type": "event",
  "trigger": "skills.warlord.use",
  "styles": ["story", "standard", "sim"],
  "mix": "threat",
  "version": 1,
  "cast": {
    "A": { "slot": "left", "who": "player" },
    "B": { "slot": "right", "who": "visitor" }
  },
  "requires": { "role": { "B": ["leader"] } },
  "beats": [
    { "kind": "narration", "text": "You walk into the {zone} at the head of your fighters and lie down in the middle of it." },
    { "kind": "line", "speaker": "B", "expression": "angry", "text": "This is our ground." },
    { "kind": "line", "speaker": "A", "expression": "neutral", "text": "It was." },
    { "kind": "narration", "text": "{B.name} looks at your fighters, then at {B.his} own, and counts. Then {B.he} turns away." },
    { "kind": "line", "speaker": "B", "expression": "angry", "text": "Keep it, then. Every season you keep it, we'll remember." },
    {
      "kind": "narration",
      "text": "The {zone} is yours now.",
      "byPride": {
        "highcrag": "The {zone} is yours now. Highcrag will put this in the song, and not kindly.",
        "bonefield": "The {zone} is yours now. In the Bonefield they'll call it the law of the grass, and mean revenge.",
        "mistwood": "The {zone} is yours now. Mistwood says nothing. The fog keeps what it is given."
      }
    }
  ],
  "effects": [],
  "summary": "{A.name} took the {zone} from {B.name}'s pride without a fight.",
  "fallback": "{A.name} led the pride's fighters into the {zone} and {B.name}'s pride gave it up rather than fight."
}
```

### `perk.warlord.unease`
- **trigger:** the day after `perk.warlord.demand`, if a pride cat with low aggression is present. Flavour only. · **styles:** standard, sim · **mix:** story

```json
{
  "id": "perk.warlord.unease",
  "type": "event",
  "trigger": "skills.warlord.after",
  "styles": ["standard", "sim"],
  "mix": "story",
  "version": 1,
  "cast": {
    "A": { "slot": "left", "who": "player" },
    "B": { "slot": "right", "who": "pride" }
  },
  "requires": { "trait": [ { "cat": "B", "trait": "aggression", "band": "low" } ] },
  "beats": [
    { "kind": "narration", "text": "{B.name} has been sitting at the edge of the new ground since dawn, looking at the scent line." },
    { "kind": "line", "speaker": "B", "expression": "sad", "text": "We had enough land, {A.name}. Now we have the land and an enemy." },
    { "kind": "line", "speaker": "A", "expression": "neutral", "text": "They were always going to be our enemy." },
    { "kind": "line", "speaker": "B", "expression": "sad", "text": "Maybe. But now they have a reason." }
  ],
  "effects": [],
  "summary": "{B.name} worried that taking the {zone} made the pride an enemy.",
  "fallback": "After the {zone} was taken, {B.name} told {A.name} the pride now had an enemy with a reason."
}
```
