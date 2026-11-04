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
        "description": "How all three prides see you when you first arrive as a lone cat. Your choices change it from there.",
        "values": ["low", "normal", "high"],
        "labels": ["Outcast", "Stranger", "Respected"],
        "descriptions": [
          "The prides distrust you. Winning a mate or an ally will be hard.",
          "The prides don't know you yet. Your choices will decide what they think.",
          "Your name is already known and welcomed. Doors open easily."
        ]
      },
      {
        "id": "freeCustomization",
        "name": "Free Cat Customization",
        "description": "Unlock every coat, marking, eye color, and personality option for your starting cat.",
        "values": [true, false],
        "labels": ["On", "Off"],
        "descriptions": [
          "Every option is unlocked, including rare and mutation traits and the full personality range.",
          "Common coats, markings, and eyes only, and personality stays within the usual limits."
        ]
      }
    ]
  }
}
```

Notes for Flint:
- `name` labels changed from the placeholders ("Needs drain" is now "Hunger and Thirst", "Threat frequency" is now "Dangers"). Value labels changed for three toggles ("Low" is now "Slow", "Rare", or "Outcast", for example). Ids and values are unchanged.
- If the panel only has room for one line per toggle, use `description` and skip `descriptions`.
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
    "placeholder.newRun": "A new {difficultyName} run begins in slot {slot}.",
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
      "description": "Survival and story in balance. You lead the pride yourself, choosing roles, patrols, and who eats first, through hard but fair seasons."
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
