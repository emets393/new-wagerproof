import { useState, useRef, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  WagerBotVoiceService,
  WagerBotVoice,
  WagerBotPersonality,
} from '@/services/wagerBotVoiceService';

const VOICE_STORAGE_KEY = '@wagerbot_voice';
const PERSONALITY_STORAGE_KEY = '@wagerbot_personality';

export function useWagerBotVoice(gameContext?: string) {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<WagerBotVoice>('marin');
  const [selectedPersonality, setSelectedPersonality] = useState<WagerBotPersonality>('friendly');
  const [lastError, setLastError] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);
  const [promptSource, setPromptSource] = useState<'supabase' | 'fallback' | null>(null);
  const [promptText, setPromptText] = useState<string | null>(null);

  const serviceRef = useRef(WagerBotVoiceService.getInstance());
  const gameContextRef = useRef(gameContext);
  gameContextRef.current = gameContext;
  const prefsLoadedRef = useRef(false);

  // Load persisted preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const [storedVoice, storedPersonality] = await Promise.all([
          AsyncStorage.getItem(VOICE_STORAGE_KEY),
          AsyncStorage.getItem(PERSONALITY_STORAGE_KEY),
        ]);
        if (storedVoice) setSelectedVoice(WagerBotVoiceService.normalizeVoice(storedVoice));
        if (storedPersonality) setSelectedPersonality(WagerBotVoiceService.normalizePersonality(storedPersonality));
      } catch {}
      prefsLoadedRef.current = true;
    })();
  }, []);

  const setupCallbacks = useCallback(() => {
    const service = serviceRef.current;

    service.onConnected = () => {
      setIsConnecting(false);
      setIsConnected(true);
      setIsListening(false);
      setIsWaitingForResponse(false);
      setIsSpeaking(false);
      setLastError(null);
      setConnectedAt(new Date());
      setPromptSource(service.promptSource);
      setPromptText(service.promptText);
    };

    service.onDisconnected = () => {
      setIsConnecting(false);
      setIsConnected(false);
      setIsListening(false);
      setIsWaitingForResponse(false);
      setIsSpeaking(false);
      setConnectedAt(null);
    };

    service.onListeningStarted = () => {
      setIsListening(true);
      setIsWaitingForResponse(false);
      setIsSpeaking(false);
      setLastError(null);
    };

    service.onListeningStopped = () => {
      setIsListening(false);
      setIsWaitingForResponse(true);
    };

    service.onProcessingStarted = () => {
      setIsListening(false);
      setIsWaitingForResponse(true);
      setIsSpeaking(false);
    };

    service.onSpeakingStarted = () => {
      setIsListening(false);
      setIsWaitingForResponse(false);
      setIsSpeaking(true);
    };

    service.onSpeakingFinished = () => {
      setIsSpeaking(false);
      setIsWaitingForResponse(false);
    };

    service.onError = (error: string) => {
      setIsConnecting(false);
      setIsListening(false);
      setIsWaitingForResponse(false);
      setIsSpeaking(false);
      setLastError(error);
    };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setIsConnected(false);
    setLastError(null);
    setConnectedAt(null);
    await serviceRef.current.initialize(selectedVoice, selectedPersonality, gameContextRef.current);
  }, [selectedVoice, selectedPersonality]);

  // Initialize on mount (wait for prefs to load)
  useEffect(() => {
    setupCallbacks();

    // Small delay to let persisted preferences load before first connect
    const timeout = setTimeout(() => {
      connect();
    }, 100);

    return () => {
      clearTimeout(timeout);
      serviceRef.current.clearCallbacks();
      serviceRef.current.disconnect();
    };
  }, []);

  const startTalking = useCallback(async () => {
    if (!isConnected || isConnecting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await serviceRef.current.startListening();
  }, [isConnected, isConnecting]);

  const stopTalking = useCallback(async () => {
    if (!isListening) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await serviceRef.current.stopListening();
  }, [isListening]);

  const hangUp = useCallback(async () => {
    Haptics.selectionAsync();
    await serviceRef.current.hangUp();
  }, []);

  const changeVoice = useCallback(async (voice: WagerBotVoice) => {
    const normalized = WagerBotVoiceService.normalizeVoice(voice);
    if (normalized === selectedVoice && isConnected) return;

    Haptics.selectionAsync();
    setSelectedVoice(normalized);
    setIsConnecting(true);
    setLastError(null);

    // Persist preference
    AsyncStorage.setItem(VOICE_STORAGE_KEY, normalized).catch(() => {});

    await serviceRef.current.updateVoice(normalized, gameContextRef.current);
  }, [selectedVoice, isConnected]);

  const changePersonality = useCallback(async (personality: WagerBotPersonality) => {
    const normalized = WagerBotVoiceService.normalizePersonality(personality);
    if (normalized === selectedPersonality && isConnected) return;

    Haptics.selectionAsync();
    setSelectedPersonality(normalized);
    setIsConnecting(true);
    setLastError(null);

    // Persist preference
    AsyncStorage.setItem(PERSONALITY_STORAGE_KEY, normalized).catch(() => {});

    await serviceRef.current.updatePersonality(normalized, gameContextRef.current);
  }, [selectedPersonality, isConnected]);

  return {
    isConnecting,
    isConnected,
    isListening,
    isWaitingForResponse,
    isSpeaking,
    selectedVoice,
    selectedPersonality,
    lastError,
    connectedAt,
    promptSource,
    promptText,
    connect,
    startTalking,
    stopTalking,
    hangUp,
    changeVoice,
    changePersonality,
  };
}
