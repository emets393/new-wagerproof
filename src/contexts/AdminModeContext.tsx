import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useIsAdmin } from '@/hooks/useIsAdmin';

interface AdminModeContextType {
  adminModeEnabled: boolean;
  toggleAdminMode: () => void;
  canEnableAdminMode: boolean;
}

const AdminModeContext = createContext<AdminModeContextType | undefined>(undefined);

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading } = useIsAdmin();
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);

  // Load admin mode state from localStorage on mount
  useEffect(() => {
    if (isAdmin) {
      const savedState = localStorage.getItem('wagerproof_admin_mode');
      if (savedState === 'true') {
        setAdminModeEnabled(true);
      }
    } else {
      // If user is not admin, ensure admin mode is disabled
      setAdminModeEnabled(false);
      localStorage.removeItem('wagerproof_admin_mode');
    }
  }, [isAdmin]);

  const toggleAdminMode = () => {
    if (!isAdmin) {
      console.warn('Cannot enable admin mode: user is not an admin');
      return;
    }

    const newState = !adminModeEnabled;
    setAdminModeEnabled(newState);
    localStorage.setItem('wagerproof_admin_mode', String(newState));
  };

  return (
    <AdminModeContext.Provider
      value={{
        adminModeEnabled: isAdmin && adminModeEnabled,
        toggleAdminMode,
        canEnableAdminMode: isAdmin,
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

