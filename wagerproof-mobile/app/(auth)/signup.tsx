import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { AuthContainer } from '@/components/ui/AuthContainer';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signUp, signInWithProvider } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validateForm = () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return false;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return false;
    }
    if (!password) {
      setError('Please enter a password');
      return false;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSignUp = async () => {
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const { error: signUpError } = await signUp(email.trim(), password);

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('An account with this email already exists');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      // Check if user was auto-signed in (happens when email confirmation is disabled)
      // If so, the OnboardingGuard will handle navigation - don't redirect to login
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // User is already signed in - OnboardingGuard will redirect to onboarding
        setSuccess('Account created! Setting up your profile...');
        // Don't navigate - let OnboardingGuard handle it
        return;
      }

      // Email confirmation required - show message and redirect to login
      setSuccess('Account created! Please check your email to verify your account.');

      // Clear form
      setEmail('');
      setPassword('');
      setConfirmPassword('');

      // Navigate to login after 3 seconds
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 3000);
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

  const handleAppleSignIn = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Not Available', 'Apple Sign In is only available on iOS devices');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const { error: oauthError } = await signInWithProvider('apple');
      
      if (oauthError) {
        setError(oauthError.message);
      }
    } catch (err: any) {
      console.error('Apple sign in error:', err);
      setError('Failed to sign in with Apple');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContainer>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Create Account
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Get started with professional sports analytics
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          label="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError('');
            setSuccess('');
          }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          icon="email"
          editable={!loading}
        />

        <TextInput
          label="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError('');
            setSuccess('');
          }}
          placeholder="At least 8 characters"
          secureTextEntry
          icon="lock"
          editable={!loading}
        />

        <TextInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            setError('');
            setSuccess('');
          }}
          placeholder="Re-enter your password"
          secureTextEntry
          icon="lock-check"
          editable={!loading}
        />

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorContainer }]}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={20}
              color={theme.colors.error}
            />
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          </View>
        )}

        {success && (
          <View style={[styles.successContainer, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons
              name="check-circle"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={[styles.successText, { color: theme.colors.primary }]}>
              {success}
            </Text>
          </View>
        )}

        <View style={styles.disclaimer}>
          <MaterialCommunityIcons
            name="information"
            size={16}
            color={theme.colors.onSurfaceVariant}
          />
          <Text style={[styles.disclaimerText, { color: theme.colors.onSurfaceVariant }]}>
            By signing up, you confirm that you are 18+ and understand this platform is for analytics only.
          </Text>
        </View>

        <Button
          onPress={handleSignUp}
          loading={loading}
          disabled={loading || !!success}
          fullWidth
        >
          Create Account
        </Button>

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.outline }]} />
          <Text style={[styles.dividerText, { color: theme.colors.onSurfaceVariant }]}>
            or continue with
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.outline }]} />
        </View>

        <View style={styles.socialButtons}>
          <Button
            onPress={handleGoogleSignIn}
            variant="social"
            icon="google"
            disabled={loading || !!success}
            fullWidth
          >
            Google
          </Button>

          {Platform.OS === 'ios' && (
            <Button
              onPress={handleAppleSignIn}
              variant="social"
              icon="apple"
              disabled={loading || !!success}
              fullWidth
              style={styles.socialButton}
            >
              Apple
            </Button>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
          Already have an account?{' '}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
          disabled={loading}
        >
          <Text style={[styles.footerLink, { color: theme.colors.primary }]}>
            Sign In
          </Text>
        </TouchableOpacity>
      </View>
    </AuthContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 14,
  },
  socialButtons: {
    gap: 12,
  },
  socialButton: {
    marginTop: 0,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});

