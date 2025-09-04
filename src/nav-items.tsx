import { HomeIcon, BarChart3, TrendingUp, Settings, Bookmark, Trophy, Shield } from "lucide-react";
import { Index } from "./pages/index";
// import Analytics from "./pages/Analytics"; // Deleted
import WinRates from "./pages/WinRates";
import CustomModels from "./pages/CustomModels";
import CollegeFootball from "./pages/CollegeFootball";
import NFL from "./pages/NFL";
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
    title: "Custom Models",
    to: "/custom-models",
    icon: <Settings className="h-4 w-4" />,
    page: <CustomModels />,
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
    title: "Saved Patterns",
    to: "/saved-patterns",
    icon: <Bookmark className="h-4 w-4" />,
    page: <div>Saved Patterns - Route handled in App.tsx</div>,
  },
];
