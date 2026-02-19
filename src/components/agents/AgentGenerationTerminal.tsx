import { useEffect, useMemo, useRef, useState } from 'react';
import Dither from '@/components/Dither';
import { GeneratePicksResponse } from '@/types/agent';
import { useTheme } from '@/contexts/ThemeContext';

type TerminalStatus = 'idle' | 'generating' | 'success' | 'error';

interface AgentGenerationTerminalProps {
  status: TerminalStatus;
  errorMessage?: string | null;
  result?: GeneratePicksResponse | null;
}

const GENERATING_STEPS = [
  'Connection established. Running pick engine...',
  "Checking today's slate and active markets...",
  'Applying your risk profile and bet preferences...',
  'Scoring model edges across candidate games...',
  'Filtering for confidence and value thresholds...',
  'Finalizing picks and writing results...',
];

const CHAR_INTERVAL_MS = 18;
const LINE_PAUSE_MS = 350;
const CURSOR_BLINK_MS = 500;

export function AgentGenerationTerminal({ status, errorMessage, result }: AgentGenerationTerminalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const [historyLines, setHistoryLines] = useState<string[]>([]);
  const [activeLine, setActiveLine] = useState('');
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);

  const outcomeLines = useMemo(() => {
    if (status === 'error') {
      return [
        'Generation failed.',
        errorMessage || 'An unexpected error occurred while generating picks.',
      ];
    }
    if (status === 'success') {
      const pickCount = result?.picks?.length || 0;
      return pickCount === 0
        ? [
            'Analysis complete: no high-confidence picks found.',
            result?.slate_note || 'No qualifying edges were identified for this slate.',
          ]
        : [
            `Generation complete: ${pickCount} picks published.`,
            result?.slate_note || 'Picks are ready in the section below.',
          ];
    }
    return [
      'Awaiting generate command.',
      "Press 'Generate Picks' to run the agent pipeline.",
    ];
  }, [status, errorMessage, result]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, CURSOR_BLINK_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const clearTimers = () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current = [];
    };

    clearTimers();
    setCursorVisible(true);

    if (status !== 'generating') {
      setHistoryLines([`› ${outcomeLines[0]}`]);
      setActiveLine(`› ${outcomeLines[1]}`);
      setActiveLineIndex(0);
      return clearTimers;
    }

    setHistoryLines([]);
    setActiveLine('');
    setActiveLineIndex(0);

    let lineIndex = 0;
    let charIndex = 0;

    const typeCurrentLine = () => {
      const fullLine = GENERATING_STEPS[lineIndex];
      if (!fullLine) return;

      setActiveLineIndex(lineIndex);
      setActiveLine('');
      charIndex = 0;

      const typeNextChar = () => {
        if (charIndex < fullLine.length) {
          setActiveLine(fullLine.substring(0, charIndex + 1));
          charIndex += 1;
          const timer = setTimeout(typeNextChar, CHAR_INTERVAL_MS);
          timersRef.current.push(timer);
          return;
        }

        if (lineIndex < GENERATING_STEPS.length - 1) {
          setHistoryLines((prev) => [...prev, `› ${fullLine}`]);
          lineIndex += 1;
          const timer = setTimeout(typeCurrentLine, LINE_PAUSE_MS);
          timersRef.current.push(timer);
          return;
        }

        setHistoryLines(GENERATING_STEPS.slice(0, GENERATING_STEPS.length - 1).map((line) => `› ${line}`));
        setActiveLine(fullLine);
        setActiveLineIndex(GENERATING_STEPS.length - 1);
      };

      typeNextChar();
    };

    const initialTimer = setTimeout(typeCurrentLine, 120);
    timersRef.current.push(initialTimer);

    return clearTimers;
  }, [status, outcomeLines]);

  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="absolute inset-0">
        <Dither />
      </div>
      <div className="relative z-10 p-4">
        <div
          className="rounded-xl border p-4"
          style={{
            background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            boxShadow: isDark ? '0 8px 32px 0 rgba(31, 38, 135, 0.5)' : '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
            borderColor: isDark ? 'rgba(0, 230, 118, 0.25)' : 'rgba(0, 186, 98, 0.28)',
          }}
        >
          <p className="text-xs font-mono mb-2" style={{ color: isDark ? '#9fb3ad' : '#7f908c' }}>
            terminal://agent-generation
          </p>

          <div className="space-y-1">
            {historyLines.map((line, index) => (
              <p key={`gen-history-${index}`} className="text-sm font-mono" style={{ color: isDark ? '#8ca89b' : '#6b7f79' }}>
                {line}
              </p>
            ))}
            <p className="text-sm font-mono" style={{ color: isDark ? '#00E676' : '#0f7d4f' }}>
              {status === 'generating' ? `› ${activeLine}${cursorVisible ? ' █' : ''}` : activeLine}
            </p>
          </div>

          {status === 'generating' ? (
            <p className="mt-2 text-[11px] font-mono" style={{ color: isDark ? '#9fb3ad' : '#7f908c' }}>
              Step {Math.min(activeLineIndex + 1, GENERATING_STEPS.length)} of {GENERATING_STEPS.length}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
