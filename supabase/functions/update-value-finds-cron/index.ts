import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CronUpdateRequest {
  sport_type: 'nfl' | 'cfb';
  enabled: boolean;
  scheduled_time: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { sport_type, enabled, scheduled_time }: CronUpdateRequest = await req.json();

    if (!sport_type || !scheduled_time) {
      throw new Error('sport_type and scheduled_time are required');
    }

    console.log(`Updating cron job for ${sport_type}: enabled=${enabled}, time=${scheduled_time}`);

    // Parse scheduled time to get hours and minutes
    const [hours, minutes] = scheduled_time.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error('Invalid scheduled_time format. Use HH:MM format.');
    }

    // Convert to cron format (minute hour * * *)
    const cronSchedule = `${minutes} ${hours} * * *`;
    const jobName = `value-finds-${sport_type}`;

    // Use RPC function to update cron job
    const { data, error } = await supabaseClient.rpc('update_value_finds_cron', {
      p_sport_type: sport_type,
      p_enabled: enabled,
      p_cron_schedule: cronSchedule,
      p_job_name: jobName,
    });

    if (error) {
      console.error('Error updating cron job:', error);
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: enabled 
          ? `Cron job scheduled for ${sport_type} at ${scheduled_time}`
          : `Cron job disabled for ${sport_type}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-value-finds-cron:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

