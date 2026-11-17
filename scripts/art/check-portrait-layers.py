#!/usr/bin/env python3
"""Check adult and cub portrait poses share one layer stack and a 1152×864 canvas."""
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'assets' / 'portraits'
POSES = ['portrait-female', 'portrait-male', 'portrait-female-cub', 'portrait-male-cub']
ADULT = 'portrait-female'


def png_size(path):
    data = path.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise SystemExit(f'{path} is not a png')
    w, h = struct.unpack('>II', data[16:24])
    return w, h


def manifest(pose):
    path = BASE / pose / 'manifest.json'
    if not path.is_file():
        raise SystemExit(f'missing {path}')
    return json.loads(path.read_text())


def main():
    adult = manifest(ADULT)
    adult_ids = [layer['id'] for layer in adult['layers']]
    for pose in POSES:
        doc = manifest(pose)
        if doc.get('size') != [1152, 864]:
            raise SystemExit(f'{pose} size {doc.get("size")}')
        ids = [layer['id'] for layer in doc['layers']]
        if ids != adult_ids:
            raise SystemExit(f'{pose} layers differ from {ADULT}: {ids}')
        folder = BASE / pose
        for name in [doc.get('lineart', 'lineart.png')] + [layer['file'] for layer in doc['layers']]:
            file = folder / name
            if not file.is_file():
                raise SystemExit(f'missing {file}')
            if png_size(file) != (1152, 864):
                raise SystemExit(f'{file} is {png_size(file)}')
        print(f'{pose}: {len(ids)} layers, 1152×864')
    print('portrait layers ok')


if __name__ == '__main__':
    sys.exit(main() or 0)
