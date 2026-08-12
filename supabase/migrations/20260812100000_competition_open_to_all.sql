-- Competition open to ALL signed-in users (owner 2026-08-12): the pick'em is an
-- acquisition funnel — free accounts can play; only sign-in is required.
-- comp_is_eligible is the single gate every comp_* RPC calls, so this one function
-- re-opens (or re-gates) the whole feature. The old Pro check is kept in a comment
-- for a one-line rollback.
create or replace function public.comp_is_eligible(p_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  -- Pro-gated version (pre-2026-08-12):
  --   select exists (select 1 from public.profiles
  --                  where user_id = p_user and subscription_active = true)
  --       or exists (select 1 from public.user_roles
  --                  where user_id = p_user and role = 'admin');
  select p_user is not null;
$$;
