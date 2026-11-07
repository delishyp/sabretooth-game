# Updates

The installed game checks GitHub Releases (delishyp/sabretooth-game, public) when it launches.
The window shows checking, download progress, and errors. Restart now runs the downloaded setup silently and starts the new version in place. Later installs that same download when the game quits. Neither path asks for a new folder. Saves and settings stay in `%APPDATA%\Sabretooth`.

A dev run that is not packaged does not check.

## Publishing a new release
1. Bump `version` in `package.json` (e.g. 0.1.1 -> 0.1.2) and commit/push.
2. Build and publish (needs a GitHub token with Contents: Read and write on this repo):
   `GH_TOKEN=... npx electron-builder --win nsis --publish always`
   This uploads `Sabretooth-Setup-X.Y.Z.exe`, its `.blockmap`, and `latest.yml` to a release `vX.Y.Z`.
3. On GitHub, publish the release if it was left as a draft. Installed copies update on next launch.
