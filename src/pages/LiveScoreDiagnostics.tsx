import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { collegeFootballSupabase } from "@/integrations/supabase/college-football-client";
import { useLiveScores } from "@/hooks/useLiveScores";
import { gamesMatch } from "@/utils/teamMatching";
import { resolveLatestSlate } from "@/features/games/api/footballSlate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Check, X, AlertCircle } from "lucide-react";

export default function LiveScoreDiagnostics() {
  const { games, isLoading, refetch } = useLiveScores();
  const [nflPredictions, setNflPredictions] = useState<any[]>([]);
  const [cfbPredictions, setCfbPredictions] = useState<any[]>([]);
  const [liveScoresRaw, setLiveScoresRaw] = useState<any[]>([]);
  const [diagnosticResults, setDiagnosticResults] = useState<any[]>([]);

  const fetchDiagnosticData = async () => {
    const { data: liveScoresData } = await supabase
      .from('live_scores')
      .select('*')
      .eq('is_live', true);
    setLiveScoresRaw(liveScoresData || []);

    const nflAnchor = await resolveLatestSlate('nfl_dryrun_games');
    const { data: nflPreds } = await collegeFootballSupabase
      .from('nfl_dryrun_games')
      .select('*')
      .eq('season', nflAnchor.season)
      .eq('week', nflAnchor.week)
      .limit(20);

    const merged = (nflPreds || []).map((r: any) => {
      const homeSpread = r.fg_spread_close ?? null;
      return {
        ...r,
        training_key: r.game_id,
        home_spread: homeSpread,
        away_spread: homeSpread !== null ? -Number(homeSpread) : null,
        over_line: r.fg_total_close ?? null,
        home_away_ml_prob: r.fg_home_win_prob ?? null,
        home_away_spread_cover_prob: r.fg_home_cover_prob ?? null,
      };
    });
    setNflPredictions(merged);

    const cfbAnchor = await resolveLatestSlate('cfb_dryrun_games');
    const { data: cfbPreds } = await collegeFootballSupabase
      .from('cfb_dryrun_games')
      .select('*')
      .eq('season', cfbAnchor.season)
      .eq('week', cfbAnchor.week)
      .limit(20);

    const cfbMapped = (cfbPreds || []).map((r: any) => ({
      ...r,
      api_spread: r.fg_spread_close ?? null,
      api_over_line: r.fg_total_close ?? null,
      home_spread: r.fg_spread_close ?? null,
    }));
    setCfbPredictions(cfbMapped);

    const results = (liveScoresData || []).map((game: any) => {
      const isNFL = game.league === 'NFL';
      const predictions = isNFL ? merged : cfbMapped;

      const matchedPrediction = predictions.find((pred: any) =>
        gamesMatch(
          { home_team: game.home_team, away_team: game.away_team },
          { home_team: pred.home_team, away_team: pred.away_team }
        )
      );

      return {
        game,
        matchedPrediction,
        hasMatch: !!matchedPrediction,
        league: game.league
      };
    });

    setDiagnosticResults(results);
  };

  useEffect(() => {
    fetchDiagnosticData();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">Live Score Diagnostics</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Live Score Diagnostics</h1>
        <Button onClick={() => { refetch(); fetchDiagnosticData(); }}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Live Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{liveScoresRaw.length}</p>
            <p className="text-sm text-muted-foreground">Raw live_scores rows</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>NFL Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{nflPredictions.length}</p>
            <p className="text-sm text-muted-foreground">nfl_dryrun_games (current week)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>CFB Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{cfbPredictions.length}</p>
            <p className="text-sm text-muted-foreground">cfb_dryrun_games (current week)</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Match Results ({diagnosticResults.filter(r => r.hasMatch).length}/{diagnosticResults.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {diagnosticResults.length === 0 ? (
            <p className="text-muted-foreground">No live games to match.</p>
          ) : (
            diagnosticResults.map((result, i) => (
              <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                {result.hasMatch ? (
                  <Check className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <X className="h-5 w-5 text-red-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{result.league}</Badge>
                    <span className="font-medium">
                      {result.game.away_team} @ {result.game.home_team}
                    </span>
                  </div>
                  {result.matchedPrediction ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      Matched → {result.matchedPrediction.away_team} @ {result.matchedPrediction.home_team}
                      {result.matchedPrediction.home_spread != null && (
                        <> · Spread: {result.matchedPrediction.home_spread}</>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> No prediction match
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hook Games ({games.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {games.map((g, i) => (
              <div key={i} className="text-sm border-b pb-2">
                {g.away_team} @ {g.home_team} · {g.league}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sample Predictions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {[...nflPredictions.slice(0, 5), ...cfbPredictions.slice(0, 5)].map((pred, i) => (
              <div key={i} className="text-sm border-b pb-2">
                {pred.away_team} @ {pred.home_team}
                {pred.home_spread != null && <> · Spread: {pred.home_spread}</>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
