"""Fight engine v0.1.2 (Tundra 00984a1): telegraphed intent plus §8.1 sensible.

The move table and the personality weights live here so this file runs on its own.
They are the eng3 values the reference fight calls.
"""
import random

MOVES = {
    'swipe': (18, 0.95, 1),
    'bite': (30, 0.75, 2),
    'pounce': (45, 0.55, 3),
    'defend': (0, 0, 0),
    'intimidate': (0, 0, 1),
}
K = 1.35
COUNTER = 9
FEINT = 0.25
REP = (0, 0.10, 0.20)


def weights(aggr, bold):
    a = (aggr - 50) / 50.0
    b = (bold - 50) / 50.0
    raw = {
        'bite': 3,
        'swipe': 3 - a,
        'pounce': 2 + 1.5 * a + 0.5 * b,
        'defend': 1.5 - a - 0.5 * b,
        'intimidate': 1 + 0.5 * b,
    }
    return {k: max(0.1, raw[k]) for k in MOVES}


def pick(w, rng, af):
    opts = [x for x in af if x in w]
    total = sum(w[x] for x in opts)
    roll = rng.random() * total
    acc = 0.0
    for x in opts:
        acc += w[x]
        if roll < acc:
            return x
    return opts[-1]


def ai(p):
    w = weights(*p)
    return lambda m, o, r, af, tel: pick(w, r, af)


def fixed(name):
    order = {'bite': ['bite', 'swipe', 'defend']}[name]
    return lambda m, o, r, af, tel: next(x for x in order if x in af)


def reader(m, o, r, af, tel):
    """Older variant. Kept for history. Parity uses sensible, not this."""
    if tel in ('pounce', 'bite') and m['hp'] <= 100:
        return 'defend'
    if (o['open'] or o['shaken']) and 'pounce' in af:
        return 'pounce'
    if tel == 'defend' and 'intimidate' in af:
        return 'intimidate'
    if m['last'] == 'bite' and m['rep'] >= 1:
        return 'swipe' if 'swipe' in af else 'defend'
    if 'bite' in af:
        return 'bite'
    return 'swipe' if 'swipe' in af else 'defend'


def sensible(m, o, r, af, tel):
    """encounters §8.1 sensible. reader above is an older variant kept for history."""
    if tel == 'pounce' and 'defend' in af:
        return 'defend'
    if (o['open'] or o['shaken']) and 'pounce' in af:
        return 'pounce'
    if m['last'] == 'bite' and m['rep'] >= 1 and 'swipe' in af:
        return 'swipe'
    if 'bite' in af:
        return 'bite'
    return 'swipe' if 'swipe' in af else 'defend'


sensible.__name__ = 'reader'  # fight() keys telegraph handling on this name


def fight(sA, sB, polA, polB, rng, k=K, maxr=13):
    st = {s: dict(hp=100.0, st=5, guard=False, open=False, shaken=0, last=None, rep=0, intent=None) for s in 'AB'}
    st['A']['s'] = sA
    st['B']['s'] = sB
    pol = {'A': polA, 'B': polB}
    order = ['A', 'B'] if rng.random() < 0.5 else ['B', 'A']

    def affordable(m):
        return [x for x, v in MOVES.items() if v[2] <= m['st']]

    for s in 'AB':
        st[s]['intent'] = pol[s](st[s], st['B' if s == 'A' else 'A'], rng, affordable(st[s]), None)
    for r in range(maxr):
        for me in order:
            op = 'B' if me == 'A' else 'A'
            m = st[me]
            o = st[op]
            af = affordable(m)
            mv = m['intent'] if m['intent'] in af else pol[me](m, o, rng, af, None)
            m['st'] -= MOVES[mv][2]
            m['guard'] = False
            m['st'] = min(5, m['st'] + 1 + (1 if mv == 'defend' else 0))
            if mv in ('swipe', 'bite', 'pounce'):
                m['rep'] = m['rep'] + 1 if m['last'] == mv else 0
                m['last'] = mv
            if mv == 'defend':
                m['guard'] = True
            elif mv == 'intimidate':
                if rng.random() < min(0.9, 0.5 * (m['s'] / o['s'])):
                    o['shaken'] = 2
            else:
                base, hit, _ = MOVES[mv]
                hit -= REP[min(m['rep'], 2)]
                if m['shaken'] > 0:
                    hit -= 0.15
                    base *= 0.8
                    m['shaken'] -= 1
                if rng.random() < hit:
                    d = base * (m['s'] / o['s']) ** k * rng.uniform(0.85, 1.15)
                    if o['guard']:
                        d *= 0.5
                        m['hp'] -= COUNTER * (o['s'] / m['s']) ** k
                    if o['open']:
                        d *= 1.25
                    o['hp'] -= d
                    o['open'] = False
                    if o['hp'] <= 0:
                        return me, r + 1
                    if m['hp'] <= 0:
                        return op, r + 1
                elif mv == 'pounce':
                    m['open'] = True
            naf = affordable(m)
            m['intent'] = pol[me](m, o, rng, naf, None) if pol[me].__name__ != 'reader' else None
            tel = m['intent']
            if tel is not None and rng.random() < FEINT:
                tel = rng.choice([x for x in MOVES if x != tel])
            o['tel'] = tel
            if pol[op].__name__ == 'reader':
                o['intent'] = pol[op](o, m, rng, affordable(o), tel)
    return ('A' if st['A']['hp'] > st['B']['hp'] else 'B'), maxr


def cell(sA, sB, pol, pB=(50, 50), n=20000, seed=7):
    import statistics
    rng = random.Random(seed)
    res = [fight(sA, sB, pol, ai(pB), rng) for _ in range(n)]
    return sum(w == 'A' for w, _ in res) / n, statistics.median(r for _, r in res), sum(r == 13 for _, r in res) / n


if __name__ == '__main__':
    import json
    import sys
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 20000
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 7
    out = {}
    for nm, p in [('average', ai((50, 50))), ('biteOnly', fixed('bite')), ('sensible', sensible)]:
        out[nm] = []
        for ratio in (1.0, 1.1, 1.25, 0.8):
            win, med, timed = cell(10 * ratio, 10, p, n=n, seed=seed)
            out[nm].append({'ratio': ratio, 'win': win, 'median': med, 'cap': timed})
    json.dump(out, sys.stdout)
    sys.stdout.write('\n')
