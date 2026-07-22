// Sidebar nav row + its shared active indicator.
//
// The active state is ONE signal: a soft-cornered surface that physically slides
// between rows on navigation (framer-motion `layoutId`). This is the same thumb
// language as `@/components/ios/SegmentedControl` and `SportPicker`, so the
// sidebar reads as part of the app rather than a separate widget. It replaces an
// older treatment that stacked a gradient fill, a colored glow, a right border
// and a pulsing dot — four competing signals that also left hover with nothing
// distinct to say.
//
// INVARIANT: exactly one row in the tree may render <ActivePill /> at a time.
// Two mounted pills sharing a layoutId makes framer-motion animate between the
// duplicates. `AppLayout` enforces this by resolving a single `activeKey`.
import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';

const PILL_LAYOUT_ID = 'sidebar-active-pill';

/**
 * The sliding indicator. Rendered inside the row (absolute, behind the content),
 * so the row keeps its own hit area and this stays purely decorative.
 */
export function ActivePill({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const { state } = useSidebar();

  // Drop the layoutId (→ the pill cuts straight to its new row) in two cases:
  // reduced-motion, and the icon-collapsed rail. Collapsed rows must keep
  // `overflow-hidden` to clip their labels, which would slice the pill apart
  // mid-flight — snapping reads better than a clipped slide.
  const animate = !reduceMotion && state !== 'collapsed';

  return (
    <motion.span
      aria-hidden
      layoutId={animate ? PILL_LAYOUT_ID : undefined}
      transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
      className={cn(
        // rounded-md matches the row's own radius from sidebarMenuButtonVariants,
        // so the indicator reads as the row's surface rather than a chip laid on it.
        'absolute inset-0 rounded-md bg-honeydew-100 dark:bg-honeydew-400/15',
        className,
      )}
    />
  );
}

/**
 * Neutralizes the shadcn button's own active/hover fills — the pill is the only
 * surface now, so `data-[active=true]:bg-*` and the hover fill would double up.
 * Keyed off whether the row carries the pill, not off `aria-current`, so a
 * parent standing in for a collapsed child still looks selected.
 */
function rowClasses(selected: boolean) {
  return cn(
    'relative cursor-pointer transition-colors duration-200',
    // Tighter than the shadcn default (h-8/text-sm/p-2). The collapsed rail is
    // unaffected — its `!size-8 !p-2` carries `!important` and still wins.
    'h-7 px-2 py-1 text-[13px]',
    // Collapsed, `!size-8` pins the row to 32px inside a full-width slot, which
    // would otherwise leave it hugging the left edge. Center it in the rail.
    'group-data-[collapsible=icon]:mx-auto',
    // The row ships `overflow-hidden`, which would clip the pill mid-slide —
    // a layoutId animation renders the element in its NEW row while transformed
    // back to the old one. Expanded rows let it through; the collapsed rail
    // keeps clipping (it needs to hide labels) and drops the animation instead.
    'overflow-visible group-data-[collapsible=icon]:overflow-hidden',
    selected
      ? // The pill is the surface; the row itself never paints one.
        'font-semibold text-foreground hover:bg-transparent active:bg-transparent'
      : 'font-medium text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
  );
}

/** Icon slot — the accent lives here and in the pill, nowhere else. */
function NavIcon({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'relative z-10 transition-colors duration-200',
        active && 'text-honeydew-600 dark:text-honeydew-400',
      )}
    >
      {children}
    </span>
  );
}

// A <div>, not a <span>: the row's base style truncates its LAST span child,
// which must stay the title. A trailing span here would steal that.
function WipTag() {
  return (
    <div className="relative z-10 ml-2 flex items-center gap-1">
      <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
      <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">WIP</span>
    </div>
  );
}

interface SidebarNavButtonProps {
  title: string;
  status?: string;
  icon?: React.ReactNode;
  active: boolean;
  /** A child row owns the active state — emphasize without taking the pill. */
  partial?: boolean;
  /** This row renders the shared pill. False when a collapsed child owns it. */
  showPill?: boolean;
  wip?: boolean;
  onClick: () => void;
  className?: string;
}

/** Top-level sidebar row. */
export function SidebarNavButton({
  title,
  status,
  icon,
  active,
  partial = false,
  showPill = active,
  wip,
  onClick,
  className,
}: SidebarNavButtonProps) {
  const emphasized = showPill || partial;
  return (
    <SidebarMenuButton
      onClick={onClick}
      // Styling is ours; `isActive` would re-apply the shadcn fill on top of the pill.
      isActive={false}
      aria-current={active ? 'page' : undefined}
      className={cn(
        rowClasses(showPill),
        // A parent whose tool page is open reads as emphasized, not selected.
        partial && !showPill && 'font-semibold text-foreground',
        className,
      )}
    >
      {showPill && <ActivePill />}
      {icon && <NavIcon active={emphasized}>{icon}</NavIcon>}
      <span className="relative z-10">{title}</span>
      {status && (
        <div className="pointer-events-none absolute inset-x-7 z-10 text-center text-[10px] font-normal tabular-nums text-muted-foreground/55 group-data-[collapsible=icon]:hidden">
          {status}
        </div>
      )}
      {wip && <WipTag />}
    </SidebarMenuButton>
  );
}

export interface SidebarSubNavEntry {
  to: string;
  title: string;
  icon?: React.ReactNode;
}

interface SidebarCollapsibleNavItemProps {
  title: string;
  status?: string;
  icon?: React.ReactNode;
  wip?: boolean;
  /** This parent row itself owns the active state. */
  active: boolean;
  /** `to` of the sub-row that owns the active state, if any. */
  activeSubTo: string | null;
  subItems: SidebarSubNavEntry[];
  onNavigate: (to: string) => void;
  /** Parent's own destination; omitted for label-only groups. */
  to?: string;
}

/**
 * A nav row with a nested tool list. The chevron is a separate trigger from the
 * label so expanding the group doesn't navigate away from the current page.
 *
 * Open state is controlled here (not `defaultOpen`) so the group knows whether
 * its active child is actually on screen: when the user collapses a group that
 * holds the active row, the parent takes the pill instead — otherwise the
 * sidebar would show no active indicator at all.
 */
export function SidebarCollapsibleNavItem({
  title,
  status,
  icon,
  wip,
  active,
  activeSubTo,
  subItems,
  onNavigate,
  to,
}: SidebarCollapsibleNavItemProps) {
  const hasActiveChild = activeSubTo !== null;
  const [open, setOpen] = React.useState(active || hasActiveChild);
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  // Following a link into the group (e.g. from search) should reveal the row.
  React.useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  const showPillOnParent = active || (hasActiveChild && !open);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <div className="relative flex items-center">
          <SidebarNavButton
            title={title}
            status={status}
            icon={icon}
            active={active}
            partial={hasActiveChild}
            showPill={showPillOnParent}
            wip={wip}
            onClick={() => to && onNavigate(to)}
            // Expanded, the button owns the full row while the chevron overlays
            // its right edge. This lets centered labels use the same midpoint as
            // rows without a chevron. The icon rail keeps its pinned 32px size.
            className={collapsed ? undefined : 'w-full pr-8'}
          />
          {/* Unmounted rather than CSS-hidden on the icon rail: a `hidden` button
              still occupied its flex slot, pushing the icon off-center and
              leaving a sliver of chevron visible at the row's right edge. */}
          {!collapsed && (
            <CollapsibleTrigger asChild>
              <button
                type="button"
                aria-label={`Toggle ${title} tools`}
                className={cn(
                  'absolute right-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md',
                  'text-muted-foreground transition-colors duration-200',
                  'hover:bg-sidebar-accent/50 hover:text-foreground',
                )}
              >
                <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </button>
            </CollapsibleTrigger>
          )}
        </div>

        <CollapsibleContent>
          <SidebarMenuSub className="gap-0.5 py-0.5">
            {subItems.map((sub) => (
              <SidebarMenuSubItem key={sub.to}>
                <SidebarNavSubButton
                  title={sub.title}
                  icon={sub.icon}
                  active={activeSubTo === sub.to}
                  onClick={() => onNavigate(sub.to)}
                />
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

interface SidebarNavSubButtonProps {
  title: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

/** Nested tool row. Same pill, inset to sit inside the sub-menu rail. */
export function SidebarNavSubButton({ title, icon, active, onClick }: SidebarNavSubButtonProps) {
  return (
    <SidebarMenuSubButton
      onClick={onClick}
      isActive={false}
      aria-current={active ? 'page' : undefined}
      // A step smaller than its parent row so the nesting reads without indent alone.
      className={cn('mr-0.5', rowClasses(active), 'h-6 text-[12px]')}
    >
      {active && <ActivePill />}
      {icon && <NavIcon active={active}>{icon}</NavIcon>}
      <span className="relative z-10">{title}</span>
    </SidebarMenuSubButton>
  );
}
