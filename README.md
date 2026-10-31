# Scrabble

Real-time multiplayer Scrabble for 2–4 players, each on their own device.

- **Frontend:** React + Vite + Tailwind, deployed on Cloudflare Workers as static files (see [Deploy to Cloudflare](#deploy-to-cloudflare)).
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
  - *Site URL*: your Cloudflare URL once you have it (use `http://localhost:5173` until then).
  - *Redirect URLs*: add `http://localhost:5173/**` and `https://scrabble.<your-subdomain>.workers.dev/**`.
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
  `VITE_GOOGLE_SIGN_IN=true` (in `.env.local`, then redeploy) to show the Google button.

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

## Deploy to Cloudflare

Live at <https://scrabble.mashyrano.workers.dev>.

### How it works

Cloudflare only hosts the frontend. It is a static site: HTML, JS and CSS files that Cloudflare
serves from its data centres worldwide, each visitor from the one nearest them. Nothing runs on
Cloudflare. Sign-in, games and moves go straight from the browser to Supabase.

**Wrangler** is Cloudflare's command-line tool (a dev dependency here, run with `npx wrangler`).
It reads its settings from `wrangler.jsonc`:

| Setting | Meaning |
|---|---|
| `name` | The Worker's name in Cloudflare; also the first part of the URL (`scrabble.<subdomain>.workers.dev`). |
| `compatibility_date` | Which Cloudflare runtime behaviour to use. Leave it alone unless you add server code. |
| `assets.directory` | The folder to upload: `./dist`, the output of `vite build`. |
| `assets.not_found_handling` | `single-page-application` serves `index.html` for any unknown path, so links like `/play/ABC2345` work on refresh. |

`npm run deploy` runs two steps:

1. `vite build` compiles `src/` into `dist/`. The `VITE_*` values in `.env.local` are baked into
   the files at this point. Change one and you must deploy again.
2. `wrangler deploy` uploads `dist/` (only files that changed) and makes it the live version within seconds.

### First-time setup

```bash
npx wrangler login     # opens the browser; click Allow. Saved for future runs.
npx wrangler whoami    # check you are logged in
npm run deploy
```

A new Cloudflare account needs a *workers.dev subdomain* before its first deploy (dashboard →
**Workers & Pages** → change subdomain). The first deploy prints the site URL; put it into
Supabase's *Site URL* and *Redirect URLs* (setup step 2), or sign-up and password-reset links
will point at the wrong place. HTTPS on a brand-new subdomain can take a few minutes to start working.

### Everyday use

```bash
npm run deploy                    # publish the current code
npx wrangler deploy --dry-run     # check the config without uploading
npx wrangler deployments list     # history of deploys
npx wrangler rollback             # go back to the previous version
```

Pushing to GitHub does **not** deploy by itself. To deploy on every push, open the Worker in the
dashboard → **Settings → Builds** → connect the repo, with build command `npm run build`, deploy
command `npx wrangler deploy`, and `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`
(plus `VITE_GOOGLE_SIGN_IN` if used) added as build variables. The cloud build cannot see `.env.local`.

Changes to `supabase/functions/` are separate: deploy them with the Supabase CLI (setup step 3).

### The dashboard

At <https://dash.cloudflare.com> → **Workers & Pages** → **scrabble**:

- **Metrics**: requests and errors.
- **Deployments**: version history and rollback.
- **Settings → Domains & Routes**: add a custom domain (the domain must be on Cloudflare).
- **Settings → Builds**: deploy on git push (above).

Requests for static files are free and unlimited on the free plan.
