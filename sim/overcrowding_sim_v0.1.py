#!/usr/bin/env python3
"""Overcrowding sim v0.1 (Tundra, 2026-11-27). Seeded, stdlib only.
Backs docs/design/breeding-cubs-v0.1.md §17e (Q17.13 overcrowding numbers, Q17.14 AI-pride breeding gate).

Rules used as written (source in brackets):
  year 80 days = 4 seasons (§17a.1); age +1 each season start; cub 0-3, adolescent 4-7, adult 8+, elder 40+ (§17b.1)
  conception on spring day for every mated fertile pair, female not pregnant, F<=44 M<=48 (§1.1, §17b.2, §17d.1)
  birth in summer (conception+20); litter lost if dam dies first (§2.5, §17b.2); litter 1..7 = 8/18/26/22/14/8/4 (§2.2)
  death per season, Standard: cub 4%, adolescent/adult 0.5%, elder 2% at 40 seasons +2%/yr cap 40% (§10.5, lifecycle §4)
  incest gate r < 0.125 for any mates bond (relationships §1.7), pedigree kinship
  AI pairing only in spring, in-pride (relationships §5.2, formulas §2.4)
  contentment 0-100, inputs per season: fed +10, mate +10, close tie +3 (max 9), hostile tie -4 (max -12),
    role fits +5, loyalty (prideLoyalty-50)/5 with born 70 / recruited 50 (loners §3.4, §6.4, relationships §5.1)
  start contentment pride 60 / loner 50 (world-gen §7.1); Mood has no decay (needs §1.6) -> accumulator reading
  Standard leaving: <25 for 2 seasons -> warning 1 season -> 30%/season, x leave mults (loners §6.4, relationships §5.3)
  Sim leaving: <35 1 season -> warning -> 40%; dispersal 50% for young males at adult (loners §6.4)
  mate and heir never leave in Standard (Sim: only below 15) (loners §6.4)
  AI world drift: each pride 5%/season loses 1 cat to the loner pool; each loner 8%/season rejoins (loners §6.1-6.2)
  start rosters world-slots.json (HC 11, BF 10, MW 9, 9 loners; hc09/mw08 at 7 per §17b.4); start mates hc01-hc03,
    hc02-hc06, bf01-bf04, mw02-mw04 (world-gen §2.4); start claims HC 4 (incl. disputed ford) / BF 3 / MW 3 (map-v1 §4.2)
  capacity = capacityPerRegion x regions held, checked once a season (§11.5)

CANDIDATE assumptions (no rule exists; labelled in the spec):
  C1 static per-cat inputs: role fits 50%; close ties Binomial(3,.3) born / (3,.15) joined; hostile Binomial(3,.1)
  C2 player pride: at most ONE outside mate joins per spring (the world has a finite loner pool, world-gen 9 loners,
     loners §6.1-6.2), with chance p_out (default .5), paired to a random unmated fertile adult that has no unrelated
     pride partner; the player cat, if unmated, re-mates first with .5. Outside mates join at age 12-20.
  C9 optional player-pride spring gates (tested as the missing birth brake): pgate='proposed' = §17d.2 rule applied to
     the player (no conception while members > capacity at spring); pgate='room' = C8; pgate='soft' = C10
  C10 soft gate (pgate/gate='soft'): over capacity, each pair conceives with chance (capacity / members)^2
  C11 cross-pride pairing (xmate=px): a fertile unmated female with no unrelated partner at home pairs, with chance px
      per spring, with an unrelated unmated fertile male from another pride or the loner pool; he moves to her pride
  SAFETY: births are skipped once a pride passes 1500 cats (only reached by unbraked rows; flagged by the size itself)
  C3 AI pairing: every unmated fertile adult pairs each spring if an unrelated unmated partner exists (upper bound;
     attraction ignored)
  C4 expansion (when on): after 2 seasons over, the player claims +1 region with 50%/season, max 7 regions, needs
     adults+elders >= regions+1 (map-v1 §9.3 over-claim strain)
  C5 heir = oldest pride-born adolescent+ (not the player); when the player dies the heir becomes the player
  C6 level reading (sensitivity only): contentment = 40 + this season's inputs (40 calibrates a typical fed cat to ~60)
  C7 escalating penalty: -min(k x seasonsOver, cap); seasonsOver resets to 0 at or under capacity
  C8 room-limited AI gate: in random pair order, a pair conceives only if members + cubs already conceived this spring
     + this litter <= capacity (litter is rolled at conception, §2.2)
"""
import random, statistics as st, sys, json, os
from multiprocessing import Pool

LW = [8,18,26,22,14,8,4]
SEED0 = 20261127
SEEDS = int(os.environ.get('SEEDS', 500))
YEARS = 20

def pctl(v, q):
    v = sorted(v); return v[min(len(v)-1, int(q*len(v)))]
def med(v): return pctl(v, .5)

class World:
    def __init__(s, rng):
        s.rng = rng; s.nid = 0; s.par = {}; s.kin = {}
    def new_id(s, sire=None, dam=None):
        s.nid += 1; s.par[s.nid] = (sire, dam); return s.nid
    def f(s, a, b):  # kinship coefficient
        if a is None or b is None: return 0.0
        if a == b:
            sr, dm = s.par[a]; return 0.5 * (1 + s.f(sr, dm))
        if a < b: a, b = b, a
        key = (a, b)
        if key in s.kin: return s.kin[key]
        sr, dm = s.par[a]
        v = 0.0 if (sr is None and dm is None) else 0.5 * (s.f(sr, b) + s.f(dm, b))
        s.kin[key] = v; return v
    def r(s, a, b): return 2 * s.f(a, b)

def death_p(age, cubmult=1.0):
    if age < 4: return 0.04 * cubmult
    if age < 40: return 0.005
    return min(0.40, 0.02 + 0.02 * ((age - 40) // 4))

def litter(rng): return rng.choices(range(1, 8), weights=LW)[0]

class Cat:
    __slots__ = ('id','sex','age','mate','preg','born','close','hostile','role','loy','c','low','alive','player','warned')
    def __init__(s, w, sex, age, sire=None, dam=None, born=True, c=60):
        s.id = w.new_id(sire, dam); s.sex = sex; s.age = age; s.mate = None; s.preg = 0; s.born = born
        rng = w.rng
        p = .3 if born else .15
        s.close = sum(rng.random() < p for _ in range(3))
        s.hostile = sum(rng.random() < .1 for _ in range(3))
        s.role = 5 if rng.random() < .5 else 0
        s.loy = 4 if born else 0
        s.c = c; s.low = 0; s.alive = True; s.player = False; s.warned = 0

def fertile(c): return c.age >= 8 and c.age <= (44 if c.sex == 'F' else 48)

def pair_up(w, cats, rng):
    """spring pairing among unmated fertile adults, r < 0.125 (relationships §1.7, §5.2)."""
    by = {x.id: x for x in cats}
    for x in cats:
        if x.mate is not None and (x.mate not in by): x.mate = None
    fem = [x for x in cats if x.sex == 'F' and x.mate is None and fertile(x)]
    mal = [x for x in cats if x.sex == 'M' and x.mate is None and fertile(x)]
    rng.shuffle(fem); rng.shuffle(mal)
    for fcat in fem:
        for m in mal:
            if m.mate is None and w.r(fcat.id, m.id) < 0.125:
                fcat.mate = m.id; m.mate = fcat.id; break
    return [x for x in fem if x.mate is None] + [x for x in mal if x.mate is None]

def conceive_pairs(cats):
    by = {x.id: x for x in cats}
    out = []
    for x in cats:
        if x.sex == 'F' and x.preg == 0 and x.mate in by and fertile(x) and fertile(by[x.mate]):
            out.append((x, by[x.mate]))
    return out

def penalty(mode, k, cap, so):
    if so <= 0: return 0
    if mode == 'flat': return -k
    return -min(k * so, cap)

# ---------------------------------------------------------------- player pride
def run_player(cfg, seed):
    rng = random.Random(SEED0 * 1000 + seed); w = World(rng)
    regions = cfg['regions']; cpr = cfg['cpr']; style = cfg.get('style', 'Standard')
    pmode, pk, pcap = cfg['pen']
    p_out = cfg.get('p_out', .5); level = cfg.get('level', False); count_cubs = cfg.get('count_cubs', True)
    respond = cfg.get('respond', 0); expand = cfg['expand']
    a = Cat(w, 'F', 12, born=False); b = Cat(w, 'M', 12, born=False)
    a.player = True; a.mate = b.id; b.mate = a.id; a.loy = b.loy = 4
    cats = [a, b]; so = 0
    yr = {'size': [], 'adults': [], 'regions': []}
    over_seasons = 0; first_over = None; first_warn = None; departures = 0; warns = 0
    dep_log = []; peak = 2; exodus = False; ended = False
    for y in range(YEARS):
        for s in range(4):
            t = y * 4 + s
            if t > 0:
                for c in cats: c.age += 1
            byid = {c.id: c for c in cats}
            if s == 0:  # spring: pairing then conception (§17b.2)
                left = [x for x in pair_up(w, cats, rng) if fertile(x)]
                pl = [x for x in left if x.player]
                if pl and rng.random() < .5: x = pl[0]
                else:
                    rest = [x for x in left if not x.player]
                    x = rng.choice(rest) if (rest and rng.random() < p_out) else None
                if x is not None:
                    o = Cat(w, 'M' if x.sex == 'F' else 'F', rng.randint(12, 20), born=False, c=50)
                    o.mate = x.id; x.mate = o.id; cats.append(o)
                pairs = conceive_pairs(cats); rng.shuffle(pairs)
                room = cpr * regions - (len(cats) if count_cubs else sum(c.age >= 4 for c in cats))
                for f_, m_ in pairs:
                    if len(cats) > 1500: break
                    L = litter(rng)
                    pg = cfg.get('pgate')
                    if pg == 'room':
                        if L > room: continue
                        room -= L
                    elif pg == 'proposed' and room < 0: continue
                    elif pg == 'soft' and room < 0 and rng.random() >= (cpr * regions / (cpr * regions - room)) ** 2: continue
                    f_.preg = L
            if s == 1:  # summer births
                new = []
                for c in cats:
                    if c.preg:
                        for _ in range(c.preg): new.append(Cat(w, rng.choice('MF'), 0, c.mate, c.id, True, 60))
                        c.preg = 0
                cats += new
            # deaths
            cm = 1.5 if style == 'Sim' else 1.0
            cats = [c for c in cats if rng.random() >= death_p(c.age, cm)]
            byid = {c.id: c for c in cats}
            for c in cats:
                if c.mate is not None and c.mate not in byid: c.mate = None
            # player succession (C5)
            if not any(c.player for c in cats):
                cand = sorted([c for c in cats if c.age >= 4 and c.born], key=lambda c: -c.age) or \
                       sorted([c for c in cats if c.age >= 4], key=lambda c: -c.age)
                if not cand: ended = True; break
                cand[0].player = True
            player = next(c for c in cats if c.player)
            heirs = sorted([c for c in cats if c.born and c.age >= 4 and not c.player], key=lambda c: -c.age)
            heir = heirs[0].id if heirs else None
            # overcrowding check, once a season (§11.5)
            n = len(cats) if count_cubs else sum(c.age >= 4 for c in cats)
            capn = cpr * regions
            if n > capn:
                so += 1; over_seasons += 1
                if first_over is None: first_over = t
            else:
                so = 0
            pen = penalty(pmode, pk, pcap, so)
            adults_start = sum(c.age >= 8 for c in cats)
            leavers = []
            warned_now = []
            for c in cats:
                inp = 10 + c.loy + c.role + min(9, 3 * c.close) - min(12, 4 * c.hostile) + (10 if c.mate in byid else 0)
                if c.age >= 8: inp += pen
                c.c = max(0, min(100, (40 + inp) if level else (c.c + inp)))
                if c.age < 8 or c.player: continue
                thr = 35 if style == 'Sim' else 25
                if c.c < thr: c.low += 1
                else: c.low = 0; c.warned = 0
                need_warn = 1 if style == 'Sim' else 2
                if c.low == need_warn:
                    warns += 1; warned_now.append(c)
                    if first_warn is None: first_warn = t
                if c.low > need_warn:
                    prot = (c.id == player.mate or c.id == heir)
                    if prot and (style != 'Sim' or c.c >= 15): continue
                    mult = (1 + .15 * c.hostile) * (1 - .2 * c.close)
                    mult = max(.4, min(1.6, mult))
                    if c.mate in byid or (c.born and c.close > 0): mult *= .7
                    if rng.random() < (0.40 if style == 'Sim' else 0.30) * mult: leavers.append(c)
            # player responses (C: once per season per cat, +10 midpoint of +5..+15)
            if respond:
                for c in sorted(warned_now + [c for c in cats if c.low > 2 and c not in leavers], key=lambda c: c.c)[:respond]:
                    c.c = min(100, c.c + 10)
            if style == 'Sim':
                males = [c for c in cats if c.sex == 'M' and c.age >= 8]
                for c in cats:
                    if c.sex == 'M' and c.born and c.age in (8, 9) and c.id != heir and not c.player and len(males) > 1 \
                       and rng.random() < .29:  # 50% within 2 seasons
                        leavers.append(c)
            if leavers:
                ids = {c.id for c in leavers}; departures += len(ids)
                dep_log.append((t, len(ids), adults_start))
                cats = [c for c in cats if c.id not in ids]
                for c in cats:
                    if c.mate in ids: c.mate = None
            # expansion (C4)
            if expand and so >= 2 and regions < 7 and sum(c.age >= 8 for c in cats) >= regions + 1 and rng.random() < .5:
                regions += 1; so = 0
            peak = max(peak, len(cats))
        if ended: break
        yr['size'].append(len(cats)); yr['adults'].append(sum(c.age >= 8 for c in cats)); yr['regions'].append(regions)
    while len(yr['size']) < YEARS:
        yr['size'].append(0); yr['adults'].append(0); yr['regions'].append(regions)
    # exodus: >= 1/3 of adults (and >= 3 cats) leave within any 4-season window
    for i, (t, k, ad) in enumerate(dep_log):
        tot = sum(k2 for t2, k2, _ in dep_log if t <= t2 < t + 4)
        if tot >= 3 and tot >= ad / 3: exodus = True; break
    dep10 = sum(k for t, k, _ in dep_log if t < 40)
    return dict(cpr=cpr, yr=yr, over=over_seasons, first_over=first_over, first_warn=first_warn, dep=departures, dep10=dep10,
                warns=warns, exodus=exodus, peak=peak, ended=ended)

# ---------------------------------------------------------------- AI prides
SLOTS = None
def load_slots():
    here = os.path.dirname(os.path.abspath(__file__))
    d = json.load(open(os.path.join(here, '..', 'src', 'renderer', 'data', 'world-slots.json')))['slots']
    return d
START_MATES = [('hc01','hc03'),('hc02','hc06'),('bf01','bf04'),('mw02','mw04')]
START_REGIONS = {'highcrag': 4, 'bonefield': 3, 'mistwood': 3}  # map-v1 §4.2
PRIDES = ['highcrag', 'bonefield', 'mistwood']

def cross_pair(w, prides, pool, px, rng):
    """C11: a fertile unmated female with no unrelated partner at home pairs, with chance px per spring, with an
    unrelated unmated fertile male from another pride or the loner pool; he moves to her pride."""
    for p in PRIDES:
        fem = [c for c in prides[p] if c.sex == 'F' and c.mate is None and fertile(c)]
        rng.shuffle(fem)
        for f_ in fem:
            if rng.random() >= px: continue
            src = [(q, m) for q in PRIDES if q != p for m in prides[q]] + [(None, m) for m in pool]
            src = [(q, m) for q, m in src if m.sex == 'M' and m.mate is None and fertile(m) and w.r(f_.id, m.id) < 0.125]
            if not src: continue
            q, m = rng.choice(src)
            if q is None: pool.remove(m)
            else: prides[q].remove(m)
            prides[p].append(m); m.mate = f_.id; f_.mate = m.id

def run_world(cfg, seed):
    rng = random.Random(SEED0 * 7919 + seed); w = World(rng)
    cpr = cfg['cpr']; gate = cfg['gate']; mode = cfg.get('mode', 'pairs'); pad = cfg.get('pad', 0)
    regs = dict(cfg.get('regions') or START_REGIONS)
    prides = {p: [] for p in PRIDES}; pool = []; sid = {}
    for sl in SLOTS:
        age = sl['ageSeasons']
        if sl['slot'] in ('hc09', 'mw08'): age = 7  # §17b.4
        c = Cat(w, sl['sex'][0].upper(), age, born=True, c=60)
        sid[sl['slot']] = c
        (pool if sl['faction'] == 'loner' else prides[sl['faction']]).append(c)
    for a_, b_ in START_MATES: sid[a_].mate = sid[b_].id; sid[b_].mate = sid[a_].id
    for p in PRIDES:
        k = 0
        while len(prides[p]) < pad:
            prides[p].append(Cat(w, 'FM'[k % 2], 14 + 2 * (k % 5), born=True)); k += 1
    origin = {}
    sizes = {p: [] for p in PRIDES}; over = {p: 0 for p in PRIDES}; peak = {p: 0 for p in PRIDES}
    for y in range(YEARS):
        for s in range(4):
            t = y * 4 + s
            if t > 0:
                for c in pool: c.age += 1
                for p in PRIDES:
                    for c in prides[p]: c.age += 1
            if s == 0 and mode == 'pairs':
                for p in PRIDES: pair_up(w, prides[p], rng)
                if cfg.get('xmate', 0): cross_pair(w, prides, pool, cfg['xmate'], rng)
            for p in PRIDES:
                cats = prides[p]; capn = cpr * regs[p]
                if s == 0:
                    if mode == 'pairs':
                        pairs = conceive_pairs(cats)
                    else:  # Tracker's stopgap: every fertile female breeds if any fertile male exists
                        males = [c for c in cats if c.sex == 'M' and fertile(c)]
                        pairs = [(c, males[0]) for c in cats if c.sex == 'F' and fertile(c) and c.preg == 0] if males else []
                    rng.shuffle(pairs)
                    if len(cats) > 1500: pairs = []
                    if gate == 'none':
                        for f_, m_ in pairs: f_.preg = litter(rng)
                    elif gate == 'proposed':  # §17d.2: conceive only while at or under capacity (checked at spring)
                        if len(cats) <= capn:
                            for f_, m_ in pairs: f_.preg = litter(rng)
                    elif gate == 'soft':  # C10
                        for f_, m_ in pairs:
                            if len(cats) <= capn or rng.random() < (capn / len(cats)) ** 2: f_.preg = litter(rng)
                    elif gate == 'room':  # C8
                        room = capn - len(cats)
                        for f_, m_ in pairs:
                            L = litter(rng)
                            if L <= room: f_.preg = L; room -= L
                if s == 1:
                    new = []
                    for c in cats:
                        if c.preg:
                            sire = c.mate if mode == 'pairs' else None
                            for _ in range(c.preg): new.append(Cat(w, rng.choice('MF'), 0, sire, c.id, True, 60))
                            c.preg = 0
                    cats += new
                cats = [c for c in cats if rng.random() >= death_p(c.age)]
                byid = {c.id for c in cats}
                for c in cats:
                    if c.mate is not None and c.mate not in byid: c.mate = None
                # world drift exile 5% (loners §6.2)
                el = [c for c in cats if c.age >= 4]
                if el and rng.random() < .05:
                    x = rng.choice(el); cats.remove(x); x.mate = None; pool.append(x); origin[x.id] = p
                    for c in cats:
                        if c.mate == x.id: c.mate = None
                prides[p] = cats
                if len(cats) > capn: over[p] += 1
                peak[p] = max(peak[p], len(cats))
            pool = [c for c in pool if rng.random() >= death_p(c.age)]
            stay = []
            for c in pool:  # loner rejoin 8% (loners §6.1)
                if rng.random() < .08:
                    p = origin.get(c.id) or rng.choice(PRIDES)
                    c.mate = None; prides[p].append(c)
                else: stay.append(c)
            pool = stay
        for p in PRIDES: sizes[p].append(len(prides[p]))
    return dict(sizes=sizes, over=over, peak=peak, pool=len(pool))

# ---------------------------------------------------------------- drivers
def _p(args): return run_player(*args)
def _w(args): return run_world(*args)

def player_grid(pool, cfg):
    return pool.map(_p, [(cfg, s) for s in range(SEEDS)], chunksize=10)

def summarise_player(res, years=(5, 10, 15, 20)):
    out = {}
    for y in years:
        v = [r['yr']['size'][y-1] for r in res]; out[f'y{y}'] = (med(v), pctl(v, .1), pctl(v, .9))
    out['reg20'] = med([r['yr']['regions'][19] for r in res]); out['reg10'] = med([r['yr']['regions'][9] for r in res])
    out['over%'] = 100 * st.mean(r['over'] for r in res) / (YEARS * 4)
    fo = [r['first_over'] for r in res if r['first_over'] is not None]
    out['firstOverY'] = (med(fo) / 4 + 1) if fo else None
    fw = [r['first_warn'] for r in res if r['first_warn'] is not None]
    out['firstWarnY'] = (med(fw) / 4 + 1) if fw else None
    out['warn10%'] = 100 * sum(r['first_warn'] is not None and r['first_warn'] < 40 for r in res) / len(res)
    out['dep10%'] = 100 * sum(r['dep10'] > 0 for r in res) / len(res)
    out['dep20'] = st.mean(r['dep'] for r in res)
    out['exodus%'] = 100 * sum(r['exodus'] for r in res) / len(res)
    out['ended%'] = 100 * sum(r['ended'] for r in res) / len(res)
    out['small20%'] = 100 * sum(r['yr']['size'][19] < r['cpr'] * r['yr']['regions'][19] / 2 for r in res) / len(res)
    return out

def fmt_p(name, o):
    f = lambda t: f'{t[0]}/{t[1]}-{t[2]}'
    fw = f"{o['firstWarnY']:.1f}" if o['firstWarnY'] else '-'
    fo = f"{o['firstOverY']:.1f}" if o['firstOverY'] else '-'
    return (f"  {name:<34} y5 {f(o['y5']):<9} y10 {f(o['y10']):<9} y20 {f(o['y20']):<10} reg10/20 {o['reg10']}/{o['reg20']} "
            f"over {o['over%']:4.0f}% 1stOver y{fo} 1stWarn y{fw} warn<=y10 {o['warn10%']:3.0f}% "
            f"dep<=y10 {o['dep10%']:3.0f}% dep/20y {o['dep20']:4.1f} wave {o['exodus%']:3.0f}% <half-cap y20 {o['small20%']:3.0f}%")

def summarise_world(res):
    out = {}
    for p in PRIDES:
        d = {}
        for y in (5, 10, 20):
            v = [r['sizes'][p][y-1] for r in res]; d[f'y{y}'] = (med(v), pctl(v, .1), pctl(v, .9))
        v10 = [r['sizes'][p][9] for r in res]; v20 = [r['sizes'][p][19] for r in res]
        d['band10'] = 100 * sum(8 <= x <= 20 for x in v10) / len(v10)
        d['band20'] = 100 * sum(8 <= x <= 20 for x in v20) / len(v20)
        d['low20'] = 100 * sum(x < 6 for x in v20) / len(v20)
        d['over%'] = 100 * st.mean(r['over'][p] for r in res) / (YEARS * 4)
        d['max'] = max(r['peak'][p] for r in res)
        out[p] = d
    return out

def fmt_w(name, out):
    f = lambda t: f'{t[0]}/{t[1]}-{t[2]}'
    lines = [f'  {name}']
    for p in PRIDES:
        d = out[p]
        lines.append(f"    {p:<9} y5 {f(d['y5']):<10} y10 {f(d['y10']):<10} y20 {f(d['y20']):<10} in 8-20: y10 {d['band10']:3.0f}% y20 {d['band20']:3.0f}% "
                     f"| <6 at y20 {d['low20']:3.0f}% | over cap {d['over%']:3.0f}% of seasons | max {d['max']}")
    return '\n'.join(lines)

if __name__ == '__main__':
    SLOTS = load_slots()
    P = lambda *a: print(*a, flush=True)
    PENS = [('flat', 3, 0), ('flat', 5, 0), ('flat', 8, 0), ('esc', 3, 30), ('esc', 5, 30), ('esc', 8, 30)]
    pn = lambda pen: (f'flat -{pen[1]}' if pen[0] == 'flat' else f'-{pen[1]} x seasonsOver, max -{pen[2]}')
    with Pool(8, initializer=globals().__setitem__, initargs=('SLOTS', SLOTS)) as pool:
        run = lambda cfg: summarise_player(player_grid(pool, cfg))
        P('=' * 120)
        P(f'Overcrowding sim v0.1 | seed base {SEED0} | {SEEDS} seeds per row | {YEARS} years (y5/y10/y15/y20 = same runs)')
        P('Player cells: median/p10-p90 pride size (cubs count unless marked). reg10/20 = median regions held. over = % of seasons')
        P('over capacity. 1stOver / 1stWarn = median year of the first overcrowded season / first warning sign (among runs')
        P('where it happens). warn<=y10 / dep<=y10 = runs with a warning sign / a departure by year 10. dep/20y = mean cats')
        P('leaving under loners §6.4 in 20 years. wave = runs where >=1/3 of adults (and >=3 cats) leave within 4 seasons.')
        P('<half-cap y20 = runs ending below half of capacity (collapse proxy). Standard, accumulator reading, p_out .5 (C2).')

        P('=' * 120); P('O0 Calibration, no capacity: founding pair only (p_out 0) should match Tracker MATH-CHECK (y10 25/31)')
        for po in (0, .25, .5):
            P(fmt_p(f'no cap, p_out {po}', run(dict(regions=99, cpr=4, pen=('flat', 0, 0), expand=False, p_out=po))))

        P('=' * 120); P('O1 Player pride, v0.1e rule (no conception gate for the player), capacity 4/region, penalties')
        for expand in (False, True):
            for regions in (1, 2, 3):
                P(f'-- start regions {regions}, {"player expands (C4)" if expand else "no expansion"}')
                for pen in PENS:
                    P(fmt_p(f'cap 4, {pn(pen)}', run(dict(regions=regions, cpr=4, pen=pen, expand=expand))))

        P('=' * 120); P('O2 Player pride WITH the §17d.2 spring gate (C9 proposed): capacity 3/4/5 x penalties')
        for expand in (False, True):
            for regions in (1, 2, 3):
                P(f'-- start regions {regions}, {"player expands (C4)" if expand else "no expansion"}')
                for cpr in (3, 4, 5):
                    for pen in PENS:
                        P(fmt_p(f'cap {cpr}, {pn(pen)}', run(dict(regions=regions, cpr=cpr, pen=pen, expand=expand, pgate='proposed'))))

        P('=' * 120); P('O3 Escalation max sensitivity (gate on, cap 4, -5 x seasonsOver), 2 regions')
        for c in (15, 20, 30, 50):
            for expand in (False, True):
                P(fmt_p(f'max -{c}, {"expand" if expand else "fixed"}', run(dict(regions=2, cpr=4, pen=('esc', 5, c), expand=expand, pgate='proposed'))))

        P('=' * 120); P('O4 Sensitivity at the recommended set (gate on, cap 4, -5 x seasonsOver max -20), 2 regions')
        base = dict(regions=2, cpr=4, pen=('esc', 5, 20), pgate='proposed')
        for nm, extra in [('recommended', {}), ('p_out 0 (pair only)', dict(p_out=0)), ('p_out .25', dict(p_out=.25)),
                          ('p_out 1.0', dict(p_out=1.0)), ('cubs do not count', dict(count_cubs=False)),
                          ('level reading (C6)', dict(level=True)), ('player answers 2 warnings/season', dict(respond=2)),
                          ('Sim Style', dict(style='Sim')), ('room gate (C8) instead', dict(pgate='room')),
                          ('soft gate (C10) instead', dict(pgate='soft')), ('flat -5, level reading', dict(level=True, pen=('flat', 5, 0)))]:
            for expand in (False, True):
                cfg = dict(base, expand=expand); cfg.update(extra)
                P(fmt_p(f'{nm}, {"expand" if expand else "fixed"}', run(cfg)))

        P('=' * 120); P('O5 Recommended penalty shape (gate on, max -20): step 3/5/8 x capacity 3/4/5 x regions 1/2/3 x expand')
        for expand in (False, True):
            for regions in (1, 2, 3):
                P(f'-- start regions {regions}, {"player expands (C4)" if expand else "no expansion"}')
                for cpr in (3, 4, 5):
                    for k in (3, 5, 8):
                        P(fmt_p(f'cap {cpr}, -{k} x seasonsOver, max -20', run(dict(regions=regions, cpr=cpr, pen=('esc', k, 20), expand=expand, pgate='proposed'))))

        P('=' * 120)
        P('A1 AI prides (Q17.14). Rosters world-slots.json HC 11 / BF 10 / MW 9 + 9 loners; capacity = cap/region x regions')
        P('   (regions fixed per run: "4/3/3" = map-v1 §4.2 start claims incl. Highcrag\'s disputed ford; "4/4/4" = councils')
        P('   10-year median). mode all = every fertile female breeds if a fertile male lives (Tracker stopgap, no incest gate);')
        P('   mode pairs = monogamous mates with r < 0.125 (C3). x = cross-pride pairing chance (C11). Cubs count.')
        W = lambda cfg: summarise_world(pool.map(_w, [(cfg, s) for s in range(SEEDS)], chunksize=10))
        R444 = {'highcrag': 4, 'bonefield': 4, 'mistwood': 4}
        P('-- calibration vs Tracker DELTA-v0.1e (all, proposed gate, cap 4, 4/3/3: y10 med 27/19/16, max 61)')
        for gate in ('proposed', 'room'):
            P(fmt_w(f'mode all, gate {gate}, cap 4, 4/3/3', W(dict(cpr=4, gate=gate, mode='all'))))
        P(fmt_w('mode all, NO gate, cap 4, 4/3/3 (births stop at 1500)', W(dict(cpr=4, gate='none', mode='all'))))
        P('-- monogamous pairs, no cross-pride pairing')
        for gate in ('proposed', 'room'):
            P(fmt_w(f'pairs x0, gate {gate}, cap 4, 4/3/3', W(dict(cpr=4, gate=gate, mode='pairs'))))
        P('-- monogamous pairs + cross-pride pairing .5')
        for gate in ('proposed', 'soft', 'room'):
            for cpr in (3, 4, 5):
                for rn, rg in (('4/3/3', None), ('4/4/4', R444)):
                    P(fmt_w(f'pairs x.5, gate {gate}, cap {cpr}, {rn}', W(dict(cpr=cpr, gate=gate, mode='pairs', xmate=.5, regions=rg))))
        P('-- cross-pride pairing sensitivity (room gate, cap 4, 4/3/3)')
        for px in (.1, .25, 1.0):
            P(fmt_w(f'pairs x{px}, gate room, cap 4', W(dict(cpr=4, gate='room', mode='pairs', xmate=px))))
        P('-- outdated "13 each" brief (rosters padded with unmated adults), room gate, cap 4, x.5')
        P(fmt_w('pairs x.5, room, cap 4, padded to 13', W(dict(cpr=4, gate='room', mode='pairs', xmate=.5, pad=13))))
