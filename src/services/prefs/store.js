import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../lib/config.js';

function safeId(userId) {
  const id = String(userId || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!id) throw new Error('invalid userId');
  return id;
}

function fileFor(userId) {
  return path.join(config.prefsPath, `user-${safeId(userId)}.json`);
}

export function emptyPrefs() {
  return {
    likes: [],
    dislikes: [],
    allergies: [],
    taste: {},
    recentRecipeIds: [],
    weeklyHistory: [],
    staplesCookedWell: [],
    cookingStyle: {},
    profile: {},
    memoryBlurb: '',
    seededFrom: null,
    updatedAt: null,
  };
}

export async function loadPrefs(userId = 'default') {
  await mkdir(config.prefsPath, { recursive: true });
  const fp = fileFor(userId);
  try {
    const raw = await readFile(fp, 'utf8');
    return { ...emptyPrefs(), ...JSON.parse(raw) };
  } catch (err) {
    if (err && err.code === 'ENOENT') return emptyPrefs();
    throw err;
  }
}

export async function savePrefs(userId, prefs) {
  await mkdir(config.prefsPath, { recursive: true });
  const next = {
    ...emptyPrefs(),
    ...prefs,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(fileFor(userId), JSON.stringify(next, null, 2), 'utf8');
  return next;
}
