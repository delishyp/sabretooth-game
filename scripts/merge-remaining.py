#!/usr/bin/env python3
"""Apply the remaining v0.1.6 dialogue batches. Later batches win; batch 8 wins on overlap."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V016 = Path('/tmp/v016')
ORDER = [
    'batch-1/batch-1-overrides.json',
    'batch-1-patch/batch-1-patch-overrides.json',
    'batch-2a/batch-2a-overrides.json',
    'batch-2b/batch-2b-overrides.json',
    'batch-2b-patch/batch-2b-patch-overrides.json',
    'batch-3/batch-3-overrides.json',
    'batch-4/batch-4-overrides.json',
    'batch-4-patch/batch-4-patch-overrides.json',
    'batch-5/batch-5-overrides.json',
    'batch-5-patch/batch-5-patch-overrides.json',
    'batch-6/batch-6-overrides.json',
    'batch-7/batch-7-overrides.json',
    'batch-8-anna-fixes/batch-8-anna-fixes-overrides.json',
]
# batch 8 lives outside the v016 zip.
PATHS = []
for name in ORDER:
    p = V016 / name
    if not p.exists():
        p = Path('/tmp/batch8') / name
    PATHS.append(p)


def norm(text):
    text = str(text or '')
    text = text.replace('“', '"').replace('”', '"').replace('’', "'").replace('‘', "'")
    return re.sub(r'\s+', ' ', text).strip()


def render(block, quoted_say=False):
    if not isinstance(block, dict):
        return ''
    parts = []
    for part in block.get('parts') or []:
        if part.get('beat'):
            parts.append(part['beat'])
        elif part.get('say') is not None:
            say = part['say']
            parts.append(f'“{say}”' if quoted_say else say)
    return ' '.join(parts).strip()


def walk(node, expr):
    parent = key = None
    current = node
    i = 0
    while i < len(expr):
        if expr[i] == '.':
            i += 1
            continue
        if expr[i] == '[':
            match = re.match(r'\[(\d+)\]', expr[i:])
            if not match or not isinstance(current, list) or int(match.group(1)) >= len(current):
                return None
            index = int(match.group(1))
            parent, key, current = current, index, current[index]
            i += match.end()
            continue
        if not isinstance(current, dict):
            return None
        names = [name for name in current if expr.startswith(name, i) and (i + len(name) == len(expr) or expr[i + len(name)] in '.[')]
        if not names:
            return None
        name = max(names, key=len)
        parent, key, current = current, name, current[name]
        i += len(name)
    return parent, key


def locate(data, ident):
    if ident.startswith('speechCoverage.'):
        rest = ident[len('speechCoverage.'):]
        band = rest.rsplit('.', 1)[-1]
        speech_id = rest[:-(len(band) + 1)]
        key = {'baseline': 'baseline', 'base': 'base', 'low': 'low', 'high': 'high'}.get(band)
        rows = None
        if isinstance(data.get('personalityContract'), dict):
            rows = data['personalityContract'].get('speechCoverage')
        if rows is None:
            rows = data.get('speechCoverage')
        if isinstance(rows, list) and key:
            for row in rows:
                if row.get('speechId') == speech_id:
                    return row, key
        return None
    if ident.startswith('bug1_gossipPhrases.'):
        book = data.get('bug1_gossipPhrases')
        if isinstance(book, dict):
            return book, ident.split('.', 1)[1]
        return None
    speech = re.match(r'personalityCoverage\.speechLocations(/.+)\.(low|base|high)$', ident)
    if speech:
        locs = data.get('personalityCoverage', {}).get('speechLocations', {})
        row = locs.get(speech.group(1))
        if isinstance(row, dict):
            return row, speech.group(2)
        return None
    ford = re.match(r'fordStory\.speechLocations\.([^.]+)\.(low|base|high)$', ident)
    if ford and isinstance(data.get('fordStory'), dict):
        row = data['fordStory'].get('speechLocations', {}).get(ford.group(1))
        if isinstance(row, dict):
            return row, ford.group(2)
        return None
    policy = re.match(r'policy\.personalityCoverage\.speechLocations\.([^.]+)\.(low|base|high)$', ident)
    if policy and isinstance(data.get('policy'), dict):
        row = data['policy'].get('personalityCoverage', {}).get('speechLocations', {}).get(policy.group(1))
        if isinstance(row, dict):
            return row, policy.group(2)
        return None
    if ident.startswith('encounters['):
        return walk(data, ident)
    for bucket in ('families', 'events'):
        rows = data.get(bucket)
        if not isinstance(rows, list):
            continue
        by_id = {row.get('id'): row for row in rows if isinstance(row, dict) and row.get('id')}
        cands = [eid for eid in by_id if ident == eid or ident.startswith(eid + '.')]
        if not cands:
            continue
        eid = max(cands, key=len)
        rest = ident[len(eid):].lstrip('.')
        found = walk(by_id[eid], rest) if rest else None
        if found:
            return found[0], found[1]
    found = walk(data, ident)
    if found:
        return found[0], found[1]
    return None


def load_docs():
    docs = {}
    for path in PATHS:
        batch = json.loads(path.read_text())
        for scene in batch.get('scenes') or []:
            for line in scene.get('lines') or []:
                if isinstance(line, dict) and line.get('id') and not line.get('info'):
                    line['_batch'] = path.parent.name
                    docs[line['id']] = line
            for choice in scene.get('choices') or []:
                if isinstance(choice, dict) and choice.get('labelId'):
                    choice['_batch'] = path.parent.name
                    docs['choice:' + choice['labelId']] = choice
    return docs


def main():
    final = load_docs()
    books = {}
    js = {}
    changed = []
    same = []
    missed = []

    def book(rel):
        rel = rel.split('+')[0].strip()
        if rel not in books:
            path = ROOT / rel
            books[rel] = {'path': path, 'data': json.loads(path.read_text()), 'dirty': False}
        return books[rel]

    def source(rel):
        rel = rel.split('+')[0].strip()
        if rel not in js:
            path = ROOT / rel
            js[rel] = {'path': path, 'text': path.read_text(), 'dirty': False}
        return js[rel]

    def put(rel, ident, text, batch):
        rel = rel.split('+')[0].strip()
        if rel.endswith('.js'):
            slot = source(rel)
            if text and text in slot['text']:
                same.append(ident)
                return
            missed.append(f'{ident} js ({batch})')
            return
        try:
            doc = book(rel)
        except FileNotFoundError:
            missed.append(f'{ident} missing file {rel}')
            return
        found = locate(doc['data'], ident)
        if not found:
            missed.append(f'{ident} path ({batch})')
            return
        parent, key = found
        current = parent.get(key) if isinstance(parent, dict) else parent[key]
        quoted = isinstance(current, str) and ('“' in current or current.startswith('"'))
        # text already rendered by caller
        if isinstance(current, str):
            if norm(current) == norm(text):
                same.append(ident)
                return
            parent[key] = text
        elif isinstance(current, dict) and 'text' in current:
            if norm(current['text']) == norm(text):
                same.append(ident)
                return
            current['text'] = text
        elif current is None or (isinstance(parent, dict) and key not in parent):
            parent[key] = text
        else:
            missed.append(f'{ident} not text ({batch})')
            return
        doc['dirty'] = True
        changed.append(f'{ident} [{batch}]')

    for ident, line in final.items():
        if ident.startswith('choice:'):
            continue
        if line.get('untouched') or line.get('removed'):
            same.append(ident + ' untouched')
            continue
        rel = line.get('file') or ''
        if not rel or rel.endswith('.js'):
            continue
        block = line.get('block') or {}
        # Speech-band fields are wrapped by the renderer. Stored narration keeps its own quotes.
        found_preview = None
        try:
            found_preview = locate(book(rel)['data'], ident)
        except FileNotFoundError:
            missed.append(ident + ' file')
            continue
        quoted = False
        if found_preview:
            parent, key = found_preview
            current = parent.get(key) if isinstance(parent, dict) else parent[key]
            if isinstance(current, str) and ('“' in current or current.startswith('"')) and any('say' in p for p in block.get('parts') or []):
                quoted = True
            if isinstance(key, str) and key in ('low', 'high', 'base', 'baseline'):
                quoted = False
        text = render(block, quoted_say=quoted)
        if line.get('added') and found_preview is None:
            if ident.startswith('bug1_gossipPhrases.'):
                doc = book(rel)
                doc['data'].setdefault('bug1_gossipPhrases', {})[ident.split('.', 1)[1]] = render(block, False)
                doc['dirty'] = True
                changed.append(ident + ' added')
                continue
            if ident.endswith('.keptShare'):
                parent_id = ident.rsplit('.', 1)[0]
                parent_found = locate(book(rel)['data'], parent_id)
                if parent_found and isinstance(parent_found[0][parent_found[1]] if False else parent_found[0], dict):
                    parent, key = parent_found
                    host = parent[key] if isinstance(parent, dict) else None
                    if isinstance(host, dict):
                        host['keptShare'] = render(block, True)
                        book(rel)['dirty'] = True
                        changed.append(ident + ' added')
                        continue
        put(rel, ident, text, line.get('_batch'))

    for ident, choice in final.items():
        if not ident.startswith('choice:'):
            continue
        rel = choice.get('labelFile') or ''
        if not rel or rel.endswith('.js'):
            continue
        label = choice.get('label')
        if not label:
            continue
        try:
            doc = book(rel)
        except FileNotFoundError:
            missed.append(ident + ' file')
            continue
        found = locate(doc['data'], choice['labelId'])
        if not found:
            missed.append(f'{ident} path')
            continue
        parent, key = found
        current = parent[key] if not isinstance(parent, dict) else parent.get(key)
        if isinstance(current, str) and norm(current) == norm(label):
            same.append(ident)
        elif isinstance(current, str):
            parent[key] = label
            doc['dirty'] = True
            changed.append(f'{ident} [{choice.get("_batch")}]')
        else:
            missed.append(f'{ident} not text')
        if choice.get('reply') and isinstance(parent, dict) and isinstance(parent.get('reply'), dict):
            speaker = parent['reply'].get('speaker') or '{catId}'
            parent['reply'] = {'speaker': speaker, 'parts': choice['reply']['parts']}
            doc['dirty'] = True

    # ui hints
    hints = json.loads((V016 / 'ui-hints/ui-hints.json').read_text())
    season = book('src/renderer/data/events/first-season-v0.6.2.json')
    ui = season['data'].setdefault('uiHints', {})
    for row in hints['rows']:
        if row.get('untouched'):
            continue
        key = row['key']
        after = row.get('after')
        if not after:
            continue
        if ui.get(key) == after:
            same.append('ui:' + key)
        else:
            ui[key] = after
            season['dirty'] = True
            changed.append('ui:' + key)

    # JS strings whose before text is still unique.
    for ident, line in final.items():
        if ident.startswith('choice:') or not str(line.get('file') or '').endswith('.js'):
            continue
        if line.get('untouched') or line.get('added'):
            continue
        before = line.get('before') or ''
        after = render(line.get('block') or {}, False)
        if not before or norm(before) == norm(after):
            same.append(ident + ' js-kept')
            continue
        slot = source(line['file'])
        count = slot['text'].count(before)
        if count == 1:
            slot['text'] = slot['text'].replace(before, after, 1)
            slot['dirty'] = True
            changed.append(ident + ' js')
        elif after and after in slot['text']:
            same.append(ident + ' js-after')
        else:
            missed.append(f'{ident} js-before ({line.get("_batch")})')

    # New approach-request lines (batch 4 patch).
    request = {}
    for ident, line in final.items():
        if not str(ident).startswith("LONE_LINES['lone-actions.js:approachRequest']"):
            continue
        which, band = ident.split('.')[-2:]
        request.setdefault(which, {})[band] = render(line.get('block') or {}, False)
    if request:
        slot = source('src/renderer/js/pass2.js')
        if 'lone-actions.js:approachRequest' not in slot['text']:
            blob = json.dumps(request, ensure_ascii=False, indent=2)
            blob = '\n'.join('    ' + line if line else line for line in blob.splitlines())
            needle = '    "lone-actions.js:noApproach":'
            insert = '    "lone-actions.js:approachRequest": ' + blob.strip() + ',\n'
            # blob is an object; put it as a property value
            raw = json.dumps(request, ensure_ascii=False)
            insert = '    "lone-actions.js:approachRequest": ' + raw + ',\n'
            if needle not in slot['text']:
                missed.append('approachRequest anchor')
            else:
                slot['text'] = slot['text'].replace(needle, insert + needle, 1)
                slot['dirty'] = True
                changed.append('approachRequest added')
        else:
            same.append('approachRequest')

    for doc in books.values():
        if doc['dirty']:
            doc['path'].write_text(json.dumps(doc['data'], indent=2, ensure_ascii=False) + '\n')
    for slot in js.values():
        if slot['dirty']:
            slot['path'].write_text(slot['text'])
    print(f'changed {len(changed)} same {len(same)} missed {len(missed)}')
    for item in missed:
        print(' MISS', item)
    for item in changed[:40]:
        print(' CHG', item)
    if len(changed) > 40:
        print(f' ... {len(changed) - 40} more changes')


if __name__ == '__main__':
    main()
