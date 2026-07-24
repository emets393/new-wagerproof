import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Dither from '@/components/Dither';
import { CustomPaywall } from '@/components/paywall/CustomPaywall';

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
        className="relative z-10 max-h-[95vh] w-full max-w-2xl overflow-hidden rounded-xl border border-white/20 bg-black/30 shadow-2xl backdrop-blur-3xl sm:mx-4 sm:rounded-3xl"
        style={{
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
        }}
      >
        {/* Header with Close Button */}
        <div className="flex items-center justify-between border-b border-white/10 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Paywall Preview (Admin Test)</h2>
          <Button onClick={handleClose} variant="ghost" size="sm" className="text-white/70 hover:text-white">
            Close
          </Button>
        </div>

        {/* Content Area */}
        <div className="onboarding-scroll relative max-h-[calc(95vh-80px)] overflow-y-auto p-4 sm:p-6">
          <CustomPaywall />
        </div>
      </motion.div>
    </div>
  );
}
