import { cn } from '@/lib/utils';
import { getAvatarBackground, getPrimaryColor, DEFAULT_AGENT_COLOR } from '@/utils/agentColors';
import { agentSpriteIndex } from '@/utils/agentSprites';
import { PixelSpriteAvatar } from './PixelSpriteAvatar';

interface AgentAvatarTileProps {
  /** Seed for the pixel character (stable per agent, matches iOS/RN). */
  agentId: string;
  /** avatar_profiles.sprite_index override (0-7) when the user picked one. */
  spriteIndexOverride?: number | null;
  /** Fallback when no agentId is available (shouldn't happen in practice). */
  emoji?: string | null;
  color: string | null | undefined;
  /** Tile edge in px (list cards 52, detail hero 72). */
  size?: number;
  /** Circle instead of rounded square (leaderboard rows, hero disc). */
  round?: boolean;
  className?: string;
}

/**
 * iOS-style agent avatar: rounded tile washed with the agent's gradient plus
 * a colored halo shadow, with the agent's pixel-sprite character centered
 * (the sprite is never tinted — only the chrome takes the agent color).
 */
export function AgentAvatarTile({
  agentId,
  spriteIndexOverride,
  emoji,
  color,
  size = 52,
  round = false,
  className,
}: AgentAvatarTileProps) {
  const value = color || DEFAULT_AGENT_COLOR;
  const primary = getPrimaryColor(value);

  return (
    <div
      className={cn('grid shrink-0 place-items-center overflow-hidden', round ? 'rounded-full' : 'rounded-2xl', className)}
      style={{
        width: size,
        height: size,
        background: getAvatarBackground(value),
        boxShadow: `0 4px 18px ${primary}40`,
      }}
    >
      {agentId ? (
        // iOS insets the sprite 3pt in a 52pt tile; scale that ratio.
        <PixelSpriteAvatar
          spriteIndex={agentSpriteIndex(agentId, spriteIndexOverride)}
          height={size - Math.round(size * 0.12)}
        />
      ) : (
        <span style={{ fontSize: size * 0.46 }}>{emoji || '🤖'}</span>
      )}
    </div>
  );
}
