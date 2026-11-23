import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';

let tokenCache = { accessToken: null, expiresAt: 0 };

async function getAccessToken() {
  if (!config.krogerClientId || !config.krogerClientSecret) {
    throw new Error('KROGER_CLIENT_ID and KROGER_CLIENT_SECRET required for live Scotr');
  }
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 30_000) {
    return tokenCache.accessToken;
  }

  const basic = Buffer.from(
    `${config.krogerClientId}:${config.krogerClientSecret}`,
  ).toString('base64');

  const res = await fetch(`${config.krogerApiBase}/connect/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=product.compact',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kroger OAuth ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in || 1800) * 1000,
  };
  return tokenCache.accessToken;
}

export async function krogerFindStores({ zip, lat, lng, radiusMiles = 10, limit = 10 }) {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    'filter.radiusInMiles': String(radiusMiles),
    'filter.limit': String(limit),
  });
  if (zip) params.set('filter.zipCode.near', zip);
  if (lat != null && lng != null) {
    params.set('filter.lat.near', String(lat));
    params.set('filter.lon.near', String(lng));
  }

  const res = await fetch(`${config.krogerApiBase}/locations?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error('kroger_locations_error', { status: res.status, text: text.slice(0, 300) });
    throw new Error(`Kroger locations ${res.status}`);
  }
  const json = await res.json();
  return (json.data || []).map((loc) => ({
    id: loc.locationId,
    name: loc.name || loc.chain,
    chain: loc.chain,
    address: loc.address
      ? `${loc.address.addressLine1}, ${loc.address.city}, ${loc.address.state} ${loc.address.zipCode}`
      : null,
    lat: loc.geolocation?.latitude,
    lng: loc.geolocation?.longitude,
    source: 'kroger',
  }));
}

export async function krogerSearchProducts({ locationId, term, limit = 5 }) {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    'filter.locationId': locationId,
    'filter.term': term,
    'filter.limit': String(limit),
  });
  const res = await fetch(`${config.krogerApiBase}/products?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kroger products ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return (json.data || []).map((p) => {
    const item = p.items?.[0] || {};
    const price = item.price?.promo ?? item.price?.regular ?? null;
    return {
      productId: p.productId,
      description: p.description,
      brand: p.brand,
      price,
      size: item.size,
      stockLevel: item.inventory?.stockLevel,
      source: 'kroger',
    };
  });
}
