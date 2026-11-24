#!/usr/bin/env python3
"""Build the v0.2 redesign mockups: compile style.css and write one HTML per screen. Copy sources: COPY.md / Saga ui-copy-v1.json / game data (ef443e5)."""
import re, pathlib
R = pathlib.Path(__file__).parent
css = (R/'src/style.src.css').read_text()
css = re.sub(r'(?<![\w#.-])(-?\d+(?:\.\d+)?)u(?![\w-])', r'calc(\1 * var(--s))', css)
(R/'style.css').write_text(css)

def u(n): return f'calc({n} * var(--s))'

ICON = {
 'home': '<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>',
 'map': '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="none" stroke="currentColor" stroke-width="2"/>',
 'cats': '<circle cx="6" cy="9" r="2.2"/><circle cx="10" cy="5.5" r="2.2"/><circle cx="14" cy="5.5" r="2.2"/><circle cx="18" cy="9" r="2.2"/><path d="M12 11c-4 0-6 4-6 7 0 2 3 2 6 1 3 1 6 1 6-1 0-3-2-7-6-7z"/>',
 'book': '<path d="M4 4h7v16H4zM13 4h7v16h-7z" fill="none" stroke="currentColor" stroke-width="2"/>',
 'deeds': '<path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z"/>',
 'lock': '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3" fill="none" stroke="currentColor" stroke-width="2"/>',
}
def svg(k): return f'<svg viewBox="0 0 24 24" fill="currentColor">{ICON[k]}</svg>'

OPEN = [('Home','home'),('Wilderness','map'),('Smilodons','cats'),('Lore','book'),('Deeds','deeds')]
# Locked sections, all greyed below a divider, in Tundra's sample first-run unlock order (ux-redesign v0.2d §2.3; Director reconfirmed).
LOCKED = [('Pride','Opens when you catch a border scent, meet a patrol, join a pride or Found one.'),
          ('Reputation','Opens after you earn a deed.'),
          ('Inventory','Opens when you gain an item.'),
          ('Breeding','Opens when you take a mate.'),
          ('Den','Opens after you Found a pride.'),
          ('Quests','Opens when you accept a request.'),
          ('Market','Opens when you get a trade offer.'),
          ('Councils',"Opens when you're invited to a council, or after you lead a pride.")]

def rail(active='Home', scene=False, focus=None):
    out = ['<nav class="panel rail" data-panel>']
    for name, ic in OPEN:
        cls = 'ri' + (' on' if name == active and not scene else '') + (' lock' if scene else '') + (' focus' if name == focus else '')
        why = '<div class="why" data-tip>Finish this first.</div>' if scene and name == focus else ''
        out.append(f'<div class="{cls}">{svg("lock" if scene else ic)}<span>{name}</span>{why}</div>')
    out.append('<div class="sep"></div>')
    for name, w in LOCKED:
        cls = 'ri lock' + (' focus' if name == focus else '')
        why = f'<div class="why" data-tip>{"Finish this first." if scene else w}</div>' if name == focus else ''
        out.append(f'<div class="{cls}">{svg("lock")}<span>{name}</span><span class="lockword" style="margin-left:auto">Locked</span>{why}</div>')
    out.append('</nav>')
    return ''.join(out)

NEEDS = [('Health','health',86),('Thirst','thirst',42),('Hunger','hunger',63),('Energy','energy',71)]
def top(name='Birchclaw', pride='Loner', when='Spring · Day 3'):
    n = ''.join(f'<div class="need"><div class="nl"><span>{l}</span></div><div class="bar b-{k}"><i style="width:{v}%"></i></div></div>' for l,k,v in NEEDS)
    return (f'<header class="panel top" data-panel><div class="who"><span class="name">{name}</span><span class="pride">{pride}</span></div>'
            f'<div class="when">{when}</div><div class="needs">{n}<div class="menu-btn"><span style="font-size:1.2em">≡</span> Menu</div></div></header>')

def goal(text='Get your bearings. Eat, and look at the land.'):
    return f'<div class="panel goal" data-panel data-attached><b>Goal</b>{text}</div>'

def actor(src, left, bottom, h, flip=False, extra=''):
    t = 'transform:scaleX(-1);' if flip else ''
    return f'<img class="actor" src="assets/{src}" style="left:{u(left)};bottom:{u(bottom)};height:{u(h)};{t}{extra}">'

def page(fname, title, scene, focal, body, dim=False):
    html = f'''<!doctype html><html><head><meta charset="utf-8"><title>{title}</title><link rel="stylesheet" href="style.css"></head>
<body><div class="scene{' dim' if dim else ''}" style="background-image:url(assets/{scene});background-position:{focal}"></div>
<div class="safe">{body}</div></body></html>'''
    (R/fname).write_text(html)

PH = lambda s: f'<span class="ph">[Saga: {s}]</span>'

# 01 Home -------------------------------------------------------------
place = ('<section class="panel" data-panel style="left:%s;bottom:%s;width:%s;padding:%s">' % (u(290),u(24),u(460),u(22)) +
 '<h2>Twin Forks</h2><p class="muted" style="margin:%s 0 %s">Two channels of the Greywater meet among low banks and wet grass. Prey comes to drink, while spring water spreads beyond the familiar crossings.</p>' % (u(8),u(14)) +
 '<div style="display:grid;grid-template-columns:auto 1fr auto 1fr;gap:%s %s;font-size:%s">' % (u(6),u(14),u(20)) +
 '<span class="label">Prey</span><b>Plentiful</b><span class="label">Danger</span><b>Low</b>'
 '<span class="label">Water</span><b>Available</b><span class="label">Claimed by</span><b>Unclaimed</b></div></section>')
cat_home = actor('player-fullbody-trim.png', 730, 70, 400)
page('01-home.html','Home','home-landscape.png','42% 60%',
     cat_home + top() + goal() + rail('Home', focus='Pride') + place +
     f'<div class="btn primary big" data-panel style="position:absolute;right:{u(24)};bottom:{u(24)}">Choose today\'s action</div>')

# 02 Today's action -----------------------------------------------------
def acard(t, d, tag=False, lock=None, focus=False):
    tg = '<span class="tag" style="margin-left:%s">Suits your goal</span>' % u(12) if tag else ''
    lk = '<span class="lockword">Locked</span>' if lock else ''
    cls = 'card' + (' off' if lock else '')
    st = 'outline:%s solid var(--bone);outline-offset:%s;' % (u(2), u(2)) if focus else ''
    dd = lock if (lock and focus) else d
    return f'<div class="{cls}" style="{st}"><div class="t">{t}{tg}{lk}</div><div class="d">{dd}</div></div>'
cards = (acard('Hunt','Track prey in this region.', tag=True) + acard('Watch from a vantage',"See which cats pass this ground, and what they're doing.") +
         acard('Scent sign','See who has been on this ground.') + acard('Rest','Rest the day away and get your Energy back.') +
         acard('Travel','Walk to a neighbouring region.'))
more = ('<div style="display:flex;align-items:center;justify-content:space-between;margin:%s 0 %s;padding-top:%s;border-top:%s solid var(--border-soft)"><span style="font-size:%s;font-weight:700">More actions</span><span class="muted" style="font-size:%s">▴</span></div>' % (u(6),u(2),u(12),u(1.5),u(22),u(20)) +
        acard('Spar','Wrestle with a cat who knows you well.', lock='Opens when you and a cat know each other well enough.', focus=True) +
        acard('Found a pride','Start your pride here.', lock='Opens when you have a mate and stand on Unclaimed land.'))
panel = (f'<section class="panel" data-panel style="right:{u(24)};top:{u(160)};bottom:{u(24)};width:{u(620)};padding:{u(22)};display:flex;flex-direction:column;gap:{u(10)}">'
         f'<h2 style="margin-bottom:{u(4)}">Today\'s action</h2>{cards}{more}</section>')
page('02-todays-action.html',"Today's action",'home-landscape.png','42% 60%', cat_home + top() + goal() + rail('Home') + place + panel)

# 03 Hunt -----------------------------------------------------------------
def story(title, lines, state, choices, left_extra=''):
    ch = ''.join(f'<div class="choice{" quiet" if q else ""}">{c}</div>' for c,q in choices)
    return (f'<section class="panel story" data-panel>{left_extra}<div style="flex:1 1 0;min-width:0">'
            f'<h2>{title}</h2><div style="margin-top:{u(10)};font-size:{u(22)};line-height:1.4">{lines}</div>{state}</div>'
            f'<div class="choices" style="flex:1 1 0;align-content:center">{ch}</div></section>')
def odds(word):
    return (f'<div class="odds" style="margin-top:{u(14)}"><span class="label" style="color:var(--bone);font-weight:700">Odds</span>'
            f'<span class="oddsword">{word}</span></div>')
# Hunt: forecast win chance 40-59% -> Saga's hunt odds 'even' (COPY.md revisions; bands per Tundra §3.3, 4d03c63).
hunt_state = (f'<div style="display:flex;align-items:center;gap:{u(14)};margin-top:{u(14)}"><span class="label">Hunt</span>'
              f'<div class="bar" style="width:{u(220)};height:{u(18)}"><i style="width:35%;background:var(--gold)"></i></div><b style="font-size:{u(22)}">Within reach</b></div>'
              + odds("It could go either way."))
page('03-encounter-hunt.html','Hunt','snowy-plain.png','50% 55%',
     actor('player-fullbody-trim.png', 330, 380, 330) + actor('giant-deer-trim.png', 1230, 385, 420, flip=True) +
     top() + goal() + rail(scene=True, focus='Lore') +
     story('Giant deer', "You slide through the grass like a shadow. The deer does not lift its head.<br>The deer's scent is warm grass and fear, even when it has not yet seen you.",
           hunt_state, [('Creep',0),('Rush in',0),('Freeze',0),('Run it down',0)]))

# 04 Fight ----------------------------------------------------------------
# Hyena drive is tier-only: forecast tier 'partial' -> odds.good (Tundra §3.3, 4d03c63).
fight_state = (f'<div style="margin-top:{u(12)};font-size:{u(22)}">The cave hyena is circling. You\'re winded. <span class="label" style="margin-left:{u(12)}">You</span> <b>Hurt</b></div>'
               + odds("You could drive it off."))
page('04-encounter-fight.html','Fight','forest-clearing.png','50% 60%',
     actor('player-fullbody-trim.png', 330, 380, 330) + actor('cave-hyena-trim.png', 1260, 380, 300, flip=True) +
     top(when='Spring · Day 4') + goal() + rail(scene=True) +
     story('Cave hyena', 'The cave hyena drops its head and comes in close, jaws parting.', fight_state,
           [('Swipe',0),('Bite',0),('Defend',0),('Flee',1)]))

# 05 Dialogue -------------------------------------------------------------
hs = lambda src, sz: f'<img src="assets/{src}" style="width:{u(sz)};height:{u(sz)};border-radius:{u(10)};border:{u(2)} solid var(--border);background:#3b2c1e;flex:none;align-self:flex-start;object-fit:cover">'
head = hs('summercloud-head.png', 200)
dlg_lines = (f'<p class="muted" style="font-style:italic">Summercloud won\'t meet your eyes.</p>'
             f'<p style="margin-top:{u(8)}">“I should tell you something. I went to the forks before I asked you. The hyena came at me, my leg gave out, and I had to drag myself home through the reeds. Will you drive it off? I can\'t, and I hate saying that.”</p>')
title = f'Summercloud <span class="chip" style="height:{u(36)};font-family:var(--ui);font-size:{u(18)};vertical-align:middle;margin-left:{u(10)}">Friendly</span>'
ch = ''.join(f'<div class="choice{" quiet" if q else ""}" style="min-height:{u(64)};font-size:{u(22)};padding:{u(8)} {u(16)}">{c}</div>' for c,q in [
    ("“I'll drive it off. You don't have to come.”",0),("“Leave it. A stolen kill isn't worth getting hurt over.”",0),("“Your leg comes first. Let me see it.”",0),('Leave',1)])
me = (f'<div style="flex:none;display:flex;flex-direction:column;align-items:center;gap:{u(6)}">{hs("player-headshot.png", 200)}'
      f'<div style="font-family:var(--title);font-weight:700;font-size:{u(24)}">Birchclaw</div></div>')
dlg = (f'<section class="panel story" data-panel>{head}<div style="flex:1 1 0;min-width:0"><h2>{title}</h2>'
       f'<div style="margin-top:{u(10)};font-size:{u(22)};line-height:1.4">{dlg_lines}</div></div>'
       f'<div class="choices" style="flex:1.25 1 0;min-width:0;grid-template-columns:1fr 1fr;align-content:center;gap:{u(12)}">{ch}</div>{me}</section>')
toast = f'<div class="panel toast" data-panel style="top:{u(160)}"><span class="ok">✓</span>Game saved.</div>'
page('05-dialogue.html','Dialogue','frozen-lake.png','50% 55%',
     top(when='Spring · Day 4') + goal() + rail(scene=True) + toast + dlg)

# 06 New Game -------------------------------------------------------------
def rcard(t, d, sel=False, off=None):
    c = 'card' + (' sel' if sel else '') + (' off' if off else '')
    chk = '<span class="check">✓</span>' if sel else ''
    o = f'<div style="margin-top:{u(8)}">{off}</div>' if off else ''
    return f'<div class="{c}" style="padding-right:{u(48)}">{chk}<div class="t">{t}</div>' + (f'<div class="d">{d}</div>' if d else '') + f'{o}</div>'
def group(h, cols, cards, sub=''):
    s = f'<div class="muted" style="font-size:{u(19)};margin-top:{u(2)}">{sub}</div>' if sub else ''
    return (f'<div style="margin-top:{u(14)}"><h3>{h}</h3>{s}<div style="display:grid;grid-template-columns:repeat({cols},1fr);gap:{u(12)};margin-top:{u(10)}">{cards}</div></div>')
ng = (f'<section class="panel" data-panel style="left:50%;transform:translateX(-50%);top:{u(24)};width:{u(1500)};padding:{u(22)} {u(34)} {u(24)}">'
      f'<h1>New Game</h1>' +
      group('Difficulty', 4, rcard('Gentle','The ice has stepped back, and the herds are thick.') + rcard('Standard','The Vale as it is.', sel=True) +
            rcard('Harsh','A long winter. The herds run thin.') + rcard('Ice Age','The ice comes south, and only the hard survive. A rival stays as hungry as you are, but packs, clans and lions grow bolder.'),
            sub="You picked Standard difficulty, the Balanced play style and Permadeath. You can't change any of them once the story starts.") +
      group('Play Style', 3, rcard('Story',"A gentler Ice Age for living the tale. Hunts succeed more often, wounds heal fast, and the pride's daily work is handled for you.") +
            rcard('Balanced','Survival and story in balance. Spend your first spring alone: hunt, rest, travel, and meet the cats of the Vale.', sel=True) +
            rcard('Sim',"The Ice Age at its harshest. Prey is scarce in winter, meat spoils, wounds can fester, and every cat's hunger, den, and bloodline is yours to manage.")) +
      group('When Your Cat Dies', 3, rcard('Permadeath','When your cat dies, the story ends. One life, one legend.', sel=True) +
            rcard('Play On as Heir','When your cat dies, you continue as your closest kin in the pride. If no heir is left, your legacy ends.', off="<span class='lockword' style='margin-left:0'>Locked</span> Not yet available. It's coming in a later update.") +
            rcard('Sandbox','A gentler world with no game over. Explore, experiment, and tell the story you want at your own pace.', off="<span class='lockword' style='margin-left:0'>Locked</span> Not yet available. It's coming in a later update.")) +
      f'<div style="margin-top:{u(16)}"><h3>Tutorial</h3><div style="display:flex;align-items:center;gap:{u(24)};margin-top:{u(10)}">'
      f'<div class="card sel" style="flex:1;display:flex;align-items:center;gap:{u(20)};padding-right:{u(18)}">'
      f'<div style="flex:1"><div class="t">Guided first day and tips</div><div class="d">A short walk through your opening day, then notes when something new happens.</div></div>'
      f'<div style="display:flex;gap:{u(8)}"><span class="chip sel">On</span><span class="chip">Off</span></div></div>'
      f'<div style="display:flex;gap:{u(16)}"><div class="btn">Back</div><div class="btn primary">Next</div></div></div></div></section>')
page('06-new-game.html','New Game','menu-milkyway.jpg','70% 40%', ng, dim=True)

# 07/08 Creator -------------------------------------------------------------
def stepper(cur):
    steps = ['Look','Personality','Strengths and flaws', 'Ready']
    out = []
    for i, s in enumerate(steps, 1):
        on = i == cur; done = i < cur
        col = 'var(--gold)' if on else ('var(--muted)' if done else 'var(--border-soft)')
        out.append(f'<div style="display:flex;align-items:center;gap:{u(10)};font-size:{u(20)};font-weight:{700 if on else 500};color:{"var(--bone)" if on else "var(--muted)"}">'
                   f'<span style="width:{u(34)};height:{u(34)};border-radius:50%;border:{u(2)} solid {col};{"background:var(--gold);color:var(--gold-ink);" if on else ""}display:flex;align-items:center;justify-content:center;font-weight:700">{"✓" if done else i}</span>{s}</div>')
    return f'<div style="display:flex;gap:{u(28)};align-items:center;flex-wrap:wrap">' + f'<span style="color:var(--dim)" aria-hidden="true">—</span>'.join(out) + '</div>'
def creator(fname, cur, content, title):
    body = (f'<section class="panel" data-panel style="left:50%;transform:translateX(-50%);top:{u(40)};bottom:{u(40)};width:{u(1680)};display:flex;flex-direction:column;padding:{u(26)} {u(32)}">'
            f'<div style="display:flex;justify-content:space-between;align-items:center;gap:{u(20)}"><h1 style="font-size:{u(34)}">Make Your Sabrecat</h1>{stepper(cur)}</div>'
            f'<div style="flex:1;display:flex;gap:{u(28)};margin-top:{u(18)};min-height:0">'
            f'<div style="flex:0 0 38%;background:#120d09;border:{u(1.5)} solid var(--border-soft);border-radius:var(--r);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:{u(16)}">'
            f'<img src="assets/player-fullbody-trim.png" style="width:100%;object-fit:contain;max-height:80%">'
            f'<div style="font-family:var(--title);font-size:{u(30)};font-weight:700;margin-top:{u(12)}">Birchclaw</div></div>'
            f'<div style="flex:1;min-width:0;display:flex;flex-direction:column">{content}'
            f'<div style="margin-top:auto;display:flex;justify-content:flex-end;gap:{u(16)};padding-top:{u(14)}"><div class="btn">Back</div><div class="btn primary">Next</div></div></div></div></section>')
    page(fname, title, 'menu-milkyway.jpg', '70% 40%', body, dim=True)

def row(label, inner, help=''):
    h = f'<div class="muted" style="font-size:{u(19)};margin-top:{u(6)}">{help}</div>' if help else ''
    return f'<div style="margin-bottom:{u(20)}"><div class="label" style="font-size:{u(20)};color:var(--bone);font-weight:700;margin-bottom:{u(8)}">{label}</div>{inner}{h}</div>'
chips = lambda items, sel: f'<div style="display:flex;flex-wrap:wrap;gap:{u(10)}">' + ''.join(f'<span class="chip{" sel" if i==sel else ""}">{i}</span>' for i in items) + '</div>'
def thumb(a, nm, sel):
    chk = (f'<span style="position:absolute;top:{u(6)};right:{u(6)};width:{u(28)};height:{u(28)};border-radius:50%;background:var(--sel);color:var(--gold-ink);font-weight:700;font-size:{u(18)};display:flex;align-items:center;justify-content:center">✓</span>' if sel else '')
    return (f'<div style="width:{u(150)}"><div style="height:{u(112)};border-radius:{u(8)};border:{u(2.5 if sel else 1.5)} solid {"var(--sel)" if sel else "var(--border-soft)"};background:#120d09 url(assets/{a}) center/contain no-repeat;position:relative">{chk}</div>'
            f'<div style="text-align:center;font-size:{u(19)};margin-top:{u(4)};font-weight:{700 if sel else 500}">{nm}</div></div>')
thumbs = thumb('player-fullbody-trim.png','Dark',1) + thumb('still-tawny.png','Tawny',0) + thumb('still-pale.png','Pale',0)
look = (row('Name', f'<div style="display:flex;gap:{u(12)}"><div style="flex:1;height:{u(56)};border-radius:{u(8)};border:{u(2)} solid var(--border);background:#120d09;display:flex;align-items:center;padding:0 {u(16)};font-size:{u(24)}">Birchclaw</div><div class="btn" style="height:{u(56)};font-size:{u(20)}">Randomize name</div></div>', 'What the valley will call you.') +
        row(f'Picture <span class="standin">Stand-in art</span>', f'<div style="display:flex;gap:{u(12)};align-items:flex-start">{thumbs}</div>') +
        row('Sex', chips(['Male','Female'], 'Male')) +
        row('Coat', chips(['Tan','Gray','Brown','Black','Sandy'], 'Black')) +
        row('Build', chips(['Lean','Heavy','Large','Small'], 'Lean'),
            f'<span style="color:var(--bone)">Changes how the story describes your cat.</span>'))
creator('07-creator-look.html', 1, look, 'Creator: Look')

STR = [('Bone-Cracker',"Your bite makes you stronger in a fight. Can't be taken with Chipped Saber.",'sel'),('Swift','You run and chase for longer.',''),
       ('Thick Hide','Blows hurt you less in a fight.',''),('Keen Nose','Prey notices you later on the hunt.',''),('Long Sabers','Foes are easier to cow.','')]
FLW = [('Runt','Foes are harder to cow.',''),('Lame Paw','You fight and run a little worse.',''),('Thin Hide','Blows hurt you more in a fight.',''),
       ('Dull Nose','Prey notices you sooner on the hunt.',''),('Chipped Saber','Clashes with Bone-Cracker','off')]
def tcard(t, d, st):
    c = 'card' + (' sel' if st=='sel' else '') + (' off' if st=='off' else '')
    chk = '<span class="check">✓</span>' if st=='sel' else ''
    lk = '<span class="lockword">Locked</span>' if st=='off' else ''
    return f'<div class="{c}" style="padding:{u(10)} {u(48)} {u(10)} {u(16)}">{chk}<div class="t" style="font-size:{u(22)}">{t}{lk}</div><div class="d" style="font-size:{u(19)};margin-top:{u(2)}">{d}</div></div>'
col = lambda h, items: (f'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:{u(8)}"><div style="display:flex;justify-content:space-between;align-items:baseline"><h3>{h[0]}</h3><span class="label" style="color:var(--bone)">{h[1]}</span></div>'
                        + ''.join(tcard(*i) for i in items) + '</div>')
tabs = f'<div style="display:flex;gap:{u(8)};margin-bottom:{u(12)}">' + ''.join(f'<span class="chip{" sel" if t=="Body" else ""}" style="height:{u(44)}">{t}</span>' for t in ['Body','Mind','Social','Lineage']) + '</div>'
traits = (tabs + f'<div style="display:flex;gap:{u(18)}">{col(("Strengths","Strengths 1 of 3"), STR)}{col(("Flaws","Flaws 0 of 3"), FLW)}</div>'
          f'<div style="margin-top:{u(12)};font-size:{u(20)}"><span style="color:var(--gold-hi);font-weight:700">Your flaws don\'t cover this yet.</span> <span class="muted">Traits are optional. You can start without picking any.</span></div>')
creator('08-creator-traits.html', 3, traits, 'Creator: Traits')

# 09 Lore -------------------------------------------------------------------
entries = [('The mammoth bones',0),('Highcrag Pride',0),('The leader of Highcrag',0),('Bonefield Pride',1),('The leader of Bonefield',0),('Mistwood Pride',0),('The leader of Mistwood',0),('The Split Rock',0),('The councils',0)]
lst = ''.join(f'<div style="padding:{u(9)} {u(14)};border-radius:{u(8)};font-size:{u(21)};{"background:var(--panel-3);box-shadow:inset "+u(4)+" 0 0 var(--gold);font-weight:700" if s else ""}">{t}</div>' for t,s in entries)
lst += ''.join(f'<div style="padding:{u(9)} {u(14)};font-size:{u(21)};color:var(--dim)">Not yet learned</div>' for _ in range(2))
ltabs = f'<div style="display:flex;gap:{u(8)};margin:{u(14)} 0 {u(14)}">' + ''.join(f'<span class="chip{" sel" if t=="Common knowledge" else ""}" style="height:{u(44)}">{t}</span>' for t in ['Common knowledge','Learned','Rumours','Useful notes']) + '</div>'
lore = (f'<section class="panel" data-panel style="left:{u(290)};top:{u(160)};bottom:{u(24)};width:{u(1344)};padding:{u(24)} {u(30)};display:flex;flex-direction:column">'
        f'<h1>Lore Book</h1><div class="close">✕ Close</div>{ltabs}'
        f'<div style="flex:1;display:flex;gap:{u(30)};min-height:0"><div style="flex:0 0 {u(380)};border-right:{u(1.5)} solid var(--border-soft);padding-right:{u(16)}">{lst}</div>'
        f'<article style="flex:1;max-width:{u(800)};font-size:{u(22)};line-height:1.5"><h2>Bonefield Pride</h2>'
        f'<p style="margin-top:{u(12)}">“The weak feed the strong. That is the law of the grass.” Harsh, martial and loud. Bonefield cubs are trained to fight from the moment a cub can walk. Rank is won by challenge and held by scars. The pride hunts the biggest prey in the Vale and takes the most losses doing it. Strangers are met with a show of force, and a stranger who stands ground earns respect.</p>'
        f'<h3 style="margin-top:{u(22)}">The leader of Bonefield</h3><p style="margin-top:{u(8)}">Cragfoot leads Bonefield Pride, a heavy tom with a torn lip who won his place by challenge and has held it against every challenger since.</p></article></div></section>')
page('09-lore.html','Lore','home-landscape.png','42% 60%', top() + goal() + rail('Lore') + lore, dim=True)
print('built')
