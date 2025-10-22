import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'social';

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  fullWidth?: boolean;
  style?: any;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
}: ButtonProps) {
  const theme = useTheme();

  const getButtonStyle = () => {
    const baseStyle = [styles.button, fullWidth && styles.fullWidth, style];

    switch (variant) {
      case 'primary':
        return [...baseStyle, { backgroundColor: theme.colors.primary }];
      case 'outline':
        return [
          ...baseStyle,
          {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: theme.colors.primary,
          },
        ];
      case 'ghost':
        return [...baseStyle, { backgroundColor: 'transparent' }];
      case 'social':
        return [
          ...baseStyle,
          {
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.outline,
          },
        ];
      default:
        return baseStyle;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return [styles.text, { color: theme.colors.onPrimary }];
      case 'outline':
      case 'ghost':
        return [styles.text, { color: theme.colors.primary }];
      case 'social':
        return [styles.text, { color: theme.colors.onSurface }];
      default:
        return styles.text;
    }
  };

  const getIconColor = () => {
    switch (variant) {
      case 'primary':
        return theme.colors.onPrimary;
      case 'outline':
      case 'ghost':
        return theme.colors.primary;
      case 'social':
        return theme.colors.onSurface;
      default:
        return theme.colors.onPrimary;
    }
  };

  return (
    <TouchableOpacity
      style={[
        ...getButtonStyle(),
        (disabled || loading) && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? theme.colors.onPrimary : theme.colors.primary}
            style={styles.loader}
          />
        ) : (
          <>
            {icon && (
              <MaterialCommunityIcons
                name={icon}
                size={20}
                color={getIconColor()}
                style={styles.icon}
              />
            )}
            <Text style={getTextStyle()}>{children}</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  icon: {
    marginRight: 8,
  },
  loader: {
    marginRight: 8,
  },
  disabled: {
    opacity: 0.5,
  },
});

