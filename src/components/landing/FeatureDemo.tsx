import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { 
  Target, 
  Brain, 
  TrendingUp, 
  CheckCircle, 
  Users,
  Trophy,
  Zap,
  ArrowRight,
  BarChart3,
  AlertTriangle
} from "lucide-react";

export function FeatureDemo() {

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

  const outliersData = {
    game: {
      away_team: 'Cincinnati',
      home_team: 'New England',
      spread: '+8.5'
    },
    outliers: [
      {
        type: 'Spread',
        public_percentage: 21,
        model_confidence: 58,
        discrepancy: 37,
        recommendation: 'Value Play',
        team: 'Cincinnati'
      },
      {
        type: 'Total',
        public_percentage: 65,
        model_confidence: 35,
        discrepancy: 30,
        recommendation: 'Fade Alert',
        team: 'Under'
      }
    ]
  };

  return (
    <section className="py-14 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center space-y-4 mb-12">
          <motion.h2
            className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Professional-Grade Tools
          </motion.h2>
        </div>

        {/* Fan Stacked Feature Demos */}
        <div className="relative flex justify-center items-center min-h-[700px] py-20 overflow-visible px-4" style={{ perspective: '1000px' }}>
          {/* Edge Finder Card - Left Side */}
          <motion.div
            initial={{ opacity: 0, rotate: -12, y: 50, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, rotate: -8, y: 0, scale: 1, x: 'calc(-50% - 200px)' }}
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            whileHover={{ rotate: -5, scale: 1.05, z: 50, y: -10 }}
            className="absolute z-10 w-[380px] max-w-[calc(100vw-2rem)] sm:w-[380px] bottom-0"
            style={{ 
              transformStyle: 'preserve-3d',
              transformOrigin: 'bottom center',
              left: '50%',
            }}
          >
              {/* Mini Edge Finder Demo */}
              <div className="bg-white dark:bg-gray-800 border border-green-500/20 rounded-xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-6">
                  <Target className="h-6 w-6 text-green-500" />
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edge Finder</h3>
                </div>

                {/* Mini Game Header */}
                <div className="flex justify-between items-center mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="text-center">
                    <div className="h-10 w-10 mx-auto mb-2 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                      <span className="text-sm font-bold text-red-600 dark:text-red-400">KC</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Kansas City</p>
                  </div>
                  <span className="text-xl font-bold text-gray-400">@</span>
                  <div className="text-center">
                    <div className="h-10 w-10 mx-auto mb-2 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">BUF</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Buffalo</p>
                  </div>
                </div>

                {/* Compact Edge Analysis */}
                <div className="grid grid-cols-1 gap-4 mb-6">
                  <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">Spread Edge</span>
                      <Badge className="bg-green-500 text-white text-sm">1.5pt</Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Market:</span>
                        <span className="text-gray-900 dark:text-white font-medium">KC -3.5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Model:</span>
                        <span className="text-green-600 dark:text-green-400 font-medium">KC -2.0</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Edge</span>
                      <Badge className="bg-blue-500 text-white text-sm">2.7pt</Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Market:</span>
                        <span className="text-gray-900 dark:text-white font-medium">51.5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Model:</span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">54.2</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compact Benefits */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Why It's Superior</span>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      <span>Real-time model calculations</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      <span>Quantified betting edges</span>
                    </li>
                  </ul>
                </div>
              </div>
          </motion.div>

          {/* Prediction Market Outliers Card - Center */}
          <motion.div
            initial={{ opacity: 0, rotate: 0, y: 50, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, rotate: 0, y: 0, scale: 1, x: '-50%' }}
            transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
            whileHover={{ rotate: 0, scale: 1.05, z: 50, y: -10 }}
            className="absolute z-30 w-[380px] max-w-[calc(100vw-2rem)] sm:w-[380px] bottom-0"
            style={{ 
              transformStyle: 'preserve-3d',
              transformOrigin: 'bottom center',
              left: '50%',
            }}
          >
              {/* Mini Prediction Market Outliers Demo */}
              <div className="bg-white dark:bg-gray-800 border border-orange-500/20 rounded-xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="h-6 w-6 text-orange-500" />
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Prediction Market Outliers</h3>
                </div>

                {/* Mini Game Header */}
                <div className="flex justify-between items-center mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="text-center">
                    <div className="h-10 w-10 mx-auto mb-2 bg-orange-500/20 rounded-full flex items-center justify-center border border-orange-500/30">
                      <span className="text-sm font-bold text-orange-600 dark:text-orange-400">CIN</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cincinnati</p>
                  </div>
                  <span className="text-xl font-bold text-gray-400">@</span>
                  <div className="text-center">
                    <div className="h-10 w-10 mx-auto mb-2 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">NE</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">New England</p>
                  </div>
                </div>

                {/* Outliers List */}
                <div className="space-y-3 mb-6">
                  {outliersData.outliers.map((outlier, index) => (
                    <div key={index} className={`p-4 rounded-lg border ${
                      outlier.recommendation === 'Value Play' 
                        ? 'bg-green-500/10 border-green-500/20' 
                        : 'bg-red-500/10 border-red-500/20'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${
                            outlier.recommendation === 'Value Play' 
                              ? 'text-green-500' 
                              : 'text-red-500'
                          }`} />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {outlier.type} Outlier
                          </span>
                        </div>
                        <Badge className={`text-xs ${
                          outlier.recommendation === 'Value Play' 
                            ? 'bg-green-500 text-white' 
                            : 'bg-red-500 text-white'
                        }`}>
                          {outlier.recommendation}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Public Betting</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{outlier.public_percentage}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Model Confidence</p>
                          <p className={`text-sm font-bold ${
                            outlier.recommendation === 'Value Play' 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {outlier.model_confidence}%
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-semibold">{outlier.discrepancy}%</span> discrepancy - {outlier.team} {outlier.type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Compact Benefits */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Why It's Superior</span>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      <span>Real-time public betting data</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      <span>Contrarian opportunity alerts</span>
                    </li>
                  </ul>
                </div>
              </div>
          </motion.div>

          {/* AI Simulator Card - Right Side */}
          <motion.div
            initial={{ opacity: 0, rotate: 12, y: 50, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, rotate: 8, y: 50, scale: 1, x: 'calc(-50% + 200px)' }}
            transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
            whileHover={{ rotate: 5, scale: 1.05, z: 50, y: 40 }}
            className="absolute z-20 w-[380px] max-w-[calc(100vw-2rem)] sm:w-[380px] bottom-0"
            style={{ 
              transformStyle: 'preserve-3d',
              transformOrigin: 'bottom center',
              left: '50%',
            }}
          >
              {/* Mini AI Game Simulator Demo */}
              <div className="bg-white dark:bg-gray-800 border border-purple-500/20 rounded-xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-6">
                  <Brain className="h-6 w-6 text-purple-500" />
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">AI Game Simulator</h3>
                </div>

                {/* Mini Consensus Prediction */}
                <div className="text-center p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-6 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="h-12 w-12 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                      <span className="text-sm font-bold text-red-600 dark:text-red-400">KC</span>
                    </div>
                    <Trophy className="h-6 w-6 text-yellow-500" />
                    <div className="h-12 w-12 bg-blue-500/20 rounded-full flex items-center justify-center opacity-50 border border-blue-500/30">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">BUF</span>
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-purple-600 dark:text-purple-400 mb-3">Kansas City Wins</h4>
                  <div className="flex items-center justify-center gap-3">
                    <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-400 text-sm border border-purple-500/30">67% Confidence</Badge>
                    <Badge className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm border border-gray-300 dark:border-gray-500">3 Models</Badge>
                  </div>
                </div>

                {/* Compact Models */}
                <div className="space-y-3 mb-6">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                    <Users className="h-4 w-4 text-blue-500" />
                    Contributing Models
                  </h4>
                  {aiSimulatorData.models.slice(0, 2).map((model, index) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 dark:text-white">{model.name}</h5>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {model.features.length} features • {model.games} games
                          </p>
                        </div>
                        <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs border border-blue-500/30">
                          {model.confidence}%
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center">
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">
                            {Math.round(model.win_pct * 100)}%
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">KC</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-red-600 dark:text-red-400">
                            {Math.round(model.opponent_win_pct * 100)}%
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">BUF</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="text-center">
                    <Badge className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs border border-gray-300 dark:border-gray-500">+ 1 more model</Badge>
                  </div>
                </div>

                {/* Compact Benefits */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Why It's Superior</span>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      <span>Live game data integration</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      <span>Multiple specialized models</span>
                    </li>
                  </ul>
                </div>
              </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
