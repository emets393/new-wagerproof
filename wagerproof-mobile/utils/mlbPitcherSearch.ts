/** Accent/case folding so "Jose" matches "José". */
export function foldSearchText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function filterPitchers<T extends { name: string; team?: string | null }>(
  pitchers: T[],
  query: string,
  limit = 40,
): T[] {
  const q = foldSearchText(query.trim());
  if (!q) return pitchers.slice(0, limit);

  const scored: { p: T; score: number }[] = [];
  for (const p of pitchers) {
    const name = foldSearchText(p.name);
    if (!name.includes(q) && !(p.team && foldSearchText(p.team).includes(q))) continue;
    const tokens = name.split(/[^a-z0-9]+/).filter(Boolean);
    let score = 2;
    if (name.startsWith(q) || tokens.some((t) => t.startsWith(q))) score = 0;
    else if (tokens.some((t) => t.includes(q))) score = 1;
    scored.push({ p, score });
  }
  scored.sort((a, b) => a.score - b.score || a.p.name.localeCompare(b.p.name));
  return scored.slice(0, limit).map((s) => s.p);
}
