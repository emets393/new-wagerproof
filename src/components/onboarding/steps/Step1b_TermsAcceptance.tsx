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

          <h2 className="text-lg sm:text-xl font-bold text-green-400">1. Acceptance of the Terms of Service</h2>
          <p className="text-sm">These terms and conditions of service are entered into by and between you and WagerProof LLC, a Texas limited liability company ("WagerProof," "Company," "we," or "us"). The following terms and conditions of service, together with any documents they expressly incorporate by reference (collectively, "Terms of Service"), govern your access to and use of https://wagerproof.bet (the "Website"), including any content, functionality, and services offered on or through the Website, whether as a guest or a registered user, (collectively, the "Services").</p>
          <p className="text-sm">Please read the Terms of Service carefully before you start to use the Services. By clicking "I Accept," creating an account, accessing, or using the Services in any manner, you acknowledge that you have read, understood, and agree to be bound and abide by these Terms of Service, including our Privacy Policy, found at https://wagerproof.bet/privacy-policy, which is hereby incorporated herein by reference. If you do not agree to these Terms of Service, you are not authorized to access or use the Services and must immediately cease all use of the Services.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">2. Nature of Service & Disclaimers</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Sports Data Analytics Only</strong>: WagerProof provides data-driven sports insights, statistical analysis, and educational tools through proprietary machine learning models and algorithms. The Services offer statistical models, trend analysis, predictive analytics, and data visualizations to assist users in making informed decisions. All content is for informational and educational purposes only.</li>
            <li><strong>NOT Financial or Betting Advice</strong>: <strong>WagerProof DOES NOT provide financial advice, investment advice, or direct betting recommendations, whether through the Services or otherwise.</strong> The information, data, analytics, and tools provided through the Services are for informational, educational, and entertainment purposes only. You should not consider any materials provided on or through the Services as a solicitation, recommendation, offer, or endorsement to place any wagers or engage in any gambling activity. You should consult with qualified professionals regarding your specific circumstances before making any betting or financial decisions.</li>
            <li><strong>NO GUARANTEES OF ACCURACY OR OUTCOMES</strong>: <strong>WE MAKE NO GUARANTEES, REPRESENTATIONS, OR WARRANTIES REGARDING THE ACCURACY, RELIABILITY, OR COMPLETENESS OF OUR DATA, ANALYTICS, PREDICTIONS, OR MODELS. WE DO NOT GUARANTEE ANY PROFITS, WINNINGS, POSITIVE OUTCOMES, OR SPECIFIC RESULTS FROM USING OUR SERVICES. SPORTS OUTCOMES ARE INHERENTLY UNPREDICTABLE AND INVOLVE SUBSTANTIAL RISK OF LOSS. PAST PERFORMANCE OF OUR MODELS OR PREDICTIONS IS NOT INDICATIVE OF FUTURE RESULTS. YOU MAY LOSE MONEY BY RELYING ON OUR SERVICES.</strong></li>
            <li><strong>USER RESPONSIBILITY AND ASSUMPTION OF RISK</strong>: <strong>YOU ARE SOLELY AND EXCLUSIVELY RESPONSIBLE FOR YOUR OWN DECISIONS, ACTIONS, AND ANY FINANCIAL GAINS OR LOSSES INCURRED. YOU ACKNOWLEDGE AND EXPRESSLY AGREE THAT: (A) YOU USE THE SERVICES ENTIRELY AT YOUR OWN RISK; (B) YOU HAVE CONDUCTED YOUR OWN INDEPENDENT RESEARCH AND ANALYSIS; (C) YOU ARE NOT RELYING SOLELY ON WAGERPROOF'S DATA OR ANALYTICS; (D) YOU UNDERSTAND THE RISKS ASSOCIATED WITH SPORTS BETTING AND GAMBLING; AND (E) YOU HAVE THE FINANCIAL MEANS TO ABSORB ANY LOSSES YOU MAY INCUR. YOU HEREBY RELEASE AND HOLD HARMLESS WAGERPROOF FROM ANY AND ALL CLAIMS ARISING FROM YOUR USE OF THE SERVICES OR ANY BETTING ACTIVITIES.</strong></li>
            <li><strong>NOT A GAMBLING OPERATOR</strong>: <strong>WAGERPROOF IS NOT A BOOKMAKER, CASINO, GAMBLING OPERATOR, SPORTSBOOK, OR A PLATFORM FOR PLACING BETS. WE DO NOT ACCEPT, PROCESS, FACILITATE, OR HAVE ANY INVOLVEMENT IN WAGERS, BETS, OR GAMBLING TRANSACTIONS OF ANY KIND. WE DO NOT HOLD ANY GAMBLING LICENSES OR PERMITS. WAGERPROOF IS SOLELY A DATA ANALYTICS AND INFORMATION SERVICES PROVIDER. WAGERPROOF DOES NOT CONDONE ILLEGAL GAMBLING.</strong></li>
          </ul>
          <p className="text-sm">The information and materials presented on or through the Services are made available solely for general information, educational, and entertainment purposes. We do not warrant the accuracy, completeness, or usefulness of this information. Any reliance you place on such information is strictly at your own risk.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">3. Accessing Services and Account Security</h2>
          <p className="text-sm">The Services are offered and available only to users who are 18 years of age or older, and reside in the United States or any of its territories or possessions. By using the Services, you represent and warrant that you are of legal age to form a binding contract with the Company and meet all of the foregoing eligibility requirements. You further warrant that you are legally permitted to access the Services in your jurisdiction.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">4. Subscriptions and Payments</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Subscription Plans</strong>: We offer various subscription plans (e.g., Basic, Pro, Enterprise) with different features and pricing.</li>
            <li><strong>Billing</strong>: Subscriptions are billed on a recurring basis through our third-party payment processor, Stripe.</li>
            <li><strong>Price Changes</strong>: We reserve the right to change our subscription fees at any time.</li>
            <li><strong>Cancellations and Refunds</strong>: You may cancel your subscription at any time. We do not offer refunds for partial subscription periods, except as expressly provided in these Terms of Service, in cases of material breach by WagerProof, or as may be required by applicable law.</li>
          </ul>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">5. Prohibited Uses</h2>
          <p className="text-sm">You may use the Services only for lawful purposes and in accordance with these Terms of Service. You agree not to use the Services in any way that violates any applicable federal, state, local, or international law or regulation, including gambling laws or regulations.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">6. Monitoring and Enforcement; Termination</h2>
          <p className="text-sm">We have the right to terminate or suspend your access to all or part of the Services for any or no reason, including without limitation, any violation of these Terms of Service.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">7. Links</h2>
          <p className="text-sm">If the Services contains links to other resources provided by third parties, these links are provided for your convenience only. We have no control over the contents of those sites or resources and accept no responsibility for them.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">8. Intellectual Property</h2>
          <p className="text-sm">The Services and their contents, features, and functionality are owned by WagerProof, its licensors, or other providers of such material and are protected by United States and international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">9. Use of Artificial Intelligence</h2>
          <p className="text-sm">The Services use analytical tools that use artificial intelligence and/or machine learning models (collectively, "AI") designed to provide insights based on available data. You understand and acknowledge that: (a) the information or materials provided by or through the Services may be machine-generated using AI; (b) AI may generate incomplete, inaccurate, biased, outdated, or misleading information, hallucinations, and/or other errors; (c) information or materials provided by or through the Services do not constitute financial, gambling, investment, or professional advice of any kind; and (d) you use the Services and the outputs provided by or through the Services solely at your own risk.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">10. Limitation of Liability</h2>
          <p className="text-sm"><strong>TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WAGERPROOF, ITS AFFILIATES, OR ITS OR THEIR MEMBERS, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, OR LICENSORS BE LIABLE FOR DAMAGES OF ANY KIND, INCLUDING WITHOUT LIMITATION, LOSS OF REVENUE, LOSS OF PROFITS, GAMBLING LOSSES, BETTING LOSSES, FINANCIAL LOSSES FROM RELIANCE ON WAGERBOT OR ANY AI-GENERATED CONTENT, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OR INABILITY TO USE THE SERVICES.</strong></p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">11. Indemnification</h2>
          <p className="text-sm">You agree to defend, indemnify, and hold harmless WagerProof, its affiliates, and its and their respective members, officers, directors, employees, agents, licensors, suppliers, successors, and assigns from and against any and all claims, liabilities, damages, losses, judgements, awards, fees, penalties, fines, and expenses, including reasonable attorneys' fees and costs, arising out of or in any way connected with your access to or use of the Services, your violation of these Terms of Service, any gambling or betting activities you engage in based on information from the Services, or your violation of any applicable laws or regulations.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">12. Governing Law and Jurisdiction</h2>
          <p className="text-sm">All matters relating to the Services and these Terms of Service shall be governed and construed in accordance with the laws of Texas, without regard to its conflict of law provisions. Any legal suit, action, or proceeding arising out of, or related to, these Terms of Service or the Services shall be instituted exclusively in the federal courts of the United States or the courts of the State of Texas, in each case located in the City of Austin and County of Travis.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">13. Arbitration</h2>
          <p className="text-sm">Any dispute, controversy, or claim arising out of or relating to these Terms of Service or the use of the Services shall be determined by binding arbitration in Austin, Texas, before one arbitrator. The arbitration shall be administered by the American Arbitration Association in accordance with its Commercial Arbitration Rules.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">14. Limitation on Time to File Claims</h2>
          <p className="text-sm"><strong>ANY CAUSE OF ACTION OR CLAIM YOU MAY HAVE ARISING OUT OF OR RELATING TO THESE TERMS OF SERVICE OR THE SERVICES MUST BE COMMENCED WITHIN ONE (1) YEAR AFTER THE CAUSE OF ACTION ACCRUES; OTHERWISE, SUCH CAUSE OF ACTION OR CLAIM IS PERMANENTLY BARRED.</strong></p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">15. Waiver and Severability</h2>
          <p className="text-sm">Any waiver by WagerProof of any term or condition set out in these Terms of Service must be in writing and signed by an authorized representative of the Company to be effective. If any provision of these Terms of Service is held by a court or other tribunal of competent jurisdiction to be invalid, illegal, or unenforceable, such provision shall be reformed to the minimum extent necessary to make it valid and enforceable while preserving its intent.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">16. Changes to These Terms of Service</h2>
          <p className="text-sm">We reserve the right to modify or replace these Terms of Service at any time at our sole discretion. If a revision is material, we will provide at least thirty (30) days' notice prior to any new terms taking effect. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">17. Entire Agreement</h2>
          <p className="text-sm">These Terms of Service, including the documents incorporated by reference herein, constitute the sole and entire agreement between you and WagerProof LLC regarding the Services and supersede all prior and contemporaneous understandings, agreements, representations, and warranties, both written and oral, regarding the Services.</p>

          <h2 className="text-lg sm:text-xl font-bold text-green-400">18. Contact Us</h2>
          <p className="text-sm">Any notices or questions concerning these Terms of Service should be directed to: admin@wagerproof.bet</p>
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

