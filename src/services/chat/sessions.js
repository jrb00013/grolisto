import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { config } from '../../lib/config.js';

function sessionPath(id) {
  return path.join(config.chatSessionsPath, `${id}.json`);
}

export async function ensureSessionsDir() {
  await mkdir(config.chatSessionsPath, { recursive: true });
}

export function emptyWorkingMemory() {
  return {
    budget: null,
    days: null,
    meals: [],
    allergies: [],
    likes: [],
    storeId: null,
    zip: null,
    calorieGoal: null,
    activePlan: null,
    notes: '',
  };
}

export function createEmptySession({ userId = 'default', title = 'Kitchen chat' } = {}) {
  const now = new Date().toISOString();
  return {
    id: nanoid(16),
    userId: String(userId),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
    /** Durable extracted facts across the session */
    pinnedFacts: {
      likes: [],
      allergies: [],
      dislikes: [],
      constraints: [],
    },
    /** Compresses older turns */
    rollingSummary: '',
    /** Live planner/UI state attached to this session */
    workingMemory: emptyWorkingMemory(),
    meta: {
      turnCount: 0,
      lastRoute: null,
      lastIntent: null,
    },
  };
}

export async function saveSession(session) {
  await ensureSessionsDir();
  session.updatedAt = new Date().toISOString();
  await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2), 'utf8');
  return session;
}

export async function loadSession(id) {
  await ensureSessionsDir();
  try {
    return JSON.parse(await readFile(sessionPath(id), 'utf8'));
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

export async function createSession(opts = {}) {
  const session = createEmptySession(opts);
  if (opts.workingMemory) {
    session.workingMemory = { ...emptyWorkingMemory(), ...opts.workingMemory };
  }
  return saveSession(session);
}

export async function listSessions(userId, { limit = 20 } = {}) {
  await ensureSessionsDir();
  const files = await readdir(config.chatSessionsPath);
  const out = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const s = JSON.parse(await readFile(path.join(config.chatSessionsPath, f), 'utf8'));
    if (userId && s.userId !== userId) continue;
    out.push({
      id: s.id,
      userId: s.userId,
      title: s.title,
      updatedAt: s.updatedAt,
      turnCount: s.meta?.turnCount || s.messages?.length || 0,
    });
  }
  return out
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, limit);
}

export async function deleteSession(id) {
  try {
    await unlink(sessionPath(id));
    return true;
  } catch (err) {
    if (err?.code === 'ENOENT') return false;
    throw err;
  }
}

export function appendMessage(session, { role, content, meta = null }) {
  session.messages.push({
    id: nanoid(10),
    role,
    content,
    at: new Date().toISOString(),
    ...(meta ? { meta } : {}),
  });
  session.meta.turnCount = (session.meta.turnCount || 0) + 1;
  return session;
}

export function mergeWorkingMemory(session, patch = {}) {
  session.workingMemory = {
    ...emptyWorkingMemory(),
    ...session.workingMemory,
    ...patch,
    meals: patch.meals ?? session.workingMemory?.meals ?? [],
    allergies: patch.allergies ?? session.workingMemory?.allergies ?? [],
    likes: patch.likes ?? session.workingMemory?.likes ?? [],
  };
  return session;
}

export function mergePinnedFacts(session, update = {}) {
  const cur = session.pinnedFacts || { likes: [], allergies: [], dislikes: [], constraints: [] };
  const uniq = (a = [], b = []) => [...new Set([...a, ...b].map(String).filter(Boolean))];
  session.pinnedFacts = {
    likes: uniq(cur.likes, update.likes),
    allergies: uniq(cur.allergies, update.allergies),
    dislikes: uniq(cur.dislikes, update.dislikes),
    constraints: uniq(cur.constraints, update.constraints),
  };
  return session;
}
