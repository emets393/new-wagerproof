import React from 'react';
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AuthContainerProps {
  children: React.ReactNode;
  showLogo?: boolean;
}

export function AuthContainer({ children, showLogo = true }: AuthContainerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {showLogo && (
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/wagerproof-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        )}
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 24,
  },
  content: {
    width: '100%',
  },
});

