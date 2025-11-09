import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { collegeFootballSupabase } from "@/integrations/supabase/college-football-client";
import { useLiveScores } from "@/hooks/useLiveScores";
import { gamesMatch } from "@/utils/teamMatching";
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
    // Fetch raw live scores
    const { data: liveScoresData } = await supabase
      .from('live_scores')
      .select('*')
      .eq('is_live', true);
    setLiveScoresRaw(liveScoresData || []);

    // Fetch NFL predictions
    const { data: latestNFLRun } = await collegeFootballSupabase
      .from('nfl_predictions_epa')
      .select('run_id')
      .order('run_id', { ascending: false })
      .limit(1)
      .single();

    if (latestNFLRun) {
      const { data: nflPreds } = await collegeFootballSupabase
        .from('nfl_predictions_epa')
        .select('*')
        .eq('run_id', latestNFLRun.run_id)
        .limit(20);
      
      const { data: nflLines } = await collegeFootballSupabase
        .from('nfl_betting_lines')
        .select('*')
        .limit(20);

      const merged = (nflPreds || []).map(pred => {
        const line = nflLines?.find(l => l.training_key === pred.training_key);
        return { ...pred, ...line };
      });
      
      setNflPredictions(merged);
    }

    // Fetch CFB predictions
    const { data: cfbPreds } = await collegeFootballSupabase
      .from('cfb_live_weekly_inputs')
      .select('*')
      .limit(20);
    setCfbPredictions(cfbPreds || []);

    // Match games with predictions
    const results = (liveScoresData || []).map((game: any) => {
      const isNFL = game.league === 'NFL';
      const predictions = isNFL ? merged : (cfbPreds || []);
      
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
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh All Data
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Live Games</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{liveScoresRaw.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">NFL Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nflPredictions.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CFB Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cfbPredictions.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Matched Games</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {diagnosticResults.filter(r => r.hasMatch).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enriched Games from Hook */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Enriched Games (from useLiveScores hook)</CardTitle>
        </CardHeader>
        <CardContent>
          {games.length === 0 ? (
            <p className="text-muted-foreground">No live games currently</p>
          ) : (
            <div className="space-y-3">
              {games.map((game) => (
                <div key={game.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <Badge>{game.league}</Badge>
                      <span className="ml-2 font-semibold">
                        {game.away_abbr} @ {game.home_abbr}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {game.away_score} - {game.home_score}
                      </span>
                    </div>
                    <div>
                      {game.predictions ? (
                        <Badge variant="default" className="bg-green-500">
                          <Check className="w-3 h-3 mr-1" />
                          Has Predictions
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <X className="w-3 h-3 mr-1" />
                          No Predictions
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {game.predictions && (
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                      {game.predictions.moneyline && (
                        <div className={`p-2 rounded ${game.predictions.moneyline.isHitting ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                          <div className="font-semibold">ML: {game.predictions.moneyline.predicted}</div>
                          <div className="text-xs">
                            {game.predictions.moneyline.isHitting ? '✓ Hitting' : '✗ Not hitting'}
                          </div>
                          <div className="text-xs">Prob: {(game.predictions.moneyline.probability * 100).toFixed(1)}%</div>
                        </div>
                      )}
                      
                      {game.predictions.spread && (
                        <div className={`p-2 rounded ${game.predictions.spread.isHitting ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                          <div className="font-semibold">
                            Spread: {game.predictions.spread.predicted} {game.predictions.spread.line}
                          </div>
                          <div className="text-xs">
                            {game.predictions.spread.isHitting ? '✓ Hitting' : '✗ Not hitting'}
                          </div>
                          <div className="text-xs">Prob: {(game.predictions.spread.probability * 100).toFixed(1)}%</div>
                        </div>
                      )}
                      
                      {game.predictions.overUnder && (
                        <div className={`p-2 rounded ${game.predictions.overUnder.isHitting ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                          <div className="font-semibold">
                            O/U: {game.predictions.overUnder.predicted} {game.predictions.overUnder.line}
                          </div>
                          <div className="text-xs">
                            {game.predictions.overUnder.isHitting ? '✓ Hitting' : '✗ Not hitting'}
                          </div>
                          <div className="text-xs">Prob: {(game.predictions.overUnder.probability * 100).toFixed(1)}%</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Matching Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle>Game-Prediction Matching Details</CardTitle>
        </CardHeader>
        <CardContent>
          {diagnosticResults.length === 0 ? (
            <p className="text-muted-foreground">No games to analyze</p>
          ) : (
            <div className="space-y-3">
              {diagnosticResults.map((result, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge>{result.league}</Badge>
                        {result.hasMatch ? (
                          <Badge variant="default" className="bg-green-500">
                            <Check className="w-3 h-3 mr-1" />
                            Matched
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <X className="w-3 h-3 mr-1" />
                            No Match
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="font-semibold mb-1">Live Game:</div>
                          <div className="text-muted-foreground">
                            <div>Away: {result.game.away_team}</div>
                            <div>Home: {result.game.home_team}</div>
                            <div>Score: {result.game.away_score} - {result.game.home_score}</div>
                          </div>
                        </div>
                        
                        <div>
                          <div className="font-semibold mb-1">
                            {result.hasMatch ? 'Matched Prediction:' : 'No Prediction Found'}
                          </div>
                          {result.matchedPrediction ? (
                            <div className="text-muted-foreground">
                              <div>Away: {result.matchedPrediction.away_team}</div>
                              <div>Home: {result.matchedPrediction.home_team}</div>
                              {result.league === 'NFL' && (
                                <>
                                  <div className="mt-1 text-xs">
                                    ML: {result.matchedPrediction.home_away_ml_prob?.toFixed(3)}
                                  </div>
                                  <div className="text-xs">
                                    Spread: {result.matchedPrediction.home_spread}
                                  </div>
                                  <div className="text-xs">
                                    O/U: {result.matchedPrediction.over_line}
                                  </div>
                                </>
                              )}
                              {result.league === 'NCAAF' && (
                                <>
                                  <div className="mt-1 text-xs">
                                    ML: {result.matchedPrediction.pred_ml_proba?.toFixed(3)}
                                  </div>
                                  <div className="text-xs">
                                    Spread: {result.matchedPrediction.api_spread}
                                  </div>
                                  <div className="text-xs">
                                    O/U: {result.matchedPrediction.api_over_line}
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-xs">
                              <AlertCircle className="w-4 h-4 inline mr-1" />
                              Check if team names in predictions table match live game team names
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Predictions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Available NFL Predictions (Sample)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm max-h-96 overflow-y-auto">
              {nflPredictions.slice(0, 10).map((pred, idx) => (
                <div key={idx} className="border-b pb-2">
                  <div className="font-semibold">{pred.away_team} @ {pred.home_team}</div>
                  <div className="text-xs text-muted-foreground">
                    ML: {pred.home_away_ml_prob?.toFixed(3)} | 
                    Spread: {pred.home_spread} | 
                    O/U: {pred.over_line}
                  </div>
                </div>
              ))}
              {nflPredictions.length === 0 && (
                <p className="text-muted-foreground">No NFL predictions found</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available CFB Predictions (Sample)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm max-h-96 overflow-y-auto">
              {cfbPredictions.slice(0, 10).map((pred, idx) => (
                <div key={idx} className="border-b pb-2">
                  <div className="font-semibold">{pred.away_team} @ {pred.home_team}</div>
                  <div className="text-xs text-muted-foreground">
                    ML: {pred.pred_ml_proba?.toFixed(3)} | 
                    Spread: {pred.api_spread} | 
                    O/U: {pred.api_over_line}
                  </div>
                </div>
              ))}
              {cfbPredictions.length === 0 && (
                <p className="text-muted-foreground">No CFB predictions found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

