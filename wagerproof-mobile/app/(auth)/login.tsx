import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Image, Dimensions, Animated } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { AuthContainer } from '@/components/ui/AuthContainer';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';

const { width: screenWidth } = Dimensions.get('window');

const BANNER_TEXTS = [
  'Welcome to WagerProof',
  'AI Betting Analysis',
  'Private Discord Chat',
  'Expert Picks',
  'Pro Data Models'
];

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signInWithProvider } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const slideAnim = React.useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    const interval = setInterval(() => {
      // Slide out (left) with spring
      Animated.spring(slideAnim, {
        toValue: -400,
        damping: 20,
        mass: 1,
        stiffness: 100,
        overshootClamping: true,
        useNativeDriver: true,
      }).start(() => {
        // Update text
        setCurrentTextIndex((prev) => (prev + 1) % BANNER_TEXTS.length);
        
        // Reset position to slide in from right
        slideAnim.setValue(400);
        
        // Slide in (from right to center) with spring
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 15,
          mass: 1,
          stiffness: 120,
          overshootClamping: false,
          useNativeDriver: true,
        }).start();
      });
    }, 4500); // Show each text for 4.5 seconds before transitioning

    return () => clearInterval(interval);
  }, [slideAnim]);

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

        {/* Welcome Banner - Glassmorphic with Blur and Spring Animation */}
        <Animated.View
          style={[
            {
              transform: [{ translateX: slideAnim }],
              width: Math.min(screenWidth - 32, 240),
            },
          ]}
        >
          <BlurView intensity={80} style={styles.blurContainer}>
            <View style={styles.welcomeBanner}>
              <Text style={styles.welcomeText}>
                {BANNER_TEXTS[currentTextIndex]}
              </Text>
            </View>
          </BlurView>
        </Animated.View>

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
  blurContainer: {
    marginTop: -40,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  welcomeBanner: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    color: '#ffffff',
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
