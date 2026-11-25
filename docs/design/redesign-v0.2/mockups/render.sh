#!/bin/bash
# Render every screen at 1920x1080 and 3440x1440 with headless Chrome.
cd "$(dirname "$0")"
for f in [0-9][0-9]*-*.html; do n=${f%.html}
  for sz in "1080 1920,1080" "ultrawide 3440,1440"; do set -- $sz
    /usr/bin/google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
      --virtual-time-budget=3000 --window-size=$2 --screenshot="$PWD/renders/$1/$n.png" "file://$PWD/$f" 2>/dev/null
  done; done
