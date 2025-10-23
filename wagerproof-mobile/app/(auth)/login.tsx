import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Image, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { AuthContainer } from '@/components/ui/AuthContainer';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';

const { width: screenWidth } = Dimensions.get('window');

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signInWithProvider } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      const { error: oauthError } = await signInWithProvider('google');
      
      if (oauthError) {
        setError(oauthError.message);
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setError('Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    try {
      router.push('/(auth)/email-login');
    } catch (err: any) {
      console.error('Email navigation error:', err);
      setError('Failed to navigate to email login');
    }
  };

  // Phone mockup dimensions - smaller size with reduced padding
  const phoneWidth = Math.min(screenWidth - 32, 240);
  const phoneHeight = phoneWidth * 2.165; // iPhone aspect ratio

  return (
    <AuthContainer showLogo={false}>
      <View style={styles.container}>
        {/* Phone Mockup with Video */}
        <View style={styles.phoneContainer}>
          <View 
            style={[
              styles.phoneMockup,
              { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline,
                width: phoneWidth,
                height: phoneHeight,
              }
            ]}
          >
            {/* Video content */}
            <View style={styles.videoContainer}>
              <Image
                source={require('@/assets/wagerproof.gif')}
                style={styles.video}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* Phone shadow */}
          <View 
            style={[
              styles.phoneShadow,
              { width: phoneWidth }
            ]}
          />
        </View>

        {/* Welcome Banner - Overlapping */}
        <View
          style={[
            styles.welcomeBanner,
            { 
              backgroundColor: theme.colors.primaryContainer,
              width: Math.min(screenWidth - 32, 240),
            }
          ]}
        >
          <Text style={[styles.welcomeText, { color: theme.colors.onPrimaryContainer }]}>
            Welcome to WagerProof
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            onPress={handleGoogleSignIn}
            variant="glass"
            icon="google"
            disabled={loading}
            fullWidth
          >
            Continue with Google
          </Button>

          <Button
            onPress={handleEmailSignIn}
            variant="glass"
            icon="email"
            disabled={loading}
            fullWidth
            style={styles.emailButton}
          >
            Continue with Email
          </Button>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
            By continuing, you agree to our{' '}
            <Text style={[styles.footerLink, { color: theme.colors.primary }]}>
              Terms of Service
            </Text>
          </Text>
        </View>
      </View>
    </AuthContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  phoneContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 0,
    width: '100%',
    marginBottom: 0,
  },
  phoneMockup: {
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 8,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
  },
  videoContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  phoneShadow: {
    height: 8,
    borderRadius: 50,
    marginTop: -4,
    opacity: 0.2,
  },
  welcomeBanner: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: -40,
    marginBottom: 24,
    zIndex: 10,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  emailButton: {
    marginTop: 0,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  footerLink: {
    fontWeight: '600',
  },
});
