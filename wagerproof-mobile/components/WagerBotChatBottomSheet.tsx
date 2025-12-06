import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Keyboard, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AndroidBlurView } from '@/components/AndroidBlurView';
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
  const snapPoints = useMemo(() => ['95%'], []);
  
  const [gameContext, setGameContext] = useState<string>('');
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const chatRef = useRef<any>(null);
  const hasLoadedContext = useRef(false);
  const hasEnsuredFullHeight = useRef(false);

  // Load game context when sheet opens
  const handleSheetChange = (index: number) => {
    if (index >= 0 && !hasLoadedContext.current && user) {
      hasLoadedContext.current = true;
      loadGameContext();
    }
    // Ensure sheet opens to full height on first open
    if (index >= 0 && !hasEnsuredFullHeight.current && bottomSheetRef.current) {
      hasEnsuredFullHeight.current = true;
      // Small delay to ensure layout is complete
      setTimeout(() => {
        bottomSheetRef.current?.snapToIndex(0);
      }, 100);
    }
    // Reset flag when sheet closes
    if (index < 0) {
      hasEnsuredFullHeight.current = false;
    }
  };

  const loadGameContext = async () => {
    try {
      setIsLoadingContext(true);
      setContextError(null);
      
      const context = await fetchAndFormatGameContext();
      setGameContext(context);
      
      if (!context || context.length === 0) {
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
      backgroundStyle={{ backgroundColor: 'transparent' }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enableDynamicSizing={false}
    >
      <AndroidBlurView
        intensity={100}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.blurContainer,
          !isDark && { backgroundColor: 'rgba(255, 255, 255, 0.7)' }
        ]}
      >
        {!user ? (
          <View style={styles.loginPrompt}>
            <MaterialCommunityIcons name="account-lock" size={60} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.loginText, { color: theme.colors.onSurface }]}>
              Please sign in to use WagerBot
            </Text>
          </View>
        ) : (
          <View style={styles.contentWrapper}>
          {/* Fixed Header */}
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

          {/* Scrollable Chat Content */}
          <View style={styles.chatContainer}>
            <WagerBotChat
              ref={chatRef}
              userId={user.id}
              userEmail={user.email || ''}
              gameContext={gameContext}
              onRefresh={loadGameContext}
              onBack={closeChatSheet}
              headerHeight={0}
            />
          </View>
        </View>
        )}
      </AndroidBlurView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  contentWrapper: {
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
    minHeight: 0,
    overflow: 'hidden',
  },
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'transparent',
  },
  loginText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});

