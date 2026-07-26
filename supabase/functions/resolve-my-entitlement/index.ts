// Authenticated self-serve entitlement resolve for the website.
// Web Billing SDK only sees the lowercase UUID customer; store purchases may
// live on $RCAnonymousID or the UPPERCASE twin (iOS ≤3.5.6). This reuses the
// same multi-id probe as agent/autopilot gates so web access matches the app.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolvePremiumAccess } from '../shared/entitlements.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json(401, { error: 'Missing authorization header' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return json(401, { error: 'Unauthorized' });
    }

    const service = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Always resolve the caller's own identity — never accept a body user id.
    const result = await resolvePremiumAccess(service, user.id);

    return json(200, {
      hasPremiumAccess: result.hasPremiumAccess === true,
      isAdmin: result.isAdmin === true,
      source: result.entitlement?.source ?? (result.isAdmin ? 'admin' : null),
      subscriptionStatus: result.entitlement?.subscriptionStatus ?? null,
      expiresAt: result.entitlement?.expiresAt ?? null,
    });
  } catch (error: any) {
    console.error('[resolve-my-entitlement] error:', error);
    return json(500, { error: error?.message || 'Failed to resolve entitlement' });
  }
});

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
