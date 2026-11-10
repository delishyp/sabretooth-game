#!/usr/bin/env python3
"""Merge Saga batch-1 overrides by node and choice key, not by source line number.

Look-gated leader beats (when.look) stay out. Any other override that cannot
be placed fails the run. Payoff 1.5b's one line is written onto every band.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
BATCH = pathlib.Path('/home/ubuntu/.cursor/projects/workspace/uploads/batch-1-overrides_7f9d.json')


def norm(text):
    text = str(text or '')
    text = text.replace("\\'", "'").replace('\\"', '"')
    text = text.replace('“', '"').replace('”', '"').replace('’', "'").replace('‘', "'")
    return re.sub(r'\s+', ' ', text).strip()


def flatten(block):
    parts = (block or {}).get('parts') or []
    return ' '.join((part.get('say') or part.get('beat') or '').strip() for part in parts if part).strip()


def load_json(rel):
    path = ROOT / rel
    return json.loads(path.read_text()), path


def dump_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')


def walk(node, fn, path=()):
    fn(node, path)
    if isinstance(node, dict):
        for key, value in node.items():
            walk(value, fn, path + (key,))
    elif isinstance(node, list):
        for index, value in enumerate(node):
            walk(value, fn, path + (index,))


def when_eq(a, b):
    if not isinstance(a, dict) or not isinstance(b, dict):
        return False
    keys = ('trait', 'band', 'who')
    if not all(k in a and k in b for k in keys):
        return False
    return all(a.get(k) == b.get(k) for k in keys)


class Merger:
    def __init__(self):
        self.docs = {}
        self.unresolved = []
        self.applied = []
        self.held = []

    def doc(self, rel):
        if rel not in self.docs:
            data, path = load_json(rel)
            self.docs[rel] = {'data': data, 'path': path, 'dirty': False}
        return self.docs[rel]

    def hold(self, line):
        self.held.append(line.get('id'))

    def fail(self, line, reason):
        self.unresolved.append(f"{line.get('id')}: {reason}")

    def mark(self, line):
        self.applied.append(line.get('id'))

    def js(self, rel):
        if not hasattr(self, '_js'):
            self._js = {}
        if rel not in self._js:
            path = ROOT / rel
            self._js[rel] = {'path': path, 'text': path.read_text()}
        return self._js[rel]

    def replace_js(self, line):
        rel = line['file'].split('+')[0].strip()
        slot = self.js(rel)
        before = line['before'].replace("'", "\\'")
        if slot['text'].count(before) != 1:
            self.fail(line, f'{rel} before count {slot["text"].count(before)}')
            return
        new = flatten(line['block']).replace("'", "\\'")
        slot['text'] = slot['text'].replace(before, new, 1)
        slot['dirty'] = True
        self.mark(line)

    def beats_of(self, data, scene):
        if scene.startswith('slice.meeting.'):
            for event in data.get('events', []):
                if event.get('id') == scene:
                    return event.get('beats')
            return None
        # sample-beats and first-season families use the scene id as a key
        if isinstance(data, dict) and isinstance(data.get('families'), list):
            for family in data['families']:
                if isinstance(family, dict) and family.get('id') == scene:
                    return family.get('beats')
        if isinstance(data, dict) and scene in data and isinstance(data[scene], dict):
            return data[scene].get('beats')
        return None

    def event_of(self, data, scene):
        for event in data.get('events', []):
            if event.get('id') == scene:
                return event
        return None

    def apply_text_line(self, line):
        rels = [part.strip() for part in line['file'].split('+')]
        rels = [rel for rel in rels if rel.endswith('.json')]
        before = line.get('before')
        when = line.get('when') if isinstance(line.get('when'), dict) else None
        placed = False
        for rel in rels:
            doc = self.doc(rel)
            data = doc['data']
            # event fallback text
            if line['id'].endswith('.text') and 'beats[' not in line['id'] and line['id'].count('.') == 2:
                scene = line['id'].rsplit('.', 1)[0]
                event = self.event_of(data, scene) if isinstance(data, dict) and 'events' in data else None
                if event and norm(event.get('text')) == norm(before):
                    event['text'] = flatten(line['block'])
                    doc['dirty'] = True
                    placed = True
                    break
            # trait beat inside a known scene
            scene = line['id'].split('.beats[')[0]
            beats = self.beats_of(data, scene) if isinstance(data, dict) else None
            if isinstance(beats, list):
                hits = [beat for beat in beats if isinstance(beat, dict) and norm(beat.get('text')) == norm(before)]
                if not hits and when and 'trait' in when:
                    hits = [beat for beat in beats if isinstance(beat, dict) and when_eq(beat.get('when'), when)]
                if '.beats[' in line['id']:
                    if len(hits) == 1:
                        self.write_beat(hits[0], line)
                        doc['dirty'] = True
                        placed = True
                    else:
                        self.fail(line, f'beat hits {len(hits)} in {rel}')
                    return
                if len(hits) == 1:
                    self.write_beat(hits[0], line)
                    doc['dirty'] = True
                    placed = True
                    break
            # speech coverage rows and payoff openers: match text, disambiguate by id tokens
            found = []
            def visit(node, path):
                if isinstance(node, dict) and isinstance(node.get('text'), str) and norm(node['text']) == norm(before):
                    found.append((node, path))
            walk(data, visit)
            if when and when.get('band'):
                narrowed = [item for item in found if isinstance(item[0].get('when'), dict) and item[0]['when'].get('band') in (when['band'], 'baseline' if when['band'] == 'middle' else when['band'])]
                if len(narrowed) == 1:
                    found = narrowed
            if len(found) == 1:
                self.write_beat(found[0][0], line)
                doc['dirty'] = True
                placed = True
                break
            if len(found) > 1:
                # speech id in the override id, e.g. speechCoverage.m2.repeat_meeting|beats.1.baseline
                ident = line['id']
                narrowed = [item for item in found if ident.split('|')[-1].split('.')[0] in json.dumps(item[1])]
                if len(narrowed) == 1:
                    self.write_beat(narrowed[0][0], line)
                    doc['dirty'] = True
                    placed = True
                    break
        if placed:
            self.mark(line)
        else:
            self.fail(line, 'text node not found')

    def write_beat(self, beat, line):
        block = line.get('block')
        if line.get('removed') or (isinstance(block, dict) and block.get('removed')):
            beat['removed'] = True
            return
        if not isinstance(block, dict):
            self.fail(line, 'missing block')
            return
        beat['text'] = flatten(block)
        beat['parts'] = block.get('parts')
        speaker = block.get('speaker')
        if speaker and speaker != 'narrator':
            beat['kind'] = beat.get('kind') or 'speech'
            beat['speaker'] = speaker
        elif speaker == 'narrator':
            beat['kind'] = beat.get('kind') or 'narration'
            beat.pop('speaker', None)
        bycat = line.get('byCat')
        if bycat:
            beat['byCat'] = bycat

    def apply_cue(self, line):
        rel = 'src/renderer/data/events/first-season-v0.6.2.json'
        doc = self.doc(rel)
        cues = doc['data']['personalityContract']['fiveTraitActionCues']
        trait = line['when']['actionCue']
        band = line['when']['band']
        if trait not in cues or band not in cues[trait]:
            self.fail(line, f'missing cue {trait}.{band}')
            return
        if norm(cues[trait][band]) != norm(line.get('before')):
            self.fail(line, f'cue before mismatch {trait}.{band}')
            return
        cues[trait][band] = flatten(line['block'])
        doc['dirty'] = True
        self.mark(line)

    def apply_speech(self, line):
        # speechCoverage.m2.repeat_meeting|beats.1.baseline
        ident = line['id'][len('speechCoverage.'):]
        speech_id, _, band = ident.rpartition('.')
        band = {'middle': 'baseline'}.get(band, band)
        doc = self.doc('src/renderer/data/events/first-season-v0.6.2.json')
        rows = doc['data']['personalityContract']['speechCoverage']
        hits = [row for row in rows if row.get('speechId') == speech_id]
        if len(hits) != 1 or band not in hits[0]:
            self.fail(line, f'speech {speech_id} {band}')
            return
        if norm(hits[0][band]) != norm(line.get('before')):
            self.fail(line, f'speech before mismatch {speech_id} {band}')
            return
        hits[0][band] = flatten(line['block'])
        doc['dirty'] = True
        self.mark(line)

    def apply_choice(self, scene, choice):
        choice_id = choice.get('choiceId')
        if not choice_id:
            return
        label_file = str(choice.get('labelFile') or '')
        if label_file.endswith('.js'):
            slot = self.js(label_file)
            before = choice.get('labelBefore') or ''
            if slot['text'].count(before) != 1:
                self.unresolved.append(f"{scene['scene']} choice {choice_id}: label count {slot['text'].count(before)}")
                return
            slot['text'] = slot['text'].replace(before, choice.get('label') or before, 1)
            slot['dirty'] = True
            self.applied.append(f"{scene['scene']}:{choice_id}")
            return
        if 'payoff 1.5 (' in scene['scene'] and '1.5b' not in scene['scene']:
            doc = self.doc('src/renderer/data/events/payoffs-v0.2.json')
            node = doc['data']['1.5_still_alone']['choices'].get(choice_id)
            if not node:
                self.unresolved.append(f"{scene['scene']} choice {choice_id}: not found")
                return
            if choice.get('label'):
                node['label'] = choice['label']
            if choice.get('reply'):
                node['reply'] = choice['reply']
            result = choice.get('result')
            if isinstance(result, dict) and result.get('block'):
                node['text'] = flatten(result['block'])
                node['parts'] = result['block'].get('parts')
            doc['dirty'] = True
            self.applied.append(f"{scene['scene']}:{choice_id}")
            return
        scene_ids = []
        if scene['scene'].startswith('slice.meeting.'):
            scene_ids.append(scene['scene'].split(' ')[0])
        if scene['scene'].startswith('m2.'):
            scene_ids.append(scene['scene'].split(' ')[0])
        placed = False
        owners = scene_ids or []
        for rel in (
            'src/renderer/data/events/slice-1.json',
            'src/renderer/data/events/first-season-v0.6.2.json',
            'src/renderer/data/events/payoffs-v0.2.json',
        ):
            doc = self.doc(rel)
            hits = []
            def visit(node, path):
                if not isinstance(node, dict):
                    return
                if owners and node.get('id') in owners:
                    for item in node.get('choices') or []:
                        if isinstance(item, dict) and item.get('id') == choice_id:
                            hits.append(item)
                choices = node.get('choices') if node.get('id') in owners or not owners else None
                if isinstance(choices, dict) and choice_id in choices:
                    hits.append(choices[choice_id])
            walk(doc['data'], visit)
            if len(hits) > 1 and choice.get('labelBefore'):
                matched = [node for node in hits if norm(node.get('label', '')) == norm(choice['labelBefore'])]
                if len(matched) == 1:
                    hits = matched
            if len(hits) != 1:
                continue
            node = hits[0]
            if choice.get('label'):
                node['label'] = choice['label']
            if choice.get('reply'):
                node['reply'] = choice['reply']
            result = choice.get('result')
            if isinstance(result, dict) and result.get('block'):
                node['text'] = flatten(result['block'])
                node['parts'] = result['block'].get('parts')
            doc['dirty'] = True
            placed = True
            break
        if not placed:
            self.unresolved.append(f"{scene['scene']} choice {choice_id}: not found")
        else:
            self.applied.append(f"{scene['scene']}:{choice_id}")

    def apply_15b(self, line):
        doc = self.doc('src/renderer/data/events/payoffs-v0.2.json')
        rows = doc['data'].get('1.5_seeking_company_gossip_opener')
        if not isinstance(rows, list) or len(rows) < 3:
            self.fail(line, '1.5b opener missing bands')
            return
        spoken = flatten(line['block'])
        for row in rows:
            row['text'] = spoken
            row['parts'] = line['block'].get('parts')
            row['speaker'] = line['block'].get('speaker')
        doc['dirty'] = True
        self.mark(line)

    def run(self):
        batch = json.loads(BATCH.read_text())
        groups = {}
        for scene in batch['scenes']:
            for name, group in (scene.get('byCatGroups') or {}).items():
                groups[name] = group.get('byCat')
        for scene in batch['scenes']:
            for line in scene.get('lines') or []:
                if not isinstance(line, dict):
                    continue
                when = line.get('when') if isinstance(line.get('when'), dict) else {}
                if 'look' in when:
                    self.hold(line)
                    continue
                if line.get('id') == 'action cue':
                    self.applied.append('action cue -> fiveTraitActionCues')
                    continue
                if line.get('byCatGroup') and not line.get('byCat'):
                    line = dict(line)
                    line['byCat'] = groups.get(line['byCatGroup'])
                if when.get('actionCue'):
                    self.apply_cue(line)
                    continue
                if line.get('id') == '1.5_seeking_company_gossip_opener':
                    self.apply_15b(line)
                    continue
                if line.get('id', '').startswith('speechCoverage.'):
                    self.apply_speech(line)
                    continue
                if line.get('file', '').endswith('.js'):
                    self.replace_js(line)
                    continue
                self.apply_text_line(line)
            for choice in scene.get('choices') or []:
                if isinstance(choice, dict):
                    self.apply_choice(scene, choice)
        if self.unresolved:
            print('UNRESOLVED')
            for item in self.unresolved:
                print(' -', item)
            return 1
        for doc in self.docs.values():
            if doc['dirty']:
                dump_json(doc['path'], doc['data'])
        for slot in getattr(self, '_js', {}).values():
            if slot.get('dirty'):
                slot['path'].write_text(slot['text'])
        print(f'applied {len(self.applied)} held {len(self.held)}')
        return 0


if __name__ == '__main__':
    sys.exit(Merger().run())
