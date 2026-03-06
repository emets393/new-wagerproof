import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

interface SupportLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  canonicalPath?: string;
}

const SITE_URL = 'https://wagerproof.bet';

export default function SupportLayout({ children, title, description, canonicalPath }: SupportLayoutProps) {
  const pageTitle = title ? `${title} - WagerProof Support` : 'Support Center - WagerProof';
  const pageDescription = description || 'Get help with WagerProof. Find answers to common questions about predictions, AI Agents, subscriptions, and more.';
  const defaultImage = `${SITE_URL}/wagerproof-landing.png`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-emerald-50/30 dark:from-gray-950 dark:to-gray-900">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="robots" content="index, follow" />
        {canonicalPath && <link rel="canonical" href={`${SITE_URL}${canonicalPath}`} />}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={defaultImage} />
        <meta property="og:site_name" content="WagerProof" />
        {canonicalPath && <meta property="og:url" content={`${SITE_URL}${canonicalPath}`} />}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={defaultImage} />
        <meta name="twitter:site" content="@wagerproof" />
      </Helmet>
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/wagerproofGreenDark.png"
              alt="WagerProof"
              className="h-7 w-7"
            />
            <span className="font-bold text-lg bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-400 dark:to-emerald-500 bg-clip-text text-transparent">
              WagerProof
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link to="/" className="text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Home
            </Link>
            <Link to="/blog" className="text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Blog
            </Link>
            <Link to="/support" className="text-emerald-600 dark:text-emerald-400 font-semibold">
              Support
            </Link>
          </nav>
        </div>
      </header>
      <main className="pt-8 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 py-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()} WagerProof. All rights reserved.
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
          <Link to="/privacy-policy" className="hover:text-emerald-600 dark:hover:text-emerald-400">Privacy Policy</Link>
          {' · '}
          <Link to="/terms-and-conditions" className="hover:text-emerald-600 dark:hover:text-emerald-400">Terms of Service</Link>
          {' · '}
          <Link to="/support" className="hover:text-emerald-600 dark:hover:text-emerald-400">Support</Link>
        </p>
      </footer>
    </div>
  );
}
