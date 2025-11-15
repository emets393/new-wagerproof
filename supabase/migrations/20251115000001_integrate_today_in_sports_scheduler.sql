-- Integrate Today in Sports into the master scheduler system
-- This replaces the standalone cron job with integration into run-scheduled-value-finds

-- First, remove the old standalone cron job if it exists
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'generate-today-in-sports-daily';
  
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule('generate-today-in-sports-daily');
    RAISE NOTICE 'Removed standalone today-in-sports cron job';
  END IF;
END $$;

-- Update the ai_page_level_schedules constraint to include NBA and NCAAB
ALTER TABLE public.ai_page_level_schedules 
DROP CONSTRAINT IF EXISTS ai_page_level_schedules_sport_type_check;

ALTER TABLE public.ai_page_level_schedules
ADD CONSTRAINT ai_page_level_schedules_sport_type_check 
CHECK (sport_type IN ('nfl', 'cfb', 'nba', 'ncaab', 'today_in_sports'));

-- Update the today_in_sports schedule to use daily frequency
UPDATE public.ai_page_level_schedules
SET 
  schedule_frequency = 'daily',
  scheduled_time = '10:00:00',  -- 10 AM server time
  day_of_week = 1  -- Monday (not used for daily schedules, but set a default)
WHERE sport_type = 'today_in_sports';

-- Add comment
COMMENT ON COLUMN ai_page_level_schedules.schedule_frequency IS 'Schedule frequency: daily (runs every day at scheduled_time) or weekly (runs once per week on day_of_week at scheduled_time). Today in Sports uses daily.';

