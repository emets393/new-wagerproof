# Game Data Audit Runbook

## Purpose

Reusable procedure to:

1. Generate the **live** 3-input AI pick payloads + persisted response payload.
2. Validate that all available game-detail metrics are included in payload 2.
3. Quickly identify missing data by sport/metric group (especially Polymarket).

---

## Reusable Test Command

From repo root:

```bash
npm run test:avatar-game-data-payloads
```

Pick-audit persistence test (real sent/received artifacts):

```bash
npm run test:avatar-pick-audit-flow
```

Options:

```bash
node scripts/test-avatar-game-data-payloads.mjs \
  --avatar-id <avatar_id> \
  --date YYYY-MM-DD \
  --out-dir tmp/live-payload-audit \
  --strict-polymarket
```

```bash
node scripts/test-avatar-pick-audit-flow.mjs \
  --avatar-id <avatar_id> \
  --user-id <user_id_or_dummy_for_public_avatar> \
  --out-dir tmp/live-payload-audit
```

---

## Output Files

The script writes:

- `tmp/live-payload-audit/payload1_agent_personality_live.json`
- `tmp/live-payload-audit/payload2_game_data_live.json`
- `tmp/live-payload-audit/payload3_system_prompt_live.json`
- `tmp/live-payload-audit/response_payload_live_persisted_batch.json`
- `tmp/live-payload-audit/summary_after_update.json`
- `tmp/live-payload-audit/pick_audit_flow_test_result.json`

`summary_after_update.json` includes sport counts, coverage counts by metric group, and `missing_polymarket_games`.

`pick_audit_flow_test_result.json` includes:

- edge-function generate result (`picks_count`, `slate_note`)
- latest persisted pick row snapshot
- pass/fail checks for:
  - `ai_decision_trace`
  - `ai_audit_payload`
  - exact persisted artifacts:
    - `model_input_game_payload`
    - `model_input_personality_payload`
    - `model_response_payload`

---

## Metric Groups and Source of Truth

### NFL

- Base game + model + weather + public labels:
  - Source table: `nfl_predictions_epa`
  - Payload field groups: `vegas_lines`, `weather`, `public_betting`, `model_predictions`
- Detailed public betting:
  - Source table: `nfl_predictions_epa`
  - Payload field group: `public_betting_detailed`
- Line movement:
  - Source table: `nfl_betting_lines`
  - Payload field group: `line_movement`
- H2H:
  - Source table: `nfl_training_data`
  - Payload field group: `h2h_recent`
- Polymarket:
  - Source table: `polymarket_markets` (main Supabase)
  - Match key: `game_key = nfl_${away_team}_${home_team}`
  - Payload field group: `polymarket`
- Complete raw source row:
  - Payload field group: `game_data_complete.raw_game_data`

### CFB

- Base game + model + weather + public labels:
  - Source table: `cfb_live_weekly_inputs`
  - Payload field groups: `vegas_lines`, `weather`, `public_betting`, `model_predictions`
- Opening lines:
  - Source table: `cfb_live_weekly_inputs`
  - Payload field group: `opening_lines`
- Line movement:
  - Source table: `cfb_betting_lines`
  - Payload field group: `line_movement`
- Polymarket:
  - Source table: `polymarket_markets`
  - Match key: `game_key = cfb_${away_team}_${home_team}`
  - Payload field group: `polymarket`
- Complete raw source row:
  - Payload field group: `game_data_complete.raw_game_data`

### NBA

- Base game + team stats + trends:
  - Source table: `nba_input_values_view`
  - Payload field groups: `vegas_lines`, `team_stats`, `trends`
- Prediction accuracy snapshot:
  - Source table: `nba_todays_games_predictions_with_accuracy`
  - Join key: `game_id`
  - Payload field group: `prediction_accuracy`
- Injuries:
  - Source table: `nba_injury_report` (`bucket='current'`, `game_date_et = target date`)
  - Payload field group: `injuries`
- Polymarket:
  - Source table: `polymarket_markets`
  - Match key: `game_key = nba_${away_team}_${home_team}`
  - Payload field group: `polymarket`
- Complete raw source row:
  - Payload field group: `game_data_complete.raw_game_data`

### NCAAB

- Base game + team stats:
  - Source table: `v_cbb_input_values`
  - Payload field groups: `vegas_lines`, `team_stats`
- Prediction accuracy snapshot:
  - Source table: `ncaab_todays_games_predictions_with_accuracy_cache`
  - Join key: `game_id`
  - Payload field group: `prediction_accuracy`
- Situational trends:
  - Source table: `ncaab_game_situational_trends_today`
  - Payload field group: `situational_trends`
- Polymarket:
  - Source table: `polymarket_markets`
  - Match key: `game_key = ncaab_${away_team}_${home_team}`
  - Payload field group: `polymarket`
- Complete raw source row:
  - Payload field group: `game_data_complete.raw_game_data`

---

## Canonical Implementation Paths

- Manual generation payload builder:
  - `supabase/functions/generate-avatar-picks/index.ts`
- Auto generation payload builder:
  - `supabase/functions/auto-generate-avatar-picks/index.ts`
- Reusable live audit test:
  - `scripts/test-avatar-game-data-payloads.mjs`
- Reusable pick-audit persistence test:
  - `scripts/test-avatar-pick-audit-flow.mjs`

---

## Pick Audit Feature Validation

Use this when validating the Agent Details `Open Pick Audit` bottom sheet.

1. Run:
   - `npm run test:avatar-pick-audit-flow`
2. Open:
   - `tmp/live-payload-audit/pick_audit_flow_test_result.json`
3. Confirm all checks are `pass: true`.
4. In app, open the same avatar’s latest pick and verify sections map directly:
   - `LEANED METRICS` -> `ai_decision_trace.leaned_metrics`
   - `WHY THIS PICK` -> `ai_decision_trace.rationale_summary`
   - `PERSONALITY ALIGNMENT` -> `ai_decision_trace.personality_alignment`
   - `MODEL INPUT GAME PAYLOAD` -> `ai_audit_payload.model_input_game_payload`
   - `AGENT PERSONALITY PAYLOAD` -> `ai_audit_payload.model_input_personality_payload`
   - `AGENT RESPONSE PAYLOAD` -> `ai_audit_payload.model_response_payload`

Failure handling:

- If generate call fails, inspect edge-function logs first.
- If latest pick lacks `ai_audit_payload`, confirm migrations and function deploy are current.
- If payload shape fails, confirm formatter path in:
  - `supabase/functions/generate-avatar-picks/index.ts`
  - `supabase/functions/auto-generate-avatar-picks/index.ts`

---

## Troubleshooting Checklist

1. If polymarket coverage drops:
   - Run `npm run test:avatar-game-data-payloads -- --strict-polymarket`.
   - Inspect `summary_after_update.json > missing_polymarket_games`.
2. Confirm cache freshness:
   - Rerun `update-polymarket-cache` edge function.
3. Verify key alignment:
   - Ensure `polymarket_markets.game_key` uses `${league}_${away_team}_${home_team}` exactly.
4. If payload fields are missing:
   - Compare formatter output in both avatar pick functions (manual + auto).
   - Confirm associated source table has data for target date.
