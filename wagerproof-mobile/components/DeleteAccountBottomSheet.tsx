import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useDeleteAccountSheet } from '@/contexts/DeleteAccountSheetContext';
import { SwipeToDeleteSlider } from '@/components/SwipeToDeleteSlider';
import { AndroidBlurView } from '@/components/AndroidBlurView';

export function DeleteAccountBottomSheet() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { bottomSheetRef, closeDeleteAccountSheet } = useDeleteAccountSheet();
  const { deleteAccount, deletingAccount, signingOut } = useAuth();
  const [sliderKey, setSliderKey] = useState(0);
  const snapPoints = useMemo(() => ['50%'], []);

  useEffect(() => {
    console.log('🗑️ DeleteAccountBottomSheet mounted');
    console.log('🗑️ bottomSheetRef:', bottomSheetRef);
    console.log('🗑️ bottomSheetRef.current:', bottomSheetRef.current);
  }, []);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      // Reset slider when sheet closes
      setSliderKey(prev => prev + 1);
    }
  }, []);

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
            } else {
              // On success, close the sheet - user will be logged out automatically
              closeDeleteAccountSheet();
            }
          },
        },
      ]
    );
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
      />
    ),
    []
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: 'transparent' }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
    >
      <AndroidBlurView
        intensity={100}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.blurContainer,
          !isDark && { backgroundColor: 'rgba(255, 255, 255, 0.9)' }
        ]}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: `${theme.colors.error}20` }]}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={32}
                color={theme.colors.error}
              />
            </View>
            <Text style={[styles.title, { color: theme.colors.error }]}>
              Danger Zone
            </Text>
          </View>

          {/* Description */}
          <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
            Permanently delete your account and all associated data including your picks, 
            settings, and subscription. This action cannot be undone.
          </Text>

          {/* Warning Box */}
          <View style={[styles.warningBox, { backgroundColor: `${theme.colors.error}15`, borderColor: `${theme.colors.error}30` }]}>
            <MaterialCommunityIcons
              name="information"
              size={20}
              color={theme.colors.error}
            />
            <Text style={[styles.warningText, { color: theme.colors.error }]}>
              You will be logged out immediately and your data will be permanently erased.
            </Text>
          </View>

          {/* Slider or Loading */}
          {deletingAccount ? (
            <View style={styles.deletingContainer}>
              <ActivityIndicator size="small" color={theme.colors.error} />
              <Text style={[styles.deletingText, { color: theme.colors.error }]}>
                Deleting account...
              </Text>
            </View>
          ) : (
            <View style={styles.sliderContainer}>
              <SwipeToDeleteSlider
                key={sliderKey}
                onSlideComplete={handleDeleteAccountSlide}
                disabled={signingOut || deletingAccount}
              />
            </View>
          )}
        </View>
      </AndroidBlurView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  deletingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  deletingText: {
    fontSize: 14,
  },
  sliderContainer: {
    marginTop: 'auto',
  },
});
