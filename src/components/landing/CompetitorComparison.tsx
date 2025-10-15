import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GradientText } from "@/components/ui/gradient-text";
import { 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight,
  Target,
  Brain,
  Zap
} from "lucide-react";
import { Link } from "react-router-dom";

export function CompetitorComparison() {
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
            Why Choose WagerProof?
          </motion.h2>
          <motion.p
            className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto"
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
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 shadow-xl">
         
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* WagerProof */}
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="h-20 w-20 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/30">
                      <CheckCircle className="h-10 w-10 text-green-400" />
                    </div>
                    <h3 className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">WagerProof</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Professional betting platform</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="h-4 w-4 text-green-400" />
                        <span className="font-semibold text-green-600 dark:text-green-300">Edge Finder</span>
                      </div>
                      <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
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

                    <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Brain className="h-4 w-4 text-purple-400" />
                        <span className="font-semibold text-purple-600 dark:text-purple-300">AI Game Simulator</span>
                      </div>
                      <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
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

                    <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="h-4 w-4 text-blue-400" />
                        <span className="font-semibold text-blue-600 dark:text-blue-300">Additional Features</span>
                      </div>
                      <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
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
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="h-20 w-20 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                      <AlertTriangle className="h-10 w-10 text-red-400" />
                    </div>
                    <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Generic AI Chatbots</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">ChatGPT, Claude, etc.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                      <h4 className="font-semibold text-red-600 dark:text-red-300 mb-3">Limitations</h4>
                      <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
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
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="h-20 w-20 mx-auto mb-4 bg-yellow-500/20 rounded-full flex items-center justify-center border border-yellow-500/30">
                      <AlertTriangle className="h-10 w-10 text-yellow-400" />
                    </div>
                    <h3 className="text-xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">Traditional Sportsbooks</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">DraftKings, FanDuel, etc.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <h4 className="font-semibold text-yellow-600 dark:text-yellow-300 mb-3">What They Offer</h4>
                      <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
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
              <div className="mt-12 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <h4 className="text-2xl font-bold text-center mb-6">
                  <GradientText text="The WagerProof Advantage" />
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-3">
                    <h5 className="font-semibold text-green-600 dark:text-green-300 text-base">What makes us different:</h5>
                    <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                        <span>Built specifically for serious bettors</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                        <span>Real-time data and live model calculations</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                        <span>Transparent, explainable AI predictions</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h5 className="font-semibold text-blue-600 dark:text-blue-300 text-base">Your competitive edge:</h5>
                    <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-400 flex-shrink-0" />
                        <span>Quantified betting advantages</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-400 flex-shrink-0" />
                        <span>Professional-grade analytics</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-400 flex-shrink-0" />
                        <span>Tools used by sharp bettors</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
        </motion.div>

        {/* CTA Button */}
        <motion.div 
          className="text-center pt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Link to="/account">
            <Button 
              size="lg" 
              className="bg-green-500 hover:bg-green-600 text-white border-0 px-8 py-4 text-lg"
            >
              Start Winning Today
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
