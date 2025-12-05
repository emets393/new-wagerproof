import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView, Image, Platform } from 'react-native';
import { Button, Modal, Portal, useTheme, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TOP_SPORTSBOOKS, ADDITIONAL_SPORTSBOOKS, getSportsbookByKey } from '@/utils/sportsbookConfig';
import { useThemeContext } from '@/contexts/ThemeContext';
import { BlurView } from 'expo-blur';

interface SportsbookButtonsProps {
  betslipLinks?: Record<string, string> | null;
  compact?: boolean;
}

export function SportsbookButtons({ betslipLinks, compact = false }: SportsbookButtonsProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const [visible, setVisible] = useState(false);

  const showModal = () => setVisible(true);
  const hideModal = () => setVisible(false);

  if (!betslipLinks || Object.keys(betslipLinks).length === 0) {
    return null;
  }

  const handleSportsbookPress = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.error("Don't know how to open URI: " + url);
      }
    } catch (error) {
      console.error("An error occurred", error);
    } finally {
      hideModal();
    }
  };

  // Get available sportsbooks that have links
  const availableLinks = Object.keys(betslipLinks);
  
  // Filter and sort sportsbooks
  const topSportsbooks = TOP_SPORTSBOOKS.filter(sb => availableLinks.includes(sb.key));
  const additionalSportsbooks = ADDITIONAL_SPORTSBOOKS.filter(sb => availableLinks.includes(sb.key));
  
  // If we have links for sportsbooks not in our config (edge case), add them too
  const knownKeys = new Set([...TOP_SPORTSBOOKS, ...ADDITIONAL_SPORTSBOOKS].map(sb => sb.key));
  const unknownSportsbooks = availableLinks
    .filter(key => !knownKeys.has(key))
    .map(key => ({
      key,
      displayName: key.charAt(0).toUpperCase() + key.slice(1),
      isTop5: false
    }));

  const allAvailable = [...topSportsbooks, ...additionalSportsbooks, ...unknownSportsbooks];

  if (allAvailable.length === 0) return null;

  return (
    <View>
      <Button
        mode="contained"
        onPress={showModal}
        contentStyle={{ height: compact ? 32 : 44 }}
        labelStyle={{ 
          fontSize: compact ? 12 : 14, 
          fontWeight: 'bold',
          marginVertical: 0 
        }}
        style={[
          styles.button,
          { backgroundColor: theme.colors.primary }
        ]}
        icon={({ size, color }) => (
          <MaterialCommunityIcons name="ticket-confirmation-outline" size={size} color={color} />
        )}
      >
        Place Bet
      </Button>

      <Portal>
        <Modal
          visible={visible}
          onDismiss={hideModal}
          contentContainerStyle={[
            styles.modalContent,
            { backgroundColor: isDark ? '#1e293b' : 'white' }
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Select Sportsbook
            </Text>
            <TouchableOpacity onPress={hideModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.modalSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            Choose a sportsbook to place this bet
          </Text>

          <ScrollView style={styles.listContainer} contentContainerStyle={{ paddingBottom: 20 }}>
            {allAvailable.map((sb, index) => (
              <TouchableOpacity
                key={sb.key}
                style={[
                  styles.sportsbookItem,
                  { 
                    borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    borderBottomWidth: index === allAvailable.length - 1 ? 0 : 1
                  }
                ]}
                onPress={() => handleSportsbookPress(betslipLinks[sb.key])}
              >
                <View style={styles.sportsbookInfo}>
                  {/* We could add logos here if we had them locally, using MaterialIcons for now as placeholder if needed, but text is fine */}
                  <Text style={[styles.sportsbookName, { color: theme.colors.onSurface }]}>
                    {sb.displayName}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalContent: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    alignSelf: 'center',
    width: '90%',
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  listContainer: {
    maxHeight: 400,
  },
  sportsbookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  sportsbookInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sportsbookName: {
    fontSize: 16,
    fontWeight: '600',
  },
});

