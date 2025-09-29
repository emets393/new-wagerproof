import { HomeIcon, BarChart3, TrendingUp, Settings, Bookmark, Trophy, Shield, BarChart, User, ShoppingBag } from "lucide-react";
import { Index } from "./pages/index";
// import WinRates from "./pages/WinRates"; // Temporarily hidden (MLB season over)
import CollegeFootball from "./pages/CollegeFootball";
import NFL from "./pages/NFL";
import NFLAnalytics from "./pages/NFLAnalytics";
import NotFound from "./pages/NotFound";
import { Account } from "./pages";
import Marketplace from "./pages/Marketplace";

/**
 * Central place for defining the navigation items. Used for navigation components and routing.
 */
export const navItems = [
  // Hiding Today's Games and Win Rates (keep code, remove from nav)
  {
    title: "College Football",
    to: "/college-football",
    icon: <Trophy className="h-4 w-4" />,
    page: <CollegeFootball />,
  },
  {
    title: "NFL",
    to: "/nfl",
    icon: <Shield className="h-4 w-4" />,
    page: <NFL />,
  },
  {
    title: "NFL Analytics",
    to: "/nfl-analytics",
    icon: <BarChart className="h-4 w-4" />,
    page: <NFLAnalytics />,
  },
  {
    title: "Account",
    to: "/account",
    icon: <User className="h-4 w-4" />,
    page: <Account />,
  },
  {
    title: "Marketplace",
    to: "/marketplace",
    icon: <ShoppingBag className="h-4 w-4" />,
    page: <Marketplace />,
  },
];
