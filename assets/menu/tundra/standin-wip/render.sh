#!/bin/bash
# Re-render all tundra outputs. Run from this folder.
D=$(cd "$(dirname "$0")" && pwd)
shot(){ google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1920,1080 --virtual-time-budget=3000 "$@" 2>/dev/null; }
for L in layout-1-sky-panel layout-2-banner-strip; do
  shot --screenshot=$D/menu-tundra-$L.png "file://$D/html/$L.html?noguide"
  shot --screenshot=$D/guides/menu-tundra-$L-with-keepclear-guides.png "file://$D/html/$L.html"
  shot --default-background-color=00000000 --screenshot=$D/ui/ui-layer-$L.png "file://$D/html/$L.html?uionly&noguide"
done
cp $D/scene/tundra-scene-1920.png $D/scene-only-no-ui.png
