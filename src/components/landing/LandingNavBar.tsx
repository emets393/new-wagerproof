
import React from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { scrollToElement } from "@/utils/scrollToElement";
import { Menu, X } from "lucide-react";
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler";

// Set constants
const NAV_RADIUS = "1.2rem";
const BTN_RADIUS = "0.9rem";
const NavBar = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 16);
    };
    window.addEventListener("scroll", onScroll, {
      passive: true
    });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const handleNavLinkClick = (id: string) => {
    scrollToElement(id);
    setIsMenuOpen(false);
  };

  // Styles
  const borderRadius = NAV_RADIUS;
  const navPadding = "0.0125rem 0.1rem";

  // New: set width/margin defaults
  // Unscrolled: more margin from screen edges, not fully edge-to-edge
  // Scrolled: only slightly more narrow for a more subtle change
  // Example: Unscrolled (w-[98vw] max-w-4xl mx-auto mt-4), Scrolled (w-[94vw] max-w-2xl mx-auto mt-4)
  const unscrolledClasses = "mx-auto mt-4 w-[98vw] max-w-4xl bg-white/10 dark:bg-gray-900/10 border-none backdrop-blur-0 shadow-none";
  const scrolledClasses = "mx-auto mt-4 w-[96vw] max-w-[68rem] bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl shadow-2xl border-none animate-fade-in";
  return <nav className={"top-0 left-0 right-0 z-50 transition-all duration-300 fixed" + (scrolled ? ` ${scrolledClasses}` : ` ${unscrolledClasses}`)} style={{
    padding: navPadding,
    borderRadius: borderRadius,
    boxShadow: scrolled ? "0 8px 36px 0 rgba(115,182,158,0.13), 0 2px 12px 0 #e0f2e9" : undefined,
    marginTop: scrolled ? undefined : 0,
    transition: "all 0.35s cubic-bezier(0.35,0.85,0.4,1)"
  }}>
      <div className="container mx-auto px-0">
        <div className="flex justify-between items-center" style={{
        height: "56px"
      }}>
          {/* LOGO + TITLE */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center px-2">
              <img src="/Wagerproof_v1-iOS-logoonly-1024x1024@1x copy.png" alt="WagerProof Logo" style={{
              width: 36,
              height: 36,
              marginRight: 8
            }} className="object-contain rounded-lg" />
              <span className="text-2xl font-bold bg-gradient-to-r from-honeydew-500 to-honeydew-700 dark:from-honeydew-400 dark:to-honeydew-600 bg-clip-text text-transparent select-none" style={{
              letterSpacing: "-1px"
            }}>
                WagerProof
              </span>
            </Link>
          </div>
          <div className="flex items-center space-x-2 px-2">
            <AnimatedThemeToggler className="mr-2 hidden md:block" />
            <Button variant="ghost" className="hidden md:inline-flex text-gray-700 dark:text-gray-200 font-medium hover:text-honeydew-600 dark:hover:text-honeydew-400 hover:bg-honeydew-50 dark:hover:bg-gray-800 transition" style={{
                borderRadius: BTN_RADIUS,
                paddingLeft: "1.2rem",
                paddingRight: "1.2rem",
                height: "2.3rem",
                fontSize: "1rem"
              }} onClick={() => window.open('https://www.tiktok.com/@wagerproof', '_blank')}>
                Follow
            </Button>
            <Button variant="ghost" className="hidden md:inline-flex text-gray-700 dark:text-gray-200 font-medium hover:text-honeydew-600 dark:hover:text-honeydew-400 hover:bg-honeydew-50 dark:hover:bg-gray-800 transition" style={{
                borderRadius: BTN_RADIUS,
                paddingLeft: "1.2rem",
                paddingRight: "1.2rem",
                height: "2.3rem",
                fontSize: "1rem"
              }} onClick={() => window.open('/press-kit', '_self')}>
                Press Kit
            </Button>
            <Button className="bg-gradient-to-r from-honeydew-500 to-honeydew-700 hover:from-honeydew-600 hover:to-honeydew-800 text-white font-semibold shadow hover-scale transition" style={{
              borderRadius: BTN_RADIUS,
              paddingLeft: "1.2rem",
              paddingRight: "1.2rem",
              height: "2.3rem",
              fontSize: "1rem"
            }} onClick={() => window.location.href = 'https://www.wagerproof.bet/account'}>
                <span className="hidden md:inline">Get Started</span>
                <span className="md:hidden">Sign In</span>
            </Button>
            <button className="md:hidden p-2 rounded-md text-gray-700 dark:text-gray-200 hover:text-honeydew-600 dark:hover:text-honeydew-400 focus:outline-none" style={{
            borderRadius: borderRadius
          }} onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {isMenuOpen && <div className="md:hidden py-3 px-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 animate-fade-in shadow-xl" style={{
        borderRadius: `0 0 ${borderRadius} ${borderRadius}`
      }}>
            <div className="flex flex-col space-y-2">
              <Button variant="ghost" className="w-full justify-center text-gray-700 dark:text-gray-200 font-medium hover:bg-honeydew-50 dark:hover:bg-gray-800 transition" style={{
                  borderRadius: BTN_RADIUS,
                  paddingLeft: "1.2rem",
                  paddingRight: "1.2rem",
                  height: "2.3rem",
                  fontSize: "1rem"
                }} onClick={() => { window.open('https://www.tiktok.com/@wagerproof', '_blank'); setIsMenuOpen(false); }}>
                  Follow
              </Button>
              <Button variant="ghost" className="w-full justify-center text-gray-700 dark:text-gray-200 font-medium hover:bg-honeydew-50 dark:hover:bg-gray-800 transition" style={{
                  borderRadius: BTN_RADIUS,
                  paddingLeft: "1.2rem",
                  paddingRight: "1.2rem",
                  height: "2.3rem",
                  fontSize: "1rem"
                }} onClick={() => { window.open('/press-kit', '_self'); setIsMenuOpen(false); }}>
                  Press Kit
              </Button>
            </div>
          </div>}
      </div>
    </nav>;
};
export default NavBar;
