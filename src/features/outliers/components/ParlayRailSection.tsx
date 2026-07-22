// Shared band for the two MLB Parlay God rails (Parlay God + Props Cheats): a
// SectionHeader with a client-side category quick-filter, a Pro gate, and a
// HorizontalCardRail of ParlayTicketCard. The two surfaces differ only in
// title/subtitle/icon and which ticket array they render, so they're exported
// as thin presets. See specs/outliers_spec.md §4b.
import * as React from 'react';
import { useMemo, useState } from 'react';
import { Flame, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ios';
import {
  ProGate,
  PARLAY_CATEGORY_ORDER,
  PARLAY_CATEGORY_TITLE,
  type ParlayGodCategory,
  type ParlayTicket,
} from '@/features/parlayGod';
import { SectionHeader } from './SectionHeader';
import { HorizontalCardRail } from './HorizontalCardRail';
import { ParlayTicketCard } from './ParlayTicketCard';
import { ParlayTicketCardSkeleton } from './ParlayTicketCardSkeleton';
import { useHorizontalRail, type HorizontalRail } from '../hooks/useHorizontalRail';

const ALL = 'all';
const PRO_GATE_MIN_HEIGHT = 244;

interface ParlayRailSectionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tickets: ParlayTicket[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** When set, an empty (loaded) slate shows this muted line instead of hiding. */
  emptyNote?: string;
  sectionId?: string;
}

function TicketRail({ tickets, rail }: { tickets: ParlayTicket[]; rail: HorizontalRail }) {
  return (
    <HorizontalCardRail rail={rail} className="scrollbar-transparent">
      {tickets.map((ticket) => (
        <div key={ticket.id} className="shrink-0 snap-start">
          <ParlayTicketCard ticket={ticket} />
        </div>
      ))}
    </HorizontalCardRail>
  );
}

function SkeletonRail() {
  return (
    <HorizontalCardRail className="scrollbar-transparent">
      {[0, 1, 2].map((i) => (
        <div key={i} className="shrink-0">
          <ParlayTicketCardSkeleton />
        </div>
      ))}
    </HorizontalCardRail>
  );
}

export function ParlayRailSection({
  title,
  subtitle,
  icon,
  tickets,
  isLoading,
  isError,
  onRetry,
  emptyNote,
  sectionId,
}: ParlayRailSectionProps) {
  const [category, setCategory] = useState<string>(ALL);

  // Category options follow the canonical order, limited to what's on the slate.
  const presentCategories = useMemo(() => {
    const present = new Set(tickets.map((t) => t.category));
    return PARLAY_CATEGORY_ORDER.filter((c) => present.has(c));
  }, [tickets]);

  // A refresh can retire the selected category; fall back to "all" if so.
  const effectiveCategory =
    category !== ALL && presentCategories.includes(category as ParlayGodCategory) ? category : ALL;

  const shownTickets =
    effectiveCategory === ALL ? tickets : tickets.filter((t) => t.category === effectiveCategory);

  const rail = useHorizontalRail(shownTickets.length);

  const selector =
    presentCategories.length > 1
      ? {
          connective: 'Showing',
          value: effectiveCategory,
          onChange: setCategory,
          options: [
            { value: ALL, label: 'All categories' },
            ...presentCategories.map((c) => ({ value: c, label: PARLAY_CATEGORY_TITLE[c] })),
          ],
        }
      : undefined;

  // Empty (loaded) slate: hide entirely unless a muted note is provided.
  if (!isLoading && !isError && tickets.length === 0 && !emptyNote) {
    return null;
  }

  const showRailControls = !isLoading && !isError && tickets.length > 0 && rail.hasOverflow;

  return (
    <section id={sectionId} className="group scroll-mt-24 flex min-w-0 flex-col gap-2.5">
      <SectionHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        selector={isLoading || isError ? undefined : selector}
        action={
          showRailControls
            ? {
                kind: 'chevrons',
                onPrev: rail.scrollPrev,
                onNext: rail.scrollNext,
                canPrev: rail.canScrollLeft,
                canNext: rail.canScrollRight,
                revealOnHover: true,
              }
            : undefined
        }
      />

      {isLoading ? (
        <ProGate title={title} minHeight={PRO_GATE_MIN_HEIGHT}>
          <SkeletonRail />
        </ProGate>
      ) : isError ? (
        <GlassCard className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-foreground">Couldn't load {title}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </GlassCard>
      ) : tickets.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{emptyNote}</p>
      ) : (
        <ProGate title={title} minHeight={PRO_GATE_MIN_HEIGHT}>
          <TicketRail tickets={shownTickets} rail={rail} />
        </ProGate>
      )}
    </section>
  );
}

// MARK: - Presets

interface RailPresetProps {
  tickets: ParlayTicket[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  sectionId?: string;
}

export function ParlayGodSection(props: RailPresetProps) {
  return (
    <ParlayRailSection
      title="Parlay God"
      subtitle="Perfect-streak parlays built from today's slate"
      icon={<Zap />}
      {...props}
    />
  );
}

export function PropsCheatsSection(props: RailPresetProps) {
  return (
    <ParlayRailSection
      title="Props Cheats"
      subtitle="Player props that hit in 100% of tracked games"
      icon={<Flame />}
      // Props can lag overnight — a note beats a vanished section.
      emptyNote="Props post each morning — check back."
      {...props}
    />
  );
}
