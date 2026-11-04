# Events: Joining an AI Pride as a Member

Owner: Saga. Status: **DRAFT v0.1**, design-only, 2026-11-05.
Rules: formulas-spec v0.1 §3, leader approval **type (b)**: a lone player asks to join as a plain member. It's 1 request per season per pride, at −10 against the mate route. A refusal costs pride relation −5 (`respected` makes it 0). Director: joining is allowed, and joining through a mate stays the easier route.
Format: the JSON event shell (`scene-format.md` §5). A = the player, B = the leader on `ask` and any adult pride cat on `first_day`.

**How this differs from joining through a mate (type a and c):**
- The player comes **alone and asks for work, not for a cat**. Nobody inside speaks for them.
- The leader tests the stranger in the pride's own way:
  - Highcrag: custom and patience.
  - Bonefield: standing your ground.
  - Mistwood: time spent in its range.
- The welcome puts the player **at the bottom**: sung last, eating last, shown the trail.
- No line mentions courting except Highcrag's, which notes that most visitors come courting. Mate-route text stays in the courtship and approval flow.

Flow: `join.<pride>.ask` → `approved` or `refused` (rolled by the rule) → on approval, `join.<pride>.first_day` the next day.


---

## Highcrag

### `join.highcrag.ask`
- **trigger:** formulas §3 type (b), the player asks. · **styles:** story, standard, sim · **mix:** story

```json
{
  "id": "join.highcrag.ask",
  "type": "event",
  "trigger": "formulas.3.leader_approval.b",
  "styles": [
    "story",
    "standard",
    "sim"
  ],
  "mix": "story",
  "version": 1,
  "cast": {
    "A": {
      "slot": "left",
      "who": "player"
    },
    "B": {
      "slot": "right",
      "who": "visitor"
    }
  },
  "requires": {
    "role": {
      "B": [
        "leader"
      ]
    }
  },
  "beats": [
    {
      "kind": "narration",
      "text": "You climb to the foot of the crag alone, and wait as custom says a stranger must, until the leader comes down to you."
    },
    {
      "kind": "line",
      "speaker": "A",
      "expression": "neutral",
      "text": "I have no mate here, and no kin. I ask to hunt for Highcrag, and nothing more."
    },
    {
      "kind": "line",
      "speaker": "B",
      "expression": "neutral",
      "text": "Few ask for that. Most who climb this far come courting. Why should the crag feed a stranger?"
    }
  ],
  "results": {
    "approved": {
      "beats": [
        {
          "kind": "narration",
          "text": "{B.name} looks at you a long time. Then {B.he} turns and starts up the trail, and doesn't tell you to stay behind."
        },
        {
          "kind": "line",
          "speaker": "B",
          "expression": "neutral",
          "text": "You'll hunt, and eat after the pride's own, and learn our names. All of them."
        }
      ],
      "summary": "{B.name} let {A.name} join Highcrag as a member."
    },
    "refused": {
      "beats": [
        {
          "kind": "narration",
          "text": "{B.name} doesn't move from the trail."
        },
        {
          "kind": "line",
          "speaker": "B",
          "expression": "neutral",
          "text": "The crag doesn't take strays. Come back when the stones know your scent."
        }
      ],
      "summary": "{B.name} refused {A.name} a place in Highcrag."
    }
  },
  "effects": [],
  "summary": "{A.name} asked {B.name} to join Highcrag as a member.",
  "fallback": "{A.name} came alone to Highcrag and asked {B.name} for a place in the pride, with no mate to speak for {A.him}."
}
```

### `join.highcrag.first_day`
- **trigger:** the day after an approved `ask`. · **styles:** story, standard, sim · **mix:** story

```json
{
  "id": "join.highcrag.first_day",
  "type": "event",
  "trigger": "join.member.first_day",
  "styles": [
    "story",
    "standard",
    "sim"
  ],
  "mix": "story",
  "version": 1,
  "cast": {
    "A": {
      "slot": "left",
      "who": "player"
    },
    "B": {
      "slot": "right",
      "who": "pride"
    }
  },
  "beats": [
    {
      "kind": "narration",
      "text": "At dusk the pride gathers for the night song. When it ends, one more name is spoken, last and quietly: yours."
    },
    {
      "kind": "line",
      "speaker": "B",
      "expression": "neutral",
      "text": "Don't take it hard, being last. Everyone starts there. Even the leaders did."
    }
  ],
  "effects": [],
  "summary": "{A.name}'s name was sung in Highcrag's night song for the first time.",
  "fallback": "On {A.name}'s first night in Highcrag, the pride sang {A.his} name at the end of the night song."
}
```


---

## Bonefield

### `join.bonefield.ask`
- **trigger:** formulas §3 type (b), the player asks. · **styles:** story, standard, sim · **mix:** story

```json
{
  "id": "join.bonefield.ask",
  "type": "event",
  "trigger": "formulas.3.leader_approval.b",
  "styles": [
    "story",
    "standard",
    "sim"
  ],
  "mix": "story",
  "version": 1,
  "cast": {
    "A": {
      "slot": "left",
      "who": "player"
    },
    "B": {
      "slot": "right",
      "who": "visitor"
    }
  },
  "requires": {
    "role": {
      "B": [
        "leader"
      ]
    }
  },
  "beats": [
    {
      "kind": "narration",
      "text": "Three Bonefield cats meet you at the edge of the grass, sabers bared. You don't run. After a while, {B.name} shoulders through them."
    },
    {
      "kind": "line",
      "speaker": "B",
      "expression": "angry",
      "text": "No mate here, no blood here, and you want in? Then what are you good for?"
    },
    {
      "kind": "line",
      "speaker": "A",
      "expression": "neutral",
      "text": "I hunt. I fight. I don't run."
    }
  ],
  "results": {
    "approved": {
      "beats": [
        {
          "kind": "narration",
          "text": "{B.name} walks a slow circle around you, close enough to feel the breath. You hold still."
        },
        {
          "kind": "line",
          "speaker": "B",
          "expression": "happy",
          "text": "You stood your ground. That's the only question we ask. Eat last until you've bled for us."
        }
      ],
      "summary": "{B.name} let {A.name} join Bonefield as a member."
    },
    "refused": {
      "beats": [
        {
          "kind": "narration",
          "text": "{B.name} snorts and turns away before you have finished speaking."
        },
        {
          "kind": "line",
          "speaker": "B",
          "expression": "angry",
          "text": "Strangers who want in prove it in a fight first. You haven't. Go."
        }
      ],
      "summary": "{B.name} refused {A.name} a place in Bonefield."
    }
  },
  "effects": [],
  "summary": "{A.name} asked {B.name} to join Bonefield as a member.",
  "fallback": "{A.name} came alone to Bonefield and asked {B.name} for a place in the pride, with no mate to speak for {A.him}."
}
```

### `join.bonefield.first_day`
- **trigger:** the day after an approved `ask`. · **styles:** story, standard, sim · **mix:** story

```json
{
  "id": "join.bonefield.first_day",
  "type": "event",
  "trigger": "join.member.first_day",
  "styles": [
    "story",
    "standard",
    "sim"
  ],
  "mix": "story",
  "version": 1,
  "cast": {
    "A": {
      "slot": "left",
      "who": "player"
    },
    "B": {
      "slot": "right",
      "who": "pride"
    }
  },
  "beats": [
    {
      "kind": "narration",
      "text": "Your first kill as Bonefield, and you eat last, as told. Someone drops a scrap near your paws anyway."
    },
    {
      "kind": "line",
      "speaker": "B",
      "expression": "happy",
      "text": "Don't tell the others. Tomorrow I'll beat you to the kill."
    }
  ],
  "effects": [],
  "summary": "{B.name} slipped {A.name} a scrap on {A.his} first day in Bonefield.",
  "fallback": "On {A.name}'s first day in Bonefield, {A.he} ate last, and {B.name} slipped {A.him} a scrap anyway."
}
```


---

## Mistwood

### `join.mistwood.ask`
- **trigger:** formulas §3 type (b), the player asks. · **styles:** story, standard, sim · **mix:** story

```json
{
  "id": "join.mistwood.ask",
  "type": "event",
  "trigger": "formulas.3.leader_approval.b",
  "styles": [
    "story",
    "standard",
    "sim"
  ],
  "mix": "story",
  "version": 1,
  "cast": {
    "A": {
      "slot": "left",
      "who": "player"
    },
    "B": {
      "slot": "right",
      "who": "visitor"
    }
  },
  "requires": {
    "role": {
      "B": [
        "leader"
      ]
    }
  },
  "beats": [
    {
      "kind": "narration",
      "text": "You lie down at the edge of the fog and wait. It's a long time before anyone answers, and when {B.name} comes, you don't hear {B.him}."
    },
    {
      "kind": "line",
      "speaker": "B",
      "expression": "neutral",
      "text": "You've been in our range a while. We've watched you. What do you want?"
    },
    {
      "kind": "line",
      "speaker": "A",
      "expression": "neutral",
      "text": "A place to sleep that isn't alone. I'll hunt for it."
    }
  ],
  "results": {
    "approved": {
      "beats": [
        {
          "kind": "narration",
          "text": "{B.name} looks back into the fog, as if asking it something. Then {B.he} steps aside."
        },
        {
          "kind": "line",
          "speaker": "B",
          "expression": "neutral",
          "text": "Walk soft and say little. The fog will get used to you."
        }
      ],
      "summary": "{B.name} let {A.name} join Mistwood as a member."
    },
    "refused": {
      "beats": [
        {
          "kind": "narration",
          "text": "{B.name} doesn't step aside."
        },
        {
          "kind": "line",
          "speaker": "B",
          "expression": "sad",
          "text": "Not yet. The pride doesn't know you. Come back when the fog does."
        }
      ],
      "summary": "{B.name} refused {A.name} a place in Mistwood."
    }
  },
  "effects": [],
  "summary": "{A.name} asked {B.name} to join Mistwood as a member.",
  "fallback": "{A.name} came alone to Mistwood and asked {B.name} for a place in the pride, with no mate to speak for {A.him}."
}
```

### `join.mistwood.first_day`
- **trigger:** the day after an approved `ask`. · **styles:** story, standard, sim · **mix:** story

```json
{
  "id": "join.mistwood.first_day",
  "type": "event",
  "trigger": "join.member.first_day",
  "styles": [
    "story",
    "standard",
    "sim"
  ],
  "mix": "story",
  "version": 1,
  "cast": {
    "A": {
      "slot": "left",
      "who": "player"
    },
    "B": {
      "slot": "right",
      "who": "pride"
    }
  },
  "beats": [
    {
      "kind": "narration",
      "text": "No one says welcome. But that night, when the pride moves dens, someone waits for you where the trail forks."
    },
    {
      "kind": "line",
      "speaker": "B",
      "expression": "neutral",
      "text": "This way. Step where I step. The marsh lies."
    }
  ],
  "effects": [],
  "summary": "{B.name} showed {A.name} the hidden trail on {A.his} first night in Mistwood.",
  "fallback": "On {A.name}'s first night in Mistwood, {B.name} waited at the fork to show {A.him} the way to the new dens."
}
```

