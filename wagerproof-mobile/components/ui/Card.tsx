import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  selected?: boolean;
  style?: ViewStyle;
}

export function Card({ children, onPress, selected = false, style }: CardProps) {
  const theme = useTheme();
  const isAndroid = Platform.OS === 'android';

  const cardStyle = [
    styles.card,
    {
      backgroundColor: selected
        ? 'rgba(34, 197, 94, 0.15)'
        : 'rgba(255, 255, 255, 0.06)',
      borderColor: selected
        ? '#22c55e'
        : 'rgba(255, 255, 255, 0.1)',
      // Only apply shadows on iOS - Android renders square artifacts with transparent backgrounds
      ...(isAndroid ? {} : {
        shadowColor: selected ? '#22c55e' : 'transparent',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: selected ? 0.2 : 0,
        shadowRadius: selected ? 8 : 0,
        elevation: selected ? 4 : 0,
      }),
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity 
        style={cardStyle} 
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
  },
});

