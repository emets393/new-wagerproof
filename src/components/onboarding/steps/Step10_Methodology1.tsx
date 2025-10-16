import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingUp, 
  CheckCircle, 
  Calendar,
  Activity
} from "lucide-react";

export function MethodologyClaim1() {
  const { nextStep } = useOnboarding();

  return (
    <div className="flex flex-col items-center text-center p-4 sm:p-6 md:p-8 pt-24 sm:pt-28 md:pt-20 max-w-2xl mx-auto">
      <motion.h1
        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        We use statistical modeling, not vibes
      </motion.h1>
      <motion.p
        className="text-sm sm:text-base md:text-lg text-white/80 mb-6 sm:mb-8 px-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Our models incorporate historical performance, market movement, and matchup factors—logged and auditable.
      </motion.p>

      {/* Micro Widgets Demo */}
      <motion.div
        className="grid grid-cols-1 gap-3 sm:gap-4 mb-6 sm:mb-8 max-w-3xl mx-auto w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        {/* Historical Game Data Widget */}
        <div className="bg-white/5 backdrop-blur-sm border border-blue-500/20 rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">Historical Data</h3>
            <Badge className="bg-blue-500/20 text-blue-300 text-xs border border-blue-500/30">
              5 Years
            </Badge>
          </div>

          {/* Sample Historical Data */}
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex justify-between items-center p-1.5 sm:p-2 bg-white/5 rounded border border-white/10">
              <span className="text-xs text-white/70">Chiefs vs Bills </span>
              <span className="text-xs font-medium text-white">7-3 (Last 10)</span>
            </div>
            <div className="flex justify-between items-center p-1.5 sm:p-2 bg-white/5 rounded border border-white/10">
              <span className="text-xs text-white/70">Home Field Advantage</span>
              <span className="text-xs font-medium text-green-400">+3.2 pts</span>
            </div>
            <div className="flex justify-between items-center p-1.5 sm:p-2 bg-white/5 rounded border border-white/10">
              <span className="text-xs text-white/70">Weather Impact</span>
              <span className="text-xs font-medium text-blue-400">-1.8 pts</span>
            </div>
          </div>

          <div className="mt-2 sm:mt-3 p-2 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-3 w-3 text-blue-400" />
              <span className="text-xs font-semibold text-white">Data Sources</span>
            </div>
            <ul className="space-y-1 text-xs text-white/70">
              <li className="flex items-center gap-1">
                <CheckCircle className="h-2 w-2 text-green-400 flex-shrink-0" />
                <span>5+ seasons of game logs</span>
              </li>
              <li className="flex items-center gap-1">
                <CheckCircle className="h-2 w-2 text-green-400 flex-shrink-0" />
                <span>Weather & injury reports</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Line Movement Widget */}
        <div className="bg-white/5 backdrop-blur-sm border border-orange-500/20 rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-orange-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">Line Movement</h3>
            <Badge className="bg-orange-500/20 text-orange-300 text-xs border border-orange-500/30">
              Live
            </Badge>
          </div>

          {/* Sample Line Movement Data */}
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex justify-between items-center p-1.5 sm:p-2 bg-white/5 rounded border border-white/10">
              <span className="text-xs text-white/70">Opening Line</span>
              <span className="text-xs font-medium text-white">KC -2.5</span>
            </div>
            <div className="flex justify-between items-center p-1.5 sm:p-2 bg-orange-500/10 rounded border border-orange-500/20">
              <span className="text-xs text-white/70">Current Line</span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-white">KC -3.5</span>
                <TrendingUp className="h-3 w-3 text-orange-400" />
              </div>
            </div>
            <div className="flex justify-between items-center p-1.5 sm:p-2 bg-white/5 rounded border border-white/10">
              <span className="text-xs text-white/70">Sharp Money</span>
              <span className="text-xs font-medium text-green-400">Buffalo +3.5</span>
            </div>
          </div>

          <div className="mt-2 sm:mt-3 p-2 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-3 w-3 text-orange-400" />
              <span className="text-xs font-semibold text-white">Market Signals</span>
            </div>
            <ul className="space-y-1 text-xs text-white/70">
              <li className="flex items-center gap-1">
                <CheckCircle className="h-2 w-2 text-green-400 flex-shrink-0" />
                <span>Real-time odds tracking</span>
              </li>
              <li className="flex items-center gap-1">
                <CheckCircle className="h-2 w-2 text-green-400 flex-shrink-0" />
                <span>Sharp vs public money flow</span>
              </li>
            </ul>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        <Button onClick={nextStep} size="lg" className="bg-green-500 hover:bg-green-600 text-white border-0">
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
