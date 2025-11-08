import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Sparkles } from 'lucide-react';
import { getLatestValueFinds, AIValueFind } from '@/services/aiCompletionService';
import debug from '@/utils/debug';
import Aurora from '@/components/magicui/aurora';

interface ValueFindsProps {
  sportType: 'nfl' | 'cfb';
  gamesData?: Map<string, any>; // Map of game_id to game data
}

export function ValueFindsSection({ sportType, gamesData }: ValueFindsProps) {
  const [valueFinds, setValueFinds] = useState<AIValueFind | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchValueFinds();
  }, [sportType]);

  const fetchValueFinds = async () => {
    try {
      setLoading(true);
      const finds = await getLatestValueFinds(sportType, 1);
      
      if (finds && finds.length > 0) {
        setValueFinds(finds[0]);
      } else {
        setValueFinds(null);
      }
    } catch (error) {
      debug.error('Error fetching value finds:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mb-8">
        <div className="h-64 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 animate-pulse" />
      </div>
    );
  }

  if (!valueFinds || !valueFinds.value_picks || valueFinds.value_picks.length === 0) {
    return null;
  }

  const sportLabel = sportType === 'nfl' ? 'NFL' : 'College Football';

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-500" />
          <h2 className="text-2xl font-bold text-white">AI Value Finds</h2>
        </div>
        <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-none">
          {sportLabel}
        </Badge>
        <Badge variant="outline" className="text-white/70 border-white/20">
          {new Date(valueFinds.generated_at).toLocaleDateString()}
        </Badge>
      </div>

      {/* Summary Card */}
      <Card 
        className="mb-6 border-white/20 overflow-hidden relative"
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
        }}
      >
        <Aurora
          size={400}
          className="opacity-30"
          color1="rgba(139, 92, 246, 0.3)"
          color2="rgba(59, 130, 246, 0.3)"
        />
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            AI Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-white/80 leading-relaxed">
            {valueFinds.summary_text}
          </p>
        </CardContent>
      </Card>

      {/* Value Pick Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {valueFinds.value_picks.map((pick: any, index: number) => {
          const gameData = gamesData?.get(pick.game_id);
          
          return (
            <Card
              key={index}
              className="border-white/20 hover:border-purple-500/50 transition-all duration-300 overflow-hidden relative"
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
              }}
            >
              <Aurora
                size={300}
                className="opacity-20"
                color1="rgba(139, 92, 246, 0.2)"
                color2="rgba(59, 130, 246, 0.2)"
              />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Badge className="bg-purple-600/80 text-white">
                    Value Opportunity
                  </Badge>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Game Info */}
                {gameData && (
                  <div className="text-center pb-2 border-b border-white/10">
                    <p className="text-xs text-white/60 mb-1">
                      {gameData.game_date || gameData.start_time}
                    </p>
                    <p className="text-white font-semibold">
                      {gameData.away_team}
                    </p>
                    <p className="text-white/50 text-xs">@</p>
                    <p className="text-white font-semibold">
                      {gameData.home_team}
                    </p>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <p className="text-xs text-white/60 mb-1">Why it's value:</p>
                  <p className="text-white/90 text-sm leading-relaxed">
                    {pick.reason}
                  </p>
                </div>

                {/* Key Data Points */}
                {pick.key_data && pick.key_data.length > 0 && (
                  <div>
                    <p className="text-xs text-white/60 mb-2">Key indicators:</p>
                    <div className="flex flex-wrap gap-1">
                      {pick.key_data.map((dataPoint: string, idx: number) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="text-xs text-white/70 border-white/20"
                        >
                          {dataPoint}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="mt-4 text-center text-xs text-white/50">
        AI-generated analysis based on model predictions, Vegas lines, public betting, and market data.
        Always do your own research before placing bets.
      </div>
    </div>
  );
}

