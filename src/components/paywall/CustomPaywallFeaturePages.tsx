import type { ReactNode } from 'react';
import type { ResearchTimeBucket, StakesBucket } from '@/components/onboarding/research';
import {
  AgentHQHero,
  BeforeAfterHero,
  CommunityHero,
  LeaderboardHero,
  OutliersHero,
  PaywallFeatureFrame,
  ReasonedPicksHero,
  SocialProofHero,
} from './CustomPaywallHeroes';

export interface PaywallPersonalization {
  agentName?: string;
  spriteIndex?: number | null;
  avatarColor?: string;
  researchTimeBucket?: ResearchTimeBucket | string;
  weeklyStakesBucket?: StakesBucket | string;
}

export const PAYWALL_PAGE_KEYS = [
  'value',
  'social_proof',
  'agent_hq',
  'leaderboard',
  'reasoned_picks',
  'outliers',
  'community_connectors',
] as const;

export function getPaywallFeaturePages(
  personalization: PaywallPersonalization,
  activePage: number,
): ReactNode[] {
  const agentName = personalization.agentName?.trim() || 'Your agent';

  return [
    <BeforeAfterHero key="value" personalization={personalization} active={activePage === 0} />,
    <PaywallFeatureFrame
      key="social"
      title="Loved by bettors who want the why"
      blurb="Five-star feedback from bettors using WagerProof across different betting styles."
    >
      <SocialProofHero active={activePage === 1} />
    </PaywallFeatureFrame>,
    <PaywallFeatureFrame
      key="hq"
      title={`${agentName} is already clocked in`}
      blurb="Watch your agents research the slate, move between desks, and file picks throughout the day."
    >
      <AgentHQHero personalization={personalization} />
    </PaywallFeatureFrame>,
    <PaywallFeatureFrame
      key="leaderboard"
      title="Tail picks from the top strategies others created"
      blurb="Records, units, win rate, and live streaks make the strongest agents easy to find."
    >
      <LeaderboardHero active={activePage === 3} />
    </PaywallFeatureFrame>,
    <PaywallFeatureFrame
      key="picks"
      title="Picks that show their work"
      blurb="Every recommendation includes the odds, confidence, and signals behind it."
    >
      <ReasonedPicksHero active={activePage === 4} />
    </PaywallFeatureFrame>,
    <PaywallFeatureFrame
      key="outliers"
      title="The signals most bettors miss"
      blurb="Rare historical splits and matchup trends, paired with the line in front of you."
    >
      <OutliersHero active={activePage === 5} />
    </PaywallFeatureFrame>,
    <PaywallFeatureFrame
      key="community"
      title="Your data, wherever you research"
      blurb="Join the private Discord or bring WagerProof into the AI tools you already use."
    >
      <CommunityHero />
    </PaywallFeatureFrame>,
  ];
}
