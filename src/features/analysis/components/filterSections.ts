import * as React from 'react';

/**
 * Context the FilterDrawer provides so each FilterGroup can self-report activity.
 * A group looks up its own `title` in `groupFields`, diffs those snapshot keys against the
 * bet-type defaults, and uses the count to badge itself + float to the top (CSS `order`).
 */
export interface FilterSectionsMeta {
  snapshot: Record<string, unknown>;
  /** `adapter.reset(betType)` — the pristine snapshot for the active bet type. */
  defaults: Record<string, unknown>;
  groupFields: Record<string, readonly string[]>;
}

export interface FilterSectionsCtxValue extends FilterSectionsMeta {
  /**
   * Titles that were dirty when the drawer was summoned. Ordering uses THIS frozen set — not the
   * live counts — so a section never teleports to the top mid-interaction; the float re-sorts on
   * the next open.
   */
  floatTitles: ReadonlySet<string>;
  /**
   * Bumped each time the panel's "Minimize all" is pressed. Each FilterGroup watches this and
   * collapses when it changes (never on mount), so one click closes every open section.
   */
  collapseSignal: number;
}

export const FilterSectionsCtx = React.createContext<FilterSectionsCtxValue | null>(null);

export function countDirtyFields(
  meta: FilterSectionsMeta | null,
  title: string,
): number {
  if (!meta) return 0;
  const fields = meta.groupFields[title];
  if (!fields) return 0;
  let n = 0;
  for (const key of fields) {
    if (JSON.stringify(meta.snapshot[key] ?? null) !== JSON.stringify(meta.defaults[key] ?? null)) n++;
  }
  return n;
}

/** All group titles with at least one dirty field — captured once per drawer open. */
export function dirtyTitles(meta: FilterSectionsMeta): Set<string> {
  const out = new Set<string>();
  for (const title of Object.keys(meta.groupFields)) {
    if (countDirtyFields(meta, title) > 0) out.add(title);
  }
  return out;
}
