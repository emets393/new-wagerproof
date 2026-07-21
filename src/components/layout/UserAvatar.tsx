// Identity chip for the sidebar footer. No avatar images exist in the product
// yet, so identity is carried by a gradient derived from the address itself —
// deterministic, so a given account always looks the same across sessions and
// devices, and distinct enough to tell two accounts apart at a glance.
import * as React from 'react';
import { cn } from '@/lib/utils';

/** FNV-ish string hash — only needs to be stable and well-spread, not secure. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface UserAvatarProps {
  email: string;
  /** Rendered size in px. */
  size?: number;
  className?: string;
}

export function UserAvatar({ email, size = 24, className }: UserAvatarProps) {
  const { initials, gradient } = React.useMemo(() => {
    const local = email.split('@')[0] || email;
    // "jane.doe" / "jane_doe" → JD; otherwise the first two characters.
    const parts = local.split(/[._+-]+/).filter(Boolean);
    const raw =
      parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : local.slice(0, 2);

    // Two stops ~48° apart keeps every hue reading as one color family rather
    // than a rainbow smear, at a lightness that holds white text in both themes.
    const hue = hashString(email) % 360;
    return {
      initials: (raw || '?').toUpperCase(),
      gradient: `linear-gradient(135deg, hsl(${hue} 68% 58%) 0%, hsl(${(hue + 48) % 360} 72% 46%) 100%)`,
    };
  }, [email]);

  return (
    <span
      aria-hidden
      style={{ background: gradient, width: size, height: size }}
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-full',
        'font-bold leading-none text-white ring-1 ring-inset ring-white/15',
        '[text-shadow:0_1px_1px_rgba(0,0,0,0.25)]',
        className,
      )}
    >
      <span style={{ fontSize: Math.round(size * 0.42) }}>{initials}</span>
    </span>
  );
}
