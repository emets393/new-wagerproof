import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center mb-6">
        <Link to="/" className="text-muted-foreground hover:text-primary flex items-center">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Home
        </Link>
      </div>
      <h1 className="text-4xl font-extrabold mb-6 text-primary">Privacy Policy for WagerProof</h1>
      <p className="text-sm text-muted-foreground mb-8">**Last Updated: October 15, 2025**</p>

      <p className="mb-4">Welcome to WagerProof! We are committed to protecting your privacy. This Privacy Policy explains how WagerProof ("we," "us," or "our") collects, uses, discloses, and safeguards your information when you visit our website https://wagerproof.com and use our services (collectively, the "Service").</p>

      <h2 className="text-2xl font-bold mb-4 text-primary">1. Information We Collect</h2>
      <p className="mb-2">We may collect personal information from you in a variety of ways, including when you:</p>
      <ul className="list-disc pl-5 mb-4 space-y-2">
        <li><strong>Create an Account</strong>: When you register for an account, we collect your email address and authentication details. If you use third-party providers like Google or Apple for sign-up, we receive information such as your email and display name as permitted by their privacy policies.</li>
        <li><strong>Use Our Services</strong>: We collect information related to your usage of our platform, such as the features you access, patterns you save, models you build, and interactions with WagerBot. This helps us understand how our services are used and improve them.</li>
        <li><strong>Subscription and Payments</strong>: If you subscribe to our paid services, we collect billing and payment information through our third-party payment processor, Stripe. We do not directly store your full credit card details on our servers.</li>
        <li><strong>Communications</strong>: We may collect information when you communicate with us, such as customer support inquiries or feedback.</li>
        <li><strong>Automatically Collected Information</strong>: When you access our Service, we may automatically collect certain information, including your IP address, device type, browser type, operating system, referring URLs, and website usage data. We may also use cookies and similar tracking technologies to enhance your experience and collect usage data.</li>
      </ul>

      <h2 className="text-2xl font-bold mb-4 text-primary">2. How We Use Your Information</h2>
      <p className="mb-2">We use the information we collect to:</p>
      <ul className="list-disc pl-5 mb-4 space-y-2">
        <li><strong>Provide and Maintain Our Service</strong>: Operate, maintain, and improve the functionality of WagerProof, including personalized content and features.</li>
        <li><strong>Manage Your Account</strong>: Create and manage your user account, including authentication, password management, and role assignment (e.g., "free_user," "paid_user").</li>
        <li><strong>Process Subscriptions and Payments</strong>: Facilitate your subscriptions to our paid services and process transactions via Stripe.</li>
        <li><strong>Personalize Your Experience</strong>: Tailor content, predictions, and analytics based on your usage patterns and preferences.</li>
        <li><strong>Communicate with You</strong>: Send you important updates, security alerts, and administrative messages.</li>
        <li><strong>Analyze and Improve</strong>: Understand user behavior, analyze trends, and improve the design, content, and features of our Service.</li>
        <li><strong>Security and Fraud Prevention</strong>: Detect and prevent fraud, abuse, and other malicious activities.</li>
        <li><strong>Legal Compliance</strong>: Comply with applicable laws, regulations, and legal processes.</li>
      </ul>

      <h2 className="text-2xl font-bold mb-4 text-primary">3. How We Share Your Information</h2>
      <p className="mb-2">We may share your information with third parties in the following situations:</p>
      <ul className="list-disc pl-5 mb-4 space-y-2">
        <li><strong>Service Providers</strong>: We engage third-party service providers to perform functions on our behalf, such as:
          <ul className="list-circle pl-5 mt-1 space-y-1">
            <li><strong>Supabase</strong>: For database management, user authentication, and edge functions.</li>
            <li><strong>Stripe</strong>: For payment processing and subscription management.</li>
            <li><strong>Analytics Providers</strong>: To help us analyze how our Service is used and improve its functionality.</li>
          </ul>
        </li>
        <li><strong>Legal Requirements</strong>: We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g., a court order or government agency).</li>
        <li><strong>Business Transfers</strong>: In connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
        <li><strong>With Your Consent</strong>: We may share your information with other third parties when we have your explicit consent to do so.</li>
      </ul>

      <h2 className="text-2xl font-bold mb-4 text-primary">4. Data Security</h2>
      <p className="mb-4">We implement reasonable technical and organizational measures designed to protect your personal information from unauthorized access, use, alteration, and disclosure. However, please be aware that no security system is impenetrable, and we cannot guarantee the absolute security of your data.</p>

      <h2 className="text-2xl font-bold mb-4 text-primary">5. Your Data Rights</h2>
      <p className="mb-2">Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
      <ul className="list-disc pl-5 mb-4 space-y-2">
        <li><strong>Access</strong>: Request access to the personal data we hold about you.</li>
        <li><strong>Correction</strong>: Request correction of any inaccurate or incomplete personal data.</li>
        <li><strong>Deletion</strong>: Request deletion of your personal data, subject to certain legal exceptions.</li>
        <li><strong>Objection/Restriction</strong>: Object to or request restriction of our processing of your personal data.</li>
        <li><strong>Data Portability</strong>: Request a copy of your personal data in a structured, commonly used, and machine-readable format.</li>
      </ul>
      <p className="mb-4">To exercise these rights, please contact us at admin@wagerproof.bet.</p>

      <h2 className="text-2xl font-bold mb-4 text-primary">6. Third-Party Links</h2>
      <p className="mb-4">Our Service may contain links to third-party websites or services that are not owned or controlled by WagerProof. We are not responsible for the privacy practices or content of these third-party sites. We encourage you to review the privacy policies of any third-party sites you visit.</p>

      <h2 className="text-2xl font-bold mb-4 text-primary">7. Children's Privacy</h2>
      <p className="mb-4">Our Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children under 18. If you become aware that a child has provided us with personal information, please contact us.</p>

      <h2 className="text-2xl font-bold mb-4 text-primary">8. Changes to This Privacy Policy</h2>
      <p className="mb-4">We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.</p>

      <h2 className="text-2xl font-bold mb-4 text-primary">9. Contact Us</h2>
      <p className="mb-4">If you have any questions about this Privacy Policy, please contact us at: admin@wagerproof.bet</p>

    </div>
  );
};

export default PrivacyPolicy;
