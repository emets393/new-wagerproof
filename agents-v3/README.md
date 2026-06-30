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

In Conductor, `scripts/conductor-setup.sh` copies your canonical `agents-v3/.env`
into every new workspace automatically — fill it in once in the root checkout
(or `$WAGERPROOF_SECRETS_DIR`). See `.conductor/README.md`. `npm run dev`/`deploy`
read `TRIGGER_SECRET_KEY` and the rest from this `.env`.

The Trigger.dev project ref is pinned in `trigger.config.ts`:
`proj_ughxoicacuqodceiwlus`.

## Required Environment

Set these in Trigger.dev Cloud for the task environment:

- `TRIGGER_SECRET_KEY` (used by the CLI/deploy environment)
- `DEEPSEEK_API_KEY`
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CFB_SUPABASE_URL`
- `CFB_SUPABASE_ANON_KEY`
- `V3_DAILY_SPEND_CAP_USD` (optional; defaults to `25`)

Set this in Supabase Edge Function secrets for `trigger-v3-run`:

- `TRIGGER_SECRET_KEY`

The Supabase runtime already supplies `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`.

## Deployment Order

1. Apply `supabase/migrations/20260629180000_agent_generation_v3_triggerdev.sql`.
2. Deploy the gateway:
   `supabase functions deploy trigger-v3-run`.
3. Deploy Trigger.dev tasks from this directory:
   `npm run deploy`.
4. In Trigger.dev, confirm `generate-v3-picks` and `daily-auto-gen-v3` are
   registered and the schedule is active for the target environment.

## Client Flow

The native app calls `trigger-v3-run`, receives
`{ ledger_run_id, run_id, public_access_token }`, then polls:

```text
GET https://api.trigger.dev/api/v3/runs/{run_id}
Authorization: Bearer {public_access_token}
```

The returned `metadata` drives `LiveAgentRunView`. Picks still write to
`avatar_picks`, so existing grading and snapshot reads continue to work.
