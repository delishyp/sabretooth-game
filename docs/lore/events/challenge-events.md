# Events: Leadership Challenges

Owner: Saga. Status: **DRAFT v0.1**, design-only, 2026-11-05.
Rules: formulas-spec v0.1 §4.2 (1-v-1, each side ±20%), §4.3 (injury; death only for the loser, Story 0%), §4.4 (leadership challenge). Director: a loser **leaves Bonefield**; in **Highcrag and Mistwood** the loser stays and takes prideLoyalty −20 for 1 season. relationships-spec §5.4 (who challenges; `leader_doubt` comes first). Nothing here adds a number. The rule resolves the fight, and these events are the text over it.
Format: the JSON event shell (`scene-format.md` §5; first used in `perk-events.md`).

**Cast:** A = the **winner**, B = the **loser**. `results` picks the branch:
- `challenger_won`: B was the leader and lost the role.
- `leader_held`: B was the challenger.

**Which event fires:**
- `.player_lost`: the player is B. The player's role comes from the result.
- `.player_won`: the player is A.
- `.world`: two AI cats fight. It's shown when the player is nearby or at the next contact with that pride, otherwise it's a log line only.

**After the fight:**
- In Bonefield, an AI loser becomes a loner. That's `exile.*.exiled.challenge` in `exile-event.md`, so don't fire both openers on the same day.
- A player who loses in Bonefield leaves the pride, and the run goes on as a loner. Whether a player who was the founder of their own pride can be challenged this way is a question for Tundra.
- If the loser dies (Standard and Sim only), add `challenge.fallen` after the branch. A player's death then follows the run's Death rule (main-menu §7).
- Loyalty loss and exile are rule effects (formulas §4.4), not menu effects, so `effects` stays empty.


---

## Bonefield

### `challenge.bonefield.player_lost`
- **when:** player lost (exiled). · **styles:** story, standard, sim · **mix:** threat

```json
{
  "id": "challenge.bonefield.player_lost",
  "type": "event",
  "trigger": "formulas.4.4.leadership_challenge",
  "styles": [
    "story",
    "standard",
    "sim"
  ],
  "mix": "threat",
  "version": 1,
  "cast": {
    "A": {
      "slot": "left",
      "who": "pride"
    },
    "B": {
      "slot": "right",
      "who": "player"
    }
  },
  "beats": [
    {
      "kind": "narration",
      "text": "The pride makes a ring in the trampled grass. There's no more talking now. There is only the law of the grass."
    }
  ],
  "results": {
    "challenger_won": {
      "beats": [
        {
          "kind": "narration",
          "text": "{A.name} stands over you, breathing hard. You were leader at dawn. By the law, you are nothing here by dusk."
        },
        {
          "kind": "line",
          "speaker": "A",
          "expression": "angry",
          "text": "The law is short, {B.name}. Go."
        },
        {
          "kind": "narration",
          "text": "The pride opens a path. It leads one way: out."
        }
      ],
      "summary": "{A.name} took Bonefield from {B.name}, who was driven out."
    },
    "leader_held": {
      "beats": [
        {
          "kind": "narration",
          "text": "{A.name} pins you in the trampled grass until you stop struggling."
        },
        {
          "kind": "line",
          "speaker": "A",
          "expression": "neutral",
          "text": "You asked the grass. The grass answered. Walk."
        },
        {
          "kind": "narration",
          "text": "The pride opens a path. It leads one way: out."
        }
      ],
      "summary": "{B.name} challenged {A.name} and lost, and was driven out of Bonefield."
    }
  },
  "effects": [],
  "summary": "{B.name} lost a leadership fight to {A.name} in Bonefield.",
  "fallback": "{B.name} fought {A.name} for the leadership of Bonefield and lost. Under the law of the grass, the loser left."
}
```

### `challenge.bonefield.player_won`
- **when:** player won (AI loser exiled). · **styles:** story, standard, sim · **mix:** threat

```json
{
  "id": "challenge.bonefield.player_won",
  "type": "event",
  "trigger": "formulas.4.4.leadership_challenge",
  "styles": [
    "story",
    "standard",
    "sim"
  ],
  "mix": "threat",
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
      "text": "The pride makes a ring in the trampled grass. Every cat in Bonefield is watching, and none of them makes a sound."
    }
  ],
  "results": {
    "challenger_won": {
      "beats": [
        {
          "kind": "narration",
          "text": "{B.name} lies in the grass. The pride looks from {B.him} to you, and one by one they lower their heads."
        },
        {
          "kind": "line",
          "speaker": "B",
          "expression": "angry",
          "text": "Enjoy it. The grass remembers every leader it ever had."
        },
        {
          "kind": "narration",
          "text": "By the law, {B.name} must leave. The pride opens a path, and {B.he} takes it."
        }
      ],
      "summary": "{A.name} won Bonefield's leadership, and {B.name} was driven out."
    },
    "leader_held": {
      "beats": [
        {
          "kind": "narration",
          "text": "{B.name} came at you in front of everyone, and now lies in the grass at your feet."
        },
        {
          "kind": "line",
          "speaker": "B",
          "expression": "sad",
          "text": "I knew the law when I started this."
        },
        {
          "kind": "narration",
          "text": "The pride opens a path. {B.name} gets up slowly and takes it."
        }
      ],
      "summary": "{B.name} challenged {A.name} for Bonefield, lost, and was driven out."
    }
  },
  "effects": [],
  "summary": "{A.name} won a leadership fight against {B.name} in Bonefield.",
  "fallback": "{A.name} fought {B.name} for the leadership of Bonefield and won. Under the law of the grass, {B.name} left."
}
```

### `challenge.bonefield.world`
- **when:** AI vs AI (world). · **styles:** story, standard, sim · **mix:** story

```json
{
  "id": "challenge.bonefield.world",
  "type": "event",
  "trigger": "formulas.4.4.leadership_challenge",
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
      "who": "visitor"
    },
    "B": {
      "slot": "right",
      "who": "visitor"
    }
  },
  "beats": [
    {
      "kind": "narration",
      "text": "Roaring rolls out of the Bonefield all morning, then stops."
    }
  ],
  "results": {
    "challenger_won": {
      "beats": [
        {
          "kind": "narration",
          "text": "{A.name} stands where the leader stood. {B.name} is already walking for the border, and nobody follows."
        }
      ],
      "summary": "{A.name} took Bonefield from {B.name}, who was driven out."
    },
    "leader_held": {
      "beats": [
        {
          "kind": "narration",
          "text": "{A.name} still leads. By noon {B.name}'s scent runs out of the Bonefield and doesn't come back."
        }
      ],
      "summary": "{B.name} challenged {A.name} for Bonefield, lost, and was driven out."
    }
  },
  "effects": [],
  "summary": "Bonefield had a leadership fight between {A.name} and {B.name}.",
  "fallback": "{A.name} and {B.name} fought for Bonefield's leadership. The loser was driven out under the law of the grass."
}
```


---

## Highcrag

### `challenge.highcrag.player_lost`
- **when:** player lost (loyalty loss). · **styles:** story, standard, sim · **mix:** threat

```json
{
  "id": "challenge.highcrag.player_lost",
  "type": "event",
  "trigger": "formulas.4.4.leadership_challenge",
  "styles": [
    "story",
    "standard",
    "sim"
  ],
  "mix": "threat",
  "version": 1,
  "cast": {
    "A": {
      "slot": "left",
      "who": "pride"
    },
    "B": {
      "slot": "right",
      "who": "player"
    }
  },
  "beats": [
    {
      "kind": "narration",
      "text": "Highcrag doesn't fight in haste. The pride gathers on the ledge in silence, and the two of you circle under the old stones."
    }
  ],
  "results": {
    "challenger_won": {
      "beats": [
        {
          "kind": "narration",
          "text": "{A.name} takes the high ledge. You are still Highcrag, but tonight your name is sung last, and quietly."
        },
        {
          "kind": "line",
          "speaker": "A",
          "expression": "neutral",
          "text": "Stay. The crag doesn't throw its cats away. But it remembers."
        }
      ],
      "summary": "{A.name} won the high ledge from {B.name}, who stays, shamed."
    },
    "leader_held": {
      "beats": [
        {
          "kind": "narration",
          "text": "{A.name} turns you with one heavy blow and stands over you until you look away."
        },
        {
          "kind": "line",
          "speaker": "A",
          "expression": "neutral",
          "text": "You'll stay, and you'll eat last this season. That is our way."
        }
      ],
      "summary": "{B.name} challenged {A.name} and lost, and eats last this season."
    }
  },
  "effects": [],
  "summary": "{B.name} lost a leadership fight to {A.name} on the crag.",
  "fallback": "{B.name} fought {A.name} for the high ledge and lost. Highcrag kept {B.him}, but sang {B.his} name last that season."
}
```

### `challenge.highcrag.player_won`
- **when:** player won (AI loser shamed). · **styles:** story, standard, sim · **mix:** threat

```json
{
  "id": "challenge.highcrag.player_won",
  "type": "event",
  "trigger": "formulas.4.4.leadership_challenge",
  "styles": [
    "story",
    "standard",
    "sim"
  ],
  "mix": "threat",
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
      "text": "The pride gathers on the ledge in silence. Highcrag watches a challenge the way it does everything: slowly, and remembering."
    }
  ],
  "results": {
    "challenger_won": {
      "beats": [
        {
          "kind": "narration",
          "text": "{B.name} steps down from the high ledge without a word. The pride waits for you to climb it."
        },
        {
          "kind": "line",
          "speaker": "B",
          "expression": "sad",
          "text": "Lead slowly. The crag punishes haste."
        }
      ],
      "summary": "{A.name} took the high ledge from {B.name}."
    },
    "leader_held": {
      "beats": [
        {
          "kind": "narration",
          "text": "{B.name} lies on the cold stone at your feet. No one helps {B.him} up. That's the crag's way too."
        },
        {
          "kind": "line",
          "speaker": "B",
          "expression": "sad",
          "text": "I'll stay. I'll be sung last. Don't think I'll forget."
        }
      ],
      "summary": "{B.name} challenged {A.name} and lost, and is shamed this season."
    }
  },
  "effects": [],
  "summary": "{A.name} won a leadership fight against {B.name} on the crag.",
  "fallback": "{A.name} fought {B.name} for the high ledge and won. {B.name} stayed in Highcrag, shamed for a season."
}
```

### `challenge.highcrag.world`
- **when:** AI vs AI (world). · **styles:** story, standard, sim · **mix:** story

```json
{
  "id": "challenge.highcrag.world",
  "type": "event",
  "trigger": "formulas.4.4.leadership_challenge",
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
      "who": "visitor"
    },
    "B": {
      "slot": "right",
      "who": "visitor"
    }
  },
  "beats": [
    {
      "kind": "narration",
      "text": "Word comes down from the crag: there was a challenge on the high ledge."
    }
  ],
  "results": {
    "challenger_won": {
      "beats": [
        {
          "kind": "narration",
          "text": "{A.name} holds the high ledge now, and {B.name}'s name has slipped to the end of the night song."
        }
      ],
      "summary": "{A.name} took the high ledge from {B.name}, who stays, shamed."
    },
    "leader_held": {
      "beats": [
        {
          "kind": "narration",
          "text": "{A.name} still holds the high ledge. {B.name} eats last this season, and everyone knows why."
        }
      ],
      "summary": "{B.name} challenged {A.name} for Highcrag and lost."
    }
  },
  "effects": [],
  "summary": "Highcrag had a leadership fight between {A.name} and {B.name}.",
  "fallback": "{A.name} and {B.name} fought for the high ledge. The loser stayed in Highcrag, sung last for a season."
}
```


---

## Mistwood

### `challenge.mistwood.player_lost`
- **when:** player lost (loyalty loss). · **styles:** story, standard, sim · **mix:** threat

```json
{
  "id": "challenge.mistwood.player_lost",
  "type": "event",
  "trigger": "formulas.4.4.leadership_challenge",
  "styles": [
    "story",
    "standard",
    "sim"
  ],
  "mix": "threat",
  "version": 1,
  "cast": {
    "A": {
      "slot": "left",
      "who": "pride"
    },
    "B": {
      "slot": "right",
      "who": "player"
    }
  },
  "beats": [
    {
      "kind": "narration",
      "text": "There's no roaring in the Mistwood. The pride slips back into the fog to give you room. You hear only breath and claws."
    }
  ],
  "results": {
    "challenger_won": {
      "beats": [
        {
          "kind": "narration",
          "text": "{A.name} leads now. You are still Mistwood, but for a season you walk at the back of the line, and few walk beside you."
        },
        {
          "kind": "line",
          "speaker": "A",
          "expression": "sad",
          "text": "Don't go. We've lost enough cats to the fog."
        }
      ],
      "summary": "{A.name} took Mistwood's lead from {B.name}, who walks apart."
    },
    "leader_held": {
      "beats": [
        {
          "kind": "narration",
          "text": "{A.name} pins you in the wet moss and holds you there, gently, until you go still."
        },
        {
          "kind": "line",
          "speaker": "A",
          "expression": "neutral",
          "text": "Walk apart a while. Then come back to us."
        }
      ],
      "summary": "{B.name} challenged {A.name} and lost, and walks apart this season."
    }
  },
  "effects": [],
  "summary": "{B.name} lost a leadership fight to {A.name} in the Mistwood.",
  "fallback": "{B.name} fought {A.name} for Mistwood's lead and lost, and walked apart from the pride for a season."
}
```

### `challenge.mistwood.player_won`
- **when:** player won (AI loser walks apart). · **styles:** story, standard, sim · **mix:** threat

```json
{
  "id": "challenge.mistwood.player_won",
  "type": "event",
  "trigger": "formulas.4.4.leadership_challenge",
  "styles": [
    "story",
    "standard",
    "sim"
  ],
  "mix": "threat",
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
      "text": "The fog cats draw back among the pines. Nobody roars. Nobody looks away, either."
    }
  ],
  "results": {
    "challenger_won": {
      "beats": [
        {
          "kind": "narration",
          "text": "{B.name} lowers {B.his} head to you and steps back into the fog. Mistwood follows you now."
        },
        {
          "kind": "line",
          "speaker": "B",
          "expression": "sad",
          "text": "Keep them together. That's all I ever tried to do."
        }
      ],
      "summary": "{A.name} took Mistwood's lead from {B.name}."
    },
    "leader_held": {
      "beats": [
        {
          "kind": "narration",
          "text": "{B.name} lies still in the moss. When {B.he} rises, {B.he} goes to the back of the line without being told."
        },
        {
          "kind": "line",
          "speaker": "B",
          "expression": "sad",
          "text": "I had to try. I'll walk apart until the season turns."
        }
      ],
      "summary": "{B.name} challenged {A.name} and lost, and walks apart this season."
    }
  },
  "effects": [],
  "summary": "{A.name} won a leadership fight against {B.name} in the Mistwood.",
  "fallback": "{A.name} fought {B.name} for Mistwood's lead and won. {B.name} stayed, walking apart for a season."
}
```

### `challenge.mistwood.world`
- **when:** AI vs AI (world). · **styles:** story, standard, sim · **mix:** story

```json
{
  "id": "challenge.mistwood.world",
  "type": "event",
  "trigger": "formulas.4.4.leadership_challenge",
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
      "who": "visitor"
    },
    "B": {
      "slot": "right",
      "who": "visitor"
    }
  },
  "beats": [
    {
      "kind": "narration",
      "text": "Something happened in the Mistwood. The fog cats won't say what, but you can smell blood on the trail."
    }
  ],
  "results": {
    "challenger_won": {
      "beats": [
        {
          "kind": "narration",
          "text": "Mistwood has a new leader, {A.name}. {B.name} walks at the back of the line now, and few walk beside {B.him}."
        }
      ],
      "summary": "{A.name} took Mistwood's lead from {B.name}, who walks apart."
    },
    "leader_held": {
      "beats": [
        {
          "kind": "narration",
          "text": "{A.name} still leads the fog cats. {B.name} walks apart, and Mistwood says nothing about it."
        }
      ],
      "summary": "{B.name} challenged {A.name} for Mistwood and lost."
    }
  },
  "effects": [],
  "summary": "Mistwood had a leadership fight between {A.name} and {B.name}.",
  "fallback": "{A.name} and {B.name} fought for Mistwood's lead. The loser stayed, walking apart from the pride for a season."
}
```


---

## All prides

### `challenge.fallen`
- **when:** loser dies (Standard, Sim). · **styles:** standard, sim · **mix:** threat

```json
{
  "id": "challenge.fallen",
  "type": "event",
  "trigger": "formulas.4.4.leadership_challenge",
  "styles": [
    "standard",
    "sim"
  ],
  "mix": "threat",
  "version": 1,
  "cast": {
    "A": {
      "slot": "left",
      "who": "any"
    },
    "B": {
      "slot": "right",
      "who": "any"
    }
  },
  "beats": [
    {
      "kind": "narration",
      "text": "{B.name} does not get up. The pride stays beside {B.him} until the cold comes in."
    }
  ],
  "effects": [],
  "summary": "{B.name} died fighting {A.name} for the leadership.",
  "fallback": "{B.name} was killed in a leadership fight with {A.name}."
}
```

