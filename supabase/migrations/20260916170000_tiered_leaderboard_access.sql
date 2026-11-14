-- The leaderboard RPC bypasses table RLS, so guard both entry points.
create policy "Tiered customers need Pro for agent performance" on public.avatar_performance_cache
  as restrictive for select to authenticated
  using (not public.tiered_agent_access_restricted(auth.uid()));

do $migration$
declare target record;
begin
  for target in
    select p.oid, p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_leaderboard_v2'
  loop
    execute replace(pg_get_functiondef(target.oid), target.prosrc,
      regexp_replace(target.prosrc, '\mBEGIN\M',
        'BEGIN IF public.tiered_agent_access_restricted(auth.uid()) THEN RAISE EXCEPTION ''Agent leaderboard requires WagerProof Pro'' USING ERRCODE = ''42501''; END IF;', 'i'));
  end loop;
end;
$migration$;

-- Evaluate the caller's restriction once per statement, rather than once per
-- candidate pick/agent row. A denied read should return promptly even on a
-- large picks table.
alter policy "Tiered customers need Pro for agent picks" on public.avatar_picks
  using (not (select public.tiered_agent_access_restricted(auth.uid())));
alter policy "Tiered customers need Pro to create agents" on public.avatar_profiles
  with check (not (select public.tiered_agent_access_restricted(auth.uid())));
alter policy "Tiered customers need Pro for agent parlays" on public.avatar_parlays
  using (not (select public.tiered_agent_access_restricted(auth.uid())));
alter policy "Tiered customers need Pro for agent parlay legs" on public.avatar_parlay_legs
  using (not (select public.tiered_agent_access_restricted(auth.uid())));
alter policy "Tiered customers need Pro for agent performance" on public.avatar_performance_cache
  using (not (select public.tiered_agent_access_restricted(auth.uid())));
