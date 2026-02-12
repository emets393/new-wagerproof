import { Home as HomeIcon, Trophy, Shield as ShieldIcon, BarChart, User, Shield, ScatterChart, Goal, School, Star, MessageSquare, GraduationCap, Bot, MessageCircle, FileImage, Activity, Brain, Smartphone, Users, Newspaper, Sparkles, Settings, Megaphone, Share2, Coffee, TrendingUp, Clock } from "lucide-react";
import { Basketball, DiscordLogo } from "phosphor-react";
import { Index } from "./pages/index";
import CollegeFootball from "./pages/CollegeFootball";
import NFL from "./pages/NFL";
import NBA from "./pages/NBA";
import NCAAB from "./pages/NCAAB";
import NFLAnalytics from "./pages/NFLAnalytics";
import NFLTeaserSharpness from "./pages/NFLTeaserSharpness";
import WagerBotChat from "./pages/WagerBotChat";
import BetSlipGrader from "./pages/BetSlipGrader";
import NotFound from "./pages/NotFound";
import { Account } from "./pages";
import Landing from "./pages/Landing";
import Admin from "./pages/Admin";
import AISettings from "./pages/admin/AISettings";
import EditorsPicks from "./pages/EditorsPicks";
import Discord from "./pages/Discord";
import ScoreBoard from "./pages/ScoreBoard";
import MobileApp from "./pages/MobileApp";
import CommunityVoting from "./pages/CommunityVoting";
import TipJar from "./pages/TipJar";

export interface NavItem {
  title: string;
  to?: string;
  icon?: React.ReactNode;
  page?: React.ReactNode;
  requiresAdmin?: boolean;
  comingSoon?: boolean;
  wip?: boolean;
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
    title: "Today in Sports",
    to: "/today-in-sports",
    icon: <Newspaper className="h-4 w-4" />,
  },
  {
    title: "Editors Picks",
    to: "/editors-picks",
    icon: <Star className="h-4 w-4" />,
    page: <EditorsPicks />,
  },
  {
    title: "WagerBot Chat",
    to: "/wagerbot-chat",
    icon: <Bot className="h-4 w-4" />,
    page: <WagerBotChat />,
  },
  {
    title: "Score Board",
    to: "/scoreboard",
    icon: <Activity className="h-4 w-4" />,
    page: <ScoreBoard />,
  },
  {
    title: "SPORTS",
    isHeader: true,
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
    page: <NBA />,
    subItems: [
      {
        title: "Today's Betting Trends",
        to: "/nba/todays-betting-trends",
        icon: <TrendingUp className="h-4 w-4" />,
      },
      {
        title: "Halftime Trends",
        to: "/nba/halftime-trends",
        icon: <Clock className="h-4 w-4" />,
      },
    ],
  },
  {
    title: "College Basketball",
    to: "/ncaab",
    icon: <School className="h-4 w-4" />,
    page: <NCAAB />,
    subItems: [
      {
        title: "Today's Betting Trends",
        to: "/ncaab/todays-betting-trends",
        icon: <TrendingUp className="h-4 w-4" />,
      },
    ],
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
  },
  {
    title: "iOS/Android App",
    to: "/mobile-app",
    icon: <Smartphone className="h-4 w-4" />,
    page: <MobileApp />,
  },
  {
    title: "Bet Slip Grader",
    to: "/bet-slip-grader",
    icon: <FileImage className="h-4 w-4" />,
    page: <BetSlipGrader />,
  },
  {
    title: "Learn WagerProof",
    to: "/learn",
    icon: <GraduationCap className="h-4 w-4" />,
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
