import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsContextType {
  useDummyData: boolean;
  setUseDummyData: (value: boolean) => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEY = '@wagerproof_settings';

interface Settings {
  useDummyData: boolean;
}

const defaultSettings: Settings = {
  useDummyData: true, // Default to dummy data for testing
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [useDummyData, setUseDummyDataState] = useState(defaultSettings.useDummyData);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from storage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const settings: Settings = JSON.parse(stored);
        setUseDummyDataState(settings.useDummyData ?? defaultSettings.useDummyData);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setUseDummyData = async (value: boolean) => {
    try {
      setUseDummyDataState(value);
      const settings: Settings = { useDummyData: value };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  return (
    <SettingsContext.Provider value={{ useDummyData, setUseDummyData, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

