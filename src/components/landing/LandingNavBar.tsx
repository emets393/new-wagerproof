
import React from "react";
import { Button } from "@/components/ui/button";
import { Button as MovingBorderButton } from "@/components/ui/moving-border";
import { Link } from "react-router-dom";
import { scrollToElement } from "@/utils/scrollToElement";
import { Menu, X } from "lucide-react";
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler";
import { GradientText } from "@/components/ui/gradient-text";

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
  const scrolledClasses = "mx-auto mt-4 w-[96vw] max-w-[68rem] bg-white/40 dark:bg-gray-900/40 backdrop-blur-2xl border-none animate-fade-in";
  return <nav className={"top-0 left-0 right-0 z-50 transition-all duration-300 fixed" + (scrolled ? ` ${scrolledClasses}` : ` ${unscrolledClasses}`)} style={{
    padding: navPadding,
    borderRadius: borderRadius,
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
              <img src="/wagerproofGreenLight.png" alt="WagerProof Logo" style={{
              width: 36,
              height: 36,
              marginRight: 8
            }} className="object-contain rounded-lg dark:hidden" />
              <img src="/wagerproofGreenDark.png" alt="WagerProof Logo" style={{
              width: 36,
              height: 36,
              marginRight: 8
            }} className="object-contain rounded-lg hidden dark:block" />
              <span className="text-2xl font-bold select-none" style={{
              letterSpacing: "-1px"
            }}>
                <span className="text-black dark:text-white">Wager</span>
                <GradientText 
                  text="Proof™" 
                  gradient="linear-gradient(90deg, #22c55e 0%, #4ade80 20%, #16a34a 50%, #4ade80 80%, #22c55e 100%)"
                  className="inline"
                />
              </span>
            </Link>
          </div>
          <div className="flex items-center space-x-2 px-2">
            <AnimatedThemeToggler className="mr-2 hidden md:block" />
            {/* Social Icons */}
            <a href="https://twitter.com/wagerproofai" target="_blank" rel="noopener noreferrer" className="hidden md:inline-flex p-2 text-gray-700 dark:text-gray-200 hover:text-honeydew-600 dark:hover:text-honeydew-400 transition">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="https://instagram.com/wagerproof" target="_blank" rel="noopener noreferrer" className="hidden md:inline-flex p-2 text-gray-700 dark:text-gray-200 hover:text-honeydew-600 dark:hover:text-honeydew-400 transition">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
            <Link to="/blog">
              <Button variant="ghost" className="hidden md:inline-flex text-gray-700 dark:text-gray-200 font-medium hover:text-honeydew-600 dark:hover:text-honeydew-400 hover:bg-honeydew-50 dark:hover:bg-gray-800 transition" style={{
                  borderRadius: BTN_RADIUS,
                  paddingLeft: "1.2rem",
                  paddingRight: "1.2rem",
                  height: "2.3rem",
                  fontSize: "1rem"
                }}>
                  Blog
              </Button>
            </Link>
            <Link to="/press-kit">
              <Button variant="ghost" className="hidden md:inline-flex text-gray-700 dark:text-gray-200 font-medium hover:text-honeydew-600 dark:hover:text-honeydew-400 hover:bg-honeydew-50 dark:hover:bg-gray-800 transition" style={{
                  borderRadius: BTN_RADIUS,
                  paddingLeft: "1.2rem",
                  paddingRight: "1.2rem",
                  height: "2.3rem",
                  fontSize: "1rem"
                }}>
                  Press Kit
              </Button>
            </Link>
            <Link to="/wagerbot-chat">
              <MovingBorderButton
                borderRadius={BTN_RADIUS}
                containerClassName="h-[2.3rem] w-auto"
                className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-honeydew-600 dark:text-honeydew-400 font-semibold border-gray-300 dark:border-gray-600"
                borderClassName="bg-[radial-gradient(#73b69e_40%,transparent_60%)]"
                duration={2000}
              >
                  <span className="hidden md:inline px-3">Get Started</span>
                  <span className="md:hidden px-3">Sign In</span>
              </MovingBorderButton>
            </Link>
            <button className="md:hidden p-2 rounded-md text-gray-700 dark:text-gray-200 hover:text-honeydew-600 dark:hover:text-honeydew-400 focus:outline-none" style={{
            borderRadius: borderRadius
          }} onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {isMenuOpen && <div className="md:hidden py-3 px-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 animate-fade-in" style={{
        borderRadius: `0 0 ${borderRadius} ${borderRadius}`
      }}>
            <div className="flex flex-col space-y-2">
              {/* Social Icons for mobile */}
              <div className="flex justify-center gap-4 py-2">
                <a href="https://twitter.com/wagerproofai" target="_blank" rel="noopener noreferrer" className="p-2 text-gray-700 dark:text-gray-200 hover:text-honeydew-600 dark:hover:text-honeydew-400 transition">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                <a href="https://instagram.com/wagerproof" target="_blank" rel="noopener noreferrer" className="p-2 text-gray-700 dark:text-gray-200 hover:text-honeydew-600 dark:hover:text-honeydew-400 transition">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
              </div>
              <Link to="/blog" onClick={() => setIsMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-center text-gray-700 dark:text-gray-200 font-medium hover:bg-honeydew-50 dark:hover:bg-gray-800 transition" style={{
                    borderRadius: BTN_RADIUS,
                    paddingLeft: "1.2rem",
                    paddingRight: "1.2rem",
                    height: "2.3rem",
                    fontSize: "1rem"
                  }}>
                    Blog
                </Button>
              </Link>
              <Link to="/press-kit" onClick={() => setIsMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-center text-gray-700 dark:text-gray-200 font-medium hover:bg-honeydew-50 dark:hover:bg-gray-800 transition" style={{
                    borderRadius: BTN_RADIUS,
                    paddingLeft: "1.2rem",
                    paddingRight: "1.2rem",
                    height: "2.3rem",
                    fontSize: "1rem"
                  }}>
                    Press Kit
                </Button>
              </Link>
            </div>
          </div>}
      </div>
    </nav>;
};
export default NavBar;
