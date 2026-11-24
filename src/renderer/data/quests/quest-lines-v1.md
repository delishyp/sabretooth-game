# Quest lines v1 (Saga, DRAFT for Anna)

Three quest lines for v0.1, built on Tundra's quests spec v0.1.2a (local commit `85b93b1`, with the §3.9 rulings). Each line is a short chain of the spec's five request kinds, built on one premade cat's motive. A line opens once that cat is close to you. Dialogue follows the pass 2 style: plain, spoken to you, with at most one beat per block. Data is in `quest-lines-v1.json`. Check it with `python3 validate_quest_lines.py`.

| Line | Asks | Steps | Special ending |
|---|---|---|---|
| **Past the Ledge**, from the Highcrag nursemaid (`hc06`) | Her cub keeps talking about the meadows below the ledge. | Spend a day at Horse Meadows, then find the cub when she wanders off. | **Cub search.** If you say no, she isn't harmed: her own pride brings her home off-screen. Only if you say yes and the season ends first does she die, and you see her parents mourn. |
| **Somebody Listening**, from a young Bonefield cat nobody listens to (`bf06`) | She's found wolf scent, but nobody in the field listens to her. | Spend a day on the Herd Trail, tell Scarjaw (`bf01`) and no other pride, then bring her a small kill. | **Join ending.** If you told Scarjaw it was her find, she likes you a great deal (a personal value of 75 or more, a proposed default that still needs a sim) and you've founded a pride, she asks to join you. You can still say no. |
| **The Hyena at the Forks**, from a young scarred Mistwood tom (`mw03`) | He wants a hyena gone but his leg gave out against it. | Spend a day at Twin Forks, drive the hyena off, then tell Hollowsong (`mw01`) the forks are safe. | **Branch:** keep his secret about the leg, or tell her. |

Kept lines count as a deed on their own axis: Past the Ledge for Mercy, Somebody Listening for Honour and The Hyena at the Forks for Courage. Each step keeps its usual reputation hooks.

The wolf scent is known only to you until you tell Scarjaw, and then all of Bonefield knows it. Driving off the hyena is public, because a fight is a public event.

## Walk-through: Somebody Listening

The names here come from seed 8, where `bf06` is Rimerain and `bf01` is Galestride.

> Rimerain drops her voice, though nobody from the field is near. There's wolf scent on the Herd Trail. It's fresh, and there's a lot of it. Nobody in the field listens to me, so I haven't told them. Would you spend a day out there? If you smell it too, then I'm not imagining things.
>
> **You:** “I'll go and see if you're right.”
>
> Thank you. Keep downwind. They'll smell you before you see them.

*You spend a day on the Herd Trail and come back.*

> Rimerain is waiting where the trail leaves the field. Well? You smelled them, didn't you? So I wasn't imagining it.
>
> Galestride won't listen to me, but he might listen to you. Will you tell him about the wolves on the Herd Trail? Just him, please. If Highcrag or Mistwood hear it before he does, he'll say we look weak.
>
> **You:** “I'll tell him. Nobody else.”
>
> Good. Don't let him shout you down. He'll try.

*In the Bonefield:*

> Galestride doesn't get up when you come close. You walked into my field to talk to me? Then talk. What is it?
>
> **You:** “There are wolves on the Herd Trail. Rimerain found them, and I've smelled them too.”
>
> Rimerain? She sniffs at grass all day. Still, if you smelled them as well, I'll send the hunters the long way round. Now get out of my field.

*(If you say "I found them myself" instead, he listens, Rimerain stays out of it and later thanks you, and this line can't end with her joining you.)*

> Rimerain catches up with you at the edge of the field, out of breath. You told him it was me. He laughed, I heard him. But you said my name in front of the whole field. Nobody's ever done that.
>
> Will you meet me away from the field? Bring a hare or something, so it looks like we're only sharing a meal. There's something I want to ask you, and I don't want it shouted about.

*You bring her a small kill. Her value toward you is 75 or more, and you have a pride:*

> Rimerain eats a little, then pushes the rest back toward you. Here's what I wanted to ask. You listened to me when my own pride wouldn't. Could I come with you? Live in your pride, I mean. I'd leave Bonefield today.
>
> **You:** “Yes. Come home with me.”
>
> Just like that? All right. I'm not going back for anything. There's nothing there I'd miss.
>
> Rimerain walks out of the Bonefield at your side, and nobody tries to stop her.

She leaves under the usual leaving rule and joins your pride as a member, with no bonus or penalty. If you have no pride yet, she stays home and the line still counts as kept. Afterwards Bonefield hears about it through gossip and holds it against you. That gossip hit is the only cost. Galestride tells you: *You took Rimerain out of my field. She ran, and she ran to you. Don't expect a welcome here.*

## The cub's death (Past the Ledge)

This plays only if you agreed to look for her and the season ends before you find her. If you said no, the hunters bring her home and her mother tells you so. The text is kept plain on purpose:

> You find her at the bottom of the meadow, curled in the grass as if she lay down to sleep. She's cold, and she doesn't stir when you nose her. You carry her up to the crag.
>
> *(Her mother)* Oh. Put her down here, by the den. Gently. At least she's home.
>
> *(Her father)* Where was she? I need to know.

You can tell him where she was, say you're sorry, or lie down beside them without speaking. Then her mother says the keeper will say the cub's name on the longest night with all the others: *She won't be forgotten here.*
