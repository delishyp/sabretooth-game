// Windows CI builds. PowerShell splits electron-builder's -c.directories.output=... flag,
// so the feed builds go through the programmatic API instead.
const { build } = require('electron-builder');

const output = process.argv[2];
const version = process.argv[3];
if (!output) {
  console.error('usage: node scripts/build-win-feed.js <output-dir> [version]');
  process.exit(2);
}

const config = {
  directories: { output },
  nsis: { include: 'scripts/nsis-ci-log.nsh' },
};
if (version) config.extraMetadata = { version };

build({
  win: ['nsis'],
  publish: 'never',
  config,
}).then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
