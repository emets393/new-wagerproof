import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { SEO } from '@/components/landing/SEO';

const TermsAndConditions = () => {
  return (
    <>
      <SEO
        title="Terms and Conditions"
        description="Read WagerProof's terms and conditions. Understand our service disclaimers, user responsibilities, and legal agreements for using our sports betting analytics platform."
        canonical="https://www.wagerproof.bet/terms-and-conditions"
      />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center mb-6">
        <Link to="/" className="text-muted-foreground hover:text-primary flex items-center">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Home
        </Link>
      </div>
      <h1 className="text-4xl font-extrabold mb-6 text-primary">Terms and Conditions for WagerProof</h1>
      <p className="text-sm text-muted-foreground mb-8">**Last Updated: October 15, 2025**</p>

      <h2 className="text-2xl font-bold mb-4 text-primary">1. Nature of Our Service & Disclaimers</h2>
      <ul className="list-disc pl-5 mb-4 space-y-2">
        <li><strong>Sports Betting Advice & Analytics Only</strong>: WagerProof provides data-driven sports betting insights, analysis, and educational tools. Our Service offers statistical models, trend analysis, and predictions to assist users in making informed decisions.</li>
        <li><strong>NOT Financial or Betting Advice</strong>: <strong>WagerProof DOES NOT provide financial advice, investment advice, or direct betting recommendations.</strong> The information and tools provided are for informational and entertainment purposes only. You should not consider any content on the Service as a solicitation, recommendation, or endorsement to place any wagers or engage in any gambling activity.</li>
        <li><strong>No Guarantees of Winnings</strong>: <strong>We do not guarantee any profits, winnings, or positive outcomes from using our Service.</strong> Sports betting inherently involves risk, and past performance is not indicative of future results.</li>
        <li><strong>User Responsibility</strong>: <strong>You are solely responsible for your own betting decisions, actions, and any financial gains or losses incurred.</strong> You acknowledge and agree that you use the Service at your own risk.</li>
        <li><strong>Not a Gambling Operator</strong>: WagerProof is not a bookmaker, gambling operator, or a platform for placing bets. We do not accept or process wagers.</li>
        <li><strong>Legal Compliance</strong>: You are responsible for ensuring that your use of the Service complies with all applicable laws and regulations in your jurisdiction regarding sports betting and online services. We do not condone illegal gambling.</li>
      </ul>

      <h2 className="text-2xl font-bold mb-4 text-primary">2. User Accounts</h2>
      <ul className="list-disc pl-5 mb-4 space-y-2">
        <li><strong>Eligibility</strong>: You must be at least 18 years old to create an account and use our Service. By creating an account, you represent and warrant that you are at least 18 years old.</li>
        <li><strong>Account Information</strong>: When you create an account, you agree to provide accurate, current, and complete information. You are responsible for maintaining the confidentiality of your account password and for all activities that occur under your account.</li>
        <li><strong>Account Termination</strong>: We reserve the right to suspend or terminate your account at our sole discretion, without notice or liability, for any reason, including if you violate these Terms.</li>
      </ul>

      <h2 className="text-2xl font-bold mb-4 text-primary">3. Subscriptions and Payments</h2>
      <ul className="list-disc pl-5 mb-4 space-y-2">
        <li><strong>Subscription Plans</strong>: We offer various subscription plans (e.g., Basic, Pro, Enterprise) with different features and pricing. Details of these plans are available on our website.</li>
        <li><strong>Billing</strong>: Subscriptions are billed on a recurring basis (e.g., monthly or annually) through our third-party payment processor, Stripe. By subscribing, you authorize Stripe to charge your designated payment method at the beginning of each billing cycle.</li>
        <li><strong>Price Changes</strong>: We reserve the right to change our subscription fees at any time. Any price changes will be communicated to you in advance, and you will have the option to cancel your subscription before the new prices take effect.</li>
        <li><strong>Cancellations and Refunds</strong>: You may cancel your subscription at any time. Cancellations will take effect at the end of your current billing period. We generally do not offer refunds for partial subscription periods, except as required by law.</li>
        <li><strong>Promotions and Trials</strong>: We may offer promotional pricing or free trial periods. These are subject to specific terms and conditions and may be terminated or modified at our discretion.</li>
      </ul>

      <h2 className="text-2xl font-bold mb-4 text-primary">4. Acceptable Use Policy</h2>
      <p className="mb-2">You agree not to use the Service to:</p>
      <ul className="list-disc pl-5 mb-4 space-y-2">
        <li>Violate any local, state, national, or international law or regulation.</li>
        <li>Engage in any activity that is fraudulent, misleading, or deceptive.</li>
        <li>Transmit any harmful, threatening, defamatory, obscene, or otherwise objectionable content.</li>
        <li>Interfere with or disrupt the integrity or performance of the Service.</li>
        <li>Attempt to gain unauthorized access to any part of the Service, other users' accounts, or our systems.</li>
        <li>Use any automated system, including "bots," "spiders," or "offline readers," to access the Service in a manner that sends more request messages to our servers than a human can reasonably produce in the same period by using a conventional web browser.</li>
        <li>Reproduce, duplicate, copy, sell, resell, or exploit any portion of the Service without our express written permission.</li>
      </ul>

      <h2 className="text-2xl font-bold mb-4 text-primary">5. Intellectual Property</h2>
      <p className="mb-4">All content on the Service, including text, graphics, logos, images, software, models, data, and the compilation thereof, is the property of WagerProof or its suppliers and protected by copyright and other intellectual property laws. You may not use any content from the Service for commercial purposes without our express written permission.</p>

      <h2 className="text-2xl font-bold mb-4 text-primary">6. WagerBot and AI Usage</h2>
      <ul className="list-disc pl-5 mb-4 space-y-2">
        <li><strong>Informational Tool</strong>: The WagerBot is an AI-powered analytical tool designed to provide insights based on available data.</li>
        <li><strong>AI Limitations</strong>: <strong>The responses and analyses provided by WagerBot are machine-generated and should not be taken as definitive or infallible advice.</strong> WagerBot may generate incomplete, inaccurate, or biased information.</li>
        <li><strong>No Guarantees from AI</strong>: We do not guarantee the accuracy, completeness, or usefulness of any information provided by WagerBot. Always exercise your own judgment and verify information independently.</li>
      </ul>

      <h2 className="text-2xl font-bold mb-4 text-primary">7. Limitation of Liability</h2>
      <p className="mb-4"><strong>TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WAGERPROOF, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (I) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE; (II) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE; (III) ANY CONTENT OBTAINED FROM THE SERVICE; AND (IV) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, WHETHER OR NOT WE HAVE BEEN INFORMED OF THE POSSIBILITY OF SUCH DAMAGE, AND EVEN IF A REMEDY SET FORTH HEREIN IS FOUND TO HAVE FAILED OF ITS ESSENTIAL PURPOSE.</strong></p>

      <h2 className="text-2xl font-bold mb-4 text-primary">8. Indemnification</h2>
      <p className="mb-4">You agree to indemnify and hold harmless WagerProof, its affiliates, and their respective officers, directors, employees, and agents from and against any and all claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees and costs, arising out of or in any way connected with your access to or use of the Service, your violation of these Terms, or your infringement of any intellectual property or other right of any person or entity.</p>

      <h2 className="text-2xl font-bold mb-4 text-primary">9. Governing Law and Jurisdiction</h2>
      <p className="mb-4">These Terms shall be governed and construed in accordance with the laws of Texas, without regard to its conflict of law provisions. You agree to submit to the exclusive jurisdiction of the courts located in Austin, Texas to resolve any legal matter arising from these Terms or the Service.</p>

      <h2 className="text-2xl font-bold mb-4 text-primary">10. Changes to These Terms</h2>
      <p className="mb-4">We reserve the right to modify or replace these Terms at any time at our sole discretion. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.</p>

      <h2 className="text-2xl font-bold mb-4 text-primary">11. Contact Us</h2>
      <p className="mb-4">If you have any questions about these Terms, please contact us at: admin@wagerproof.bet</p>
      </div>
    </>
  );
};

export default TermsAndConditions;
