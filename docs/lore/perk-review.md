# Perk Review: Names and Slot Picks (skills-spec v0.2.1, world-gen-spec v0.3.1 §2.3a)

Owner: Saga. Status: **suggestions for Tundra**, 2026-11-04. No spec edits. Perk ids never change, only display names (skills-spec §15.3).
Swaps below stay inside each milestone's own pair (skills-spec §2 tables), so XP and milestone counts don't move.

## 1. Rule for slot perks
Personality is rolled every run (world-gen §5), so a slot's fixed perks must read as **what the cat learned from its life**, never as its temperament. A run can give bf01 aggression 20 while he still holds `bully` and `warlord`. That's fine: he learned them holding Bonefield. Perk text never says "because {name} is fierce".

## 2. Slot picks that clash with the story

| # | Slot | Current pick | Clash | Suggested swap (same milestone) |
|---|---|---|---|---|
| P1 ✅ APPROVED (Director 2026-11-05) | ln01 "Greymantle" | leadership M4 `legacy_rally` | He was Ashmane's **counselor**, never leader (world-gen changelog calls him "ex-leader"). `legacy_rally` is a ruler's perk and does nothing for a loner. | `kingmaker`: a counselor who told the leader where each cat belonged. Also fix the changelog wording. |
| P2 | hc08 keeper of the recitation | trailReading M3 `exile_friend` | Highcrag **forgets** those who leave, and she is the one who struck Greymantle's name from the song. Warmth toward exiles is the opposite of her role. | `rumor_web`: the keeper of names hears every rumor first. |
| P3 | ln09 "Coldwater" | endurance M1 `long_stride` | His hind leg is torn and "still stiff" (scar `hind_leg_left`). Two zones a day is the one thing he can't do. | `night_walk`: he walks the marsh edge at night, nose down, looking for Mistwood's scent. |
| P4 | ln06 "Lichen" | preySense M3 `scout` | `scout` helps pride hunters, but she's a lone survivor. Her story is reading the ice ("The ice told me"). | `water_finder`: she finds open water under the ice. In Story it gives Warmth (skills §2.2), so it doesn't depend on Thirst. |
| P5 | ln05 "Duskrunner" | trailReading M2 `read_affinity` | His story is the pass through the Ice Wall, not reading hearts. | `shortcut`: he knows the quick ways through the Vale. |
| P6 | mw01 "Hollowsong" | leadership M3 `heir_trainer` | Mistwood is broken and short of toms, and she is holding it together. | `hold_the_young`: keeps Mistwood's few young toms home in Sim. Weaker pick, but it fits her. Optional. |
| P7 | hc01 "Ashmane" | leadership M2 `rally` | Highcrag is order and custom, and she exiled Greymantle "before the pride could ask questions". | `strict`: loyalty held by law. Optional, flavour only. |

**No clash** for the other 32 slots. Picks that fit especially well, and that I'll write into their templates:
- **bf01 Scarjaw:** `killing_bite`, `warlord`, `last_stand`. He killed Tallgrass's cubs and has held through three challenges.
- **ln03 Torncheek:** `duelist`. He's a one-on-one challenger by history.
- **ln04 Nettle:** `bodyguard`, the cat who protects one named cat (Thistle).
- **ln02 Sorrel:** `constant`. Her bond doesn't fade while she waits at the Rock.
- **mw05:** `shortcut`, Mistwood's hidden paths.
- **mw07** and **ln01:** `exile_friend`. Mistwood "leaves a door open", and Greymantle is an exile himself.
- **bf07:** `shoulder_to_shoulder`. It fits "Tallgrass's old guard" (slot-table-review M1).
- **hc04 Thistle** has a Fighting aptitude lean with Bonefield blood, which is a nice hint for the reveal.

## 3. Display-name suggestions
Goals: Ice Age plain speech, Warrior-Cats warmth, and no canon names or terms (no Clan, StarClan, Moonstone, fresh-kill, warrior names). Names no longer than 20 characters. Ids not listed keep their placeholder name, which already fits (for example Eat Last, False Trail, Last Stand, Snow Tracks, Old Scars, Den Watch, Herb Chewer, Second Wind).

| Id | Placeholder | Suggested name |
|---|---|---|
| `ambush` | Ambush | Waterside Ambush |
| `patient_stalker` | Patient Stalker | Belly to the Snow |
| `second_lunge` | Second Lunge | Second Spring |
| `dusk_hunter` | Dusk Hunter | Long-Night Hunter |
| `cache_kill` | Cache | Buried Meat |
| `hunt_mentor` | Hunt Mentor | Teach the Stalk |
| `apex_stalker` | Apex Stalker | Season's First Blood |
| `provider` | Provider | Feeds the Den |
| `pack_lunge` | Pack Lunge | Many Jaws |
| `throat_bite` | Throat Bite | Throat Hold |
| `bold_charge` | Bold Charge | Open Charge |
| `carcass_guard` | Carcass Guard | Over the Carcass |
| `giant_slayer` | Giant Slayer | Giant-Feller (see `perk-text.md`) |
| `quick_kill` | Quick Kill | Clean Throat |
| `lean_hunter` | Lean Hunter | Hunts Hungry |
| `scavenger` | Scavenger | Crow's Share |
| `sated_sleep` | Sated Sleep | Full-Belly Sleep |
| `effortless` | Effortless | Light Paws |
| `small_feeder` | Small Feeder | Hare Eater |
| `prey_map` | Prey Map | Wind Reader |
| `herd_calendar` | Herd Calendar | Herd-Memory |
| `water_finder` | Water Finder | Open Water |
| `famine_path` | Famine Path | Hunger Trail |
| `track_master` | Track Master | Trail-Teacher |
| `early_warning` | Early Warning | Wind-Warned |
| `read_rival` | Read Rival | Read the Stranger |
| `sixth_sense` | Sixth Sense | Hackle Sense |
| `know_the_enemy` | Know the Enemy | Know the Wandering |
| `storm_sense` | Storm Sense | Smells the Storm |
| `seek` | Seek | Follow the Scent |
| `scent_history` | Scent History | Old Scent |
| `read_affinity` | Read Affinity | Read the Heart |
| `shortcut` | Shortcut | Fox Paths |
| `rumor_web` | Rumor Web | Border Gossip |
| `exile_friend` | Exile's Friend | Friend to the Driven |
| `whole_region` | Whole Region | Whole Vale |
| `feint` | Feint | Break Away |
| `pin` | Pin | Spare the Pinned |
| `fury` | Fury | Wounded Fury |
| `duelist` | Duelist | One Against One |
| `saber_legend` | Saber Legend | Saber Song |
| `roll_with_it` | Roll With It | Rolls with the Blow |
| `fight_through` | Fight Through | Bleeds and Stands |
| `bodyguard` | Bodyguard | Shadow-Guard |
| `scar_pride` | Scar Pride | Wears Its Scars |
| `fearsome_mark` | Fearsome Mark | Feared Mark |
| `bully` | Bully | Hard Shoulder |
| `deterrence` | Deterrence | Standing Threat |
| `banish` | Banish | Driven Far |
| `warlord` | Warlord | Border-Taker (see `perk-text.md`) |
| `winter_coat` | Winter Coat | Heavy Coat |
| `snow_melt` | Snow Melt | Snow-Eater |
| `huddle_core` | Huddle Core | Heart of the Huddle |
| `den_maker` | Den Maker | Snow Den |
| `warm_keeper` | Warm Keeper | Warms the Cubs |
| `forced_march` | Forced March | Den-Mover |
| `quick_healer` | Quick Healer | Heals Fast |
| `iron_gut` | Iron Gut | Carrion Gut |
| `survivor` | Survivor | Won't Lie Down |
| `healer` | Healer | Healing Tongue |
| `long_life` | Long Life | Long Winters |
| `gentle_approach` | Gentle Approach | Soft Approach |
| `generous` | Generous | Shares the Kill |
| `bond_maker` | Bond Maker | Shared Grooming |
| `soothe` | Soothe | Calming Tongue |
| `rival_tamer` | Rival Tamer | Grooms the Rival |
| `envoy` | Envoy | Border Envoy (see `perk-text.md`) |
| `silver_tongue` | Silver Tongue | River Voice |
| `truce` | Truce | Border Truce (see `perk-text.md`) |
| `rally` | Rally | Rouse the Pride |
| `strict` | Strict | Hard Law |
| `heir_trainer` | Heir Trainer | Shapes the Heir |
| `legacy_rally` | Legacy | Remembered Name |
| `kingmaker` | Kingmaker | Place-Giver |
| `call` | Call | Far Call |
| `showdown` | Showdown | Display Duel |
| `famous` | Famous | Known in the Vale |
| `first_impression` | First Impression | First Scent |
| `leader_charm` | Leader Charm | Leader's Eye |
| `sweet_talk` | Sweet Talk | Soft Words |
| `soulmate` | Soulmate | One Heart |
| `heartbreaker` | Heartbreaker | Stolen Heart |
| `alliance_mate` | Alliance Mate | Bridge Mate |
| `takeover` | Takeover | Take the Pride |

Notes:
- **Sex-neutral courtship names (rel-spec v0.1.2 §1.8):** none of the Courtship names assume a pairing, and descriptions will say "a cat you court", never "a queen" or "a tom".
- **`read_affinity` text clash:** skills-spec says "See **opposite-sex** adults' affinity". rel-spec v0.1.2 §1.8 and §11.3 make it any courtable cat, plus "could be interested in you". Tundra should align skills-spec; my card text will follow rel-spec.
- `heartbreaker` "Stolen Heart" and `two_hearts` stay tender, never cruel, in their event text.
