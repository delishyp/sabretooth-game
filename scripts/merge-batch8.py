#!/usr/bin/env python3
"""Apply Saga batch 8. These rows win over batches 1–7, so a changed `before` still updates."""
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = Path('/tmp/batch8/batch-8-anna-fixes/batch-8-anna-fixes-overrides.json')
OUTCOMES = {
    'help_bonefield_cat': 'ford_bonefield_keeps',
    'side_with_highcrag': 'ford_highcrag_keeps',
    'stay_out': 'ford_river_takes',
}

spec = importlib.util.spec_from_file_location('merge23', ROOT / 'scripts' / 'merge-batch23.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class Batch8(mod.Merger):
    def acceptable(self, line, current):
        if line.get('added') or not line.get('before'):
            return True
        if super().acceptable(line, current):
            return True
        return True

    def event_field(self, data, ident):
        found = super().event_field(data, ident)
        if found:
            return found
        families = data.get('families') if isinstance(data, dict) else None
        if not isinstance(families, list):
            return None
        by_id = {row.get('id'): row for row in families if isinstance(row, dict)}
        cands = [eid for eid in by_id if ident == eid or ident.startswith(eid + '.')]
        if not cands:
            return None
        eid = max(cands, key=len)
        rest = ident[len(eid):].lstrip('.')
        if not rest:
            return None
        return self.walk(by_id[eid], rest)

    def apply_ford_result(self, line):
        choice = line['id'].rsplit('.', 1)[-1]
        book = self.doc(line['file'])
        results = book['data'].setdefault('fordStory', {}).setdefault('results', {})
        row = results.setdefault(choice, {})
        row['outcome'] = OUTCOMES[choice]
        row['text'] = mod.flatten(line['block'])
        book['dirty'] = True
        self.mark(line)

    def apply_line(self, line):
        if isinstance(line, dict) and line.get('added') and str(line.get('id', '')).startswith('fordStory.results.'):
            self.apply_ford_result(line)
            return
        super().apply_line(line)

    def apply_choice(self, choice):
        super().apply_choice(choice)
        if not choice.get('reply') or choice.get('replyId') or str(choice.get('replyKey') or '').startswith('REPLIES'):
            return
        label_file = choice.get('labelFile') or ''
        if not label_file.endswith('.json') or not choice.get('labelId'):
            return
        parent, key, _path = self.resolve(label_file, choice['labelId'])
        if not isinstance(parent, dict) or 'reply' not in parent:
            return
        speaker = parent['reply'].get('speaker') or '{catId}'
        parent['reply'] = {'speaker': speaker, 'parts': choice['reply']['parts']}
        self.doc(label_file)['dirty'] = True

    def apply_pass2_label(self, choice):
        super().apply_pass2_label(choice)
        if not choice.get('scopedLabel'):
            return
        shared = dict(choice)
        shared['scopedLabel'] = False
        super().apply_pass2_label(shared)

    def run(self):
        batch = json.loads(DOC.read_text())
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
                mod.dump_json(doc['path'], doc['data'])
        for slot in self.js.values():
            if slot['dirty']:
                slot['path'].write_text(slot['text'])
        print(f'applied {len(self.applied)}')
        return 0


if __name__ == '__main__':
    sys.exit(Batch8().run())
