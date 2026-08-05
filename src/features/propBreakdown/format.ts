/** Formatting helpers only — no derived analytics. */

export function formatPerGame(value: number | undefined | null, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return n.toFixed(digits).replace(/\.0$/, '');
}

export function formatPctile(pctile: number | undefined | null): string {
  if (pctile === null || pctile === undefined || Number.isNaN(Number(pctile))) return '—';
  const n = Math.round(Number(pctile));
  const mod = n % 10;
  const mod100 = n % 100;
  const suffix =
    mod === 1 && mod100 !== 11 ? 'st' : mod === 2 && mod100 !== 12 ? 'nd' : mod === 3 && mod100 !== 13 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

export function formatRatePct(rate: number | undefined | null): string {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) return '—';
  return `${Math.round(Number(rate) * 100)}%`;
}

export function formatAmerican(price: number | null | undefined): string {
  if (price === null || price === undefined || Number.isNaN(Number(price))) return '—';
  const n = Math.round(Number(price));
  return n > 0 ? `+${n}` : `${n}`;
}

export function formatLine(line: number | null | undefined): string {
  if (line === null || line === undefined || Number.isNaN(Number(line))) return '';
  const n = Number(line);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function topBadge(pctile: number | null | undefined): string {
  if (pctile === null || pctile === undefined || Number.isNaN(Number(pctile))) return '—';
  const rank = Math.max(1, 100 - Math.round(Number(pctile)));
  return `TOP ${rank}%`;
}

export function kickoffShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
}
