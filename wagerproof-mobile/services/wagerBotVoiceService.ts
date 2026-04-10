import {
  RTCPeerConnection,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';
import { Audio } from 'expo-av';
import { supabase } from './supabase';

export type WagerBotVoice = 'ash' | 'ballad' | 'coral' | 'sage' | 'verse' | 'marin' | 'cedar';
export type WagerBotPersonality = 'friendly' | 'spicy';

const SUPPORTED_VOICES: WagerBotVoice[] = ['ash', 'ballad', 'coral', 'sage', 'verse', 'marin', 'cedar'];
const DEFAULT_VOICE: WagerBotVoice = 'marin';
const DEFAULT_PERSONALITY: WagerBotPersonality = 'friendly';

type VoidCallback = () => void;
type ErrorCallback = (error: string) => void;

/**
 * OpenAI Realtime voice service for WagerBot.
 *
 * Audio-first, push-to-talk using a persistent WebRTC session.
 * Modeled after Honeydew's RoastChefService — supports voice selection
 * and personality modes (friendly/spicy).
 */
export class WagerBotVoiceService {
  private static instance: WagerBotVoiceService;

  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: any = null;
  private localStream: MediaStream | null = null;
  private micTrack: any = null;

  private _isConnecting = false;
  private _isConnected = false;
  private _isListening = false;
  private _isWaitingForResponse = false;
  private _isSpeaking = false;
  private _dataChannelOpen = false;

  private _voice: WagerBotVoice = DEFAULT_VOICE;
  private _personality: WagerBotPersonality = DEFAULT_PERSONALITY;
  private _model = 'gpt-realtime';
  private _promptSource: 'supabase' | 'fallback' | null = null;
  private _promptText: string | null = null;
  private _sessionTimer: ReturnType<typeof setTimeout> | null = null;

  // Hard ceiling — service tears itself down after 10 min even if hook doesn't
  private static SESSION_TIMEOUT_MS = 10 * 60 * 1000;

  // Callbacks
  onConnected: VoidCallback | null = null;
  onDisconnected: VoidCallback | null = null;
  onListeningStarted: VoidCallback | null = null;
  onListeningStopped: VoidCallback | null = null;
  onProcessingStarted: VoidCallback | null = null;
  onSpeakingStarted: VoidCallback | null = null;
  onSpeakingFinished: VoidCallback | null = null;
  onError: ErrorCallback | null = null;

  static getInstance(): WagerBotVoiceService {
    if (!WagerBotVoiceService.instance) {
      WagerBotVoiceService.instance = new WagerBotVoiceService();
    }
    return WagerBotVoiceService.instance;
  }

  get isConnected() { return this._isConnected && this._dataChannelOpen; }
  get isConnecting() { return this._isConnecting; }
  get isListening() { return this._isListening; }
  get isWaitingForResponse() { return this._isWaitingForResponse; }
  get isSpeaking() { return this._isSpeaking; }
  get currentVoice() { return this._voice; }
  get currentPersonality() { return this._personality; }
  get promptSource() { return this._promptSource; }
  get promptText() { return this._promptText; }

  static normalizeVoice(voice?: string): WagerBotVoice {
    const v = voice?.toLowerCase().trim() as WagerBotVoice;
    return SUPPORTED_VOICES.includes(v) ? v : DEFAULT_VOICE;
  }

  static normalizePersonality(personality?: string): WagerBotPersonality {
    return personality === 'spicy' ? 'spicy' : 'friendly';
  }

  clearCallbacks() {
    this.onConnected = null;
    this.onDisconnected = null;
    this.onListeningStarted = null;
    this.onListeningStopped = null;
    this.onProcessingStarted = null;
    this.onSpeakingStarted = null;
    this.onSpeakingFinished = null;
    this.onError = null;
  }

  async initialize(
    voice: WagerBotVoice = DEFAULT_VOICE,
    personality: WagerBotPersonality = DEFAULT_PERSONALITY,
    gameContext?: string,
  ) {
    if (this._isConnecting) return;

    this._voice = WagerBotVoiceService.normalizeVoice(voice);
    this._personality = WagerBotVoiceService.normalizePersonality(personality);
    this._isConnecting = true;

    try {
      await this.disconnectInternal(false);

      // Route audio through the loudspeaker instead of the earpiece.
      // Must be set before WebRTC creates its audio session.
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });

      // 1. Get ephemeral token from Supabase edge function
      const session = await this.createRealtimeSession(gameContext);
      const clientSecret = session.clientSecret;
      if (!clientSecret) {
        throw new Error('No client secret returned from session endpoint.');
      }
      this._model = session.model || 'gpt-4o-realtime-preview';
      this._promptSource = session.promptSource || 'fallback';
      this._promptText = session.promptText || null;

      // 2. Create WebRTC peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [],
      });
      this.wirePeerConnection();

      // 3. Get microphone stream
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      }) as MediaStream;

      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No microphone track was created.');
      }

      this.micTrack = audioTracks[0];
      this.micTrack.enabled = false; // Start muted until user holds to talk

      // Add all tracks to peer connection
      this.localStream.getTracks().forEach((track: any) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // 4. Create data channel for OpenAI events
      this.dataChannel = this.peerConnection.createDataChannel('oai-events', {
        ordered: true,
      });
      this.wireDataChannel(this.dataChannel);

      // 5. Create SDP offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      } as any);
      await this.peerConnection.setLocalDescription(offer);

      // 6. Wait for ICE gathering
      await this.awaitIceGathering();

      // 7. Exchange SDP with OpenAI
      const localDesc = await this.peerConnection.localDescription;
      const offerSdp = localDesc?.sdp || offer.sdp;
      if (!offerSdp) {
        throw new Error('Failed to create local WebRTC offer.');
      }

      const answerSdp = await this.exchangeSdp(clientSecret, offerSdp);

      // 8. Set remote description
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: answerSdp })
      );
    } catch (error: any) {
      console.error('[WagerBotVoice] Initialize failed:', error);
      this.onError?.(this.humanizeError(error));
      await this.disconnectInternal(false);
    } finally {
      this._isConnecting = false;
    }
  }

  async reconnect(voice?: WagerBotVoice, personality?: WagerBotPersonality, gameContext?: string) {
    await this.initialize(
      voice || this._voice,
      personality || this._personality,
      gameContext,
    );
  }

  async updateVoice(voice: WagerBotVoice, gameContext?: string) {
    const normalized = WagerBotVoiceService.normalizeVoice(voice);
    if (normalized === this._voice && this.isConnected) return;
    this._voice = normalized;
    await this.reconnect(normalized, this._personality, gameContext);
  }

  async updatePersonality(personality: WagerBotPersonality, gameContext?: string) {
    const normalized = WagerBotVoiceService.normalizePersonality(personality);
    if (normalized === this._personality && this.isConnected) return;
    this._personality = normalized;
    // Personality changes the system prompt, so we must reconnect
    await this.reconnect(this._voice, normalized, gameContext);
  }

  async startListening() {
    if (!this.isConnected || !this.micTrack) {
      this.onError?.('WagerBot is not connected yet.');
      return;
    }
    if (this._isListening) return;

    try {
      // Cancel any active response first
      if (this._isWaitingForResponse || this._isSpeaking) {
        await this.cancelActiveResponse();
      }

      await this.sendEvent({ type: 'input_audio_buffer.clear' });
      this.micTrack.enabled = true;
      this._isListening = true;
      this._isWaitingForResponse = false;
      this.onListeningStarted?.();
    } catch (error) {
      console.error('[WagerBotVoice] Start listening failed:', error);
      this.onError?.('Failed to start listening.');
    }
  }

  async stopListening() {
    if (!this._isListening || !this.micTrack) return;

    try {
      this.micTrack.enabled = false;
      this._isListening = false;
      this.onListeningStopped?.();

      this._isWaitingForResponse = true;
      this.onProcessingStarted?.();

      await this.sendEvent({ type: 'input_audio_buffer.commit' });
      await this.sendEvent({
        type: 'response.create',
        response: {
          modalities: ['audio', 'text'],
        },
      });
    } catch (error) {
      this._isWaitingForResponse = false;
      console.error('[WagerBotVoice] Stop listening failed:', error);
      this.onError?.('Failed to send audio to WagerBot.');
    }
  }

  async hangUp() {
    await this.disconnectInternal(true);
  }

  async disconnect() {
    await this.disconnectInternal(false);
  }

  /**
   * Synchronous teardown — safe to call from React useEffect cleanup where
   * we can't await. Closes WebRTC, mic, and timers immediately.
   */
  teardownSync() {
    this.clearSessionTimer();
    this._isConnecting = false;
    this._isListening = false;
    this._isWaitingForResponse = false;
    this._isSpeaking = false;
    this._isConnected = false;
    this._dataChannelOpen = false;

    try { if (this.micTrack) this.micTrack.enabled = false; } catch {}

    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => {
        try { track.stop(); } catch {}
      });
      try { (this.localStream as any).release?.(); } catch {}
      this.localStream = null;
    }

    this.micTrack = null;
    this.clearCallbacks();
  }

  // --- Private ---

  private async createRealtimeSession(gameContext?: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke(
      'create-wagerbot-voice-session',
      {
        body: {
          voice: this._voice,
          rudeness: this._personality,
          gameContext: gameContext || '',
        },
      },
    );

    if (error) throw new Error(`Session creation failed: ${error.message}`);
    if (!data?.clientSecret) throw new Error('No client secret in response');

    return data as {
      clientSecret: string;
      model: string;
      voice: string;
      rudeness?: string;
      promptSource?: 'supabase' | 'fallback';
      promptText?: string;
    };
  }

  private wirePeerConnection() {
    if (!this.peerConnection) return;

    (this.peerConnection as any).onconnectionstatechange = () => {
      const state = (this.peerConnection as any)?.connectionState;
      console.log('[WagerBotVoice] Peer state:', state);

      switch (state) {
        case 'connected':
          if (!this._isConnected) {
            this._isConnected = true;
            this.startSessionTimer();
            this.onConnected?.();
          }
          break;
        case 'disconnected':
        case 'failed':
        case 'closed':
          if (this._isConnected) {
            this._isConnected = false;
            this.clearSessionTimer();
            this.onDisconnected?.();
          }
          break;
      }
    };

    (this.peerConnection as any).ondatachannel = (event: any) => {
      if (event.channel?.label === 'oai-events') {
        this.dataChannel = event.channel;
        this.wireDataChannel(event.channel);
      }
    };

    (this.peerConnection as any).ontrack = (event: any) => {
      // Enable incoming audio track (AI voice playback)
      if (event.track?.kind === 'audio') {
        event.track.enabled = true;
      }
    };
  }

  private wireDataChannel(channel: any) {
    channel.onopen = () => {
      console.log('[WagerBotVoice] Data channel open');
      this._dataChannelOpen = true;
    };

    channel.onclose = () => {
      console.log('[WagerBotVoice] Data channel closed');
      this._dataChannelOpen = false;
    };

    channel.onmessage = (event: any) => {
      const text = typeof event.data === 'string' ? event.data : event.data?.text;
      if (text) {
        this.handleServerEvent(text);
      }
    };
  }

  private async awaitIceGathering(): Promise<void> {
    if (!this.peerConnection) return;

    const state = (this.peerConnection as any).iceGatheringState;
    if (state === 'complete') return;

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[WagerBotVoice] ICE gathering timed out; continuing.');
        resolve();
      }, 3000);

      (this.peerConnection as any).onicegatheringstatechange = () => {
        if ((this.peerConnection as any)?.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      };
    });
  }

  private async exchangeSdp(
    clientSecret: string,
    offerSdp: string,
  ): Promise<string> {
    const uri = `https://api.openai.com/v1/realtime?model=${this._model}`;

    const response = await fetch(uri, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clientSecret}`,
        'Content-Type': 'application/sdp',
      },
      body: offerSdp,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Realtime SDP exchange failed (${response.status}): ${errorText}`,
      );
    }

    return await response.text();
  }

  private async sendEvent(event: Record<string, any>) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Realtime control channel is not open.');
    }
    this.dataChannel.send(JSON.stringify(event));
  }

  private handleServerEvent(rawMessage: string) {
    try {
      const data = JSON.parse(rawMessage);
      const type = data.type as string | undefined;
      if (!type) return;

      switch (type) {
        case 'response.created':
          this._isWaitingForResponse = true;
          break;

        case 'output_audio_buffer.started':
          this._isWaitingForResponse = false;
          if (!this._isSpeaking) {
            this._isSpeaking = true;
            this.onSpeakingStarted?.();
          }
          break;

        case 'output_audio_buffer.stopped':
        case 'output_audio_buffer.cleared':
          this._isWaitingForResponse = false;
          if (this._isSpeaking) {
            this._isSpeaking = false;
            this.onSpeakingFinished?.();
          }
          break;

        case 'response.done':
          if (!this._isSpeaking) {
            this._isWaitingForResponse = false;
          }
          break;

        case 'response.cancelled':
          this._isWaitingForResponse = false;
          if (this._isSpeaking) {
            this._isSpeaking = false;
            this.onSpeakingFinished?.();
          }
          break;

        case 'error': {
          const msg = data.error?.message || 'Realtime error occurred.';
          this.onError?.(msg);
          break;
        }
      }
    } catch (error) {
      console.error('[WagerBotVoice] Failed to parse server event:', error);
    }
  }

  private async cancelActiveResponse() {
    try {
      await this.sendEvent({ type: 'response.cancel' });
      await this.sendEvent({ type: 'output_audio_buffer.clear' });
    } catch {}

    const wasSpeaking = this._isSpeaking;
    this._isWaitingForResponse = false;
    this._isSpeaking = false;
    if (wasSpeaking) this.onSpeakingFinished?.();
  }

  private humanizeError(error: any): string {
    const message = error?.message || String(error);
    if (message.includes('microphone') || message.includes('Microphone')) {
      return 'Microphone permission is required for WagerBot voice.';
    }
    if (message.includes('client secret') || message.includes('Not authenticated')) {
      return 'Please log in to use WagerBot voice.';
    }
    if (message.includes('SDP')) {
      return 'Failed to establish voice connection. Try again.';
    }
    return 'Failed to connect WagerBot voice. Try again.';
  }

  private startSessionTimer() {
    this.clearSessionTimer();
    this._sessionTimer = setTimeout(() => {
      console.log('[WagerBotVoice] Session timeout (10 min) — auto-disconnecting.');
      this.disconnectInternal(true);
    }, WagerBotVoiceService.SESSION_TIMEOUT_MS);
  }

  private clearSessionTimer() {
    if (this._sessionTimer) {
      clearTimeout(this._sessionTimer);
      this._sessionTimer = null;
    }
  }

  private async disconnectInternal(notify: boolean) {
    this.clearSessionTimer();
    const wasConnected = this._isConnected;

    // Reset audio mode so other parts of the app aren't affected
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    this._isListening = false;
    this._isWaitingForResponse = false;
    this._isSpeaking = false;
    this._isConnected = false;
    this._dataChannelOpen = false;

    try { if (this.micTrack) this.micTrack.enabled = false; } catch {}

    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => {
        try { track.stop(); } catch {}
      });
      try { (this.localStream as any).release?.(); } catch {}
      this.localStream = null;
    }

    this.micTrack = null;

    if (notify && wasConnected) {
      this.onDisconnected?.();
    }
  }
}
