# IMPOSTER – The Secret Word Game
Next.js (App Router, JS) + Supabase (Auth, Postgres, Realtime, RLS).

## Setup
1. Create a Supabase project. Auth → enable Anonymous sign-ins, Email, and Google.
2. SQL editor: run `database/migrations/001_init.sql`, then `database/seed.sql`.
3. `cp .env.example .env.local` and fill the 3 values (service role key stays server-only).
4. `npm install && npm run dev` → http://localhost:3000
5. Open the app in 3+ browsers/profiles (use Guest), create a room, share the link, play.

## Design notes
- Roles/secret/votes live in tables with RLS and no client policies; only `/api/*` (service role) reads them.
- Clue/vote/start/tally logic is in Postgres functions with row locks (race-safe). Turn timers are enforced in `tick()`.
- Realtime only signals "refetch"; Postgres is the source of truth.

## Docker / K8s
`docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... -t imposter .`
Minikube: `minikube image load imposter`, apply `k8s/`, then `minikube service imposter`.
CI/CD secrets: DOCKERHUB_USERNAME, DOCKERHUB_TOKEN, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, KUBE_CONFIG_B64.

## Not yet implemented
Pause game, play-again, stats/history, profile editing, per-environment overlays, disconnect tracking, Redis rate limiting, UI for host "close room" (API exists).
