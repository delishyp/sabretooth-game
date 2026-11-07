# Main Menu Copy

Owner: Saga (narrative). Status: v1 draft, ready for Flint to wire in.
Tone: quiet, cold, ancient, a little mythic. Short lines that fit under a title. Plain text, no markup inside strings.

## 1. Title screen taglines (rotating)

Show one at random on each launch. Avoid repeating the previous launch's line if easy.

```json
{
  "taglines": [
    "The ice remembers every pawprint.",
    "Three prides hold the valley. There is room for a fourth.",
    "Alone, you are prey. Together, you are a legend.",
    "Long teeth. Long winters. Longer memories.",
    "Every pride began with one cat who refused to die.",
    "The herds move. The snow comes. The pride endures.",
    "Your blood will outlive your name.",
    "Before the stars had names, the sabretooths sang to them.",
    "Hunt well. Choose well. Your cubs will remember both."
  ]
}
```

## 2. AI storyteller modes

Shown in Settings and on the New Game screen. `name` is the button or label; `description` is the helper line under it.

```json
{
  "storytellerModes": [
    {
      "id": "online",
      "name": "Online Storyteller",
      "description": "The richest stories. Every event is written fresh for your pride as you play. Needs an internet connection."
    },
    {
      "id": "local",
      "name": "Local Storyteller",
      "description": "Stories are written by an AI model running on your own computer. Works offline, but needs a capable PC and may be slower."
    },
    {
      "id": "offline",
      "name": "Classic Storyteller",
      "description": "Uses a hand-written library of events. No AI and no internet needed. Fast and dependable, with less variety."
    }
  ]
}
```

Note for Flint: "offline" is labeled "Classic" for players so it isn't confused with Local, which also runs without internet. Keep the internal id as `offline`.

## 3. Difficulty

Shown on the New Game screen.

```json
{
  "difficulties": [
    {
      "id": "permadeath",
      "name": "Permadeath",
      "description": "When your cat dies, the story ends. One life, one legend."
    },
    {
      "id": "heir",
      "name": "Play On as Heir",
      "description": "When your cat dies, you continue as your closest kin in the pride. If no heir is left, your legacy ends."
    },
    {
      "id": "sandbox",
      "name": "Sandbox",
      "description": "A gentler world with no game over. Explore, experiment, and tell the story you want at your own pace."
    }
  ]
}
```

## 4. Sandbox options panel

Shown to the right of the difficulty cards while Sandbox is selected (spec §2). Ids, values, and defaults match `sandbox-options.json` and spec v1.0; only the player-facing text is new. `descriptions` are per-value helper lines shown under the toggle for the currently selected value; `description` is the general line if only one fits.

```json
{
  "sandboxPanel": {
    "title": "Sandbox Options",
    "note": "These choices are locked once the run begins. Sandbox runs stay Sandbox runs.",
    "options": [
      {
        "id": "needsDrain",
        "name": "Hunger and Thirst",
        "description": "How quickly your cats grow hungry, thirsty, and tired.",
        "values": ["off", "low", "normal"],
        "labels": ["Off", "Slow", "Normal"],
        "descriptions": [
          "Your cats never go hungry or thirsty. Hunt for the story, not to survive.",
          "Needs drop slowly, leaving plenty of time between meals.",
          "Needs drop at the usual pace of the Ice Age."
        ]
      },
      {
        "id": "threatFrequency",
        "name": "Dangers",
        "description": "How often predators, rivals, storms, and other threats find your pride.",
        "values": ["off", "low", "normal"],
        "labels": ["Off", "Rare", "Normal"],
        "descriptions": [
          "No attacks or disasters. The valley is peaceful.",
          "Threats appear now and then, with time to recover between them.",
          "Threats come as often as they would in the wild."
        ]
      },
      {
        "id": "startingReputation",
        "name": "Starting Reputation",
        "description": "How the prides see you when you first arrive.",
        "values": ["low", "normal", "high"],
        "labels": ["Outcast", "Stranger", "Respected"],
        "descriptions": [
          "The prides distrust you. Mates and allies come hard.",
          "The prides don't know you yet.",
          "Your name is known and welcome."
        ]
      },
      {
        "id": "freeCustomization",
        "name": "Free Cat Customization",
        "description": "Unlock every look and personality option for your cat.",
        "values": [true, false],
        "labels": ["On", "Off"],
        "descriptions": [
          "All traits unlocked, including rare ones.",
          "Common traits only, as in a normal run."
        ]
      },
      {
        "id": "freePerkRespec",
        "name": "Free Perk Respec",
        "description": "Swap your cat's perks whenever you rest, as often as you like.",
        "values": [true, false],
        "labels": ["On", "Off"],
        "descriptions": [
          "Swap any perk whenever you rest. Nothing is set in stone.",
          "Perk choices are permanent, as in a normal run."
        ]
      }
    ]
  }
}
```

Notes for Flint:
- `name` labels changed from the placeholders ("Needs drain" is now "Hunger and Thirst", "Threat frequency" is now "Dangers"). Value labels changed for three toggles ("Low" is now "Slow", "Rare", or "Outcast", for example). Ids and values are unchanged.
- If the panel only has room for one line per toggle, use `description` and skip `descriptions`.
- `freePerkRespec` (spec v1.4.3, skills-spec §7.6) defaults to off, unlike `freeCustomization`.
- Panel `note` reworded from your placeholder to sound friendlier. It means the same thing.

## Open questions

All resolved per main-menu-spec.md v1.1 §7:
- Heir mode with no eligible heir: the run ends on the Legacy summary, with an option to begin a new lineage. The heir description in §3 now says this.
- Starting Reputation: one equal starting offset for all three prides, which pride temperament and events then move.
- Free Customization: Off uses standard rules (common traits, sliders 20-80%). On unlocks rare and mutation traits and sliders 0-100%. Applies only to the player cat at creation.
- Sandbox: no game over plus the §4 toggles. No cheat console in v1.

## 5. Interface strings (B12)

Every player-facing string in the menu, keyed by ID, so nothing stays hardcoded in `index.html`, `menu.js`, or `main.js`. Placeholders use `{name}` and are filled by code. The copy wins over spec wording for anything in this section. Dev-only text (screenshot labels, log lines) stays out.

Decisions on the B12 mismatches:
- **Begin vs Confirm:** the difficulty screen button is **"Begin"** (`difficulty.begin`). It reads better than "Confirm" for starting a story. The spec's "Confirm" names the action, not the label. Director/Tundra: please align spec §2 wording.
- **Fallback toast:** uses `toast.storytellerFallback`. It replaces both the spec example and the current code template, and it fills in the short mode names from `storyteller.shortName`.
- **Raw error toast:** `Could not start: ${res.error}` is replaced by `toast.startFailed`. The raw error goes to the log only, never on screen.

```json
{
  "strings": {
    "app.windowTitle": "Sabretooth",
    "app.titleLogo": "SABRETOOTH",
    "app.workingTitle": "working title",
    "app.version": "v{version} (build {build})",
    "update.checking": "Checking for updates…",
    "update.downloading": "Downloading update… {percent}%",
    "update.ready": "Version {version} is ready. Restart replaces this installation. Your saves and settings stay where they are.",
    "update.later": "The update will install when you quit. Your saves and settings stay where they are.",
    "update.restarting": "Restarting to finish the update…",
    "update.error": "The update didn't finish. Nothing was changed.",
    "update.cancelled": "Download cancelled. Nothing was changed.",
    "update.restart": "Restart now",
    "update.laterButton": "Later",
    "update.retry": "Try again",
    "update.cancel": "Cancel",

    "root.continue": "Continue",
    "root.newGame": "New Game",
    "root.load": "Load",
    "root.settings": "Settings",
    "root.credits": "Credits",
    "root.quit": "Quit",

    "common.back": "Back",
    "common.cancel": "Cancel",
    "common.on": "On",
    "common.off": "Off",
    "common.delete": "Delete",
    "common.backToMenu": "Back to menu",
    "common.mainMenu": "Main menu",

    "difficulty.title": "New Game",
    "difficulty.subtitle": "Choose how your story ends. Difficulty is locked for the whole run.",
    "difficulty.subtitleReplacing": "Replacing {runLabel} once you begin. Difficulty is locked for the whole run.",
    "difficulty.begin": "Begin",

    "slotsFull.title": "Both run slots are full",
    "slotsFull.subtitle": "Choose a run to replace. Nothing is deleted until you choose a difficulty and begin.",
    "replaceConfirm.body": "This permanently deletes {runLabel} and all its saves.",
    "replaceConfirm.ok": "Replace",

    "run.label": "{catName} of {prideName}",
    "run.emptyName": "Empty run",
    "run.emptyMeta": "Run slot {slot}",
    "run.damagedName": "Damaged run",
    "run.damagedMeta": "Run slot {slot}. This run can't be loaded, but it can be deleted.",
    "run.meta": "Generation {generation} · Last played {lastPlayed} · {saveCount}/3 saves",
    "run.defaultCatName": "Unnamed cat",
    "run.defaultPrideName": "Nameless pride",
    "run.sandboxTag": "No game over",

    "load.title": "Load",
    "load.saveEntry": "Load · {writtenAt} · Year {year}, {season}, day {day}",
    "load.damagedSave": "Damaged save",
    "load.noSaves": "No saves in this run yet.",
    "load.deleteRun": "Delete run",
    "deleteSaveConfirm.body": "Delete this save? This can't be undone.",
    "deleteRunConfirm.body": "This permanently deletes {runLabel} and all its saves.",
    "deleteRunConfirm.ok": "Delete run",

    "season.spring": "Spring",
    "season.summer": "Summer",
    "season.autumn": "Autumn",
    "season.winter": "Winter",

    "placeholder.title": "Gameplay coming soon",
    "placeholder.newRun": "A new story begins in slot {slot}: {styleName} style, {deathRuleName}.",
    "placeholder.loading": "Loading {runLabel}…",
    "placeholder.loadingFallback": "Loading your save…",
    "placeholder.newLineage": "A new lineage begins.",

    "legacy.title": "Legacy",
    "legacy.body": "Your line has ended. The full Legacy summary is coming soon.",
    "legacy.newLineage": "Begin a new lineage",

    "settings.title": "Settings",
    "settings.tab.audio": "Audio",
    "settings.tab.display": "Display",
    "settings.tab.controls": "Controls",
    "settings.tab.storyteller": "Storyteller",
    "settings.resetTab": "Reset to defaults",
    "settings.resetConfirm.body": "Reset all {tabName} settings to their defaults?",
    "settings.resetConfirm.ok": "Reset",

    "settings.audio.master": "Master volume",
    "settings.audio.music": "Music",
    "settings.audio.sfx": "Sound effects",
    "settings.audio.ambient": "Ambience",
    "settings.audio.mute": "Mute all",

    "settings.display.mode": "Window mode",
    "settings.display.mode.fullscreen": "Fullscreen",
    "settings.display.mode.borderless": "Borderless window",
    "settings.display.mode.windowed": "Windowed",
    "settings.display.uiScale": "UI scale",
    "settings.display.reducedMotion": "Reduced motion",
    "settings.display.vsync": "VSync",

    "settings.controls.controllerVibration": "Controller vibration",
    "settings.controls.invertY": "Invert Y axis",

    "storyteller.shortName.online": "Online",
    "storyteller.shortName.local": "Local",
    "storyteller.shortName.offline": "Classic",

    "quitConfirm.body": "Leave the valley for now? Quit Sabretooth?",
    "quitConfirm.ok": "Quit",

    "credits.title": "Sabretooth",
    "credits.workingTitle": "(working title)",
    "credits.createdBy": "Created by",
    "credits.design": "Design",
    "credits.narrative": "Narrative",
    "credits.art": "Art",
    "credits.engineering": "Engineering",
    "credits.inspiredBy": "Inspired by",
    "credits.placeholderNote": "Placeholder credits.",

    "toast.storytellerFallback": "The {fromShort} storyteller isn't available right now, so the {toShort} storyteller will tell this story. Your setting hasn't changed.",
    "toast.startFailed": "Couldn't start a new run. Please try again. If it keeps happening, restart the game.",
    "toast.saveLoadFailed": "That save couldn't be loaded.",
    "toast.saveDamaged": "This save is damaged and can't be loaded.",
    "toast.settingsReset": "Your settings file was damaged, so settings have been reset to defaults."
  }
}
```

Notes for Flint:
- Credits names (Anna Kremer, Tundra, Saga, Ochre, Flint, "Lioden · WolfQuest") are data, not copy. Keep them wherever is convenient.
- `run.label` replaces the "{catName} · {prideName}" format in `runLabel()` with "{catName} of {prideName}" (for example, "Ash of Frostfang"). For damaged runs, keep using `run.damagedName`.
- `deleteSaveConfirm.body` matches your current hardcoded text in `askDeleteSave`. Its OK button uses `common.delete`.
- Season keys assume the four seasons used in save data. Add any others the save format has.
- `{lastPlayed}` and `{writtenAt}` use your existing `when()` date formatting.

## 6. Play style and New Game setup (spec v1.3, play-styles-spec v0.1)

New Game is a single setup screen with two rows of cards. The Style row uses the descriptions below, and the Death rule row uses §3. Descriptions describe how a style feels and stay true if Tundra re-tunes the exact numbers.

```json
{
  "playStyles": [
    {
      "id": "story",
      "name": "Story",
      "description": "A gentler Ice Age for living the tale. Hunts succeed more often, wounds heal fast, and the pride's daily work is handled for you."
    },
    {
      "id": "standard",
      "name": "Standard",
      "description": "Survival and story in balance. Spend your first spring alone: hunt, rest, travel, and meet the cats of the Vale."
    },
    {
      "id": "sim",
      "name": "Sim",
      "description": "The Ice Age at its harshest. Prey is scarce in winter, meat spoils, wounds can fester, and every cat's hunger, den, and bloodline is yours to manage."
    }
  ],
  "strings": {
    "newGame.title": "New Game",
    "newGame.styleRow": "Play Style",
    "newGame.deathRuleRow": "When Your Cat Dies",
    "newGame.summary": "{styleName} style, {deathRuleName}. Both are locked for the whole run.",
    "newGame.summaryReplacing": "{styleName} style, {deathRuleName}. Replaces {runLabel} when you begin.",
    "run.modes": "{styleName} · {deathRuleName}"
  }
}
```

Notes for Flint:
- `newGame.title` and `difficulty.begin` ("Begin") still apply. `difficulty.subtitle` and `difficulty.subtitleReplacing` are replaced by the two summary lines, which sit above Begin.
- Fill `{styleName}` and `{deathRuleName}` from the `name` fields, for example "Sim style, Play On as Heir. Both are locked for the whole run."
- On run cards, put `run.modes` on its own line, with `run.sandboxTag` after it for Sandbox runs, for example "Standard · Sandbox · No game over".

### 6.1 Advanced: world seed (spec v1.4.2)

A collapsed row below the Death rule row, in every Style. These are merged into the same `strings` block on sync.

```json
{
  "strings": {
    "newGame.advanced": "Advanced",
    "newGame.seedLabel": "World seed",
    "newGame.seedPlaceholder": "Random",
    "newGame.seedHint": "Leave it blank for a random valley. Enter the same seed to roll the same world again.",
    "newGame.seedInvalid": "Use digits only, from 0 to {max}."
  }
}
```

Notes for Flint:
- `newGame.seedPlaceholder` shows inside the empty field. `newGame.seedHint` sits under the field while it's valid, and `newGame.seedInvalid` replaces it while the value is invalid (Begin is blocked then, per spec §2).
- Fill `{max}` with 4294967295, unformatted, so it matches what the player can type.

## 7. Make Your Sabrecat (cat-creator-spec v0.2)

The cat creator opens after Begin (and the slots-full dialog, if needed) and before the run starts. It has two steps: Look, then Next, then Personality, then Start. Option ids match `cat-creator-spec.md` §3, which maps them to genetics-spec alleles. The player only ever sees the names below. Tone stays plain: one short line per row, nothing that reads as a rule.

Decisions:
- **Start label:** "Start", the same plain, single-verb tone as "Begin" (`difficulty.begin`). It's a new id so the two screens can change independently.
- **Back label:** uses the existing `common.back`. No new id.
- **Empty name:** the spec (§4.2) never blocks Start; a blank name gets a random default. So there is no empty-name error. `creator.name.emptyHint` is a gentle helper instead, shown while the field is blank.
- **No Back confirmation:** spec v0.1.1 §1.3 removed it, so the `creator.backConfirm.*` strings are gone. Back on Personality returns to Look and keeps everything; Back on Look returns to New Game setup.
- **Personality (spec §3b):** each trait has a name, a one-line description, and low/high end labels for the slider. Preset descriptions follow the shape of each preset's values without stating any. `custom` appears once any slider moves.
- **Full-range note:** the spec doesn't ask for a note when Sandbox Free Customization widens the sliders, so there isn't one.
- **Default names:** `creator.defaultNames` is a top-level array, not inside `strings`, because `t()` expects every `strings` value to be text. Names are single words in the lore style, and none of them belong to a premade cat, a named lore cat, a pride, a place, or a teammate.

```json
{
  "creator": {
    "defaultNames": [
      "Rimefall", "Emberhide", "Stormpelt", "Birchclaw", "Snowtrack", "Driftmane",
      "Cragfoot", "Hailstrike", "Mossfang", "Wintermoon", "Thawsong", "Ridgerunner",
      "Glacierheart", "Fernshadow", "Duneclaw", "Larchwind", "Bisonbane", "Sleetpaw",
      "Starfrost", "Cinderwake", "Willowsnow", "Brightsaber", "Quietstone", "Ravenmark"
    ]
  },
  "strings": {
    "creator.title": "Make Your Sabrecat",
    "creator.subtitle": "Every legend starts as one cat alone in the snow. This one is yours.",

    "creator.row.name": "Name",
    "creator.row.sex": "Sex",
    "creator.row.coat": "Coat",
    "creator.row.markings": "Markings",
    "creator.row.eyes": "Eyes",

    "creator.help.name": "What the valley will call you.",
    "creator.help.nameGamepad": "Press A for another name.",
    "creator.help.sex": "Either sex can use every picture.",
    "creator.row.portrait": "Picture",
    "creator.help.portrait": "One of the supplied pictures. Coat and eyes do not choose it.",
    "creator.help.coat": "The colour of your fur.",
    "creator.help.markings": "The pattern over your coat, if any.",
    "creator.help.eyes": "The first thing your rivals will see.",

    "creator.sex.male": "Male",
    "creator.sex.female": "Female",
    "creator.coat.tan": "Tan",
    "creator.coat.gray": "Gray",
    "creator.coat.brown": "Brown",
    "creator.coat.black": "Black",
    "creator.coat.sandy": "Sandy",
    "creator.coat.pale": "Pale",
    "creator.coat.ash": "Ash",
    "creator.row.oddEyes": "Odd Eyes",
    "creator.oddEyes.off": "Off",
    "creator.oddEyes.on": "On",
    "creator.row.eyeLeft": "Left Eye",
    "creator.row.eyeRight": "Right Eye",
    "creator.rareTag": "Rare",
    "creator.markings.none": "None",
    "creator.markings.spotted": "Spotted",
    "creator.markings.faintstripe": "Faint Stripe",
    "creator.markings.rosette": "Rosettes",
    "creator.markings.barred": "Barred",
    "creator.row.undercoat": "Undercoat",
    "creator.help.undercoat": "The paler fur on your belly, chest and muzzle.",
    "creator.undercoat.cream": "Cream belly",
    "creator.undercoat.pale": "Pale belly",
    "creator.undercoat.off": "None",
    "creator.row.dorsal": "Dorsal Stripe",
    "creator.help.dorsal": "A dark line down the spine.",
    "creator.dorsal.off": "Off",
    "creator.dorsal.on": "On",
    "creator.eyes.amber": "Amber",
    "creator.eyes.gold": "Gold",
    "creator.eyes.green": "Green",

    "creator.name.placeholder": "Type a name",
    "creator.name.emptyHint": "Leave it blank and the valley will name you.",
    "creator.name.error.tooLong": "Names can be up to {max} characters.",
    "creator.name.error.invalidChars": "Use only letters, spaces, hyphens and apostrophes.",
    "creator.name.reroll": "Randomize name",

    "creator.randomize": "Randomize",
    "creator.help.randomize": "A new picture. Your name, sex and personality stay.",
    "creator.help.randomizePersonality": "Rerolls personality only. Your look and name stay.",
    "creator.next": "Next",
    "creator.start": "Start",

    "creator.step.indicator": "Step {n} of {total}: {stepName}",
    "creator.step.look": "Look",
    "creator.step.personality": "Personality",

    "creator.row.preset": "Preset",
    "creator.help.preset": "A place to start. Move any slider to make it your own.",
    "creator.preset.balanced": "Balanced",
    "creator.preset.balanced.desc": "Even in every way, and free to become anything.",
    "creator.preset.fighter": "Fighter",
    "creator.preset.fighter.desc": "Quick to anger, slow to back down, and happiest alone.",
    "creator.preset.peacemaker": "Peacemaker",
    "creator.preset.peacemaker.desc": "Gentle, easy to like, and slow to pick a fight.",
    "creator.preset.wanderer": "Wanderer",
    "creator.preset.wanderer.desc": "Restless and curious, with little pull toward any pride.",
    "creator.preset.guardian": "Guardian",
    "creator.preset.guardian.desc": "Steady and devoted, never far from the pride and the den.",
    "creator.preset.custom": "Custom",
    "creator.preset.custom.desc": "Your own mix.",

    "creator.trait.aggression": "Aggression",
    "creator.trait.aggression.desc": "How quickly your cat turns to teeth and claws.",
    "creator.trait.aggression.low": "Gentle",
    "creator.trait.aggression.high": "Fierce",
    "creator.trait.sociability": "Sociability",
    "creator.trait.sociability.desc": "How easily your cat makes friends and allies.",
    "creator.trait.sociability.low": "Solitary",
    "creator.trait.sociability.high": "Friendly",
    "creator.trait.boldness": "Boldness",
    "creator.trait.boldness.desc": "Whether your cat stands its ground or slips away.",
    "creator.trait.boldness.low": "Cautious",
    "creator.trait.boldness.high": "Bold",
    "creator.trait.loyalty": "Loyalty",
    "creator.trait.loyalty.desc": "How tightly your cat holds to its pride and kin.",
    "creator.trait.loyalty.low": "Independent",
    "creator.trait.loyalty.high": "Devoted",
    "creator.trait.curiosity": "Curiosity",
    "creator.trait.curiosity.desc": "How strongly the unknown pulls at your cat.",
    "creator.trait.curiosity.low": "Settled",
    "creator.trait.curiosity.high": "Curious",

    "creator.hint.keyboard": "Up/Down: row · Left/Right: change · Enter: select · Esc: back",
    "creator.hint.gamepad": "D-pad: row and change · A: select · A on Name: new name · B: back",
    "creator.hint.mouse": "Click the arrows to change a row, then Next.",
    "creator.hint.mousePersonality": "Drag a slider or pick a preset, then Start.",

    "creator.preview.alt": "Portrait of {catName}, a {sex} sabrecat with a {coat} coat, {markings}, and {eyes} eyes.",
    "creator.preview.markings.none": "no markings",
    "creator.preview.markings.spotted": "spotted markings",
    "creator.preview.markings.faintstripe": "faint stripes"
  }
}
```

Notes for Flint:
- Option strings are keyed `creator.<row>.<optionId>` with the spec §3 ids (`tan`, `gray`, `brown`, `black`; `none`, `spotted`, `faintstripe`; `amber`, `gold`, `green`; `male`, `female`).
- `creator.help.nameGamepad` replaces `creator.help.name` while a gamepad is the active input and Name has focus.
- Hint lines: show the one for the active input device. The gamepad line leaves out Start because the Start button is on screen.
- `creator.preview.alt`: fill `{sex}`, `{coat}` and `{eyes}` with the lowercased option names (for example "gray", "amber"). Fill `{markings}` from `creator.preview.markings.<id>`. If the name is blank, use `run.defaultCatName` for `{catName}`.
- `{max}` comes from the spec's name limit, not from the copy.
- Step indicator: `{n}` and `{total}` are the step numbers, and `{stepName}` comes from `creator.step.look` or `creator.step.personality`. If a two-item strip fits better (spec §2.2b), show the two step names with the current one highlighted.
- Buttons: step 1 is Randomize · Back · Next (`creator.next`), and step 2 is Randomize · Back · Start. Show `creator.help.randomize` on step 1 and `creator.help.randomizePersonality` on step 2.
- Sliders: show the trait name with its `.desc` line under it, and `.low` and `.high` at the two ends.
- Preset row: show the preset name, with its `.desc` line as the helper. Switch to `custom` as soon as any slider moves (spec §3b.3).
- `src/renderer/data/menu-copy.json` needs `npm run sync-copy`, or the copy-sync test will fail.
