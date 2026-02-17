import React from 'react';
import { AgentValueScreen } from './AgentValueScreen';

export function AgentValue3_MultipleStrategies() {
  return (
    <AgentValueScreen
      icon="account-group-outline"
      iconColor="#69F0AE"
      lottieSource={{ uri: 'file:///Users/chrishabib/Downloads/Robot Analyzing.json' }}
      lottieSize={190}
      topPadding={16}
      title="Create multiple agents with different strategies"

      bullets={[
        { icon: 'strategy', text: 'Test different approaches simultaneously' },
        { icon: 'swap-horizontal', text: 'Compare strategies head-to-head' },
        { icon: 'chart-box-outline', text: 'Track performance for each agent' },
      ]}
    />
  );
}
