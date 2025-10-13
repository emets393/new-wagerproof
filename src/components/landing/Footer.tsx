import React from "react";
import { Link } from "react-router-dom";
import { scrollToElement } from "@/utils/scrollToElement";
import { Twitter, Instagram } from "lucide-react";
const Footer = () => {
  const TIKTOK_LINK = "https://www.tiktok.com/@wagerproof";
  const TWITTER_LINK = "https://twitter.com/wagerproof";
  const INSTAGRAM_LINK = "https://instagram.com/wagerproof";
  return <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 transition-colors duration-300">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-2">
          <Link to="/" className="inline-block">
            <span className="text-2xl font-bold bg-gradient-to-r from-honeydew-500 to-honeydew-700 bg-clip-text text-transparent mb-4 inline-block">
              WagerProof
            </span>
          </Link>
          <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md">
            Data-driven sports betting analytics powered by real data. Professional-grade predictions for NFL, College Football, and more.
          </p>
          <div className="flex space-x-4">
            <a href={TWITTER_LINK} target="_blank" rel="noopener noreferrer" className="text-gray-400 dark:text-gray-500 hover:text-honeydew-500 dark:hover:text-honeydew-400 transition-colors">
              <Twitter className="w-6 h-6" />
            </a>
            <a href={INSTAGRAM_LINK} target="_blank" rel="noopener noreferrer" className="text-gray-400 dark:text-gray-500 hover:text-honeydew-500 dark:hover:text-honeydew-400 transition-colors">
              <Instagram className="w-6 h-6" />
            </a>
            <a href={TIKTOK_LINK} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-honeydew-500 transition-colors" title="TikTok">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
              </svg>
            </a>
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">Features</h3>
          <ul className="space-y-2">
            <li>
              <button onClick={() => scrollToElement('user-journey')} className="text-gray-600 dark:text-gray-400 hover:text-honeydew-600 dark:hover:text-honeydew-400 transition-colors">
                Game Predictions
              </button>
            </li>
            <li>
              <button onClick={() => scrollToElement('pricing')} className="text-gray-600 dark:text-gray-400 hover:text-honeydew-600 dark:hover:text-honeydew-400 transition-colors">
                Pricing
              </button>
            </li>
            <li>
              <a href="https://www.wagerproof.bet/nfl" className="text-gray-600 dark:text-gray-400 hover:text-honeydew-600 dark:hover:text-honeydew-400 transition-colors">
                NFL Analytics
              </a>
            </li>
            <li>
              <a href="https://www.wagerproof.bet/college-football" className="text-gray-600 dark:text-gray-400 hover:text-honeydew-600 dark:hover:text-honeydew-400 transition-colors">
                College Football
              </a>
            </li>
          </ul>
        </div>
        
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">Company</h3>
          <ul className="space-y-2">
            <li>
              
            </li>
            <li>
              
            </li>
            <li>
              <Link to="/privacy-policy" className="text-gray-600 dark:text-gray-400 hover:text-honeydew-600 dark:hover:text-honeydew-400 transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/terms-of-service" className="text-gray-600 dark:text-gray-400 hover:text-honeydew-600 dark:hover:text-honeydew-400 transition-colors">
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 mt-12 pt-8 text-center">
        <p className="text-gray-500 dark:text-gray-500 text-sm">
          © {new Date().getFullYear()} WagerProof. All rights reserved.
        </p>
        <p className="text-gray-400 dark:text-gray-600 text-xs mt-2">
          Please gamble responsibly. WagerProof provides analytics and information for educational purposes only.
        </p>
      </div>
    </div>
  </footer>;
};
export default Footer;
