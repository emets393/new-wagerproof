import React from "react";
import { Link } from "react-router-dom";
import { scrollToElement } from "@/utils/scrollToElement";
import { Twitter, Instagram } from "lucide-react";
import { GradientText } from "@/components/ui/gradient-text";

const Footer = () => {
  const TIKTOK_LINK = "https://www.tiktok.com/@wagerproof";
  const TWITTER_LINK = "https://twitter.com/wagerproofai";
  const INSTAGRAM_LINK = "https://www.instagram.com/wagerproof.official/";
  const GOOGLE_PLAY_LINK = "https://play.google.com/store/apps/details?id=com.wagerproof.mobile";

  return (
    <footer className="bg-gray-900 border-t border-gray-800 transition-colors duration-300">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Column */}
          <div className="col-span-1 md:col-span-2 lg:col-span-2">
            <Link to="/" className="inline-block">
              <span className="text-2xl font-bold mb-4 inline-block">
                <span className="text-white">Wager</span>
                <GradientText
                  text="Proof™"
                  gradient="linear-gradient(90deg, #22c55e 0%, #4ade80 20%, #16a34a 50%, #4ade80 80%, #22c55e 100%)"
                  className="inline"
                />
              </span>
            </Link>
            <p className="text-gray-400 mb-4 max-w-md">
              Data-driven sports betting analytics powered by real data. Professional-grade predictions for NFL, College Football, NBA, and more.
            </p>
            <div className="flex space-x-4 mb-6">
              <a href={TWITTER_LINK} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-honeydew-400 transition-colors">
                <Twitter className="w-6 h-6" />
              </a>
              <a href={INSTAGRAM_LINK} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-honeydew-400 transition-colors">
                <Instagram className="w-6 h-6" />
              </a>
              <a href={TIKTOK_LINK} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-honeydew-400 transition-colors" title="TikTok">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
            </div>
            {/* App Store Badges */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={GOOGLE_PLAY_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                <img
                  src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                  alt="Get it on Google Play"
                  className="h-10 w-auto"
                />
              </a>
              <div className="flex items-center">
                <img
                  src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                  alt="Download on the App Store - Coming Soon"
                  className="h-10 w-auto opacity-50"
                />
                <span className="ml-2 text-xs text-gray-500">Coming Soon</span>
              </div>
            </div>
          </div>

          {/* Features Column */}
          <div>
            <h3 className="text-sm font-semibold text-gray-100 uppercase tracking-wider mb-4">Features</h3>
            <ul className="space-y-2">
              <li>
                <button onClick={() => scrollToElement('user-journey')} className="text-gray-400 hover:text-honeydew-400 transition-colors">
                  Game Predictions
                </button>
              </li>
              <li>
                <Link to="/nfl" className="text-gray-400 hover:text-honeydew-400 transition-colors">
                  NFL Predictions
                </Link>
              </li>
              <li>
                <Link to="/college-football" className="text-gray-400 hover:text-honeydew-400 transition-colors">
                  College Football
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-gray-400 hover:text-honeydew-400 transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h3 className="text-sm font-semibold text-gray-100 uppercase tracking-wider mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/press-kit" className="text-gray-400 hover:text-honeydew-400 transition-colors">
                  Press Kit
                </Link>
              </li>
              <li>
                <Link to="/mobile-app" className="text-gray-400 hover:text-honeydew-400 transition-colors">
                  Mobile App
                </Link>
              </li>
              <li>
                <button onClick={() => scrollToElement('pricing')} className="text-gray-400 hover:text-honeydew-400 transition-colors">
                  Pricing
                </button>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h3 className="text-sm font-semibold text-gray-100 uppercase tracking-wider mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy-policy" className="text-gray-400 hover:text-honeydew-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-and-conditions" className="text-gray-400 hover:text-honeydew-400 transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-12 pt-8 text-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} WagerProof. All rights reserved.
          </p>
          <p className="text-gray-600 text-xs mt-2">
            Please gamble responsibly. WagerProof provides analytics and information for educational purposes only.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
