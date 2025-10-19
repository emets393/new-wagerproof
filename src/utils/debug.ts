import { supabase } from '@/integrations/supabase/client';

/**
 * Checks if a user is currently logged in
 */
const isUserLoggedIn = async (): Promise<boolean> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session?.user;
  } catch {
    return false;
  }
};

/**
 * Synchronous check for logged in status using cached session
 */
const isUserLoggedInSync = (): boolean => {
  try {
    // Check if there's a session in localStorage (Supabase stores it there)
    // The key format is: sb-{project-ref}-auth-token
    const storageKey = 'sb-gnjrklxotmbvnxbnnqgq-auth-token';
    const item = localStorage.getItem(storageKey);
    if (!item) return false;
    
    const session = JSON.parse(item);
    // Check if session exists and hasn't expired
    if (!session?.access_token || !session?.user) return false;
    
    // Check expiration if present
    if (session.expires_at) {
      const expiresAt = session.expires_at * 1000; // Convert to milliseconds
      if (Date.now() >= expiresAt) return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

/**
 * Debug console that only logs when user is authenticated
 */
export const debug = {
  log: (...args: any[]) => {
    if (isUserLoggedInSync()) {
      console.log(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isUserLoggedInSync()) {
      console.info(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isUserLoggedInSync()) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (isUserLoggedInSync()) {
      console.error(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isUserLoggedInSync()) {
      console.debug(...args);
    }
  },
  
  table: (...args: any[]) => {
    if (isUserLoggedInSync()) {
      console.table(...args);
    }
  },
  
  group: (...args: any[]) => {
    if (isUserLoggedInSync()) {
      console.group(...args);
    }
  },
  
  groupEnd: () => {
    if (isUserLoggedInSync()) {
      console.groupEnd();
    }
  },
  
  groupCollapsed: (...args: any[]) => {
    if (isUserLoggedInSync()) {
      console.groupCollapsed(...args);
    }
  },
};

// For backwards compatibility and easier migration
export default debug;

