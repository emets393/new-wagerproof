import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight,
  Target,
  Brain,
  Zap,
  Users,
  Lightbulb
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
                    <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="h-4 w-4 text-purple-400" />
                        <span className="font-semibold text-purple-600 dark:text-purple-300">Easy to Use</span>
                      </div>
                      <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-purple-400" />
                          <span>Data made transparent and simple</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-purple-400" />
                          <span>Only highest value picks shown</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-purple-400" />
                          <span>Rationale from real data analysts</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-purple-400" />
                          <span>Teaches you to make smarter decisions</span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-indigo-400" />
                        <span className="font-semibold text-indigo-600 dark:text-indigo-300">Access to Real Community</span>
                      </div>
                      <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-indigo-400" />
                          <span>Curated picks from experts</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-indigo-400" />
                          <span>Private Discord with committed bettors</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-indigo-400" />
                          <span>Dedicated support from developers</span>
                        </li>
                      </ul>
                    </div>

                    <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="h-4 w-4 text-green-400" />
                        <span className="font-semibold text-green-600 dark:text-green-300">Transparent Tools</span>
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
                          <span>Multi-model consensus</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-green-400" />
                          <span>Transparent methodology</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-green-400" />
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

                {/* Sportsbooks and Arbitrage Apps */}
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="h-20 w-20 mx-auto mb-4 bg-yellow-500/20 rounded-full flex items-center justify-center border border-yellow-500/30">
                      <AlertTriangle className="h-10 w-10 text-yellow-400" />
                    </div>
                    <h3 className="text-xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">Sportsbooks and Arbitrage Apps</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">DraftKings, FanDuel, PrizePicks, etc.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <h4 className="font-semibold text-yellow-600 dark:text-yellow-300 mb-3">The Problems</h4>
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
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-400" />
                          <span>Firehose of confusing data</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-400" />
                          <span>Only focused on highest payouts, not probabilities</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-400" />
                          <span>Low-probability parlays promoted heavily</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-400" />
                          <span>Overwhelming options without clear direction</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-400" />
                          <span>Designed for max engagement, not user profit</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message from Developers */}
              <div className="mt-12 p-0 md:p-8 md:bg-gradient-to-br md:from-gray-50 md:to-gray-100 md:dark:from-gray-700/50 md:dark:to-gray-800/50 md:rounded-lg md:border-2 md:border-gray-300 md:dark:border-gray-600">
                <h4 className="text-2xl font-bold text-center mb-4 text-gray-900 dark:text-gray-100">
                  A Message from the Developers
                </h4>
                <div className="max-w-4xl mx-auto space-y-4 text-gray-700 dark:text-gray-300">
                  <p className="text-base leading-relaxed">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Let's be honest:</span> If anyone tries to sell you guarantees in sports betting, they're just trying to take your money. We're data analysts and developers, not fortune tellers.
                  </p>
                  <p className="text-base leading-relaxed">
                    At the end of the day, <span className="font-semibold text-gray-900 dark:text-gray-100">sports betting is always uncertain</span>—there's risk in every pick. But with smart decisions, transparent data, and disciplined value spotting, you can give yourself a real advantage over time.
                  </p>
                  <p className="text-base leading-relaxed">
                    Sometimes <span className="font-semibold text-gray-900 dark:text-gray-100">avoiding a bad pick is more valuable</span> than chasing an influencer's "Latest Lock of the Week." We'll be the first to tell you that. Our goal isn't to hype you up—it's to give you the tools and insights to make smarter, more informed decisions on your own terms.
                  </p>
                  <p className="text-base leading-relaxed text-center mt-6 pt-4 border-t border-gray-300 dark:border-gray-600">
                    <span className="italic text-gray-600 dark:text-gray-400">Build your edge with data, not empty promises.</span>
                  </p>
                  <p className="text-base leading-relaxed mt-6">
                    We built this tool so we could have a little more fun watching games, and because we genuinely love data and sports. Inside, you'll find a <span className="font-semibold text-gray-900 dark:text-gray-100">community features voting section</span>—we'd love to hear what you want to see!
                  </p>
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
