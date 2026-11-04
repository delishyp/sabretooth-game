# World and Prides

Owner: Saga (narrative and lore). Status: **DRAFT v0.1**, design-only. Not in the build.
Rules and numbers come from Tundra's specs (`docs/loners-spec.md` v0.8, `docs/play-styles-spec.md` v0.2). Where this doc and a spec disagree, the spec wins.
Tone: quiet, cold, ancient, a little mythic. Plain English.

## 1. The valley: Greywater Vale

A long valley cut by a glacier that has not finished leaving. The Ice Wall closes the north end. The Greywater river runs south from its melt, through grass, pine, and marsh, until it slows into the Drowned Mere. Past the Mere the land rises into the Ash Hills, where the wolves are.

The cats have no word for "world". They say "the Vale", and they mean everything.

### Climate
- Winters are long and loud with wind. Snow covers the grass for half the year, and the herds thin out.
- Spring is short and wet. The river floods, the ice on the Mere turns grey and soft, and the herds return with calves.
- Summer is brief and bright, with mosquitoes over the marsh and good hunting everywhere.
- Autumn is the hungry hurry: every hunter fattens for the cold.

### Prey
- **Bison**: the great prize. Hunted in pairs or more; one kill feeds a pride for days.
- **Wild horses**: fast, wary, in bands on the open grass. Best taken by ambush at the river crossings.
- **Ground sloths**: slow, huge, and dangerous at close quarters. Their claws have killed proud hunters.
- **Mammoth calves**: only when one strays. The mothers do not forgive, and they remember.
- **Camels**: on the dry southern slopes in summer.
- Smaller fare when times are lean: deer, hares, geese on the Mere, carrion.

### Threats
- **Dire wolves**: the Ash Hills pack. Many, patient, and bold in winter. They steal kills and run down the weak.
- **Short-faced bears**: tall, long-legged, and always hungry. One lives in the Bear's Throat and takes any carcass it smells.
- **Scimitar cats**: a lanky, long-legged sabretooth kin that hunts in the open and does not speak the pride tongue. Rare visitors from beyond the Ice Wall.
- **Other Smilodon**: rival prides, loners, and challengers. Often the most dangerous of all.
- **The land itself**: the Tar Seeps, thin ice, spring floods, and the cold.

### Landmarks and territories

Zone ids are draft suggestions for Tundra and Flint. Tundra owns the real zone list.

| Draft zone id | Name | Held by | Notes |
|---|---|---|---|
| `ice_wall` | The Ice Wall | Neutral | The glacier face. Meltwater caves, blue light, few prey. Cats say the first sabretooths came out of it. |
| `highcrag` | Highcrag | Highcrag Pride | Cliffs and dry caves above the upper river. Wind-scoured meadows for horses and bison. |
| `bonefield` | The Bonefield | Bonefield Pride | Wide open grassland littered with the bones of old mammoths. The herds pass through every season. |
| `mistwood` | The Mistwood | Mistwood Pride | Pine forest and fog marsh along the lake shore. Narrow trails, deer, geese. |
| `greywater_ford` | Greywater Ford | Border (Highcrag / Bonefield) | A shallow crossing where horses come to drink. Good ambush ground, often fought over. |
| `split_rock` | The Split Rock | Neutral | A cracked boulder the height of ten cats. Old meeting place; scent marks from every pride. |
| `drowned_mere` | The Drowned Mere | Border (Mistwood) | The lake. In winter it freezes; in spring it lies. See "the Breaking" below. |
| `tar_seeps` | The Tar Seeps | Neutral | Black pools that trap the careless. Trapped prey draws every hunter in the Vale, and some do not leave. |
| `bears_throat` | The Bear's Throat | Neutral | A narrow gorge. A short-faced bear dens there. |
| `ash_hills` | The Ash Hills | Dire wolves | Dry southern hills. Wolf country. Camels in summer. |

## 2. The three prides

Locked sizes from `loners-spec.md` v0.8 §1. Every pride started at 13 cats.

| Spec slot | Pride id | Pride | Cats now | Lost to loners |
|---|---|---|---|---|
| A | `highcrag` | Highcrag Pride | 11 | 2 |
| B | `bonefield` | Bonefield Pride | 10 | 3 |
| C | `mistwood` | Mistwood Pride | 9 | 4 |

**Breeding floor (spec §1.4):** each pride keeps at least 2 breeding-age males and 3 breeding-age females, so no pride is doomed at game start. The rosters must respect this.

**Rosters:** only the leaders are named here. The rest of each pride (10 at Highcrag, 9 at Bonefield, 8 at Mistwood) are **TBD**. A few pride cats are named as story links in `loners.md`; those names are reserved for the rosters.

---

### 2.1 Highcrag Pride (A, 11 cats)
*"We were here first. We will be here last."*

- **Territory:** Highcrag, the cliffs and caves above the upper river, and the high meadows. They also claim Greywater Ford, which Bonefield disputes.
- **Temperament:** proud, old, and traditional. Highcrag counts its bloodlines back through many leaders and recites them on the longest night. Their dens are the best in the Vale and they know it.
- **Values:** lineage, memory, order, patience. A good Highcrag hunter waits. Mates are chosen from within the pride's lines, with the leader's blessing; mating outside the pride is forbidden.
- **Leader:** **Ashmane**, a silver-maned queen who has ruled for many winters and has never been seen to hurry.
- **Toward outsiders:** cold courtesy. A stranger may pass if they ask properly and keep to the trails. Highcrag will hear a suitor, but the suitor must prove worth and lineage, and the leader must agree.
- **Toward those who leave:** Highcrag does not chase. It forgets. A cat who leaves is struck from the night recitation, and their name is not spoken again on the crag. To Highcrag, that is worse than death.
- **Story state:** stable and strong. They have lost only two cats, and they would say neither loss mattered. Both did.

### 2.2 Bonefield Pride (B, 10 cats)
*"The weak feed the strong. That is the law of the grass."*

- **Territory:** the Bonefield, the open grassland in the middle of the Vale, where the herds pass.
- **Temperament:** harsh, martial, and loud. Bonefield cats train cubs to fight from the moment they can walk. Rank is won by challenge and held by scars. They hunt the biggest prey in the Vale and take the most losses doing it.
- **Values:** strength, courage, rank, and the law of challenge. Any adult may challenge for leadership. The loser leaves the pride. A new leader may kill the cubs of the leader before them.
- **Leader:** **Scarjaw**, a heavy tom with a torn lip who won his place by challenge and has held it through three.
- **Toward outsiders:** a test. Strangers are met with a show of force, and the ones who stand their ground earn respect. Suitors must face a rival from the pride.
- **Toward those who leave:** contempt. A Bonefield cat who leaves has "run". A cat who loses a challenge is driven out under the law, and Bonefield will fight them if they return.
- **Story state:** strong, but brittle under the surface. Scarjaw's law has cost the pride a challenger, a hunter who would not kill cubs, and a young tom who simply walked away.
- **The old guard (slot bf07, Director 2026-11-05):** Tallgrass's oldest guard. When Scarjaw took the pride, he bowed without a fight, and he has guarded Scarjaw ever since. Bonefield half respects him for surviving and half despises him for it. He has never challenged anyone, so the law has never driven him out.

### 2.3 Mistwood Pride (C, 9 cats)
*"Walk soft. Say little. The fog keeps what it is given."*

- **Territory:** the Mistwood, the pine forest and fog marsh along the Drowned Mere. They move between hidden dens through the year, following deer and geese, and never sleep in one place for long.
- **Temperament:** secretive, quiet, and half-nomadic. Mistwood cats speak in few words and keep their trails to themselves. Other prides call them "the fog cats" and claim not to trust them.
- **Values:** silence, kinship, the old paths, and the knowledge of the land. They know the safe ways through the marsh and across the ice, or they believed they did.
- **Leader:** **Hollowsong**, an aging queen who took the lead after the Breaking because no one else would.
- **Toward outsiders:** they hide first. A stranger in the Mistwood is watched and rarely greeted. Those who are patient and gentle may be let in. A suitor must earn the trust of the whole pride, not only the leader.
- **Toward those who leave:** sorrow rather than anger. Mistwood leaves a door open. There is one exception: the cat they blame for stealing from the starving.
- **Story state: broken.** Last spring, the old leader Longshadow led the pride across the Drowned Mere to reach the deer on the far shore. The ice gave way. Cats call it **the Breaking**. Longshadow and several others drowned. Others were swept downriver or stranded on the far bank. The hungry season that followed turned the survivors on each other. Mistwood is now the smallest pride in the Vale, and four of the Vale's nine loners are its own. Whether Mistwood heals, is absorbed, or fades is one of the valley's central stories. Its toms took the worst of the ice, so wandering bands of loner males watch Mistwood closely (see `loners.md`, Bachelor bands). The roster must still meet the breeding floor (2 breeding-age males, 3 breeding-age females), so Mistwood's males should be few, scarred, or getting old, but not gone.

## 3. Loners and wanderings

The Vale's nine loners are in `docs/lore/loners.md` (with `loners.json` for data). Their rules are Tundra's: `docs/loners-spec.md` v0.8.

Lone toms sometimes hunt together for a while in what the prides call a **wandering**: a bachelor band with no land, den, or cubs (spec §5b). A wandering can challenge any pride for its queens or a strip of border land, and then it falls apart. Every pride has a story about the season a wandering came. Bonefield's leaders have all faced one. Highcrag claims it never has.

## 4. Open lore questions (for Director)
- The scimitar cats are a draft idea for a rare threat. If Tundra doesn't want a second sabretooth species, they can be cut with no knock-on lore.
- "Mating outside the pride is forbidden" is Highcrag *custom*, not a rule. If courtship rules let the player court Highcrag cats normally, the custom is something the player defies, and Saga will write events around it.
- Bonefield cub-killing after a challenge is backstory flavor only. It should not become a mechanic without Tundra and Director agreeing.
