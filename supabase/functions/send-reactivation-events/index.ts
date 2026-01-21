import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InactiveUser {
  user_id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  last_sign_in_at: string;
}

interface RequestBody {
  batch_size?: number;
  inactivity_days?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let usersProcessed = 0;
  let usersSucceeded = 0;
  let usersFailed = 0;
  const failedUsers: Array<{ user_id: string; error: string }> = [];

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const loopsApiKey = Deno.env.get('LOOPS_API_KEY') ?? '';

    if (!loopsApiKey) {
      throw new Error('LOOPS_API_KEY is not configured');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional overrides
    let requestBody: RequestBody = {};
    try {
      requestBody = await req.json();
    } catch {
      // No body provided, use defaults
    }

    // Get configuration from env or request body
    const batchSize = requestBody.batch_size ||
      parseInt(Deno.env.get('REACTIVATION_BATCH_SIZE') || '150', 10);
    const inactivityDays = requestBody.inactivity_days ||
      parseInt(Deno.env.get('REACTIVATION_INACTIVITY_DAYS') || '30', 10);

    console.log(`Starting reactivation email job: batch_size=${batchSize}, inactivity_days=${inactivityDays}`);

    // Fetch inactive users via RPC
    const { data: inactiveUsers, error: fetchError } = await supabaseClient
      .rpc('get_inactive_users_for_email', {
        batch_size: batchSize,
        inactivity_days: inactivityDays,
      });

    if (fetchError) {
      throw new Error(`Error fetching inactive users: ${fetchError.message}`);
    }

    if (!inactiveUsers || inactiveUsers.length === 0) {
      console.log('No inactive users found for reactivation emails');

      // Log the run
      await supabaseClient.from('reactivation_email_logs').insert({
        status: 'success',
        users_processed: 0,
        users_succeeded: 0,
        users_failed: 0,
        details: { message: 'No inactive users found' },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No inactive users found',
          users_processed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${inactiveUsers.length} inactive users to process`);

    // Assign cohorts for A/B testing (50/50 split)
    const cohorts = ['A', 'B'];

    // Process each user
    for (const user of inactiveUsers as InactiveUser[]) {
      usersProcessed++;

      // Assign cohort randomly
      const cohort = cohorts[Math.floor(Math.random() * cohorts.length)];

      // Determine the first name to use
      const firstName = user.display_name || user.username || 'there';

      try {
        // Build request payload
        const loopsPayload = {
          email: user.email,
          eventName: 'user_reactivation_needed',
          eventProperties: {
            firstName: firstName,
            lastActive: user.last_sign_in_at,
            cohort: cohort,
            userId: user.user_id,
          },
        };

        console.log(`Sending event to Loops for ${user.email}`);

        // Send event to Loops.so
        const loopsResponse = await fetch('https://app.loops.so/api/v1/events/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${loopsApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(loopsPayload),
        });

        const responseText = await loopsResponse.text();
        console.log(`Loops response for ${user.email}: ${loopsResponse.status} - ${responseText}`);

        if (!loopsResponse.ok) {
          throw new Error(`Loops API error (${loopsResponse.status}): ${responseText}`);
        }

        // Update profile to mark email as sent
        const { error: updateError } = await supabaseClient
          .from('profiles')
          .update({
            reactivation_email_sent_at: new Date().toISOString(),
            reactivation_cohort: cohort,
          })
          .eq('user_id', user.user_id);

        if (updateError) {
          console.error(`Error updating profile for ${user.user_id}:`, updateError);
          // Don't throw - the Loops event was sent successfully
        }

        usersSucceeded++;
        console.log(`Sent reactivation event for user ${user.user_id} (cohort ${cohort})`);

      } catch (error: any) {
        usersFailed++;
        const errorMessage = error.message || 'Unknown error';
        console.error(`Error processing user ${user.user_id}:`, errorMessage);
        failedUsers.push({ user_id: user.user_id, error: errorMessage });
      }

      // Rate limiting: 100ms delay between API calls (stays under 10 req/sec)
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const duration = Date.now() - startTime;
    const status = usersFailed === 0 ? 'success' : (usersSucceeded > 0 ? 'partial' : 'failed');

    console.log(`Reactivation job completed: ${usersSucceeded}/${usersProcessed} succeeded in ${duration}ms`);

    // Log the run
    await supabaseClient.from('reactivation_email_logs').insert({
      status,
      users_processed: usersProcessed,
      users_succeeded: usersSucceeded,
      users_failed: usersFailed,
      error_message: usersFailed > 0 ? `${usersFailed} users failed` : null,
      details: {
        duration_ms: duration,
        batch_size: batchSize,
        inactivity_days: inactivityDays,
        failed_users: failedUsers.length > 0 ? failedUsers : undefined,
      },
    });

    return new Response(
      JSON.stringify({
        success: status !== 'failed',
        status,
        users_processed: usersProcessed,
        users_succeeded: usersSucceeded,
        users_failed: usersFailed,
        duration_ms: duration,
        failed_details: failedUsers.length > 0 ? failedUsers : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-reactivation-events:', error);

    // Try to log the failure
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      await supabaseClient.from('reactivation_email_logs').insert({
        status: 'failed',
        users_processed: usersProcessed,
        users_succeeded: usersSucceeded,
        users_failed: usersFailed,
        error_message: error.message,
        details: {
          duration_ms: Date.now() - startTime,
          failed_users: failedUsers,
        },
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        users_processed: usersProcessed,
        users_succeeded: usersSucceeded,
        users_failed: usersFailed,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
