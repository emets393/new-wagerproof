import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from './ui/Button';

interface ReviewRequestModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function ReviewRequestModal({ visible, onDismiss }: ReviewRequestModalProps) {
  const theme = useTheme();
  const [showRating, setShowRating] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);

  const handleLikeApp = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowRating(true);
  };

  const handleNotNow = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDismiss();
  };

  const handleRating = (rating: number) => {
    Haptics.selectionAsync();
    setSelectedRating(rating);
  };

  const handleSubmitReview = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    if (selectedRating >= 4) {
      // Redirect to app store for positive reviews
      await openAppStore();
    } else {
      // Show feedback form for lower ratings
      Alert.alert(
        'We\'d love your feedback',
        'Thank you for your honest rating. Your feedback helps us improve!',
        [
          { text: 'OK', onPress: onDismiss }
        ]
      );
    }
    
    onDismiss();
  };

  const openAppStore = async () => {
    try {
      let storeUrl = '';
      
      if (Platform.OS === 'ios') {
        // Apple App Store URL - IMPORTANT: Replace '1234567890' with your actual iOS app ID
        // Find your app ID at: https://apps.apple.com/app/wagerproof/idXXXXXXXXXX
        storeUrl = 'https://apps.apple.com/app/wagerproof/id1234567890?action=write-review';
      } else if (Platform.OS === 'android') {
        // Google Play Store URL - IMPORTANT: Replace 'com.wagerproof.app' with your actual package name
        // This is typically found in your android/app/build.gradle file
        storeUrl = 'https://play.google.com/store/apps/details?id=com.wagerproof.app&showAllReviews=true';
      }
      
      if (storeUrl && await Linking.canOpenURL(storeUrl)) {
        await Linking.openURL(storeUrl);
      } else {
        // Fallback if URL doesn't work
        Alert.alert(
          'Thank you!',
          'Thank you for your positive feedback! We appreciate your support.'
        );
      }
    } catch (error) {
      Alert.alert(
        'Thank you!',
        'Thank you for your feedback! We appreciate your support.'
      );
    }
  };

  const renderStars = () => (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => handleRating(star)}
          style={styles.starButton}
        >
          <MaterialCommunityIcons
            name={star <= selectedRating ? 'star' : 'star-outline'}
            size={40}
            color={star <= selectedRating ? '#FFD700' : 'rgba(255, 255, 255, 0.4)'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onDismiss}
        />
        
        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
          {/* Close Button */}
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onDismiss}
          >
            <MaterialCommunityIcons 
              name="close" 
              size={24} 
              color={theme.colors.onSurface}
            />
          </TouchableOpacity>

          {!showRating ? (
            <>
              {/* Initial Review Request */}
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons 
                  name="heart" 
                  size={48} 
                  color="#FF6B6B"
                />
              </View>

              <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                Do you love WagerProof?
              </Text>

              <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                We'd love to hear what you think! Your feedback helps us improve the app.
              </Text>

              <View style={styles.buttonContainer}>
                <Button
                  onPress={handleLikeApp}
                  fullWidth
                  variant="primary"
                  style={styles.button}
                >
                  Yes, I love it!
                </Button>

                <Button
                  onPress={handleNotNow}
                  fullWidth
                  variant="outline"
                  style={styles.button}
                >
                  Not now
                </Button>
              </View>
            </>
          ) : (
            <>
              {/* Rating Request */}
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons 
                  name="emoticon-happy" 
                  size={48} 
                  color="#4CAF50"
                />
              </View>

              <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                How would you rate us?
              </Text>

              <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                Your rating helps us know what we're doing right!
              </Text>

              {renderStars()}

              <View style={styles.buttonContainer}>
                <Button
                  onPress={handleSubmitReview}
                  fullWidth
                  variant="primary"
                  disabled={selectedRating === 0}
                  style={styles.button}
                >
                  Submit Review
                </Button>

                <Button
                  onPress={handleNotNow}
                  fullWidth
                  variant="ghost"
                  style={styles.button}
                >
                  Maybe later
                </Button>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    margin: 24,
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 10,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 12,
  },
  starButton: {
    padding: 8,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    marginBottom: 0,
  },
});
