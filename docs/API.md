# Grolisto HTTP API

| Method | Path | Body / query | Notes |
|---|---|---|---|
| GET | `/api/health` | — | service status |
| GET | `/api/stores` | `zip`, `lat`, `lng` | Scotr nearby stores |
| POST | `/api/stores/compare` | `{ storeIds?, zip?, ingredients[] }` | basket compare |
| POST | `/api/plan` | `{ budget, days, meals[], allergies[], likes[], storeId, zip, notes?, userId? }` | meal plan |
| POST | `/api/chat/sessions` | `{ userId?, workingMemory? }` | create session |
| POST | `/api/chat/sessions/:id/messages` | `{ content, workingMemory? }` | server-owned turn |
| PATCH | `/api/chat/sessions/:id/context` | `{ workingMemory }` | sync plan/budget |
| POST | `/api/chat` | legacy one-shot | prefer sessions |

See [CHAT.md](CHAT.md).
| GET/POST | `/api/prefs/:userId` | prefs JSON | continuous learning store |

Static UI: `/` (Express `public/`).

## CORS

Express enables `cors()` for local UI and same-origin static hosting. Lock origins via env in a later hardening pass if needed.
