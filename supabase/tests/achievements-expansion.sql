-- The old catalog has already been exercised before applying the forward migration.
CREATE TEMP TABLE original_awards AS SELECT user_id,achievement_id,earned_at,credited_agent_id FROM user_achievement_awards;
INSERT INTO auth.users VALUES('10000000-0000-0000-0000-000000000003');
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
SET ROLE authenticated;
SELECT test_assert(jsonb_array_length(get_user_achievements()->'achievements')=35,'expanded catalog 35');
SELECT test_assert((get_user_achievements()->>'catalog_version')::int=2,'catalog version 2');
RESET ROLE;
INSERT INTO avatar_profiles SELECT ('20000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'10000000-0000-0000-0000-000000000003',false FROM generate_series(31,32)n;
SELECT test_assert(NOT EXISTS(SELECT 1 FROM user_achievement_awards WHERE user_id=auth.uid() AND achievement_id='agent-squad'),'two agents below squad threshold');
INSERT INTO avatar_profiles VALUES('20000000-0000-0000-0000-000000000033',auth.uid(),false);
SELECT test_assert(EXISTS(SELECT 1 FROM user_achievement_awards WHERE user_id=auth.uid() AND achievement_id='agent-squad' AND NOT is_backfilled),'three agents unlock squad');
INSERT INTO avatar_profiles SELECT ('20000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,auth.uid(),false FROM generate_series(34,35)n;
SELECT test_assert(EXISTS(SELECT 1 FROM user_achievement_awards WHERE user_id=auth.uid() AND achievement_id='full-lineup'),'five agents unlock lineup');
INSERT INTO avatar_performance_cache(avatar_id,total_picks,wins,losses,best_streak,net_units) VALUES
('20000000-0000-0000-0000-000000000031',600,137,112,19,49.99),('20000000-0000-0000-0000-000000000032',600,137,112,19,49.99);
SELECT test_assert(NOT EXISTS(SELECT 1 FROM user_achievement_awards WHERE user_id=auth.uid() AND achievement_id IN ('experience-1000','consistent-250','streak-20','plus-50-units')),'do not combine agents; exact higher thresholds');
UPDATE avatar_performance_cache SET total_picks=2500,wins=138,losses=112,best_streak=20,net_units=50 WHERE avatar_id='20000000-0000-0000-0000-000000000031';
SELECT test_assert((SELECT count(*) FROM user_achievement_awards WHERE user_id=auth.uid() AND achievement_id IN ('experience-1000','experience-2500','consistent-250','streak-20','plus-50-units'))=5,'middle expansion thresholds');
UPDATE avatar_performance_cache SET total_picks=4999,wins=274,losses=226,best_streak=24,net_units=99.99 WHERE avatar_id='20000000-0000-0000-0000-000000000031';
SELECT test_assert(NOT EXISTS(SELECT 1 FROM user_achievement_awards WHERE user_id=auth.uid() AND achievement_id IN ('experience-5000','consistent-500','streak-25','plus-100-units')),'gold thresholds not rounded up');
UPDATE avatar_performance_cache SET total_picks=5000,wins=275,losses=225,best_streak=25,net_units=100 WHERE avatar_id='20000000-0000-0000-0000-000000000031';
SELECT test_assert((SELECT count(*) FROM user_achievement_awards WHERE user_id=auth.uid() AND achievement_id IN ('experience-5000','consistent-500','streak-25','plus-100-units'))=4,'exact gold thresholds');
CREATE TEMP TABLE expanded_earned AS SELECT * FROM user_achievement_awards WHERE user_id=auth.uid();
DELETE FROM avatar_profiles WHERE user_id=auth.uid();
SELECT test_assert(NOT EXISTS(SELECT 1 FROM expanded_earned e LEFT JOIN user_achievement_awards a USING(user_id,achievement_id,earned_at,credited_agent_id) WHERE a.achievement_id IS NULL AND e.credited_agent_id IS NOT NULL),'agent deletion preserves earned attribution');
SELECT test_assert(NOT EXISTS(SELECT 1 FROM original_awards e LEFT JOIN user_achievement_awards a ON a.user_id=e.user_id AND a.achievement_id=e.achievement_id AND a.earned_at=e.earned_at AND a.credited_agent_id IS NOT DISTINCT FROM e.credited_agent_id WHERE a.achievement_id IS NULL),'catalog upgrade preserves original awards');
-- Existing account upgrade: recognize newly added metrics quietly without swallowing an old pending award.
INSERT INTO auth.users VALUES('10000000-0000-0000-0000-000000000004');
INSERT INTO user_achievement_state(user_id,catalog_version) VALUES('10000000-0000-0000-0000-000000000004',1);
INSERT INTO avatar_profiles VALUES('20000000-0000-0000-0000-000000000041','10000000-0000-0000-0000-000000000004',false);
INSERT INTO avatar_performance_cache(avatar_id,total_picks) VALUES('20000000-0000-0000-0000-000000000041',1000);
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
SET ROLE authenticated;
SELECT test_assert(get_user_achievements()->'newly_unlocked_ids' ? 'first-agent','old pending celebration preserved');
SELECT test_assert(NOT (get_user_achievements()->'newly_unlocked_ids' ? 'experience-1000'),'new catalog backfill is quiet');
RESET ROLE;

-- Creation history is not lost if an agent is deleted before reaching the milestone.
INSERT INTO auth.users VALUES('10000000-0000-0000-0000-000000000005');
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',false);
SET ROLE authenticated;
SELECT get_user_achievements();
RESET ROLE;
INSERT INTO avatar_profiles VALUES('20000000-0000-0000-0000-000000000051',auth.uid(),false);
DELETE FROM avatar_profiles WHERE id='20000000-0000-0000-0000-000000000051';
INSERT INTO avatar_profiles VALUES('20000000-0000-0000-0000-000000000052',auth.uid(),false),('20000000-0000-0000-0000-000000000053',auth.uid(),false);
SELECT test_assert(EXISTS(SELECT 1 FROM user_achievement_awards WHERE user_id=auth.uid() AND achievement_id='agent-squad'),'three known creations count even when one was deleted before milestone');
SET ROLE authenticated;
SELECT test_assert(NOT EXISTS(SELECT 1 FROM user_achievement_agents WHERE user_id<>auth.uid()),'creation ledger owner isolation');
DO $$ BEGIN
 BEGIN INSERT INTO user_achievement_agents(user_id,agent_id) VALUES(auth.uid(),gen_random_uuid()); RAISE EXCEPTION 'Allowed fabricated creation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
