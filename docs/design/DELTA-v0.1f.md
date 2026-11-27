# Breeding spec v0.1f.1 delta check (Tracker)

**Spec:** `docs/design/breeding-cubs-v0.1.md`, header still reads **v0.1f**, changelog **v0.1f.1**. Local commit **`79b4296`** (not pushed).  
**Prior check:** v0.1e at `9ddabc1`, `/workspace/qa/breeding-spec/DELTA-v0.1e.md`.  
**Scope note:** The five v0.1e text fixes landed in `827f470` (v0.1f). `git diff 827f470 79b4296` touches only `docs/design/breeding-cubs-v0.1.md` (13 lines: +7 / −6). Confirmed tag/changelog only: the four overcrowding rules marked **APPROVED, Director 2026-11-27**; numbers remain **candidate (sim overcrowding v0.1)**; changelog states contentment stays put until Anna rules. This report is against **`79b4296`**.  
**Method:** text scan of `79b4296` (`check_delta_v0.1f.py`); independent sim `check_overcrowding_v0.1f.py` (500 seeds, seed bases **2701127** and Tundra's **20261127**); rerun of `sim/overcrowding_sim_v0.1.py` (SEEDS=500) compared to the committed `.out`. Growth model is reading A only (adult at 8 from birth, ANNA-APPROVED). Reading B dropped. No repo edits.

**Overall:** the five v0.1e findings **PASS**. Director's four overcrowding rules are written as the default in the live sections (§1.2, §11.5, §17e.3–17e.4, Q17.13–17.14). Tundra's published sim numbers check out, and an independent reimplementation agrees. Two leftover **§17d** paragraphs still contradict the live rules and should be patched before Flint builds from them. That is a documentation fix, not a reject of the overcrowding default.

| # | Item | Verdict |
|---|---|---|
| 1 | AI rule pinned (rosters 11/10/9, claims 4/3/3, cap 16/12/12, Q17.13 / Q17.14) | **PASS** (now Director-approved as the default; numbers still candidate) |
| 2 | §13.4 rewritten | **PASS** in §13.4. **§17d.3 was not updated** to match (see leftovers). |
| 3 | §1.2 / §1.4 bodies (80-day year, yearly litters; no live 'yearLengthDays null' / 'one litter per run') | **PASS** |
| 4 | §17a header | **PASS** |
| 5 | No remaining fixed birth day 41; `dueAbsDay` = conception + 20; §17b ANNA-APPROVED | **PASS** |

---

## 1. AI rule pinned — PASS

§17e.4 now pins the inputs this spec was missing in v0.1e:

- Rosters Highcrag 11, Bonefield 10, Mistwood 9 (`world-slots.json` at `9de250e`, world-gen §2.4).
- Starting claims from map-v1 §4.2: HC 4 (counting disputed `greywater_ford`, startHolder Highcrag), BF 3, MW 3 → capacity **16 / 12 / 12**.
- Cubs count. Capacity = 4 × regions currently held, recomputed each season check. A held region under contest still counts (§17e.2).
- Q17.13 and Q17.14 have written entries and are **ANSWERED**. On `79b4296` the *rules* are **APPROVED, Director 2026-11-27**; the *numbers* stay **candidate (sim overcrowding v0.1)**.

The approved AI default is the room-limited spring gate plus cross-pride pairing at 0.5 (§17e.4), not the old whole-pride §17d.2 stopgap.

Minor tag inconsistency: in §13.5, only `overcrowd.playerSpringGate` was retagged "APPROVED … value candidate". Capacity, cub-counting, the contentment step/cap, `aiSpringGate` and `aiCrossPridePairChance` still say only "candidate", even though Director approved those four rules as the default. Q17.13–17.14 and §17e.3 are clear; Flint should follow those, not the shorter §13.5 tags.

---

## 2. §13.4 rewrite — PASS (live section)

§13.4 now matches the v0.1e ask:

- `birthAbsDay` = first day of the save's current season − `ageSeasons` × 20 (counted back from the save's current season, not run start). The worked example is correct: a save at absDay 50 is autumn of Year 1 (season start 41), so a cat aged 12 gets 41 − 240 = **−199**. (The v0.1e note that called absDay 50 "summer" was wrong for an 80-day year.)
- `genes.v` is rewritten to 2; no allele, genotype or personality change.
- Aptitude cites **skills §6.1**, with the three cases: premades use authored values (default 100); the player's cat uses Normal(100, sd 5); any other cat uses Normal(100, sd 8). Skills §13.3 is explicitly called out as cub inheritance, not used on load.
- `inheritOnly` when absent is `{}`, matching the §13.1 map shape.
- `frail: false`; overcrowding `{ seasonsOver: 0, lastCheck: null }`.
- §16.2.11 now points at §13.4 / §17d.3.

**Leftover:** §17d.3 still says aptitude is "per skills §13.3 founder rule" and `inheritOnly` false, and its parenthetical still says "counted back from the save's current `absDay`" even though the formula itself uses the season start. §13.4 is the rewritten live rule; §17d.3 should be brought into line so Flint does not implement the old wording.

---

## 3. §1.2 / §1.4 bodies — PASS

Both bodies are rewritten, not merely tagged.

- §1.2: conception on the first spring day the pair is together; `dueAbsDay` = `conceivedAbsDay` + 20; AI and player spring gates of §17e.4 / §17e.3 (the player gate is APPROVED, Director 2026-11-27).
- §1.4: `yearLengthDays` = 80, at most one litter per female per year, living-cubs gate dropped, founder at 12 can have up to 9 yearly litters.

"yearLengthDays null" / "only one litter per run" remain only in the closed Q17.3 question text and in §0.2 source/roadmap rows that already note the supersession (now 80, §17a.1). No live-rule contradiction.

---

## 4. §17a header — PASS

The header now reads: "APPROVED by Director 2026-11-27; 17a.1 year length is ANNA-APPROVED; Q17.2 is closed by §17b." It no longer says Anna still has to confirm 17a.1 or that Q17.2 is with her.

---

## 5. Birth timing and §17b — PASS

No live rule uses a fixed birth day 41. The only "day 41" in the body is the correct autumn *season-start* in the §13.4 example. The changelog mentions the absDay-41 cleanup historically.

`dueAbsDay` = `conceivedAbsDay` + 20 is used consistently in §1.2, §2.1, §2.5, §13.2, §15 (`pregnancy_known` on conceived day, `litter_born` on due day, `litter_lost` if the dam dies before due), §16.1.3 and §16.2.8 (200k rolls: spring day d → birth on d + 20, always a summer year-day 21–40).

§17b is marked **ANNA-APPROVED 2026-11-27**, adulthood is 8 seasons from birth, and the adult-at-12 alternative is withdrawn. hc09 / mw08 stay at 7 so they remain adolescents; the committed `world-slots.json` still reads 8 until that data change lands (already noted in §17b.4).

§10.2 and §12.2 still have superseded-tagged bodies with the withdrawn 1-season cub proposal. That was not in the five required rewrites; residual only.

---

## Director's overcrowding default (v0.1f.1)

The four rules are written as the default in the live sections:

1. Capacity 4 per held region, cubs included, recomputed each season (§11.5, §17e.2).
2. Contentment penalty −5 × `seasonsOver`, capped at −20 a season (§11.5, §17e.2).
3. The player's pride does not conceive in spring while over capacity (§1.2, §11.5, §17e.3, all tagged APPROVED, Director 2026-11-27).
4. AI room-limited gate plus cross-pride pairing at 0.5 (§17e.4, Q17.14 ANSWERED / APPROVED).

**§17d.2 is the stale-body risk.** It is tagged "[Superseded by §17e.3–17e.4 (v0.1f)]", but its body still says: "The player's pride has no such gate; overcrowding costs apply instead." That is the opposite of the approved default. §17e.3 even quotes that phrase as the thing it changes. Rewrite or strike the body; a supersession tag alone is how Flint got the old calendar leftovers in v0.1e.

**Contentment stays put** is stated in the v0.1f.1 changelog and is what the recommendation and the sim assume (accumulator; no decay). §17e.6.1 is still written as an open question and does not itself adopt "stays put" as the interim default. One line there would close the loop.

---

## Sim

**Tundra's script vs her `.out`:** reran `sim/overcrowding_sim_v0.1.py` with SEEDS=500, seed base 20261127. Output is **byte-identical** to the committed `sim/overcrowding_sim_v0.1.out`.

**Independent reimplementation** (`check_overcrowding_v0.1f.py`): same written rules and labelled C1–C11 assumptions, own code, 500 seeds. Primary stream 2701127 (the earlier MATH-CHECK / DELTA-v0.1e base); cross-check on Tundra's 20261127. Medians below use her index rule (`v[int(q*n)]`); an ordinary even-n median is noted only when it differs by ≥ 0.5.

| Claim | Tundra `.out` / §17e | Independent, Tundra seed | Independent, Tracker seed | Verdict |
|---|---|---|---|---|
| Founding pair, no cap, p_out 0, y10 | 26 (20–32) | **26 / 20–32** | 26 / 19–32 | **Agrees.** Earlier MATH-CHECK 25/31 is the same band (4000 runs, slightly different percentile). |
| AI stopgap whole-pride gate, y10 HC/BF/MW | 25 / 18 / 16, max 59 | **25 / 18 / 16**, max 59 | 25 / 18 / 16, max 62 | **Agrees.** The 2-cat drop vs DELTA-v0.1e's 27/19/16 is explained: this sim includes 5% exile / 8% rejoin; the v0.1e provisional did not. hc09/mw08 at 7 does not move the stopgap (it only needs one fertile male). |
| 2-region player holds, approved set, y10 size | 11 (9–14) | **11 / 9–14** | 11 / 8–13 | **Agrees** (plateau ~11; y20 is 10). Capacity is 8; the overshoot is the intended pressure. |
| Warning by y10, same set | 91% | 90.4% | 89.0% | **Agrees** within ~2 points. Her published 91% is from her script. |
| Level reading ("if contentment decays / is recomputed") | 0% warnings by y10 | 1.0% | 0.6% | **Agrees in substance.** No meaningful warning pressure. My code sees a rare warning (≤1%); her published cell is 0%. |
| Ungated player, flat −5, expands, y10 / y20 | 67 (40–97) / **715** (181–1691) | 67 / 40–97, y20 **738** / 184–1652 | 66 / 41–92, y20 **716** / 177–1660 | **Agrees.** The ~715 figure is this row (2 start regions, expand on, no player gate, flat −5). y20 is high-variance; my Tundra-seed median moved a little because constructor/pairing RNG order is not bit-identical. |
| AI room + cross 0.5, y10 / y20, max | 14 / 10 / 10, max **21** / 18 / 18 | **14 / 10 / 10**, max 21 / 18 / 18 | 14 / 10 / 10, max 23 / 18 / 23 | **Agrees.** "Max 21" is the published 500-seed Highcrag peak, not a hard cap (independent seed saw 23). |
| No cross-pride, BF / MW "die out" >50% | <6 at y20: 55% / 69% | 54.8% / 68.6% | 55.6% / 65.4% | **Agrees with the proxy.** Literal size 0 at y20 is only **~5–8%**. "Die out" here means falling below 6, not extinction. Highcrag is not in the same hole (~23–27% below 6). |

Reading A is used throughout. All of the above is Standard.

---

## §17e.6 rule gaps (as listed) plus further gaps

Tundra's five gaps, still open and correctly listed:

1. **Contentment has no decay or baseline.** The recommendation assumes the literal accumulator (a fed cat climbs to 100 and stays there). Director's interim call is that contentment **stays put**; Anna may still overrule. If it is recomputed each season, the recommended −20 cap produces essentially no warning (sim above). Loners-spec still needs one line saying which reading is meant, and §17e.6.1 should state the interim default.
2. **No AI rule brings outside mates into a pride** except the new cross-pride candidate. Without it, Bonefield and Mistwood fall below 6 in more than half of 20-year runs. Relationships-spec needs an owner.
3. **The player's adult cubs need outside mates too.** Siblings cannot pair (r < 0.125). Growth is set by how many mates the player brings in. No rate exists; the sim used C2 (at most one outside mate a spring, chance 0.5).
4. **AI pairing chance and attraction** are not specified for world drift. The sim pairs every eligible cat each spring as an upper bound.
5. **Contested regions:** §17e.2 counts a region only when the pride is `holder` (contest still counts). Flint should confirm the map-v1 field.

Further gaps / inconsistencies to flag:

6. **Litter already conceived, then capacity drops** (lost region, exile, deaths of other members are fine, but a lost hold in summer/autumn is not). The gate is a spring conception check only. A pregnancy already on the dam is not aborted. That should be stated (I recommend: the litter stands; the next spring is gated against the new capacity).
7. **Cross-pride pairing vs the player's mate rules are different systems.** AI C11 can pull an unmated fertile male from another AI pride or the loner pool, and he moves. The player uses C2 (at most one joiner a spring, not taken from a named pride's roster in the player sim). Neither rule says what happens if a cross-pride roll would take a cat from the *player's* pride, or if the player tries to court an AI cat already reserved by C11. This needs a single owner (relationships-spec) and a no-poach / consent rule.
8. **Extinction handling is unspecified.** "Die out" in §17e.4 is the <6-at-year-20 proxy, not size 0 (which is uncommon). There is no rule for an AI pride that hits 0: who holds its regions, whether loners can refound it, and how the map and storyteller treat a dead named pride.
9. **The room gate is not a hard cap on membership.** Conception cannot itself push the pride over capacity, but loner rejoins (8%/season) after the spring check can. Tundra's own recommended row is over capacity in 5–9% of seasons, with a published max of 21 on a cap of 16. §17e.7's test ("no spring's conceived litters push the pride over") is the right conception check; it should not be read as "members never exceed capacity."
10. **The AI overcrowding sim does not apply the contentment / leaving loop** — only natural death plus 5% exile / 8% rejoin. The 14/10/10 hold therefore does not include overcrowding departures. With the room gate, over-cap seasons are rare, so the omission is probably small, but it is a model gap versus the player loop.
11. **§17d.2 and §17d.3 stale bodies**, as above. §17d.4 still says Q17.13–17.14 are "answered by default" rather than Director-approved.

---

## Asks for Tundra (documentation, not a sim redo)

1. Rewrite the body of **§17d.2** so it no longer tells Flint the player has no gate. Point at §17e.3–17e.4.
2. Bring **§17d.3** in line with §13.4 (skills §6.1, `inheritOnly: {}`, season-start not raw absDay).
3. State in **§17e.6.1** that contentment stays put until Anna rules. Retag the remaining §13.5 `overcrowd.*` rows the same way as `playerSpringGate` (rule approved, value candidate). Optional: bump the header from v0.1f to v0.1f.1.
4. In §17e.4, say clearly that "die out" was measured as **below 6 at year 20**, not size 0, and add a line on already-conceived litters when capacity falls.

The approved overcrowding default itself does not need another sim for this check. Q17.6–Q17.12 and the relationships-spec ownership of cross-pride pairing remain open as before.
