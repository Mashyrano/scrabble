# Scrabble

Real-time multiplayer Scrabble for 2–4 players, each on their own device.

- **Frontend:** React + Vite + Tailwind, deployed on Vercel.
- **Backend:** Supabase — auth (email/password and Google), Postgres, Realtime, and one edge function (`room`) that runs the game.

## How it fits together

| Piece | Where |
|---|---|
| Pages and game UI | `src/` |
| Supabase client | `src/api/supabaseClient.js` |
| Live table hook (Realtime + presence) | `src/hooks/useScrabbleRoom.js` |
| Game rules, scoring, dictionary | `supabase/functions/_shared/` |
| Edge function every move goes through | `supabase/functions/room/index.ts` |
| Database schema | `supabase/migrations/` |

The full game (the bag and every rack) lives in the `rooms` table, which only the
edge function can reach. Players read the public `room_states` table and their own
row in `room_hands`, so nobody can see anyone else's tiles. Words are checked
against the bundled ENABLE word list (`_shared/words.ts`).

## One-time setup

### 1. Supabase project

1. Create a free project at <https://supabase.com/dashboard>.
2. **SQL Editor → New query**: paste all of `supabase/migrations/20261030000000_init.sql` and click **Run**.
3. **Project Settings → API Keys**: copy the **publishable key**. **Project Settings → Data API**: copy the **Project URL**.

### 2. Auth settings

- **Authentication → URL Configuration**
  - *Site URL*: your Vercel URL once you have it (use `http://localhost:5173` until then).
  - *Redirect URLs*: add `http://localhost:5173/**` and `https://<your-app>.vercel.app/**`.
- **Authentication → Emails → Templates → Confirm signup**: the sign-up page asks for
  a 6-digit code, so the email must contain it. Replace the body with, for example:
  `<h2>Your Scrabble code</h2><p>Enter this code to finish signing up: <strong>{{ .Token }}</strong></p>`
- Supabase's built-in email sender only allows a few emails per hour. For real use, either set up
  custom SMTP (**Authentication → Emails → SMTP Settings**, e.g. a free Resend account) or turn off
  **Confirm email** under **Authentication → Sign In / Providers → Email** — the app works either way.
- **Google sign-in (optional)**: create an OAuth client in Google Cloud Console
  (*APIs & Services → Credentials → OAuth client ID → Web application*), add the callback URL that
  Supabase shows under **Authentication → Sign In / Providers → Google** as an authorized redirect URI,
  then paste the client ID and secret into that Supabase page and enable it. Finally set
  `VITE_GOOGLE_SIGN_IN=true` (in `.env.local` and in Vercel) to show the Google button.

### 3. Deploy the edge function

From the project root (needs Node; no Docker required):

```bash
npx supabase login
npx supabase functions deploy room --project-ref <your-project-ref> --no-verify-jwt
```

The project ref is the `xxxx` in `https://xxxx.supabase.co`. Redeploy after changing anything in `supabase/functions/`.

### 4. Lobby music (optional)

Put an mp3 at `public/music/lobby.mp3`. Without it the music button simply does nothing.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev
```

Open <http://localhost:5173>. To test multiplayer, sign in as a second user in a private window.

Checks: `npm run lint` and `npm run build`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project**, import the repo (Vite is detected automatically).
3. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Deploy, then put the Vercel URL into Supabase's *Site URL* and *Redirect URLs* (step 2).

Every push to `main` redeploys the frontend. `vercel.json` sends all routes to `index.html`
so links like `/play/ABC2345` work on refresh.
