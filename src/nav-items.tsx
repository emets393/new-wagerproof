import { Home as HomeIcon, Trophy, Shield as ShieldIcon, BarChart, User, Shield, ScatterChart, Goal, School, Star, MessageSquare, GraduationCap, Bot } from "lucide-react";
import { Basketball } from "phosphor-react";
import { Index } from "./pages/index";
import CollegeFootball from "./pages/CollegeFootball";
import NFL from "./pages/NFL";
import NFLAnalytics from "./pages/NFLAnalytics";
import NFLTeaserSharpness from "./pages/NFLTeaserSharpness";
import WagerBotChat from "./pages/WagerBotChat";
import NotFound from "./pages/NotFound";
import { Account } from "./pages";
import Landing from "./pages/Landing";
import Admin from "./pages/Admin";
import EditorsPicks from "./pages/EditorsPicks";

export interface NavItem {
  title: string;
  to: string;
  icon: React.ReactNode;
  page?: React.ReactNode;
  requiresAdmin?: boolean;
  comingSoon?: boolean;
  subItems?: Array<{
    title: string;
    to: string;
    icon?: React.ReactNode;
  }>;
}

/**
 * Central place for defining the navigation items. Used for navigation components and routing.
 */
export const navItems: NavItem[] = [
  {
    title: "Home",
    to: "/home",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Landing />,
  },
  {
    title: "Learn WagerProof",
    to: "/learn",
    icon: <GraduationCap className="h-4 w-4" />,
  },
  {
    title: "WagerBot Chat",
    to: "/wagerbot-chat",
    icon: <Bot className="h-4 w-4" />,
    page: <WagerBotChat />,
  },
  {
    title: "Editors Picks",
    to: "/editors-picks",
    icon: <Star className="h-4 w-4" />,
    page: <EditorsPicks />,
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
    subItems: [
      {
        title: "Historical Analytics",
        to: "/nfl-analytics",
        icon: <BarChart className="h-4 w-4" />,
      },
      {
        title: "Teaser Tool",
        to: "/nfl/teaser-sharpness",
        icon: <ScatterChart className="h-4 w-4" />,
      },
    ],
  },
  {
    title: "NBA",
    to: "/nba",
    icon: <Basketball className="h-4 w-4" />,
    comingSoon: true,
  },
  {
    title: "NCAAB",
    to: "/ncaab",
    icon: <School className="h-4 w-4" />,
    comingSoon: true,
  },
  {
    title: "Feature Requests",
    to: "/feature-requests",
    icon: <MessageSquare className="h-4 w-4" />,
    comingSoon: true,
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
