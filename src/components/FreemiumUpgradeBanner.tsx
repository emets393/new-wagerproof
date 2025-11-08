import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FreemiumUpgradeBannerProps {
  totalGames: number;
  visibleGames: number;
}

export function FreemiumUpgradeBanner({ totalGames, visibleGames }: FreemiumUpgradeBannerProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.5 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-green-600 to-emerald-600 backdrop-blur-lg border-t border-white/20 shadow-2xl"
      style={{ boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.3)' }}
    >
      <div className="container mx-auto px-4 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          {/* Message */}
          <div className="flex items-center gap-3 text-white text-center sm:text-left">
            <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-white/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm sm:text-base font-semibold">
                You're viewing {visibleGames} of {totalGames} games
              </p>
              <p className="text-xs sm:text-sm text-white/90">
                Subscribe to unlock all predictions, advanced analytics, and more!
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <Button
            onClick={() => navigate('/access-denied')}
            size="lg"
            className="bg-white text-green-600 hover:bg-white/90 font-bold shadow-lg whitespace-nowrap flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade Now
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

