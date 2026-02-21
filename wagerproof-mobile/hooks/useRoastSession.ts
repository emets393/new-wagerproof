import { useState, useRef, useCallback, useEffect } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import * as Haptics from 'expo-haptics';
import { GeminiLiveService } from '@/services/geminiLiveService';
import type { RoastIntensity, RoastSessionState, RoastMessage } from '@/types/roast';

export function useRoastSession() {
  const [state, setState] = useState<RoastSessionState>('idle');
  const [intensity, setIntensity] = useState<RoastIntensity>('medium');
  const [messages, setMessages] = useState<RoastMessage[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const transcriptAccRef = useRef('');
  const stateRef = useRef(state);
  const messagesRef = useRef(messages);
  const currentAssistantStatusIdRef = useRef<string | null>(null);
  const statusStageRef = useRef<'idle' | 'thinking' | 'playing'>('idle');
  const statusDotsRef = useRef(1);
  const statusTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const updateAssistantStatusMessage = useCallback((text: string) => {
    const id = currentAssistantStatusIdRef.current;
    if (!id) return;
    setMessages(prev => prev.map(msg => (msg.id === id ? { ...msg, text } : msg)));
  }, []);

  const startStatusAnimation = useCallback((stage: 'thinking' | 'playing') => {
    if (statusTimerRef.current) {
      clearInterval(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    statusStageRef.current = stage;
    statusDotsRef.current = 1;
    const label = stage === 'thinking' ? 'Thinking' : 'Playing audio';
    updateAssistantStatusMessage(`${label}.`);
    statusTimerRef.current = setInterval(() => {
      statusDotsRef.current = (statusDotsRef.current % 3) + 1;
      updateAssistantStatusMessage(`${label}${'.'.repeat(statusDotsRef.current)}`);
    }, 350);
  }, [updateAssistantStatusMessage]);

  const finishStatusAnimation = useCallback((finalText: string) => {
    if (statusTimerRef.current) {
      clearInterval(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    statusStageRef.current = 'idle';
    updateAssistantStatusMessage(finalText);
    currentAssistantStatusIdRef.current = null;
  }, [updateAssistantStatusMessage]);

  // Initialize Gemini service
  const connectService = useCallback(async (level: RoastIntensity) => {
    console.log('[RoastHook] Connecting with intensity:', level);

    if (serviceRef.current) {
      serviceRef.current.disconnect();
    }

    const service = new GeminiLiveService();
    serviceRef.current = service;

    // Suppress live model "thinking" text in UI; this mode is audio-first.
    service.onTranscription(() => {});

    service.onTurnComplete(() => {
      transcriptAccRef.current = '';
      setAiTranscript('');
      setState('idle');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });

    service.onAudioPlaybackStart(() => {
      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current);
        doneTimerRef.current = null;
      }
      startStatusAnimation('playing');
    });

    service.onAudioPlaybackEnd(() => {
      finishStatusAnimation('Completed');
    });

    service.onError((err) => {
      console.error('[RoastHook] Service error:', err.message);
      if (currentAssistantStatusIdRef.current) {
        finishStatusAnimation('Failed');
      }
      setError(err.message);
      if (stateRef.current === 'processing' || stateRef.current === 'responding') {
        setState('idle');
      }
    });

    setIsConnecting(true);
    setError(null);
    try {
      await service.connect(level);
      setIsConnected(true);
      console.log('[RoastHook] Connected successfully');
    } catch (err: any) {
      if (err.message === 'Disconnected' || err.message === 'Service disposed' || err.message === 'Service disposed during key fetch') {
        console.log('[RoastHook] Connection cancelled (expected during cleanup)');
        return;
      }
      console.error('[RoastHook] Connection failed:', err.message);
      setError(err.message || 'Failed to connect');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Connect on mount and when intensity changes
  useEffect(() => {
    connectService(intensity);
    return () => {
      if (statusTimerRef.current) {
        clearInterval(statusTimerRef.current);
        statusTimerRef.current = null;
      }
      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current);
        doneTimerRef.current = null;
      }
      serviceRef.current?.disconnect();
      serviceRef.current = null;
      setIsConnected(false);
    };
  }, [intensity, connectService]);

  // STT event listeners
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript || '';
    setLiveTranscript(transcript);

    if (event.isFinal && transcript.trim()) {
      const userMsg: RoastMessage = {
        id: Date.now().toString(),
        role: 'user',
        text: transcript.trim(),
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, userMsg]);
      setLiveTranscript('');

      // Send to Gemini using ref for latest messages
      setState('responding');
      setAiTranscript('');
      transcriptAccRef.current = '';
      const assistantId = (Date.now() + 1).toString();
      currentAssistantStatusIdRef.current = assistantId;
      setMessages(prev => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          text: 'Thinking.',
          timestamp: Date.now(),
        },
      ]);
      startStatusAnimation('thinking');

      console.log('[RoastHook] Sending to Gemini:', transcript.trim().substring(0, 50));
      serviceRef.current?.sendText(
        transcript.trim(),
        messagesRef.current.slice(-10)
      );
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'no-speech') {
      setState('idle');
      setLiveTranscript('');
      return;
    }
    console.error('[RoastHook] STT error:', event.error, event.message);
    setError(`Speech recognition: ${event.message}`);
    setState('idle');
    setLiveTranscript('');
  });

  useSpeechRecognitionEvent('end', () => {
    if (stateRef.current === 'recording') {
      setState('idle');
      setLiveTranscript('');
    }
  });

  const toggleRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (state === 'recording') {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    if (state === 'responding') {
      await serviceRef.current?.stopCurrentSound();
      transcriptAccRef.current = '';
      setAiTranscript('');
    }

    const { granted } = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    if (!granted) {
      const { granted: newGranted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!newGranted) {
        setError('Microphone and speech recognition permissions are required');
        return;
      }
    }

    // Check if connected before allowing recording
    if (!serviceRef.current || !isConnected) {
      setError('Not connected - tap refresh to reconnect');
      return;
    }

    setError(null);
    setState('recording');
    setLiveTranscript('');

    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      addsPunctuation: true,
    });
  }, [state, isConnected]);

  const changeIntensity = useCallback((level: RoastIntensity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIntensity(level);
  }, []);

  const clearConversation = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessages([]);
    setLiveTranscript('');
    setAiTranscript('');
    setError(null);
    if (statusTimerRef.current) {
      clearInterval(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    currentAssistantStatusIdRef.current = null;
    statusStageRef.current = 'idle';
    connectService(intensity);
  }, [intensity, connectService]);

  return {
    state,
    intensity,
    messages,
    liveTranscript,
    aiTranscript,
    error,
    isConnected,
    isConnecting,
    toggleRecording,
    setIntensity: changeIntensity,
    clearConversation,
  };
}
