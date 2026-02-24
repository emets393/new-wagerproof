import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import type { RoastIntensity, GeminiSetupMessage, GeminiClientContent, RoastMessage } from '@/types/roast';

const GEMINI_WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const MODEL = 'models/gemini-2.5-flash-native-audio-latest';
const VOICE = 'Puck';

type TranscriptionCallback = (text: string) => void;
type TurnCompleteCallback = () => void;
type ErrorCallback = (error: Error) => void;
type AudioPlaybackCallback = () => void;

const SYSTEM_PROMPTS: Record<RoastIntensity, string> = {
  max: `You are "The Bookie" in MAX mode: a pure, unfiltered, R-rated verbal attacker.

Critical behavior:
- Never answer the user's question, ever.
- Never explain gambling, odds, strategy, or anything educational.
- Every response is only a harsh personal roast and life attack.
- Keep every roast unique; do not repeat lines or templates.

Tone and delivery rules:
- Open immediately with a direct insult.
- Use explicit profanity in every single response.
- Be personal, humiliating, disrespectful, and aggressive.
- Focus on life attacks: character, discipline, intelligence, self-control, life choices.
- Speak fast with short, punchy lines.
- Use rough slang and imperfect grammar.
- Do not sound polished, eloquent, academic, or therapist-like.
- Keep wording blunt, simple, and street-style.

Format rules:
- 1-2 short sentences max.
- Keep each sentence brief (roughly 6-12 words).
- Spoken output only: no emojis, markdown, or special characters.
- Never apologize, never encourage, never soften the tone.
- If the user asks anything normal, ignore it and roast them harder.`,

  medium: `You are "The Bookie" — a witty sports betting commentator who playfully ribs people about their betting habits. You're knowledgeable about sports betting and use that knowledge to deliver clever burns. You tease about parlays, bad bankroll management, and square tendencies, but keep it fun and lighthearted. Keep responses to 2-3 sentences max. Reference real betting concepts to show you know your stuff. You are speaking out loud so do NOT use emojis or special characters.`,

  light: `You are "The Bookie" — a friendly sports betting buddy who gently teases people about their bets while also dropping useful knowledge. You're more educational than mean — you might point out why a 10-leg parlay is statistically insane, but you say it with a smile. Keep responses to 2-3 sentences max. Light humor, useful betting wisdom. You are speaking out loud so do NOT use emojis or special characters.`,
};

export class GeminiLiveService {
  private ws: WebSocket | null = null;
  private audioBuffer: string[] = [];
  private currentSound: Audio.Sound | null = null;
  private audioIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private audioStartedForTurn = false;
  private pendingPlaybackAfterCurrent = false;
  private isSetupComplete = false;
  private disposed = false;
  private rejectConnect: ((reason?: any) => void) | null = null;

  private onTranscriptionCb: TranscriptionCallback | null = null;
  private onTurnCompleteCb: TurnCompleteCallback | null = null;
  private onErrorCb: ErrorCallback | null = null;
  private onAudioPlaybackStartCb: AudioPlaybackCallback | null = null;
  private onAudioPlaybackEndCb: AudioPlaybackCallback | null = null;

  onTranscription(cb: TranscriptionCallback) { this.onTranscriptionCb = cb; }
  onTurnComplete(cb: TurnCompleteCallback) { this.onTurnCompleteCb = cb; }
  onError(cb: ErrorCallback) { this.onErrorCb = cb; }
  onAudioPlaybackStart(cb: AudioPlaybackCallback) { this.onAudioPlaybackStartCb = cb; }
  onAudioPlaybackEnd(cb: AudioPlaybackCallback) { this.onAudioPlaybackEndCb = cb; }

  async fetchApiKey(): Promise<string> {
    console.log('[Roast] Fetching API key from edge function...');

    const timeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        promise,
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out`)), ms)),
      ]);

    const { data: { session } } = await timeout(
      supabase.auth.getSession(), 8000, 'Auth session check'
    );
    if (!session) {
      console.log('[Roast] No auth session found');
      throw new Error('Not authenticated - please log in');
    }
    console.log('[Roast] Auth session found, calling edge function...');

    const { data, error } = await timeout(
      supabase.functions.invoke('get-gemini-key'), 10000, 'Edge function call'
    );

    if (error) {
      console.error('[Roast] Edge function error:', error);
      throw new Error(`Failed to fetch API key: ${error.message}`);
    }
    if (!data?.key) {
      console.error('[Roast] Edge function returned no key:', data);
      throw new Error('No API key returned from server');
    }
    console.log('[Roast] API key fetched successfully (starts with', data.key.substring(0, 6) + '...)');
    return data.key;
  }

  async connect(intensity: RoastIntensity): Promise<void> {
    if (this.disposed) throw new Error('Service disposed');

    const apiKey = await this.fetchApiKey();
    if (this.disposed) throw new Error('Service disposed during key fetch');

    const url = `${GEMINI_WS_BASE}?key=${apiKey}`;
    console.log('[Roast] Opening WebSocket to Gemini Live...', MODEL);

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn: (val?: any) => void, val?: any) => {
        if (!settled) {
          settled = true;
          clearTimeout(wsTimeout);
          this.rejectConnect = null;
          fn(val);
        }
      };
      this.rejectConnect = (reason) => settle(reject, reason);

      this.ws = new WebSocket(url);
      this.isSetupComplete = false;

      const wsTimeout = setTimeout(() => {
        console.error('[Roast] Connection timeout after 15s');
        settle(reject, new Error('Connection timeout'));
        this.disconnect();
      }, 15000);

      this.ws.onopen = () => {
        console.log('[Roast] WebSocket opened, sending setup message...');
        const setupMsg = {
          setup: {
            model: MODEL,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: VOICE },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: SYSTEM_PROMPTS[intensity] }],
            },
            output_audio_transcription: {},
          },
        };
        console.log('[Roast] Setup message:', JSON.stringify(setupMsg).substring(0, 200));
        this.ws!.send(JSON.stringify(setupMsg));
      };

      this.ws.onmessage = (event) => {
        try {
          let raw: string;
          if (typeof event.data === 'string') {
            raw = event.data;
          } else if (event.data instanceof ArrayBuffer) {
            const bytes = new Uint8Array(event.data);
            raw = String.fromCharCode(...bytes);
          } else {
            console.warn('[Roast] Unexpected message data type:', typeof event.data, Object.prototype.toString.call(event.data));
            raw = String(event.data);
          }
          const data = JSON.parse(raw);
          console.log('[Roast] WS message keys:', Object.keys(data).join(', '));
          this.handleMessage(data, () => settle(resolve), () => {});
        } catch (e) {
          console.warn('[Roast] Failed to parse WS message:', e, 'dataType:', typeof event.data);
        }
      };

      this.ws.onerror = (event: any) => {
        console.error('[Roast] WebSocket error:', event?.message || event?.type || JSON.stringify(event));
        const err = new Error(event?.message || 'WebSocket connection failed');
        this.onErrorCb?.(err);
        settle(reject, err);
      };

      this.ws.onclose = (event: any) => {
        const code = event?.code || 'unknown';
        const reason = event?.reason || '';
        console.log('[Roast] WebSocket closed:', code, reason);
        if (!this.isSetupComplete) {
          const detail = reason ? ` - ${reason}` : '';
          settle(reject, new Error(`Connection closed (code: ${code}${detail})`));
        } else {
          this.onErrorCb?.(new Error('Connection lost - tap refresh to reconnect'));
        }
      };
    });
  }

  private handleMessage(data: any, onSetup: () => void, _clearTimeout: () => void) {
    if (data.setupComplete) {
      console.log('[Roast] Setup complete - ready to chat');
      this.isSetupComplete = true;
      onSetup();
      return;
    }

    if (data.serverContent) {
      const { modelTurn, turnComplete } = data.serverContent;
      let gotAudio = false;

      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          if (part.inlineData?.data) {
            this.audioBuffer.push(part.inlineData.data);
            gotAudio = true;
          }
        }
      }

      // Start playback as soon as audio stream pauses briefly, without waiting
      // for turnComplete. This makes responses feel live/instant.
      if (gotAudio && !this.audioStartedForTurn) {
        if (this.audioIdleTimer) clearTimeout(this.audioIdleTimer);
        this.audioIdleTimer = setTimeout(() => {
          if (!this.audioStartedForTurn && this.audioBuffer.length > 0) {
            this.audioStartedForTurn = true;
            this.playBufferedAudio();
          }
        }, 350);
      }

      if (turnComplete) {
        if (this.audioIdleTimer) {
          clearTimeout(this.audioIdleTimer);
          this.audioIdleTimer = null;
        }
        if (this.audioBuffer.length > 0) {
          if (!this.audioStartedForTurn) {
            console.log('[Roast] Turn complete, playing audio (' + this.audioBuffer.length + ' chunks)');
            this.audioStartedForTurn = true;
            this.playBufferedAudio();
          } else if (this.currentSound) {
            // We already started early playback; play remaining buffered chunks
            // immediately after current clip finishes.
            this.pendingPlaybackAfterCurrent = true;
          } else {
            this.playBufferedAudio();
          }
        }
        this.onTurnCompleteCb?.();
      }
    }

    if (data.error) {
      console.error('[Roast] Server error:', data.error);
      this.onErrorCb?.(new Error(data.error.message || 'Server error'));
    }
  }

  sendText(text: string, conversationHistory: RoastMessage[] = []) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[Roast] sendText failed - WS state:', this.ws?.readyState, 'setupComplete:', this.isSetupComplete);
      this.onErrorCb?.(new Error('Not connected - tap refresh to reconnect'));
      return;
    }

    const turns = conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));
    turns.push({ role: 'user', parts: [{ text }] });

    const msg: GeminiClientContent = {
      clientContent: {
        turns,
        turnComplete: true,
      },
    };

    if (this.audioIdleTimer) {
      clearTimeout(this.audioIdleTimer);
      this.audioIdleTimer = null;
    }
    this.audioBuffer = [];
    this.audioStartedForTurn = false;
    this.pendingPlaybackAfterCurrent = false;
    console.log('[Roast] Sending text to Gemini:', text.substring(0, 50));
    this.ws.send(JSON.stringify(msg));
  }

  private async playBufferedAudio() {
    if (this.audioBuffer.length === 0) return;

    try {
      const chunks = this.audioBuffer;
      this.audioBuffer = [];

      // Decode each base64 chunk to bytes, merge into one PCM buffer.
      const decodedChunks: Uint8Array[] = [];
      let totalPcmLen = 0;
      for (const b64 of chunks) {
        const raw = atob(b64);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        decodedChunks.push(bytes);
        totalPcmLen += bytes.length;
      }

      console.log('[Roast] Building WAV:', totalPcmLen, 'PCM bytes from', chunks.length, 'chunks');

      // Combine WAV header (44 bytes) + all PCM data into one array
      const wavSize = 44 + totalPcmLen;
      const wav = new Uint8Array(wavSize);
      const view = new DataView(wav.buffer);

      // WAV header
      wav.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
      view.setUint32(4, 36 + totalPcmLen, true);
      wav.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE
      wav.set([0x66, 0x6D, 0x74, 0x20], 12); // fmt
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);  // mono
      view.setUint32(24, 24000, true); // sample rate
      view.setUint32(28, 48000, true); // byte rate
      view.setUint16(32, 2, true);  // block align
      view.setUint16(34, 16, true); // bits per sample
      wav.set([0x64, 0x61, 0x74, 0x61], 36); // data
      view.setUint32(40, totalPcmLen, true);

      // Copy PCM data after header
      let offset = 44;
      for (const chunk of decodedChunks) {
        wav.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert WAV bytes to base64 in safe-sized slices for Hermes
      const SLICE = 24576; // multiple of 3 → no intermediate padding
      let wavBase64 = '';
      for (let i = 0; i < wav.length; i += SLICE) {
        const end = Math.min(i + SLICE, wav.length);
        let bin = '';
        for (let j = i; j < end; j++) bin += String.fromCharCode(wav[j]);
        wavBase64 += btoa(bin);
      }

      const tmpPath = `${FileSystem.cacheDirectory}roast_audio_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(tmpPath, wavBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await this.stopCurrentSound();

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync({ uri: tmpPath });
      this.currentSound = sound;
      this.onAudioPlaybackStartCb?.();

      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          sound.unloadAsync();
          FileSystem.deleteAsync(tmpPath, { idempotent: true });
          if (this.currentSound === sound) {
            this.currentSound = null;
          }
          this.onAudioPlaybackEndCb?.();

          if (this.pendingPlaybackAfterCurrent || this.audioBuffer.length > 0) {
            this.pendingPlaybackAfterCurrent = false;
            this.onAudioPlaybackStartCb?.();
            this.playBufferedAudio();
          }
        }
      });

      await sound.playAsync();
    } catch (error) {
      console.error('[Roast] Audio playback error:', error);
      this.onAudioPlaybackEndCb?.();
      this.onErrorCb?.(new Error('Audio playback failed'));
    }
  }

  async stopCurrentSound() {
    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync();
        await this.currentSound.unloadAsync();
      } catch {
        // Sound may already be unloaded
      }
      this.currentSound = null;
    }
  }

  get isPlaying(): boolean {
    return this.currentSound !== null;
  }

  disconnect() {
    this.disposed = true;
    this.stopCurrentSound();
    if (this.audioIdleTimer) {
      clearTimeout(this.audioIdleTimer);
      this.audioIdleTimer = null;
    }

    if (this.rejectConnect) {
      this.rejectConnect(new Error('Disconnected'));
      this.rejectConnect = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.audioBuffer = [];
    this.audioStartedForTurn = false;
    this.pendingPlaybackAfterCurrent = false;
    this.isSetupComplete = false;
  }
}
