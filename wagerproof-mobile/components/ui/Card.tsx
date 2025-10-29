import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from 'react-native-paper';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  selected?: boolean;
  style?: ViewStyle;
}

export function Card({ children, onPress, selected = false, style }: CardProps) {
  const theme = useTheme();

  const cardStyle = [
    styles.card,
    {
      backgroundColor: selected 
        ? 'rgba(255, 255, 255, 0.25)' // Brighter glassmorphism when selected
        : 'rgba(255, 255, 255, 0.1)',
      borderColor: selected 
        ? 'rgba(255, 255, 255, 0.5)' // Brighter border when selected
        : 'rgba(255, 255, 255, 0.2)',
      shadowColor: selected ? '#fff' : 'transparent',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: selected ? 0.3 : 0,
      shadowRadius: selected ? 8 : 0,
      elevation: selected ? 4 : 0,
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

