-- Create RPC function to update value finds cron jobs
-- Note: This function is kept for potential future use, but the master scheduler
-- runs hourly and checks all schedules, so individual cron jobs per sport are not needed
CREATE OR REPLACE FUNCTION update_value_finds_cron(
  p_sport_type TEXT,
  p_enabled BOOLEAN,
  p_cron_schedule TEXT,
  p_job_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- The master scheduler (value-finds-scheduler-master) runs hourly
  -- and checks all enabled schedules, so we don't need individual cron jobs
  -- This function is kept for API compatibility but just returns success
  
  v_result := jsonb_build_object(
    'success', true,
    'action', 'noted',
    'message', 'Schedule saved. The master scheduler will check this schedule hourly.',
    'sport_type', p_sport_type,
    'enabled', p_enabled,
    'scheduled_time', p_cron_schedule
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users (admins)
GRANT EXECUTE ON FUNCTION update_value_finds_cron TO authenticated;

COMMENT ON FUNCTION update_value_finds_cron IS 'Manages cron jobs for scheduled value finds generation';

