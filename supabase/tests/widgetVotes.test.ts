import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Runs the REAL migration against an in-process Postgres (PGlite). The fixture
// only stands in for what Supabase provides (roles, auth.uid(), auth.jwt(),
// has_role) — none of the widget-vote logic is reimplemented here.
// Contract: .claude/docs/34_widget_votes_share.md
//
// PGlite is single-connection, so true concurrency (the advisory lock, the
// counts row lock) is NOT exercised here — those are argued in the migration.

const migration = readFileSync(
  new URL('../migrations/20261119120000_widget_votes.sql', import.meta.url),
  'utf8',
);
const db = new PGlite();
const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const ADMIN = 9;

type Tally = { widget_key: string; upvotes: number; downvotes: number; my_vote: number };

/** Become user `n` (or a caller with no JWT subject) under `role`. */
async function caller(n?: number, role = 'authenticated', claims: Record<string, unknown> = {}) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [n ? uid(n) : '']);
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
  await db.exec(`set role ${role}`);
}
async function superuser() {
  await db.exec('reset role');
}
async function cast(n: number, widget: string, vote: number, game = 'g1', sport = 'nfl') {
  await caller(n);
  const { rows } = await db.query<Tally>('select * from public.cast_widget_vote($1, $2, $3, $4)', [
    sport, game, widget, vote,
  ]);
  return rows[0];
}
async function read(n: number, game = 'g1', sport = 'nfl') {
  await caller(n);
  return (await db.query<Tally>('select * from public.get_widget_votes($1, $2)', [sport, game])).rows;
}
/** Counts recomputed from the votes table — what widget_vote_counts must always equal. */
async function drift() {
  await superuser();
  const { rows } = await db.query(`
    with truth as (
      select sport, game_id, widget_key,
             count(*) filter (where vote = 1)::int  as up,
             count(*) filter (where vote = -1)::int as down
      from public.widget_votes group by 1, 2, 3
    )
    select coalesce(c.widget_key, t.widget_key) as widget_key
    from public.widget_vote_counts c
    full join truth t using (sport, game_id, widget_key)
    where coalesce(c.upvotes, 0) <> coalesce(t.up, 0)
       or coalesce(c.downvotes, 0) <> coalesce(t.down, 0)`);
  return rows;
}
async function resetData() {
  await superuser();
  await db.exec('truncate public.widget_votes, public.widget_vote_counts, public.widget_vote_rate_limits');
}

describe('widget votes SQL', () => {
  beforeAll(async () => {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.jwt() returns jsonb language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
      $$;
      create function public.has_role(_user_id uuid, _role text) returns boolean language sql stable as $$
        select coalesce(_user_id = '${uid(ADMIN)}'::uuid and _role = 'admin', false)
      $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      insert into auth.users
        select ('00000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 9) i;
    `);
    await db.exec(migration);
    await db.exec(migration); // Safe if the deployment is replayed.
  }, 30000);

  afterAll(async () => { await db.close(); });

  describe('voting', () => {
    beforeAll(resetData);

    it('casts, switches and clears, returning live counts each time', async () => {
      expect(await cast(1, 'moneyline_prediction', 1)).toEqual({
        widget_key: 'moneyline_prediction', upvotes: 1, downvotes: 0, my_vote: 1,
      });
      expect(await cast(2, 'moneyline_prediction', 1)).toMatchObject({ upvotes: 2, downvotes: 0 });
      expect(await cast(2, 'moneyline_prediction', -1)).toMatchObject({ upvotes: 1, downvotes: 1, my_vote: -1 });
      expect(await cast(2, 'moneyline_prediction', 0)).toMatchObject({ upvotes: 1, downvotes: 0, my_vote: 0 });
      expect(await drift()).toEqual([]);
    });

    it('one vote per user per widget: repeating a vote changes nothing and spends no budget', async () => {
      await superuser();
      const before = (await db.query('select minute_count, day_count from public.widget_vote_rate_limits where user_id = $1', [uid(1)])).rows;
      expect(await cast(1, 'moneyline_prediction', 1)).toMatchObject({ upvotes: 1, my_vote: 1 });
      expect(await cast(1, 'moneyline_prediction', 1)).toMatchObject({ upvotes: 1, my_vote: 1 });
      await superuser();
      expect((await db.query('select minute_count, day_count from public.widget_vote_rate_limits where user_id = $1', [uid(1)])).rows).toEqual(before);
    });

    it('clearing a vote that was never cast creates no row', async () => {
      expect(await cast(3, 'public_betting', 0)).toEqual({
        widget_key: 'public_betting', upvotes: 0, downvotes: 0, my_vote: 0,
      });
      await superuser();
      expect((await db.query('select 1 from public.widget_votes where user_id = $1', [uid(3)])).rows).toEqual([]);
      expect((await db.query("select 1 from public.widget_vote_counts where widget_key = 'public_betting'")).rows).toEqual([]);
    });

    it('scopes votes by sport, game and widget', async () => {
      await cast(1, 'spread_prediction', -1);
      await cast(1, 'moneyline_prediction', 1, 'g2');
      await cast(1, 'moneyline_prediction', -1, 'g1', 'nba');
      expect(await read(1)).toEqual([
        { widget_key: 'moneyline_prediction', upvotes: 1, downvotes: 0, my_vote: 1 },
        { widget_key: 'spread_prediction', upvotes: 0, downvotes: 1, my_vote: -1 },
      ]);
      expect(await read(1, 'g1', 'nba')).toEqual([
        { widget_key: 'moneyline_prediction', upvotes: 0, downvotes: 1, my_vote: -1 },
      ]);
    });

    it('shows other users the totals but never whose vote it was', async () => {
      // User 4 has not voted: same counts, my_vote 0 on every widget.
      expect(await read(4)).toEqual([
        { widget_key: 'moneyline_prediction', upvotes: 1, downvotes: 0, my_vote: 0 },
        { widget_key: 'spread_prediction', upvotes: 0, downvotes: 1, my_vote: 0 },
      ]);
      expect(await read(4, 'no-such-game')).toEqual([]);
    });
  });

  describe('access control', () => {
    beforeAll(async () => {
      await resetData();
      await cast(1, 'moneyline_prediction', 1);
    });

    it.each([
      ['cast_widget_vote', "select * from public.cast_widget_vote('nfl', 'g1', 'moneyline_prediction', 1)"],
      ['get_widget_votes', "select * from public.get_widget_votes('nfl', 'g1')"],
      ['get_widget_vote_summary', 'select * from public.get_widget_vote_summary()'],
    ])('anon cannot execute %s', async (_name, sql) => {
      await caller(undefined, 'anon');
      await expect(db.query(sql)).rejects.toMatchObject({ code: '42501' });
    });

    it.each([
      ['a session with no subject', {}],
    ])('rejects %s', async (_name, claims) => {
      await caller(undefined, 'authenticated', claims);
      await expect(db.query("select * from public.cast_widget_vote('nfl', 'g1', 'moneyline_prediction', 1)"))
        .rejects.toMatchObject({ code: '42501', message: 'Authentication required' });
      await expect(db.query("select * from public.get_widget_votes('nfl', 'g1')"))
        .rejects.toMatchObject({ code: '42501', message: 'Authentication required' });
    });

    it('rejects anonymous-sign-in sessions even though they hold the authenticated role', async () => {
      await caller(5, 'authenticated', { is_anonymous: true });
      await expect(db.query("select * from public.cast_widget_vote('nfl', 'g1', 'moneyline_prediction', 1)"))
        .rejects.toMatchObject({ code: '42501' });
      await expect(db.query("select * from public.get_widget_votes('nfl', 'g1')"))
        .rejects.toMatchObject({ code: '42501' });
    });

    it.each([
      ['read votes', 'select * from public.widget_votes'],
      ['read counts', 'select * from public.widget_vote_counts'],
      ['read rate limits', 'select * from public.widget_vote_rate_limits'],
      ['forge a vote', `insert into public.widget_votes(user_id, sport, game_id, widget_key, vote) values ('${uid(2)}', 'nfl', 'g1', 'moneyline_prediction', 1)`],
      ['inflate a count', 'update public.widget_vote_counts set upvotes = 9999'],
      ['delete votes', 'delete from public.widget_votes'],
      ['reset their rate limit', 'delete from public.widget_vote_rate_limits'],
      ['call the trigger function', 'select public._apply_widget_vote_delta()'],
    ])('a signed-in user cannot %s directly', async (_name, sql) => {
      await caller(1);
      await expect(db.query(sql)).rejects.toMatchObject({ code: '42501' });
      await caller(undefined, 'anon');
      await expect(db.query(sql)).rejects.toMatchObject({ code: '42501' });
    });

    it('has RLS on with no policies, so a stray future GRANT still exposes nothing', async () => {
      await superuser();
      const { rows } = await db.query(`
        select c.relname, c.relrowsecurity,
               (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
        from pg_class c
        where c.relname in ('widget_votes', 'widget_vote_counts', 'widget_vote_rate_limits')
        order by 1`);
      expect(rows).toEqual([
        { relname: 'widget_vote_counts', relrowsecurity: true, policies: 0 },
        { relname: 'widget_vote_rate_limits', relrowsecurity: true, policies: 0 },
        { relname: 'widget_votes', relrowsecurity: true, policies: 0 },
      ]);
    });

    it('pins search_path on every SECURITY DEFINER function', async () => {
      await superuser();
      const { rows } = await db.query<{ proname: string; prosecdef: boolean; cfg: string }>(`
        select proname, prosecdef, array_to_string(proconfig, ',') as cfg from pg_proc
        where proname in ('cast_widget_vote', 'get_widget_votes', 'get_widget_vote_summary', '_apply_widget_vote_delta')`);
      expect(rows).toHaveLength(4);
      for (const row of rows) {
        expect(row.prosecdef).toBe(true);
        expect(row.cfg).toBe('search_path=pg_catalog, public, pg_temp');
      }
    });

    it('keeps the summary admin-only', async () => {
      await caller(1);
      await expect(db.query('select * from public.get_widget_vote_summary()'))
        .rejects.toMatchObject({ code: '42501', message: 'Admin access required' });
      await cast(2, 'moneyline_prediction', -1);
      await cast(3, 'moneyline_prediction', 1);
      await cast(3, 'moneyline_prediction', 0);
      await cast(2, 'moneyline_prediction', 1, 'g2');
      await caller(ADMIN);
      expect((await db.query('select * from public.get_widget_vote_summary(7)')).rows).toEqual([{
        sport: 'nfl', widget_key: 'moneyline_prediction',
        upvotes: 2, downvotes: 1, retracted: 1, voters: 3, games: 2,
      }]);
    });
  });

  describe('input validation', () => {
    beforeAll(resetData);

    it.each([
      ['unknown sport', ['nhl', 'g1', 'moneyline_prediction', 1]],
      ['uppercase sport', ['NFL', 'g1', 'moneyline_prediction', 1]],
      ['null sport', [null, 'g1', 'moneyline_prediction', 1]],
      ['empty game id', ['nfl', '', 'moneyline_prediction', 1]],
      ['null game id', ['nfl', null, 'moneyline_prediction', 1]],
      ['padded game id', ['nfl', ' g1', 'moneyline_prediction', 1]],
      ['trailing-space game id', ['nfl', 'g1 ', 'moneyline_prediction', 1]],
      ['97-char game id', ['nfl', 'x'.repeat(97), 'moneyline_prediction', 1]],
      ['game id with a newline', ['nfl', 'g1\nx', 'moneyline_prediction', 1]],
      ['non-ASCII game id', ['nfl', 'gamé', 'moneyline_prediction', 1]],
      ['title-shaped widget key', ['nfl', 'g1', 'Moneyline Prediction', 1]],
      ['hyphenated widget key', ['nfl', 'g1', 'h1-spread', 1]],
      ['one-char widget key', ['nfl', 'g1', 'a', 1]],
      ['49-char widget key', ['nfl', 'g1', 'a'.repeat(49), 1]],
      ['null widget key', ['nfl', 'g1', null, 1]],
      ['vote of 2', ['nfl', 'g1', 'moneyline_prediction', 2]],
      ['vote of -5', ['nfl', 'g1', 'moneyline_prediction', -5]],
      ['null vote', ['nfl', 'g1', 'moneyline_prediction', null]],
    ])('rejects %s without writing or spending budget', async (_name, args) => {
      await caller(1);
      await expect(db.query('select * from public.cast_widget_vote($1, $2, $3, $4)', args))
        .rejects.toMatchObject({ code: '22023' });
      await superuser();
      expect((await db.query('select 1 from public.widget_votes')).rows).toEqual([]);
      expect((await db.query('select 1 from public.widget_vote_rate_limits')).rows).toEqual([]);
    });

    it('accepts the real id shapes: numeric ids, training keys with spaces, max length', async () => {
      await cast(1, 'moneyline_prediction', 1, '401547417', 'nba');
      await cast(1, 'moneyline_prediction', 1, '2026_11_NO_CHI');
      await cast(1, 'moneyline_prediction', 1, 'New Orleans Saints @ Chicago Bears 2026-11-22');
      await cast(1, 'moneyline_prediction', 1, 'x'.repeat(96));
      await cast(1, 'a'.repeat(48), 1);
      expect(await drift()).toEqual([]);
    });

    it('is not injectable through its text arguments', async () => {
      const evil = "g1'; drop table public.widget_votes; --";
      expect(await cast(1, 'moneyline_prediction', 1, evil)).toMatchObject({ upvotes: 1 });
      expect(await read(1, evil)).toHaveLength(1);
    });
  });

  describe('abuse limits', () => {
    beforeAll(resetData);

    it('allows 30 vote changes a minute, refuses the 31st, and leaves state intact', async () => {
      for (let i = 0; i < 30; i++) await cast(1, 'moneyline_prediction', i % 2 === 0 ? 1 : -1);
      // 30 toggles end on -1.
      await caller(1);
      await expect(db.query("select * from public.cast_widget_vote('nfl', 'g1', 'moneyline_prediction', 1)"))
        .rejects.toMatchObject({ code: '54000', message: 'Too many votes, slow down' });
      expect(await read(1)).toEqual([
        { widget_key: 'moneyline_prediction', upvotes: 0, downvotes: 1, my_vote: -1 },
      ]);
      // The refused call rolled back: the counter did not creep past the limit.
      await superuser();
      expect((await db.query('select minute_count from public.widget_vote_rate_limits where user_id = $1', [uid(1)])).rows)
        .toEqual([{ minute_count: 30 }]);
      expect(await drift()).toEqual([]);
    });

    it('still serves reads and no-op casts while limited, and does not limit other users', async () => {
      expect(await cast(1, 'moneyline_prediction', -1)).toMatchObject({ my_vote: -1 });
      expect(await cast(2, 'moneyline_prediction', 1)).toMatchObject({ upvotes: 1, downvotes: 1 });
    });

    it('opens again in the next minute bucket', async () => {
      await superuser();
      await db.query("update public.widget_vote_rate_limits set minute_start = minute_start - interval '1 minute' where user_id = $1", [uid(1)]);
      expect(await cast(1, 'moneyline_prediction', 1)).toMatchObject({ upvotes: 2, downvotes: 0 });
      await superuser();
      expect((await db.query('select minute_count, day_count from public.widget_vote_rate_limits where user_id = $1', [uid(1)])).rows)
        .toEqual([{ minute_count: 1, day_count: 31 }]);
    });

    it('enforces the daily cap independently, and resets it the next day', async () => {
      await superuser();
      await db.query("update public.widget_vote_rate_limits set day_count = 600, minute_count = 0 where user_id = $1", [uid(1)]);
      await caller(1);
      await expect(db.query("select * from public.cast_widget_vote('nfl', 'g1', 'moneyline_prediction', -1)"))
        .rejects.toMatchObject({ code: '54000' });
      await superuser();
      await db.query('update public.widget_vote_rate_limits set day = day - 1 where user_id = $1', [uid(1)]);
      expect(await cast(1, 'moneyline_prediction', -1)).toMatchObject({ my_vote: -1 });
    });

    it('caps distinct widget keys per game so junk keys cannot bloat every reader', async () => {
      await resetData();
      // Spread across users to stay under the per-minute limit.
      for (let i = 0; i < 64; i++) await cast(1 + (i % 4), `junk_${i}`, 1, 'capped');
      await caller(5);
      await expect(db.query("select * from public.cast_widget_vote('nfl', 'capped', 'junk_overflow', 1)"))
        .rejects.toMatchObject({ code: '22023' });
      // Existing keys on that game, and other games, are unaffected.
      expect(await cast(5, 'junk_0', 1, 'capped')).toMatchObject({ upvotes: 2 });
      expect(await cast(5, 'moneyline_prediction', 1, 'other')).toMatchObject({ upvotes: 1 });
      expect(await read(5, 'capped')).toHaveLength(64);
    });
  });

  describe('count integrity', () => {
    beforeAll(resetData);

    it('never drifts from the votes table across a mixed sequence', async () => {
      const widgets = ['moneyline_prediction', 'spread_prediction', 'public_betting'];
      // Deterministic pseudo-random walk; 5 users x 20 ops stays under the limiter.
      let seed = 7;
      const next = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
      for (let i = 0; i < 100; i++) {
        await cast(1 + (i % 5), widgets[next(3)], next(3) - 1, next(2) ? 'g1' : 'g2');
      }
      expect(await drift()).toEqual([]);
      await superuser();
      expect((await db.query('select count(*)::int as n from public.widget_votes')).rows[0].n).toBeGreaterThan(10);
    });

    it('removes a deleted account\'s votes from the counts', async () => {
      await resetData();
      await cast(1, 'moneyline_prediction', 1);
      await cast(2, 'moneyline_prediction', 1);
      await cast(2, 'spread_prediction', -1);
      await superuser();
      await db.query('delete from auth.users where id = $1', [uid(2)]);
      expect(await read(1)).toEqual([
        { widget_key: 'moneyline_prediction', upvotes: 1, downvotes: 0, my_vote: 1 },
        { widget_key: 'spread_prediction', upvotes: 0, downvotes: 0, my_vote: 0 },
      ]);
      expect(await drift()).toEqual([]);
      await superuser();
      expect((await db.query('select 1 from public.widget_vote_rate_limits where user_id = $1', [uid(2)])).rows).toEqual([]);
    });

    it('does not block account deletion when a count was hand-edited to zero', async () => {
      await cast(3, 'moneyline_prediction', 1);
      await superuser();
      await db.exec('update public.widget_vote_counts set upvotes = 0');
      await db.query('delete from auth.users where id = $1', [uid(3)]);
      expect((await db.query('select upvotes from public.widget_vote_counts order by widget_key')).rows)
        .toEqual([{ upvotes: 0 }, { upvotes: 0 }]);
    });

    it('refuses to re-point an existing vote at another target', async () => {
      await superuser();
      await expect(db.exec("update public.widget_votes set widget_key = 'spread_prediction'"))
        .rejects.toMatchObject({ code: '22023' });
      await expect(db.exec("insert into public.widget_votes(user_id, sport, game_id, widget_key, vote) values ('" + uid(4) + "', 'nfl', 'g1', 'x_y', 3)"))
        .rejects.toMatchObject({ code: '23514' });
    });
  });
});
