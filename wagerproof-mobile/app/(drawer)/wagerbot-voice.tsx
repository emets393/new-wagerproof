// Single entry point for the WagerBot voice feature. We keep two parallel
// implementations behind a flag:
//   v1 — the pre-refactor build restored from commit 7f3ebded (shipped
//        working in 3.5.x). Lives self-contained in features/voice-v1/.
//   v2 — the in-progress "Swift REfactor" version at the canonical paths
//        (services/, hooks/, app/(drawer)/(tabs)/voice-chat.tsx).
// Flip VOICE_IMPL to 'v2' to test/continue the refactor; 'v1' is the
// known-good fallback so voice keeps working while v2 is fixed.
import { WagerBotVoiceChatScreen } from './(tabs)/voice-chat'; // v2
import VoiceChatScreenV1 from '@/features/voice-v1/VoiceChatScreen'; // v1

const VOICE_IMPL: 'v1' | 'v2' = 'v1';

export default function WagerBotVoiceRoute() {
  return VOICE_IMPL === 'v1' ? <VoiceChatScreenV1 /> : <WagerBotVoiceChatScreen />;
}
