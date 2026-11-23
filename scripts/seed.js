#!/usr/bin/env node
/**
 * Seed catalog JSON + household preference memory.
 *
 * Usage:
 *   npm run seed
 *   npm run seed -- --user joe
 *   npm run seed -- --user default --force
 */
import { copyFile, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const seedDir = path.join(root, 'data/seed');
const prefsDir = path.join(root, 'data/prefs');

const args = process.argv.slice(2);
const force = args.includes('--force');
const userFlag = args.indexOf('--user');
const userArg = userFlag >= 0 ? args[userFlag + 1] : null;

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function seedCatalog() {
  const files = ['stores.json', 'prices.json', 'recipes.json', 'household-joe.json'];
  for (const f of files) {
    const p = path.join(seedDir, f);
    if (!(await exists(p))) {
      console.warn(`seed skip missing ${f}`);
      continue;
    }
    const data = JSON.parse(await readFile(p, 'utf8'));
    const n = Array.isArray(data) ? data.length : Object.keys(data).length;
    console.log(`seed ok ${f} (${n} entries)`);
  }
}

function buildPrefsFromHousehold(household) {
  const p = household.prefs || {};
  return {
    likes: p.likes || [],
    dislikes: p.dislikes || [],
    allergies: p.allergies || [],
    taste: p.taste || {},
    recentRecipeIds: p.recentRecipeIds || [],
    weeklyHistory: p.weeklyHistory || [],
    staplesCookedWell: p.staplesCookedWell || [],
    cookingStyle: p.cookingStyle || {},
    profile: household.profile || {},
    memoryBlurb: p.memoryBlurb || '',
    seededFrom: 'data/seed/household-joe.json',
    updatedAt: new Date().toISOString(),
  };
}

async function seedHouseholdUsers() {
  const householdPath = path.join(seedDir, 'household-joe.json');
  if (!(await exists(householdPath))) {
    console.warn('seed skip household prefs (no household-joe.json)');
    return;
  }

  const household = JSON.parse(await readFile(householdPath, 'utf8'));
  const prefs = buildPrefsFromHousehold(household);
  const targets = new Set([
    household.userId,
    ...(household.aliases || []),
    ...(userArg ? [userArg] : []),
  ].filter(Boolean));

  await mkdir(prefsDir, { recursive: true });

  for (const userId of targets) {
    const safe = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
    const dest = path.join(prefsDir, `user-${safe}.json`);
    if ((await exists(dest)) && !force) {
      // Refresh memory fields but keep any live feedback history if present
      const current = JSON.parse(await readFile(dest, 'utf8'));
      const merged = {
        ...prefs,
        ...current,
        likes: [...new Set([...(prefs.likes || []), ...(current.likes || [])])],
        dislikes: [...new Set([...(prefs.dislikes || []), ...(current.dislikes || [])])],
        allergies: [...new Set([...(prefs.allergies || []), ...(current.allergies || [])])],
        taste: { ...(prefs.taste || {}), ...(current.taste || {}) },
        staplesCookedWell: prefs.staplesCookedWell,
        cookingStyle: prefs.cookingStyle,
        profile: prefs.profile,
        memoryBlurb: prefs.memoryBlurb,
        seededFrom: prefs.seededFrom,
        // Keep richer history: seed baseline + any newer plans
        recentRecipeIds: [...new Set([
          ...(current.recentRecipeIds || []),
          ...(prefs.recentRecipeIds || []),
        ])].slice(0, 64),
        weeklyHistory: [
          ...(current.weeklyHistory || []),
          ...(prefs.weeklyHistory || []),
        ].slice(0, 12),
        updatedAt: new Date().toISOString(),
      };
      await writeFile(dest, JSON.stringify(merged, null, 2), 'utf8');
      console.log(`seed prefs merged → user-${safe}.json`);
    } else {
      await writeFile(dest, JSON.stringify(prefs, null, 2), 'utf8');
      console.log(`seed prefs wrote → user-${safe}.json`);
    }
  }

  // Also keep a canonical copy under seed for inspection
  const snapshot = path.join(seedDir, 'prefs-joe.snapshot.json');
  await writeFile(snapshot, JSON.stringify(prefs, null, 2), 'utf8');
  console.log('seed snapshot → data/seed/prefs-joe.snapshot.json');
}

await seedCatalog();
await seedHouseholdUsers();
console.log('seed done');
