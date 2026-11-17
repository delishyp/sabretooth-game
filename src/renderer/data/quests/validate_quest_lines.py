#!/usr/bin/env python3
"""Validate quest-lines-v1.json and quests-mockup-copy.json (Saga).
Checks: JSON shape, known cat/region ids, spec request kinds, 3 lines, one joinEnding, cub-death line with mourning,
2-4 steps, at most one branch, no numerals or number words in prose, no em/en dashes, no saber colour,
no PLACEHOLDER, at most one beat per block, no quote marks or speech tags in say parts, known tokens only,
{catName} never in a narrator block, unique choice label keys, AI-tell phrases. Exit 1 on any error."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = "/workspace/sabretooth"
slots = {s["slot"]: s for s in json.load(open(f"{REPO}/src/renderer/data/world-slots.json"))["slots"]}
regions = {r["id"] for r in json.load(open(f"{REPO}/src/renderer/data/map.json"))["regions"]}
KINDS = {"bring_prey", "scout_region", "drive_off", "carry_word", "find_cub"}
PREY = {"small", "medium", "large"}
TOKENS = {"catName", "playerName", "questgiverName", "cubName", "leaderName", "regionName", "name",
          "askerName", "preySize", "targetName", "prevAsk", "storeWord"}
NUMWORDS = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen "
            "seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand "
            "first second third fourth fifth sixth seventh eighth ninth tenth once twice thrice dozen couple half").split()
NUM_RE = re.compile(r"\b(" + "|".join(NUMWORDS) + r")\b", re.I)
SABER_COLOUR = re.compile(r"\b(sabers?|sabres?|fangs?|teeth|tooth|tusks?)\b[^.]{0,30}\b(white|ivory|yellow|golden|gold|black|red|grey|gray|pale|bone-white|cream|amber|brown)\b|\b(white|ivory|yellow|golden|gold|black|red|grey|gray|pale|bone-white|cream|amber|brown)[- ](sabers?|sabres?|fangs?|teeth)\b", re.I)
TELLS = [r"heartbeat too long", r"something close to", r"lets the silence", r"the silence stretch", r"a beat too long"]
SPEECH_TAGS = re.compile(r"(\{catName\}|\{questgiverName\}|\{leaderName\}|\{cubName\}|\bhe|\bshe)\s+(says|said|asks|asked|replies|replied|whispers|whispered|murmurs|murmured|adds|added)\b", re.I)
errors, warns = [], []
def err(where, msg): errors.append(f"{where}: {msg}")
def warn(where, msg): warns.append(f"{where}: {msg}")

def check_text(where, t, kind):
    if not isinstance(t, str) or not t.strip(): err(where, "empty text"); return
    if re.search(r"\d", t): err(where, f"numeral in prose: {t!r}")
    m = NUM_RE.search(t)
    if m: err(where, f"number word '{m.group(0)}': {t!r}")
    if "\u2014" in t or "\u2013" in t: err(where, f"em/en dash: {t!r}")
    if "PLACEHOLDER" in t.upper(): err(where, "PLACEHOLDER left")
    if SABER_COLOUR.search(t): err(where, f"saber colour: {t!r}")
    for tl in TELLS:
        if re.search(tl, t, re.I): err(where, f"AI tell '{tl}': {t!r}")
    if kind in ("beat", "say") and SPEECH_TAGS.search(t): err(where, f"speech tag: {t!r}")
    for tok in re.findall(r"\{([^}]*)\}", t):
        if tok not in TOKENS: err(where, f"unknown token {{{tok}}}")
    if kind == "say" and re.search(r"[\"“”‘]", t): err(where, f"quote mark in say part: {t!r}")
    if re.search(r"\b\w+, \w+,? and \w+\b", t): warn(where, f"possible list of three: {t!r}")

def check_block(where, blk, allow_ids):
    if not isinstance(blk, dict) or set(blk) != {"speaker", "parts"}: err(where, "block must be exactly {speaker, parts}"); return
    sp = blk["speaker"]
    if sp != "narrator" and sp not in allow_ids: err(where, f"unknown speaker {sp}")
    parts = blk["parts"]
    if not isinstance(parts, list) or not parts: err(where, "parts must be a non-empty list"); return
    beats = 0
    for i, p in enumerate(parts):
        if not isinstance(p, dict) or len(p) != 1 or next(iter(p)) not in ("beat", "say"):
            err(f"{where}.parts[{i}]", "part must be {beat} or {say}"); continue
        k, t = next(iter(p.items()))
        beats += k == "beat"
        if sp == "narrator" and k == "say": err(f"{where}.parts[{i}]", "narrator block has a say part")
        if sp == "narrator" and "{catName}" in t: err(f"{where}.parts[{i}]", "{catName} in narrator block")
        check_text(f"{where}.parts[{i}]", t, k)
    if beats > 1: err(where, f"{beats} beats in one block (max 1)")

def walk(where, node, allow_ids, keys):
    """Recurse: any dict with speaker+parts is a block; any dict with labelKey is a choice."""
    if isinstance(node, list):
        for i, x in enumerate(node): walk(f"{where}[{i}]", x, allow_ids, keys)
    elif isinstance(node, dict):
        if "speaker" in node and "parts" in node:
            check_block(where, node, allow_ids); return
        if "labelKey" in node:
            for f in ("id", "label"):
                if f not in node: err(where, f"choice missing {f}")
            if node["labelKey"] in keys: err(where, f"duplicate labelKey {node['labelKey']}")
            keys.add(node["labelKey"])
            check_text(f"{where}.label", node.get("label", ""), "label")
            if "reply" in node: check_block(f"{where}.reply", node["reply"], allow_ids)
            return
        for k, v in node.items():
            if k.startswith("_"): continue
            if k == "gossip": check_text(f"{where}.gossip", v, "gossip")
            elif k in ("title",): check_text(f"{where}.{k}", v, k)
            else: walk(f"{where}.{k}", v, allow_ids, keys)

# ---- quest lines
ql = json.load(open(os.path.join(HERE, "quest-lines-v1.json")))
lines = ql.get("lines", [])
if len(lines) != 3: err("lines", f"need 3 lines, got {len(lines)}")
ids = [l["id"] for l in lines]
if len(set(ids)) != len(ids): err("lines", "duplicate line ids")
if sum(1 for l in lines if l.get("joinEnding")) != 1: err("lines", "exactly one line must have joinEnding: true")
keys = set()
for l in lines:
    w = l["id"]
    for f in ("id", "title", "questgiver", "motiveSource", "steps", "closing", "joinEnding", "reputationAxis"):
        if f not in l: err(w, f"missing {f}")
    qg = l["questgiver"]
    if qg not in slots: err(w, f"unknown questgiver {qg}")
    if qg not in l["motiveSource"]: err(w, "motiveSource doesn't cite the questgiver slot")
    if l["reputationAxis"] not in ("honour", "courage", "mercy"): err(w, "bad reputationAxis")
    for role, cid in (l.get("cast") or {}).items():
        if cid not in slots: err(w, f"cast {role} unknown id {cid}")
    if not 2 <= len(l["steps"]) <= 4: err(w, "a line needs 2 to 4 steps")
    nbranch = sum(1 for st in l["steps"] if "delivery" in st and isinstance(st.get("success"), dict) and len(st["success"]) > 1)
    if (l.get("branch") is None) != (nbranch == 0) or nbranch > 1: err(w, f"branch declaration doesn't match steps ({nbranch} branching steps; max 1)")
    if l.get("branch"):
        if sum(1 for o in l["branch"]["options"].values() if o.get("best")) != 1: err(w, "branch needs exactly one best option")
    allow = set(slots)
    for st in l["steps"]:
        sw = f"{w}.step{st['step']}"
        if st["kind"] not in KINDS: err(sw, f"unknown kind {st['kind']}")
        if "region" in st and st["region"] not in regions: err(sw, f"unknown region {st['region']}")
        if st["kind"] in ("scout_region", "drive_off", "find_cub") and "region" not in st: err(sw, "needs region")
        if st["kind"] == "carry_word":
            if st.get("target") not in slots: err(sw, "carry_word needs a known target")
            if "fact" not in st: err(sw, "carry_word needs a fact")
            if "delivery" not in st: err(sw, "carry_word needs a delivery scene")
            if "third_pride" not in st.get("fail", {}): err(sw, "carry_word needs a third_pride fail")
            known = st.get("requiresPlayerKnows")
            earlier = [x.get("writes", {}).get("fact") for x in l["steps"] if x["step"] < st["step"] and isinstance(x.get("writes"), dict)]
            if known != st.get("fact") or known not in earlier: err(sw, "carry_word must deliver a fact an earlier step gave the player (§3.9.7)")
        if st["kind"] == "bring_prey" and st.get("preySize") not in PREY: err(sw, "bring_prey needs preySize")
        if st["kind"] == "drive_off" and "fled" not in st.get("fail", {}): err(sw, "drive_off needs a fled fail")
        if st["kind"] == "find_cub":
            if slots.get(st.get("cub"), {}).get("stage") != "cub": err(sw, "find_cub target must be a cub slot")
            mo = st.get("fail", {}).get("mourning")
            if not mo: err(sw, "find_cub fail needs a mourning scene")
            if f"cub_lost_{st.get('cub')}" not in st.get("fail", {}).get("writes", []): err(sw, "find_cub fail must write cub_lost_{catId}")
            do = st.get("declineOutcome", {})
            if do.get("cubDies") is not False: err(sw, "declined find_cub must not kill the cub (§3.9.2)")
            if not st.get("fail", {}).get("onlyIfAccepted"): err(sw, "cub death must be gated on an accepted search")
        for f in ("opener", "choices", "fail"):
            if f not in st: err(sw, f"missing {f}")
        cids = {c["id"] for c in st.get("choices", [])}
        if not {"accept", "decline"} <= cids: err(sw, "needs accept and decline choices")
        if "deadline" not in st.get("fail", {}): err(sw, "needs a deadline fail")
    if l.get("joinEnding"):
        j = l["closing"].get("join")
        if not j: err(w, "join line needs closing.join")
        elif f"left_for_player_{qg}" not in j.get("writes", []): err(w, "join must write left_for_player_{catId}")
        elif not j.get("oldPrideReaction", {}).get("gossip"): err(w, "join needs old-pride gossip")
        if j and (j["when"].get("questgiverValueMin") != 75 or j["when"].get("usesCourtshipInterest") is not False or j["when"].get("playerHasPride") is not True): err(w, "join gate must be value >= 75, no Interest, own pride (§3.9.1)")
        if not l["closing"].get("stay", {}).get("countsAsKept"): err(w, "no-pride stay ending must count as kept (§3.9.6)")
        best = [k for k, o in l["branch"]["options"].items() if o.get("best")]
        if not j or j["when"].get("branch") not in best: err(w, "join must sit on the best branch")
    walk(w, l, allow, keys)
if not any(l.get("cubDeath") for l in lines): err("lines", "no cub-death line")
if any(l.get("cubDeath") and l.get("joinEnding") for l in lines): err("lines", "cub death and join must be different lines")

# ---- mockup copy
mc = json.load(open(os.path.join(HERE, "quests-mockup-copy.json")))
for k, v in mc["strings"].items():
    if v == "": continue
    check_text(f"mock.strings.{k}", v, "ui")
for page, d in mc["stills"].items():
    def scan(where, x):
        if isinstance(x, dict):
            if "speaker" in x and "parts" in x: check_block(where, x, set(slots)); return
            for k, v in x.items():
                if k in ("slot", "portrait", "pips", "choiceKeys"): continue
                scan(f"{where}.{k}", v)
        elif isinstance(x, list):
            for i, v in enumerate(x): scan(f"{where}[{i}]", v)
        elif isinstance(x, str): check_text(where, x, "ui")
    scan(f"mock.stills.{page}", d)

print(f"lines: {len(lines)} | choices: {len(keys)} | errors: {len(errors)} | warnings: {len(warns)}")
for e in errors: print("ERROR", e)
for x in warns: print("WARN ", x)
sys.exit(1 if errors else 0)
