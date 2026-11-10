#!/usr/bin/env python3
"""Apply the batch-4 before/after list. Quote marks stay only where the field is one narration string that already shows speech. Gossip phrases drop a wrapping pair because the gossip beat adds it."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = Path('/home/ubuntu/.cursor/projects/workspace/uploads/BEFORE-AFTER_1e14.md')


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


def unwrap(text):
    if len(text) >= 2 and text[0] in '“"' and text[-1] in '”"':
        return text[1:-1]
    return text


def parse():
    text = DOC.read_text()
    rows = []
    for block in re.split(r'\n(?=- \*\*)', text):
        head = re.search(r'\*\*`([^`]+)` · `([^`]+)`\*\*', block)
        if head:
            before = re.search(r'- Before: (.*)', block)
            after = re.search(r'- After: (.*)', block)
            if before and after:
                rows.append({'file': head.group(1), 'id': head.group(2), 'before': before.group(1).strip(), 'after': after.group(1).strip(), 'kind': 'line'})
            continue
        choice = re.search(r'\*\*Choice `([^`]+)`\*\* · label key `([^`]+)` · `([^`]+)` · `([^`]+)`', block)
        if choice:
            before = re.search(r'- Label before: (.*)', block)
            after = re.search(r'- Label after: (.*)', block)
            if before and after:
                rows.append({'file': choice.group(3), 'id': choice.group(4), 'before': before.group(1).strip(), 'after': after.group(1).strip(), 'kind': 'label'})
    return rows


def main():
    rows = parse()
    docs = {}
    js = {}
    applied = []
    missed = []

    def doc(rel):
        if rel not in docs:
            path = ROOT / rel
            docs[rel] = {'path': path, 'data': json.loads(path.read_text()), 'dirty': False}
        return docs[rel]

    def source(rel):
        if rel not in js:
            path = ROOT / rel
            js[rel] = {'path': path, 'text': path.read_text(), 'dirty': False}
        return js[rel]

    for row in rows:
        after = row['after']
        before = row['before']
        rel = row['file']
        ident = row['id']
        if rel.endswith('.json'):
            book = doc(rel)
            data = book['data']
            if 'bug1_gossipPhrases' in ident or ident.startswith('bug1_'):
                key = ident.split('.', 1)[1]
                store = unwrap(after)
                if before == 'None':
                    data['bug1_gossipPhrases'][key] = store
                else:
                    current = data['bug1_gossipPhrases'].get(key)
                    if current != before:
                        missed.append(ident)
                        continue
                    data['bug1_gossipPhrases'][key] = store
            elif ident == 'bug4_curiosity_tail.text':
                current = data['bug4_curiosity_tail']['text']
                if current.strip('"') != before.strip('"'):
                    missed.append(ident)
                    continue
                data['bug4_curiosity_tail']['text'] = unwrap(after)
            elif rel.endswith('motives-v1.json'):
                slot, field = ident.split('.')
                current = data[slot][field]
                if current.strip('"') != before.strip('"') and current != before:
                    missed.append(ident)
                    continue
                data[slot][field] = after
            else:
                found = walk(data, ident)
                if not found:
                    missed.append(ident + ' path')
                    continue
                parent, key = found
                current = parent[key]
                if isinstance(current, str) and current != before:
                    missed.append(ident)
                    continue
                parent[key] = after
            book['dirty'] = True
            applied.append(ident)
            continue
        slot = source(rel)
        needle = before
        if ident == 'lone-actions.js:328':
            needle = "You said you'd bring something back. I haven't forgotten."
            after = unwrap(after)
        count = slot['text'].count(needle)
        if count != 1:
            missed.append(f'{ident} x{count}')
            continue
        slot['text'] = slot['text'].replace(needle, after, 1)
        slot['dirty'] = True
        applied.append(ident)

    for book in docs.values():
        if book['dirty']:
            book['path'].write_text(json.dumps(book['data'], indent=2, ensure_ascii=False) + '\n')
    for slot in js.values():
        if slot['dirty']:
            slot['path'].write_text(slot['text'])
    print('applied', len(applied))
    print('missed', len(missed))
    for item in missed:
        print(' ', item)


if __name__ == '__main__':
    main()
