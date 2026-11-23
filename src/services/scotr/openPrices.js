import { logger } from '../../lib/logger.js';

/**
 * Optional Open Food Facts Open Prices enricher.
 * Base URL from OPEN_PRICES_BASE when wired; currently a no-op stub.
 */
export async function openPricesLookup(_ingredient, _geo) {
  const base = process.env.OPEN_PRICES_BASE;
  if (!base) {
    return null;
  }
  logger.debug('open_prices_stub', { base });
  return null;
}
