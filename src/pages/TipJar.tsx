import { useState, useEffect } from 'react';
import { Coffee, Heart, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Lottie from 'lottie-react';
import { motion } from 'framer-motion';

const TIP_AMOUNTS = [5, 10, 20, 50, 100] as const;
const STRIPE_URLS = {
  100: 'https://buy.stripe.com/9B614n4Wr2Ew6zS64d8so00',
  50: 'https://buy.stripe.com/28EcN588D7YQgas1NX8so01',
  20: 'https://buy.stripe.com/dRmeVd0Gb3IAbUcakt8so02',
  10: 'https://buy.stripe.com/14A7sL88Dfri1fydwF8so03',
  5: 'https://buy.stripe.com/4gM6oH0Gbcf67DWfEN8so04',
} as const;

export default function TipJar() {
  const [selectedAmountIndex, setSelectedAmountIndex] = useState(2); // Default to $20
  const [showThankYou, setShowThankYou] = useState(false);
  const [confettiData, setConfettiData] = useState<any>(null);
  const [pendingStripeUrl, setPendingStripeUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Load confetti animation data on mount
  useEffect(() => {
    fetch('/confetti.json')
      .then(response => response.json())
      .then(data => setConfettiData(data))
      .catch(error => console.error('Error loading confetti animation:', error));
  }, []);

  // Handle countdown when thank you dialog is shown
  useEffect(() => {
    if (showThankYou && pendingStripeUrl) {
      const stripeUrl = pendingStripeUrl; // Capture the URL
      setCountdown(3);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            // Redirect to Stripe after countdown
            setTimeout(() => {
              window.open(stripeUrl, '_blank', 'noopener,noreferrer');
              setShowThankYou(false);
              setPendingStripeUrl(null);
              setCountdown(null);
            }, 200);
            return null;
          }
          return prev - 1;
        });
      }, 1000); // Countdown every second

      return () => clearInterval(interval);
    }
  }, [showThankYou, pendingStripeUrl]);

  const handleSliderChange = (value: number[]) => {
    setSelectedAmountIndex(value[0]);
  };

  const handleTipClick = (amount: typeof TIP_AMOUNTS[number]) => {
    const url = STRIPE_URLS[amount];
    if (url && confettiData) {
      // Store the Stripe URL and show celebration first
      setPendingStripeUrl(url);
      setShowThankYou(true);
    } else if (url) {
      // If confetti hasn't loaded yet, just redirect
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCloseThankYou = () => {
    setShowThankYou(false);
    setPendingStripeUrl(null);
    setCountdown(null);
  };

  const selectedAmount = TIP_AMOUNTS[selectedAmountIndex];

  return (
    <>
      {/* Fullscreen Confetti Animation */}
      {showThankYou && confettiData && (
        <div className="fixed inset-0 z-[60] pointer-events-none">
          <Lottie
            animationData={confettiData}
            loop={false}
            autoplay={true}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}

      {/* Thank You Dialog */}
      <Dialog open={showThankYou} onOpenChange={(open) => {
        // Prevent closing during countdown
        if (!open && countdown !== null && countdown > 0) {
          return;
        }
        handleCloseThankYou();
      }}>
        <DialogContent className="max-w-md border-none bg-transparent shadow-none p-0 sm:p-6 md:p-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
            className="bg-background rounded-lg border p-4 sm:p-6 md:p-8 shadow-xl mx-0 sm:mx-4"
          >
            <DialogHeader className="text-center space-y-3 sm:space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="flex justify-center"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 flex items-center justify-center">
                  <Heart className="w-8 h-8 sm:w-10 sm:h-10 text-primary fill-primary" />
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <DialogTitle className="text-2xl sm:text-3xl font-bold">Thank You!</DialogTitle>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <DialogDescription className="text-sm sm:text-base">
                  Thank you for your support! 🎉
                </DialogDescription>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:px-2">
                  Your tip helps us continue building amazing features for the WagerProof community.
                </p>
              </motion.div>
            </DialogHeader>
            
            {/* Countdown Display */}
            {countdown !== null && (
              <motion.div
                key={countdown}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-6 sm:mt-8 flex flex-col items-center space-y-3 sm:space-y-4"
              >
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Redirecting to payment in...
                </div>
                <motion.div
                  key={countdown}
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-5xl sm:text-6xl font-bold text-primary"
                >
                  {countdown}
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto max-w-4xl px-0 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">
        <div className="flex flex-col items-center justify-center min-h-[50vh] sm:min-h-[60vh] space-y-4 sm:space-y-6 md:space-y-8">
        {/* Header Icon */}
        <div className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 mb-2">
          <Coffee className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-primary" />
        </div>

        {/* Main Card */}
        <Card className="w-full max-w-3xl">
          <CardHeader className="text-center space-y-2 sm:space-y-3 px-0 sm:px-6 pt-4 sm:pt-6">
            <div className="flex items-center justify-center gap-2">
              <CardTitle className="text-2xl sm:text-3xl md:text-4xl font-bold">Tip Jar</CardTitle>
              <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 fill-red-500" />
            </div>
            <CardDescription className="text-sm sm:text-base md:text-lg">
              Help us keep building amazing features for you!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 md:space-y-8 px-0 sm:px-6 pb-4 sm:pb-6">
            {/* Appreciative Message */}
            <div className="text-center space-y-2">
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Did we help you hit a big win? 🎉
              </p>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed sm:px-2">
                Your support means the world to us and helps us continue improving WagerProof. 
                Every tip goes directly to our development team to build more features, fix bugs, 
                and make your betting experience even better.
              </p>
              <div className="flex items-center justify-center gap-1 pt-2 flex-wrap">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                <span className="text-xs sm:text-sm font-medium text-primary">Thank you for being awesome!</span>
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
              </div>
            </div>

            {/* Slider Section */}
            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">Select Amount</span>
                  <span className="text-xl sm:text-2xl font-bold text-primary">${selectedAmount}</span>
                </div>
                <Slider
                  value={[selectedAmountIndex]}
                  onValueChange={handleSliderChange}
                  min={0}
                  max={TIP_AMOUNTS.length - 1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground px-1">
                  {TIP_AMOUNTS.map((amount) => (
                    <span key={amount}>${amount}</span>
                  ))}
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div className="space-y-2 sm:space-y-3">
                <p className="text-xs sm:text-sm font-medium text-center text-muted-foreground">
                  Or choose an amount:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
                  {TIP_AMOUNTS.map((amount) => (
                    <Button
                      key={amount}
                      variant={selectedAmount === amount ? 'default' : 'outline'}
                      size="lg"
                      onClick={() => {
                        const index = TIP_AMOUNTS.indexOf(amount);
                        setSelectedAmountIndex(index);
                        handleTipClick(amount);
                      }}
                      className="text-sm sm:text-base font-semibold h-10 sm:h-11"
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Selected Amount CTA */}
              <div className="pt-2 sm:pt-4">
                <Button
                  size="lg"
                  className="w-full text-base sm:text-lg font-semibold h-11 sm:h-12"
                  onClick={() => handleTipClick(selectedAmount)}
                >
                  <Heart className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Send ${selectedAmount} Tip
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <p className="text-[10px] sm:text-xs text-muted-foreground text-center max-w-md px-0 sm:px-4">
          Tips are processed securely through Stripe. All tips go directly to supporting WagerProof development.
        </p>
      </div>
    </div>
    </>
  );
}

