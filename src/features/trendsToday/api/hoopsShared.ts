/**
 * NBA and NCAAB share one situational-trends schema (ATS + O/U records per
 * angle), so the row type and angle builder live here and each sport's fetcher
 * only supplies its own team-branding and tipoff-time joins.
 */

import type { TrendAngle } from '../types';
import { formatSituation, hoopsOuLean, parseRecord, sideLeanFor, toTrendPct } from './shared';

export interface HoopsSituationalTrendRow {
  game_id: number;
  game_date: string;
  team_id: number;
  team_abbr: string;
  team_name: string;
  team_side: 'home' | 'away';
  last_game_situation: string | null;
  fav_dog_situation: string | null;
  side_spread_situation: string | null;
  home_away_situation: string | null;
  rest_bucket: string | null;
  rest_comp: string | null;
  ats_last_game_record: string | null;
  ats_last_game_cover_pct: number | null;
  ats_fav_dog_record: string | null;
  ats_fav_dog_cover_pct: number | null;
  ats_side_fav_dog_record: string | null;
  ats_side_fav_dog_cover_pct: number | null;
  ats_home_away_record: string | null;
  ats_home_away_cover_pct: number | null;
  ats_rest_bucket_record: string | null;
  ats_rest_bucket_cover_pct: number | null;
  ats_rest_comp_record: string | null;
  ats_rest_comp_cover_pct: number | null;
  ou_last_game_record: string | null;
  ou_last_game_over_pct: number | null;
  ou_last_game_under_pct: number | null;
  ou_fav_dog_record: string | null;
  ou_fav_dog_over_pct: number | null;
  ou_fav_dog_under_pct: number | null;
  ou_side_fav_dog_record: string | null;
  ou_side_fav_dog_over_pct: number | null;
  ou_side_fav_dog_under_pct: number | null;
  ou_home_away_record: string | null;
  ou_home_away_over_pct: number | null;
  ou_home_away_under_pct: number | null;
  ou_rest_bucket_record: string | null;
  ou_rest_bucket_over_pct: number | null;
  ou_rest_bucket_under_pct: number | null;
  ou_rest_comp_record: string | null;
  ou_rest_comp_over_pct: number | null;
  ou_rest_comp_under_pct: number | null;
}

interface HoopsAngleSpec {
  key: string;
  label: string;
  situation: keyof HoopsSituationalTrendRow;
  atsRecord: keyof HoopsSituationalTrendRow;
  atsPct: keyof HoopsSituationalTrendRow;
  ouRecord: keyof HoopsSituationalTrendRow;
  ouOver: keyof HoopsSituationalTrendRow;
  ouUnder: keyof HoopsSituationalTrendRow;
}

/**
 * All six angles the schema carries. The legacy NBA page rendered only five of
 * these — it fetched the home/away columns but never displayed or scored them,
 * while NCAAB did. Both sports include it here; an angle with no data on either
 * side is dropped below, so NBA loses nothing if its columns are empty.
 */
const HOOPS_ANGLES: HoopsAngleSpec[] = [
  {
    key: 'home_away',
    label: 'Home / away',
    situation: 'home_away_situation',
    atsRecord: 'ats_home_away_record',
    atsPct: 'ats_home_away_cover_pct',
    ouRecord: 'ou_home_away_record',
    ouOver: 'ou_home_away_over_pct',
    ouUnder: 'ou_home_away_under_pct',
  },
  {
    key: 'last_game',
    label: 'Last game',
    situation: 'last_game_situation',
    atsRecord: 'ats_last_game_record',
    atsPct: 'ats_last_game_cover_pct',
    ouRecord: 'ou_last_game_record',
    ouOver: 'ou_last_game_over_pct',
    ouUnder: 'ou_last_game_under_pct',
  },
  {
    key: 'fav_dog',
    label: 'Favorite / underdog',
    situation: 'fav_dog_situation',
    atsRecord: 'ats_fav_dog_record',
    atsPct: 'ats_fav_dog_cover_pct',
    ouRecord: 'ou_fav_dog_record',
    ouOver: 'ou_fav_dog_over_pct',
    ouUnder: 'ou_fav_dog_under_pct',
  },
  {
    key: 'side_spread',
    label: 'Side + spread',
    situation: 'side_spread_situation',
    atsRecord: 'ats_side_fav_dog_record',
    atsPct: 'ats_side_fav_dog_cover_pct',
    ouRecord: 'ou_side_fav_dog_record',
    ouOver: 'ou_side_fav_dog_over_pct',
    ouUnder: 'ou_side_fav_dog_under_pct',
  },
  {
    key: 'rest_bucket',
    label: 'Rest bucket',
    situation: 'rest_bucket',
    atsRecord: 'ats_rest_bucket_record',
    atsPct: 'ats_rest_bucket_cover_pct',
    ouRecord: 'ou_rest_bucket_record',
    ouOver: 'ou_rest_bucket_over_pct',
    ouUnder: 'ou_rest_bucket_under_pct',
  },
  {
    key: 'rest_comp',
    label: 'Rest vs opponent',
    situation: 'rest_comp',
    atsRecord: 'ats_rest_comp_record',
    atsPct: 'ats_rest_comp_cover_pct',
    ouRecord: 'ou_rest_comp_record',
    ouOver: 'ou_rest_comp_over_pct',
    ouUnder: 'ou_rest_comp_under_pct',
  },
];

function statFor(row: HoopsSituationalTrendRow, spec: HoopsAngleSpec) {
  const sideRecord = (row[spec.atsRecord] as string | null) ?? null;
  const ouRecord = (row[spec.ouRecord] as string | null) ?? null;
  return {
    situation: formatSituation(row[spec.situation] as string | null),
    sidePct: toTrendPct(row[spec.atsPct] as number | null),
    sideRecord,
    sideGames: sideRecord ? parseRecord(sideRecord).total : null,
    overPct: toTrendPct(row[spec.ouOver] as number | null),
    underPct: toTrendPct(row[spec.ouUnder] as number | null),
    ouRecord,
    ouGames: ouRecord ? parseRecord(ouRecord).total : null,
  };
}

export function buildHoopsAngles(
  away: HoopsSituationalTrendRow,
  home: HoopsSituationalTrendRow,
): TrendAngle[] {
  return HOOPS_ANGLES.map((spec) => {
    const awayStat = statFor(away, spec);
    const homeStat = statFor(home, spec);
    return {
      key: spec.key,
      label: spec.label,
      away: awayStat,
      home: homeStat,
      sideLean: sideLeanFor(awayStat.sidePct, homeStat.sidePct),
      ouLean: hoopsOuLean(
        awayStat.overPct,
        awayStat.underPct,
        homeStat.overPct,
        homeStat.underPct,
      ),
    };
    // An angle with nothing on either side is noise in the table, not a gap
    // worth showing — the NBA home/away columns are frequently empty.
  }).filter(
    (angle) =>
      angle.away.sidePct !== null ||
      angle.home.sidePct !== null ||
      angle.away.overPct !== null ||
      angle.home.overPct !== null,
  );
}
