# Updates

The game checks GitHub Releases (delishyp/sabretooth-game, public) every time it launches.
If a newer version exists it downloads in the background, then asks **Restart now / Later**.

## Publishing a new release
1. Bump `version` in `package.json` (e.g. 0.1.1 -> 0.1.2) and commit/push.
2. Build and publish (needs a GitHub token with Contents: Read and write on this repo):
   `GH_TOKEN=... npx electron-builder --win nsis --publish always`
   This uploads `Sabretooth Setup X.Y.Z.exe`, its `.blockmap`, and `latest.yml` to a release `vX.Y.Z`.
3. On GitHub, publish the release if it was left as a draft. Installed copies update on next launch.
