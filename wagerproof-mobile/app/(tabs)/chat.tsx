import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme, Card, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background, paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="robot" size={32} color={theme.colors.primary} />
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            WagerBot Chat
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 65 + insets.bottom + 20 }]}>
        <Card style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Card.Content style={styles.cardContent}>
            <MaterialCommunityIcons 
              name="chat-processing" 
              size={80} 
              color={theme.colors.primary} 
              style={styles.icon}
            />
            <Text style={[styles.comingSoonText, { color: theme.colors.onSurface }]}>
              Coming Soon
            </Text>
            <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
              WagerBot AI chat will help you analyze games, get insights, and make informed betting decisions.
            </Text>
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.primary} />
                <Text style={[styles.featureText, { color: theme.colors.onSurfaceVariant }]}>
                  Real-time game analysis
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.primary} />
                <Text style={[styles.featureText, { color: theme.colors.onSurfaceVariant }]}>
                  Betting insights & recommendations
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.primary} />
                <Text style={[styles.featureText, { color: theme.colors.onSurfaceVariant }]}>
                  Historical data queries
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.primary} />
                <Text style={[styles.featureText, { color: theme.colors.onSurfaceVariant }]}>
                  Streamed AI responses
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    elevation: 4,
  },
  cardContent: {
    padding: 24,
    alignItems: 'center',
  },
  icon: {
    marginBottom: 16,
  },
  comingSoonText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  featuresList: {
    alignSelf: 'stretch',
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
  },
});

