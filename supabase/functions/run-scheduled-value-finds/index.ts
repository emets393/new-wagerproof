import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Running scheduled value finds check...');

    // Get all enabled schedules
    const { data: schedules, error: scheduleError } = await supabaseClient
      .from('ai_page_level_schedules')
      .select('*')
      .eq('enabled', true);

    if (scheduleError) {
      throw new Error(`Error fetching schedules: ${scheduleError.message}`);
    }

    if (!schedules || schedules.length === 0) {
      console.log('No enabled schedules found');
      return new Response(
        JSON.stringify({ success: true, message: 'No enabled schedules' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    // Check each schedule and run if it's time
    for (const schedule of schedules) {
      const now = new Date();
      const [hours, minutes] = schedule.scheduled_time.split(':').map(Number);
      
      // Get schedule frequency (daily or weekly)
      const scheduleFrequency = (schedule as any).schedule_frequency ?? 'weekly'; // Default to weekly if not set
      
      // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      const dayOfWeek = (schedule as any).day_of_week ?? 1; // Default to Monday if not set
      const currentDayOfWeek = now.getDay(); // JavaScript: 0 = Sunday, 1 = Monday, etc.
      
      // Check if we already ran today (for daily) or this week (for weekly)
      const lastRun = schedule.last_run_at ? new Date(schedule.last_run_at) : null;
      let shouldRun = false;
      
      if (scheduleFrequency === 'daily') {
        // For daily schedules, check if we already ran today
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lastRunDate = lastRun ? new Date(lastRun.getFullYear(), lastRun.getMonth(), lastRun.getDate()) : null;
        shouldRun = !lastRun || (lastRunDate && lastRunDate < today);
      } else {
        // For weekly schedules, check if we already ran this week
        shouldRun = !lastRun || 
          (lastRun.getDay() !== dayOfWeek) || // Different day of week
          (now.getTime() - lastRun.getTime() > 7 * 24 * 60 * 60 * 1000); // More than 7 days ago
      }

      // Check if current day matches scheduled day (only for weekly) and time matches (within 5 minutes)
      const dayMatch = scheduleFrequency === 'daily' ? true : currentDayOfWeek === dayOfWeek;
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const timeMatch = currentHour === hours && Math.abs(currentMinute - minutes) <= 5;

      if (shouldRun && dayMatch && timeMatch) {
        console.log(`Running scheduled generation for ${schedule.sport_type} at ${schedule.scheduled_time}...`);
        
        // Call the generate-page-level-analysis function
        const { data, error } = await supabaseClient.functions.invoke(
          'generate-page-level-analysis',
          {
            body: {
              sport_type: schedule.sport_type,
              analysis_date: now.toISOString().split('T')[0],
              user_id: null, // System-generated
            },
          }
        );

        if (error) {
          console.error(`Error generating for ${schedule.sport_type}:`, error);
          results.push({
            sport_type: schedule.sport_type,
            success: false,
            error: error.message,
          });
        } else {
          console.log(`Successfully generated value finds for ${schedule.sport_type}`);
          results.push({
            sport_type: schedule.sport_type,
            success: true,
            published: schedule.auto_publish || false,
          });
        }
      } else if (!shouldRun) {
        if (scheduleFrequency === 'daily') {
          console.log(`Skipping ${schedule.sport_type} - already ran today at ${schedule.last_run_at}`);
        } else {
          console.log(`Skipping ${schedule.sport_type} - already ran this week at ${schedule.last_run_at}`);
        }
      } else if (!dayMatch) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        console.log(`Skipping ${schedule.sport_type} - not scheduled day (current: ${dayNames[currentDayOfWeek]}, scheduled: ${dayNames[dayOfWeek]})`);
      } else {
        console.log(`Skipping ${schedule.sport_type} - not scheduled time (current: ${currentHour}:${currentMinute}, scheduled: ${hours}:${minutes})`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in run-scheduled-value-finds:', error);
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

