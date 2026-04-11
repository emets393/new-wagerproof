// ChatWidgetRenderer — Routes a ChatWidgetData to the correct mini widget
// component. Wraps in a tappable container for bottom sheet navigation.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { ChatWidgetData } from '../../../types/chatTypes';
import ChatMatchupWidget from './ChatMatchupWidget';
import ChatModelProjectionWidget from './ChatModelProjectionWidget';
import ChatPolymarketWidget from './ChatPolymarketWidget';
import ChatPublicBettingWidget from './ChatPublicBettingWidget';
import ChatInjuryWidget from './ChatInjuryWidget';
import ChatBettingTrendsWidget from './ChatBettingTrendsWidget';
import ChatWeatherWidget from './ChatWeatherWidget';

interface Props {
  widget: ChatWidgetData;
  onPress: (widget: ChatWidgetData) => void;
  isLast?: boolean;
}

function WidgetContent({ widget }: { widget: ChatWidgetData }) {
  switch (widget.widget_type) {
    case 'matchup':
      return <ChatMatchupWidget data={widget.data} sport={widget.sport} />;
    case 'model_projection':
      return <ChatModelProjectionWidget data={widget.data} />;
    case 'polymarket':
      return <ChatPolymarketWidget data={widget.data} />;
    case 'public_betting':
      return <ChatPublicBettingWidget data={widget.data} />;
    case 'injuries':
      return <ChatInjuryWidget data={widget.data} />;
    case 'betting_trends':
      return <ChatBettingTrendsWidget data={widget.data} />;
    case 'weather':
      return <ChatWeatherWidget data={widget.data} />;
    default:
      return null;
  }
}

export default function ChatWidgetRenderer({ widget, onPress, isLast }: Props) {
  return (
    <View>
      <TouchableOpacity
        style={styles.container}
        activeOpacity={0.7}
        onPress={() => onPress(widget)}
      >
        <WidgetContent widget={widget} />
      </TouchableOpacity>
      {/* Analysis text below the last widget in a game group */}
      {isLast && widget.analysis ? (
        <View style={styles.analysisContainer}>
          <Text style={styles.analysisText}>{widget.analysis}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  analysisContainer: {
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 2,
  },
  analysisText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    lineHeight: 19,
  },
});
