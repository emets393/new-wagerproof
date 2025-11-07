/**
 * Check if we're in development mode
 */
const isDevelopment = (): boolean => {
  return import.meta.env.DEV;
};

/**
 * Debug console that only logs in development mode
 * This prevents sensitive information (like RevenueCat data) from being exposed to users in production
 */
export const debug = {
  log: (...args: any[]) => {
    if (isDevelopment()) {
      console.log(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment()) {
      console.info(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment()) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (isDevelopment()) {
      console.error(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment()) {
      console.debug(...args);
    }
  },
  
  table: (...args: any[]) => {
    if (isDevelopment()) {
      console.table(...args);
    }
  },
  
  group: (...args: any[]) => {
    if (isDevelopment()) {
      console.group(...args);
    }
  },
  
  groupEnd: () => {
    if (isDevelopment()) {
      console.groupEnd();
    }
  },
  
  groupCollapsed: (...args: any[]) => {
    if (isDevelopment()) {
      console.groupCollapsed(...args);
    }
  },
};

// For backwards compatibility and easier migration
export default debug;

