import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'social' | 'glass';

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  fullWidth?: boolean;
  selected?: boolean;
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
  selected = false,
  style,
}: ButtonProps) {
  const theme = useTheme();

  const getButtonStyle = () => {
    const baseStyle = [styles.button, fullWidth && styles.fullWidth];

    let variantStyle;
    switch (variant) {
      case 'primary':
        variantStyle = { backgroundColor: theme.colors.primary };
        break;
      case 'glass':
        variantStyle = selected ? styles.glassSelected : styles.glass;
        break;
      case 'outline':
        variantStyle = {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: theme.colors.primary,
        };
        break;
      case 'ghost':
        variantStyle = { backgroundColor: 'transparent' };
        break;
      case 'social':
        variantStyle = {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.outline,
        };
        break;
      default:
        variantStyle = {};
    }

    return [...baseStyle, variantStyle, style];
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return [styles.text, { color: theme.colors.onPrimary }];
      case 'glass':
        return [styles.text, { color: '#ffffff' }];
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
      case 'glass':
        return '#ffffff';
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
            color={variant === 'primary' || variant === 'glass' ? '#ffffff' : theme.colors.primary}
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
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  glassSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
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

