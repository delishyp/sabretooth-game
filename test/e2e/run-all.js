/**
 * Official e2e runner. A failing spec does not skip the later files.
 * Exit status is non-zero when any spec fails.
 */
const { spawn } = require('child_process');
const path = require('path');

const specs = ['menu.e2e.js', 'slice.e2e.js', 'conversation.e2e.js', 'tutorial.e2e.js', 'cats-list-layout.e2e.js', 'overlay-hold.e2e.js', 'wide-home.e2e.js', 'redesign.e2e.js'];

function runSpec(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
    child.on('error', (err) => {
      console.error(`e2e ${file} failed to start: ${err.message}`);
      resolve(1);
    });
    child.on('exit', (code, signal) => {
      if (signal) {
        console.error(`e2e ${file} exited on ${signal}`);
        resolve(1);
        return;
      }
      resolve(code == null ? 1 : code);
    });
  });
}

(async () => {
  const results = [];
  for (const file of specs) {
    console.log(`\n=== e2e ${file} ===`);
    const code = await runSpec(file);
    results.push({ file, code });
    if (code !== 0) console.error(`e2e ${file} failed (${code}); continuing`);
  }
  const failed = results.filter((r) => r.code !== 0);
  console.log(failed.length
    ? `e2e suite: ${failed.map((r) => r.file).join(', ')} failed`
    : 'e2e suite passed');
  process.exit(failed.length ? 1 : 0);
})();
