import * as React from 'react';
import { Pagination } from '@heroui/react';

/**
 * Fixed row window + HeroUI pager, per WIDGET_DESIGN rule 9. Situational trend
 * blocks are multi-line, so a horizontal scroller would truncate them and hide
 * how many were left; paging keeps every block full-width and countable.
 */
export function usePaged<T>(items: T[], perPage: number) {
  const [page, setPage] = React.useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  // A refetch can shrink the list out from under the current page.
  const activePage = Math.min(page, pageCount);
  const visible = items.slice((activePage - 1) * perPage, activePage * perPage);
  return { page: activePage, setPage, pageCount, visible };
}

export function Pager({
  pageCount,
  page,
  onChange,
  label,
}: {
  pageCount: number;
  page: number;
  onChange: (p: number) => void;
  label: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex justify-center pt-0.5">
      <Pagination
        total={pageCount}
        page={page}
        onChange={onChange}
        size="sm"
        radius="md"
        variant="light"
        showControls
        aria-label={label}
      />
    </div>
  );
}
