# Names megafile (`names.json`)

Owner: Saga (the names). Generation rules: Tundra. Code: Flint.
Names are drawn fresh every run (Anna, world-gen-spec v0.3.1 §3): all 39 world cats, every cat born in play and every spawned loner get a name from this file, so no cat keeps an authored name. The `reserved` list blocks lore and example names (Saga's role labels such as Ashmane or Torncheek, past cats, places, the creator's default names and team names) from ever being generated, so a role label in Saga's slot templates never collides with a rolled name.

**Open (Saga's recommendation, not applied yet):** keep the lore role names reserved. They are still used as authoring labels in `docs/lore/` and in Tracker's checks, and a random "Torncheek" in a run where that name means nothing would read as a bug. Revisit only if Anna wants the lore names to appear as random names.

## Structure

| Key | Type | What it is |
|---|---|---|
| `version` | string | File version. |
| `notes` | string | One-line summary. |
| `maxLength` | number | Longest allowed name, in characters. Every full name and every allowed compound fits it. |
| `male` | string[] | Full names with a male feel. |
| `female` | string[] | Full names with a female feel. |
| `either` | string[] | Full names that suit any cat. |
| `prefixes` | string[] | First halves of compound names, capitalised (`"Frost"`). |
| `suffixes` | string[] | Second halves, lowercase (`"jaw"`). |
| `prefixLean` | {part: "male"\|"female"} | Optional. A few prefixes lean one way. Parts not listed are neutral. |
| `suffixLean` | {part: "male"\|"female"} | Optional. Same idea for suffixes. |
| `blocklist` | string[] | Names that must never be produced: compounds that read badly, Warrior Cats canon names, and compounds that recreate a reserved name. |
| `reserved` | string[] | Lore and example names: the lore cats' role names, the loners' role names, the cat creator's default names, prides and places, and team names. Never generate one of these. |

All names are single words. Every name is unique across `male`, `female` and `either`, case-insensitively, and none appear in `reserved` or `blocklist`.

## Combining parts (data notes, not rules)

A compound is `prefix + suffix`, for example `Frost` + `jaw` = `Frostjaw`. The data was checked against these conventions:
- First letter capitalised, the suffix lowercase.
- No compound where the prefix ends with the letter the suffix starts with (no `Frosttail`).
- No compound longer than `maxLength`.
- No compound where one part contains the other (`Stormstorm`, `Frostfrost`).
- Check the result against `blocklist` and `reserved` (case-insensitive) and skip it if it matches.

Leans are hints only. How (or whether) they're used, and how often compounds are used instead of the full-name lists, is Tundra's call.

## Avoiding duplicates within a run

Keep a set of names already in use this run, lowercased. Seed it with `reserved` and every living or remembered cat's name. Then skip any candidate already in the set, and add each name as it's given out.
