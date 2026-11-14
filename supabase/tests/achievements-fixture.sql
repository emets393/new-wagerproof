-- Minimal source schema for isolated PostgreSQL behavior tests, not a migration.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;
CREATE TABLE public.avatar_profiles(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),is_public boolean DEFAULT false);
CREATE TABLE public.avatar_picks(id uuid PRIMARY KEY,avatar_id uuid REFERENCES avatar_profiles(id) ON DELETE CASCADE);
CREATE TABLE public.avatar_parlays(id uuid PRIMARY KEY,avatar_id uuid REFERENCES avatar_profiles(id) ON DELETE CASCADE);
CREATE TABLE public.avatar_performance_cache(avatar_id uuid PRIMARY KEY REFERENCES avatar_profiles(id) ON DELETE CASCADE,total_picks integer DEFAULT 0,wins integer DEFAULT 0,losses integer DEFAULT 0,net_units numeric DEFAULT 0,best_streak integer DEFAULT 0,current_streak integer DEFAULT 0,win_rate numeric DEFAULT 0);
CREATE TABLE public.user_avatar_follows(user_id uuid REFERENCES auth.users(id),avatar_id uuid REFERENCES avatar_profiles(id) ON DELETE CASCADE,PRIMARY KEY(user_id,avatar_id));
CREATE TABLE public.nfl_analysis_saved_filters(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id),verdict text,rpc_filters jsonb);
CREATE TABLE public.cfb_analysis_saved_filters(LIKE nfl_analysis_saved_filters INCLUDING ALL);
CREATE TABLE public.mlb_analysis_saved_filters(LIKE nfl_analysis_saved_filters INCLUDING ALL);
CREATE TABLE public.chat_threads(id uuid PRIMARY KEY,user_id text);
CREATE TABLE public.chat_messages(id uuid PRIMARY KEY,thread_id uuid REFERENCES chat_threads(id),role text,content text);
