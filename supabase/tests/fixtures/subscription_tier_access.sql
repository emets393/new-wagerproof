create table public.profiles(user_id uuid primary key, subscription_active boolean, revenuecat_customer_id text, subscription_status text, subscription_expires_at timestamptz);
create table public.avatar_profiles(id uuid primary key, user_id uuid, is_active boolean);
create table public.avatar_picks(id uuid primary key, avatar_id uuid);
create function public.has_role(uuid, text) returns boolean language sql stable as $$ select false $$;
alter table public.avatar_profiles enable row level security;
alter table public.avatar_picks enable row level security;
create policy fixture_read on public.avatar_picks for select to authenticated using (true);
create policy fixture_create on public.avatar_profiles for insert to authenticated with check (true);
grant select, insert, update on public.avatar_picks, public.avatar_profiles to authenticated;

create table public.avatar_parlays(id uuid primary key);
create table public.avatar_parlay_legs(id uuid primary key);
alter table public.avatar_parlays enable row level security;
alter table public.avatar_parlay_legs enable row level security;
