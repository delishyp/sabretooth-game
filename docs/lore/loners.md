# Loners of Greywater Vale

Owner: Saga (narrative and lore). Status: **DRAFT v0.1**, design-only. Not in the build.
Data version: `docs/lore/loners.json` (same nine cats; keep the two in sync).
Rules: **Tundra, `docs/loners-spec.md` v0.5** (bands: §5b; rulings: §10) and `docs/play-styles-spec.md` v0.2. Looks: `docs/genetics-spec.md` v0.1. This doc gives story only. Where it disagrees with the spec, the spec wins.

## How the rules apply (summary of the spec, not new rules)
- **Origins (§1.2):** 2 from Highcrag, 3 from Bonefield, 4 from Mistwood. Mix is 5 male / 4 female; 2 young adult, 5 adult, 2 elder (§1.3).
- **Departure (§1.2, §2.5):** `left`, `exiled`, or `survivor`. Starting pride affinity toward the origin pride is −30 if exiled, 0 if left, and +10 if survivor. At −30 or lower, a loner avoids that pride's land.
- **Range (§2.1):** 1–2 home zones in neutral or border land. Draft zone ids are in `world-and-prides.md` §1.
- **Trust, recruitment, mates (§2.4, §3, §4):** affinity starts at 0, shifted by sociability and aggression. Recruiting needs affinity ≥ 40. Recruiting an exile costs −15 relation with their origin pride, and a cat who left costs −5. A survivor costs nothing. Any loner can be courted as a mate.
- **Range ids:** every loner's home zones are listed as `homeZones` in `loners.json`.
- **Appearance (genetics-spec §1, §2.4):** every look uses only the gene loci (base coat, dilution, marking type, dorsal stripe, intensity, white pattern, eyes, heterochromia, saber tint) plus scars. Lineart is fixed, so there are no shape changes, body-size differences, or broken sabers. `loners.json` lists each cat's traits under `looks`.
- **New exiles (§6.2, §10.2):** the player sees an exile live if nearby, or hears a rumor soon after. See `events/exile-event.md`.
- **Rivals (§5):** only a loner with aggression ≥ 70 *and* affinity ≤ −20 is a rival. Below 70 aggression, a loner is never a threat.

Each cat's **Narrative leaning** line says how the story imagines them against those rules: how hard trust should feel, and whether they could plausibly become a rival. Trait levels in brackets (for example "aggression: high") are **suggestions for Tundra**, who owns the actual numbers.

---

## From Highcrag (2)

### 1. Greymantle
- **Origin:** Highcrag · **Sex:** male · **Age:** elder · **Departure:** exiled (unjustly)
- **Appearance:** a plain grey-dun tom greying at the muzzle and brow, with amber eyes, dark-stained sabers, and a deep old scar across both forelegs.
- **Traits:** patient, proud, quietly bitter.
- **Why he left:** Greymantle was Ashmane's counselor for many winters, the cat who knew every name in the night recitation. Two springs ago a cub fell from the high ledge while in the care of Ashmane's son, Stonebrow. Greymantle was the only other cat there. Ashmane named him careless and exiled him before the pride could ask questions. He went without a word, because a word would have shamed the crag.
- **Toward Highcrag:** he still loves the crag and hates what its leader did. He would never harm a Highcrag cat.
- **Range:** the Split Rock and the lower slope of the Ice Wall, where he can see the crag.
- **Secret / hook:** he knows Stonebrow let the cub fall, and that Ashmane knows it too. He also carried a Bonefield cub into Highcrag years ago (see Nettle).
- **Sample line:** "They have taken my name out of the song. The stones still remember it."
- **Narrative leaning:** slow but steady to win over; respects courtesy and patience. Not a rival (aggression: low). Recruiting him angers Highcrag (exile penalty), which fits the story.

### 2. Sorrel
- **Origin:** Highcrag · **Sex:** female · **Age:** young adult · **Departure:** left (forbidden mate)
- **Appearance:** a red-gold russet queen, plain-coated except for a dark stripe down her spine, with amber eyes and bright ivory sabers.
- **Traits:** warm, headstrong, hopeful.
- **Why she left:** Sorrel fell for Redthroat, a young Bonefield hunter she met at Greywater Ford. Highcrag custom forbids mates from outside the pride. Ashmane refused her, and so did her mother. Sorrel left on the first warm night of summer, expecting Redthroat to meet her at the Split Rock. He has not come yet.
- **Toward Highcrag:** homesick and angry in turns. She misses her mother and the dry caves, not the law.
- **Range:** Greywater Ford and the Split Rock.
- **Secret / hook:** Redthroat's silence has a reason she doesn't know; Scarjaw may have forbidden him, or worse.
- **Sample line:** "I'm not waiting for him. I just happen to like this rock."
- **Narrative leaning:** easy to win over (sociability: high). Never a rival (aggression: low). A natural courtship candidate, and a romantic rival to the player if they court Redthroat.

---

## From Bonefield (3)

### 3. Torncheek
- **Origin:** Bonefield · **Sex:** male · **Age:** adult · **Departure:** exiled (failed challenge)
- **Appearance:** a sandy tom with faint spots, gold eyes that don't blink much, a cheek torn open to the root of one saber, and forelegs crossed with scars.
- **Traits:** ambitious, ruthless, proud.
- **Why he left:** Torncheek challenged Scarjaw for leadership last autumn and nearly won. Scarjaw drove his face into a mammoth jawbone, tore his cheek open to the saber root, and pinned him. The pride named him for the wound. Under Bonefield law the loser leaves. He went, but he has never accepted it.
- **Toward Bonefield:** loves the pride, hates its leader, and means to take it back.
- **Range:** the Tar Seeps and the Bear's Throat, just outside Bonefield land, where trapped prey and the bear's leavings give him easy meals.
- **Secret / hook:** he watches Scarjaw age and counts the seasons. He would use any ally, including the player, to get close enough for a second challenge. (Spec §5.2 says rivals never challenge for leadership; if Tundra keeps that, this stays a story he tells, not a mechanic.)
- **Sample line:** "He gave me this face. Ask him what I'll give him back by spring."
- **Narrative leaning:** hard to win over; respects only strength. Likely rival (aggression: high, sociability: low). If affinity sinks to −20, he steals kills and stalks the player's cats.

### 4. Nettle
- **Origin:** Bonefield · **Sex:** female · **Age:** adult · **Departure:** left (refused an order)
- **Appearance:** a tawny queen with bold dark brindle stripes, a white blaze, copper eyes, ivory sabers, and a scarred right ear.
- **Traits:** fierce, loyal, secretive.
- **Why she left:** when Scarjaw won Bonefield from old Tallgrass, the law let him kill Tallgrass's cubs. Nettle was told to bring them to him. She brought him two. The third she carried to the Split Rock at night, where an old Highcrag tom took it in. She left Bonefield the next season, saying only that she was tired of the noise.
- **Toward Bonefield:** grief and disgust. She still has friends there and would not see them hurt.
- **Range:** the Bear's Throat and the Split Rock. She is not afraid of the bear.
- **Secret / hook:** the cub lived. He is Thistle, now a young Highcrag cat, and he is Tallgrass's son, with a blood claim to Bonefield.
- **Sample line:** "I've killed for that pride. I won't kill cubs for it."
- **Narrative leaning:** guarded at first, then very loyal once trust is earned. Fierce, but no rival unless the player gives her reason (aggression: high, sociability: medium). Gentleness with cubs should win her faster than kills.

### 5. Duskrunner
- **Origin:** Bonefield · **Sex:** male · **Age:** young adult · **Departure:** left (wanderlust)
- **Appearance:** a tawny tom with faint dark spots, white socks, bright green eyes, ivory sabers, and an old scar across his bobtail.
- **Traits:** curious, restless, cheerful.
- **Why he left:** Duskrunner never liked the training fights. After his half-brother Torncheek was driven out, he decided Bonefield had nothing he wanted and walked north to see what was beyond the Ice Wall. He comes back down the Vale whenever the hunting gets thin.
- **Toward Bonefield:** no hatred, no longing. "Too loud."
- **Range:** the foot of the Ice Wall and the Split Rock.
- **Secret / hook:** he has found a pass through the ice. On the far side he saw lanky cats with curved teeth, and they saw him.
- **Sample line:** "Have you ever been past the ice? No? Neither has anyone. Except me."
- **Narrative leaning:** very easy to befriend (sociability: high). Never a rival (aggression: low). Hard to keep: the story should let him wander off even after he likes you.

---

## From Mistwood (4)

### 6. Lichen
- **Origin:** Mistwood · **Sex:** female · **Age:** elder · **Departure:** survivor (the Breaking)
- **Appearance:** a pale grey-dun queen with bold stripes like old bark, greying at the muzzle, with amber eyes, stained sabers, and a scar across her left eye, which barely sees now.
- **Traits:** wise, gentle, stubborn.
- **Why she left:** the river took her during the Breaking and dropped her far downstream, half-drowned, near the Tar Seeps. She is too frail now to cross the marsh back home, and too proud to ask to be carried. Mistwood believes she is dead.
- **Toward Mistwood:** loves them still. She wants them to know she lived, and she wants them to know the truth.
- **Range:** the Tar Seeps and the southern shore of the Drowned Mere.
- **Secret / hook:** she warned Longshadow that the ice was rotten. She also found Sedge's last cub on the shore after the flood and buried it.
- **Sample line:** "The ice told me. It always tells you. Most cats don't listen."
- **Narrative leaning:** warm and quick to trust (sociability: high). Never a rival (aggression: low). If she is past fertile age, she joins as a non-breeder (§3.1). Recruiting her costs nothing with Mistwood, and may even comfort them.

### 7. Ashfall
- **Origin:** Mistwood · **Sex:** male · **Age:** adult · **Departure:** exiled (theft from the starving)
- **Appearance:** a black (melanistic) tom whose ghost rosettes show darker than his coat in low light, with a scarred muzzle, cream-yellow sabers, and tired gold eyes.
- **Traits:** guilt-ridden, careful, kind in secret.
- **Why he left:** in the hungry season after the Breaking, Hollowsong kept every kill for the nursing queens and cubs. Ashfall was caught dragging a goose away from the cubs' share. He would not say why. Hollowsong drove him out, and the pride agreed. It was a real crime, and he has never denied it.
- **Toward Mistwood:** shame. He avoids their land and won't speak their names.
- **Range:** the edge of the Ash Hills and the Bear's Throat. He lives where no cat wants to.
- **Secret / hook:** the goose was for his mate, Reedsong, who was hurt in the Breaking and hidden from the pride so she wouldn't be left behind. She died anyway. No one in Mistwood knows she lived that long.
- **Sample line:** "I did what they said I did. Don't make me into anything better."
- **Narrative leaning:** slow to trust and quick to retreat (sociability: low). Not a rival (aggression: medium). Once won over, steady. Recruiting him costs relation with Mistwood (exile penalty).

### 8. Sedge
- **Origin:** Mistwood · **Sex:** female · **Age:** adult · **Departure:** left (grief)
- **Appearance:** a sandy queen with faint thin stripes, a scar that splits her lip beside one saber, ivory sabers, and pale blue eyes.
- **Traits:** sorrowful, watchful, quietly dangerous.
- **Why she left:** Sedge lost her mate, Rushwater, and both her cubs in the Breaking. She could not bear the dens where they had slept. She left in summer and walks the river looking for them.
- **Toward Mistwood:** she doesn't blame them. She just can't go back.
- **Range:** the shore of the Drowned Mere.
- **Secret / hook:** she believes one cub lived and was carried off by wolves. She is wrong, and Lichen knows.
- **Sample line:** "The river took them. It's going to give something back."
- **Narrative leaning:** distant at first, then deeply attached (sociability: medium). Not a rival (aggression: medium). Player kindness to cubs should matter to her more than anything.

### 9. Coldwater
- **Origin:** Mistwood · **Sex:** male · **Age:** adult · **Departure:** survivor (the Breaking)
- **Appearance:** a plain blue-grey tom (dilute grey-dun) with amber eyes, ivory sabers, a long scar where the ice opened his flank, and another on his left hind leg, which is still stiff.
- **Traits:** loyal, haunted, earnest.
- **Why he left:** the Breaking left Coldwater stranded on the far bank of the Mere with a torn leg. By the time he healed enough to walk the long way round, Hollowsong had led the pride to new dens he couldn't find. He wanders the marsh edge looking for their scent.
- **Toward Mistwood:** he wants to go home more than anything.
- **Range:** the north shore of the Drowned Mere and the Split Rock, where every pride's scent passes.
- **Secret / hook:** on the ice he turned back instead of reaching for Longshadow. Longshadow was Rushwater's father, and Coldwater was Rushwater's brother. He thinks Sedge would never forgive him.
- **Sample line:** "If you smell them, any of them, tell me which way."
- **Narrative leaning:** easy to befriend (sociability: high). Never a rival (aggression: low). The cat most likely to rejoin Mistwood by world drift; the player helping him home could be a story in itself.

---

## Narrative relationships

- **Greymantle and Nettle:** they share the secret of Thistle. Neither has told anyone. If one trusts the player, the other is easier to reach.
- **Thistle (Highcrag, roster TBD):** Tallgrass's surviving son. If Torncheek learns of him, he becomes a tool or a threat. If Scarjaw learns, Thistle is in danger.
- **Greymantle, Ashmane, and Stonebrow (Highcrag):** the truth about the fallen cub could shake Highcrag's leadership.
- **Sorrel and Redthroat (Bonefield, roster TBD):** an unfinished love. Redthroat may be held back by Scarjaw, or may have chosen rank over her.
- **Sorrel and Duskrunner:** both young, both at the Split Rock. A friendship that could become more, and a complication for Redthroat.
- **Torncheek and Duskrunner:** half-brothers. Duskrunner loves him and won't follow him.
- **Torncheek and Scarjaw (Bonefield):** the open wound of the Vale. Torncheek wants a second challenge.
- **Lichen and Sedge:** Lichen buried Sedge's cub. Telling her would end Sedge's search, and maybe break her.
- **Coldwater and Sedge:** in-laws. Coldwater's guilt over the ice keeps him away from her.
- **Ashfall and Hollowsong (Mistwood):** she exiled him. If Reedsong's story comes out, Mistwood might call him back.
- **Lichen and Longshadow:** she warned him. The pride doesn't know that the Breaking was a choice.

## Bachelor bands

Rules: `loners-spec.md` v0.5 §5b (who can band, how often, strength, challenges, cohesion, breakup) and §10.1, §10.3, §10.5, §10.6. Challenge frequency also scales by Style (`play-styles-spec.md` §2.10). This section is story only.

### What a band is, in the Vale's words
The prides have a word for it: a **wandering**. Two or three toms with no pride, no den, and no cubs, who hunt together because alone they are only meat for the wolves. Bonefield calls them "the hungry ones" and fears them more than it admits. Highcrag pretends they do not exist. Mistwood, after the Breaking, has reason to watch for them.

A wandering is not a pride. It holds no land, keeps no den, and sings no names. It is a bargain between cats who need each other for a while.

### How a band forms (story beats for §5b.2)
- **Shared ground:** two lone toms keep crossing the same ground (a shared home zone). At first they warn each other off.
- **A hunt neither could make alone:** a bison bogged in the Tar Seeps, a horse at the Ford, a carcass the bear wants. They take it together.
- **The first shared night:** they sleep within sight of each other. After that, the Vale treats them as one thing.
- Female loners never join a wandering (§5b.1). In the story, they see bands as trouble with long teeth.

### How a band breaks up (story beats for §5b.6)
- **Hunger and failure:** missed hunts and lost fights wear the bargain thin until one cat walks off in the night.
- **One wants more than the other:** one wants a pride, the other only wants to eat.
- **A member dies or leaves**, and one tom alone is no band.
- **Victory:** a band that wins a pride's queens (a `mates` win) stops being a band. The bargain is finished; they are pride cats now.
- **No reason at all:** sometimes cats just part (the random breakup roll).

### Who would plausibly band together
Young-adult and adult male loners can band (§5b.1, §10.1). Of our nine, that is Torncheek, Ashfall, Coldwater, and Duskrunner. Greymantle is an elder and stays solitary.

| Band (draft name) | Members | Shared zone | Why it works | Why it breaks |
|---|---|---|---|---|
| **The Broken Wandering** | Torncheek + Ashfall | `bears_throat` | Torncheek needs a second fighter to face Scarjaw. Ashfall has nothing left to lose and is good at surviving where others won't. | Ashfall won't hurt cubs and still has a conscience. If Torncheek shows what he plans for Tallgrass's line (Thistle), Ashfall walks. |
| **The Long Way Home** | Coldwater + Duskrunner | `split_rock` | Coldwater's leg makes hunting alone hard; Duskrunner likes company and has no grudges. | Duskrunner always wanders off eventually. Coldwater only wants Mistwood. |
| Possible third member | Torncheek + Duskrunner | none at start | Half-brothers. Blood pulls them together. | Duskrunner loves him and will not follow him into a war. Very unlikely without a shared zone and a reason. |
| Unlikely | Coldwater + Ashfall | none | Both from Mistwood. | Ashfall avoids Mistwood names, and Coldwater would want to know who stole from the cubs. |

### What each band would fight for
- **The Broken Wandering** targets **Bonefield**. Torncheek wants Scarjaw's pride. A `mates` challenge on Bonefield is the closest the rules let him come to the second challenge he dreams of. Spec §5b.4 picks `mates` only if the resident males are elders or injured, so the story waits for Scarjaw to weaken.
- **The Long Way Home** would target **Mistwood**, and mostly by accident of the story. Mistwood lost toms in the Breaking. If its surviving males are hurt or old, a `mates` win would bring Coldwater home as a resident male. It would be a homecoming by force, and Sedge would be there.
- Either band could turn on the **player's pride** if it looks weak. That is the threat the player is warned about by scent sign (§5b.4).

### The player and bands
A male player cat can join a band before founding a pride (§5b.7). When he leads a challenge he picks the stake (§10.5). If his band wins a pride's queens before he has founded one, he takes that pride over, and that counts as founding it. A male lured away from the player's pride walks straight into the luring band if it has room (§10.6). The events in `events/band-events.md` cover the invitation, life in the band, quarrels, the takeover, and members following him when he founds a pride.
- **Torncheek** offers the player a place only if he thinks the player is useful against Scarjaw.
- **Coldwater** offers because he is lonely and the player is kind.
- **Duskrunner** offers because he invites everyone.
- **Ashfall** never asks. He just stays nearby.

## Open points for Tundra / Director
- Torncheek's hope of a second challenge sits against spec §5.2 (rivals never challenge). Kept as story only.
- Sedge's belief that wolves took a cub is a story thread only; no mechanic implied.
- Pride-cat names reserved for rosters: Stonebrow, Thistle (Highcrag); Redthroat (Bonefield). Past cats: Tallgrass (Bonefield), Longshadow, Rushwater, Reedsong (Mistwood, dead).
- Draft band names ("the Broken Wandering", "the Long Way Home") are story labels only. In-game band names, if shown, are copy and will come from Saga.
- Draft home zones were changed so no loner lives in claimed land (§2.1): Coldwater's range moved off the Mistwood edge to the Split Rock, and Torncheek's moved from Greywater Ford to the Bear's Throat.
- Brokentooth was renamed **Torncheek**: a snapped saber can't be drawn (genetics-spec §0.3, §2.4), so his wound is now a torn cheek (a scar).
- Scars are written to fit a scar set; Ochre's scar list may not have every one (forelegs, cheek, ear, eye, tail, flank, hind leg). Saga will reword any that aren't in it.
