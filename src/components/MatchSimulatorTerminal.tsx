import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface MatchSimulatorTerminalProps {
  /** Call when the terminal animation finishes all steps */
  onComplete: () => void;
}

const SIMULATION_STEPS = [
  'Initializing match engine...',
  'Loading team rosters and depth charts...',
  'Ingesting season averages and recent form...',
  'Adjusting for home-court advantage and travel fatigue...',
  'Factoring in injury reports and lineup changes...',
  'Analyzing pace-of-play and tempo matchup...',
  'Running 10,000 Monte Carlo game simulations...',
  'Weighting offensive and defensive efficiency ratings...',
  'Calibrating against current Vegas lines and market odds...',
  'Aggregating scenario outcomes and finalizing score...',
];

const CHAR_INTERVAL_MS = 14;
const LINE_PAUSE_MS = 200;
const CURSOR_BLINK_MS = 500;

export function MatchSimulatorTerminal({ onComplete }: MatchSimulatorTerminalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const [historyLines, setHistoryLines] = useState<string[]>([]);
  const [activeLine, setActiveLine] = useState('');
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);

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
    setHistoryLines([]);
    setActiveLine('');
    setActiveLineIndex(0);
    setCursorVisible(true);

    let lineIndex = 0;
    let charIndex = 0;

    const typeCurrentLine = () => {
      const fullLine = SIMULATION_STEPS[lineIndex];
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

        if (lineIndex < SIMULATION_STEPS.length - 1) {
          setHistoryLines((prev) => [...prev, `› ${fullLine}`]);
          lineIndex += 1;
          const timer = setTimeout(typeCurrentLine, LINE_PAUSE_MS);
          timersRef.current.push(timer);
          return;
        }

        // Last line finished — notify parent
        setHistoryLines(SIMULATION_STEPS.slice(0, SIMULATION_STEPS.length - 1).map((l) => `› ${l}`));
        setActiveLine(fullLine);
        setActiveLineIndex(SIMULATION_STEPS.length - 1);

        const doneTimer = setTimeout(onComplete, 400);
        timersRef.current.push(doneTimer);
      };

      typeNextChar();
    };

    const initialTimer = setTimeout(typeCurrentLine, 120);
    timersRef.current.push(initialTimer);

    return clearTimers;
  }, []); // runs once on mount

  return (
    <div
      className="rounded-xl border p-4 mt-3"
      style={{
        background: isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(15, 20, 18, 0.92)',
        boxShadow: isDark
          ? '0 8px 32px 0 rgba(31, 38, 135, 0.4)'
          : '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
        borderColor: 'rgba(0, 230, 118, 0.25)',
      }}
    >
      <p className="text-xs font-mono mb-2" style={{ color: '#9fb3ad' }}>
        terminal://match-simulator
      </p>

      <div className="space-y-1 max-h-[170px] overflow-y-auto">
        {historyLines.map((line, index) => (
          <p key={`sim-history-${index}`} className="text-[13px] font-mono" style={{ color: '#8ca89b' }}>
            {line}
          </p>
        ))}
        <p className="text-[13px] font-mono" style={{ color: '#00E676' }}>
          › {activeLine}
          {cursorVisible ? ' █' : ''}
        </p>
      </div>

      <p className="mt-2 text-[11px] font-mono" style={{ color: '#9fb3ad' }}>
        Step {Math.min(activeLineIndex + 1, SIMULATION_STEPS.length)} of {SIMULATION_STEPS.length}
      </p>
    </div>
  );
}
