import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { GradientText } from "@/components/ui/gradient-text";
import { 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight,
  Target,
  Brain,
  Zap
} from "lucide-react";

export function CompetitorComparison() {
  const { nextStep } = useOnboarding();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full space-y-6 max-w-5xl mx-auto"
    >
        {/* Header */}
        <div className="text-center space-y-3 sm:space-y-4 px-2">
          <motion.h2
            className="text-2xl sm:text-3xl md:text-4xl font-bold text-white"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Why Choose WagerProof?
          </motion.h2>
          <motion.p
            className="text-sm sm:text-base md:text-lg text-white/80 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            See how our professional-grade tools stack up against the competition
          </motion.p>
        </div>

        {/* Comparison Grid */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-3 sm:p-4 md:p-6">
         
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                {/* WagerProof */}
                <div className="space-y-4 sm:space-y-6">
                  <div className="text-center">
                    <div className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-3 sm:mb-4 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/30">
                      <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 text-green-400" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-green-400 mb-2">WagerProof</h3>
                    <p className="text-xs sm:text-sm text-white/60">Professional betting platform</p>
                  </div>
                  
                  <div className="space-y-3 sm:space-y-4">
                    <div className="p-2 sm:p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" />
                        <span className="text-sm sm:text-base font-semibold text-green-300">Edge Finder</span>
                      </div>
                      <ul className="space-y-1 text-xs sm:text-sm text-white/70">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-green-400" />
                          <span>Real-time model calculations</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-green-400" />
                          <span>Quantified betting edges</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-green-400" />
                          <span>Professional-grade accuracy</span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-2 sm:p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-3 w-3 sm:h-4 sm:w-4 text-purple-400" />
                        <span className="text-sm sm:text-base font-semibold text-purple-300">AI Game Simulator</span>
                      </div>
                      <ul className="space-y-1 text-xs sm:text-sm text-white/70">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-purple-400" />
                          <span>Multi-model consensus</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-purple-400" />
                          <span>Transparent methodology</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-purple-400" />
                          <span>Live data integration</span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-2 sm:p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400" />
                        <span className="text-sm sm:text-base font-semibold text-blue-300">Additional Features</span>
                      </div>
                      <ul className="space-y-1 text-xs sm:text-sm text-white/70">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-blue-400" />
                          <span>Historical analytics</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-blue-400" />
                          <span>Teaser optimization</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-blue-400" />
                          <span>WagerBot AI assistant</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Generic AI Chatbots */}
                <div className="space-y-4 sm:space-y-6">
                  <div className="text-center">
                    <div className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-3 sm:mb-4 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                      <AlertTriangle className="h-8 w-8 sm:h-10 sm:w-10 text-red-400" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-red-400 mb-2">Generic AI Chatbots</h3>
                    <p className="text-xs sm:text-sm text-white/60">ChatGPT, Claude, etc.</p>
                  </div>
                  
                  <div className="space-y-3 sm:space-y-4">
                    <div className="p-2 sm:p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                      <h4 className="text-sm sm:text-base font-semibold text-red-300 mb-2">Limitations</h4>
                      <ul className="space-y-1 text-xs sm:text-sm text-white/70">
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-400" />
                          <span>Outdated training data (months/years old)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-400" />
                          <span>No live game integration</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-400" />
                          <span>Generic, one-size-fits-all predictions</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-400" />
                          <span>No confidence scoring or edge analysis</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-400" />
                          <span>Unreliable for serious betting</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-400" />
                          <span>Can't access current odds or lines</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Traditional Sportsbooks */}
                <div className="space-y-4 sm:space-y-6">
                  <div className="text-center">
                    <div className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-3 sm:mb-4 bg-yellow-500/20 rounded-full flex items-center justify-center border border-yellow-500/30">
                      <AlertTriangle className="h-8 w-8 sm:h-10 sm:w-10 text-yellow-400" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-yellow-400 mb-2">Traditional Sportsbooks</h3>
                    <p className="text-xs sm:text-sm text-white/60">DraftKings, FanDuel, etc.</p>
                  </div>
                  
                  <div className="space-y-3 sm:space-y-4">
                    <div className="p-2 sm:p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <h4 className="text-sm sm:text-base font-semibold text-yellow-300 mb-2">What They Offer</h4>
                      <ul className="space-y-1 text-xs sm:text-sm text-white/70">
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-400" />
                          <span>Basic odds and lines only</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-400" />
                          <span>No edge analysis or value identification</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-400" />
                          <span>Limited insights or predictions</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-400" />
                          <span>Designed to favor the house</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-400" />
                          <span>No predictive modeling</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-400" />
                          <span>Focus on entertainment, not profit</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Summary */}
              <div className="mt-6 sm:mt-8 p-3 sm:p-4 md:p-6 bg-white/5 rounded-lg border border-white/10">
                <h4 className="text-lg sm:text-xl font-bold text-center mb-3 sm:mb-4">
                  <GradientText text="The WagerProof Advantage" />
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div className="space-y-2">
                    <h5 className="text-sm sm:text-base font-semibold text-green-300">What makes us different:</h5>
                    <ul className="space-y-1 text-white/70">
                      <li>• Built specifically for serious bettors</li>
                      <li>• Real-time data and live model calculations</li>
                      <li>• Transparent, explainable AI predictions</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h5 className="text-sm sm:text-base font-semibold text-blue-300">Your competitive edge:</h5>
                    <ul className="space-y-1 text-white/70">
                      <li>• Quantified betting advantages</li>
                      <li>• Professional-grade analytics</li>
                      <li>• Tools used by sharp bettors</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
        </motion.div>

        {/* Continue Button */}
        <motion.div 
          className="text-center pt-4 sm:pt-6 pb-4 sm:pb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Button 
            onClick={nextStep}
            size="lg" 
            className="bg-green-500 hover:bg-green-600 text-white border-0 px-6 sm:px-8 py-3"
          >
            I'm Ready to Win
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </motion.div>
    </motion.div>
  );
}
