import { cn } from '@/lib/utils';

/**
 * Selection indicator for the /agents feed cards: an agent-color wash bleeding
 * in from each edge — the same language the /games feed cards use. Replaces a
 * `ring-2` outline, which competed with the card's hairline border and read as
 * a focus state. Parent must be `relative overflow-hidden`.
 */
export function AgentSelectionGlow({
  primary,
  secondary,
}: {
  primary: string;
  secondary: string;
}) {
  return (
    <>
      {(['left', 'right'] as const).map((side) => (
        <span
          key={side}
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 w-3/5 opacity-30 dark:opacity-40',
            side === 'left' ? 'left-0' : 'right-0',
          )}
          style={{
            background: `radial-gradient(125% 100% at ${side === 'left' ? '0%' : '100%'} 50%, ${
              side === 'left' ? primary : secondary
            } 0%, transparent 72%)`,
          }}
        />
      ))}
    </>
  );
}
