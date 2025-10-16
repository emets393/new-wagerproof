import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Badge } from "@/components/ui/badge";
import { 
  Bot, 
  Brain, 
  MessageCircle, 
  CheckCircle,
  BarChart3
} from "lucide-react";

export function MethodologyClaim2() {
  const { nextStep } = useOnboarding();

  return (
    <div className="flex flex-col items-start text-center p-4 sm:p-6 md:p-8 pt-32 sm:pt-60 md:pt-24 pb-8 sm:pb-16 max-w-2xl mx-auto w-full">
      <motion.h1
        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 text-white w-full"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        AI, enhanced with statistics
      </motion.h1>
      <motion.p
        className="text-sm sm:text-base md:text-lg text-white/80 mb-6 sm:mb-8 px-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Our WagerBot has direct access to our scientific modeling and years of sports data that other AI chats dont. It doesnt hallucinate answers, it makes complex statistics accessible. 
      </motion.p>

      {/* AI Chat & Game Card Demo */}
      <motion.div
        className="grid grid-cols-1 gap-3 sm:gap-4 mb-6 sm:mb-8 max-w-4xl mx-auto w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        {/* AI Chat Window Widget */}
        <div className="bg-white/5 backdrop-blur-sm border border-purple-500/20 rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-purple-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">AI Assistant</h3>
            <Badge className="bg-purple-500/20 text-purple-300 text-xs border border-purple-500/30">
              Live
            </Badge>
          </div>

          {/* Chat Messages */}
          <div className="space-y-2 sm:space-y-3 mb-2 sm:mb-3 max-h-48 overflow-y-auto">
            {/* User Message */}
            <div className="flex justify-end">
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-2 max-w-[80%]">
                <p className="text-xs text-white">Why does the model favor Buffalo +3.5?</p>
              </div>
            </div>

            {/* AI Response */}
            <div className="flex justify-start">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 max-w-[85%]">
                <div className="flex items-center gap-1 mb-1">
                  <Brain className="h-3 w-3 text-purple-400" />
                  <span className="text-xs font-medium text-purple-300">WagerBot</span>
                </div>
                <p className="text-xs text-white/90 mb-2">Based on statistical analysis:</p>
                <ul className="space-y-1 text-xs text-white/80">
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-2 w-2 text-green-400 flex-shrink-0" />
                    <span>Buffalo covers 68% at home vs top teams</span>
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-2 w-2 text-green-400 flex-shrink-0" />
                    <span>KC struggles in cold weather (4-7 ATS)</span>
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-2 w-2 text-green-400 flex-shrink-0" />
                    <span>Sharp money moved line from +2.5 to +3.5</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Follow-up User Message */}
            <div className="flex justify-end">
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-2 max-w-[80%]">
                <p className="text-xs text-white">What's the confidence level?</p>
              </div>
            </div>

            {/* AI Confidence Response */}
            <div className="flex justify-start">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 max-w-[85%]">
                <div className="flex items-center gap-1 mb-1">
                  <BarChart3 className="h-3 w-3 text-purple-400" />
                  <span className="text-xs font-medium text-purple-300">Statistical Model</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/90">Confidence:</span>
                  <Badge className="bg-green-500/20 text-green-300 text-xs border border-green-500/30">
                    74%
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Input (Disabled) */}
          <div className="flex items-center gap-2 p-2 bg-white/5 rounded border border-white/10">
            <MessageCircle className="h-3 w-3 text-white/40" />
            <span className="text-xs text-white/40 flex-1">Ask about any game or stat...</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="w-full flex justify-center"
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
