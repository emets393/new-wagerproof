import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migration = (name: string) => readFileSync(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8');
const original = migration('20260815120000_agent_consensus_runner_up_and_rank');
const tiers = migration('20260914180000_subscription_tier_access');
const fix = migration('20260925140157_fix_game_agent_consensus_ambiguity');
const db = new PGlite();
const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const call = `select * from public.get_game_agent_consensus('mlb', array['2026-09-24', '2026-09-25']::date[]) order by game_date, game_id`;
let baseline: unknown[];
let acl: unknown[];
let originalFailure: unknown;

async function caller(n?: number, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [n ? uid(n) : '']);
  await db.exec(`set role ${role}`);
}

describe('game consensus SQL regression', () => {
  beforeAll(async () => {
    // Minimal isolated schema. The real tier predicate and migration wrapper
    // below are loaded from the migrations, not reimplemented in this test.
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function public.has_role(user_id uuid, role_name text) returns boolean language sql stable as $$
        select coalesce(user_id = '${uid(7)}'::uuid and role_name = 'admin', false)
      $$;
      create table public.avatar_profiles (
        id uuid primary key, name text, sprite_index integer, avatar_color text,
        is_public boolean, is_active boolean
      );
      create table public.avatar_picks (
        avatar_id uuid, game_id text, game_date date, sport text,
        bet_type text, period text, pick_selection text, result text
      );
      grant usage on schema public, auth to anon, authenticated, service_role;
      insert into auth.users select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1,7) i;
      insert into avatar_profiles
        select ('10000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
          'Agent ' || lpad(i::text, 2, '0'), case when i=1 then 3 end, '#123456', i<>15, i<>16
        from generate_series(1,16) i;
      insert into avatar_picks
        select id, 'main', '2026-09-24', 'mlb', 'moneyline', null,
          case when name <= 'Agent 08' then 'Home ML' else 'Away ML' end, 'won'
        from avatar_profiles where name <= 'Agent 10';
      insert into avatar_picks
        select id, 'main', '2026-09-24', 'mlb', 'moneyline', 'f5', 'F5 Away ML', 'pending'
        from avatar_profiles where name <= 'Agent 03';
      insert into avatar_picks select * from avatar_picks where pick_selection='Home ML';
      insert into avatar_picks
        select id, 'thin', '2026-09-24', 'mlb', 'spread', 'full', 'Home -1.5', 'pending'
        from avatar_profiles where name='Agent 01';
      insert into avatar_picks
        select id, 'tie', '2026-09-24', 'mlb', 'total', 'full',
          case when name <= 'Agent 02' then 'Over 8.5' else 'Under 8.5' end, 'pending'
        from avatar_profiles where name <= 'Agent 04';
      insert into avatar_picks
        select id, 'main', '2026-09-25', 'mlb', 'moneyline', '', 'Next day ML', 'pending'
        from avatar_profiles where name <= 'Agent 02';
      insert into avatar_picks
        select id, 'hidden', '2026-09-24', 'mlb', 'moneyline', 'full', 'Hidden ML', 'pending'
        from avatar_profiles where name >= 'Agent 15';
      insert into avatar_picks
        select id, 'other-sport', '2026-09-24', 'nfl', 'moneyline', 'full', 'NFL ML', 'pending'
        from avatar_profiles where name='Agent 01';
    `);
    await db.exec(tiers.slice(0, tiers.indexOf('-- Additional restrictive policies')));
    await db.exec(`insert into subscription_tier_access(user_id,tier,is_tiered_customer,expires_at) values
      ('${uid(2)}','pro',true,now()+interval '1 day'),
      ('${uid(3)}','standard',true,null),
      ('${uid(4)}','premium',true,null),
      ('${uid(5)}','pro',true,now()-interval '1 day'),
      ('${uid(6)}',null,true,null),
      ('${uid(7)}','standard',true,null)`);
    await db.exec(original);
    baseline = (await db.query(call)).rows;
    acl = (await db.query("select proacl::text from pg_proc where proname='get_game_agent_consensus'")).rows;
    await db.exec(tiers.slice(tiers.indexOf('do $migration$')));
    try { await db.query(call); } catch (error) { originalFailure = error; }
    await db.exec(fix);
  }, 30000);

  afterAll(async () => { await db.close(); });

  it('reproduces the tier-wrapper failure, then preserves all pre-wrapper results and grants', async () => {
    expect(originalFailure).toMatchObject({ code: '42702' });
    const rows = (await db.query(call)).rows;
    expect(rows).toEqual(baseline);
    expect(rows).toHaveLength(4);
    expect(rows.find(r => r.game_id === 'main' && r.agents === 10)).toMatchObject({
      side_agents: 8, market_agents: 10, agreement: '0.8000', flagged: true,
      runner_up_side: 'Away ML', runner_up_agents: 2, slate_rank: 1, slate_games: 2,
    });
    expect(rows.find(r => r.game_id === 'thin')).toMatchObject({ slate_rank: null, slate_games: null });
    expect((await db.query("select proacl::text from pg_proc where proname='get_game_agent_consensus'")).rows).toEqual(acl);
    await db.exec(fix); // Safe if deployment is replayed.
    expect((await db.query(call)).rows).toEqual(baseline);
  });

  it.each([
    ['anonymous preview', undefined, 'anon'],
    ['legacy customer', 1, 'authenticated'],
    ['active Pro', 2, 'authenticated'],
    ['admin', 7, 'authenticated'],
  ] as const)('keeps access for %s', async (_name, n, role) => {
    await caller(n, role);
    expect((await db.query(call)).rows).toEqual(baseline);
  });

  it.each([
    ['Standard', 3], ['Premium', 4], ['expired Pro', 5], ['unassigned tier', 6],
  ] as const)('still denies %s', async (_name, n) => {
    await caller(n);
    await expect(db.query(call)).rejects.toMatchObject({ code: '42501', message: 'Agent access requires WagerProof Pro' });
  });

  it('handles empty dates and preserves custom flag thresholds', async () => {
    await caller(2);
    expect((await db.query("select * from get_game_agent_consensus('mlb', '{}'::date[])")).rows).toEqual([]);
    const { rows } = await db.query("select flagged from get_game_agent_consensus('mlb', array['2026-09-24']::date[], 0.99, 0.08, 8) where game_id='main'");
    expect(rows).toEqual([{ flagged: false }]);
  });
});
