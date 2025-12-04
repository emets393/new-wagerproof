import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Keyboard } from 'react-native';
import { useTheme } from 'react-native-paper';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWagerBotChatSheet } from '@/contexts/WagerBotChatSheetContext';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeContext } from '@/contexts/ThemeContext';
import WagerBotChat from '@/components/WagerBotChat';
import { fetchAndFormatGameContext } from '@/services/gameDataService';

export function WagerBotChatBottomSheet() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { closeChatSheet, bottomSheetRef } = useWagerBotChatSheet();
  const { user } = useAuth();
  const snapPoints = useMemo(() => ['92%'], []);
  
  const [gameContext, setGameContext] = useState<string>('');
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const chatRef = useRef<any>(null);
  const hasLoadedContext = useRef(false);

  // Log when mounted
  useEffect(() => {
    console.log('🟢 WagerBotChatBottomSheet MOUNTED');
    console.log('🟢 bottomSheetRef from context:', bottomSheetRef);
    console.log('🟢 bottomSheetRef.current:', bottomSheetRef.current);
    return () => {
      console.log('🔴 WagerBotChatBottomSheet UNMOUNTED');
    };
  }, []);

  // Load game context when sheet opens
  const handleSheetChange = (index: number) => {
    console.log('🟡 handleSheetChange called, index:', index);
    if (index >= 0 && !hasLoadedContext.current && user) {
      hasLoadedContext.current = true;
      loadGameContext();
    }
  };

  const loadGameContext = async () => {
    try {
      setIsLoadingContext(true);
      setContextError(null);
      console.log('🔄 Loading game context for WagerBot...');
      
      const context = await fetchAndFormatGameContext();
      setGameContext(context);
      
      console.log('✅ Game context loaded successfully');
      
      if (!context || context.length === 0) {
        console.warn('⚠️ WARNING: Game context is empty! AI will not have game data.');
        setContextError('No game data available at this time.');
      }
    } catch (error) {
      console.error('❌ Error loading game context:', error);
      setContextError('Failed to load game data. Chat will work without game context.');
    } finally {
      setIsLoadingContext(false);
    }
  };

  // Reset context loading flag when user changes
  useEffect(() => {
    if (user) {
      hasLoadedContext.current = false;
    }
  }, [user]);

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0.7}
    />
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={closeChatSheet}
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {!user ? (
          <View style={[styles.loginPrompt, { backgroundColor: theme.colors.background }]}>
            <MaterialCommunityIcons name="account-lock" size={60} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.loginText, { color: theme.colors.onSurface }]}>
              Please sign in to use WagerBot
            </Text>
          </View>
        ) : (
          <>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
              <View style={styles.headerLeft}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                  WagerBot
                </Text>
                {/* Game Data Indicator */}
                {!isLoadingContext && (
                  <TouchableOpacity
                    onPress={() => {
                      const hasData = gameContext && gameContext.length > 0;
                      const title = hasData ? 'Game Data Active' : 'No Game Data';
                      const message = hasData 
                        ? 'I have access to today\'s betting lines, predictions, and game data!'
                        : 'No games available for today. I can still help with general betting questions.';
                      Alert.alert(title, message);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <View style={[
                      styles.dataIndicator,
                      { backgroundColor: gameContext && gameContext.length > 0 ? '#22c55e' : '#94a3b8' }
                    ]} />
                  </TouchableOpacity>
                )}
                {isLoadingContext && (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                )}
              </View>
              
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
                <TouchableOpacity 
                  onPress={closeChatSheet}
                  style={styles.headerIcon}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurface} />
                </TouchableOpacity>
              </View>
            </View>
            
            {contextError && (
              <Text style={[styles.contextWarning, { color: theme.colors.error }]}>
                {contextError}
              </Text>
            )}

            {/* Chat Component */}
            <View style={[styles.chatContainer, { marginBottom: insets.bottom }]}>
              <WagerBotChat
                ref={chatRef}
                userId={user.id}
                userEmail={user.email || ''}
                gameContext={gameContext}
                onRefresh={loadGameContext}
                onBack={closeChatSheet}
                isInBottomSheet={true}
                headerHeight={0}
              />
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  dataIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'center',
  },
  chatContainer: {
    flex: 1,
  },
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});

