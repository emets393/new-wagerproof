import { NativeModules, Platform } from 'react-native';

const { AudioRouteModule } = NativeModules;

/**
 * Force iOS audio output to the loudspeaker (bottom speaker).
 * Call after WebRTC connects — its PlayAndRecord category defaults to earpiece.
 */
export async function forceToSpeaker(): Promise<void> {
  if (Platform.OS !== 'ios' || !AudioRouteModule) return;
  await AudioRouteModule.forceToSpeaker();
}

/**
 * Reset audio route back to default (removes the speaker override).
 * Call on disconnect so other app audio isn't affected.
 */
export async function resetAudioRoute(): Promise<void> {
  if (Platform.OS !== 'ios' || !AudioRouteModule) return;
  await AudioRouteModule.resetRoute();
}
