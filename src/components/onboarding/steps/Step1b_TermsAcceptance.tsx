import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function TermsAcceptance() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Consider "bottom" if within 50px of the actual bottom
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
    
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      // Check initial state in case content is short enough to not need scrolling
      handleScroll();
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const handleNext = () => {
    if (isChecked && hasScrolledToBottom) {
      // Store the timestamp of terms acceptance
      updateOnboardingData({ 
        termsAcceptedAt: new Date().toISOString() 
      });
      nextStep();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center w-full max-w-4xl mx-auto h-full">
      <motion.h1
        className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-2 sm:mb-3 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Terms and Conditions
      </motion.h1>
      
      <motion.p
        className="text-xs sm:text-sm text-white/80 mb-2 px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        Please read through our terms and conditions before continuing
      </motion.p>

      {/* Scroll indicator */}
      {!hasScrolledToBottom && (
        <motion.div
          className="flex items-center gap-2 text-green-400 text-xs mb-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <ChevronDown className="h-3 w-3 animate-bounce" />
          <span>Scroll down to continue</span>
          <ChevronDown className="h-3 w-3 animate-bounce" />
        </motion.div>
      )}

      {/* Terms content scrollable container */}
      <motion.div
        ref={scrollContainerRef}
        className="w-full max-h-[280px] sm:max-h-[320px] overflow-y-auto bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-3 sm:p-5 mb-3 text-left"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(34, 197, 94, 0.5) rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="space-y-3 text-white/90 pb-40 sm:pb-44">
          <p className="text-xs sm:text-sm text-white/70">**Last Updated: October 15, 2025**</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">1. Nature of Our Service & Disclaimers</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Sports Betting Advice & Analytics Only</strong>: WagerProof provides data-driven sports betting insights, analysis, and educational tools. Our Service offers statistical models, trend analysis, and predictions to assist users in making informed decisions.</li>
            <li><strong>NOT Financial or Betting Advice</strong>: <strong>WagerProof DOES NOT provide financial advice, investment advice, or direct betting recommendations.</strong> The information and tools provided are for informational and entertainment purposes only. You should not consider any content on the Service as a solicitation, recommendation, or endorsement to place any wagers or engage in any gambling activity.</li>
            <li><strong>No Guarantees of Winnings</strong>: <strong>We do not guarantee any profits, winnings, or positive outcomes from using our Service.</strong> Sports betting inherently involves risk, and past performance is not indicative of future results.</li>
            <li><strong>User Responsibility</strong>: <strong>You are solely responsible for your own betting decisions, actions, and any financial gains or losses incurred.</strong> You acknowledge and agree that you use the Service at your own risk.</li>
            <li><strong>Not a Gambling Operator</strong>: WagerProof is not a bookmaker, gambling operator, or a platform for placing bets. We do not accept or process wagers.</li>
            <li><strong>Legal Compliance</strong>: You are responsible for ensuring that your use of the Service complies with all applicable laws and regulations in your jurisdiction regarding sports betting and online services. We do not condone illegal gambling.</li>
          </ul>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">2. User Accounts</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Eligibility</strong>: You must be at least 18 years old to create an account and use our Service. By creating an account, you represent and warrant that you are at least 18 years old.</li>
            <li><strong>Account Information</strong>: When you create an account, you agree to provide accurate, current, and complete information. You are responsible for maintaining the confidentiality of your account password and for all activities that occur under your account.</li>
            <li><strong>Account Termination</strong>: We reserve the right to suspend or terminate your account at our sole discretion, without notice or liability, for any reason, including if you violate these Terms.</li>
          </ul>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">3. Subscriptions and Payments</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Subscription Plans</strong>: We offer various subscription plans (e.g., Basic, Pro, Enterprise) with different features and pricing. Details of these plans are available on our website.</li>
            <li><strong>Billing</strong>: Subscriptions are billed on a recurring basis (e.g., monthly or annually) through our third-party payment processor, Stripe. By subscribing, you authorize Stripe to charge your designated payment method at the beginning of each billing cycle.</li>
            <li><strong>Price Changes</strong>: We reserve the right to change our subscription fees at any time. Any price changes will be communicated to you in advance, and you will have the option to cancel your subscription before the new prices take effect.</li>
            <li><strong>Cancellations and Refunds</strong>: You may cancel your subscription at any time. Cancellations will take effect at the end of your current billing period. We generally do not offer refunds for partial subscription periods, except as required by law.</li>
            <li><strong>Promotions and Trials</strong>: We may offer promotional pricing or free trial periods. These are subject to specific terms and conditions and may be terminated or modified at our discretion.</li>
          </ul>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">4. Acceptable Use Policy</h2>
          <p className="text-sm">You agree not to use the Service to:</p>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li>Violate any local, state, national, or international law or regulation.</li>
            <li>Engage in any activity that is fraudulent, misleading, or deceptive.</li>
            <li>Transmit any harmful, threatening, defamatory, obscene, or otherwise objectionable content.</li>
            <li>Interfere with or disrupt the integrity or performance of the Service.</li>
            <li>Attempt to gain unauthorized access to any part of the Service, other users' accounts, or our systems.</li>
            <li>Use any automated system, including "bots," "spiders," or "offline readers," to access the Service in a manner that sends more request messages to our servers than a human can reasonably produce in the same period by using a conventional web browser.</li>
            <li>Reproduce, duplicate, copy, sell, resell, or exploit any portion of the Service without our express written permission.</li>
          </ul>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">5. Intellectual Property</h2>
          <p className="text-sm">All content on the Service, including text, graphics, logos, images, software, models, data, and the compilation thereof, is the property of WagerProof or its suppliers and protected by copyright and other intellectual property laws. You may not use any content from the Service for commercial purposes without our express written permission.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">6. WagerBot and AI Usage</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Informational Tool</strong>: The WagerBot is an AI-powered analytical tool designed to provide insights based on available data.</li>
            <li><strong>AI Limitations</strong>: <strong>The responses and analyses provided by WagerBot are machine-generated and should not be taken as definitive or infallible advice.</strong> WagerBot may generate incomplete, inaccurate, or biased information.</li>
            <li><strong>No Guarantees from AI</strong>: We do not guarantee the accuracy, completeness, or usefulness of any information provided by WagerBot. Always exercise your own judgment and verify information independently.</li>
          </ul>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">7. Limitation of Liability</h2>
          <p className="text-sm"><strong>TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WAGERPROOF, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (I) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE; (II) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE; (III) ANY CONTENT OBTAINED FROM THE SERVICE; AND (IV) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, WHETHER OR NOT WE HAVE BEEN INFORMED OF THE POSSIBILITY OF SUCH DAMAGE, AND EVEN IF A REMEDY SET FORTH HEREIN IS FOUND TO HAVE FAILED OF ITS ESSENTIAL PURPOSE.</strong></p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">8. Indemnification</h2>
          <p className="text-sm">You agree to indemnify and hold harmless WagerProof, its affiliates, and their respective officers, directors, employees, and agents from and against any and all claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees and costs, arising out of or in any way connected with your access to or use of the Service, your violation of these Terms, or your infringement of any intellectual property or other right of any person or entity.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">9. Governing Law and Jurisdiction</h2>
          <p className="text-sm">These Terms shall be governed and construed in accordance with the laws of Texas, without regard to its conflict of law provisions. You agree to submit to the exclusive jurisdiction of the courts located in Austin, Texas to resolve any legal matter arising from these Terms or the Service.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">10. Changes to These Terms</h2>
          <p className="text-sm">We reserve the right to modify or replace these Terms at any time at our sole discretion. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">11. Contact Us</h2>
          <p className="text-sm">If you have any questions about these Terms, please contact us at: admin@wagerproof.bet</p>
        </div>
      </motion.div>

      {/* Checkbox and Continue Button */}
      <motion.div
        className="flex flex-col items-center gap-4 w-full pb-16 sm:pb-24"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <motion.div
          className="flex items-center gap-3 rounded-md p-1"
          style={{
            borderRadius: '8px',
          }}
          animate={hasScrolledToBottom ? { 
            boxShadow: [
              "0 0 0 0 rgba(34, 197, 94, 0.5)",
              "0 0 0 10px rgba(34, 197, 94, 0)",
            ]
          } : {}}
          transition={hasScrolledToBottom ? { 
            duration: 2, 
            repeat: Infinity 
          } : {}}
        >
          <motion.div
            animate={isChecked && hasScrolledToBottom ? {
              scale: [1, 1.15, 1]
            } : {}}
            transition={isChecked && hasScrolledToBottom ? {
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            } : {}}
          >
            <Checkbox
              id="terms-checkbox"
              checked={isChecked}
              onCheckedChange={(checked) => setIsChecked(checked as boolean)}
              disabled={!hasScrolledToBottom}
              className={cn(
                "border-white/40 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 transition-all",
                isChecked && hasScrolledToBottom && "shadow-lg shadow-green-500/75",
                !hasScrolledToBottom && "opacity-50 cursor-not-allowed"
              )}
            />
          </motion.div>
          <label
            htmlFor="terms-checkbox"
            className={cn(
              "text-xs sm:text-sm text-white cursor-pointer select-none",
              !hasScrolledToBottom && "opacity-50 cursor-not-allowed"
            )}
          >
            I have read and agree to the Terms and Conditions
          </label>
        </motion.div>

        <Button
          onClick={handleNext}
          size="lg"
          disabled={!isChecked || !hasScrolledToBottom}
          className={cn(
            "px-8 border-0 text-white transition-all duration-300",
            isChecked && hasScrolledToBottom 
              ? "bg-green-500 hover:bg-green-600" 
              : "bg-gray-500 text-gray-300 cursor-not-allowed"
          )}
        >
          Continue
        </Button>
      </motion.div>
    </div>
  );
}

