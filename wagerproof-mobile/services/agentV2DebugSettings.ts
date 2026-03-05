import AsyncStorage from '@react-native-async-storage/async-storage';

const FORCE_V2_ONLY_KEY = '@wagerproof_agents_v2_force_only';

function toBoolean(value: string | null): boolean {
  return value === 'true';
}

export async function getForceAgentV2Only(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(FORCE_V2_ONLY_KEY);
    return toBoolean(value);
  } catch (error) {
    console.warn('Failed to read agent V2 debug setting:', error);
    return false;
  }
}

export async function setForceAgentV2Only(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(FORCE_V2_ONLY_KEY, String(enabled));
  } catch (error) {
    console.warn('Failed to persist agent V2 debug setting:', error);
    throw error;
  }
}
