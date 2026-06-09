import { NativeModules, Platform } from 'react-native';

const { AudioRouteModule } = NativeModules;

export type AudioRoutePortInfo = {
  portType: string;
  portName: string;
};

export type AudioRouteDebugInfo = {
  category: string;
  mode: string;
  categoryOptions: string[];
  outputs: AudioRoutePortInfo[];
  inputs: AudioRoutePortInfo[];
  speakerLockEnabled: boolean;
  speakerPreferred: boolean;
  isSpeakerOutput: boolean;
};

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

/**
 * Return the current iOS audio route, category, mode, and routing flags.
 * Helpful for debugging whether audio is actually on speaker or receiver.
 */
export async function getAudioRouteDebugInfo(): Promise<AudioRouteDebugInfo | null> {
  if (Platform.OS !== 'ios' || !AudioRouteModule?.getRouteDebugInfo) return null;
  return await AudioRouteModule.getRouteDebugInfo();
}
