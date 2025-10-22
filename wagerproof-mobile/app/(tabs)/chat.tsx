import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import WagerBotChat from '../../components/WagerBotChat';
import { fetchAndFormatGameContext } from '../../services/gameDataService';

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();

  const [gameContext, setGameContext] = useState<string>('');
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const chatRef = useRef<any>(null);

  // Fetch game data on mount
  useEffect(() => {
    loadGameContext();
  }, []);

  const loadGameContext = async () => {
    try {
      setIsLoadingContext(true);
      setContextError(null);
      console.log('🔄 Loading game context for WagerBot...');
      
      const context = await fetchAndFormatGameContext();
      setGameContext(context);
      
      console.log('✅ Game context loaded successfully');
    } catch (error) {
      console.error('❌ Error loading game context:', error);
      setContextError('Failed to load game data. Chat will work without game context.');
      // Don't block chat from loading - it can still work without context
    } finally {
      setIsLoadingContext(false);
    }
  };

  // Show loading while checking auth
  if (!user) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>
          Loading...
        </Text>
      </View>
    );
  }

  const handleBack = () => {
    // Navigate back to feed
    router.push('/(tabs)/');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Custom Header with Back Button */}
      <View style={[styles.header, { backgroundColor: theme.colors.background, paddingTop: insets.top + 8 }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={28} color={theme.colors.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            WagerBot
          </Text>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              onPress={() => chatRef.current?.toggleHistoryDrawer?.()}
              style={styles.headerIcon}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="history" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => chatRef.current?.clearChat?.()}
              style={styles.headerIcon}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="message-plus-outline" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>
        </View>
        {contextError && (
          <Text style={[styles.contextWarning, { color: theme.colors.error }]}>
            {contextError}
          </Text>
        )}
      </View>

      {/* Chat Component */}
      <View style={styles.chatContainer}>
        <WagerBotChat
          ref={chatRef}
          userId={user.id}
          userEmail={user.email || ''}
          gameContext={gameContext}
          onRefresh={loadGameContext}
          onBack={handleBack}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    padding: 4,
  },
  contextWarning: {
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  chatContainer: {
    flex: 1,
  },
});

