# Main menu — Direction B "Frost Steppe", NIGHT backup (DRAFT, awaiting Anna's pick)
1920x1080 review size only (no 4K master yet).

- night-bg-v2-skygaze.png  — Smilodon lying on the ridge facing LEFT, head tipped up to the open star sky (recommended)
- night-bg-v1-moongaze.png — same cat facing RIGHT, gazing up past the moon
- menu-mockup-night-v1.png / -v2.png — B's frosted-glass UI re-rendered over each (html/menu-night.html?v=1|2&nostars=1)
- crops/ — 1:1 full-res crops of head+sabers and legs+paws+tail for both versions
- overlay/ — shooting-stars.js/.css + README for Flint
- preview/ — shooting-stars-preview-v2.mp4 / .gif (10 s), frame-with-streak-v2.png
- work/ — sources: male_base.jpg (approved), lying_b2.jpg (base reposed to lying, flat colour, white bg),
  bg1920.png (B's raw night background, no cats/text/streaks), composite_night.py (cut-out, moonlight grade,
  rim light, snow drift, contact shadow), record.js (deterministic headless-Chrome recorder).

Re-render mockup: google-chrome --headless=new --window-size=1920,1080 --hide-scrollbars \
  --screenshot=out.png "file://$PWD/html/menu-night.html?v=2&nostars=1"
Preview: cd work && node record.js 2 frames_v2 300 && ffmpeg -framerate 30 -i frames_v2/f%04d.jpg \
  -vf scale=1280:720 -c:v libx264 -pix_fmt yuv420p ../preview/out.mp4
