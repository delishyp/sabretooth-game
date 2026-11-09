## A. Horse meadows (slice.region.horse_meadows)
1 Narrator: The meadow grass is cropped short and sweet-smelling, and the wind brings you horse long before you see them: dung, sweat, the green breath of chewed stems.
2 Narrator: A herd grazes downslope. One mare lifts her head, then another, until every long face is turned toward your hillside.
3 Narrator: Near the edge, a foal has wandered after a patch of clover, a few lengths from its mother. Its legs are still too long for it.
Choices: stalk_foal "Stalk the foal." (plays the voice-pass-1 foal hit or miss scene). watch_herd "Settle on the rise and watch." -> Narrator: You fold your paws under you on the warm rise. The herd drifts, the clouds drift, and the whole valley seems to pass beneath you, cat by cat. move_on "Leave them be." -> Narrator: You turn away. Behind you, the mares go back to grazing as if you were never there.
Follow-ups (action 8 opener, spoken by the witnessing cat):
- Hit, witnessed. Low sociability: “I saw you take the foal.” Baseline: “I saw you take that foal at the meadows. Clean work.” High: “That foal at the meadows! I watched the whole thing. You came out of the grass like a rockfall.”
- Miss, witnessed (teasing, talk only). Low: “The foal got away.” Baseline: “I saw the foal run off. Those long legs fool everyone once.” High: “I saw that! You were so close. The stem cracking, the squeal, the mares wheeling…” {catName} purrs with laughter.
- Watched, next day: “You were on the hillside yesterday. I felt eyes on me all the way across the meadow.”
- share line, Narrator: You nudge the meat toward {catName}. Something in their face softens.
## B. Greywater Ford carcass follow-ups (m2.ford_prey_dispute)
- Helped cat, first meeting after (gossip unlocked). Narrator: {catName} recognises you from a distance and comes straight over, without the usual wary circling. “You stood with me at the ford. I haven't forgotten.” Then the gossip line from the fact {catName} actually knows.
- Witness from the other pride (cold opener). Narrator: {catName}'s ears flatten the moment your scent reaches them. “The ford. You chose your side.”
  explain: “It wasn't about your pride.” -> {catName}: “It looked that way from where I stood.” repair: use the existing §11 repair outcome text. leave: Narrator: You walk away. You can feel {catName}'s stare between your shoulders until the reeds hide you.
- Stay out (either participant): “You stood there and watched us. Why didn't you pick a side?” neutral: “It wasn't my fight.” -> {catName}: “Then don't expect to hear much about our business.” ask_what_happened: “What's really between your prides?” -> {catName}'s fact line, then “Now you know. Whether that's a gift or a weight is up to you.” leave: no extra line.
- Scouting the border after the rumour lands (action 4 report line): “They remember the ford. A guard's eyes follow you longer than they need to.”
## C. Cave hyena follow-ups (encounter.cave_hyena.v1)
- drive_off, the hunter's next meeting. Narrator: {catName} greets you with a low chuff, the kind kept for pride-mates. “The hyena. I keep thinking about how you came at it. Most loners would have waited for scraps.” Then the confiding branch unlocks. Relay line: “I'll tell our leader what I saw. Whether that's enough to get you heard is for the leader to decide.”
- share_remains: same as above, plus “And you shared. Highcrag remembers manners as well as courage.”
- leave. Narrator: {catName} doesn't come closer. “You watched, and you did nothing.” explain: “I didn't know if I could win.” -> “Neither did I. I went anyway.” repair: use the existing §11 repair outcome text. leave: no extra line.
## D. Leader first meetings (replace slice.meeting.<pride> when the cat is the leader; show appearance clauses only if saved appearance has them)
Highcrag: 1 The cave-mouth scent is old and layered, generations deep, and over it lies one scent fresher and stronger than the rest. 2 {catName} sits at the top of the path in the slanting light, [silver at the muzzle,] and doesn't rise. The leader of Highcrag doesn't need to. 3 “Every cat on these cliffs can name their mother's mother's mother.” Calm, unhurried. “You come with no line at all. Tell me why I should remember your name.”
Bonefield: 1 The grass goes quiet. Insects, birds, all of it, as if the whole field has drawn a breath. 2 {catName} walks out of the stems, heavy-shouldered [and scarred], with two guards flanking at a respectful distance. [The torn lip leaves one saber always bare.] 3 “I've held this field through three challenges.” The voice is a low rumble you feel in your paws. “Every cat who stood where you stand wanted something. Say what you want, stray, and say it without shaking.”
Mistwood: 1 The fog thickens until you can't see your own tail. Then a voice, soft, close, from no direction at all. 2 “Don't run. The ice is thin where you're standing.” 3 {catName} steps out of the grey. The cat is [old and] thin, with eyes that have watched too many cats go under the water. “We lost half our pride to the Breaking. I don't lose more to strangers. Why are you in my wood?”
## E. Arrival | drink per biome ({region} = region name)
glacier: The ice groans under its own weight as you reach {region}. Every breath comes back to you as smoke. | You lap meltwater from a blue crack in the ice, so cold it aches in your teeth.
tundra: {region} opens flat and endless, and the wind has nothing to stop it but you. | You crack the skin of ice on a shallow pool and drink until your belly is cold.
alpine: You haul yourself up the last rocks into {region}. Far below, the whole Vale lies small and quiet. | A thin stream spills over the stones, and you drink from it with your eyes on the drop.
riverine: You hear {region} before you see it: the endless rush of water over stone. | You crouch at the bank and drink, ears turning at every splash in the current.
steppe: Grass runs to the horizon in {region}, bowing under the wind in long silver waves. | You find a hoof-churned waterhole and drink fast, watching the open grass.
pinewood: {region} closes around you in resin and shadow, and the needles hush your steps. | Rainwater has pooled among the roots, tasting of pine and moss.
wetland: {region} squelches under your paws, and somewhere in the reeds a bird stops singing. | You drink from still brown water, careful to keep your paws out of the mud.
lakeshore: Waves lap at the stones of {region}, and the far shore is only a grey line through the haze. | The lake water is clear and cold, and you drink until the ripples settle.
gorge: The walls of {region} rise on either side until the sky is a narrow strip above you. | Water trickles down the rock face, and you lick it from the stone in slow mouthfuls.
tarlands: {region} reeks of pitch. You pick your way around the black pools, paw by careful paw. | You find a clean spring well away from the tar and drink with your nose wrinkled.
ashscape: Grey dust puffs up around your paws in {region}, and your coat comes away the colour of old bone. | Water lies in a hollow of dark rock, gritty but welcome.
(Square brackets mark the appearance-gated clauses.)
