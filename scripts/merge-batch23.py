#!/usr/bin/env python3
"""Merge Saga batches 1-patch, 2a, 2b, 2b-patch, and 3 by node and choice key.

A later row for the same id replaces the earlier one. The original `before`
must match the text on disk, or the text this run already wrote for that id,
or the batch-1 block a patch names. Anything else fails the run.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
UPLOADS = pathlib.Path('/home/ubuntu/.cursor/projects/workspace/uploads')
BATCHES = [
    UPLOADS / 'batch-1-patch-overrides_970a.json',
    UPLOADS / 'batch-2a-overrides_4f92.json',
    UPLOADS / 'batch-2b-overrides_4f7c.json',
    UPLOADS / 'batch-2b-patch-overrides_f1ea.json',
    UPLOADS / 'batch-3-overrides_060e.json',
]


def norm(text):
    text = str(text or '')
    text = text.replace("\\'", "'").replace('\\"', '"')
    text = text.replace('“', '"').replace('”', '"').replace('’', "'").replace('‘', "'")
    return re.sub(r'\s+', ' ', text).strip()


def flatten(block):
    if not isinstance(block, dict):
        return ''
    parts = block.get('parts') or []
    return ' '.join((part.get('say') or part.get('beat') or '').strip() for part in parts if part).strip()


def load_json(rel):
    path = ROOT / rel
    return json.loads(path.read_text()), path


def dump_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')


class Merger:
    def __init__(self):
        self.docs = {}
        self.js = {}
        self.unresolved = []
        self.applied = []
        self.written = {}
        self.context = {}
        self.focus = {}
        self.dropped = set()

    def doc(self, rel):
        if rel not in self.docs:
            data, path = load_json(rel)
            self.docs[rel] = {'data': data, 'path': path, 'dirty': False}
        return self.docs[rel]

    def slot(self, rel):
        if rel not in self.js:
            path = ROOT / rel
            self.js[rel] = {'path': path, 'text': path.read_text(), 'dirty': False}
        return self.js[rel]

    def fail(self, line, reason):
        self.unresolved.append(f"{line.get('id') or line.get('labelId') or line.get('choiceId')}: {reason}")

    def mark(self, line):
        self.applied.append(line.get('id') or line.get('labelKey') or line.get('choiceId'))

    def acceptable(self, line, current):
        if norm(current) == norm(line.get('before')):
            return True
        prior = self.written.get(line.get('id'))
        if prior is not None and norm(current) == norm(prior):
            return True
        after = ((line.get('batch1') or {}).get('after'))
        if isinstance(after, dict) and norm(current) == norm(flatten(after)):
            return True
        return False

    def remember(self, line, text):
        if line.get('id'):
            self.written[line['id']] = text

    def note_place(self, rel, place):
        if not isinstance(place, dict) or not place.get('path'):
            return
        key = (rel, place['path'])
        if place.get('context'):
            self.context[key] = place['context']
        if place.get('focusTrait'):
            self.focus[key] = place['focusTrait']

    def apply_context(self, rel, path, row):
        if not isinstance(row, dict):
            return
        ctx = self.context.get((rel, path))
        if ctx:
            row['context'] = ctx
        focus = self.focus.get((rel, path))
        if focus:
            row['focusTrait'] = focus

    def write_value(self, parent, key, line):
        block = line.get('block') or {}
        text = flatten(block)
        current = parent[key]
        if isinstance(current, str):
            if line.get('removed'):
                parent.pop(key, None)
                if isinstance(parent, dict):
                    parent['removed'] = True
            else:
                parent[key] = text
        elif isinstance(current, dict) and 'text' in current:
            if line.get('removed'):
                current['removed'] = True
            else:
                current['text'] = text
                if block.get('parts'):
                    current['parts'] = block['parts']
                if block.get('speaker'):
                    current['speaker'] = block['speaker']
        else:
            self.fail(line, 'not a text field')
            return False
        self.remember(line, text)
        return True

    def resolve(self, rel, ident):
        data = self.doc(rel)['data']
        speech = re.match(r'personalityCoverage\.speechLocations(/.+)\.(low|base|high)$', ident)
        if speech and 'personalityCoverage' in data:
            path, band = speech.group(1), speech.group(2)
            row = data['personalityCoverage']['speechLocations'].get(path)
            return row, band, path
        cue = re.match(r'personalityCoverage\.contextActions\.([^.]+)\.([^.]+)\[(\d+)\]$', ident)
        if cue and 'personalityCoverage' in data:
            context, trait, index = cue.group(1), cue.group(2), int(cue.group(3))
            pair = data['personalityCoverage']['contextActions'][context][trait]
            return pair, index, None
        ford = re.match(r'fordStory\.speechLocations\.([^.]+)\.(low|base|high)$', ident)
        if ford and 'fordStory' in data:
            name, band = ford.group(1), ford.group(2)
            return data['fordStory']['speechLocations'][name], band, name
        policy = re.match(r'policy\.personalityCoverage\.speechLocations\.([^.]+)\.(low|base|high)$', ident)
        if policy and 'policy' in data:
            name, band = policy.group(1), policy.group(2)
            return data['policy']['personalityCoverage']['speechLocations'][name], band, name
        scout = re.match(r'bug3_scoutStanding\.(.+)$', ident)
        if scout and 'bug3_scoutStanding' in data:
            return data['bug3_scoutStanding'], scout.group(1), None
        event = self.event_field(data, ident)
        if event:
            return event
        walked = self.walk(data, ident)
        if walked:
            return walked
        return None, None, None

    def event_field(self, data, ident):
        events = data.get('events') if isinstance(data, dict) else None
        if not isinstance(events, list):
            return None
        by_id = {row.get('id'): row for row in events if isinstance(row, dict)}
        cands = [eid for eid in by_id if ident == eid or ident.startswith(eid + '.')]
        if not cands:
            return None
        eid = max(cands, key=len)
        rest = ident[len(eid):].lstrip('.')
        if not rest:
            return None
        return self.walk(by_id[eid], rest)

    def walk(self, node, expr):
        parent = None
        key = None
        current = node
        i = 0
        while i < len(expr):
            if expr[i] == '.':
                i += 1
                continue
            if expr[i] == '[':
                match = re.match(r'\[(\d+)\]', expr[i:])
                if not match or not isinstance(current, list):
                    return None
                index = int(match.group(1))
                if index >= len(current):
                    return None
                parent, key, current = current, index, current[index]
                i += match.end()
                continue
            if not isinstance(current, dict):
                return None
            cands = [name for name in current if expr.startswith(name, i) and (i + len(name) == len(expr) or expr[i + len(name)] in '.[')]
            if not cands:
                return None
            name = max(cands, key=len)
            parent, key, current = current, name, current[name]
            i += len(name)
        return parent, key, None

    def apply_line(self, line):
        if not isinstance(line, dict):
            return
        if line.get('info') and not line.get('id'):
            return
        if 'speechLocation' in line and not line.get('id'):
            rel = (line['speechLocation'].get('covFile') or line.get('file') or 'src/renderer/data/events/recurring-conversation.json')
            self.note_place(rel, line['speechLocation'])
            return
        ident = line.get('id')
        if not ident:
            return
        rel = (line.get('file') or '').split('+')[0].strip()
        if ident in ('REPAIR', 'SCOUT') or re.match(r'(pass2|conversation)\.js:\d+', ident):
            self.apply_js_string(line, rel or 'src/renderer/js/pass2.js')
            return
        if ident.startswith('LINES.'):
            self.apply_lines_key(line)
            return
        parent, key, path = self.resolve(rel, ident)
        if parent is None or key is None:
            if line.get('removed') or line.get('id') in self.dropped:
                self.mark(line)
                return
            if line.get('id') == 'laterMeeting.choices[2].label':
                parent, key, path = self.leave_label()
            else:
                self.fail(line, 'path not found')
                return
        if line.get('id') in self.dropped and not line.get('removed'):
            self.mark(line)
            return
        if isinstance(parent, dict) and key not in parent:
            if line.get('removed'):
                self.mark(line)
                return
            self.fail(line, f'missing {key}')
            return
        if isinstance(parent, list) and (not isinstance(key, int) or key >= len(parent)):
            if line.get('removed'):
                self.mark(line)
                return
            self.fail(line, 'index missing')
            return
        current = parent[key]
        shown = current if isinstance(current, str) else (current.get('text') if isinstance(current, dict) else None)
        if shown is None:
            self.fail(line, 'not text')
            return
        if line.get('removed') and not self.acceptable(line, shown):
            # The indexed choice is already gone and a later choice now occupies its slot.
            self.mark(line)
            return
        if not self.acceptable(line, shown):
            self.fail(line, 'before mismatch')
            return
        if isinstance(parent, dict) and path:
            self.apply_context(rel, path, parent)
        if not self.write_value(parent, key, line):
            return
        self.doc(rel)['dirty'] = True
        self.mark(line)

    def apply_js_string(self, line, rel):
        slot = self.slot(rel)
        before = line.get('before') or ''
        found = None
        for variant in (before, before.replace("'", "\\'"), before.replace('"', '\\"')):
            if variant and slot['text'].count(variant) == 1:
                found = variant
                break
        if not found:
            self.fail(line, f'{rel} before count')
            return
        after = flatten(line['block'])
        if "\\'" in found:
            after = after.replace("'", "\\'")
        if '\\"' in found:
            after = after.replace('"', '\\"')
        slot['text'] = slot['text'].replace(found, after, 1)
        slot['dirty'] = True
        self.remember(line, flatten(line['block']))
        self.mark(line)

    def apply_lines_key(self, line):
        ident = line['id']
        slot = self.slot('src/renderer/js/pass2.js')
        # LINES.followups.js:opener.ford_friend or LINES.followups.js:relayBeat
        body = ident[len('LINES.'):]
        if body.startswith('followups.js:opener.'):
            key = body.split('.', 1)[1]
            self.replace_object_value(slot, '"followups.js:opener"', key, line)
            return
        if body in ('followups.js:gossipBeat', 'followups.js:relayBeat'):
            self.replace_object_value(slot, None, body, line)
            return
        self.fail(line, 'unknown LINES id')

    def replace_object_value(self, slot, parent_key, key, line):
        before = line.get('before') or ''
        variants = [before, before.replace("'", "\\'"), before.replace('"', '\\"')]
        found = next((v for v in variants if v and slot['text'].count(v) == 1), None)
        if not found:
            # Scoped keys are inserted, not replaced. A shared value that moved is a mismatch.
            self.fail(line, 'LINES before count')
            return
        after = flatten(line['block'])
        if "\\'" in found:
            after = after.replace("'", "\\'")
        if '\\"' in found:
            after = after.replace('"', '\\"')
        slot['text'] = slot['text'].replace(found, after, 1)
        slot['dirty'] = True
        self.remember(line, flatten(line['block']))
        self.mark(line)

    def apply_choice(self, choice):
        if not isinstance(choice, dict):
            return
        if choice.get('replyLocation'):
            rel = choice.get('labelFile') or 'src/renderer/data/events/recurring-conversation.json'
            self.note_place(rel, choice['replyLocation'])
        for variant in choice.get('replyVariants') or []:
            self.apply_line(variant)
        if choice.get('result'):
            self.apply_line(choice['result'])
        label = choice.get('label')
        label_before = choice.get('labelBefore')
        label_file = choice.get('labelFile')
        if label and label_file and str(label_file).endswith('.js') and not str(label_file).endswith('pass2.js'):
            self.apply_js_string({
                'id': choice.get('labelId'), 'before': choice.get('labelBefore'),
                'block': {'parts': [{'say': label}]}
            }, label_file)
        elif label and label_file and str(label_file).endswith('pass2.js'):
            self.apply_pass2_label(choice)
        elif label and choice.get('labelId'):
            if choice['labelId'] in self.dropped:
                self.mark(choice)
                return
            parent, key, path = self.resolve(choice['labelFile'], choice['labelId'])
            if choice['labelId'] == 'laterMeeting.choices[2].label' and (parent is None or key is None):
                parent, key, path = self.leave_label()
            if parent is None or (isinstance(parent, dict) and key not in parent):
                self.fail(choice, 'label path not found')
            else:
                current = parent[key]
                fake = {'id': choice.get('labelId'), 'before': label_before}
                if not self.acceptable(fake, current):
                    self.fail(choice, 'label before mismatch')
                else:
                    parent[key] = label
                    self.doc(choice['labelFile'])['dirty'] = True
                    self.written[choice['labelId']] = label
                    self.mark(choice)
        reply_id = choice.get('replyId')
        if choice.get('reply') and reply_id:
            block = {'block': choice['reply'], 'before': choice.get('replyBefore'), 'id': reply_id, 'file': choice.get('replyFile')}
            self.apply_line(block)
        elif choice.get('reply') and str(choice.get('replyKey') or '').startswith('REPLIES'):
            self.apply_reply_const(choice)

    def apply_pass2_label(self, choice):
        slot = self.slot('src/renderer/js/pass2.js')
        key = choice['labelKey'] if choice.get('scopedLabel') else choice['labelId'].split('.')[-1]
        # Shared fallback keys are listen/leave/... Scoped keys are kind.id.
        if choice.get('scopedLabel'):
            key = choice['labelKey']
        needle = f'"{key}": '
        after = choice['label'].replace('"', '\\"')
        if needle in slot['text']:
            pattern = re.compile(rf'("{re.escape(key)}": ")((?:\\"|[^"])*)(")')
            match = pattern.search(slot['text'])
            if not match:
                self.fail(choice, 'label key unreadable')
                return
            current = match.group(2).replace('\\"', '"')
            fake = {'id': choice.get('labelId'), 'before': choice.get('labelBefore')}
            if not choice.get('scopedLabel') and not self.acceptable(fake, current):
                self.fail(choice, 'label before mismatch')
                return
            slot['text'] = slot['text'][:match.start(2)] + after + slot['text'][match.end(2):]
        else:
            anchor = '"take_share": "Take your share of the pride\'s kill."'
            if anchor not in slot['text']:
                # The shared label may already have been edited. Anchor on the key.
                anchor_match = re.search(r'\n( +"take_share": "[^"]*",)\n', slot['text'])
                if not anchor_match:
                    self.fail(choice, 'choices object anchor missing')
                    return
                insert_at = anchor_match.end(1)
                slot['text'] = slot['text'][:insert_at] + f'\n      "{key}": "{after}",' + slot['text'][insert_at:]
            else:
                insert_at = slot['text'].find(anchor) + len(anchor)
                comma = '' if slot['text'][insert_at:insert_at + 1] == ',' else ','
                slot['text'] = slot['text'][:insert_at] + comma + f'\n      "{key}": "{after}",' + slot['text'][insert_at:]
        slot['dirty'] = True
        self.mark(choice)

    def apply_reply_const(self, choice):
        key_match = re.search(r"REPLIES\['([^']+)'\]", choice.get('replyKey') or '')
        if not key_match:
            self.fail(choice, 'reply key')
            return
        key = key_match.group(1)
        say = flatten(choice['reply']).replace("'", "\\'")
        slot = self.slot('src/renderer/js/pass2.js')
        pattern = re.compile(rf"('{re.escape(key)}': catReply\(')((?:\\'|[^'])*)('\))")
        match = pattern.search(slot['text'])
        if not match:
            self.fail(choice, f'reply const {key} missing')
            return
        slot['text'] = slot['text'][:match.start(2)] + say + slot['text'][match.end(2):]
        slot['dirty'] = True
        self.mark(choice)

    def leave_label(self):
        choices = self.doc('src/renderer/data/events/recurring-conversation.json')['data']['laterMeeting']['choices']
        for choice in choices:
            if choice.get('id') == 'leave':
                return choice, 'label', None
        return None, None, None

    def run(self):
        for path in BATCHES:
            batch = json.loads(path.read_text())
            for scene in batch.get('scenes') or []:
                for line in scene.get('lines') or []:
                    if isinstance(line, dict) and line.get('removed') and line.get('id'):
                        self.dropped.add(line['id'])
        for path in BATCHES:
            batch = json.loads(path.read_text())
            for scene in batch.get('scenes') or []:
                for line in scene.get('lines') or []:
                    if isinstance(line, dict):
                        self.apply_line(line)
                for choice in scene.get('choices') or []:
                    self.apply_choice(choice)
        if self.unresolved:
            print('UNRESOLVED', len(self.unresolved))
            for item in self.unresolved:
                print(' -', item)
            return 1
        for doc in self.docs.values():
            if doc['dirty']:
                dump_json(doc['path'], doc['data'])
        for slot in self.js.values():
            if slot['dirty']:
                slot['path'].write_text(slot['text'])
        print(f'applied {len(self.applied)}')
        return 0


if __name__ == '__main__':
    sys.exit(Merger().run())
