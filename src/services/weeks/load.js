import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const weeksDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../data/seed/weeks');

export async function loadWeeks() {
  let files = [];
  try {
    files = (await readdir(weeksDir)).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const weeks = [];
  for (const f of files) {
    weeks.push(JSON.parse(await readFile(path.join(weeksDir, f), 'utf8')));
  }
  return weeks.sort((a, b) => String(b.start).localeCompare(String(a.start)));
}

export async function loadCurrentWeek() {
  const weeks = await loadWeeks();
  return weeks[0] || null;
}
