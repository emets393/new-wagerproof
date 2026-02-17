import React from 'react';
import { AgentValueScreen } from './AgentValueScreen';

export function AgentValue4_Leaderboard() {
  return (
    <AgentValueScreen
      icon="trophy-outline"
      iconColor="#2E7D32"
      lottieSource={{ uri: 'file:///Users/chrishabib/Downloads/Leaderboard.json' }}
      lottieSize={190}
      topPadding={16}
      title="See the best agents from around the world"
      subtitle="View a global leaderboard of top-performing agents. Copy their strategies, follow their picks, and learn from the best."

    />
  );
}
