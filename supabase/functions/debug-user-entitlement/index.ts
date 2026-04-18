// Temporary debug endpoint. Given an email, looks up the user's profile,
// RC state, and recent picks to diagnose entitlement/display mismatches.
// DELETE after debugging.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolvePremiumAccess } from '../shared/entitlements.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-debug-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const internalSecret = Deno.env.get('BACKFILL_FUNCTION_SECRET');
  const providedSecret = req.headers.get('x-debug-secret');
  if (!internalSecret || providedSecret !== internalSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { email?: string; agent_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const email = body.email;
  if (!email) {
    return new Response(JSON.stringify({ error: 'Missing email' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const service = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Find user by email via auth.users (paginate through all pages).
  let authUser: any = null;
  for (let page = 1; page <= 20; page++) {
    const { data: userList, error: userErr } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (userErr) {
      return new Response(JSON.stringify({ error: `listUsers p${page}: ${userErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    authUser = userList.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (authUser) break;
    if (!userList.users.length || userList.users.length < 1000) break;
  }
  if (!authUser) {
    return new Response(JSON.stringify({ error: `No auth user with email ${email}` }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = authUser.id;

  const { data: profile } = await service
    .from('profiles')
    .select('user_id, subscription_active, subscription_status, subscription_expires_at, revenuecat_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  const entitlement = await resolvePremiumAccess(service, userId);

  // Today's date in NY
  const nyDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const todayStr = `${nyDate.getFullYear()}-${String(nyDate.getMonth() + 1).padStart(2, '0')}-${String(nyDate.getDate()).padStart(2, '0')}`;

  // Agents owned by this user
  const { data: agents } = await service
    .from('avatar_profiles')
    .select('id, name, preferred_sports, is_active, auto_generate, last_generation_date, daily_generation_count')
    .eq('user_id', userId);

  // Get today's picks across all their agents (filter by NY today)
  const agentIds = (agents ?? []).map((a: any) => a.id);
  const { data: todaysPicks } = agentIds.length > 0
    ? await service
        .from('avatar_picks')
        .select('id, avatar_id, sport, game_date, bet_type, pick_selection, created_at')
        .in('avatar_id', agentIds)
        .eq('game_date', todayStr)
    : { data: [] };

  // Get all picks in the last 2 days across all their agents
  const { data: recentPicks } = agentIds.length > 0
    ? await service
        .from('avatar_picks')
        .select('id, avatar_id, game_date, created_at')
        .in('avatar_id', agentIds)
        .order('created_at', { ascending: false })
        .limit(30)
    : { data: [] };

  // Latest generation runs
  const { data: runs } = agentIds.length > 0
    ? await service
        .from('agent_generation_runs')
        .select('id, avatar_id, target_date, status, picks_generated, completed_at, weak_slate, no_games')
        .in('avatar_id', agentIds)
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(10)
    : { data: [] };

  return new Response(
    JSON.stringify(
      {
        user_id: userId,
        email,
        today_ny: todayStr,
        profile,
        entitlement,
        agents,
        todays_picks_count: todaysPicks?.length ?? 0,
        todays_picks: todaysPicks,
        recent_picks: recentPicks,
        runs,
      },
      null,
      2,
    ),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
