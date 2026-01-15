import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { SwipeToDeleteSlider } from '@/components/SwipeToDeleteSlider';
import { TouchableOpacity } from 'react-native-gesture-handler';

export default function DeleteAccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deleteAccount, deletingAccount, signingOut } = useAuth();
  const [sliderKey, setSliderKey] = useState(0);

  const handleDeleteAccountSlide = () => {
    // Show confirmation alert after slide completes
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            // Reset slider by changing key
            setSliderKey(prev => prev + 1);
          },
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteAccount();
            if (error) {
              Alert.alert(
                'Error',
                error.message || 'Failed to delete account. Please try again.',
                [{ text: 'OK' }]
              );
              // Reset slider
              setSliderKey(prev => prev + 1);
            }
            // On success, user will be logged out automatically
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={['rgba(239, 68, 68, 0.15)', 'transparent']}
        style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons name="close" size={28} color={theme.colors.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.error }]}>
            Danger Zone
          </Text>
          <View style={{ width: 28 }} />
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Icon */}
        <View style={[styles.iconCircle, { backgroundColor: `${theme.colors.error}20` }]}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={56}
            color={theme.colors.error}
          />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Delete Your Account
        </Text>

        {/* Description */}
        <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          Permanently delete your account and all associated data including your picks, 
          settings, and subscription. This action cannot be undone.
        </Text>

        {/* Warning Box */}
        <View style={[styles.warningBox, { backgroundColor: `${theme.colors.error}10`, borderColor: `${theme.colors.error}30` }]}>
          <MaterialCommunityIcons
            name="information"
            size={22}
            color={theme.colors.error}
          />
          <Text style={[styles.warningText, { color: theme.colors.error }]}>
            You will be logged out immediately and your data will be permanently erased.
          </Text>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Slider or Loading */}
        {deletingAccount ? (
          <View style={styles.deletingContainer}>
            <ActivityIndicator size="large" color={theme.colors.error} />
            <Text style={[styles.deletingText, { color: theme.colors.error }]}>
              Deleting account...
            </Text>
          </View>
        ) : (
          <SwipeToDeleteSlider
            key={sliderKey}
            onSlideComplete={handleDeleteAccountSlide}
            disabled={signingOut || deletingAccount}
          />
        )}

        {/* Bottom padding */}
        <View style={{ height: insets.bottom + 24 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  deletingContainer: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  deletingText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

