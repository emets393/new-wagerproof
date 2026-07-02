# Wagerproof Agents V3 on Trigger.dev

Parallel V3 pick-generation worker for the native iOS client. Legacy Supabase
edge-function queue paths remain untouched; rows with
`agent_generation_runs.engine_version = 'v3_trigger'` are ledger rows only.

## Tasks

- `generate-v3-picks`: one agentic V3 generation run.
  - Global queue concurrency: 10.
  - `maxDuration`: 600 seconds.
  - Retries: 3 attempts with exponential backoff.
  - Emits live progress to Trigger.dev run `metadata` (`phase`, `turn`,
    `currentTool`, `toolCalls`, `picksAccepted`, etc.).
- `daily-auto-gen-v3`: scheduled eligibility scan every 10 minutes. It inserts
  `v3_trigger` ledger rows and batch-triggers `generate-v3-picks`.

## Local

```bash
cp .env.example .env   # then fill in (see "Required Environment" below)
npm install
npm run build
npm run dev
```

`trigger.config.ts` lives in this directory, so the CLI must run from here — run
`npm run dev` from `agents-v3/`, not the worktree root (from the root the CLI
errors with "Couldn't find your trigger.config.ts file"). For convenience the
**root** `package.json` proxies it so you don't have to `cd`:

```bash
npm run trigger:dev      # from the worktree root → runs agents-v3's worker
npm run trigger:deploy   # from the worktree root → deploys to prod
```

The `trigger.dev` CLI is a pinned devDependency, so `npm run dev` / `npm run deploy`
resolve it from `node_modules` — no global install or `npx` needed. (Its npm bin
is `trigger`, which is what those scripts call.)

In Conductor, every new workspace is provisioned automatically (`.conductor/settings.toml`):
`scripts/conductor-setup.sh` copies your canonical `agents-v3/.env` (fill it in once
in the root checkout or `$WAGERPROOF_SECRETS_DIR`), and `scripts/conductor-deps.sh`
runs `npm install` here so `npm run dev` works out of the box. See `.conductor/README.md`.
`npm run dev`/`deploy` read `TRIGGER_SECRET_KEY` and the rest from this `.env`.

The Trigger.dev project ref is pinned in `trigger.config.ts`:
`proj_ughxoicacuqodceiwlus`.

## Required Environment

The task itself reads these at runtime (`src/runtimeHelpers.ts`,
`src/loop/runV3Generation.ts`, `src/shared/revenuecat.ts`):

- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY` (fallback provider; the loop defaults to `deepseek-reasoner`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CFB_SUPABASE_URL`
- `CFB_SUPABASE_ANON_KEY`
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_ENTITLEMENT_IDENTIFIER`
- `V3_DAILY_SPEND_CAP_USD` (optional; defaults to `25`)

`trigger.config.ts` wires the `syncEnvVars` build extension to push these into
whatever environment you deploy to (`npm run deploy` → prod), reading them
from the CLI process env — which is loaded from this directory's `.env` by
default. So filling in `.env` and running `npm run deploy` is enough; you
don't need to hand-copy anything into the Trigger.dev dashboard.

`TRIGGER_SECRET_KEY` (in `.env`) is different — it's the CLI/deploy
credential Trigger.dev's own tooling uses to authenticate `npm run dev` /
`npm run deploy`, not a var the task reads, so it is intentionally excluded
from the sync list.

Set this in Supabase Edge Function secrets (read by both `trigger-v3-run` and
`trigger-run-status`):

- `TRIGGER_SECRET_KEY_PROD` — the **Production** environment secret key from
  the Trigger.dev dashboard (Project → API Keys). Deliberately a different
  name from the local `.env`'s `TRIGGER_SECRET_KEY` (a dev key) so the two
  can't be silently swapped for each other — the edge functions must always
  trigger against the deployed prod tasks, never a developer's local `trigger
  dev` session.

The Supabase runtime already supplies `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`.

## Deployment Order

1. Apply `supabase/migrations/20260629180000_agent_generation_v3_triggerdev.sql`.
2. Set `TRIGGER_SECRET_KEY_PROD` in Supabase Edge Function secrets (one-time,
   or whenever the Trigger.dev prod key rotates).
3. Deploy the gateways: `supabase functions deploy trigger-v3-run` and
   `supabase functions deploy trigger-run-status`.
4. Deploy Trigger.dev tasks from this directory: `npm run deploy` (syncs env
   vars and deploys to prod).
5. In Trigger.dev, confirm `generate-v3-picks` and `daily-auto-gen-v3` are
   registered and the schedule is active for the `prod` environment.

## Client Flow

The native app calls `trigger-v3-run`, receives
`{ ledger_run_id, run_id, public_access_token }`, then polls:

```text
GET https://api.trigger.dev/api/v3/runs/{run_id}
Authorization: Bearer {public_access_token}
```

The returned `metadata` drives `LiveAgentRunView`. Picks still write to
`avatar_picks`, so existing grading and snapshot reads continue to work.
