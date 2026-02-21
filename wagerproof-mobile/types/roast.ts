export type RoastIntensity = 'max' | 'medium' | 'light';

export type RoastSessionState = 'idle' | 'recording' | 'processing' | 'responding';

export interface RoastMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface GeminiLiveConfig {
  model: string;
  voice: string;
  temperature: number;
  topP: number;
  topK: number;
  systemPrompt: string;
}

export interface GeminiSetupMessage {
  setup: {
    model: string;
    generationConfig: {
      responseModalities: string[];
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: string;
          };
        };
      };
      temperature: number;
      topP: number;
      topK: number;
    };
    systemInstruction: {
      parts: Array<{ text: string }>;
    };
    outputAudioTranscription: {};
  };
}

export interface GeminiClientContent {
  clientContent: {
    turns: Array<{
      role: string;
      parts: Array<{ text: string }>;
    }>;
    turnComplete: boolean;
  };
}
