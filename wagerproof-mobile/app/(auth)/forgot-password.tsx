import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { AuthContainer } from '@/components/ui/AuthContainer';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { useAuth } from '@/contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { sendPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validateEmail = () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return false;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return false;
    }
    return true;
  };

  const handleSendReset = async () => {
    setError('');
    
    if (!validateEmail()) {
      return;
    }

    try {
      setLoading(true);
      const { error: resetError } = await sendPasswordReset(email.trim());
      
      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.back();
  };

  if (success) {
    return (
      <AuthContainer>
        <View style={styles.successContainer}>
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons
              name="email-check"
              size={64}
              color={theme.colors.primary}
            />
          </View>
          
          <Text style={[styles.successTitle, { color: theme.colors.onSurface }]}>
            Check Your Email
          </Text>
          
          <Text style={[styles.successMessage, { color: theme.colors.onSurfaceVariant }]}>
            We've sent a password reset link to:
          </Text>
          
          <Text style={[styles.emailText, { color: theme.colors.primary }]}>
            {email}
          </Text>
          
          <Text style={[styles.successMessage, { color: theme.colors.onSurfaceVariant }]}>
            Please check your email and follow the instructions to reset your password.
          </Text>

          <View style={styles.infoBox}>
            <MaterialCommunityIcons
              name="information"
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
            <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
              If you don't see the email, check your spam folder.
            </Text>
          </View>

          <Button
            onPress={handleBackToLogin}
            fullWidth
            icon="arrow-left"
          >
            Back to Login
          </Button>
        </View>
      </AuthContainer>
    );
  }

  return (
    <AuthContainer>
      <TouchableOpacity
        onPress={handleBackToLogin}
        style={styles.backButton}
        disabled={loading}
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={24}
          color={theme.colors.primary}
        />
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons
            name="lock-reset"
            size={48}
            color={theme.colors.primary}
          />
        </View>
        
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Forgot Password?
        </Text>
        
        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          No worries! Enter your email and we'll send you a link to reset your password.
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          label="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError('');
          }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          icon="email"
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

        <Button
          onPress={handleSendReset}
          loading={loading}
          disabled={loading}
          fullWidth
        >
          Send Reset Link
        </Button>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
          Remember your password?{' '}
        </Text>
        <TouchableOpacity
          onPress={handleBackToLogin}
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
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 16,
    marginLeft: -8,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
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
  successContainer: {
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    marginVertical: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

