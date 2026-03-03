# Agent Generation V2 — Queue-Based Architecture

> Replaces the V1 single-cron approach with a durable, distributed queue system featuring retries, entitlement enforcement, and scalable workers.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [End-to-End Flow](#2-end-to-end-flow)
3. [Queue Table: `agent_generation_runs`](#3-queue-table-agent_generation_runs)
4. [Job Lifecycle States](#4-job-lifecycle-states)
5. [Enqueue Phase](#5-enqueue-phase)
6. [Dispatch Phase](#6-dispatch-phase)
7. [Worker Phase (Edge Function)](#7-worker-phase-edge-function)
8. [Entitlement System](#8-entitlement-system)
9. [Activity Tracking](#9-activity-tracking)
10. [Cron Jobs](#10-cron-jobs)
11. [Client Integration](#11-client-integration)
12. [Auth & Security](#12-auth--security)
13. [Error Handling & Retries](#13-error-handling--retries)
14. [Token Budget Management](#14-token-budget-management)
15. [Migrations Reference](#15-migrations-reference)
16. [Key Files](#16-key-files)
17. [Ops & Debugging](#17-ops--debugging)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT APPS (Mobile / Web)                                          │
│  ┌─────────────────────┐                                             │
│  │ generatePicks()     │─── functions.invoke() ──┐                   │
│  │ agentPicksService   │                         │                   │
│  │ + poll loop         │◄── query status ────────┤                   │
│  └─────────────────────┘                         │                   │
└──────────────────────────────────────────────────┼───────────────────┘
                                                   │
                                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  EDGE FUNCTION: request-avatar-picks-generation-v2                   │
│  - JWT decode (gateway-verified)                                     │
│  - RPC: enqueue_manual_generation_run_v2()                           │
│  - Fire-and-forget dispatch hint                                     │
│  - Returns { run_id } to client                                      │
└──────────────────────────────────────┬───────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  QUEUE TABLE: agent_generation_runs                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┐           │
│  │ queued   │→│ leased   │→│ processing   │→│succeeded │           │
│  └──────────┘ └──────────┘ └──────────────┘ └──────────┘           │
│       ▲                          │                                   │
│       │              ┌───────────▼──────────┐                        │
│       └──────────────│ failed_retryable     │  (backoff + retry)     │
│                      └──────────────────────┘                        │
│                      ┌──────────────────────┐                        │
│                      │ failed_terminal      │  (permanent failure)   │
│                      └──────────────────────┘                        │
└──────────────────────────────────────────────────────────────────────┘
        ▲ enqueue                          ▲ claim + process
        │                                  │
┌───────┴──────────┐            ┌──────────┴──────────────────────────┐
│  CRON: Enqueue   │            │  EDGE FUNCTION:                     │
│  every 10 min    │            │  process-agent-generation-job-v2    │
│  (auto runs)     │            │  - Claims 1 job (SKIP LOCKED)      │
└──────────────────┘            │  - Fetches avatar + games           │
                                │  - Calls OpenAI gpt-5-mini          │
┌──────────────────┐            │  - Upserts picks to avatar_picks    │
│  CRON: Dispatch  │──HTTP POST─│  - Marks succeeded/failed           │
│  every 1 min     │            └─────────────────────────────────────┘
└──────────────────┘
                                ┌─────────────────────────────────────┐
┌──────────────────┐            │  CRON: Recovery                     │
│  CRON: Recovery  │────────────│  Requeue expired leases             │
│  every 10 min    │            │  (dead worker protection)           │
└──────────────────┘            └─────────────────────────────────────┘
```

### V1 vs V2 Comparison

| Aspect | V1 | V2 |
|--------|----|----|
| Trigger | Single cron calls edge function that loops all agents | Cron enqueues jobs → dispatch spawns parallel workers |
| Parallelism | Sequential (one agent at a time) | Up to 5 concurrent workers |
| Failure handling | One failure kills the batch | Per-job retry with exponential backoff |
| Manual generation | Direct edge function call (sync) | Enqueue + poll (async) |
| Entitlements | None | Pro/Admin required for auto + manual |
| Activity check | In edge function | In SQL (profiles.last_seen_at) |
| Observability | Logs only | Full queue table with metrics |

---

## 2. End-to-End Flow

### Manual Generation (User-Triggered)

```
1. User taps "Generate Picks" in app
2. Client calls agentPicksService.generatePicks(agentId)
3. Service gets current session via supabase.auth.getSession()
4. Service invokes edge function: request-avatar-picks-generation-v2
5. Edge function decodes JWT, extracts user ID
6. Edge function calls RPC: enqueue_manual_generation_run_v2()
   - Validates ownership + entitlement + daily budget (3/day)
   - Inserts row into agent_generation_runs (status='queued', priority=100)
   - Returns run_id
7. Edge function fires dispatch hint (fire-and-forget RPC)
8. Edge function returns { success: true, run_id } to client
9. Client begins polling agent_generation_runs every 3 seconds
10. Dispatch cron (or hint) triggers process-agent-generation-job-v2
11. Worker claims the job (FOR UPDATE SKIP LOCKED)
12. Worker processes: fetch avatar → fetch games → build prompt → call OpenAI
13. Worker upserts picks to avatar_picks
14. Worker marks run as succeeded (picks_generated, tokens, cost)
15. Client poll sees status='succeeded', stops polling
16. Client refreshes picks list
```

### Auto Generation (Cron-Triggered)

```
1. Every 10 minutes: enqueue_due_auto_generation_runs_v2() runs
   - Finds eligible agents: auto_generate=true, Pro/Admin, active <5 days, not yet today
   - Inserts runs with priority=50, status='queued'
   - Dedup index prevents duplicates
2. Every 1 minute: dispatch_generation_workers_v2(5) runs
   - Checks queue depth
   - Fires up to 5 HTTP POST calls to process-agent-generation-job-v2
3. Each worker claims 1 job and processes it independently
4. Every 10 minutes: requeue_expired_generation_leases_v2() recovers dead workers
```

---

## 3. Queue Table: `agent_generation_runs`

Core fields grouped by purpose:

### Identity
| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `avatar_id` | uuid | FK → avatar_profiles |
| `user_id` | uuid | FK → auth.users |
| `generation_type` | text | `'auto'` or `'manual'` |
| `target_date` | date | ET-timezone date for dedup |

### Request Context
| Column | Type | Purpose |
|--------|------|---------|
| `requested_by` | uuid | User who triggered manual gen |
| `request_idempotency_key` | text | Prevents duplicate manual requests |
| `priority` | integer | 50 = auto, 100 = manual (higher = first) |

### Queue Lifecycle
| Column | Type | Purpose |
|--------|------|---------|
| `status` | text | Current state (see §4) |
| `attempt_count` | integer | Starts at 0, incremented on each claim |
| `max_attempts` | integer | Default 3 |
| `lease_owner` | text | Worker ID holding the lock |
| `lease_expires_at` | timestamptz | 5-minute lease deadline |
| `next_attempt_at` | timestamptz | When eligible for next attempt |

### Result Metadata
| Column | Type | Purpose |
|--------|------|---------|
| `picks_generated` | integer | Count of picks created |
| `weak_slate` | boolean | Fewer than MIN_GAMES games |
| `no_games` | boolean | Zero games for all sports |
| `prompt_version` | text | System prompt ID used |
| `input_tokens` | integer | Tokens sent to OpenAI |
| `output_tokens` | integer | Tokens received |
| `estimated_cost_usd` | numeric | (input×$0.3µ + output×$1.2µ) |
| `model_name` | text | e.g. `'gpt-5-mini'` |
| `error_code` | text | e.g. `'OPENAI_500'` |
| `error_message` | text | Truncated to 1000 chars |

### Key Indexes
- **Queue scan**: `(next_attempt_at, priority DESC, created_at)` WHERE status IN (queued, failed_retryable)
- **Auto dedup**: UNIQUE on `(avatar_id, target_date, generation_type)` WHERE auto AND active
- **Manual idempotency**: UNIQUE on `(avatar_id, request_idempotency_key)` WHERE key IS NOT NULL
- **Lease recovery**: `(lease_expires_at)` WHERE status IN (leased, processing)

---

## 4. Job Lifecycle States

```
                    ┌─────────┐
        enqueue ───►│ queued  │
                    └────┬────┘
                         │ claim (FOR UPDATE SKIP LOCKED)
                    ┌────▼────┐
                    │ leased  │  lease_expires_at = now() + 5min
                    └────┬────┘
                         │ mark_processing
                    ┌────▼────────┐
                    │ processing  │  started_at = now()
                    └────┬────────┘
                         │
              ┌──────────┼──────────────┐
              ▼          ▼              ▼
        ┌───────────┐ ┌─────────────────────┐ ┌──────────┐
        │ succeeded │ │ failed_retryable    │ │ canceled │
        └───────────┘ │ next_attempt_at =   │ └──────────┘
                      │ now() + backoff     │
                      └──────────┬──────────┘
                                 │ re-claim (after backoff)
                                 ▼
                           Back to 'leased'
                                 │
                          (if max_attempts reached)
                                 ▼
                      ┌──────────────────┐
                      │ failed_terminal  │
                      └──────────────────┘
```

### Backoff Schedule
| Attempt | Backoff |
|---------|---------|
| 1 | 5 minutes |
| 2 | 15 minutes |
| 3+ | 60 minutes |

---

## 5. Enqueue Phase

### Auto Enqueue: `enqueue_due_auto_generation_runs_v2(p_now, p_limit)`

Called by cron every 10 minutes. Finds eligible agents and inserts queued runs.

**Eligibility criteria:**
1. `avatar_profiles.auto_generate = true`
2. `avatar_profiles.is_active = true`
3. Owner has active subscription or is admin (`can_use_agent_autopilot()`)
4. Owner active within 5 days (`profiles.last_seen_at > now() - 5 days`)
5. Not already generated for today's date (dedup index)

**Behavior:**
- Calculates `target_date` in ET timezone
- Inserts with `priority=50`, `status='queued'`, `next_attempt_at=now()`
- `ON CONFLICT DO NOTHING` (dedup prevents duplicates)
- Returns count of newly enqueued runs

### Manual Enqueue: `enqueue_manual_generation_run_v2(p_user_id, p_avatar_id, p_idempotency_key)`

Called by the request edge function when user taps "Generate Picks".

**Validation steps:**
1. Check `can_request_manual_agent_generation()` (ownership + entitlement)
2. Check daily budget: max 3 manual runs per avatar per ET day (admins exempt)
3. If `p_idempotency_key` provided and active run exists, return existing run_id

**Behavior:**
- Locks avatar row (`SELECT ... FOR UPDATE`) to serialize concurrent calls
- Inserts with `priority=100` (higher than auto = processed first)
- Returns `run_id` for client polling

---

## 6. Dispatch Phase

### `dispatch_generation_workers_v2(p_max_dispatches)`

Called by cron every 1 minute. Checks queue depth and fires HTTP POST to workers.

**Implementation:**
1. Count runs WHERE `status IN ('queued', 'failed_retryable')` AND `next_attempt_at <= now()` AND `attempt_count < max_attempts`
2. Calculate dispatches = `LEAST(queue_depth, p_max_dispatches)` (default max 5)
3. For each dispatch, call `net.http_post()` to the worker edge function
4. Return count of dispatches

**Auth for pg_net requests:**
- Service role key stored in `_internal_config` table (not GUCs — GUCs aren't available in pg_cron context)
- Sent as both `Authorization: Bearer` and `apikey` headers
- Table restricted: `REVOKE ALL ON _internal_config FROM anon, authenticated`
- Only accessible via SECURITY DEFINER functions

### Why Not GUCs?
PostgreSQL GUCs set via `ALTER DATABASE ... SET app.settings.key = '...'` are available in normal session context but **not** in pg_cron's background worker context. The `_internal_config` table pattern works in all contexts.

---

## 7. Worker Phase (Edge Function)

**File:** `supabase/functions/process-agent-generation-job-v2/index.ts`

### Step-by-Step Processing

```
1. AUTH: Validate x-internal-secret or Bearer service-role-key
2. INIT: Create Supabase clients (main + CFB)
3. CLAIM: RPC claim_generation_runs_v2(worker_id, limit=1, lease=300s)
   └─ Returns 200 with "no jobs" if queue empty
4. MARK: RPC mark_generation_run_processing_v2(run_id)
5. FETCH: Load avatar_profiles row
6. PROMPT: Fetch remote system prompt from agent_system_prompts table
   └─ Fallback to hardcoded prompt if not found
7. GAMES: For each preferred_sport, fetch today's games from CFB Supabase
8. EDGE CASES:
   └─ No games → mark succeeded (no_games=true, picks=0)
   └─ Weak slate + skip_weak_slates → mark succeeded (weak_slate=true, picks=0)
9. TOKEN BUDGET: Three-tier prompt fitting
   └─ Full → No trends → Trim by tipoff → Fail terminal
10. OPENAI: Call gpt-5-mini with JSON schema (strict=true)
    └─ 4-minute timeout (within 5-minute lease)
11. PARSE: Extract picks, validate against schema
12. BUILD: Construct pick objects with full audit trail
    └─ ai_decision_trace, ai_audit_payload, archived_game_data, archived_personality
13. UPSERT: Insert picks to avatar_picks (ON CONFLICT update)
    └─ Manual: delete existing picks for same game IDs first
14. SUCCEED: RPC mark_generation_run_succeeded_v2(metrics...)
    └─ Updates avatar's last_generated_at or last_auto_generated_at
```

### Error Classification

| Error Type | Code | Retryable? |
|------------|------|------------|
| OpenAI 5xx | `OPENAI_500` | Yes |
| OpenAI timeout | `OPENAI_TIMEOUT` | Yes |
| JSON parse error | `PARSE_ERROR` | Yes |
| OpenAI 4xx | `OPENAI_400` | No |
| Payload too large (post-trim) | `PAYLOAD_TOO_LARGE` | No |
| Avatar not found | `AVATAR_NOT_FOUND` | No |

---

## 8. Entitlement System

### Helper Functions

| Function | Purpose |
|----------|---------|
| `is_agent_owner(user_id, avatar_id)` | Ownership check |
| `can_use_agent_autopilot(user_id)` | Admin OR subscription_active |
| `can_request_manual_agent_generation(user_id, avatar_id)` | Owner AND (Admin OR subscribed) |

### Enforcement Points

1. **Trigger on avatar_profiles**: `enforce_avatar_autogenerate_entitlement()` silently coerces `auto_generate=false` if user isn't entitled (BEFORE INSERT/UPDATE)
2. **Auto enqueue SQL**: `get_eligible_avatars_for_auto_generation_v2()` checks `can_use_agent_autopilot()`
3. **Manual enqueue SQL**: `enqueue_manual_generation_run_v2()` checks `can_request_manual_agent_generation()`
4. **Cleanup function**: `disable_autogenerate_for_non_entitled_users()` — one-time ops sweep

### Manual Generation Budget

- 3 manual runs per avatar per ET day (non-admin users)
- Counted by: `SELECT COUNT(*) FROM agent_generation_runs WHERE avatar_id = X AND generation_type = 'manual' AND target_date = today AND status NOT IN ('canceled')`
- Admins are exempt

---

## 9. Activity Tracking

### Canonical Source: `profiles.last_seen_at`

- Indexed column on profiles table
- Updated via `touch_owner_activity_if_stale(p_user_id, p_min_interval='12 hours')`
- Throttled to prevent excessive writes
- **Dual-write**: Also updates `avatar_profiles.owner_last_active_at` for V1 compatibility

### 5-Day Inactivity Rule

Agents owned by users who haven't opened the app in 5+ days are excluded from auto-generation. This prevents wasting resources on churned users.

---

## 10. Cron Jobs

| Job | Schedule | Function | Purpose |
|-----|----------|----------|---------|
| Enqueue auto runs | `*/10 * * * *` | `enqueue_due_auto_generation_runs_v2(now(), 50)` | Find eligible agents, insert queued jobs |
| Dispatch workers | `* * * * *` | `dispatch_generation_workers_v2(5)` | Check queue, fire HTTP POST to workers |
| Recover leases | `*/10 * * * *` | `requeue_expired_generation_leases_v2()` | Requeue dead/timed-out workers |

### Lease Recovery

If a worker crashes or times out (lease_expires_at passed):
- If `attempt_count < max_attempts`: set `status='failed_retryable'`, schedule retry with 5-min backoff
- Else: set `status='failed_terminal'`
- Uses `FOR UPDATE SKIP LOCKED` to avoid contention

---

## 11. Client Integration

### Mobile: `wagerproof-mobile/services/agentPicksService.ts`
### Web: `src/services/agentPicksService.ts`

Both follow the same pattern:

```typescript
export async function generatePicks(agentId: string): Promise<GeneratePicksResponse> {
  // 1. Get session (NO refreshSession — avoids triggering onAuthStateChange)
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('User not authenticated');

  // 2. Invoke request edge function
  const { data, error } = await supabase.functions.invoke(
    'request-avatar-picks-generation-v2',
    { body: { avatar_id: agentId } }
  );

  // 3. Extract error details from FunctionsHttpError
  if (error) {
    let detail = '';
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        detail = body?.error || body?.message || '';
      }
    } catch (_e) { /* ignore */ }
    throw new Error(detail || error.message || 'Failed to request pick generation');
  }

  // 4. Poll for completion
  const runId = data.run_id;
  const result = await pollGenerationRun(runId);
  return { picks: [], picks_generated: result.picksGenerated };
}
```

### Poll Configuration

```typescript
const POLL_INTERVAL_MS = 3000;      // Check every 3 seconds
const POLL_TIMEOUT_MS = 300_000;     // 5-minute total timeout
const MAX_CONSECUTIVE_ERRORS = 5;    // Give up after 5 consecutive poll errors
```

### Important: `getSession()` not `refreshSession()`

`refreshSession()` triggers `onAuthStateChange` with `TOKEN_REFRESHED`, which updates session/user state in `AuthContext`, causing React re-renders that can unmount the component mid-mutation. Since the edge function decodes the JWT directly (gateway verifies signature), a slightly stale token is fine.

---

## 12. Auth & Security

### Request Edge Function Auth

Uses direct JWT decode (no API call):
```typescript
const token = authHeader.replace('Bearer ', '');
const payloadB64 = token.split('.')[1];
const payload = JSON.parse(atob(payloadB64));
const userId = payload.sub;
// Reject non-user JWTs
if (payload.role === 'anon' || payload.role === 'service_role') {
  return errorResponse(401, 'User JWT required');
}
```

The Supabase gateway handles JWT signature verification (`verify_jwt = true` in function config), so we only need to extract the `sub` claim.

### Worker Edge Function Auth

Two-layer validation:
1. `x-internal-secret` header → checked against `INTERNAL_FUNCTION_SECRET` env var
2. `Authorization: Bearer` → checked against `SUPABASE_SERVICE_ROLE_KEY`

Either is sufficient. The dispatch cron sends the service role key.

### RLS on `agent_generation_runs`

- Admins: SELECT all rows
- Users: SELECT own rows (WHERE `user_id = auth.uid()`)
- All mutations via SECURITY DEFINER functions (no direct client INSERT/UPDATE)

### `_internal_config` Table

- Stores `service_role_key` for pg_net dispatch calls
- `REVOKE ALL FROM anon, authenticated` — invisible via PostgREST
- Only readable by SECURITY DEFINER functions

---

## 13. Error Handling & Retries

### Retry Strategy

```
Attempt 1 fails → wait 5 min → Attempt 2
Attempt 2 fails → wait 15 min → Attempt 3
Attempt 3 fails → failed_terminal (permanent)
```

### Retryable vs Terminal Errors

**Retryable** (transient, will resolve on retry):
- OpenAI 5xx, timeouts, rate limits
- Network errors
- JSON parse failures (model hallucination)

**Terminal** (won't resolve, don't waste resources):
- OpenAI 4xx (bad request, invalid key)
- Payload too large after trimming
- Avatar not found / deleted
- Validation errors

### Worker Crash Protection

If a worker dies mid-processing (OOM, deployment, etc.):
1. Its lease expires after 5 minutes
2. Recovery cron detects expired lease
3. If retries remaining: job re-enters queue with backoff
4. If max retries hit: marked failed_terminal

---

## 14. Token Budget Management

The worker uses a three-tier fallback to fit prompts within the model's context window:

### Tier 1: Full Payload
- All games with all data (trends, streaks, ratings)
- Check against `SOFT_SEND_LIMIT`
- If fits → use it

### Tier 2: No Trends
- Strip situational trends from game data
- Rebuild prompt, recount tokens
- If fits → use it (mode = `no_trends`)

### Tier 3: Trim by Tipoff
- Remove games with latest tipoff times (keep nearest games)
- Rebuild prompt, recount tokens
- If fits → use it (mode = `no_trends_trimmed`)

### Tier 4: Fail Terminal
- If still over limit after trimming → `PAYLOAD_TOO_LARGE`
- Not retryable (indicates bad agent config, not transient error)

---

## 15. Migrations Reference

| Migration | Purpose |
|-----------|---------|
| `20260303000000_agent_generation_v2_entitlements.sql` | Entitlement functions, trigger, eligibility query |
| `20260303000001_agent_generation_v2_activity_tracking.sql` | `profiles.last_seen_at`, throttled touch function |
| `20260303000002_agent_generation_v2_queue.sql` | `agent_generation_runs` table, all queue lifecycle functions, dispatch |
| `20260303000003_agent_generation_v2_cron_jobs.sql` | 3 pg_cron jobs (enqueue, dispatch, recovery) |
| `20260303000004_fix_dispatch_vault_auth.sql` | `_internal_config` table, fixed dispatch auth |

---

## 16. Key Files

### Edge Functions
| File | Purpose |
|------|---------|
| `supabase/functions/request-avatar-picks-generation-v2/index.ts` | Client-facing request handler (JWT auth, enqueue, return run_id) |
| `supabase/functions/process-agent-generation-job-v2/index.ts` | Worker (claim, process, OpenAI, upsert picks, mark result) |

### Client Services
| File | Purpose |
|------|---------|
| `wagerproof-mobile/services/agentPicksService.ts` | Mobile: generatePicks() + pollGenerationRun() |
| `src/services/agentPicksService.ts` | Web: generatePicks() + pollGenerationRun() |

### Shared Worker Utilities
| File | Purpose |
|------|---------|
| `supabase/functions/shared/tokenBudget.ts` | Token counting + three-tier prompt fitting |
| `supabase/functions/generate-avatar-picks/promptBuilder.ts` | System prompt + user prompt construction |
| `supabase/functions/generate-avatar-picks/pickSchema.ts` | OpenAI JSON schema for structured output |

### V1 Functions (Still Active)
| File | Purpose |
|------|---------|
| `supabase/functions/generate-avatar-picks/index.ts` | V1 on-demand generation (still used if V2 not enabled) |
| `supabase/functions/auto-generate-avatar-picks/index.ts` | V1 batch auto-generation |
| `supabase/functions/grade-avatar-picks/index.ts` | Pick grading (unchanged, works with both V1 and V2) |

---

## 17. Ops & Debugging

### Check Queue Status
```sql
SELECT status, COUNT(*), AVG(attempt_count)::numeric(3,1) AS avg_attempts
FROM agent_generation_runs
WHERE created_at > now() - interval '24 hours'
GROUP BY status
ORDER BY status;
```

### View Failed Runs
```sql
SELECT id, avatar_id, error_code, error_message, attempt_count, created_at
FROM agent_generation_runs
WHERE status = 'failed_terminal'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

### Check Dispatch Health
```sql
-- Are dispatches happening?
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'v2-dispatch-workers')
ORDER BY start_time DESC
LIMIT 10;
```

### Manual Worker Dispatch
```sql
SELECT dispatch_generation_workers_v2(1);
```

### Reprocess a Failed Run
```sql
UPDATE agent_generation_runs
SET status = 'queued',
    attempt_count = 0,
    next_attempt_at = now(),
    error_code = NULL,
    error_message = NULL,
    completed_at = NULL
WHERE id = '<run-id>';
```

### Check Entitlements
```sql
SELECT ap.id, ap.name, ap.auto_generate,
       can_use_agent_autopilot(ap.user_id) AS entitled,
       p.last_seen_at
FROM avatar_profiles ap
JOIN profiles p ON p.id = ap.user_id
WHERE ap.auto_generate = true;
```

### Verify _internal_config
```sql
-- Check service role key is present (run as superuser)
SELECT key, LEFT(value, 20) || '...' AS value_preview
FROM _internal_config;
```
