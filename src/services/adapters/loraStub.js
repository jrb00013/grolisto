import { readFile } from 'node:fs/promises';
import { logger } from '../../lib/logger.js';

/**
 * Small-adapter / LoRA hook — weights path from env only (ADAPTER_WEIGHTS_PATH).
 * Training/export lives in python/grolisto_adapters; runtime loads JSON sidecar if present.
 */
export async function loadAdapterWeights() {
  const path = process.env.ADAPTER_WEIGHTS_PATH;
  if (!path) {
    return { loaded: false, reason: 'ADAPTER_WEIGHTS_PATH unset' };
  }
  try {
    const raw = await readFile(path, 'utf8');
    const weights = JSON.parse(raw);
    logger.info('adapter_loaded', { path, keys: Object.keys(weights).slice(0, 8) });
    return { loaded: true, weights };
  } catch (err) {
    logger.warn('adapter_load_failed', { err: String(err.message || err) });
    return { loaded: false, reason: String(err.message || err) };
  }
}

export function applyAdapterBias(taste = {}, adapter) {
  if (!adapter?.loaded || !adapter.weights?.tagBias) return taste;
  const next = { ...taste };
  for (const [k, v] of Object.entries(adapter.weights.tagBias)) {
    next[k] = Number(next[k] || 0) + Number(v);
  }
  return next;
}
