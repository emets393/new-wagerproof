import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useCreateAgent } from '@/hooks/useAgents';

/**
 * Creates the user's onboarding agent in the background after they exit onboarding.
 * The agent config was collected during onboarding steps 15-19 and stored in onboardingData.
 * This component mounts in the root layout and fires once.
 */
export function DeferredAgentCreator() {
  const { user } = useAuth();
  const { onboardingData, agentFormState, setCreatedAgentId } = useOnboarding();
  const createMutation = useCreateAgent();
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (hasAttempted.current) return;
    if (!user?.id) return;

    // Only run if we have agent config from onboarding but no created agent yet
    const config = onboardingData.agentFormState ?? agentFormState;
    if (!config?.name?.trim() || onboardingData.createdAgentId) return;

    hasAttempted.current = true;

    createMutation
      .mutateAsync({
        name: config.name.trim(),
        avatar_emoji: config.avatar_emoji,
        avatar_color: config.avatar_color,
        preferred_sports: config.preferred_sports,
        archetype: config.archetype,
        personality_params: config.personality_params,
        custom_insights: config.custom_insights,
        auto_generate: config.auto_generate,
        auto_generate_time: config.auto_generate_time,
        auto_generate_timezone: config.auto_generate_timezone,
      })
      .then((newAgent) => {
        setCreatedAgentId(newAgent.id);
        console.log('✅ Deferred agent created:', newAgent.id);
      })
      .catch((err) => {
        console.warn('⚠️ Deferred agent creation failed:', err?.message);
        // Not critical — user can create from the Agents tab
      });
  }, [user?.id]);

  return null;
}
