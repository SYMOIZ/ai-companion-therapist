# Architecture

Updated 2 October 2026. Production details and the live host are in the root [README](../../README.md) and [deployment notes](../deployment/deployment.md).

## Request path

```text
Browser
  -> HTTPS (nginx on the EC2 host)
  -> Node gateway, port 3000
       /api/engine/*  AI routes
       other /api/*   proxied to FastAPI
  -> FastAPI (main.py and backend/routers), port 3001
  -> PostgreSQL 16 in Docker, 127.0.0.1:5432
```

The React UI lives in `src/` and is built with Vite. FastAPI owns accounts, journal, bookings, admin actions, and the PostgreSQL models. The `supabase` client in `src/services/supabaseClient.ts` is a local shim that posts to `/api/db` and `/api/auth`. Supabase is not the production database.

## Portals

One `users` table uses `role` to separate access.

- **Client (`patient`)** — chat, journal, therapist directory, bookings.
- **Therapist** — schedule, patient list, notes, payout requests. Therapy notes stay off the client screens.
- **Admin** — users, therapist applications, support tickets, finance, and risk alerts.

Client Demo is a separate account type. Chat and journal for that account stay in the browser session. Writes that would create a permanent record are rejected by the API.

## AI memory

`src/services/ragService.ts` and `src/services/aiMemoryService.ts` attach prior chat context before the gateway calls Gemini (`gemini-2.5-flash`). If `GEMINI_API_KEY` is unset, the gateway can fall back to `OPENAI_API_KEY`. The assistant is a wellness companion, not a clinical diagnosis service.
