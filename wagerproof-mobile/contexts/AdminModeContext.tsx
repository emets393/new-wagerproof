import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsAdmin } from '@/hooks/useIsAdmin';

interface AdminModeContextType {
  adminModeEnabled: boolean;
  toggleAdminMode: () => void;
  canEnableAdminMode: boolean;
  isAdminLoading: boolean;
}

const AdminModeContext = createContext<AdminModeContextType | undefined>(undefined);

const ADMIN_MODE_KEY = 'wagerproof_admin_mode';

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading } = useIsAdmin();
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);

  // Load admin mode state from AsyncStorage on mount
  useEffect(() => {
    const loadAdminModeState = async () => {
      if (isAdmin) {
        try {
          const savedState = await AsyncStorage.getItem(ADMIN_MODE_KEY);
          if (savedState === 'true') {
            setAdminModeEnabled(true);
          }
        } catch (error) {
          console.error('Error loading admin mode state:', error);
        }
      } else {
        // If user is not admin, ensure admin mode is disabled
        setAdminModeEnabled(false);
        try {
          await AsyncStorage.removeItem(ADMIN_MODE_KEY);
        } catch (error) {
          console.error('Error removing admin mode state:', error);
        }
      }
    };

    if (!isLoading) {
      loadAdminModeState();
    }
  }, [isAdmin, isLoading]);

  const toggleAdminMode = async () => {
    if (!isAdmin) {
      console.warn('Cannot enable admin mode: user is not an admin');
      return;
    }

    const newState = !adminModeEnabled;
    setAdminModeEnabled(newState);

    try {
      await AsyncStorage.setItem(ADMIN_MODE_KEY, String(newState));
    } catch (error) {
      console.error('Error saving admin mode state:', error);
    }
  };

  return (
    <AdminModeContext.Provider
      value={{
        adminModeEnabled: isAdmin && adminModeEnabled,
        toggleAdminMode,
        canEnableAdminMode: isAdmin,
        isAdminLoading: isLoading,
      }}
    >
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  const context = useContext(AdminModeContext);
  if (context === undefined) {
    throw new Error('useAdminMode must be used within an AdminModeProvider');
  }
  return context;
}
