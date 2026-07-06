import * as React from 'react';

// Sheet geometry from iOS PixelOfficeAssets.swift: 8×9 grid of 48×64 frames.
const SHEET_COLS = 8;
const SHEET_ROWS = 9;
const FRAME_W = 48;
const FRAME_H = 64;
// front_idle animation = frames [0,1,2,3] (row 0, cols 0-3) at 2.5 fps.
const IDLE_FRAMES = 4;
const FPS = 2.5;

interface PixelSpriteAvatarProps {
  spriteIndex: number;
  /** Rendered frame height in px (width follows the 48:64 ratio). */
  height: number;
  className?: string;
}

/**
 * The agent's pixel character (web port of iOS PixelSpriteAvatar): crops the
 * front_idle frames from public/pixel-office/avatar_{n}.png via CSS
 * background-position and bobs at 2.5 fps. Frame phase is offset by
 * spriteIndex so a list of cards doesn't animate in unison. Nearest-neighbor
 * scaling keeps pixels crisp.
 */
export function PixelSpriteAvatar({ spriteIndex, height, className }: PixelSpriteAvatarProps) {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000 / FPS);
    return () => clearInterval(id);
  }, []);

  const idx = ((spriteIndex % 8) + 8) % 8;
  const frame = (tick + idx) % IDLE_FRAMES;
  const width = (height * FRAME_W) / FRAME_H;
  const scale = height / FRAME_H;

  return (
    <div
      aria-hidden
      className={className}
      style={{
        width,
        height,
        backgroundImage: `url(/pixel-office/avatar_${idx}.png)`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${SHEET_COLS * FRAME_W * scale}px ${SHEET_ROWS * FRAME_H * scale}px`,
        backgroundPosition: `-${frame * FRAME_W * scale}px 0px`,
        imageRendering: 'pixelated',
      }}
    />
  );
}
