-- Deliberately separate from client-writable profiles. Only trusted billing
-- functions may change access. No bulk reclassification of existing users.
create table public.subscription_tier_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text check (tier in ('standard', 'premium', 'pro')),
  is_tiered_customer boolean not null default false,
  expires_at timestamptz,
  verified_at timestamptz not null default now()
);
alter table public.subscription_tier_access enable row level security;
revoke all on public.subscription_tier_access from anon, authenticated;
grant select on public.subscription_tier_access to authenticated;
grant all on public.subscription_tier_access to service_role;
create policy "Read own subscription tier" on public.subscription_tier_access
  for select to authenticated using (auth.uid() = user_id);

-- Preserve the existing fail-open behavior for legacy customers, but never
-- treat the mere presence of an RC customer ID as Pro for the new cohort.
create function public.tiered_agent_access_restricted(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.has_role(p_user_id, 'admin') and exists (
    select 1 from public.subscription_tier_access
    where user_id = p_user_id and is_tiered_customer
      and (tier is distinct from 'pro' or expires_at <= now())
  );
$$;
revoke all on function public.tiered_agent_access_restricted(uuid) from public;
grant execute on function public.tiered_agent_access_restricted(uuid) to authenticated, service_role;

-- Additional restrictive policies compose with existing ownership/public
-- policies; they do not broaden anyone's existing access.
create policy "Tiered customers need Pro for agent picks" on public.avatar_picks
  as restrictive for select to authenticated
  using (not public.tiered_agent_access_restricted(auth.uid()));
create policy "Tiered customers need Pro to create agents" on public.avatar_profiles
  as restrictive for insert to authenticated
  with check (not public.tiered_agent_access_restricted(auth.uid()));

CREATE OR REPLACE FUNCTION public.can_access_agent_picks(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_subscription_active boolean := false;
  v_has_rc_id boolean := false;
BEGIN

  IF public.tiered_agent_access_restricted(p_user_id) THEN
    RETURN false;
  END IF;
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'admin') THEN
    RETURN true;
  END IF;

  SELECT
    COALESCE(subscription_active, false),
    (revenuecat_customer_id IS NOT NULL AND revenuecat_customer_id <> '')
  INTO v_subscription_active, v_has_rc_id
  FROM public.profiles
  WHERE user_id = p_user_id;

  -- Fail open: if they have a RevenueCat customer ID, they've paid at some
  -- point. Grant access optimistically — webhook/client sync will correct
  -- subscription_active if they've actually lapsed.
  RETURN COALESCE(v_subscription_active, false) OR v_has_rc_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_use_agent_autopilot(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_subscription_active boolean := false;
  v_has_rc_id boolean := false;
BEGIN

  IF public.tiered_agent_access_restricted(p_user_id) THEN
    RETURN false;
  END IF;
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'admin') THEN
    RETURN true;
  END IF;

  SELECT
    COALESCE(subscription_active, false),
    (revenuecat_customer_id IS NOT NULL AND revenuecat_customer_id <> '')
  INTO v_subscription_active, v_has_rc_id
  FROM public.profiles
  WHERE user_id = p_user_id;

  -- Fail open: RevenueCat customer ID means they've interacted with billing
  RETURN COALESCE(v_subscription_active, false) OR v_has_rc_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_create_agent(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_subscription_active boolean := false;
  v_has_rc_id boolean := false;
  v_agent_count integer := 0;
BEGIN

  IF public.tiered_agent_access_restricted(p_user_id) THEN
    RETURN false;
  END IF;
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'admin') THEN
    RETURN true;
  END IF;

  SELECT
    COALESCE(subscription_active, false),
    (revenuecat_customer_id IS NOT NULL AND revenuecat_customer_id <> '')
  INTO v_subscription_active, v_has_rc_id
  FROM public.profiles
  WHERE user_id = p_user_id;

  -- Fail open: treat users with a RevenueCat customer ID as Pro
  IF COALESCE(v_subscription_active, false) OR v_has_rc_id THEN
    RETURN true;
  END IF;

  -- Free user: enforce 1-agent limit
  SELECT COUNT(*)
  INTO v_agent_count
  FROM public.avatar_profiles
  WHERE user_id = p_user_id
    AND is_active = true;

  RETURN v_agent_count < 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_create_agent(
  p_user_id uuid,
  p_target_is_active boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_subscription_active boolean := false;
  v_has_rc_id boolean := false;
  v_total_agent_count integer := 0;
  v_active_agent_count integer := 0;
BEGIN

  IF public.tiered_agent_access_restricted(p_user_id) THEN
    RETURN false;
  END IF;
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'admin') THEN
    RETURN true;
  END IF;

  SELECT
    COALESCE(subscription_active, false),
    (revenuecat_customer_id IS NOT NULL AND revenuecat_customer_id <> '')
  INTO v_subscription_active, v_has_rc_id
  FROM public.profiles
  WHERE user_id = p_user_id;

  SELECT COUNT(*)
  INTO v_total_agent_count
  FROM public.avatar_profiles
  WHERE user_id = p_user_id;

  SELECT COUNT(*)
  INTO v_active_agent_count
  FROM public.avatar_profiles
  WHERE user_id = p_user_id
    AND is_active = true;

  -- Paid path: explicit active subscription OR fail-open RevenueCat identity.
  IF COALESCE(v_subscription_active, false) OR v_has_rc_id THEN
    IF v_total_agent_count >= 30 THEN
      RETURN false;
    END IF;

    IF COALESCE(p_target_is_active, true) = false THEN
      RETURN true;
    END IF;

    RETURN v_active_agent_count < 10;
  END IF;

  -- Free path: one total active agent.
  RETURN v_active_agent_count < 1 AND v_total_agent_count < 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_set_agent_active(
  p_user_id uuid,
  p_avatar_id uuid,
  p_target_is_active boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_subscription_active boolean := false;
  v_has_rc_id boolean := false;
  v_current_is_active boolean := false;
  v_active_agent_count integer := 0;
BEGIN

  IF p_user_id IS NOT NULL AND p_target_is_active = false THEN
    RETURN true;
  END IF;
  IF public.tiered_agent_access_restricted(p_user_id) THEN
    RETURN false;
  END IF;
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'admin') THEN
    RETURN true;
  END IF;

  IF p_target_is_active = false THEN
    RETURN true;
  END IF;

  SELECT
    COALESCE(subscription_active, false),
    (revenuecat_customer_id IS NOT NULL AND revenuecat_customer_id <> '')
  INTO v_subscription_active, v_has_rc_id
  FROM public.profiles
  WHERE user_id = p_user_id;

  SELECT COALESCE(is_active, false)
  INTO v_current_is_active
  FROM public.avatar_profiles
  WHERE id = p_avatar_id
    AND user_id = p_user_id;

  IF v_current_is_active THEN
    RETURN true;
  END IF;

  SELECT COUNT(*)
  INTO v_active_agent_count
  FROM public.avatar_profiles
  WHERE user_id = p_user_id
    AND is_active = true;

  IF COALESCE(v_subscription_active, false) OR v_has_rc_id THEN
    RETURN v_active_agent_count < 10;
  END IF;

  RETURN v_active_agent_count < 1;
END;
$$;

-- An authoritative RevenueCat-derived cache, not a grandfathered user registry.
-- Writing the compatibility mirror and tier together avoids partial Pro grants.
create function public.sync_subscription_tier_access(
  p_user_id uuid, p_tier text, p_is_tiered_customer boolean,
  p_expires_at timestamptz, p_subscription_status text,
  p_revenuecat_customer_id text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscription_tier_access(user_id, tier, is_tiered_customer, expires_at)
  values (p_user_id, p_tier, p_is_tiered_customer, p_expires_at)
  on conflict (user_id) do update set
    tier = excluded.tier,
    is_tiered_customer = subscription_tier_access.is_tiered_customer or excluded.is_tiered_customer,
    expires_at = excluded.expires_at,
    verified_at = now();
  update public.profiles set
    subscription_active = coalesce(p_tier = 'pro', false),
    subscription_status = coalesce(p_subscription_status, 'inactive'),
    subscription_expires_at = p_expires_at,
    revenuecat_customer_id = coalesce(p_revenuecat_customer_id, revenuecat_customer_id)
  where user_id = p_user_id;
  if not found then raise exception 'Subscription profile not found'; end if;
end;
$$;
revoke all on function public.sync_subscription_tier_access(uuid,text,boolean,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.sync_subscription_tier_access(uuid,text,boolean,timestamptz,text,text) to service_role;

create policy "Tiered customers need Pro for agent parlays" on public.avatar_parlays
  as restrictive for select to authenticated
  using (not public.tiered_agent_access_restricted(auth.uid()));
create policy "Tiered customers need Pro for agent parlay legs" on public.avatar_parlay_legs
  as restrictive for select to authenticated
  using (not public.tiered_agent_access_restricted(auth.uid()));

-- These existing security-definer read APIs bypass table RLS. Preserve their
-- current implementations and signatures, adding only a caller-cohort guard.
-- Legacy/anonymous callers retain the existing public-preview behavior.
do $migration$
declare
  target record;
  definition text;
  guarded_source text;
begin
  for target in
    select p.oid, p.proname, p.prosrc, l.lanname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public' and p.proname in (
      'get_top_agent_picks_feed_v2', 'get_game_agent_consensus',
      'get_agent_pick_overlap_batch', 'get_agent_performance_distribution',
      'get_distribution_bin_agents'
    )
  loop
    definition := pg_get_functiondef(target.oid);
    if target.lanname = 'plpgsql' then
      guarded_source := regexp_replace(target.prosrc, '\mBEGIN\M',
        'BEGIN IF public.tiered_agent_access_restricted(auth.uid()) THEN RAISE EXCEPTION ''Agent access requires WagerProof Pro'' USING ERRCODE = ''42501''; END IF;', 'i');
    elsif target.lanname = 'sql' then
      guarded_source := 'BEGIN IF public.tiered_agent_access_restricted(auth.uid()) THEN RAISE EXCEPTION ''Agent access requires WagerProof Pro'' USING ERRCODE = ''42501''; END IF; RETURN QUERY ' || rtrim(target.prosrc, E'; \n\r\t') || '; END;';
      definition := replace(definition, 'LANGUAGE sql', 'LANGUAGE plpgsql');
    else
      raise exception 'Unexpected language for tier-protected function %', target.proname;
    end if;
    execute replace(definition, target.prosrc, guarded_source);
  end loop;
end;
$migration$;
