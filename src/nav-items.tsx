import { Home as HomeIcon, Trophy, Shield as ShieldIcon, BarChart, BarChart2, User, Shield, Goal, School, Star, MessageSquare, GraduationCap, MessageCircle, FileImage, Activity, Brain, Users, Newspaper, Sparkles, Settings, Megaphone, Share2, Coffee, TrendingUp, Clock, Cable } from "lucide-react";
import { Basketball, DiscordLogo } from "phosphor-react";
import BetSlipGrader from "./pages/BetSlipGrader";
import NotFound from "./pages/NotFound";
import { Account } from "./pages";
import Landing from "./pages/Landing";
import Admin from "./pages/Admin";
import AISettings from "./pages/admin/AISettings";
// import EditorsPicks from "./pages/EditorsPicks";
import Discord from "./pages/Discord";
import ScoreBoard from "./pages/ScoreBoard";
import CommunityVoting from "./pages/CommunityVoting";
import TipJar from "./pages/TipJar";
import Agents from "./pages/Agents";

export interface NavItem {
  title: string;
  to?: string;
  icon?: React.ReactNode;
  page?: React.ReactNode;
  requiresAdmin?: boolean;
  comingSoon?: boolean;
  wip?: boolean;
  /** Quiet supporting copy shown beside a main-sidebar row label. */
  status?: string;
  hidden?: boolean;
  isHeader?: boolean;
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
    title: "ANALYSIS",
    isHeader: true,
  },
  {
    title: "Agents",
    to: "/agents",
    icon: <Users className="h-4 w-4" />,
    page: <Agents />,
  },
  {
    title: "Today's Outliers",
    to: "/today-in-sports",
    icon: <Newspaper className="h-4 w-4" />,
  },
  {
    // Unified split-view tool replacing the three per-sport
    // "Today's Betting Trends" pages (which now redirect here).
    title: "Today's Betting Trends",
    to: "/todays-trends",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    // Unified chat-forward Historical Trends page (NFL/CFB/MLB) — replaces the per-sport analytics pages.
    title: "Historical Trends",
    // No sport param — the page defaults to NFL, and a query-less link keeps
    // the sidebar highlight active across in-page sport switches.
    to: "/historical-trends",
    icon: <BarChart className="h-4 w-4" />,
  },
  {
    // Unified split-view page replacing the per-sport list routes.
    title: "Games",
    to: "/games",
    icon: <Trophy className="h-4 w-4" />,
  },
  // {
  //   title: "Editors Picks",
  //   to: "/editors-picks",
  //   icon: <Star className="h-4 w-4" />,
  //   page: <EditorsPicks />,
  // },
  {
    title: "Score Board",
    to: "/scoreboard",
    icon: <Activity className="h-4 w-4" />,
    page: <ScoreBoard />,
  },
  {
    title: "Connect to AI",
    to: "/connect-ai",
    icon: <Cable className="h-4 w-4" />,
  },
  {
    title: "SPORTS",
    isHeader: true,
  },
  {
    title: "NFL",
    to: "/games?sport=nfl",
    icon: <ShieldIcon className="h-4 w-4" />,
  },
  {
    title: "CFB",
    to: "/games?sport=cfb",
    icon: <GraduationCap className="h-4 w-4" />,
  },
  {
    title: "NBA",
    to: "/games?sport=nba",
    icon: <Basketball className="h-4 w-4" />,
    subItems: [
      {
        title: "Halftime Trends",
        to: "/nba/halftime-trends",
        icon: <Clock className="h-4 w-4" />,
      },
      {
        title: "Today's Predictions",
        to: "/nba/todays-predictions",
        icon: <BarChart2 className="h-4 w-4" />,
      },
    ],
  },
  {
    title: "CBB",
    to: "/games?sport=ncaab",
    icon: <School className="h-4 w-4" />,
    subItems: [
      {
        title: "Halftime Trends",
        to: "/ncaab/halftime-trends",
        icon: <Clock className="h-4 w-4" />,
      },
      {
        title: "Today's Predictions",
        to: "/ncaab/todays-predictions",
        icon: <BarChart2 className="h-4 w-4" />,
      },
    ],
  },
  {
    title: "MLB",
    to: "/games?sport=mlb",
    icon: <Trophy className="h-4 w-4" />,
    subItems: [
      {
        title: "Regression Report",
        to: "/mlb/daily-regression-report",
        icon: <TrendingUp className="h-4 w-4" />,
      },
      {
        title: "First-Five Splits",
        to: "/mlb/f5-splits",
        icon: <BarChart2 className="h-4 w-4" />,
      },
      {
        title: "Player Prop Matchups",
        to: "/mlb/pitcher-matchups",
        icon: <BarChart2 className="h-4 w-4" />,
      },
    ],
  },
  {
    title: "Curling",
    to: "/curling",
    icon: <Goal className="h-4 w-4" />,
    comingSoon: true,
    hidden: true,
  },
  {
    title: "COMMUNITY",
    isHeader: true,
  },
  {
    title: "Discord Channel",
    to: "/discord",
    icon: <DiscordLogo className="h-4 w-4" weight="fill" />,
    page: <Discord />,
  },
  {
    title: "Community Picks",
    to: "/community-voting",
    icon: <Users className="h-4 w-4" />,
    page: <CommunityVoting />,
    hidden: true,
  },
  {
    title: "Share Win",
    to: "/share-win",
    icon: <Share2 className="h-4 w-4" />,
  },
  {
    title: "Tip Jar",
    to: "/tip-jar",
    icon: <Coffee className="h-4 w-4" />,
    page: <TipJar />,
  },
  {
    title: "Feature Requests",
    to: "/feature-requests",
    icon: <MessageSquare className="h-4 w-4" />,
    hidden: true,
  },
  {
    title: "Bet Slip Grader",
    to: "/bet-slip-grader",
    icon: <FileImage className="h-4 w-4" />,
    page: <BetSlipGrader />,
    hidden: true,
  },
  {
    title: "Learn WagerProof",
    to: "/learn",
    icon: <GraduationCap className="h-4 w-4" />,
    hidden: true,
  },
  {
    title: "ADMIN",
    isHeader: true,
    requiresAdmin: true,
  },
  {
    title: "Admin",
    to: "/admin",
    icon: <Shield className="h-4 w-4" />,
    page: <Admin />,
    requiresAdmin: true,
    subItems: [
      {
        title: "Settings",
        to: "/admin/settings",
        icon: <Settings className="h-4 w-4" />,
      },
      {
        title: "Users",
        to: "/admin/users",
        icon: <Users className="h-4 w-4" />,
      },
      {
        title: "Announcements",
        to: "/admin/announcements",
        icon: <Megaphone className="h-4 w-4" />,
      },
      {
        title: "User Wins",
        to: "/admin/user-wins",
        icon: <Trophy className="h-4 w-4" />,
      },
      {
        title: "AI Settings",
        to: "/admin/ai-settings",
        icon: <Brain className="h-4 w-4" />,
      },
      {
        title: "Today in Sports",
        to: "/admin/today-in-sports",
        icon: <Sparkles className="h-4 w-4" />,
      },
    ],
  },
  {
    title: "Account",
    to: "/account",
    icon: <User className="h-4 w-4" />,
    page: <Account />,
  },
];
