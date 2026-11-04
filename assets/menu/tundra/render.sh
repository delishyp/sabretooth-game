#!/bin/bash
D=$(cd "$(dirname "$0")" && pwd)
shot(){ google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1920,1080 --virtual-time-budget=3000 "$@" 2>/dev/null; }
L=menu-left-sky-panel
shot --screenshot=$D/mockup-tundra-$L.png "file://$D/html/$L.html?noguide"
shot --screenshot=$D/mockup-tundra-$L-keepclear-guides.png "file://$D/html/$L.html"
shot --default-background-color=00000000 --screenshot=$D/ui/ui-layer-$L-transparent.png "file://$D/html/$L.html?uionly&noguide"
