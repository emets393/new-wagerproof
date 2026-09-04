-- In-database daily NFL/CFB grading — APPLIED to jpxnjuwglavsjbgbasnl on 2026-09-01
-- (pg_cron job 36, 'football-grade-daily').
--
-- WHY: the Render cron nfl-cfb-grade-daily's RPC step (run_grade_rpcs.py) depends on
-- DATABASE_URL / SUPABASE_PAT credentials that were never confirmed in its env group,
-- and it exited 1 all season-opening weekend with picks left ungraded (see
-- .claude/docs/agents/14_SEASON_2026_PIPELINE_READINESS.md, incident 2026-09-01).
-- pg_cron runs the same RPCs inside the database with NO external credentials, so
-- grading can never again be blocked by Render env drift. The Render job still fills
-- finals / 1H / player logs at 13:00 UTC; this fires 30 min later. Everything here is
-- idempotent, so the (now non-fatal) Python RPC step double-running is harmless.
--
-- Steps are individually exception-guarded: one failing RPC logs a warning and the
-- rest still run. NEVER raise from this function — an outer exception would roll back
-- the completed steps' writes. Outcome string lands in cron.job_run_details.

create or replace function public.run_football_daily_grading()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- football season label: Aug-Dec belong to the current year, Jan-Feb to the prior
  v_season int := case when extract(month from now())::int >= 8
                       then extract(year from now())::int
                       else extract(year from now())::int - 1 end;
  v_out text;
  w int;
begin
  v_out := 'season=' || v_season;

  begin
    for w in 1..22 loop
      perform grade_nfl_props(v_season, w);
      perform grade_nfl_props_dnp_void(v_season, w);
    end loop;
    v_out := v_out || ' props=ok';
  exception when others then
    raise warning 'run_football_daily_grading: grade_nfl_props failed: %', sqlerrm;
    v_out := v_out || ' props=FAIL:' || sqlerrm;
  end;

  begin
    perform refresh_all_signal_performance(v_season);
    v_out := v_out || ' signals=ok';
  exception when others then
    raise warning 'run_football_daily_grading: refresh_all_signal_performance failed: %', sqlerrm;
    v_out := v_out || ' signals=FAIL:' || sqlerrm;
  end;

  begin
    perform public.refresh_nfl_analysis_base(v_season);
    v_out := v_out || ' nfl_base=ok';
  exception when others then
    raise warning 'run_football_daily_grading: refresh_nfl_analysis_base failed: %', sqlerrm;
    v_out := v_out || ' nfl_base=FAIL:' || sqlerrm;
  end;

  begin
    perform public.refresh_cfb_analysis_base(v_season);
    v_out := v_out || ' cfb_base=ok';
  exception when others then
    raise warning 'run_football_daily_grading: refresh_cfb_analysis_base failed: %', sqlerrm;
    v_out := v_out || ' cfb_base=FAIL:' || sqlerrm;
  end;

  return v_out;
end $$;

revoke all on function public.run_football_daily_grading() from public, anon, authenticated;

-- 13:30 + 16:30 UTC in football months — 30 min after each Render fill pass (13:00 /
-- 16:00 UTC) so finals + player logs land first. The second pass exists because the
-- CFBD snapshot can land finals after 13:00 (seen 2026-09-04: Thu-night finals hit
-- cfb_games ~14:00 UTC, so the single 13:00 fill missed them and grading slipped a
-- day). Schedule widened via `select cron.alter_job(36, schedule => '30 13,16 * 8-12,1-2 *')`
-- on 2026-09-04.
select cron.schedule(
  'football-grade-daily',
  '30 13,16 * 8-12,1-2 *',
  'select public.run_football_daily_grading();'
);
