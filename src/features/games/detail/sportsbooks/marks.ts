/** Bundled sportsbook marks. Same files as the app's `sportsbook_<key>` images. */
const LOCAL_SPORTSBOOK_MARKS = new Set([
  'betmgm',
  'betonlineag',
  'betrivers',
  'betus',
  'bovada',
  'draftkings',
  'espnbet',
  'fanatics',
  'fanduel',
  'mybookieag',
  'williamhill_us',
]);

export function sportsbookMarkUrl(bookKey?: string | null): string | null {
  const key = (bookKey || '').toLowerCase();
  if (!LOCAL_SPORTSBOOK_MARKS.has(key)) return null;
  return `/sportsbooks/${key}.png`;
}
