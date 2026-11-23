import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { config } from '../../lib/config.js';

function safeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function fileForId(id) {
  return path.join(config.authUsersPath, `${id}.json`);
}

export async function ensureUsersDir() {
  await mkdir(config.authUsersPath, { recursive: true });
}

export async function findUserByEmail(email) {
  await ensureUsersDir();
  const target = safeEmail(email);
  const files = await readdir(config.authUsersPath);
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const raw = JSON.parse(await readFile(path.join(config.authUsersPath, f), 'utf8'));
    if (safeEmail(raw.email) === target) return raw;
  }
  return null;
}

export async function findUserById(id) {
  await ensureUsersDir();
  try {
    return JSON.parse(await readFile(fileForId(id), 'utf8'));
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function createUser({ email, password, name }) {
  const normalized = safeEmail(email);
  if (!normalized || !normalized.includes('@')) {
    const err = new Error('valid email required');
    err.status = 400;
    throw err;
  }
  if (!password || String(password).length < 8) {
    const err = new Error('password must be at least 8 characters');
    err.status = 400;
    throw err;
  }
  if (await findUserByEmail(normalized)) {
    const err = new Error('email already registered');
    err.status = 409;
    throw err;
  }
  await ensureUsersDir();
  const id = nanoid(12);
  const user = {
    id,
    email: normalized,
    name: String(name || normalized.split('@')[0]).slice(0, 80),
    passwordHash: await bcrypt.hash(String(password), 10),
    profile: {
      zip: '',
      calorieGoal: config.defaultCalorieGoal,
      weeklyBudget: config.defaultWeeklyBudget,
      allergies: [],
      likes: [],
      goal: 'maintain', // lose | maintain | gain
      activity: 'moderate',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeFile(fileForId(id), JSON.stringify(user, null, 2), 'utf8');
  return user;
}

export async function verifyLogin(email, password) {
  const user = await findUserByEmail(email);
  if (!user) {
    const err = new Error('invalid email or password');
    err.status = 401;
    throw err;
  }
  const ok = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!ok) {
    const err = new Error('invalid email or password');
    err.status = 401;
    throw err;
  }
  return user;
}

export async function updateProfile(userId, patch = {}) {
  const user = await findUserById(userId);
  if (!user) {
    const err = new Error('user not found');
    err.status = 404;
    throw err;
  }
  if (patch.name != null) user.name = String(patch.name).slice(0, 80);
  const profile = { ...user.profile, ...(patch.profile || {}) };
  if (patch.calorieGoal != null) profile.calorieGoal = Number(patch.calorieGoal);
  if (patch.weeklyBudget != null) profile.weeklyBudget = Number(patch.weeklyBudget);
  if (patch.zip != null) profile.zip = String(patch.zip);
  if (patch.goal != null) profile.goal = String(patch.goal);
  if (patch.activity != null) profile.activity = String(patch.activity);
  if (Array.isArray(patch.allergies)) profile.allergies = patch.allergies;
  if (Array.isArray(patch.likes)) profile.likes = patch.likes;
  if (patch.profile) {
    Object.assign(profile, patch.profile);
  }
  user.profile = profile;
  user.updatedAt = new Date().toISOString();
  await writeFile(fileForId(userId), JSON.stringify(user, null, 2), 'utf8');
  return user;
}
