/**
 * Deeds live in the app data folder, not in a save slot.
 * Each entry is {id, earnedAt, runId, difficulty}. Earned once, never revoked.
 */
const fs = require('fs');
const path = require('path');

function createAchievementsStore(dir) {
  const file = path.join(dir, 'achievements.json');
  function read() {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }
  function write(rows) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  }
  return {
    file,
    list: read,
    has(id) { return read().some((row) => row.id === id); },
    earn({ id, runId, difficulty, earnedAt } = {}) {
      if (!id) throw new Error('missing deed');
      const rows = read();
      if (rows.some((row) => row.id === id)) return { earned: false, rows };
      const row = { id, earnedAt: earnedAt || new Date().toISOString(), runId: runId || null, difficulty: difficulty || 'standard' };
      rows.push(row);
      write(rows);
      return { earned: true, rows };
    }
  };
}

module.exports = { createAchievementsStore };
