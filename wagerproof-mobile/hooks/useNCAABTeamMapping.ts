import { useState, useEffect } from 'react';
import { collegeFootballSupabase } from '@/services/collegeFootballClient';

export interface NCAABTeamInfo {
  abbrev: string | null;
  logoUrl: string | null;
}

type NCAABTeamMap = Map<string, NCAABTeamInfo>;

let cachedMap: NCAABTeamMap | null = null;
let fetchPromise: Promise<NCAABTeamMap> | null = null;

async function fetchMapping(): Promise<NCAABTeamMap> {
  const { data, error } = await collegeFootballSupabase
    .from('ncaab_team_mapping')
    .select('teamranking_team_name, team_abbrev, espn_team_id');

  const map: NCAABTeamMap = new Map();
  if (error || !data) return map;

  for (const row of data as any[]) {
    const name = row.teamranking_team_name != null ? String(row.teamranking_team_name).trim() : '';
    if (!name) continue;

    let logoUrl: string | null = null;
    if (row.espn_team_id != null && row.espn_team_id !== '') {
      const espnId = typeof row.espn_team_id === 'string' ? parseInt(row.espn_team_id, 10) : row.espn_team_id;
      if (!Number.isNaN(espnId)) logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`;
    }

    const abbrev = row.team_abbrev != null && String(row.team_abbrev).trim() !== '' ? String(row.team_abbrev).trim() : null;
    const info: NCAABTeamInfo = { abbrev, logoUrl };

    map.set(name, info);
    map.set(name.toLowerCase(), info);
  }
  return map;
}

function getMapping(): Promise<NCAABTeamMap> {
  if (cachedMap) return Promise.resolve(cachedMap);
  if (!fetchPromise) {
    fetchPromise = fetchMapping().then((map) => {
      cachedMap = map;
      fetchPromise = null;
      return map;
    });
  }
  return fetchPromise;
}

export function lookupNCAABTeam(teamName: string, map: NCAABTeamMap): NCAABTeamInfo | null {
  if (!teamName) return null;
  const trimmed = teamName.trim();
  // Exact match first
  const exact = map.get(trimmed) ?? map.get(trimmed.toLowerCase());
  if (exact) return exact;

  // Substring/contains fallback for name mismatches (e.g., "Central Arkansas" vs "Cent. Arkansas Bears")
  // Only attempt if the search term is long enough to avoid false positives
  const lower = trimmed.toLowerCase();
  if (lower.length >= 6) {
    for (const [key, info] of map) {
      if (key !== key.toLowerCase()) continue;
      if (key.includes(lower) || lower.includes(key)) {
        return info;
      }
    }
  }
  return null;
}

export function useNCAABTeamMapping(): { teamMap: NCAABTeamMap; isLoaded: boolean } {
  const [teamMap, setTeamMap] = useState<NCAABTeamMap>(cachedMap || new Map());
  const [isLoaded, setIsLoaded] = useState(!!cachedMap);

  useEffect(() => {
    if (cachedMap) {
      setTeamMap(cachedMap);
      setIsLoaded(true);
      return;
    }
    getMapping().then((map) => {
      setTeamMap(map);
      setIsLoaded(true);
    });
  }, []);

  return { teamMap, isLoaded };
}
