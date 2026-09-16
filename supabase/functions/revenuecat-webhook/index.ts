import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { reconcileRevenueCatEvent } from '../shared/revenuecatWebhook.ts';

// RevenueCat's Facebook integration remains the only conversion sender.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200 });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const expectedAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH_HEADER');
  if (!expectedAuth) return new Response('Webhook authorization is not configured', { status: 503 });
  if (req.headers.get('authorization') !== expectedAuth) return new Response('Unauthorized', { status: 401 });
  try {
    const { event } = await req.json();
    if (!event) return Response.json({ ok: true });
    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Live multi-identity verification preserves the production fix for
    // expired uppercase bridge grants alongside active lowercase purchases.
    return Response.json(await reconcileRevenueCatEvent(service, event));
  } catch (error) {
    console.error('[revenuecat-webhook] Reconciliation failed:', error);
    return Response.json({ error: 'Subscription reconciliation unavailable; retry' }, { status: 500 });
  }
});
