# Chat sessions + context management

Server owns conversation state. Clients send **one message at a time** to a session; they do not resend full history.

## APIs

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/chat/sessions` | Create session (+ optional `workingMemory`) |
| GET | `/api/chat/sessions` | List sessions for user |
| GET | `/api/chat/sessions/:id` | Full session (messages, summary, pinned facts) |
| PATCH | `/api/chat/sessions/:id/context` | Update working memory (budget, plan, store) |
| POST | `/api/chat/sessions/:id/messages` | User turn → packed context → reply |
| DELETE | `/api/chat/sessions/:id` | Drop session |
| POST | `/api/chat` | Legacy one-shot (creates ephemeral session) |

## Context layers (priority)

1. System policy  
2. Profile (prefs ∪ pinned facts)  
3. Working memory (budget, meals, store, active plan)  
4. Rolling summary (compressed older turns)  
5. Retrieved recipes (RAG)  
6. Recent turns (sliding window)

Packed under `CHAT_CONTEXT_TOKEN_BUDGET`. Older turns are summarized into `rollingSummary` when length ≥ `CHAT_SUMMARY_TRIGGER_TURNS`.

## Memory extraction

Models return a trailing `grolisto.memory` JSON block. The orchestrator strips it from the user-visible reply, merges `prefsUpdate` into pinned facts + prefs store, and records intent (`preference|plan_edit|question|swap`).
