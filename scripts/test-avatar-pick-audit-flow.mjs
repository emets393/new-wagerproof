#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const MAIN_URL = process.env.MAIN_SUPABASE_URL || 'https://gnjrklxotmbvnxbnnqgq.supabase.co';
const MAIN_ANON = process.env.MAIN_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ';

const DEFAULT_AVATAR_ID = '46649b23-c2d3-429c-8d0b-e0ef8a0f1df2';
const DEFAULT_USER_ID = '00000000-0000-4000-8000-000000000123';
const DEFAULT_OUT_DIR = 'tmp/live-payload-audit';

function parseArgs(argv) {
  const args = {
    avatarId: DEFAULT_AVATAR_ID,
    userId: DEFAULT_USER_ID,
    outDir: DEFAULT_OUT_DIR,
    assertPayloadShape: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--avatar-id') args.avatarId = argv[++i];
    else if (arg === '--user-id') args.userId = argv[++i];
    else if (arg === '--out-dir') args.outDir = argv[++i];
    else if (arg === '--no-shape-assert') args.assertPayloadShape = false;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/test-avatar-pick-audit-flow.mjs [options]

Options:
  --avatar-id <id>       Avatar profile id (default: ${DEFAULT_AVATAR_ID})
  --user-id <id>         User id for function call (default: ${DEFAULT_USER_ID})
  --out-dir <path>       Output directory (default: ${DEFAULT_OUT_DIR})
  --no-shape-assert      Skip formatted payload shape assertions
  --help                 Show help`);
      process.exit(0);
    }
  }

  return args;
}

function headers(token) {
  return {
    apikey: token,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function encode(value) {
  return encodeURIComponent(String(value));
}

async function invokeGenerate(args, h) {
  const body = await requestJson({
    method: 'POST',
    url: `${MAIN_URL}/functions/v1/generate-avatar-picks`,
    headers: h,
    body: {
      avatar_id: args.avatarId,
      user_id: args.userId,
      is_admin: true,
    },
  });
  if (body?.success !== true) {
    const msg = body?.error || 'Unexpected generate-avatar-picks response';
    throw new Error(`generate-avatar-picks failed: ${msg}`);
  }
  return body;
}

async function fetchLatestPick(avatarId, h) {
  const url = `${MAIN_URL}/rest/v1/avatar_picks?avatar_id=eq.${encode(avatarId)}&order=created_at.desc&limit=1&select=id,created_at,game_id,pick_selection,bet_type,ai_decision_trace,ai_audit_payload,archived_game_data`;
  const rows = await requestJson({
    method: 'GET',
    url,
    headers: h,
  });
  return rows?.[0] || null;
}

async function requestJson({ method, url, headers, body }) {
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 400)}`);
    }
    return parsed;
  } catch (error) {
    const curlArgs = ['-sS', '-X', method, url];
    for (const [key, value] of Object.entries(headers || {})) {
      curlArgs.push('-H', `${key}: ${value}`);
    }
    if (body) {
      curlArgs.push('--data', JSON.stringify(body));
    }
    try {
      const raw = execFileSync('curl', curlArgs, { encoding: 'utf8' });
      return raw ? JSON.parse(raw) : null;
    } catch (curlError) {
      const firstError = error instanceof Error ? error.message : String(error);
      const secondError = curlError instanceof Error ? curlError.message : String(curlError);
      throw new Error(`request failed (fetch + curl): ${firstError} | ${secondError}`);
    }
  }
}

function hasKeys(obj, keys) {
  if (!obj || typeof obj !== 'object') return false;
  return keys.every((k) => Object.prototype.hasOwnProperty.call(obj, k));
}

function buildValidation(latestPick, assertPayloadShape) {
  const trace = latestPick?.ai_decision_trace || {};
  const audit = latestPick?.ai_audit_payload || {};
  const modelInput = audit?.model_input_game_payload || {};
  const personalityInput = audit?.model_input_personality_payload || {};
  const modelResponse = audit?.model_response_payload || {};

  const checks = [
    {
      name: 'latest pick exists',
      pass: !!latestPick,
    },
    {
      name: 'ai_decision_trace exists',
      pass: !!latestPick?.ai_decision_trace,
    },
    {
      name: 'ai_decision_trace has required fields',
      pass: hasKeys(trace, ['leaned_metrics', 'rationale_summary', 'personality_alignment']),
    },
    {
      name: 'ai_audit_payload exists',
      pass: !!latestPick?.ai_audit_payload,
    },
    {
      name: 'ai_audit_payload has all 3 real artifacts',
      pass: hasKeys(audit, ['model_input_game_payload', 'model_input_personality_payload', 'model_response_payload']),
    },
    {
      name: 'model_input_personality_payload has core personality fields',
      pass: hasKeys(personalityInput, ['risk_tolerance', 'confidence_threshold', 'preferred_bet_type']),
    },
    {
      name: 'model_response_payload has returned pick fields',
      pass: hasKeys(modelResponse, ['game_id', 'bet_type', 'selection', 'reasoning', 'key_factors']),
    },
  ];

  if (assertPayloadShape) {
    checks.push({
      name: 'model_input_game_payload is formatted payload (not raw-only)',
      pass: hasKeys(modelInput, ['vegas_lines', 'game_data_complete']),
    });
  }

  return checks;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(args.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const h = headers(MAIN_ANON);
  const startedAt = new Date().toISOString();
  const generateResponse = await invokeGenerate(args, h);
  const latestPick = await fetchLatestPick(args.avatarId, h);
  const checks = buildValidation(latestPick, args.assertPayloadShape);
  const failed = checks.filter((c) => !c.pass);

  const report = {
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    avatar_id: args.avatarId,
    user_id: args.userId,
    function_result: {
      picks_count: Array.isArray(generateResponse?.picks) ? generateResponse.picks.length : 0,
      slate_note: generateResponse?.slate_note || null,
    },
    latest_pick: latestPick,
    checks,
    pass: failed.length === 0,
    failed_checks: failed.map((c) => c.name),
  };

  const outputPath = path.join(outDir, 'pick_audit_flow_test_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nSaved report: ${outputPath}`);

  if (failed.length > 0) {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
