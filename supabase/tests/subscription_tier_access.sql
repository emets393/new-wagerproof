-- Run in an isolated test database after the tier access migration.
-- Transactions roll all fixture data back. No production users are changed.
begin;
insert into auth.users(id) values
('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002'),
('00000000-0000-4000-8000-000000000003'), ('00000000-0000-4000-8000-000000000004');
insert into public.profiles(user_id, subscription_active, revenuecat_customer_id) values
('00000000-0000-4000-8000-000000000001', true, 'standard-customer'),
('00000000-0000-4000-8000-000000000002', true, 'premium-customer'),
('00000000-0000-4000-8000-000000000003', true, 'pro-customer'),
('00000000-0000-4000-8000-000000000004', false, 'legacy-customer');
insert into public.subscription_tier_access(user_id, tier, is_tiered_customer) values
('00000000-0000-4000-8000-000000000001', 'standard', true),
('00000000-0000-4000-8000-000000000002', 'premium', true),
('00000000-0000-4000-8000-000000000003', 'pro', true);
insert into public.avatar_picks(id, avatar_id) values
('00000000-0000-4000-8000-000000000099', '00000000-0000-4000-8000-000000000098');

do $$
begin
  assert not public.can_access_agent_picks('00000000-0000-4000-8000-000000000001'), 'Standard must not inherit paid=true Pro access';
  assert not public.can_access_agent_picks('00000000-0000-4000-8000-000000000002'), 'Premium must not unlock agents';
  assert public.can_access_agent_picks('00000000-0000-4000-8000-000000000003'), 'Pro must unlock agents';
  assert public.can_access_agent_picks('00000000-0000-4000-8000-000000000004'), 'Legacy fallback must retain access';
  assert not public.can_create_agent('00000000-0000-4000-8000-000000000001', true), 'Standard must not inherit the old free agent';
  assert not public.can_use_agent_autopilot('00000000-0000-4000-8000-000000000002'), 'Premium must not enable autopilot';
  assert public.can_create_agent('00000000-0000-4000-8000-000000000003', true), 'Pro can create an agent';
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $$
begin
  assert (select count(*) from public.avatar_picks) = 0, 'RLS must hide picks from Standard';
  assert (select count(*) from public.subscription_tier_access) = 1, 'Only own tier is readable';
  begin
    update public.subscription_tier_access set tier = 'pro';
    raise exception 'Client must not be able to upgrade its tier';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
do $$ begin
  assert (select count(*) from public.avatar_picks) = 1, 'Existing permissive Pro read must survive';
end $$;
reset role;
rollback;
