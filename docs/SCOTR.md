# Scotr — store pricing connector

Neighboring stores + ingredient prices for Grolisto. No prices in source — seed JSON or live APIs via env.

## Providers

| Mode | When | Source |
|---|---|---|
| Mock | `SCOTR_USE_MOCK=true` | `data/seed/stores.json`, `data/seed/prices.json` |
| Kroger | live creds set | Locations + Products (client credentials) |
| Fallback | live errors | degrade to mock seed |

Optional later: Open Prices (crowdsourced), BLS averages for benchmarks only.

## Env

```
SCOTR_USE_MOCK=
SCOTR_CACHE_TTL_MS=
SCOTR_DEFAULT_ZIP=
KROGER_CLIENT_ID=
KROGER_CLIENT_SECRET=
KROGER_API_BASE=
```

## API surface

- `findNearbyStores({ zip, lat, lng })`
- `getPrices(storeId, ingredients[])`
- `compareStores(storeIds[], ingredients[])`

HTTP: `GET /api/stores`, `POST /api/stores/compare`.

## Caching

In-process TTL cache keyed by store/geo/ingredients (`SCOTR_CACHE_TTL_MS`). Respect Kroger daily caps when live.
