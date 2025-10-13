import { Home as HomeIcon, Trophy, Shield as ShieldIcon, BarChart, User, Shield } from "lucide-react";
import { Index } from "./pages/index";
import CollegeFootball from "./pages/CollegeFootball";
import NFL from "./pages/NFL";
import NFLAnalytics from "./pages/NFLAnalytics";
import NotFound from "./pages/NotFound";
import { Account } from "./pages";
import Landing from "./pages/Landing";
import Admin from "./pages/Admin";

/**
 * Central place for defining the navigation items. Used for navigation components and routing.
 */
export const navItems = [
  // Hiding Today's Games and Win Rates (keep code, remove from nav)
  {
    title: "Home",
    to: "/home",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Landing />,
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
    icon: <ShieldIcon className="h-4 w-4" />,
    page: <NFL />,
  },
  {
    title: "Admin",
    to: "/admin",
    icon: <Shield className="h-4 w-4" />,
    page: <Admin />,
    requiresAdmin: true,
  },
  {
    title: "Account",
    to: "/account",
    icon: <User className="h-4 w-4" />,
    page: <Account />,
  },
];
