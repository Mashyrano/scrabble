# AGENTS.md

## Project Context

Real-time multiplayer Scrabble: a React + Vite frontend (deployed on Vercel) backed by
Supabase (auth, Postgres, Realtime, one edge function). Keep changes focused on the
user's request and preserve existing project conventions.

Start with `README.md` for setup, environment variables and deployment.

## Key Files

- `src/`: frontend application source.
- `src/api/supabaseClient.js`: the one Supabase client; reuse it.
- `src/hooks/useScrabbleRoom.js`: talks to the `room` function and follows the table over Realtime.
- `supabase/functions/_shared/room.ts`: game actions (join, start, commit, pass, swap, resign) as pure functions.
- `supabase/functions/room/index.ts`: auth, load/save with optimistic concurrency, result records.
- `supabase/migrations/`: schema and row-level security. Add a new migration file rather than editing an applied one.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- The server is authoritative: the client sends attempts, never results. Racks and the bag must never reach `room_states`.
- `src/lib/movePreview.js` / `scrabbleBoard.js` are the client-side preview; keep scoring in step with `_shared/moveAnalyzer.ts`.
- Edge functions run on Deno; `_shared/*.ts` also runs under Node (type stripping) for quick scripted tests.
- Run `npm run lint` and `npm run build` before finishing code changes.
