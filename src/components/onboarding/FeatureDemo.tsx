import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GradientText } from "@/components/ui/gradient-text";
import { 
  Target, 
  Brain, 
  TrendingUp, 
  CheckCircle, 
  Users,
  Trophy,
  Zap,
  ArrowRight,
  BarChart3
} from "lucide-react";

interface FeatureDemoProps {
  onComplete: () => void;
}

export function FeatureDemo({ onComplete }: FeatureDemoProps) {
  const [activeFeature, setActiveFeature] = useState<'edge-finder' | 'ai-simulator'>('edge-finder');

  const edgeFinderData = {
    game: {
      away_team: 'Kansas City',
      home_team: 'Buffalo', 
      away_ml: -145,
      home_ml: 125,
      away_spread: -3.5,
      home_spread: 3.5,
      over_line: 51.5
    },
    predictions: {
      spread_confidence: 67,
      total_confidence: 74,
      model_spread: -2.0,
      market_spread: -3.5,
      edge: 1.5,
      model_total: 54.2,
      market_total: 51.5,
      total_edge: 2.7
    }
  };

  const aiSimulatorData = {
    game_info: {
      primary_team: 'Kansas City',
      opponent_team: 'Buffalo'
    },
    consensus: {
      primary_percentage: 0.67,
      opponent_percentage: 0.33,
      confidence: 74,
      models: 3,
      team_winner_prediction: 'Kansas City'
    },
    models: [
      {
        name: 'EPA Composite Model',
        win_pct: 0.65,
        opponent_win_pct: 0.35,
        features: ['Team Win%', 'EPA/Play', 'Red Zone%', 'Turnover Margin'],
        games: 45,
        confidence: 72
      },
      {
        name: 'Advanced Metrics Model', 
        win_pct: 0.71,
        opponent_win_pct: 0.29,
        features: ['DVOA', 'Success Rate', 'Explosive Play%'],
        games: 38,
        confidence: 78
      },
      {
        name: 'Situational Model',
        win_pct: 0.64,
        opponent_win_pct: 0.36,
        features: ['Home Field', 'Rest Days', 'Weather', 'Injuries'],
        games: 52,
        confidence: 71
      }
    ]
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2 sm:space-y-3 px-2">
        <motion.h2
          className="text-xl sm:text-2xl md:text-3xl font-bold text-white"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Tools built for your goals
        </motion.h2>
        <motion.p
          className="text-sm sm:text-base text-white/80"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Use <GradientText text="Edge Finder" className="font-semibold" /> to spot model vs. market discrepancies. Use <GradientText text="AI Game Simulator" className="font-semibold" /> for matchup outcomes and probabilities.
        </motion.p>
      </div>

      {/* Feature Toggle */}
      <motion.div 
        className="flex justify-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
      >
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1 flex">
          <Button
            variant={activeFeature === 'edge-finder' ? 'default' : 'ghost'}
            onClick={() => setActiveFeature('edge-finder')}
            className={`flex items-center gap-2 text-sm ${
              activeFeature === 'edge-finder' 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'text-white hover:bg-white/10'
            }`}
          >
            <Target className="h-4 w-4" />
            Edge Finder
          </Button>
          <Button
            variant={activeFeature === 'ai-simulator' ? 'default' : 'ghost'}
            onClick={() => setActiveFeature('ai-simulator')}
            className={`flex items-center gap-2 text-sm ${
              activeFeature === 'ai-simulator' 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'text-white hover:bg-white/10'
            }`}
          >
            <Brain className="h-4 w-4" />
            AI Game Simulator
          </Button>
        </div>
      </motion.div>

      {/* Feature Demos */}
      <AnimatePresence mode="wait">
        {activeFeature === 'edge-finder' && (
          <motion.div
            key="edge-finder"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {/* Mini Edge Finder Demo */}
            <div className="bg-white/5 backdrop-blur-sm border border-green-500/20 rounded-lg p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <Target className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
                <h3 className="text-base sm:text-lg font-bold text-white">Edge Finder</h3>
                <Badge className="bg-green-500/20 text-green-300 text-xs border border-green-500/30">
                  Live Demo
                </Badge>
              </div>

              {/* Mini Game Header */}
              <div className="flex justify-between items-center mb-3 sm:mb-4 p-2 sm:p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="text-center">
                  <div className="h-8 w-8 mx-auto mb-1 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                    <span className="text-xs font-bold text-red-300">KC</span>
                  </div>
                  <p className="text-xs font-semibold text-white/80">Kansas City</p>
                </div>
                <span className="text-lg font-bold text-white/40">@</span>
                <div className="text-center">
                  <div className="h-8 w-8 mx-auto mb-1 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
                    <span className="text-xs font-bold text-blue-300">BUF</span>
                  </div>
                  <p className="text-xs font-semibold text-white/80">Buffalo</p>
                </div>
              </div>

              {/* Compact Edge Analysis */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="bg-green-500/10 p-2 sm:p-3 rounded-lg border border-green-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-green-300">Spread Edge</span>
                    <Badge className="bg-green-500 text-white text-xs">1.5pt</Badge>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/60">Market:</span>
                      <span className="text-white">KC -3.5</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Model:</span>
                      <span className="text-green-300 font-medium">KC -2.0</span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-500/10 p-2 sm:p-3 rounded-lg border border-blue-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-blue-300">Total Edge</span>
                    <Badge className="bg-blue-500 text-white text-xs">2.7pt</Badge>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/60">Market:</span>
                      <span className="text-white">51.5</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Model:</span>
                      <span className="text-blue-300 font-medium">54.2</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Benefits */}
              <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-3 w-3 text-yellow-400" />
                  <span className="text-xs font-semibold text-white">Why It's Superior</span>
                </div>
                <ul className="space-y-1 text-xs text-white/70">
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-2 w-2 text-green-400 flex-shrink-0" />
                    <span>Real-time model calculations</span>
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-2 w-2 text-green-400 flex-shrink-0" />
                    <span>Quantified betting edges</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {activeFeature === 'ai-simulator' && (
          <motion.div
            key="ai-simulator"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {/* Mini AI Game Simulator Demo */}
            <div className="bg-white/5 backdrop-blur-sm border border-purple-500/20 rounded-lg p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
                <h3 className="text-base sm:text-lg font-bold text-white">AI Game Simulator</h3>
                <Badge className="bg-purple-500/20 text-purple-300 text-xs border border-purple-500/30">
                  Live Demo
                </Badge>
              </div>

              {/* Mini Consensus Prediction */}
              <div className="text-center p-3 sm:p-4 bg-white/5 rounded-lg mb-3 sm:mb-4 border border-white/10">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="h-10 w-10 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                    <span className="text-sm font-bold text-red-300">KC</span>
                  </div>
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  <div className="h-10 w-10 bg-blue-500/20 rounded-full flex items-center justify-center opacity-50 border border-blue-500/30">
                    <span className="text-sm font-bold text-blue-300">BUF</span>
                  </div>
                </div>
                <h4 className="text-base font-bold text-purple-300 mb-2">Kansas City Wins</h4>
                <div className="flex items-center justify-center gap-2">
                  <Badge className="bg-purple-500/20 text-purple-300 text-xs border border-purple-500/30">67% Confidence</Badge>
                  <Badge className="bg-white/10 text-white/70 text-xs border border-white/20">3 Models</Badge>
                </div>
              </div>

              {/* Compact Models */}
              <div className="space-y-2 mb-3 sm:mb-4">
                <h4 className="text-xs sm:text-sm font-semibold flex items-center gap-2 text-white">
                  <Users className="h-3 w-3 text-blue-400" />
                  Contributing Models
                </h4>
                {aiSimulatorData.models.slice(0, 2).map((model, index) => (
                  <div key={index} className="bg-white/5 rounded-lg p-2 sm:p-3 border border-white/10">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h5 className="text-xs font-medium text-white">{model.name}</h5>
                        <p className="text-xs text-white/60">
                          {model.features.length} features • {model.games} games
                        </p>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-300 text-xs border border-blue-500/30">
                        {model.confidence}%
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-center">
                        <p className="text-sm font-bold text-green-400">
                          {Math.round(model.win_pct * 100)}%
                        </p>
                        <p className="text-xs text-white/60">KC</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-red-400">
                          {Math.round(model.opponent_win_pct * 100)}%
                        </p>
                        <p className="text-xs text-white/60">BUF</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-center">
                  <Badge className="bg-white/10 text-white/70 text-xs border border-white/20">+ 1 more model</Badge>
                </div>
              </div>

              {/* Compact Benefits */}
              <div className="p-2 sm:p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-3 w-3 text-purple-400" />
                  <span className="text-xs font-semibold text-white">Why It's Superior</span>
                </div>
                <ul className="space-y-1 text-xs text-white/70">
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-2 w-2 text-green-400 flex-shrink-0" />
                    <span>Live game data integration</span>
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-2 w-2 text-green-400 flex-shrink-0" />
                    <span>Multiple specialized models</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue Button */}
      <motion.div 
        className="text-center pt-3 sm:pt-4 pb-4 sm:pb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <Button 
          onClick={onComplete}
          size="lg" 
          className="bg-green-500 hover:bg-green-600 text-white border-0 px-6 py-2"
        >
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </motion.div>
    </div>
  );
}
