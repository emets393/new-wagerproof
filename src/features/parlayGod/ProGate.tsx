// Section-level Pro gate — the web stand-in for iOS `ProContentSection`. Pro
// users and admins see the children; everyone else sees them blurred under a
// tap-to-unlock pill that routes to /access-denied (same CTA target as
// FreemiumUpgradeBanner).
import * as React from 'react';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';

interface ProGateProps {
  /** Shown in the unlock pill, e.g. "Parlay God". */
  title: string;
  /** Floor height so the blurred band still has body. */
  minHeight?: number;
  children: React.ReactNode;
}

export function ProGate({ title, minHeight = 244, children }: ProGateProps) {
  const { hasProAccess } = useRevenueCat();
  // Keyed off `isAdmin` rather than AdminModeContext's `adminModeEnabled`:
  // that one is `isAdmin && <toggled on>`, so an admin would have to flip the
  // admin-mode switch just to stop seeing their own product blurred.
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  if (hasProAccess || isAdmin) return <>{children}</>;

  return (
    <div className="relative" style={{ minHeight }}>
      {/* Real content, dimmed + inert underneath the blur. */}
      <div className="pointer-events-none select-none opacity-30" aria-hidden>
        {children}
      </div>
      <button
        type="button"
        onClick={() => navigate('/access-denied')}
        className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl backdrop-blur-md transition-colors hover:bg-background/10"
        aria-label={`Unlock ${title}`}
      >
        <span className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-background/80 px-4 py-2 text-sm font-semibold text-foreground shadow-sm">
          <Lock className="h-4 w-4 text-amber-500" />
          {title} · Tap to unlock
        </span>
      </button>
    </div>
  );
}
