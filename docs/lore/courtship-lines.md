# Courtship lines (Saga)

## courtship_declined_attraction (relationships v0.1.2 §1.8)

The cat isn't interested in the player because of `attraction`, not because of how much it likes them. The refusal is gentle and closes the topic, and it never hints at sex or at the trait itself. There's no relationship loss, so the cat stays warm. A = the declining cat, P = the player cat. The game picks one variant at random. Narration comes first, then A's line.

```json
{
  "courtship_declined_attraction": [
    {
      "narration": "{A.name} touches noses with you, warm and unhurried, then steps back. {A.he} doesn't pretend to be anything {A.he} isn't.",
      "line": "You're good company, {P.name}. Just not that way. Hunt with me at first light?",
      "expression": "happy"
    },
    {
      "narration": "{A.name} listens all the way through, tail curling slowly in the snow.",
      "line": "I'm glad you asked me. But my heart doesn't turn toward you like that. Nothing else between us changes.",
      "expression": "neutral"
    },
    {
      "narration": "{A.name} purrs, low and kind, and leans {A.his} shoulder against yours for a moment.",
      "line": "Not as mates, {P.name}. As kin of the hunt, though, always.",
      "expression": "happy"
    }
  ],
  "summary": "{A.name} gently turned down {P.name}'s courtship."
}
```

## Other courtship gates (formulas-spec v0.1 §2.1)

The same shape and rules as the attraction block above. A = the declining cat, P = the player cat. Each decline is gentle and gives the real reason. None of them costs relationship value (formulas §2.1: a failed gate means no roll and no loss). None assumes the pair's sexes or mentions cubs. The game picks one variant at random.

### courtship_declined_not_adult
The target is a cub or adolescent (relationships §1.6). The UI should never offer Court here (formulas test checklist, item 5), so this is a safety net. It stays about growing up, not romance.

```json
{
  "courtship_declined_not_adult": [
    {
      "narration": "{A.name} blinks up at you, then ducks {A.his} head, ears hot, and scrambles off toward the den.",
      "line": "I'm not grown yet! Ask me to hunt with you instead. I'm getting fast.",
      "expression": "happy"
    },
    {
      "narration": "{A.name} sits very straight, trying to look older than {A.he} is.",
      "line": "I haven't even had my first winter on my own, {P.name}. Teach me to stalk. That I'd like.",
      "expression": "neutral"
    }
  ],
  "summary": "{A.name} is too young, and laughed off {P.name}'s courtship."
}
```

### courtship_declined_kin
The pair is close kin, r ≥ 0.125 (relationships §1.7).

```json
{
  "courtship_declined_kin": [
    {
      "narration": "{A.name} leans in, breathes your scent, and pulls back with a soft, sad sound.",
      "line": "We share blood, {P.name}. I can smell it on you. Kin, yes. Always. Not mates.",
      "expression": "sad"
    },
    {
      "narration": "{A.name} touches noses with you the way family does, and holds it a moment longer.",
      "line": "You're my blood. The pride would say it, and so do I. Hunt beside me, and that's enough.",
      "expression": "neutral"
    },
    {
      "narration": "{A.name} listens all the way through, then shakes {A.his} head slowly.",
      "line": "Our lines are too close. The old ways forbid it, and in this the old ways hold true.",
      "expression": "sad"
    }
  ],
  "summary": "{A.name} turned {P.name} down: they are kin."
}
```

### courtship_declined_mated
The target already has a mate (formulas §2.1).

```json
{
  "courtship_declined_mated": [
    {
      "narration": "{A.name} looks at you kindly, then glances back toward the den, where {A.his} mate is sleeping.",
      "line": "My heart already has a den, {P.name}. I won't leave it. But I'm glad of you all the same.",
      "expression": "neutral"
    },
    {
      "narration": "{A.name} lets the words settle, and doesn't pretend not to understand them.",
      "line": "I'm mated. That's not a door I leave open. Don't ask me again, and we'll stay friends.",
      "expression": "sad"
    }
  ],
  "summary": "{A.name} turned {P.name} down: {A.he} already has a mate."
}
```

### courtship_declined_hostile
The pair value is −15 or lower: Wary or Bad Blood (formulas §2.1).

```json
{
  "courtship_declined_hostile": [
    {
      "narration": "{A.name} doesn't move. Doesn't come closer, either.",
      "line": "After what's passed between us? Mend that first, {P.name}. Then maybe we'll talk.",
      "expression": "angry"
    },
    {
      "narration": "{A.name} looks at you for a long breath, and there's no warmth in it yet.",
      "line": "I don't trust you. Not like this, not yet. Earn that, and ask me in another spring.",
      "expression": "sad"
    },
    {
      "narration": "{A.name} turns {A.his} shoulder to you, not cruelly, just firmly.",
      "line": "You can't court a cat who still flinches at your scent. Start smaller.",
      "expression": "neutral"
    }
  ],
  "summary": "{A.name} turned {P.name} down: there is bad feeling between them."
}
```
