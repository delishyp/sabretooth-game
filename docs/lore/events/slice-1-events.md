# First season as a loner: offline content

Owner: Saga. Scope: `docs/design/slice-1-scope.md`; region ids: `docs/design/map-v1.md`.

Content source: `slice-1-events.json` (contentVersion 1). This is a slice-specific content adapter, not a replacement for the full pride scene schema. Flint owns runtime conversion and scheduling.

- 30 spring region moments, one per region, eligible once per run. All are observations, not hazards: they grant no food, safety, injury, travel, water or other mechanical result. An acknowledgement does not use another day. A repeat visit may have no story rather than repeat a used scene.
- Four first-meeting templates: one for each pride, plus a neutral loner greeting. Bind an actual present adult/elder to `{catName}`; do not invent a cat. Pride templates apply to members, not an assumed leader. Each is once per bound pair. The loner template assumes no personal history.
- Three patrol templates follow the *actual patrol faction*, not static region ownership. A hostile patrol uses `hostileText`/`hostileSummary` instead of choices; the engine resolves chase/injury from scope, not a second story effect.
- Each choice has a result and a log summary. `affinityIntent` is improve / unchanged / worsen; Tundra set improve +5, unchanged 0, worsen −5 in slice scope §7 (`6c4018b`), tunable via `slice.affinityIntent`; at most one improve per cat per day. Never infer a new relationship type, courtship, pride admission, permission to trespass, consumed resources or immunity from a reply. Patrol trespass penalties remain separate.
- Encounter variants must match a non-hostile greeting context; otherwise use the hostile patrol branch. If both a meeting and a region moment are eligible, show only one under the slice cap of one offline event/day. Engine owns eligibility, selection and saved used-event/first-met state.
- Spring only for the 30 region moments; no season advancement beyond day 20. Health/hunger/death/hazard resolution is authoritative: do not show these observations after death or as replacements for forced hazard resolution.

Validation: JSON parsing, 37 unique ids, exact coverage of the 30 map ids, and log summaries at most 100 characters with a 12-character cat name.
