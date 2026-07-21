// Masonry packing for the detail pane's widget grid.
//
// A plain two-column grid sizes every row to its tallest cell, so a short widget
// (Starting Pitchers) sitting beside a tall one (Projected Score) leaves a dead
// gap under itself until the next row starts. This measures each widget and
// gives it a `grid-row-end: span N` over a fine-grained row track, so the next
// widget packs into the leftover space instead of waiting for a new row.
//
// Why not CSS multi-column: `columns-2` also fills gaps, but it reorders the
// stack column-major (widget 2 drops below widget 1 instead of beside it) and
// fragments items across columns. This keeps real CSS Grid — normal containing
// blocks for the Recharts tooltips in NflLineMovementSection, normal portals for
// the admin payload dialogs.
//
// Operates on DOM children rather than React children on purpose: every sport's
// section stack is a fragment (`sections/<sport>/index.tsx`), so the pane can't
// introspect them without refactoring all five.
import * as React from 'react';

/**
 * Row track height. Smaller = tighter packing but more grid tracks; 4px keeps
 * the worst-case rounding error under a widget's border radius.
 */
const ROW_UNIT_PX = 4;

/**
 * Assigns row spans to a grid's children so short widgets don't reserve a full
 * row. No-ops (and restores normal flow) whenever the grid is single-column.
 *
 * @param ref   the grid container
 * @param resetKey re-measure from scratch when this changes (e.g. selected game)
 */
export function useMasonryGrid(ref: React.RefObject<HTMLElement>, resetKey?: unknown) {
  React.useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;

    let frame = 0;

    const apply = () => {
      frame = 0;
      const styles = getComputedStyle(grid);
      const columnCount = styles.gridTemplateColumns.split(' ').filter(Boolean).length;
      const children = Array.from(grid.children) as HTMLElement[];

      // Single column (narrow pane): plain stacked flow, let the gap class work.
      if (columnCount < 2) {
        grid.style.gridAutoRows = '';
        grid.style.rowGap = '';
        for (const child of children) child.style.gridRowEnd = '';
        return;
      }

      // Read the gap off columnGap, never rowGap — rowGap is zeroed below, so
      // reading it back would collapse the spacing to 0 on the second pass.
      const gap = parseFloat(styles.columnGap) || 0;

      grid.style.gridAutoRows = `${ROW_UNIT_PX}px`;
      // The gap is folded into each span instead; a real row gap would double it.
      grid.style.rowGap = '0px';

      for (const child of children) {
        const height = child.getBoundingClientRect().height;
        // Zero-height children are portal hosts (admin dialogs) — give them the
        // smallest possible footprint rather than a full row.
        const span = height > 0 ? Math.ceil((height + gap) / ROW_UNIT_PX) : 1;
        const next = `span ${Math.max(1, span)}`;
        // Only write on change: a no-op style write still notifies ResizeObserver.
        if (child.style.gridRowEnd !== next) child.style.gridRowEnd = next;
      }
    };

    // Batch into a frame — widgets resolve async data at different times and
    // would otherwise trigger a measure per settling widget.
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    const resizeObserver = new ResizeObserver(schedule);
    const observeAll = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(grid);
      for (const child of Array.from(grid.children)) resizeObserver.observe(child);
    };

    // Widgets mount and unmount as queries resolve, so re-subscribe on churn.
    const mutationObserver = new MutationObserver(() => {
      observeAll();
      schedule();
    });
    mutationObserver.observe(grid, { childList: true });

    observeAll();
    apply();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [ref, resetKey]);
}
