import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { collegeFootballSupabase as supabase } from "@/integrations/supabase/college-football-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NumericRangeFilter from "@/components/NumericRangeFilter";
import { Link } from "react-router-dom";
import {
  Play,
  Sparkles,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  HomeIcon,
  BarChart3,
  ChevronDownIcon,
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────
const MLB_TEAMS = [
  { abbr: "AZ", name: "Arizona Diamondbacks" },
  { abbr: "ATL", name: "Atlanta Braves" },
  { abbr: "BAL", name: "Baltimore Orioles" },
  { abbr: "BOS", name: "Boston Red Sox" },
  { abbr: "CHC", name: "Chicago Cubs" },
  { abbr: "CWS", name: "Chicago White Sox" },
  { abbr: "CIN", name: "Cincinnati Reds" },
  { abbr: "CLE", name: "Cleveland Guardians" },
  { abbr: "COL", name: "Colorado Rockies" },
  { abbr: "DET", name: "Detroit Tigers" },
  { abbr: "HOU", name: "Houston Astros" },
  { abbr: "KC", name: "Kansas City Royals" },
  { abbr: "LAA", name: "Los Angeles Angels" },
  { abbr: "LAD", name: "Los Angeles Dodgers" },
  { abbr: "MIA", name: "Miami Marlins" },
  { abbr: "MIL", name: "Milwaukee Brewers" },
  { abbr: "MIN", name: "Minnesota Twins" },
  { abbr: "NYM", name: "New York Mets" },
  { abbr: "NYY", name: "New York Yankees" },
  { abbr: "ATH", name: "Oakland Athletics" },
  { abbr: "PHI", name: "Philadelphia Phillies" },
  { abbr: "PIT", name: "Pittsburgh Pirates" },
  { abbr: "SD", name: "San Diego Padres" },
  { abbr: "SF", name: "San Francisco Giants" },
  { abbr: "SEA", name: "Seattle Mariners" },
  { abbr: "STL", name: "St. Louis Cardinals" },
  { abbr: "TB", name: "Tampa Bay Rays" },
  { abbr: "TEX", name: "Texas Rangers" },
  { abbr: "TOR", name: "Toronto Blue Jays" },
  { abbr: "WSH", name: "Washington Nationals" },
];

const SEASONS = [2026, 2025, 2024, 2023];

// ─── Types ──────────────────────────────────────────────────────
interface Filters {
  teams: string[];
  oppTeams: string[];
  seasons: number[];
  homeAway: string; // "" | "home" | "away"
  favUnderdog: string; // "" | "favorite" | "underdog"
  isDivisional: string; // "" | "true" | "false"
  isInterleague: string; // "" | "true" | "false"
  spHand: string; // "" | "L" | "R"
  oppSpHand: string; // "" | "L" | "R"
  // Numeric ranges: [min, max] or null if not set
  batWoba: string;
  batXwobacon: string;
  batBarrelPct: string;
  batHardHitPct: string;
  batOps: string;
  spEra: string;
  spXfip: string;
  spXera: string;
  oppSpXfip: string;
  oppSpXera: string;
  oppBpXfip: string;
  tempF: string;
  windMph: string;
  daysRest: string;
  streak: string;
  closingMl: string;
  closingTotal: string;
}

interface GameLogRow {
  game_pk: number;
  official_date: string;
  season: number;
  team_abbr: string;
  opp_team_abbr: string;
  home_away: string;
  venue: string | null;
  won: boolean | null;
  runs_scored: number | null;
  runs_allowed: number | null;
  margin: number | null;
  total_runs: number | null;
  closing_ml: number | null;
  closing_total: number | null;
  is_favorite: boolean | null;
  is_underdog: boolean | null;
  ou_result: string | null;
  sp_name: string | null;
  sp_hand: string | null;
  opp_sp_name: string | null;
  opp_sp_hand: string | null;
  [key: string]: any;
}

interface TeamStats {
  team: string;
  wins: number;
  losses: number;
  winPct: number;
  avgRunsScored: number;
  avgRunsAllowed: number;
  avgMargin: number;
  overPct: number;
  underPct: number;
  favRecord: string;
  dogRecord: string;
  total: number;
}

type SortColumn = keyof TeamStats;
type SortDirection = "asc" | "desc";

const emptyFilters: Filters = {
  teams: [],
  oppTeams: [],
  seasons: [],
  homeAway: "",
  favUnderdog: "",
  isDivisional: "",
  isInterleague: "",
  spHand: "",
  oppSpHand: "",
  batWoba: "",
  batXwobacon: "",
  batBarrelPct: "",
  batHardHitPct: "",
  batOps: "",
  spEra: "",
  spXfip: "",
  spXera: "",
  oppSpXfip: "",
  oppSpXera: "",
  oppBpXfip: "",
  tempF: "",
  windMph: "",
  daysRest: "",
  streak: "",
  closingMl: "",
  closingTotal: "",
};

// ─── Helpers ────────────────────────────────────────────────────
function parseRange(val: string): [number, number] | null {
  if (!val || !val.startsWith("between:")) return null;
  const [a, b] = val.slice(8).split(",").map(Number);
  if (isNaN(a) || isNaN(b)) return null;
  return [a, b];
}

// ─── Component ──────────────────────────────────────────────────
export default function MLBHistoricalAnalysis() {
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [appliedFilters, setAppliedFilters] = useState<Filters | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("total");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    game: true,
    batting: false,
    pitching: false,
    opponent: false,
    weather: false,
    odds: false,
  });

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Fetch data when filters are applied ──
  const { data: results, isLoading } = useQuery({
    queryKey: ["mlb_game_log", appliedFilters],
    queryFn: async () => {
      if (!appliedFilters) return [];

      let query = supabase
        .from("mlb_game_log")
        .select("*")
        .not("won", "is", null);

      // Team filters
      if (appliedFilters.teams.length > 0) {
        query = query.in("team_abbr", appliedFilters.teams);
      }
      if (appliedFilters.oppTeams.length > 0) {
        query = query.in("opp_team_abbr", appliedFilters.oppTeams);
      }

      // Season
      if (appliedFilters.seasons.length > 0) {
        query = query.in("season", appliedFilters.seasons);
      }

      // Home/Away
      if (appliedFilters.homeAway) {
        query = query.eq("home_away", appliedFilters.homeAway);
      }

      // Favorite/Underdog
      if (appliedFilters.favUnderdog === "favorite") {
        query = query.eq("is_favorite", true);
      } else if (appliedFilters.favUnderdog === "underdog") {
        query = query.eq("is_underdog", true);
      }

      // Divisional / Interleague
      if (appliedFilters.isDivisional === "true") {
        query = query.eq("is_divisional", true);
      } else if (appliedFilters.isDivisional === "false") {
        query = query.eq("is_divisional", false);
      }
      if (appliedFilters.isInterleague === "true") {
        query = query.eq("is_interleague", true);
      }

      // SP hand
      if (appliedFilters.spHand) {
        query = query.eq("sp_hand", appliedFilters.spHand);
      }
      if (appliedFilters.oppSpHand) {
        query = query.eq("opp_sp_hand", appliedFilters.oppSpHand);
      }

      // Numeric range filters
      const rangeFilters: [string, string][] = [
        ["bat_season_woba", appliedFilters.batWoba],
        ["bat_season_xwobacon", appliedFilters.batXwobacon],
        ["bat_season_barrel_pct", appliedFilters.batBarrelPct],
        ["bat_season_hard_hit_pct", appliedFilters.batHardHitPct],
        ["bat_season_ops", appliedFilters.batOps],
        ["sp_season_era", appliedFilters.spEra],
        ["sp_season_xfip", appliedFilters.spXfip],
        ["sp_season_xera", appliedFilters.spXera],
        ["opp_sp_season_xfip", appliedFilters.oppSpXfip],
        ["opp_sp_season_xera", appliedFilters.oppSpXera],
        ["opp_bp_season_xfip", appliedFilters.oppBpXfip],
        ["temperature_f", appliedFilters.tempF],
        ["wind_speed_mph", appliedFilters.windMph],
        ["days_rest", appliedFilters.daysRest],
        ["win_loss_streak", appliedFilters.streak],
        ["closing_ml", appliedFilters.closingMl],
        ["closing_total", appliedFilters.closingTotal],
      ];

      for (const [col, val] of rangeFilters) {
        const range = parseRange(val);
        if (range) {
          query = query.gte(col, range[0]).lte(col, range[1]);
        }
      }

      // Supabase has a default limit of 1000, we need all rows
      // Paginate to get everything
      const allRows: GameLogRow[] = [];
      let offset = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await query
          .range(offset, offset + pageSize - 1)
          .order("official_date", { ascending: false });

        if (error) {
          console.error("Query error:", error);
          break;
        }
        if (!data || data.length === 0) break;
        allRows.push(...(data as GameLogRow[]));
        if (data.length < pageSize) break;
        offset += pageSize;

        // Rebuild query for next page (supabase queries are not reusable after execution)
        query = supabase
          .from("mlb_game_log")
          .select("*")
          .not("won", "is", null);
        if (appliedFilters.teams.length > 0) query = query.in("team_abbr", appliedFilters.teams);
        if (appliedFilters.oppTeams.length > 0) query = query.in("opp_team_abbr", appliedFilters.oppTeams);
        if (appliedFilters.seasons.length > 0) query = query.in("season", appliedFilters.seasons);
        if (appliedFilters.homeAway) query = query.eq("home_away", appliedFilters.homeAway);
        if (appliedFilters.favUnderdog === "favorite") query = query.eq("is_favorite", true);
        else if (appliedFilters.favUnderdog === "underdog") query = query.eq("is_underdog", true);
        if (appliedFilters.isDivisional === "true") query = query.eq("is_divisional", true);
        else if (appliedFilters.isDivisional === "false") query = query.eq("is_divisional", false);
        if (appliedFilters.isInterleague === "true") query = query.eq("is_interleague", true);
        if (appliedFilters.spHand) query = query.eq("sp_hand", appliedFilters.spHand);
        if (appliedFilters.oppSpHand) query = query.eq("opp_sp_hand", appliedFilters.oppSpHand);
        for (const [col, val] of rangeFilters) {
          const r = parseRange(val);
          if (r) query = query.gte(col, r[0]).lte(col, r[1]);
        }
      }

      return allRows;
    },
    enabled: appliedFilters !== null,
  });

  // ── Compute team stats ──
  const teamStats: TeamStats[] = useMemo(() => {
    if (!results || results.length === 0) return [];

    const map = new Map<string, GameLogRow[]>();
    for (const row of results) {
      const team = row.team_abbr;
      if (!map.has(team)) map.set(team, []);
      map.get(team)!.push(row);
    }

    const stats: TeamStats[] = [];
    for (const [team, games] of map) {
      const total = games.length;
      const wins = games.filter((g) => g.won === true).length;
      const losses = total - wins;
      const scored = games.reduce((s, g) => s + (g.runs_scored ?? 0), 0);
      const allowed = games.reduce((s, g) => s + (g.runs_allowed ?? 0), 0);
      const margin = games.reduce((s, g) => s + (g.margin ?? 0), 0);
      const overs = games.filter((g) => g.ou_result === "over").length;
      const unders = games.filter((g) => g.ou_result === "under").length;
      const ouGames = overs + unders;
      const favGames = games.filter((g) => g.is_favorite === true);
      const favWins = favGames.filter((g) => g.won === true).length;
      const dogGames = games.filter((g) => g.is_underdog === true);
      const dogWins = dogGames.filter((g) => g.won === true).length;

      stats.push({
        team,
        wins,
        losses,
        winPct: total ? (wins / total) * 100 : 0,
        avgRunsScored: total ? scored / total : 0,
        avgRunsAllowed: total ? allowed / total : 0,
        avgMargin: total ? margin / total : 0,
        overPct: ouGames ? (overs / ouGames) * 100 : 0,
        underPct: ouGames ? (unders / ouGames) * 100 : 0,
        favRecord: favGames.length ? `${favWins}-${favGames.length - favWins}` : "-",
        dogRecord: dogGames.length ? `${dogWins}-${dogGames.length - dogWins}` : "-",
        total,
      });
    }

    stats.sort((a, b) => {
      const av = a[sortColumn];
      const bv = b[sortColumn];
      if (typeof av === "string" && typeof bv === "string")
        return sortDirection === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDirection === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });

    return stats;
  }, [results, sortColumn, sortDirection]);

  // ── Aggregate summary ──
  const aggregate = useMemo(() => {
    if (!results || results.length === 0) return null;
    const total = results.length;
    const wins = results.filter((r) => r.won === true).length;
    const overs = results.filter((r) => r.ou_result === "over").length;
    const unders = results.filter((r) => r.ou_result === "under").length;
    const ouGames = overs + unders;
    return {
      record: `${wins}-${total - wins}`,
      winPct: ((wins / total) * 100).toFixed(1),
      total,
      overPct: ouGames ? ((overs / ouGames) * 100).toFixed(1) : "N/A",
    };
  }, [results]);

  // ── Handlers ──
  const handleFilterChange = (field: keyof Filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => setAppliedFilters({ ...filters });
  const clearFilters = () => {
    setFilters({ ...emptyFilters });
    setAppliedFilters(null);
  };

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ col }: { col: SortColumn }) =>
    sortColumn === col ? (
      sortDirection === "asc" ? (
        <ChevronUp className="w-3 h-3 inline ml-1" />
      ) : (
        <ChevronDown className="w-3 h-3 inline ml-1" />
      )
    ) : null;

  // ── Team multi-select dropdown ──
  const TeamDropdown = ({
    label,
    selected,
    onChange,
  }: {
    label: string;
    selected: string[];
    onChange: (v: string[]) => void;
  }) => (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between text-sm">
            {selected.length === 0
              ? "All Teams"
              : selected.length === 1
              ? selected[0]
              : `${selected.length} Teams`}
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 max-h-72 overflow-y-auto">
          <div className="p-2">
            <div className="flex items-center space-x-2 pb-2 mb-2 border-b">
              <Checkbox
                id={`${label}-all`}
                checked={selected.length === 0}
                onCheckedChange={() => onChange([])}
              />
              <Label htmlFor={`${label}-all`} className="cursor-pointer text-sm font-medium">
                All Teams
              </Label>
            </div>
            {MLB_TEAMS.map((t) => (
              <div key={t.abbr} className="flex items-center space-x-2 py-0.5">
                <Checkbox
                  id={`${label}-${t.abbr}`}
                  checked={selected.includes(t.abbr)}
                  onCheckedChange={() =>
                    onChange(
                      selected.includes(t.abbr)
                        ? selected.filter((x) => x !== t.abbr)
                        : [...selected, t.abbr]
                    )
                  }
                />
                <Label htmlFor={`${label}-${t.abbr}`} className="cursor-pointer text-xs">
                  {t.abbr} - {t.name}
                </Label>
              </div>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // ── Collapsible filter section ──
  const FilterSection = ({
    sectionKey,
    title,
    color,
    children,
  }: {
    sectionKey: string;
    title: string;
    color: string;
    children: React.ReactNode;
  }) => (
    <Card className={`border-l-4 ${color}`}>
      <CardHeader
        className="cursor-pointer py-3 px-4"
        onClick={() => toggleSection(sectionKey)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <ChevronRight
            className={`h-4 w-4 transition-transform ${
              expandedSections[sectionKey] ? "rotate-90" : ""
            }`}
          />
        </div>
      </CardHeader>
      {expandedSections[sectionKey] && (
        <CardContent className="pt-0 pb-4 px-4">{children}</CardContent>
      )}
    </Card>
  );

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.teams.length) c++;
    if (filters.oppTeams.length) c++;
    if (filters.seasons.length) c++;
    if (filters.homeAway) c++;
    if (filters.favUnderdog) c++;
    if (filters.isDivisional) c++;
    if (filters.isInterleague) c++;
    if (filters.spHand) c++;
    if (filters.oppSpHand) c++;
    const rangeKeys: (keyof Filters)[] = [
      "batWoba", "batXwobacon", "batBarrelPct", "batHardHitPct", "batOps",
      "spEra", "spXfip", "spXera", "oppSpXfip", "oppSpXera", "oppBpXfip",
      "tempF", "windMph", "daysRest", "streak", "closingMl", "closingTotal",
    ];
    for (const k of rangeKeys) if (filters[k]) c++;
    return c;
  }, [filters]);

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link to="/" className="hover:text-primary transition-colors">
              <HomeIcon className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span>MLB</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">Historical Analysis</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            MLB Historical Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Set filters across 2023-2026 to see team records, trends, and performance breakdowns.
          </p>
        </div>

        {/* Filters */}
        <div className="grid gap-3 mb-4">
          {/* Game Context - always expanded */}
          <FilterSection sectionKey="game" title="Team & Game Context" color="border-blue-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <TeamDropdown
                label="Team"
                selected={filters.teams}
                onChange={(v) => handleFilterChange("teams", v)}
              />
              <TeamDropdown
                label="Opponent"
                selected={filters.oppTeams}
                onChange={(v) => handleFilterChange("oppTeams", v)}
              />

              {/* Season multi-select */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">Season</Label>
                <div className="flex flex-wrap gap-2">
                  {SEASONS.map((s) => (
                    <Button
                      key={s}
                      variant={filters.seasons.includes(s) ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        handleFilterChange(
                          "seasons",
                          filters.seasons.includes(s)
                            ? filters.seasons.filter((x) => x !== s)
                            : [...filters.seasons, s]
                        )
                      }
                      className="text-xs"
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Home/Away */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">Home / Away</Label>
                <Select
                  value={filters.homeAway || "all"}
                  onValueChange={(v) => handleFilterChange("homeAway", v === "all" ? "" : v)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="home">Home</SelectItem>
                    <SelectItem value="away">Away</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Favorite/Underdog */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">Favorite / Underdog</Label>
                <Select
                  value={filters.favUnderdog || "all"}
                  onValueChange={(v) => handleFilterChange("favUnderdog", v === "all" ? "" : v)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="favorite">Favorite</SelectItem>
                    <SelectItem value="underdog">Underdog</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Divisional */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">Division Game</Label>
                <Select
                  value={filters.isDivisional || "all"}
                  onValueChange={(v) => handleFilterChange("isDivisional", v === "all" ? "" : v)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Division</SelectItem>
                    <SelectItem value="false">Non-Division</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Interleague */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">Interleague</Label>
                <Select
                  value={filters.isInterleague || "all"}
                  onValueChange={(v) => handleFilterChange("isInterleague", v === "all" ? "" : v)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Interleague Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* SP Hand */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">SP Hand (Team)</Label>
                <Select
                  value={filters.spHand || "all"}
                  onValueChange={(v) => handleFilterChange("spHand", v === "all" ? "" : v)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="R">Right</SelectItem>
                    <SelectItem value="L">Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FilterSection>

          {/* Odds & Lines */}
          <FilterSection sectionKey="odds" title="Odds & Lines" color="border-green-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumericRangeFilter
                label="Moneyline"
                field="closingMl"
                value={filters.closingMl}
                onChange={(_, v) => handleFilterChange("closingMl", v)}
                min={-500}
                max={500}
                step={10}
                formatValue={(v) => (v > 0 ? `+${v}` : `${v}`)}
              />
              <NumericRangeFilter
                label="Total Line (O/U)"
                field="closingTotal"
                value={filters.closingTotal}
                onChange={(_, v) => handleFilterChange("closingTotal", v)}
                min={5}
                max={15}
                step={0.5}
                formatValue={(v) => v.toFixed(1)}
              />
            </div>
          </FilterSection>

          {/* Batting Stats */}
          <FilterSection sectionKey="batting" title="Team Batting (Pregame)" color="border-orange-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <NumericRangeFilter
                label="Season wOBA"
                field="batWoba"
                value={filters.batWoba}
                onChange={(_, v) => handleFilterChange("batWoba", v)}
                min={0.250}
                max={0.400}
                step={0.005}
                formatValue={(v) => v.toFixed(3)}
              />
              <NumericRangeFilter
                label="Season xwOBACON"
                field="batXwobacon"
                value={filters.batXwobacon}
                onChange={(_, v) => handleFilterChange("batXwobacon", v)}
                min={0.250}
                max={0.400}
                step={0.005}
                formatValue={(v) => v.toFixed(3)}
              />
              <NumericRangeFilter
                label="Season Barrel%"
                field="batBarrelPct"
                value={filters.batBarrelPct}
                onChange={(_, v) => handleFilterChange("batBarrelPct", v)}
                min={0}
                max={0.15}
                step={0.005}
                formatValue={(v) => (v * 100).toFixed(1) + "%"}
              />
              <NumericRangeFilter
                label="Season Hard Hit%"
                field="batHardHitPct"
                value={filters.batHardHitPct}
                onChange={(_, v) => handleFilterChange("batHardHitPct", v)}
                min={0.25}
                max={0.55}
                step={0.005}
                formatValue={(v) => (v * 100).toFixed(1) + "%"}
              />
              <NumericRangeFilter
                label="Season OPS"
                field="batOps"
                value={filters.batOps}
                onChange={(_, v) => handleFilterChange("batOps", v)}
                min={0.550}
                max={0.900}
                step={0.005}
                formatValue={(v) => v.toFixed(3)}
              />
            </div>
          </FilterSection>

          {/* Starting Pitcher */}
          <FilterSection sectionKey="pitching" title="Team Starting Pitcher (Pregame)" color="border-purple-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <NumericRangeFilter
                label="SP Season ERA"
                field="spEra"
                value={filters.spEra}
                onChange={(_, v) => handleFilterChange("spEra", v)}
                min={1}
                max={8}
                step={0.1}
                formatValue={(v) => v.toFixed(2)}
              />
              <NumericRangeFilter
                label="SP Season xFIP"
                field="spXfip"
                value={filters.spXfip}
                onChange={(_, v) => handleFilterChange("spXfip", v)}
                min={2}
                max={7}
                step={0.1}
                formatValue={(v) => v.toFixed(2)}
              />
              <NumericRangeFilter
                label="SP Season xERA"
                field="spXera"
                value={filters.spXera}
                onChange={(_, v) => handleFilterChange("spXera", v)}
                min={2}
                max={7}
                step={0.1}
                formatValue={(v) => v.toFixed(2)}
              />
            </div>
          </FilterSection>

          {/* Opponent Pitcher/Bullpen */}
          <FilterSection sectionKey="opponent" title="Opponent Pitching (Pregame)" color="border-red-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Opp SP Hand</Label>
                <Select
                  value={filters.oppSpHand || "all"}
                  onValueChange={(v) => handleFilterChange("oppSpHand", v === "all" ? "" : v)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="R">Right</SelectItem>
                    <SelectItem value="L">Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <NumericRangeFilter
                label="Opp SP Season xFIP"
                field="oppSpXfip"
                value={filters.oppSpXfip}
                onChange={(_, v) => handleFilterChange("oppSpXfip", v)}
                min={2}
                max={7}
                step={0.1}
                formatValue={(v) => v.toFixed(2)}
              />
              <NumericRangeFilter
                label="Opp SP Season xERA"
                field="oppSpXera"
                value={filters.oppSpXera}
                onChange={(_, v) => handleFilterChange("oppSpXera", v)}
                min={2}
                max={7}
                step={0.1}
                formatValue={(v) => v.toFixed(2)}
              />
              <NumericRangeFilter
                label="Opp Bullpen xFIP"
                field="oppBpXfip"
                value={filters.oppBpXfip}
                onChange={(_, v) => handleFilterChange("oppBpXfip", v)}
                min={2}
                max={7}
                step={0.1}
                formatValue={(v) => v.toFixed(2)}
              />
            </div>
          </FilterSection>

          {/* Weather & Schedule */}
          <FilterSection sectionKey="weather" title="Weather & Schedule" color="border-cyan-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <NumericRangeFilter
                label="Temperature (F)"
                field="tempF"
                value={filters.tempF}
                onChange={(_, v) => handleFilterChange("tempF", v)}
                min={30}
                max={110}
                step={1}
                formatValue={(v) => `${v}°F`}
              />
              <NumericRangeFilter
                label="Wind Speed (mph)"
                field="windMph"
                value={filters.windMph}
                onChange={(_, v) => handleFilterChange("windMph", v)}
                min={0}
                max={30}
                step={1}
                formatValue={(v) => `${v} mph`}
              />
              <NumericRangeFilter
                label="Days Rest"
                field="daysRest"
                value={filters.daysRest}
                onChange={(_, v) => handleFilterChange("daysRest", v)}
                min={0}
                max={7}
                step={1}
              />
              <NumericRangeFilter
                label="W/L Streak"
                field="streak"
                value={filters.streak}
                onChange={(_, v) => handleFilterChange("streak", v)}
                min={-15}
                max={15}
                step={1}
                formatValue={(v) => (v > 0 ? `W${v}` : v < 0 ? `L${Math.abs(v)}` : "0")}
              />
            </div>
          </FilterSection>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap mb-6">
          <Button
            onClick={applyFilters}
            disabled={isLoading}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Loading...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Apply Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={clearFilters}>
            <Sparkles className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        </div>

        {/* Aggregate Summary */}
        {aggregate && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Record</p>
                <p className="text-2xl font-bold">{aggregate.record}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold text-green-600">{aggregate.winPct}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Over Rate</p>
                <p className="text-2xl font-bold text-orange-600">{aggregate.overPct}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Total Games</p>
                <p className="text-2xl font-bold">{aggregate.total.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Team Performance Table */}
        {teamStats.length > 0 && (
          <Card className="border-l-4 border-blue-500">
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-4">
                Team Performance ({results?.length.toLocaleString()} games)
              </h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {[
                        { col: "team" as SortColumn, label: "Team" },
                        { col: "wins" as SortColumn, label: "W" },
                        { col: "losses" as SortColumn, label: "L" },
                        { col: "winPct" as SortColumn, label: "Win%" },
                        { col: "avgRunsScored" as SortColumn, label: "RS/G" },
                        { col: "avgRunsAllowed" as SortColumn, label: "RA/G" },
                        { col: "avgMargin" as SortColumn, label: "Margin" },
                        { col: "overPct" as SortColumn, label: "Over%" },
                        { col: "favRecord" as SortColumn, label: "As Fav" },
                        { col: "dogRecord" as SortColumn, label: "As Dog" },
                        { col: "total" as SortColumn, label: "Games" },
                      ].map(({ col, label }) => (
                        <TableHead key={col} className={col !== "team" ? "text-center" : ""}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-auto font-medium text-xs"
                            onClick={() => handleSort(col)}
                          >
                            {label}
                            <SortIcon col={col} />
                          </Button>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamStats.map((t) => (
                      <TableRow key={t.team} className="hover:bg-muted/50">
                        <TableCell className="font-semibold">{t.team}</TableCell>
                        <TableCell className="text-center">{t.wins}</TableCell>
                        <TableCell className="text-center">{t.losses}</TableCell>
                        <TableCell className="text-center font-semibold text-green-600">
                          {t.winPct.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center">{t.avgRunsScored.toFixed(2)}</TableCell>
                        <TableCell className="text-center">{t.avgRunsAllowed.toFixed(2)}</TableCell>
                        <TableCell
                          className={`text-center font-medium ${
                            t.avgMargin > 0
                              ? "text-green-600"
                              : t.avgMargin < 0
                              ? "text-red-500"
                              : ""
                          }`}
                        >
                          {t.avgMargin > 0 ? "+" : ""}
                          {t.avgMargin.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center text-orange-600">
                          {t.overPct.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center text-sm">{t.favRecord}</TableCell>
                        <TableCell className="text-center text-sm">{t.dogRecord}</TableCell>
                        <TableCell className="text-center">{t.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No results */}
        {appliedFilters && !isLoading && (!results || results.length === 0) && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground font-medium">
                No results found with the current filters.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your filter criteria.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
