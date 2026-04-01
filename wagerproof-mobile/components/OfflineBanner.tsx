import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkState } from '../hooks/useNetworkState';

/**
 * Persistent offline banner that appears at the top of the app
 * when the device loses connectivity. Auto-dismisses when online.
 */
export function OfflineBanner() {
  const { isConnected, isInternetReachable, isSlowConnection } = useNetworkState();
  const theme = useTheme();
  const translateY = useRef(new Animated.Value(-60)).current;
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isOffline = !isConnected;
  const isUnreachable = isConnected && isInternetReachable === false;
  const shouldShow = (isOffline || isUnreachable) && !dismissed;

  useEffect(() => {
    if (shouldShow) {
      setVisible(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: -60,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [shouldShow, translateY]);

  // Reset dismissed state when connection recovers
  useEffect(() => {
    if (isConnected && isInternetReachable) {
      setDismissed(false);
    }
  }, [isConnected, isInternetReachable]);

  if (!visible) return null;

  const message = isOffline
    ? 'No internet connection — showing cached data'
    : 'Connected but internet unreachable';

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }], backgroundColor: isOffline ? '#b91c1c' : '#d97706' },
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={isOffline ? 'cloud-offline-outline' : 'warning-outline'}
          size={16}
          color="#fff"
          style={styles.icon}
        />
        <Text style={styles.text}>{message}</Text>
        <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={8}>
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingTop: 50, // Account for status bar
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
