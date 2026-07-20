// src/features/analysis/normalizeSavedFilterSnapshot.ts
var NFL_ASOF_DEFAULTS = {
  winPct: [0, 100],
  winStreak: [0, 16],
  lossStreak: [0, 16],
  above500: null,
  winPctGtOpp: null,
  ppg: [0, 40],
  paPg: [0, 40],
  pointDiffPg: [-20, 20],
  minGames: 0,
  atsWinPct: [0, 100],
  atsWinStreak: [0, 16],
  avgCoverMargin: [-15, 15],
  overPct: [0, 100],
  overStreak: [0, 16],
  underStreak: [0, 16],
  prevWins: [0, 16],
  prevWinPct: [0, 100],
  madePlayoffsPrev: null,
  moreWinsThanOppPrev: null,
  h2hLastWin: "any",
  h2hLastAts: "any",
  h2hLastOver: "any",
  h2hLastHome: null,
  h2hLastFav: null,
  h2hSameSeason: null,
  h2hSpreadCmp: "any",
  oppWinPct: [0, 100],
  oppOverPct: [0, 100],
  oppWinStreak: [0, 16],
  oppPrevWinPct: [0, 100]
};
var CFB_ASOF_DEFAULTS = {
  ...NFL_ASOF_DEFAULTS,
  ppg: [0, 60],
  paPg: [0, 60],
  pointDiffPg: [-40, 40],
  avgCoverMargin: [-30, 30],
  prevWins: [0, 15]
};
function isNativeSnapshot(raw) {
  return typeof raw.seasonMin === "number" || typeof raw.seasonMax === "number";
}
function asPair(value, fallback) {
  if (Array.isArray(value) && value.length >= 2) {
    const a = Number(value[0]);
    const b = Number(value[1]);
    if (!Number.isNaN(a) && !Number.isNaN(b)) return [a, b];
  }
  return fallback;
}
function str(value, fallback) {
  return typeof value === "string" ? value : fallback;
}
function optionalBool(value) {
  return typeof value === "boolean" ? value : null;
}
function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string" && v.length > 0);
}
var NFL_MARGIN_BOUNDS = [-60, 60];
function blowoutFallback(v) {
  if (v === "win") return [21, 60];
  if (v === "loss") return [-60, -21];
  return NFL_MARGIN_BOUNDS;
}
function lastGameFields(r) {
  return {
    lastResult: str(r.lastResult, "any"),
    lastAts: str(r.lastAts, "any"),
    lastTotal: str(r.lastTotal, "any"),
    lastRole: str(r.lastRole, "any"),
    lastOt: optionalBool(r.lastOt),
    lastBlowout: str(r.lastBlowout, "any")
  };
}
function nflLastGameFields(r) {
  return {
    lastResult: str(r.lastResult, "any"),
    lastAts: str(r.lastAts, "any"),
    lastTotal: str(r.lastTotal, "any"),
    lastRole: str(r.lastRole, "any"),
    lastOt: optionalBool(r.lastOt),
    lastMargin: asPair(r.lastMargin, blowoutFallback(r.lastBlowout))
  };
}
function oppLastGameFields(r) {
  return {
    oppLastResult: str(r.oppLastResult, "any"),
    oppLastAts: str(r.oppLastAts, "any"),
    oppLastTotal: str(r.oppLastTotal, "any"),
    oppLastRole: str(r.oppLastRole, "any"),
    oppLastOt: optionalBool(r.oppLastOt),
    oppLastMargin: asPair(r.oppLastMargin, blowoutFallback(r.oppLastBlowout))
  };
}
function asofFields(r, d = NFL_ASOF_DEFAULTS) {
  return {
    winPct: asPair(r.winPct, d.winPct),
    winStreak: asPair(r.winStreak, d.winStreak),
    lossStreak: asPair(r.lossStreak, d.lossStreak),
    above500: optionalBool(r.above500),
    winPctGtOpp: optionalBool(r.winPctGtOpp),
    ppg: asPair(r.ppg, d.ppg),
    paPg: asPair(r.paPg, d.paPg),
    pointDiffPg: asPair(r.pointDiffPg, d.pointDiffPg),
    minGames: typeof r.minGames === "number" ? r.minGames : d.minGames,
    atsWinPct: asPair(r.atsWinPct, d.atsWinPct),
    atsWinStreak: asPair(r.atsWinStreak, d.atsWinStreak),
    avgCoverMargin: asPair(r.avgCoverMargin, d.avgCoverMargin),
    overPct: asPair(r.overPct, d.overPct),
    overStreak: asPair(r.overStreak, d.overStreak),
    underStreak: asPair(r.underStreak, d.underStreak),
    prevWins: asPair(r.prevWins, d.prevWins),
    prevWinPct: asPair(r.prevWinPct, d.prevWinPct),
    madePlayoffsPrev: optionalBool(r.madePlayoffsPrev),
    moreWinsThanOppPrev: optionalBool(r.moreWinsThanOppPrev),
    h2hLastWin: str(r.h2hLastWin, "any"),
    h2hLastAts: str(r.h2hLastAts, "any"),
    h2hLastOver: str(r.h2hLastOver, "any"),
    h2hLastHome: optionalBool(r.h2hLastHome),
    h2hLastFav: optionalBool(r.h2hLastFav),
    h2hSameSeason: optionalBool(r.h2hSameSeason),
    h2hSpreadCmp: str(r.h2hSpreadCmp, "any"),
    oppWinPct: asPair(r.oppWinPct, d.oppWinPct),
    oppOverPct: asPair(r.oppOverPct, d.oppOverPct),
    oppWinStreak: asPair(r.oppWinStreak, d.oppWinStreak),
    oppPrevWinPct: asPair(r.oppPrevWinPct, d.oppPrevWinPct)
  };
}
function cfbSystemsFields(r) {
  return {
    daysOfWeek: stringList(r.daysOfWeek),
    lastMargin: asPair(r.lastMargin, [-80, 80]),
    oppLastResult: str(r.oppLastResult, "any"),
    oppLastAts: str(r.oppLastAts, "any"),
    oppLastTotal: str(r.oppLastTotal, "any"),
    oppLastRole: str(r.oppLastRole, "any"),
    oppLastOt: optionalBool(r.oppLastOt),
    oppLastMargin: asPair(r.oppLastMargin, [-80, 80]),
    ...asofFields(r, CFB_ASOF_DEFAULTS)
  };
}
function resolveSelectedConferences(raw) {
  const selected = raw.selectedConferences;
  if (Array.isArray(selected) && selected.length > 0) {
    return selected.filter((c) => typeof c === "string" && c.length > 0);
  }
  const legacy = raw.conference;
  if (typeof legacy === "string" && legacy !== "any") return [legacy];
  return [];
}
function normalizeCfbSavedFilterSnapshot(raw, rowBetType) {
  const r = raw ?? {};
  const betType = str(r.betType, rowBetType || "fg_spread");
  if (!isNativeSnapshot(r)) {
    return {
      betType,
      seasons: asPair(r.seasons, [2016, 2025]),
      weeks: asPair(r.weeks, [1, 16]),
      side: str(r.side, "any"),
      favDog: str(r.favDog, "any"),
      gameType: str(r.gameType, "any"),
      rankedMatchup: str(r.rankedMatchup, "any"),
      spreadSide: str(r.spreadSide, "any"),
      spreadSize: asPair(r.spreadSize, [0, 28]),
      lineRange: asPair(r.lineRange, [30, 80]),
      mlMin: str(r.mlMin, ""),
      mlMax: str(r.mlMax, ""),
      primetime: optionalBool(r.primetime),
      conferenceGame: optionalBool(r.conferenceGame),
      neutralSite: optionalBool(r.neutralSite),
      selectedConferences: resolveSelectedConferences(r),
      tempRange: asPair(r.tempRange, [-10, 110]),
      windMax: typeof r.windMax === "number" ? r.windMax : 60,
      weather: str(r.weather, "any"),
      dome: str(r.dome, "any"),
      teams: stringList(r.teams),
      opponents: stringList(r.opponents),
      ...lastGameFields(r),
      ...cfbSystemsFields(r)
    };
  }
  return {
    betType,
    seasons: [Number(r.seasonMin ?? 2016), Number(r.seasonMax ?? 2025)],
    weeks: [Number(r.weekMin ?? 1), Number(r.weekMax ?? 16)],
    side: str(r.side, "any"),
    favDog: str(r.favDog, "any"),
    gameType: str(r.gameType, "any"),
    rankedMatchup: str(r.rankedMatchup, "any"),
    spreadSide: str(r.spreadSide, "any"),
    spreadSize: [Number(r.spreadMin ?? 0), Number(r.spreadMax ?? 28)],
    lineRange: [Number(r.lineMin ?? 30), Number(r.lineMax ?? 80)],
    mlMin: str(r.mlMin, ""),
    mlMax: str(r.mlMax, ""),
    primetime: optionalBool(r.primetime),
    conferenceGame: optionalBool(r.conferenceGame),
    neutralSite: optionalBool(r.neutralSite),
    selectedConferences: resolveSelectedConferences(r),
    tempRange: [Number(r.tempMin ?? -10), Number(r.tempMax ?? 110)],
    windMax: typeof r.windMax === "number" ? r.windMax : 60,
    weather: str(r.weather, "any"),
    dome: str(r.dome, "any"),
    teams: stringList(r.teams),
    opponents: stringList(r.opponents),
    ...lastGameFields(r),
    ...cfbSystemsFields(r)
  };
}
function normalizeNflSavedFilterSnapshot(raw, rowBetType) {
  const r = raw ?? {};
  const betType = str(r.betType, rowBetType || "fg_spread");
  if (!isNativeSnapshot(r)) {
    return {
      betType,
      seasons: asPair(r.seasons, [2018, 2025]),
      weeks: asPair(r.weeks, [1, 18]),
      side: str(r.side, "any"),
      seasonType: str(r.seasonType, "any"),
      playoffRound: str(r.playoffRound, "any"),
      favDog: str(r.favDog, "any"),
      spreadSide: str(r.spreadSide, "any"),
      spreadSize: asPair(r.spreadSize, [0, 20]),
      lineRange: asPair(r.lineRange, [30, 60]),
      mlMin: str(r.mlMin, ""),
      mlMax: str(r.mlMax, ""),
      primetime: optionalBool(r.primetime),
      division: optionalBool(r.division),
      dome: str(r.dome, "any"),
      tempRange: asPair(r.tempRange, [-10, 100]),
      windMax: typeof r.windMax === "number" ? r.windMax : 60,
      precip: str(r.precip, "any"),
      restBye: str(r.restBye, "any"),
      coach: str(r.coach, "any"),
      referee: str(r.referee, "any"),
      teams: stringList(r.teams),
      opponents: stringList(r.opponents),
      daysOfWeek: stringList(r.daysOfWeek),
      teamDivisions: stringList(r.teamDivisions),
      ...nflLastGameFields(r),
      ...oppLastGameFields(r),
      ...asofFields(r)
    };
  }
  return {
    betType,
    seasons: [Number(r.seasonMin ?? 2018), Number(r.seasonMax ?? 2025)],
    weeks: [Number(r.weekMin ?? 1), Number(r.weekMax ?? 18)],
    side: str(r.side, "any"),
    seasonType: str(r.seasonType, "any"),
    playoffRound: str(r.playoffRound, "any"),
    favDog: str(r.favDog, "any"),
    spreadSide: str(r.spreadSide, "any"),
    spreadSize: [Number(r.spreadMin ?? 0), Number(r.spreadMax ?? 20)],
    lineRange: [Number(r.lineMin ?? 30), Number(r.lineMax ?? 60)],
    mlMin: str(r.mlMin, ""),
    mlMax: str(r.mlMax, ""),
    primetime: optionalBool(r.primetime),
    division: optionalBool(r.division),
    dome: str(r.dome, "any"),
    tempRange: [Number(r.tempMin ?? -10), Number(r.tempMax ?? 100)],
    windMax: typeof r.windMax === "number" ? r.windMax : 60,
    precip: str(r.precip, "any"),
    restBye: str(r.restBye, "any"),
    coach: str(r.coach, "any"),
    referee: str(r.referee, "any"),
    teams: stringList(r.teams),
    opponents: stringList(r.opponents),
    daysOfWeek: stringList(r.daysOfWeek),
    teamDivisions: stringList(r.teamDivisions),
    ...nflLastGameFields(r),
    ...oppLastGameFields(r),
    ...asofFields(r)
  };
}
var MLB_SNAPSHOT_DEFAULTS = {
  betType: "ml",
  seasons: [2023, 2026],
  months: [3, 11],
  teams: [],
  opponents: [],
  side: "any",
  favDog: "any",
  mlMin: "",
  mlMax: "",
  lineRange: [5, 14],
  timeMin: "",
  timeMax: "",
  daysOfWeek: [],
  doubleheader: null,
  seriesGame: [1, 6],
  trip: [1, 5],
  switchGame: null,
  restRange: [0, 10],
  division: null,
  interleague: null,
  tempRange: [30, 110],
  windRange: [0, 40],
  windDir: "any",
  dome: null,
  pfRuns: [85, 115],
  spNames: [],
  oppSpNames: [],
  spHand: "any",
  oppSpHand: "any",
  spXfip: [2, 7],
  oppSpXfip: [2, 7],
  bpIp: [0, 20],
  bpXfip: [2, 7],
  lastResult: "any",
  lastMargin: [-30, 30],
  winLossStreak: [-25, 25],
  oppLastResult: "any",
  oppLastMargin: [-30, 30],
  winPct: [0, 100],
  winStreak: [0, 25],
  lossStreak: [0, 25],
  rlCoverPct: [0, 100],
  rlStreak: [0, 25],
  overPct: [0, 100],
  overStreak: [0, 25],
  underStreak: [0, 25],
  rpg: [0, 10],
  rapg: [0, 10],
  runDiffPg: [-4, 4],
  prevWins: [0, 120],
  prevWinPct: [0, 100],
  minGames: 0,
  h2hLastWin: "any",
  h2hLastOver: "any",
  h2hLastMargin: [-30, 30],
  h2hSameSeason: null,
  oppWinPct: [0, 100],
  oppOverPct: [0, 100],
  oppRlCoverPct: [0, 100],
  oppWinStreak: [0, 25],
  oppLossStreak: [0, 25],
  oppRpg: [0, 10],
  oppRapg: [0, 10],
  oppPrevWinPct: [0, 100]
};
function pairFromStrings(minS, maxS, def) {
  const lo = typeof minS === "string" && minS.trim() !== "" ? Number(minS) : NaN;
  const hi = typeof maxS === "string" && maxS.trim() !== "" ? Number(maxS) : NaN;
  return [Number.isFinite(lo) ? lo : def[0], Number.isFinite(hi) ? hi : def[1]];
}
function pairFromOpt(opt, def) {
  if (!opt || typeof opt !== "object") return def;
  const o = opt;
  const lo = Number(o.min);
  const hi = Number(o.max);
  return [Number.isFinite(lo) ? lo : def[0], Number.isFinite(hi) ? hi : def[1]];
}
function pitcherNames(v) {
  if (!Array.isArray(v)) return [];
  return v.map((p) => typeof p === "string" ? p : p && typeof p === "object" && typeof p.name === "string" ? p.name : "").filter((n) => n.length > 0);
}
function normalizeMlbSavedFilterSnapshot(raw, rowBetType) {
  const r = raw ?? {};
  const d = MLB_SNAPSHOT_DEFAULTS;
  const legacyDay = typeof r.dayOfWeek === "string" && r.dayOfWeek !== "any" ? [r.dayOfWeek] : [];
  return {
    betType: str(r.betType, rowBetType || "ml"),
    seasons: asPair(r.seasons, d.seasons),
    months: asPair(r.months, d.months),
    teams: stringList(r.teams),
    opponents: stringList(r.opponents),
    side: str(r.side, "any"),
    favDog: str(r.favDog, "any"),
    mlMin: str(r.mlMin, ""),
    mlMax: str(r.mlMax, ""),
    lineRange: r.totalBounds ? pairFromOpt(r.totalBounds, d.lineRange) : asPair(r.lineRange, d.lineRange),
    timeMin: str(r.timeMin, ""),
    timeMax: str(r.timeMax, ""),
    daysOfWeek: stringList(r.daysOfWeek).length ? stringList(r.daysOfWeek) : legacyDay,
    doubleheader: optionalBool(r.doubleheader),
    seriesGame: r.seriesGame == null ? d.seriesGame : asPair(r.seriesGame, d.seriesGame),
    trip: r.trip == null ? d.trip : asPair(r.trip, d.trip),
    switchGame: optionalBool(r.switchGame),
    restRange: asPair(r.restRange, d.restRange),
    division: optionalBool(r.division),
    interleague: optionalBool(r.interleague),
    tempRange: asPair(r.tempRange, d.tempRange),
    windRange: asPair(r.windRange, d.windRange),
    windDir: str(r.windDir, "any"),
    dome: optionalBool(r.dome),
    pfRuns: r.pfRuns == null ? d.pfRuns : pairFromOpt(r.pfRuns, d.pfRuns),
    spNames: stringList(r.spNames).length ? stringList(r.spNames) : pitcherNames(r.sp),
    oppSpNames: stringList(r.oppSpNames).length ? stringList(r.oppSpNames) : pitcherNames(r.oppSp),
    spHand: str(r.spHand, "any"),
    oppSpHand: str(r.oppSpHand, "any"),
    spXfip: r.spXfip == null ? d.spXfip : pairFromOpt(r.spXfip, d.spXfip),
    oppSpXfip: r.oppSpXfip == null ? d.oppSpXfip : pairFromOpt(r.oppSpXfip, d.oppSpXfip),
    bpIp: r.bpIp == null ? d.bpIp : pairFromOpt(r.bpIp, d.bpIp),
    bpXfip: r.bpXfip == null ? d.bpXfip : pairFromOpt(r.bpXfip, d.bpXfip),
    lastResult: str(r.lastResult, "any"),
    lastMargin: Array.isArray(r.lastMargin) ? asPair(r.lastMargin, d.lastMargin) : pairFromStrings(r.lastMarginMin, r.lastMarginMax, d.lastMargin),
    winLossStreak: Array.isArray(r.winLossStreak) ? asPair(r.winLossStreak, d.winLossStreak) : pairFromStrings(r.streakMin, r.streakMax, d.winLossStreak),
    oppLastResult: str(r.oppLastResult, "any"),
    oppLastMargin: asPair(r.oppLastMargin, d.oppLastMargin),
    winPct: asPair(r.winPct, d.winPct),
    winStreak: asPair(r.winStreak, d.winStreak),
    lossStreak: asPair(r.lossStreak, d.lossStreak),
    rlCoverPct: asPair(r.rlCoverPct, d.rlCoverPct),
    rlStreak: asPair(r.rlStreak, d.rlStreak),
    overPct: asPair(r.overPct, d.overPct),
    overStreak: asPair(r.overStreak, d.overStreak),
    underStreak: asPair(r.underStreak, d.underStreak),
    rpg: asPair(r.rpg, d.rpg),
    rapg: asPair(r.rapg, d.rapg),
    runDiffPg: asPair(r.runDiffPg, d.runDiffPg),
    prevWins: asPair(r.prevWins, d.prevWins),
    prevWinPct: asPair(r.prevWinPct, d.prevWinPct),
    minGames: typeof r.minGames === "number" ? r.minGames : 0,
    h2hLastWin: str(r.h2hLastWin, "any"),
    h2hLastOver: str(r.h2hLastOver, "any"),
    h2hLastMargin: asPair(r.h2hLastMargin, d.h2hLastMargin),
    h2hSameSeason: optionalBool(r.h2hSameSeason),
    oppWinPct: asPair(r.oppWinPct, d.oppWinPct),
    oppOverPct: asPair(r.oppOverPct, d.oppOverPct),
    oppRlCoverPct: asPair(r.oppRlCoverPct, d.oppRlCoverPct),
    oppWinStreak: asPair(r.oppWinStreak, d.oppWinStreak),
    oppLossStreak: asPair(r.oppLossStreak, d.oppLossStreak),
    oppRpg: asPair(r.oppRpg, d.oppRpg),
    oppRapg: asPair(r.oppRapg, d.oppRapg),
    oppPrevWinPct: asPair(r.oppPrevWinPct, d.oppPrevWinPct)
  };
}

// src/features/analysis/filterSchema.ts
var NFL_BET_TYPES = [
  "fg_spread",
  "fg_ml",
  "fg_total",
  "team_total",
  "h1_spread",
  "h1_ml",
  "h1_total"
];
var NFL_TEAM_ABBRS = [
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LAC",
  "LAR",
  "LV",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS"
];
var NFL_TEAM_ALIASES = { LA: "LAR", WSH: "WAS", JAC: "JAX", OAK: "LV", SD: "LAC", STL: "LAR" };
var NFL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var NFL_DAY_ALIASES = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  tues: "Tue",
  wed: "Wed",
  thu: "Thu",
  thur: "Thu",
  thurs: "Thu",
  fri: "Fri",
  sat: "Sat"
};
var NFL_DIVISIONS = ["AFC East", "AFC North", "AFC South", "AFC West", "NFC East", "NFC North", "NFC South", "NFC West"];
var NFL_LIMITED_BET_TYPES = ["h1_spread", "h1_ml", "h1_total", "team_total"];
var SPREAD_CONTROL_BET_TYPES = ["fg_spread", "h1_spread", "fg_ml", "h1_ml"];
var TOTAL_CONTROL_BET_TYPES = ["fg_total", "h1_total", "team_total"];
var DEFAULT_NFL_SNAPSHOT = {
  betType: "fg_spread",
  seasons: [2018, 2025],
  weeks: [1, 18],
  side: "any",
  seasonType: "any",
  playoffRound: "any",
  favDog: "any",
  spreadSide: "any",
  spreadSize: [0, 20],
  lineRange: [30, 60],
  mlMin: "",
  mlMax: "",
  primetime: null,
  division: null,
  dome: "any",
  tempRange: [-10, 100],
  windMax: 60,
  precip: "any",
  restBye: "any",
  coach: "any",
  referee: "any",
  lastResult: "any",
  lastAts: "any",
  lastTotal: "any",
  lastRole: "any",
  lastOt: null,
  lastMargin: [-60, 60],
  oppLastResult: "any",
  oppLastAts: "any",
  oppLastTotal: "any",
  oppLastRole: "any",
  oppLastOt: null,
  oppLastMargin: [-60, 60],
  teams: [],
  opponents: [],
  daysOfWeek: [],
  teamDivisions: [],
  ...NFL_ASOF_DEFAULTS
};
var NFL_FILTER_DIMENSIONS = {
  // ── Situation ──
  seasons: {
    group: "Situation",
    kind: "numRange",
    min: 2018,
    max: 2025,
    step: 1,
    limitedFloor: 2023,
    label: "Seasons",
    aliases: ["year", "years", "season range", "since"],
    rpcNote: "season_min only if > floor; season_max only if < 2025. Floor = 2023 for limited markets, else 2018."
  },
  seasonType: {
    group: "Situation",
    kind: "enum",
    label: "Season type",
    options: [["any", "Regular + Playoffs"], ["regular", "Regular season"], ["postseason", "Playoffs only"]],
    aliases: ["playoffs", "postseason", "regular season"],
    rpcNote: "regular \u2192 season_type='regular' (+ weeks); postseason \u2192 season_type='postseason' (+ playoff_round)."
  },
  weeks: {
    group: "Situation",
    kind: "numRange",
    min: 1,
    max: 18,
    step: 1,
    label: "Weeks",
    availability: { requires: { key: "seasonType", equals: "regular" } },
    aliases: ["week", "early season", "late season"],
    rpcNote: "week_min/week_max \u2014 only sent when seasonType = regular."
  },
  playoffRound: {
    group: "Situation",
    kind: "enum",
    label: "Playoff round",
    options: [["any", "All rounds"], ["Wild Card", "Wild Card"], ["Divisional", "Divisional"], ["Conference", "Conference"], ["Super Bowl", "Super Bowl"]],
    availability: { requires: { key: "seasonType", equals: "postseason" } },
    rpcNote: "playoff_round \u2014 only sent when seasonType = postseason. Values are Title Case."
  },
  side: {
    group: "Situation",
    kind: "enum",
    label: "Side",
    options: [["any", "Either"], ["home", "Home"], ["away", "Away"]],
    aliases: ["home", "away", "road", "at home", "on the road"],
    rpcNote: "f.side = 'home' | 'away'."
  },
  teams: {
    group: "Situation",
    kind: "multiselect",
    optionSource: "nflTeams",
    label: "Team",
    aliases: ["team", "teams"],
    rpcNote: "f.team = array of team abbreviations (LA\u2192LAR alias applied)."
  },
  opponents: {
    group: "Situation",
    kind: "multiselect",
    optionSource: "nflTeams",
    label: "Opponent",
    aliases: ["opponent", "against", "vs", "versus", "facing"],
    rpcNote: "f.opponent = array of team abbreviations."
  },
  daysOfWeek: { group: "Situation", kind: "multiselect", optionSource: "daysOfWeek", label: "Days of week", aliases: ["day", "day of week", "weekday", "monday", "thursday", "sunday", "saturday", "which days"], rpcNote: "f.day_of_week = array of day names (Sun/Mon/Tue/Wed/Thu/Fri/Sat)." },
  spreadSide: {
    group: "Situation",
    kind: "enum",
    label: "Spread side",
    options: [["any", "Either side"], ["favorite", "Favored by"], ["underdog", "Getting"]],
    availability: { betTypes: SPREAD_CONTROL_BET_TYPES },
    aliases: ["favorite", "underdog", "favored", "getting", "laying", "dog"],
    rpcNote: "Combines with spreadSize; drives the spread sign \u2014 see spreadSize.rpcNote."
  },
  spreadSize: {
    group: "Situation",
    kind: "numRange",
    min: 0,
    max: 20,
    step: 0.5,
    unit: "pts",
    boundsByBetType: { fg_spread: [0, 20], h1_spread: [0, 14], fg_ml: [0, 20], h1_ml: [0, 20] },
    availability: { betTypes: SPREAD_CONTROL_BET_TYPES },
    label: "Spread size",
    aliases: ["spread", "points", "laying", "getting", "by"],
    rpcNote: "favorite \u2192 spread_min=-hi, spread_max=-max(lo,0.5); underdog \u2192 spread_min=max(lo,0.5), spread_max=hi; either side with a narrowed range \u2192 abs_spread_min/max. h1_spread uses h1_spread_*/h1_abs_spread_*; fg_ml/h1_ml filter by the FULL-GAME spread (spread_*/abs_spread_*)."
  },
  mlMin: {
    group: "Situation",
    kind: "mlOdds",
    bound: "min",
    label: "Moneyline odds (min)",
    aliases: ["moneyline", "odds", "american odds", "ml"],
    rpcNote: "f.ml_min = numeric American odds. Negative = favorite, positive = underdog. If both set and reversed, sorted."
  },
  mlMax: {
    group: "Situation",
    kind: "mlOdds",
    bound: "max",
    label: "Moneyline odds (max)",
    aliases: ["moneyline", "odds", "american odds", "ml"],
    rpcNote: "f.ml_max = numeric American odds. Same value in mlMin & mlMax = an exact line."
  },
  favDog: {
    group: "Situation",
    kind: "enum",
    label: "Favorite / Underdog",
    options: [["any", "Either"], ["favorite", "Favorites"], ["underdog", "Underdogs"]],
    availability: { betTypes: ["team_total"] },
    aliases: ["favorite", "underdog"],
    rpcNote: "f.fav_dog \u2014 ONLY applied for the team_total market (spread markets use spreadSide instead)."
  },
  lineRange: {
    group: "Situation",
    kind: "numRange",
    min: 30,
    max: 60,
    step: 0.5,
    boundsByBetType: { fg_total: [30, 60], h1_total: [15, 35], team_total: [10, 40] },
    availability: { betTypes: TOTAL_CONTROL_BET_TYPES },
    label: "Total line",
    aliases: ["total", "over under", "o/u", "total line", "team total line"],
    rpcNote: "total_min/total_max (fg_total), h1_total_min/max (h1_total), tt_min/tt_max (team_total)."
  },
  // ── Matchup ──
  primetime: { group: "Matchup", kind: "tristate", label: "Primetime", aliases: ["primetime", "night game", "sunday night", "monday night"], rpcNote: "f.primetime = boolean." },
  division: { group: "Matchup", kind: "tristate", label: "Divisional", aliases: ["divisional", "division game", "in division"], rpcNote: "f.division = boolean." },
  teamDivisions: { group: "Matchup", kind: "multiselect", optionSource: "nflDivisions", label: "Team division", aliases: ["division", "afc east", "nfc west", "afc north", "nfc south", "which division"], rpcNote: "f.team_division = array of division names (AFC East \u2026 NFC West)." },
  restBye: {
    group: "Matchup",
    kind: "enum",
    label: "Rest / Bye",
    options: [["any", "Any"], ["off_bye", "Off a bye"], ["pre_bye", "Week before a bye"], ["short", "Short rest (Thu)"]],
    aliases: ["bye", "rest", "off a bye", "short week", "thursday"],
    rpcNote: "off_bye \u2192 rest_min=13; short \u2192 rest_max=4; pre_bye \u2192 pre_bye=true."
  },
  // ── Weather ──
  dome: {
    group: "Weather",
    kind: "enum",
    label: "Venue",
    options: [["any", "Any"], ["dome", "Dome"], ["outdoor", "Outdoor"]],
    aliases: ["dome", "indoor", "outdoor", "retractable"],
    rpcNote: "f.dome = (dome === 'dome')."
  },
  precip: {
    group: "Weather",
    kind: "enum",
    label: "Precipitation",
    options: [["any", "Any"], ["none", "None"], ["rain", "Rain"], ["snow", "Snow"]],
    aliases: ["rain", "snow", "precipitation", "wet", "dry"],
    rpcNote: "f.precip = 'none' | 'rain' | 'snow'."
  },
  tempRange: {
    group: "Weather",
    kind: "numRange",
    min: -10,
    max: 100,
    step: 1,
    unit: "\xB0F",
    label: "Temperature",
    aliases: ["temperature", "cold", "hot", "freezing", "degrees"],
    rpcNote: "temp_min/temp_max."
  },
  windMax: {
    group: "Weather",
    kind: "scalarMax",
    min: 0,
    max: 60,
    step: 1,
    unit: "mph",
    label: "Max wind",
    aliases: ["wind", "windy", "gusts"],
    rpcNote: "f.wind_max \u2014 only sent when < 60."
  },
  // ── Context ──
  coach: { group: "Context", kind: "enum", dynamic: true, options: [["any", "Any coach"]], label: "Coach", aliases: ["coach", "head coach"], rpcNote: "f.coach = exact coach name. Options loaded from the RPC by_coach list." },
  referee: { group: "Context", kind: "enum", dynamic: true, options: [["any", "Any referee"]], label: "Referee", aliases: ["referee", "ref", "official"], rpcNote: "f.referee = exact referee name. Options loaded from the RPC by_referee list." },
  // ── Last game ──
  lastResult: { group: "Last game", kind: "enum", label: "Last game result", options: [["any", "Any"], ["won", "Won"], ["lost", "Lost"]], aliases: ["off a win", "off a loss", "last game"], rpcNote: "f.last_won = won?1:0." },
  lastAts: { group: "Last game", kind: "enum", label: "Last game ATS", options: [["any", "Any"], ["covered", "Covered"], ["not", "Didn't cover"]], aliases: ["covered last", "failed to cover"], rpcNote: "f.last_covered = covered?1:0 (else 'not')." },
  lastTotal: { group: "Last game", kind: "enum", label: "Last game total", options: [["any", "Any"], ["over", "Over"], ["under", "Under"]], aliases: ["over last game", "under last game", "coming off an under", "coming off an over", "off an under", "off an over", "last game went under", "last game went over"], rpcNote: "f.last_over = over?1:0." },
  lastRole: { group: "Last game", kind: "enum", label: "Last game role", options: [["any", "Any"], ["favorite", "Favorite"], ["underdog", "Underdog"]], aliases: ["favorite last game", "underdog last game"], rpcNote: "f.last_favorite = (lastRole === 'favorite')." },
  lastMargin: { group: "Last game", kind: "numRange", min: -60, max: 60, step: 1, unit: "pts", label: "Last game margin", aliases: ["margin", "margin of victory", "margin of loss", "won by", "lost by", "blowout"], rpcNote: "last_margin_min/max \u2014 signed: positive = won by, negative = lost by (e.g. won by 10+ = [10, 60], lost by 7+ = [-60, -7], within a TD = [-7, 7])." },
  lastOt: { group: "Last game", kind: "tristate", label: "Last game overtime", aliases: ["overtime", "ot"], rpcNote: "f.last_overtime = boolean." },
  // ── Opponent last game (the opponent's previous game; opp_last_* columns) ──
  oppLastResult: { group: "Opponent last game", kind: "enum", label: "Opponent last game result", options: [["any", "Any"], ["won", "Won"], ["lost", "Lost"]], aliases: ["opponent off a win", "opponent off a loss", "opponent won last", "opponent lost last"], rpcNote: "f.opp_last_won = won?1:0." },
  oppLastAts: { group: "Opponent last game", kind: "enum", label: "Opponent last game ATS", options: [["any", "Any"], ["covered", "Covered"], ["not", "Didn't cover"]], aliases: ["opponent covered last", "opponent failed to cover last"], rpcNote: "f.opp_last_covered = covered?1:0 (else 'not')." },
  oppLastTotal: { group: "Opponent last game", kind: "enum", label: "Opponent last game total", options: [["any", "Any"], ["over", "Over"], ["under", "Under"]], aliases: ["opponent over last game", "opponent under last game"], rpcNote: "f.opp_last_over = over?1:0." },
  oppLastRole: { group: "Opponent last game", kind: "enum", label: "Opponent last game role", options: [["any", "Any"], ["favorite", "Favorite"], ["underdog", "Underdog"]], aliases: ["opponent favorite last game", "opponent underdog last game"], rpcNote: "f.opp_last_favorite = (oppLastRole === 'favorite')." },
  oppLastMargin: { group: "Opponent last game", kind: "numRange", min: -60, max: 60, step: 1, unit: "pts", label: "Opponent last game margin", aliases: ["opponent margin", "opponent won by", "opponent lost by", "opponent blowout"], rpcNote: "opp_last_margin_min/max \u2014 signed: positive = opponent won by, negative = opponent lost by." },
  oppLastOt: { group: "Opponent last game", kind: "tristate", label: "Opponent last game overtime", aliases: ["opponent overtime", "opponent ot"], rpcNote: "f.opp_last_overtime = boolean." },
  // ── Season Record (as-of, at time of game) ──
  winPct: { group: "Season Record", kind: "pctRange", label: "Win %", aliases: ["win rate", "record", "winning percentage"], rpcNote: "win_pct_min/max \u2014 UI 0\u2013100 sent as 0\u20131." },
  winStreak: { group: "Season Record", kind: "numRange", min: 0, max: 16, step: 1, label: "Win streak", aliases: ["winning streak", "wins in a row"], rpcNote: "win_streak_min/max." },
  lossStreak: { group: "Season Record", kind: "numRange", min: 0, max: 16, step: 1, label: "Loss streak", aliases: ["losing streak", "losses in a row"], rpcNote: "loss_streak_min/max." },
  above500: { group: "Season Record", kind: "tristate", label: "Winning record (>.500)", aliases: ["winning record", "above .500", "below .500", "losing record"], rpcNote: "f.above_500 = boolean." },
  winPctGtOpp: { group: "Season Record", kind: "tristate", label: "Win% better than opponent", aliases: ["better record than opponent", "worse record"], rpcNote: "f.win_pct_gt_opp = boolean." },
  ppg: { group: "Season Record", kind: "numRange", min: 0, max: 40, step: 0.5, label: "Points per game", aliases: ["ppg", "scoring", "points scored"], rpcNote: "ppg_min/max." },
  paPg: { group: "Season Record", kind: "numRange", min: 0, max: 40, step: 0.5, label: "Points allowed per game", aliases: ["points allowed", "defense", "pa/g"], rpcNote: "pa_pg_min/max." },
  pointDiffPg: { group: "Season Record", kind: "numRange", min: -20, max: 20, step: 0.5, label: "Point differential per game", aliases: ["point differential", "margin", "net points"], rpcNote: "point_diff_pg_min/max." },
  minGames: { group: "Season Record", kind: "scalarMin", min: 0, max: 10, step: 1, label: "Min games this season", aliases: ["minimum games", "sample size", "at least N games"], rpcNote: "f.min_games \u2014 only sent when > 0. Guards thin early-season samples." },
  // ── Cover Profile ──
  atsWinPct: { group: "Cover Profile", kind: "pctRange", label: "ATS win %", aliases: ["ats win percentage", "ats percentage", "ats win rate", "cover rate", "covering X percent", "covered more than half", "covered less than half"], rpcNote: "ats_win_pct_min/max \u2014 0\u2013100 sent as 0\u20131." },
  atsWinStreak: { group: "Cover Profile", kind: "numRange", min: 0, max: 16, step: 1, label: "ATS win streak", aliases: ["cover streak", "ats streak", "covered in a row", "has not covered", "hasn't covered", "failed to cover straight"], rpcNote: "ats_win_streak_min/max." },
  avgCoverMargin: { group: "Cover Profile", kind: "numRange", min: -15, max: 15, step: 0.5, label: "Avg cover margin", aliases: ["cover margin", "average ats margin"], rpcNote: "avg_cover_margin_min/max." },
  // ── Total Profile ──
  overPct: { group: "Total Profile", kind: "pctRange", label: "Over %", aliases: ["over rate", "overs percentage", "gone over", "gone under", "hit the over", "hit the under", "overs more than half", "unders more than half", "total went over", "games totals"], rpcNote: 'over_pct_min/max \u2014 0\u2013100 sent as 0\u20131. "Gone under more than half" \u2192 overPct max \u2264 50 (under-heavy).' },
  overStreak: { group: "Total Profile", kind: "numRange", min: 0, max: 16, step: 1, label: "Over streak", aliases: ["overs in a row"], rpcNote: "over_streak_min/max." },
  underStreak: { group: "Total Profile", kind: "numRange", min: 0, max: 16, step: 1, label: "Under streak", aliases: ["unders in a row"], rpcNote: "under_streak_min/max." },
  // ── Prior Year ──
  prevWins: { group: "Prior Year", kind: "numRange", min: 0, max: 16, step: 1, label: "Last season wins", aliases: ["prior year wins", "wins last year"], rpcNote: "prev_wins_min/max." },
  prevWinPct: { group: "Prior Year", kind: "pctRange", label: "Last season win %", aliases: ["prior year record", "win rate last year"], rpcNote: "prev_win_pct_min/max \u2014 0\u2013100 sent as 0\u20131." },
  madePlayoffsPrev: { group: "Prior Year", kind: "tristate", label: "Made playoffs last year", aliases: ["made the playoffs", "missed the playoffs"], rpcNote: "f.made_playoffs_prev = boolean." },
  moreWinsThanOppPrev: { group: "Prior Year", kind: "tristate", label: "More wins than opponent last year", aliases: ["more wins than opponent last season"], rpcNote: "f.more_wins_than_opp_prev = boolean." },
  // ── Head-to-Head (last meeting vs this opponent) ──
  h2hLastWin: { group: "Head-to-Head", kind: "enum", label: "Won last meeting", options: [["any", "Any"], ["yes", "Won"], ["no", "Lost"]], aliases: ["won last meeting", "lost last meeting", "h2h"], rpcNote: "f.h2h_last_win = yes?1:0." },
  h2hLastAts: { group: "Head-to-Head", kind: "enum", label: "Covered last meeting", options: [["any", "Any"], ["yes", "Covered"], ["no", "Didn't cover"]], aliases: ["covered last meeting"], rpcNote: "f.h2h_last_ats_win = yes?1:0." },
  h2hLastOver: { group: "Head-to-Head", kind: "enum", label: "Last meeting total", options: [["any", "Any"], ["yes", "Over"], ["no", "Under"]], aliases: ["over last meeting", "under last meeting"], rpcNote: "f.h2h_last_over = yes?1:0." },
  h2hLastHome: { group: "Head-to-Head", kind: "tristate", label: "Was home last meeting", rpcNote: "f.h2h_last_home = boolean." },
  h2hLastFav: { group: "Head-to-Head", kind: "tristate", label: "Was favorite last meeting", rpcNote: "f.h2h_last_fav = boolean." },
  h2hSameSeason: { group: "Head-to-Head", kind: "tristate", label: "Same season as last meeting", rpcNote: "f.h2h_same_season = boolean." },
  h2hSpreadCmp: {
    group: "Head-to-Head",
    kind: "enum",
    label: "Spread vs last meeting",
    options: [["any", "Any"], ["lower", "Lower (more favored / less pts)"], ["higher", "Higher (less favored / more pts)"]],
    rpcNote: "lower \u2192 h2h_spread_lower=true; higher \u2192 h2h_spread_higher=true."
  },
  // ── Opponent Record ──
  oppWinPct: { group: "Opponent Record", kind: "pctRange", label: "Opponent win %", aliases: ["opponent record", "opponent win rate", "opponent winning percentage"], rpcNote: "opp_win_pct_min/max \u2014 0\u2013100 sent as 0\u20131. Wins/losses only \u2014 NEVER use for over/under language." },
  oppOverPct: { group: "Opponent Record", kind: "pctRange", label: "Opponent over %", aliases: ["opponent over rate", "opponent overs", "opponent gone under", "opponent under rate", "both teams overs", "opponent hit the under"], rpcNote: "opp_over_pct_min/max \u2014 0\u2013100 sent as 0\u20131. Season O/U tendency for the opponent." },
  oppWinStreak: { group: "Opponent Record", kind: "numRange", min: 0, max: 16, step: 1, label: "Opponent win streak", rpcNote: "opp_win_streak_min/max." },
  oppPrevWinPct: { group: "Opponent Record", kind: "pctRange", label: "Opponent last-season win %", rpcNote: "opp_prev_win_pct_min/max \u2014 0\u2013100 sent as 0\u20131." }
};
var NFL_DIMENSION_KEYS = Object.keys(NFL_FILTER_DIMENSIONS);
function numRangeBounds(dim, betType) {
  if (dim.kind !== "numRange") throw new Error("numRangeBounds called on non-numRange dimension");
  const base = dim.boundsByBetType?.[betType] ? [dim.boundsByBetType[betType][0], dim.boundsByBetType[betType][1]] : [dim.min, dim.max];
  if (dim.limitedFloor != null && NFL_LIMITED_BET_TYPES.includes(betType)) {
    base[0] = Math.max(base[0], dim.limitedFloor);
  }
  return base;
}
var NFL_SIDE_SYMMETRIC_DIMS = [
  "seasons",
  "weeks",
  "seasonType",
  "playoffRound",
  "lineRange",
  "spreadSize",
  "primetime",
  "division",
  "dome",
  "tempRange",
  "windMax",
  "precip",
  "referee",
  "daysOfWeek",
  "minGames"
];
var NFL_SIDE_BREAKING_DIMS = NFL_DIMENSION_KEYS.filter(
  (k) => !NFL_SIDE_SYMMETRIC_DIMS.includes(k)
);
function nflBetTypeSideEffects(next) {
  const bt = next.betType;
  next.spreadSize = [...numRangeBounds(NFL_FILTER_DIMENSIONS.spreadSize, bt)];
  next.lineRange = [...numRangeBounds(NFL_FILTER_DIMENSIONS.lineRange, bt)];
  const floor = numRangeBounds(NFL_FILTER_DIMENSIONS.seasons, bt)[0];
  if (next.seasons[0] < floor) next.seasons = [floor, next.seasons[1]];
}
var lowerKeys = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k.toLowerCase(), v]));
var NFL_SPORT_CONFIG = {
  sport: "nfl",
  betTypes: NFL_BET_TYPES,
  defaultSnapshot: DEFAULT_NFL_SNAPSHOT,
  dimensions: NFL_FILTER_DIMENSIONS,
  optionLists: {
    nflTeams: { values: NFL_TEAM_ABBRS, aliases: lowerKeys(NFL_TEAM_ALIASES) },
    daysOfWeek: { values: NFL_DAYS, aliases: NFL_DAY_ALIASES },
    nflDivisions: { values: NFL_DIVISIONS }
  },
  dynamicEnumCtx: { coach: "coaches", referee: "referees" },
  applyBetTypeSideEffects: nflBetTypeSideEffects,
  numRangeBounds: (dim, bt) => numRangeBounds(dim, bt)
};

// src/features/analysis/sportFilterEngine.ts
var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
var roundToStep = (v, step) => Number((Math.round(v / step) * step).toFixed(4));
var isNum = (v) => typeof v === "number" && Number.isFinite(v);
var pairEq = (a, b) => a[0] === b[0] && a[1] === b[1];
var cloneSnapshot = (s) => JSON.parse(JSON.stringify(s));
function resolveOption(raw, list, override) {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  const values = override ?? list.values;
  if (values.includes(t)) return t;
  const alias = list.aliases?.[t.toLowerCase()];
  if (alias && values.includes(alias)) return alias;
  const up = t.toUpperCase();
  if (values.includes(up)) return up;
  const ci = values.find((v) => v.toLowerCase() === t.toLowerCase());
  return ci ?? null;
}
function isDimensionAvailableGeneric(dim, betType, snapshot) {
  if (dim.availability?.betTypes && !dim.availability.betTypes.includes(betType)) {
    return { ok: false, reason: `${dim.label} is not available for the ${betType} market` };
  }
  return { ok: true };
}
function coerceSetValue(cfg, dimKey, dim, value, next, ctx) {
  const bt = String(next.betType);
  switch (dim.kind) {
    case "enum": {
      if (typeof value !== "string") return { ok: false, reason: "expected a string option value" };
      if (value === "any") return { ok: true, value: "any" };
      if (dim.options.some(([v]) => v === value && v !== "any")) return { ok: true, value };
      if (dim.dynamic) {
        const listName = cfg.dynamicEnumCtx?.[dimKey];
        const list = listName ? ctx.lists?.[listName] : void 0;
        if (!list) return { ok: false, reason: `${dim.label} options are not loaded, cannot verify "${value}"` };
        const hit = list.find((o) => o.toLowerCase() === value.toLowerCase());
        return hit ? { ok: true, value: hit } : { ok: false, reason: `"${value}" is not a known ${dim.label}` };
      }
      return { ok: false, reason: `"${value}" is not a valid ${dim.label} option` };
    }
    case "tristate": {
      if (value === null || value === "any") return { ok: true, value: null };
      if (value === true || value === "yes" || value === "true" || value === 1) return { ok: true, value: true };
      if (value === false || value === "no" || value === "false" || value === 0) return { ok: true, value: false };
      return { ok: false, reason: "expected true, false, or null/any" };
    }
    case "numRange":
    case "pctRange": {
      if (!Array.isArray(value) || value.length < 2) return { ok: false, reason: "expected a [min, max] range" };
      const a0 = Number(value[0]);
      const b0 = Number(value[1]);
      if (!isNum(a0) || !isNum(b0)) return { ok: false, reason: "range bounds must be numbers" };
      const [min, max] = dim.kind === "pctRange" ? [0, 100] : cfg.numRangeBounds(dim, bt);
      const step = dim.kind === "pctRange" ? 1 : dim.step;
      if (dim.kind === "pctRange" && (a0 > 0 && a0 < 1 || b0 > 0 && b0 < 1)) {
        return { ok: false, reason: "percent values use 0\u2013100 (looks like a 0\u20131 fraction)" };
      }
      let a = clamp(roundToStep(a0, step), min, max);
      let b = clamp(roundToStep(b0, step), min, max);
      if (a > b) {
        const t = a;
        a = b;
        b = t;
      }
      const used = [a, b];
      const note = pairEq(used, [a0, b0]) ? void 0 : `clamped to [${a}, ${b}]`;
      return { ok: true, value: used, note };
    }
    case "scalarMax":
    case "scalarMin": {
      if (!isNum(Number(value))) return { ok: false, reason: "expected a number" };
      const raw = Number(value);
      const used = clamp(roundToStep(raw, dim.step), dim.min, dim.max);
      return { ok: true, value: used, note: used === raw ? void 0 : `clamped to ${used}` };
    }
    case "text": {
      if (value === "" || value === null) return { ok: true, value: "" };
      if (typeof value !== "string") return { ok: false, reason: "expected a string" };
      const t = value.trim();
      if (dim.pattern && !new RegExp(dim.pattern).test(t)) {
        return { ok: false, reason: `${dim.label} must match ${dim.pattern}` };
      }
      return { ok: true, value: t };
    }
    case "mlOdds": {
      const n = typeof value === "string" ? Number(value.trim()) : Number(value);
      if (value === "" || value === null) return { ok: true, value: "" };
      if (!isNum(n)) return { ok: false, reason: "moneyline must be a number" };
      if (n > -100 && n < 100) return { ok: false, reason: "American odds are \u2265 +100 or \u2264 \u2212100" };
      return { ok: true, value: String(Math.round(n)) };
    }
    case "multiselect": {
      if (!Array.isArray(value)) return { ok: false, reason: "expected an array" };
      const list = cfg.optionLists[dim.optionSource];
      if (!list) return { ok: false, reason: `${dim.label} options are not configured` };
      const override = ctx.optionOverrides?.[dim.optionSource];
      if (!list.values.length && !override) {
        return { ok: false, reason: `${dim.label} options are not loaded, cannot verify values` };
      }
      const out = [];
      const bad = [];
      for (const item of value) {
        const t = resolveOption(item, list, override);
        if (t) {
          if (!out.includes(t)) out.push(t);
        } else bad.push(String(item));
      }
      if (bad.length && !out.length) return { ok: false, reason: `unknown value(s): ${bad.join(", ")}` };
      return { ok: true, value: out, note: bad.length ? `ignored unknown value(s): ${bad.join(", ")}` : void 0 };
    }
  }
}
function applySportFilterPatch(cfg, current, patch, ctx = {}) {
  const next = cloneSnapshot(current);
  const applied = [];
  const rejected = [];
  const dflt = cfg.defaultSnapshot;
  const isDimKey = (k) => Object.prototype.hasOwnProperty.call(cfg.dimensions, k);
  const ops = Array.isArray(patch?.ops) ? patch.ops : [];
  for (const op of ops) {
    if (!op || typeof op !== "object" || typeof op.dimension !== "string") {
      rejected.push({ op, reason: "malformed operation" });
      continue;
    }
    const dimKey = op.dimension;
    if (dimKey === "betType") {
      if (op.op === "clear") {
        const from = next.betType;
        if (from === dflt.betType) continue;
        next.betType = dflt.betType;
        cfg.applyBetTypeSideEffects?.(next);
        applied.push({ dimension: "betType", from, to: next.betType });
      } else if (op.op === "set") {
        const v = op.value;
        if (typeof v !== "string" || !cfg.betTypes.includes(v)) {
          rejected.push({ op, reason: `"${String(v)}" is not a valid bet type` });
        } else if (v !== next.betType) {
          const from = next.betType;
          next.betType = v;
          cfg.applyBetTypeSideEffects?.(next);
          applied.push({ dimension: "betType", from, to: v });
        }
      } else {
        rejected.push({ op, reason: "betType supports only set/clear" });
      }
      continue;
    }
    if (!isDimKey(dimKey)) {
      rejected.push({ op, reason: `unknown dimension "${dimKey}"` });
      continue;
    }
    const dim = cfg.dimensions[dimKey];
    if (op.op === "clear") {
      const from = next[dimKey];
      const def = dflt[dimKey];
      if (JSON.stringify(from) === JSON.stringify(def)) continue;
      next[dimKey] = Array.isArray(def) ? [...def] : def;
      applied.push({ dimension: dimKey, from, to: def });
      continue;
    }
    const bt = String(next.betType);
    const avail = isDimensionAvailableGeneric(dim, bt, next);
    if (!avail.ok) {
      rejected.push({ op, reason: avail.reason });
      continue;
    }
    if (dim.availability?.requires) {
      const { key: rkey, equals: rval } = dim.availability.requires;
      if (next[rkey] !== rval) {
        const rFrom = next[rkey];
        next[rkey] = rval;
        applied.push({ dimension: rkey, from: rFrom, to: rval, note: `set automatically for ${dim.label}` });
      }
    }
    if (op.op === "set") {
      const res = coerceSetValue(cfg, dimKey, dim, op.value, next, ctx);
      if (!res.ok) {
        rejected.push({ op, reason: res.reason });
        continue;
      }
      const from = next[dimKey];
      if (JSON.stringify(from) === JSON.stringify(res.value)) continue;
      next[dimKey] = res.value;
      applied.push({ dimension: dimKey, from, to: res.value, note: res.note });
      continue;
    }
    if (op.op === "addItems" || op.op === "removeItems") {
      if (dim.kind !== "multiselect") {
        rejected.push({ op, reason: `${dim.label} is not a list` });
        continue;
      }
      if (!Array.isArray(op.items)) {
        rejected.push({ op, reason: "items must be an array" });
        continue;
      }
      const list = cfg.optionLists[dim.optionSource];
      const override = ctx.optionOverrides?.[dim.optionSource];
      const from = [...next[dimKey]];
      const bad = [];
      const norm = op.items.map((i) => {
        const t = list ? resolveOption(i, list, override) : null;
        if (!t) bad.push(String(i));
        return t;
      }).filter(Boolean);
      let out;
      if (op.op === "addItems") {
        out = [...from];
        for (const t of norm) if (!out.includes(t)) out.push(t);
      } else {
        out = from.filter((t) => !norm.includes(t));
      }
      if (JSON.stringify(from) === JSON.stringify(out)) {
        if (bad.length) rejected.push({ op, reason: `unknown value(s): ${bad.join(", ")}` });
        continue;
      }
      next[dimKey] = out;
      applied.push({ dimension: dimKey, from, to: out, note: bad.length ? `ignored unknown value(s): ${bad.join(", ")}` : void 0 });
      continue;
    }
    rejected.push({ op, reason: `unsupported op "${op.op}"` });
  }
  return { snapshot: next, applied, rejected, noChange: applied.length === 0 };
}

// src/features/analysis/applyFilterPatch.ts
function applyFilterPatch(current, patch, ctx = {}) {
  const engineCtx = {
    optionOverrides: ctx.teamAbbrs ? { nflTeams: ctx.teamAbbrs } : void 0,
    lists: { coaches: ctx.coaches, referees: ctx.referees }
  };
  return applySportFilterPatch(NFL_SPORT_CONFIG, current, patch, engineCtx);
}

// src/features/analysis/filterSchemaCfb.ts
var CFB_BET_TYPES = [
  "fg_spread",
  "fg_ml",
  "fg_total",
  "team_total",
  "h1_spread",
  "h1_ml",
  "h1_total"
];
var CFB_LIMITED_BET_TYPES = ["h1_spread", "h1_ml", "h1_total", "team_total"];
var CFB_TEAMS = [
  "Air Force",
  "Akron",
  "Alabama",
  "App State",
  "Arizona",
  "Arizona State",
  "Arkansas",
  "Arkansas State",
  "Army",
  "Auburn",
  "BYU",
  "Ball State",
  "Baylor",
  "Boise State",
  "Boston College",
  "Bowling Green",
  "Buffalo",
  "California",
  "Central Michigan",
  "Charlotte",
  "Cincinnati",
  "Clemson",
  "Coastal Carolina",
  "Colorado",
  "Colorado State",
  "Delaware",
  "Duke",
  "East Carolina",
  "Eastern Michigan",
  "Florida",
  "Florida Atlantic",
  "Florida International",
  "Florida State",
  "Fresno State",
  "Georgia",
  "Georgia Southern",
  "Georgia State",
  "Georgia Tech",
  "Hawai'i",
  "Houston",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Iowa State",
  "Jacksonville State",
  "James Madison",
  "Kansas",
  "Kansas State",
  "Kennesaw State",
  "Kent State",
  "Kentucky",
  "LSU",
  "Liberty",
  "Louisiana",
  "Louisiana Tech",
  "Louisville",
  "Marshall",
  "Maryland",
  "Massachusetts",
  "Memphis",
  "Miami",
  "Miami (OH)",
  "Michigan",
  "Michigan State",
  "Middle Tennessee",
  "Minnesota",
  "Mississippi State",
  "Missouri",
  "Missouri State",
  "NC State",
  "Navy",
  "Nebraska",
  "Nevada",
  "New Mexico",
  "New Mexico State",
  "North Carolina",
  "North Texas",
  "Northern Illinois",
  "Northwestern",
  "Notre Dame",
  "Ohio",
  "Ohio State",
  "Oklahoma",
  "Oklahoma State",
  "Old Dominion",
  "Ole Miss",
  "Oregon",
  "Oregon State",
  "Penn State",
  "Pittsburgh",
  "Purdue",
  "Rice",
  "Rutgers",
  "SMU",
  "Sam Houston",
  "San Diego State",
  "San Jos\xE9 State",
  "South Alabama",
  "South Carolina",
  "South Florida",
  "Southern Miss",
  "Stanford",
  "Syracuse",
  "TCU",
  "Temple",
  "Tennessee",
  "Texas",
  "Texas A&M",
  "Texas State",
  "Texas Tech",
  "Toledo",
  "Troy",
  "Tulane",
  "Tulsa",
  "UAB",
  "UCF",
  "UCLA",
  "UConn",
  "UL Monroe",
  "UNLV",
  "USC",
  "UTEP",
  "UTSA",
  "Utah",
  "Utah State",
  "Vanderbilt",
  "Virginia",
  "Virginia Tech",
  "Wake Forest",
  "Washington",
  "Washington State",
  "West Virginia",
  "Western Kentucky",
  "Western Michigan",
  "Wisconsin",
  "Wyoming"
];
var CFB_CONFERENCES = [
  "ACC",
  "American Athletic",
  "Big 12",
  "Big Ten",
  "Conference USA",
  "FBS Independents",
  "Mid-American",
  "Mountain West",
  "Pac-12",
  "SEC",
  "Sun Belt"
];
var SPREAD_BT = ["fg_spread", "h1_spread"];
var ML_BT = ["fg_ml", "h1_ml"];
var TOTAL_BT = ["fg_total", "h1_total", "team_total"];
var DEFAULT_CFB_SNAPSHOT = {
  betType: "fg_spread",
  seasons: [2016, 2025],
  weeks: [1, 16],
  side: "any",
  favDog: "any",
  gameType: "any",
  rankedMatchup: "any",
  spreadSide: "any",
  spreadSize: [0, 50],
  lineRange: [30, 80],
  mlMin: "",
  mlMax: "",
  primetime: null,
  conferenceGame: null,
  neutralSite: null,
  selectedConferences: [],
  tempRange: [-10, 110],
  windMax: 60,
  weather: "any",
  dome: "any",
  lastResult: "any",
  lastAts: "any",
  lastTotal: "any",
  lastRole: "any",
  lastOt: null,
  lastBlowout: "any",
  teams: [],
  opponents: [],
  daysOfWeek: [],
  lastMargin: [-80, 80],
  oppLastResult: "any",
  oppLastAts: "any",
  oppLastTotal: "any",
  oppLastRole: "any",
  oppLastOt: null,
  oppLastMargin: [-80, 80],
  ...CFB_ASOF_DEFAULTS
};
var CFB_FILTER_DIMENSIONS = {
  // ── Situation ──
  seasons: { group: "Situation", kind: "numRange", min: 2016, max: 2025, step: 1, limitedFloor: 2023, label: "Seasons", aliases: ["year", "years", "since"], rpcNote: "season_min/max; floor 2023 for 1H/TT markets." },
  gameType: { group: "Situation", kind: "enum", label: "Game type", options: [["any", "All games"], ["regular", "Regular season"], ["bowl", "Bowl games"], ["playoff", "Playoff"], ["postseason", "All postseason"]], aliases: ["bowl", "playoff", "postseason", "regular season"], rpcNote: "f.game_type; 'postseason' = bowl+playoff." },
  weeks: { group: "Situation", kind: "numRange", min: 1, max: 16, step: 1, label: "Weeks", aliases: ["week", "early season", "late season"], rpcNote: "week_min/max \u2014 only applied for regular-season/any game types." },
  rankedMatchup: { group: "Situation", kind: "enum", label: "Ranked matchup", options: [["any", "Any"], ["both", "Both ranked"], ["neither", "Neither ranked"], ["home_ranked", "Home ranked only"], ["away_ranked", "Away ranked only"], ["either", "Either ranked"]], aliases: ["ranked", "top 25", "unranked"], rpcNote: "f.ranked_matchup (AP Top 25; full 2016+)." },
  side: { group: "Situation", kind: "enum", label: "Side", options: [["any", "Either"], ["home", "Home"], ["away", "Away"]], aliases: ["home", "away", "road"], rpcNote: "f.side." },
  teams: { group: "Situation", kind: "multiselect", optionSource: "cfbTeams", label: "Team", aliases: ["team", "school"], rpcNote: "f.team = array of full school names." },
  opponents: { group: "Situation", kind: "multiselect", optionSource: "cfbTeams", label: "Opponent", aliases: ["opponent", "against", "vs"], rpcNote: "f.opponent = array of full school names." },
  daysOfWeek: { group: "Situation", kind: "multiselect", optionSource: "daysOfWeek", label: "Days of week", aliases: ["day", "saturday", "friday", "thursday", "weeknight", "maction"], rpcNote: "f.day_of_week = array (CFB plays Tue\u2013Sat; Sun/Mon rare)." },
  spreadSide: { group: "Situation", kind: "enum", label: "Spread side", options: [["any", "Either side"], ["favorite", "Favored by"], ["underdog", "Getting"]], availability: { betTypes: SPREAD_BT }, aliases: ["favored", "getting", "laying", "dog"], rpcNote: "Drives spread sign \u2014 see spreadSize." },
  spreadSize: { group: "Situation", kind: "numRange", min: 0, max: 50, step: 0.5, unit: "pts", boundsByBetType: { fg_spread: [0, 50], h1_spread: [0, 28] }, availability: { betTypes: SPREAD_BT }, label: "Spread size", aliases: ["spread", "points", "laying"], rpcNote: "favorite \u2192 spread_min=-hi/max=-max(lo,.5); underdog \u2192 +; either \u2192 abs_spread_*. CFB spreads reach the 50s." },
  favDog: { group: "Situation", kind: "enum", label: "Favorite / Underdog", options: [["any", "Either"], ["favorite", "Favorites"], ["underdog", "Underdogs"]], availability: { betTypes: [...ML_BT, "team_total"] }, aliases: ["favorite", "underdog"], rpcNote: "f.fav_dog \u2014 ML markets + team totals (CFB ML has no spread control)." },
  mlMin: { group: "Situation", kind: "mlOdds", bound: "min", label: "Moneyline odds (min)", availability: { betTypes: ML_BT }, aliases: ["moneyline", "odds"], rpcNote: "f.ml_min (American; CFB ML data 2021+)." },
  mlMax: { group: "Situation", kind: "mlOdds", bound: "max", label: "Moneyline odds (max)", availability: { betTypes: ML_BT }, aliases: ["moneyline", "odds"], rpcNote: "f.ml_max." },
  lineRange: { group: "Situation", kind: "numRange", min: 30, max: 80, step: 0.5, boundsByBetType: { fg_total: [30, 80], h1_total: [15, 45], team_total: [10, 55] }, availability: { betTypes: TOTAL_BT }, label: "Total line", aliases: ["total", "over under", "o/u"], rpcNote: "total_min/max, h1_total_min/max, tt_min/max." },
  // ── Matchup ──
  primetime: { group: "Matchup", kind: "tristate", label: "Primetime", aliases: ["primetime", "night game"], rpcNote: "f.primetime = boolean." },
  conferenceGame: { group: "Matchup", kind: "tristate", label: "Conference game", aliases: ["conference game", "non-conference"], rpcNote: "f.conference_game = boolean." },
  neutralSite: { group: "Matchup", kind: "tristate", label: "Neutral site", aliases: ["neutral site", "bowl site"], rpcNote: "f.neutral_site = boolean." },
  selectedConferences: { group: "Matchup", kind: "multiselect", optionSource: "cfbConferences", label: "Conference", aliases: ["conference", "sec", "big ten", "acc", "big 12"], rpcNote: "1 selected \u2192 f.conference; multiple \u2192 expanded client-side to that conference's team list." },
  // ── Weather ──
  weather: { group: "Weather", kind: "enum", label: "Weather", options: [["any", "Any"], ["rain", "Rain"], ["snow", "Snow"]], aliases: ["rain", "snow", "wet"], rpcNote: "f.weather (condition text complete 2022+, partial before)." },
  dome: { group: "Weather", kind: "enum", label: "Venue", options: [["any", "Any"], ["dome", "Dome"], ["outdoor", "Outdoor"]], aliases: ["dome", "indoor", "outdoor"], rpcNote: "f.dome = (dome === 'dome')." },
  tempRange: { group: "Weather", kind: "numRange", min: -10, max: 110, step: 1, unit: "\xB0F", label: "Temperature", aliases: ["temperature", "cold", "hot"], rpcNote: "temp_min/max." },
  windMax: { group: "Weather", kind: "scalarMax", min: 0, max: 60, step: 1, unit: "mph", label: "Max wind", aliases: ["wind", "windy"], rpcNote: "f.wind_max when < 60." },
  // ── Last game ──
  lastResult: { group: "Last game", kind: "enum", label: "Last game result", options: [["any", "Any"], ["won", "Won"], ["lost", "Lost"]], aliases: ["off a win", "off a loss"], rpcNote: "f.last_won = won?1:0." },
  lastAts: { group: "Last game", kind: "enum", label: "Last game ATS", options: [["any", "Any"], ["covered", "Covered"], ["not", "Didn't cover"]], aliases: ["covered last"], rpcNote: "f.last_covered = covered?1:0." },
  lastTotal: { group: "Last game", kind: "enum", label: "Last game total", options: [["any", "Any"], ["over", "Over"], ["under", "Under"]], aliases: ["over last game", "under last game"], rpcNote: "f.last_over = over?1:0." },
  lastRole: { group: "Last game", kind: "enum", label: "Last game role", options: [["any", "Any"], ["favorite", "Favorite"], ["underdog", "Underdog"]], rpcNote: "f.last_favorite = (lastRole === 'favorite')." },
  lastOt: { group: "Last game", kind: "tristate", label: "Last game overtime", aliases: ["overtime", "ot"], rpcNote: "f.last_overtime = boolean." },
  lastBlowout: { group: "Last game", kind: "enum", label: "Last game blowout (\xB121)", options: [["any", "Any"], ["win", "Won by 21+"], ["loss", "Lost by 21+"]], aliases: ["blowout"], rpcNote: "LEGACY \u2014 prefer lastMargin. f.last_blowout = 'win'|'loss'." },
  lastMargin: { group: "Last game", kind: "numRange", min: -80, max: 80, step: 1, unit: "pts", label: "Last game margin", aliases: ["margin", "won by", "lost by"], rpcNote: "last_margin_min/max \u2014 signed: + won by, \u2212 lost by." },
  // ── Opponent last game ──
  oppLastResult: { group: "Opponent last game", kind: "enum", label: "Opponent last game result", options: [["any", "Any"], ["won", "Won"], ["lost", "Lost"]], aliases: ["opponent off a win", "opponent off a loss"], rpcNote: "f.opp_last_won = won?1:0." },
  oppLastAts: { group: "Opponent last game", kind: "enum", label: "Opponent last game ATS", options: [["any", "Any"], ["covered", "Covered"], ["not", "Didn't cover"]], rpcNote: "f.opp_last_covered = covered?1:0." },
  oppLastTotal: { group: "Opponent last game", kind: "enum", label: "Opponent last game total", options: [["any", "Any"], ["over", "Over"], ["under", "Under"]], rpcNote: "f.opp_last_over = over?1:0." },
  oppLastRole: { group: "Opponent last game", kind: "enum", label: "Opponent last game role", options: [["any", "Any"], ["favorite", "Favorite"], ["underdog", "Underdog"]], rpcNote: "f.opp_last_favorite = (oppLastRole === 'favorite')." },
  oppLastOt: { group: "Opponent last game", kind: "tristate", label: "Opponent last game overtime", rpcNote: "f.opp_last_overtime = boolean." },
  oppLastMargin: { group: "Opponent last game", kind: "numRange", min: -80, max: 80, step: 1, unit: "pts", label: "Opponent last game margin", aliases: ["opponent won by", "opponent lost by"], rpcNote: "opp_last_margin_min/max \u2014 signed." },
  // ── Season Record / Cover / Total / Prior Year / H2H / Opponent Record (as-of; keys match NFL) ──
  winPct: { group: "Season Record", kind: "pctRange", label: "Win %", aliases: ["win rate", "record"], rpcNote: "win_pct_min/max (0\u20131)." },
  winStreak: { group: "Season Record", kind: "numRange", min: 0, max: 16, step: 1, label: "Win streak", aliases: ["winning streak"], rpcNote: "win_streak_min/max." },
  lossStreak: { group: "Season Record", kind: "numRange", min: 0, max: 16, step: 1, label: "Loss streak", aliases: ["losing streak"], rpcNote: "loss_streak_min/max." },
  above500: { group: "Season Record", kind: "tristate", label: "Winning record (>.500)", aliases: ["winning record", "losing record"], rpcNote: "f.above_500." },
  winPctGtOpp: { group: "Season Record", kind: "tristate", label: "Win% better than opponent", rpcNote: "f.win_pct_gt_opp." },
  ppg: { group: "Season Record", kind: "numRange", min: 0, max: 60, step: 0.5, label: "Points per game", aliases: ["ppg", "scoring"], rpcNote: "ppg_min/max." },
  paPg: { group: "Season Record", kind: "numRange", min: 0, max: 60, step: 0.5, label: "Points allowed per game", aliases: ["points allowed", "defense"], rpcNote: "pa_pg_min/max." },
  pointDiffPg: { group: "Season Record", kind: "numRange", min: -40, max: 40, step: 0.5, label: "Point differential per game", aliases: ["point differential", "margin"], rpcNote: "point_diff_pg_min/max." },
  minGames: { group: "Season Record", kind: "scalarMin", min: 0, max: 10, step: 1, label: "Min games this season", aliases: ["minimum games", "sample size"], rpcNote: "f.min_games when > 0." },
  atsWinPct: { group: "Cover Profile", kind: "pctRange", label: "ATS win %", aliases: ["ats percentage", "cover rate"], rpcNote: "ats_win_pct_min/max (0\u20131)." },
  atsWinStreak: { group: "Cover Profile", kind: "numRange", min: 0, max: 16, step: 1, label: "ATS win streak", aliases: ["cover streak"], rpcNote: "ats_win_streak_min/max." },
  avgCoverMargin: { group: "Cover Profile", kind: "numRange", min: -30, max: 30, step: 0.5, label: "Avg cover margin", rpcNote: "avg_cover_margin_min/max." },
  overPct: { group: "Total Profile", kind: "pctRange", label: "Over %", aliases: ["over rate"], rpcNote: "over_pct_min/max (0\u20131)." },
  overStreak: { group: "Total Profile", kind: "numRange", min: 0, max: 16, step: 1, label: "Over streak", rpcNote: "over_streak_min/max." },
  underStreak: { group: "Total Profile", kind: "numRange", min: 0, max: 16, step: 1, label: "Under streak", rpcNote: "under_streak_min/max." },
  prevWins: { group: "Prior Year", kind: "numRange", min: 0, max: 15, step: 1, label: "Last season wins", rpcNote: "prev_wins_min/max." },
  prevWinPct: { group: "Prior Year", kind: "pctRange", label: "Last season win %", rpcNote: "prev_win_pct_min/max (0\u20131)." },
  madePlayoffsPrev: { group: "Prior Year", kind: "tristate", label: "Made a bowl/playoff last year", aliases: ["made a bowl", "bowl eligible last year"], rpcNote: "f.made_playoffs_prev (bowl or playoff appearance)." },
  moreWinsThanOppPrev: { group: "Prior Year", kind: "tristate", label: "More wins than opponent last year", rpcNote: "f.more_wins_than_opp_prev." },
  h2hLastWin: { group: "Head-to-Head", kind: "enum", label: "Won last meeting", options: [["any", "Any"], ["yes", "Won"], ["no", "Lost"]], aliases: ["won last meeting", "h2h"], rpcNote: "f.h2h_last_win = yes?1:0." },
  h2hLastAts: { group: "Head-to-Head", kind: "enum", label: "Covered last meeting", options: [["any", "Any"], ["yes", "Covered"], ["no", "Didn't cover"]], rpcNote: "f.h2h_last_ats_win = yes?1:0." },
  h2hLastOver: { group: "Head-to-Head", kind: "enum", label: "Last meeting total", options: [["any", "Any"], ["yes", "Over"], ["no", "Under"]], rpcNote: "f.h2h_last_over = yes?1:0." },
  h2hLastHome: { group: "Head-to-Head", kind: "tristate", label: "Was home last meeting", rpcNote: "f.h2h_last_home." },
  h2hLastFav: { group: "Head-to-Head", kind: "tristate", label: "Was favorite last meeting", rpcNote: "f.h2h_last_fav." },
  h2hSameSeason: { group: "Head-to-Head", kind: "tristate", label: "Same season as last meeting", rpcNote: "f.h2h_same_season." },
  h2hSpreadCmp: { group: "Head-to-Head", kind: "enum", label: "Spread vs last meeting", options: [["any", "Any"], ["lower", "Lower"], ["higher", "Higher"]], rpcNote: "lower \u2192 h2h_spread_lower; higher \u2192 h2h_spread_higher." },
  oppWinPct: { group: "Opponent Record", kind: "pctRange", label: "Opponent win %", rpcNote: "opp_win_pct_min/max (0\u20131)." },
  oppOverPct: { group: "Opponent Record", kind: "pctRange", label: "Opponent over %", rpcNote: "opp_over_pct_min/max (0\u20131)." },
  oppWinStreak: { group: "Opponent Record", kind: "numRange", min: 0, max: 16, step: 1, label: "Opponent win streak", rpcNote: "opp_win_streak_min/max." },
  oppPrevWinPct: { group: "Opponent Record", kind: "pctRange", label: "Opponent last-season win %", rpcNote: "opp_prev_win_pct_min/max (0\u20131)." }
};
var CFB_DIMENSION_KEYS = Object.keys(CFB_FILTER_DIMENSIONS);
var CFB_SIDE_SYMMETRIC_DIMS = [
  "seasons",
  "weeks",
  "gameType",
  "rankedMatchup",
  "lineRange",
  "spreadSize",
  "primetime",
  "conferenceGame",
  "neutralSite",
  "tempRange",
  "windMax",
  "weather",
  "dome",
  "daysOfWeek",
  "minGames"
];
var CFB_SIDE_BREAKING_DIMS = CFB_DIMENSION_KEYS.filter(
  (k) => !CFB_SIDE_SYMMETRIC_DIMS.includes(k)
);
function cfbNumRangeBounds(dim, betType) {
  const base = dim.boundsByBetType?.[betType] ? [dim.boundsByBetType[betType][0], dim.boundsByBetType[betType][1]] : [dim.min, dim.max];
  if (dim.limitedFloor != null && CFB_LIMITED_BET_TYPES.includes(betType)) {
    base[0] = Math.max(base[0], dim.limitedFloor);
  }
  return base;
}
function cfbBetTypeSideEffects(next) {
  const bt = next.betType;
  next.spreadSize = cfbNumRangeBounds(CFB_FILTER_DIMENSIONS.spreadSize, bt);
  next.lineRange = cfbNumRangeBounds(CFB_FILTER_DIMENSIONS.lineRange, bt);
  const floor = cfbNumRangeBounds(CFB_FILTER_DIMENSIONS.seasons, bt)[0];
  if (next.seasons[0] < floor) next.seasons = [floor, next.seasons[1]];
}
var CFB_SPORT_CONFIG = {
  sport: "cfb",
  betTypes: CFB_BET_TYPES,
  defaultSnapshot: DEFAULT_CFB_SNAPSHOT,
  dimensions: CFB_FILTER_DIMENSIONS,
  optionLists: {
    cfbTeams: { values: CFB_TEAMS },
    cfbConferences: { values: CFB_CONFERENCES, aliases: { "aac": "American Athletic", "american": "American Athletic", "cusa": "Conference USA", "c-usa": "Conference USA", "mac": "Mid-American", "independents": "FBS Independents", "independent": "FBS Independents" } },
    daysOfWeek: { values: NFL_DAYS, aliases: NFL_DAY_ALIASES }
  },
  applyBetTypeSideEffects: cfbBetTypeSideEffects,
  numRangeBounds: cfbNumRangeBounds
};

// src/features/analysis/filterSchemaMlb.ts
var MLB_BET_TYPES = ["ml", "rl", "total", "f5_ml", "f5_rl", "f5_total"];
var MLB_TEAM_ABBRS = [
  "ATH",
  "ATL",
  "AZ",
  "BAL",
  "BOS",
  "CHC",
  "CIN",
  "CLE",
  "COL",
  "CWS",
  "DET",
  "HOU",
  "KC",
  "LAA",
  "LAD",
  "MIA",
  "MIL",
  "MIN",
  "NYM",
  "NYY",
  "PHI",
  "PIT",
  "SD",
  "SEA",
  "SF",
  "STL",
  "TB",
  "TEX",
  "TOR",
  "WSH"
];
var MLB_TEAM_ALIASES = {
  ari: "AZ",
  oak: "ATH",
  oakland: "ATH",
  athletics: "ATH",
  chw: "CWS",
  was: "WSH",
  wsn: "WSH",
  tbr: "TB",
  kcr: "KC",
  sdp: "SD",
  sfg: "SF"
};
var TOTAL_BT2 = ["total", "f5_total"];
var TIME_PATTERN = "^([01]?\\d|2[0-3]):[0-5]\\d$";
var DEFAULT_MLB_SNAPSHOT = MLB_SNAPSHOT_DEFAULTS;
var MLB_FILTER_DIMENSIONS = {
  // ── Situation ──
  seasons: { group: "Situation", kind: "numRange", min: 2023, max: 2026, step: 1, label: "Seasons", aliases: ["year", "years", "since"], rpcNote: "season_min/max (MLB data 2023+)." },
  months: { group: "Situation", kind: "numRange", min: 3, max: 11, step: 1, label: "Months", aliases: ["april", "may", "summer", "september", "month"], rpcNote: "month_min/max (3=Mar \u2026 11=Nov)." },
  teams: { group: "Situation", kind: "multiselect", optionSource: "mlbTeams", label: "Team", aliases: ["team"], rpcNote: "f.team = array of MLB abbreviations." },
  opponents: { group: "Situation", kind: "multiselect", optionSource: "mlbTeams", label: "Opponent", aliases: ["opponent", "against", "vs"], rpcNote: "f.opponent = array of MLB abbreviations." },
  side: { group: "Situation", kind: "enum", label: "Side", options: [["any", "Either"], ["home", "Home"], ["away", "Away"]], aliases: ["home", "away", "road"], rpcNote: "f.side." },
  favDog: { group: "Situation", kind: "enum", label: "Favorite / Underdog", options: [["any", "Either"], ["favorite", "Favorites"], ["underdog", "Underdogs"]], aliases: ["favorite", "underdog", "dog", "chalk"], rpcNote: "f.fav_dog." },
  mlMin: { group: "Situation", kind: "mlOdds", bound: "min", label: "Moneyline odds (min)", aliases: ["moneyline", "odds"], rpcNote: "f.ml_min (American)." },
  mlMax: { group: "Situation", kind: "mlOdds", bound: "max", label: "Moneyline odds (max)", aliases: ["moneyline", "odds"], rpcNote: "f.ml_max." },
  lineRange: { group: "Situation", kind: "numRange", min: 5, max: 14, step: 0.5, boundsByBetType: { total: [5, 14], f5_total: [2, 8] }, availability: { betTypes: TOTAL_BT2 }, label: "Total line", aliases: ["total", "over under", "o/u"], rpcNote: "total_min/max (total), f5_total_min/max (f5_total)." },
  timeMin: { group: "Situation", kind: "text", pattern: TIME_PATTERN, label: "Earliest start (ET, HH:MM)", aliases: ["start time", "day games", "night games"], rpcNote: "f.time_min (ET 24h)." },
  timeMax: { group: "Situation", kind: "text", pattern: TIME_PATTERN, label: "Latest start (ET, HH:MM)", rpcNote: "f.time_max (ET 24h)." },
  daysOfWeek: { group: "Situation", kind: "multiselect", optionSource: "daysOfWeek", label: "Days of week", aliases: ["day", "weekend", "friday", "sunday"], rpcNote: "f.day_of_week = array of day names." },
  doubleheader: { group: "Situation", kind: "tristate", label: "Doubleheader", aliases: ["doubleheader", "twin bill"], rpcNote: "f.doubleheader = boolean." },
  seriesGame: { group: "Situation", kind: "numRange", min: 1, max: 6, step: 1, label: "Series game #", aliases: ["series opener", "game 1 of series", "rubber match"], rpcNote: "series_game_min/max." },
  trip: { group: "Situation", kind: "numRange", min: 1, max: 5, step: 1, label: "Series # of trip", aliases: ["road trip", "homestand"], rpcNote: "trip_min/max (nth series of the current trip/stand)." },
  switchGame: { group: "Situation", kind: "tristate", label: "Switch game", aliases: ["switch game", "first game after travel"], rpcNote: "f.switch_game = boolean." },
  restRange: { group: "Situation", kind: "numRange", min: 0, max: 10, step: 1, label: "Days rest", aliases: ["rest", "off day"], rpcNote: "rest_min/max." },
  // ── Matchup ──
  division: { group: "Matchup", kind: "tristate", label: "Divisional game", aliases: ["divisional", "division game"], rpcNote: "f.division = boolean." },
  interleague: { group: "Matchup", kind: "tristate", label: "Interleague", aliases: ["interleague"], rpcNote: "f.interleague = boolean." },
  // ── Weather & park ──
  tempRange: { group: "Weather & park", kind: "numRange", min: 30, max: 110, step: 1, unit: "\xB0F", label: "Temperature", aliases: ["temperature", "cold", "hot"], rpcNote: "temp_min/max." },
  windRange: { group: "Weather & park", kind: "numRange", min: 0, max: 40, step: 1, unit: "mph", label: "Wind speed", aliases: ["wind", "windy"], rpcNote: "wind_min/max." },
  windDir: { group: "Weather & park", kind: "enum", label: "Wind direction", options: [["any", "Any"], ["out", "Blowing out"], ["in", "Blowing in"], ["cross", "Crosswind"], ["none", "None"]], aliases: ["wind out", "wind in", "blowing out"], rpcNote: "f.wind_dir." },
  dome: { group: "Weather & park", kind: "tristate", label: "Dome", aliases: ["dome", "indoor", "roof closed"], rpcNote: "f.dome = boolean." },
  pfRuns: { group: "Weather & park", kind: "numRange", min: 85, max: 115, step: 1, label: "Park factor (runs)", aliases: ["park factor", "hitter park", "pitcher park"], rpcNote: "pf_runs_min/max (100 = neutral; hitter \u2265103, pitcher \u226497)." },
  // ── Pitching ──
  spNames: { group: "Pitching", kind: "multiselect", optionSource: "mlbPitchers", label: "Starting pitcher", aliases: ["starter", "pitcher", "sp"], rpcNote: "names \u2192 ids client-side \u2192 f.sp = array of pitcher ids." },
  oppSpNames: { group: "Pitching", kind: "multiselect", optionSource: "mlbPitchers", label: "Opposing starter", aliases: ["opposing pitcher", "facing"], rpcNote: "names \u2192 ids client-side \u2192 f.opp_sp." },
  spHand: { group: "Pitching", kind: "enum", label: "SP handedness", options: [["any", "Any"], ["L", "Lefty"], ["R", "Righty"]], aliases: ["lefty starter", "righty starter"], rpcNote: "f.sp_hand." },
  oppSpHand: { group: "Pitching", kind: "enum", label: "Opp SP handedness", options: [["any", "Any"], ["L", "Lefty"], ["R", "Righty"]], aliases: ["vs lefty", "vs righty", "vs lhp", "vs rhp"], rpcNote: "f.opp_sp_hand." },
  spXfip: { group: "Pitching", kind: "numRange", min: 2, max: 7, step: 0.05, label: "SP xFIP", aliases: ["ace", "weak starter", "xfip"], rpcNote: "sp_xfip_min/max (Ace \u22643.50, Weak >4.50)." },
  oppSpXfip: { group: "Pitching", kind: "numRange", min: 2, max: 7, step: 0.05, label: "Opp SP xFIP", aliases: ["facing an ace", "facing a weak starter"], rpcNote: "opp_sp_xfip_min/max." },
  bpIp: { group: "Pitching", kind: "numRange", min: 0, max: 20, step: 0.1, label: "Bullpen IP last 3 days", aliases: ["bullpen rested", "bullpen gassed"], rpcNote: "bp_ip3d_min/max (Rested \u22646, Gassed \u226512)." },
  bpXfip: { group: "Pitching", kind: "numRange", min: 2, max: 7, step: 0.05, label: "Bullpen xFIP", aliases: ["good bullpen", "bad bullpen"], rpcNote: "bp_xfip_min/max." },
  // ── Last game ──
  lastResult: { group: "Last game", kind: "enum", label: "Last game result", options: [["any", "Any"], ["won", "Won"], ["lost", "Lost"]], aliases: ["off a win", "off a loss"], rpcNote: "f.last_result ('won'/'lost' \u2192 W/L)." },
  lastMargin: { group: "Last game", kind: "numRange", min: -30, max: 30, step: 1, unit: "runs", label: "Last game margin", aliases: ["won by", "lost by", "blowout"], rpcNote: "last_margin_min/max \u2014 signed runs." },
  winLossStreak: { group: "Last game", kind: "numRange", min: -25, max: 25, step: 1, label: "Current W/L streak (signed)", aliases: ["winning streak", "losing streak", "streak"], rpcNote: "streak_min/max \u2014 signed (+wins / \u2212losses)." },
  // ── Opponent last game ──
  oppLastResult: { group: "Opponent last game", kind: "enum", label: "Opponent last game result", options: [["any", "Any"], ["won", "Won"], ["lost", "Lost"]], aliases: ["opponent off a win", "opponent off a loss"], rpcNote: "f.opp_last_result ('won'/'lost')." },
  oppLastMargin: { group: "Opponent last game", kind: "numRange", min: -30, max: 30, step: 1, unit: "runs", label: "Opponent last game margin", aliases: ["opponent won by", "opponent lost by"], rpcNote: "opp_last_margin_min/max \u2014 signed." },
  // ── Season Record (as-of) ──
  winPct: { group: "Season Record", kind: "pctRange", label: "Win %", aliases: ["win rate", "record"], rpcNote: "win_pct_min/max (0\u20131)." },
  winStreak: { group: "Season Record", kind: "numRange", min: 0, max: 25, step: 1, label: "Win streak", rpcNote: "win_streak_min/max." },
  lossStreak: { group: "Season Record", kind: "numRange", min: 0, max: 25, step: 1, label: "Loss streak", rpcNote: "loss_streak_min/max." },
  rpg: { group: "Season Record", kind: "numRange", min: 0, max: 10, step: 0.1, label: "Runs per game", aliases: ["scoring", "offense"], rpcNote: "rpg_min/max." },
  rapg: { group: "Season Record", kind: "numRange", min: 0, max: 10, step: 0.1, label: "Runs allowed per game", aliases: ["run prevention"], rpcNote: "rapg_min/max." },
  runDiffPg: { group: "Season Record", kind: "numRange", min: -4, max: 4, step: 0.1, label: "Run differential per game", aliases: ["run differential"], rpcNote: "run_diff_pg_min/max." },
  minGames: { group: "Season Record", kind: "scalarMin", min: 0, max: 40, step: 1, label: "Min games this season", aliases: ["sample size"], rpcNote: "f.min_games when > 0." },
  // ── Run Line Profile ──
  rlCoverPct: { group: "Run Line Profile", kind: "pctRange", label: "Run-line cover %", aliases: ["run line record", "rl cover"], rpcNote: "rl_cover_pct_min/max (0\u20131)." },
  rlStreak: { group: "Run Line Profile", kind: "numRange", min: 0, max: 25, step: 1, label: "Run-line cover streak", rpcNote: "rl_streak_min/max." },
  // ── Total Profile ──
  overPct: { group: "Total Profile", kind: "pctRange", label: "Over %", aliases: ["over rate"], rpcNote: "over_pct_min/max (0\u20131)." },
  overStreak: { group: "Total Profile", kind: "numRange", min: 0, max: 25, step: 1, label: "Over streak", rpcNote: "over_streak_min/max." },
  underStreak: { group: "Total Profile", kind: "numRange", min: 0, max: 25, step: 1, label: "Under streak", rpcNote: "under_streak_min/max." },
  // ── Prior Year ──
  prevWins: { group: "Prior Year", kind: "numRange", min: 0, max: 120, step: 1, label: "Last season wins", rpcNote: "prev_wins_min/max." },
  prevWinPct: { group: "Prior Year", kind: "pctRange", label: "Last season win %", rpcNote: "prev_win_pct_min/max (0\u20131)." },
  // ── Head-to-Head ──
  h2hLastWin: { group: "Head-to-Head", kind: "enum", label: "Won last meeting", options: [["any", "Any"], ["yes", "Won"], ["no", "Lost"]], aliases: ["won last meeting", "h2h"], rpcNote: "f.h2h_last_win = yes?1:0." },
  h2hLastOver: { group: "Head-to-Head", kind: "enum", label: "Last meeting total", options: [["any", "Any"], ["yes", "Over"], ["no", "Under"]], rpcNote: "f.h2h_last_over = yes?1:0." },
  h2hLastMargin: { group: "Head-to-Head", kind: "numRange", min: -30, max: 30, step: 1, unit: "runs", label: "Last meeting margin", rpcNote: "h2h_last_margin_min/max \u2014 signed." },
  h2hSameSeason: { group: "Head-to-Head", kind: "tristate", label: "Same season as last meeting", rpcNote: "f.h2h_same_season." },
  // ── Opponent Record ──
  oppWinPct: { group: "Opponent Record", kind: "pctRange", label: "Opponent win %", rpcNote: "opp_win_pct_min/max (0\u20131)." },
  oppOverPct: { group: "Opponent Record", kind: "pctRange", label: "Opponent over %", rpcNote: "opp_over_pct_min/max (0\u20131)." },
  oppRlCoverPct: { group: "Opponent Record", kind: "pctRange", label: "Opponent run-line cover %", rpcNote: "opp_rl_cover_pct_min/max (0\u20131)." },
  oppWinStreak: { group: "Opponent Record", kind: "numRange", min: 0, max: 25, step: 1, label: "Opponent win streak", rpcNote: "opp_win_streak_min/max." },
  oppLossStreak: { group: "Opponent Record", kind: "numRange", min: 0, max: 25, step: 1, label: "Opponent loss streak", rpcNote: "opp_loss_streak_min/max." },
  oppRpg: { group: "Opponent Record", kind: "numRange", min: 0, max: 10, step: 0.1, label: "Opponent runs per game", rpcNote: "opp_rpg_min/max." },
  oppRapg: { group: "Opponent Record", kind: "numRange", min: 0, max: 10, step: 0.1, label: "Opponent runs allowed per game", rpcNote: "opp_rapg_min/max." },
  oppPrevWinPct: { group: "Opponent Record", kind: "pctRange", label: "Opponent last-season win %", rpcNote: "opp_prev_win_pct_min/max (0\u20131)." }
};
var MLB_DIMENSION_KEYS = Object.keys(MLB_FILTER_DIMENSIONS);
var MLB_SIDE_SYMMETRIC_DIMS = [
  "seasons",
  "months",
  "division",
  "interleague",
  "lineRange",
  "timeMin",
  "timeMax",
  "daysOfWeek",
  "doubleheader",
  "seriesGame",
  "tempRange",
  "windRange",
  "windDir",
  "dome",
  "pfRuns",
  "minGames"
];
var MLB_SIDE_BREAKING_DIMS = MLB_DIMENSION_KEYS.filter(
  (k) => !MLB_SIDE_SYMMETRIC_DIMS.includes(k)
);
function mlbNumRangeBounds(dim, betType) {
  return dim.boundsByBetType?.[betType] ? [dim.boundsByBetType[betType][0], dim.boundsByBetType[betType][1]] : [dim.min, dim.max];
}
function mlbBetTypeSideEffects(next) {
  next.lineRange = mlbNumRangeBounds(MLB_FILTER_DIMENSIONS.lineRange, next.betType);
}
var MLB_SPORT_CONFIG = {
  sport: "mlb",
  betTypes: MLB_BET_TYPES,
  defaultSnapshot: DEFAULT_MLB_SNAPSHOT,
  dimensions: MLB_FILTER_DIMENSIONS,
  optionLists: {
    mlbTeams: { values: MLB_TEAM_ABBRS, aliases: MLB_TEAM_ALIASES },
    mlbPitchers: { values: [] },
    // dynamic — supply via ctx.optionOverrides.mlbPitchers
    daysOfWeek: { values: NFL_DAYS, aliases: NFL_DAY_ALIASES }
  },
  applyBetTypeSideEffects: mlbBetTypeSideEffects,
  numRangeBounds: mlbNumRangeBounds
};
export {
  CFB_SPORT_CONFIG,
  MLB_SPORT_CONFIG,
  NFL_SPORT_CONFIG,
  applyFilterPatch,
  applySportFilterPatch,
  normalizeCfbSavedFilterSnapshot,
  normalizeMlbSavedFilterSnapshot,
  normalizeNflSavedFilterSnapshot
};
