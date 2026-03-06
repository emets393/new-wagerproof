import { useState, useRef, useCallback, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { WagerBotVoiceService, WagerBotVoice } from '@/services/wagerBotVoiceService';

export function useWagerBotVoice(gameContext?: string) {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<WagerBotVoice>('marin');
  const [lastError, setLastError] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);
  const [promptSource, setPromptSource] = useState<'supabase' | 'fallback' | null>(null);
  const [promptText, setPromptText] = useState<string | null>(null);

  const serviceRef = useRef(WagerBotVoiceService.getInstance());
  const gameContextRef = useRef(gameContext);
  gameContextRef.current = gameContext;

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
    await serviceRef.current.initialize(selectedVoice, gameContextRef.current);
  }, [selectedVoice]);

  // Initialize on mount
  useEffect(() => {
    setupCallbacks();
    connect();

    return () => {
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

    await serviceRef.current.updateVoice(normalized, gameContextRef.current);
  }, [selectedVoice, isConnected]);

  return {
    isConnecting,
    isConnected,
    isListening,
    isWaitingForResponse,
    isSpeaking,
    selectedVoice,
    lastError,
    connectedAt,
    promptSource,
    promptText,
    connect,
    startTalking,
    stopTalking,
    hangUp,
    changeVoice,
  };
}
