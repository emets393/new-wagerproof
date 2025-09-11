import { HomeIcon, BarChart3, TrendingUp, Settings, Bookmark, Trophy, Shield, BarChart } from "lucide-react";
import { Index } from "./pages/index";
import WinRates from "./pages/WinRates";
import CollegeFootball from "./pages/CollegeFootball";
import NFL from "./pages/NFL";
import NFLAnalytics from "./pages/NFLAnalytics";
import NotFound from "./pages/NotFound";

/**
 * Central place for defining the navigation items. Used for navigation components and routing.
 */
export const navItems = [
  {
    title: "Today's Games",
    to: "/",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "Win Rates",
    to: "/win-rates", 
    icon: <TrendingUp className="h-4 w-4" />,
    page: <WinRates />,
  },
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
];
