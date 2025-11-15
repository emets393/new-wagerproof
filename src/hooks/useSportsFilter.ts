import { useState, useEffect } from 'react';

const STORAGE_KEY = 'wagerproof_sports_filter';

export type SportLeague = 'NFL' | 'NCAAF' | 'NBA' | 'NCAAB' | 'NHL' | 'MLB' | 'MLS' | 'EPL';

export interface SportsFilterSettings {
  [key: string]: boolean;
}

const DEFAULT_FILTERS: SportsFilterSettings = {
  'NFL': true,
  'NCAAF': true,
  'NBA': true,
  'NCAAB': true,
  'NHL': true,
  'MLB': true,
  'MLS': true,
  'EPL': true,
};

/**
 * Hook to manage sports filter preferences
 * Stores preferences in localStorage
 */
export function useSportsFilter() {
  const [filters, setFilters] = useState<SportsFilterSettings>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(true);

  // Load filters from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFilters({ ...DEFAULT_FILTERS, ...parsed });
      }
    } catch (error) {
      console.error('Error loading sports filter settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save filters to localStorage whenever they change
  const updateFilters = (newFilters: SportsFilterSettings) => {
    setFilters(newFilters);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newFilters));
    } catch (error) {
      console.error('Error saving sports filter settings:', error);
    }
  };

  // Toggle a single sport on/off
  const toggleSport = (sport: string) => {
    const newFilters = {
      ...filters,
      [sport]: !filters[sport]
    };
    updateFilters(newFilters);
  };

  // Enable all sports
  const enableAll = () => {
    const allEnabled = Object.keys(filters).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as SportsFilterSettings);
    updateFilters(allEnabled);
  };

  // Disable all sports
  const disableAll = () => {
    const allDisabled = Object.keys(filters).reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, {} as SportsFilterSettings);
    updateFilters(allDisabled);
  };

  // Check if a sport is enabled
  const isSportEnabled = (sport: string): boolean => {
    return filters[sport] !== false; // Default to true if not set
  };

  // Get count of enabled sports
  const enabledCount = Object.values(filters).filter(Boolean).length;
  const totalCount = Object.keys(filters).length;

  return {
    filters,
    isLoading,
    toggleSport,
    enableAll,
    disableAll,
    isSportEnabled,
    enabledCount,
    totalCount,
    allEnabled: enabledCount === totalCount,
    allDisabled: enabledCount === 0,
  };
}

