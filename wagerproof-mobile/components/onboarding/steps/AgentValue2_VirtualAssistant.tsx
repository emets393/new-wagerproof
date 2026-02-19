import React from 'react';
import { AgentValueScreen } from './AgentValueScreen';

export function AgentValue2_VirtualAssistant() {
  return (
    <AgentValueScreen
      icon="head-lightbulb-outline"
      iconColor="#00C853"
      lottieSource={require('@/assets/ChattingRobot.json')}
      lottieSize={190}
      topPadding={16}
      title="Like having a full-time employee"
      subtitle="Your agent learns your style, your preferences, and your risk tolerance — then researches the best picks for you."
      bullets={[
        { icon: 'account-cog-outline', text: 'Tuned to your betting personality' },
        { icon: 'chart-timeline-variant', text: 'Powered by real model data and odds' },
     
      ]}
    />
  );
}
