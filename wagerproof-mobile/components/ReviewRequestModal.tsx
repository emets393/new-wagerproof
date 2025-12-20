import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import { Button } from './ui/Button';

interface ReviewRequestModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function ReviewRequestModal({ visible, onDismiss }: ReviewRequestModalProps) {
  const theme = useTheme();

  const handleYes = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDismiss();

    // Check if the native review dialog is available
    const isAvailable = await StoreReview.isAvailableAsync();
    if (isAvailable) {
      // Trigger the native in-app review dialog
      await StoreReview.requestReview();
    }
  };

  const handleNotNow = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDismiss();
  };

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
          {/* Feedback Request */}
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="message-text-outline"
              size={48}
              color="#4CAF50"
            />
          </View>

          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            Would you leave us some early feedback?
          </Text>

          <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Your feedback helps us build a better app for you!
          </Text>

          <View style={styles.buttonContainer}>
            <Button
              onPress={handleYes}
              fullWidth
              variant="primary"
              style={styles.button}
            >
              Yes, I'd love to!
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
  buttonContainer: {
    gap: 12,
  },
  button: {
    marginBottom: 0,
  },
});
