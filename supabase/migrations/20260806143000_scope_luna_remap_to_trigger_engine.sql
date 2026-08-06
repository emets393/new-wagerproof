-- 2026-08-06: Scope the Luna remap to the engine that can actually run Luna.
--
-- The 2026-08-01 remap (20260801120000) rewrites NULL/deepseek* model ids to
-- gpt-5.6-luna on EVERY insert into agent_generation_runs, regardless of which
-- engine later claims the row. That was written alongside the V3 Responses-API
-- port, which is what makes Luna safe: Luna refuses function tools plus any
-- non-"none" reasoning effort on /v1/chat/completions (HTTP 400), and only
-- /v1/responses accepts the combination.
--
-- The port shipped to the Trigger.dev engine (engine_version 'v3_trigger') and
-- nowhere else. The other two engines still speak chat/completions:
--
--   * 'v3'  — the process-agent-generation-job-v3 edge mirror, fed by pg_cron
--             'v3-dispatch-workers' EVERY MINUTE. 108 runs, 0 successes,
--             continuous 400s from 2026-08-02 16:33 UTC to 2026-08-06 13:29 UTC.
--   * 'v2'  — the legacy queue, reachable from agent-authorized-action-v1.
--             22 Luna runs, 0 successes, while its gpt-5-mini runs succeed fine.
--
-- So the remap target now depends on the engine stamped on the row. Postgres
-- applies column defaults before BEFORE INSERT triggers, and engine_version is
-- NOT NULL with default 'v2', so NEW.engine_version is always populated here.
--
-- gpt-4.1-mini is the pre-Luna default that ran these engines successfully (52
-- runs on 'v3', 233 on 'v3_trigger', zero model-related failures). It is not a
-- reasoning model, so the tools+effort conflict cannot arise on either wire.
--
-- Retire this by deleting the engines, not by widening the remap again. Porting
-- the edge mirror to /v1/responses is explicitly NOT wanted — it is deprecated
-- and its own header says do not extend it.

CREATE OR REPLACE FUNCTION public.hotfix_remap_deepseek_model_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.model_name IS NULL OR NEW.model_name LIKE 'deepseek%' THEN
    -- Only the Trigger.dev engine speaks /v1/responses, so only it gets Luna.
    IF NEW.engine_version = 'v3_trigger' THEN
      NEW.model_name := 'gpt-5.6-luna';
    ELSE
      NEW.model_name := 'gpt-4.1-mini';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hotfix_remap_deepseek_model_on_insert ON public.agent_generation_runs;
CREATE TRIGGER trg_hotfix_remap_deepseek_model_on_insert
BEFORE INSERT ON public.agent_generation_runs
FOR EACH ROW
EXECUTE FUNCTION public.hotfix_remap_deepseek_model_on_insert();

-- The two v3_trigger enqueue RPCs keep their gpt-5.6-luna COALESCE defaults from
-- 20260801120000 — they only ever create 'v3_trigger' rows, which is the branch
-- this migration sends to Luna. Deliberately untouched.
