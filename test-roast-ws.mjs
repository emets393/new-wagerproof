#!/usr/bin/env node
/**
 * Final test: exact app config with proper audio decode + text extraction
 */
import WebSocket from 'ws';
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const MODEL = 'models/gemini-2.5-flash-native-audio-latest';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { console.error('Set GEMINI_API_KEY'); process.exit(1); }

console.log('Testing exact app config (with output_audio_transcription)...\n');

const ws = new WebSocket(`${WS_URL}?key=${apiKey}`);
let audioChunks = [], modelText = '', otText = '';

const timer = setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 30000);

ws.on('open', () => {
  console.log('[1] WebSocket OPEN');
  ws.send(JSON.stringify({
    setup: {
      model: MODEL,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
      },
      systemInstruction: { parts: [{ text: 'You are "The Bookie" — a savage sports betting roast master. Keep responses to 2-3 sentences. You are speaking out loud so do NOT use emojis or special characters.' }] },
      output_audio_transcription: {},
    },
  }));
});

ws.on('message', (raw) => {
  const data = JSON.parse(raw.toString());
  if (data.setupComplete) {
    console.log('[2] Setup COMPLETE');
    ws.send(JSON.stringify({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: 'I just bet a 12 leg parlay on NBA games tonight' }] }],
        turnComplete: true,
      },
    }));
    console.log('[3] Sent user message');
  }
  if (data.serverContent) {
    const { modelTurn, outputTranscription, turnComplete } = data.serverContent;
    if (modelTurn?.parts) for (const p of modelTurn.parts) {
      if (p.inlineData?.data) audioChunks.push(p.inlineData.data);
      if (p.text) modelText += p.text;
    }
    if (outputTranscription?.parts) for (const p of outputTranscription.parts) {
      if (p.text) otText += p.text;
    }
    if (turnComplete) {
      clearTimeout(timer);
      console.log('[4] Turn COMPLETE\n');

      // Decode audio properly (same as app code)
      const buffers = audioChunks.map(b64 => Buffer.from(b64, 'base64'));
      const pcm = Buffer.concat(buffers);
      
      // Build WAV
      const header = Buffer.alloc(44);
      header.write('RIFF', 0);
      header.writeUInt32LE(36 + pcm.length, 4);
      header.write('WAVE', 8);
      header.write('fmt ', 12);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(1, 22);
      header.writeUInt32LE(24000, 24);
      header.writeUInt32LE(48000, 28);
      header.writeUInt16LE(2, 32);
      header.writeUInt16LE(16, 34);
      header.write('data', 36);
      header.writeUInt32LE(pcm.length, 40);
      const wav = Buffer.concat([header, pcm]);
      
      writeFileSync('/tmp/test_roast.wav', wav);
      
      // Clean thinking text
      const cleaned = modelText
        .replace(/\*\*[^*]+\*\*\s*/g, '')
        .replace(/\n{2,}/g, ' ')
        .trim();

      console.log(`Audio: ${audioChunks.length} chunks, ${pcm.length} PCM bytes`);
      console.log(`WAV written to /tmp/test_roast.wav (${wav.length} bytes)`);
      console.log(`\noutputTranscription: "${otText || '(empty)'}"`);
      console.log(`modelTurn text (raw): "${modelText.substring(0, 150)}..."`);
      console.log(`modelTurn text (cleaned): "${cleaned.substring(0, 150)}"`);
      
      // Try to play
      try {
        console.log('\nPlaying audio...');
        execSync('afplay /tmp/test_roast.wav', { stdio: 'inherit' });
        console.log('Audio playback SUCCESS!');
      } catch { console.log('afplay not available or failed'); }
      
      ws.close();
      process.exit(0);
    }
  }
  if (data.error) { console.error('ERROR:', data.error); process.exit(1); }
});

ws.on('error', (e) => { console.error('WS ERROR:', e.message); process.exit(1); });
ws.on('close', () => {});
