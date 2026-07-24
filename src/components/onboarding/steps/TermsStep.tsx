import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { StepHeader } from '@/components/onboarding/OnboardingShared';

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-base font-bold text-white sm:text-lg">{heading}</h2>
      <div className="space-y-2 text-sm text-white/80">{children}</div>
    </div>
  );
}

export function TermsStep() {
  const { setTermsChecked } = useOnboarding();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTermsChecked(hasScrolledToBottom && isChecked);
  }, [hasScrolledToBottom, isChecked, setTermsChecked]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 50) setHasScrolledToBottom(true);
    };
    container.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="flex w-full flex-col items-center">
      <StepHeader
        title="Terms and Conditions"
        subtitle="Please read through our terms and conditions before continuing"
      />

      {!hasScrolledToBottom && (
        <motion.div
          className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <ChevronDown className="h-3 w-3 animate-bounce" />
          <span>Scroll down to continue</span>
          <ChevronDown className="h-3 w-3 animate-bounce" />
        </motion.div>
      )}

      <div
        ref={scrollContainerRef}
        className="max-h-[46vh] w-full overflow-y-auto rounded-2xl border border-white/15 bg-white/5 p-4 text-left sm:p-5"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div className="space-y-4">
          <p className="text-xs text-white/50">Last Updated: October 15, 2025</p>

          <Section heading="1. Acceptance of the Terms of Service">
            <p>These terms and conditions of service are entered into by and between you and WagerProof LLC, a Texas limited liability company ("WagerProof," "Company," "we," or "us"). The following terms and conditions of service, together with any documents they expressly incorporate by reference (collectively, "Terms of Service"), govern your access to and use of https://wagerproof.bet (the "Website"), including any content, functionality, and services offered on or through the Website, whether as a guest or a registered user, (collectively, the "Services").</p>
            <p>Please read the Terms of Service carefully before you start to use the Services. By clicking "I Accept," creating an account, accessing, or using the Services in any manner, you acknowledge that you have read, understood, and agree to be bound and abide by these Terms of Service, including our Privacy Policy, found at https://wagerproof.bet/privacy-policy, which is hereby incorporated herein by reference. If you do not agree to these Terms of Service, you are not authorized to access or use the Services and must immediately cease all use of the Services.</p>
          </Section>

          <Section heading="2. Nature of Service & Disclaimers">
            <ul className="list-disc space-y-2 pl-5">
              <li><strong>Sports Data Analytics Only</strong>: WagerProof provides data-driven sports insights, statistical analysis, and educational tools through proprietary machine learning models and algorithms. The Services offer statistical models, trend analysis, predictive analytics, and data visualizations to assist users in making informed decisions. All content is for informational and educational purposes only.</li>
              <li><strong>NOT Financial or Betting Advice</strong>: <strong>WagerProof DOES NOT provide financial advice, investment advice, or direct betting recommendations, whether through the Services or otherwise.</strong> The information, data, analytics, and tools provided through the Services are for informational, educational, and entertainment purposes only. You should not consider any materials provided on or through the Services as a solicitation, recommendation, offer, or endorsement to place any wagers or engage in any gambling activity. You should consult with qualified professionals regarding your specific circumstances before making any betting or financial decisions.</li>
              <li><strong>NO GUARANTEES OF ACCURACY OR OUTCOMES</strong>: <strong>WE MAKE NO GUARANTEES, REPRESENTATIONS, OR WARRANTIES REGARDING THE ACCURACY, RELIABILITY, OR COMPLETENESS OF OUR DATA, ANALYTICS, PREDICTIONS, OR MODELS. WE DO NOT GUARANTEE ANY PROFITS, WINNINGS, POSITIVE OUTCOMES, OR SPECIFIC RESULTS FROM USING OUR SERVICES. SPORTS OUTCOMES ARE INHERENTLY UNPREDICTABLE AND INVOLVE SUBSTANTIAL RISK OF LOSS. PAST PERFORMANCE OF OUR MODELS OR PREDICTIONS IS NOT INDICATIVE OF FUTURE RESULTS. YOU MAY LOSE MONEY BY RELYING ON OUR SERVICES.</strong></li>
              <li><strong>USER RESPONSIBILITY AND ASSUMPTION OF RISK</strong>: <strong>YOU ARE SOLELY AND EXCLUSIVELY RESPONSIBLE FOR YOUR OWN DECISIONS, ACTIONS, AND ANY FINANCIAL GAINS OR LOSSES INCURRED. YOU ACKNOWLEDGE AND EXPRESSLY AGREE THAT: (A) YOU USE THE SERVICES ENTIRELY AT YOUR OWN RISK; (B) YOU HAVE CONDUCTED YOUR OWN INDEPENDENT RESEARCH AND ANALYSIS; (C) YOU ARE NOT RELYING SOLELY ON WAGERPROOF'S DATA OR ANALYTICS; (D) YOU UNDERSTAND THE RISKS ASSOCIATED WITH SPORTS BETTING AND GAMBLING; AND (E) YOU HAVE THE FINANCIAL MEANS TO ABSORB ANY LOSSES YOU MAY INCUR. YOU HEREBY RELEASE AND HOLD HARMLESS WAGERPROOF FROM ANY AND ALL CLAIMS ARISING FROM YOUR USE OF THE SERVICES OR ANY BETTING ACTIVITIES.</strong></li>
              <li><strong>NOT A GAMBLING OPERATOR</strong>: <strong>WAGERPROOF IS NOT A BOOKMAKER, CASINO, GAMBLING OPERATOR, SPORTSBOOK, OR A PLATFORM FOR PLACING BETS. WE DO NOT ACCEPT, PROCESS, FACILITATE, OR HAVE ANY INVOLVEMENT IN WAGERS, BETS, OR GAMBLING TRANSACTIONS OF ANY KIND. WE DO NOT HOLD ANY GAMBLING LICENSES OR PERMITS. WAGERPROOF IS SOLELY A DATA ANALYTICS AND INFORMATION SERVICES PROVIDER. WAGERPROOF DOES NOT CONDONE ILLEGAL GAMBLING.</strong></li>
            </ul>
            <p>The information and materials presented on or through the Services are made available solely for general information, educational, and entertainment purposes. We do not warrant the accuracy, completeness, or usefulness of this information. Any reliance you place on such information is strictly at your own risk.</p>
          </Section>

          <Section heading="3. Accessing Services and Account Security">
            <p>The Services are offered and available only to users who are 18 years of age or older, and reside in the United States or any of its territories or possessions. By using the Services, you represent and warrant that you are of legal age to form a binding contract with the Company and meet all of the foregoing eligibility requirements. You further warrant that you are legally permitted to access the Services in your jurisdiction.</p>
          </Section>

          <Section heading="4. Subscriptions and Payments">
            <ul className="list-disc space-y-2 pl-5">
              <li><strong>Subscription Plans</strong>: We offer various subscription plans (e.g., Basic, Pro, Enterprise) with different features and pricing.</li>
              <li><strong>Billing</strong>: Subscriptions are billed on a recurring basis through our third-party payment processor.</li>
              <li><strong>Price Changes</strong>: We reserve the right to change our subscription fees at any time.</li>
              <li><strong>Cancellations and Refunds</strong>: You may cancel your subscription at any time. We do not offer refunds for partial subscription periods, except as expressly provided in these Terms of Service, in cases of material breach by WagerProof, or as may be required by applicable law.</li>
            </ul>
          </Section>

          <Section heading="5. Prohibited Uses">
            <p>You may use the Services only for lawful purposes and in accordance with these Terms of Service. You agree not to use the Services in any way that violates any applicable federal, state, local, or international law or regulation, including gambling laws or regulations.</p>
          </Section>

          <Section heading="6. Monitoring and Enforcement; Termination">
            <p>We have the right to terminate or suspend your access to all or part of the Services for any or no reason, including without limitation, any violation of these Terms of Service.</p>
          </Section>

          <Section heading="7. Links">
            <p>If the Services contains links to other resources provided by third parties, these links are provided for your convenience only. We have no control over the contents of those sites or resources and accept no responsibility for them.</p>
          </Section>

          <Section heading="8. Intellectual Property">
            <p>The Services and their contents, features, and functionality are owned by WagerProof, its licensors, or other providers of such material and are protected by United States and international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.</p>
          </Section>

          <Section heading="9. Use of Artificial Intelligence">
            <p>The Services use analytical tools that use artificial intelligence and/or machine learning models (collectively, "AI") designed to provide insights based on available data. You understand and acknowledge that: (a) the information or materials provided by or through the Services may be machine-generated using AI; (b) AI may generate incomplete, inaccurate, biased, outdated, or misleading information, hallucinations, and/or other errors; (c) information or materials provided by or through the Services do not constitute financial, gambling, investment, or professional advice of any kind; and (d) you use the Services and the outputs provided by or through the Services solely at your own risk.</p>
          </Section>

          <Section heading="10. Limitation of Liability">
            <p><strong>TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WAGERPROOF, ITS AFFILIATES, OR ITS OR THEIR MEMBERS, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, OR LICENSORS BE LIABLE FOR DAMAGES OF ANY KIND, INCLUDING WITHOUT LIMITATION, LOSS OF REVENUE, LOSS OF PROFITS, GAMBLING LOSSES, BETTING LOSSES, FINANCIAL LOSSES FROM RELIANCE ON WAGERBOT OR ANY AI-GENERATED CONTENT, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OR INABILITY TO USE THE SERVICES.</strong></p>
          </Section>

          <Section heading="11. Indemnification">
            <p>You agree to defend, indemnify, and hold harmless WagerProof, its affiliates, and its and their respective members, officers, directors, employees, agents, licensors, suppliers, successors, and assigns from and against any and all claims, liabilities, damages, losses, judgements, awards, fees, penalties, fines, and expenses, including reasonable attorneys' fees and costs, arising out of or in any way connected with your access to or use of the Services, your violation of these Terms of Service, any gambling or betting activities you engage in based on information from the Services, or your violation of any applicable laws or regulations.</p>
          </Section>

          <Section heading="12. Governing Law and Jurisdiction">
            <p>All matters relating to the Services and these Terms of Service shall be governed and construed in accordance with the laws of Texas, without regard to its conflict of law provisions. Any legal suit, action, or proceeding arising out of, or related to, these Terms of Service or the Services shall be instituted exclusively in the federal courts of the United States or the courts of the State of Texas, in each case located in the City of Austin and County of Travis.</p>
          </Section>

          <Section heading="13. Arbitration">
            <p>Any dispute, controversy, or claim arising out of or relating to these Terms of Service or the use of the Services shall be determined by binding arbitration in Austin, Texas, before one arbitrator. The arbitration shall be administered by the American Arbitration Association in accordance with its Commercial Arbitration Rules.</p>
          </Section>

          <Section heading="14. Limitation on Time to File Claims">
            <p><strong>ANY CAUSE OF ACTION OR CLAIM YOU MAY HAVE ARISING OUT OF OR RELATING TO THESE TERMS OF SERVICE OR THE SERVICES MUST BE COMMENCED WITHIN ONE (1) YEAR AFTER THE CAUSE OF ACTION ACCRUES; OTHERWISE, SUCH CAUSE OF ACTION OR CLAIM IS PERMANENTLY BARRED.</strong></p>
          </Section>

          <Section heading="15. Waiver and Severability">
            <p>Any waiver by WagerProof of any term or condition set out in these Terms of Service must be in writing and signed by an authorized representative of the Company to be effective. If any provision of these Terms of Service is held by a court or other tribunal of competent jurisdiction to be invalid, illegal, or unenforceable, such provision shall be reformed to the minimum extent necessary to make it valid and enforceable while preserving its intent.</p>
          </Section>

          <Section heading="16. Changes to These Terms of Service">
            <p>We reserve the right to modify or replace these Terms of Service at any time at our sole discretion. If a revision is material, we will provide at least thirty (30) days' notice prior to any new terms taking effect. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.</p>
          </Section>

          <Section heading="17. Entire Agreement">
            <p>These Terms of Service, including the documents incorporated by reference herein, constitute the sole and entire agreement between you and WagerProof LLC regarding the Services and supersede all prior and contemporaneous understandings, agreements, representations, and warranties, both written and oral, regarding the Services.</p>
          </Section>

          <Section heading="18. Contact Us">
            <p>Any notices or questions concerning these Terms of Service should be directed to: admin@wagerproof.bet</p>
          </Section>
        </div>
      </div>

      <motion.label
        htmlFor="terms-checkbox"
        className={cn(
          'mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3',
          !hasScrolledToBottom && 'cursor-not-allowed opacity-50'
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <Checkbox
          id="terms-checkbox"
          checked={isChecked}
          onCheckedChange={(checked) => setIsChecked(checked as boolean)}
          disabled={!hasScrolledToBottom}
          className="border-white/40 data-[state=checked]:border-green-500 data-[state=checked]:bg-green-500"
        />
        <span className="select-none text-left text-xs text-white sm:text-sm">
          I have read and agree to the Terms and Conditions, and confirm I am 18 or older
        </span>
      </motion.label>
    </div>
  );
}
