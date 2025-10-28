import Paywall from '@/components/Paywall';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Dither from '@/components/Dither';

export default function PaywallTest() {
  const handleClose = () => {
    window.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      {/* Dither Background Effect */}
      <div className="absolute inset-0 overflow-hidden">
        <Dither
          waveSpeed={0.05}
          waveFrequency={3}
          waveAmplitude={0.3}
          waveColor={[0.13, 0.77, 0.37]}
          colorNum={4}
          pixelSize={2}
          disableAnimation={false}
          enableMouseInteraction={false}
          mouseRadius={0}
        />
      </div>

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-4xl mx-2 sm:mx-4 bg-black/30 backdrop-blur-3xl border border-white/20 rounded-xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[95vh]"
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
        }}
      >
        {/* Header with Close Button */}
        <div className="p-4 sm:p-6 flex items-center justify-between border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Paywall Preview (Admin Test)</h2>
          <Button
            onClick={handleClose}
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white"
          >
            Close
          </Button>
        </div>

        {/* Content Area */}
        <div className="relative max-h-[calc(95vh-80px)] overflow-y-auto onboarding-scroll p-4 sm:p-6">
          <Paywall />
        </div>
      </motion.div>
    </div>
  );
}
