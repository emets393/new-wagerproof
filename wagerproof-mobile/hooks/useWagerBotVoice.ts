import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import {
  WagerBotVoiceService,
  WagerBotVoice,
  WagerBotPersonality,
} from '@/services/wagerBotVoiceService';

// Auto-disconnect after 10 minutes of connection time
const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

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

  // Refs for voice/personality so useFocusEffect callback always has latest values
  const voiceRef = useRef(selectedVoice);
  voiceRef.current = selectedVoice;
  const personalityRef = useRef(selectedPersonality);
  personalityRef.current = selectedPersonality;

  // Load persisted preferences on mount (runs once, tabs stay mounted)
  useEffect(() => {
    (async () => {
      try {
        const [storedVoice, storedPersonality] = await Promise.all([
          AsyncStorage.getItem(VOICE_STORAGE_KEY),
          AsyncStorage.getItem(PERSONALITY_STORAGE_KEY),
        ]);
        if (storedVoice) {
          const v = WagerBotVoiceService.normalizeVoice(storedVoice);
          setSelectedVoice(v);
          voiceRef.current = v;
        }
        if (storedPersonality) {
          const p = WagerBotVoiceService.normalizePersonality(storedPersonality);
          setSelectedPersonality(p);
          personalityRef.current = p;
        }
      } catch {}
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
    await serviceRef.current.initialize(
      voiceRef.current,
      personalityRef.current,
      gameContextRef.current,
    );
  }, []);

  // Connect when screen is focused, tear down when it loses focus.
  // Tab screens never unmount in Expo Router, so useEffect cleanup won't fire
  // on back navigation — useFocusEffect handles this correctly.
  useFocusEffect(
    useCallback(() => {
      setupCallbacks();

      // Small delay to let persisted preferences load on first focus
      const timeout = setTimeout(() => {
        connect();
      }, 100);

      return () => {
        clearTimeout(timeout);
        serviceRef.current.teardownSync();
        // Reset local state so UI is clean if user returns
        setIsConnecting(true);
        setIsConnected(false);
        setIsListening(false);
        setIsWaitingForResponse(false);
        setIsSpeaking(false);
        setConnectedAt(null);
        setLastError(null);
        setPromptSource(null);
        setPromptText(null);
      };
    }, [])
  );

  // Disconnect when app goes to background/inactive
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        serviceRef.current.teardownSync();
        setIsConnected(false);
        setIsConnecting(false);
        setConnectedAt(null);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, []);

  // Auto-disconnect after 10 minutes of connection time
  useEffect(() => {
    if (!connectedAt) return;

    const remaining = SESSION_TIMEOUT_MS - (Date.now() - connectedAt.getTime());
    if (remaining <= 0) {
      serviceRef.current.hangUp();
      return;
    }

    const timer = setTimeout(() => {
      serviceRef.current.hangUp();
    }, remaining);

    return () => clearTimeout(timer);
  }, [connectedAt]);

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
    if (normalized === voiceRef.current && serviceRef.current.isConnected) return;

    Haptics.selectionAsync();
    setSelectedVoice(normalized);
    voiceRef.current = normalized;
    setIsConnecting(true);
    setLastError(null);

    AsyncStorage.setItem(VOICE_STORAGE_KEY, normalized).catch(() => {});
    await serviceRef.current.updateVoice(normalized, gameContextRef.current);
  }, []);

  const changePersonality = useCallback(async (personality: WagerBotPersonality) => {
    const normalized = WagerBotVoiceService.normalizePersonality(personality);
    if (normalized === personalityRef.current && serviceRef.current.isConnected) return;

    Haptics.selectionAsync();
    setSelectedPersonality(normalized);
    personalityRef.current = normalized;
    setIsConnecting(true);
    setLastError(null);

    AsyncStorage.setItem(PERSONALITY_STORAGE_KEY, normalized).catch(() => {});
    await serviceRef.current.updatePersonality(normalized, gameContextRef.current);
  }, []);

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
