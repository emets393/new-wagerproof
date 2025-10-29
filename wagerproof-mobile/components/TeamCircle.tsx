import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getNFLTeamColors, getTeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { LinearGradient } from 'expo-linear-gradient';

interface TeamCircleProps {
  teamCity: string;
  size?: 'small' | 'medium' | 'large';
  showGradient?: boolean;
}

export const TeamCircle: React.FC<TeamCircleProps> = ({ 
  teamCity, 
  size = 'medium',
  showGradient = true 
}) => {
  const colors = getNFLTeamColors(teamCity);
  const initials = getTeamInitials(teamCity);
  const textColor = getContrastingTextColor(colors.primary, colors.secondary);

  const sizeMap = {
    small: { container: 40, text: 12 },
    medium: { container: 60, text: 16 },
    large: { container: 80, text: 20 },
  };

  const dimensions = sizeMap[size];

  if (!showGradient) {
    return (
      <View 
        style={[
          styles.circle, 
          { 
            width: dimensions.container, 
            height: dimensions.container, 
            borderRadius: dimensions.container / 2,
            backgroundColor: colors.primary 
          }
        ]}
      >
        <Text style={[styles.initials, { fontSize: dimensions.text, color: textColor }]}>
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[colors.primary, colors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.circle, 
        { 
          width: dimensions.container, 
          height: dimensions.container, 
          borderRadius: dimensions.container / 2 
        }
      ]}
    >
      <Text style={[styles.initials, { fontSize: dimensions.text, color: textColor }]}>
        {initials}
      </Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  initials: {
    fontWeight: 'bold',
  },
});

