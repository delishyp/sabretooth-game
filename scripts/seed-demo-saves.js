// Dev only: seed fake runs/saves into <userData>/saves for screenshots.  Usage: node scripts/seed-demo-saves.js <userDataDir>
const path = require('path'); const fs = require('fs');
const { createSavesStore } = require('../src/main/saves-store');
const ud = process.argv[2]; if (!ud) { console.error('usage: seed-demo-saves.js <userDataDir>'); process.exit(1); }
let t = Date.parse('2026-11-02T18:00:00Z'); const now = () => new Date((t += 3 * 3600e3));
const st = createSavesStore(path.join(ud, 'saves'), { now });
const a = st.createRun({ difficulty: 'heir', catName: 'Ashka', prideName: 'Frostfang Pride' });
st.writeSave(a.runId, { inGameDate: { year: 2, season: 'autumn', day: 14 }, playTimeSec: 5400 });
st.writeSave(a.runId, { inGameDate: { year: 3, season: 'winter', day: 3 }, playTimeSec: 9100 });
const b = st.createRun({ difficulty: 'sandbox', catName: 'Tor', prideName: 'Mammoth Ridge', sandboxOptions: { needsDrain: 'low', freeCustomization: true } });
st.writeSave(b.runId, { inGameDate: { year: 1, season: 'spring', day: 20 }, playTimeSec: 1800 });
st.writeSave(a.runId, { inGameDate: { year: 3, season: 'spring', day: 9 }, playTimeSec: 12000 });
// bump generation on the heir run for realism
const f = path.join(ud, 'saves', 'run-0', 'run.json'); fs.writeFileSync(f, JSON.stringify({ ...JSON.parse(fs.readFileSync(f)), generation: 2 }, null, 2));
console.log('seeded', ud);
