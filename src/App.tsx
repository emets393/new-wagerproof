import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useParams, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { useEffect } from "react";
import { logMixpanelStatus } from "@/lib/mixpanel";
import Landing from "./pages/NewLanding";
import { GameAnalysis, Account, Welcome, Blog, BlogPost, PressKit } from "./pages";
import NBATodayBettingTrends from "./pages/NBATodayBettingTrends";
import NBATodayHalftimeTrends from "./pages/NBATodayHalftimeTrends";
import NBATodayEdgeAccuracy from "./pages/NBATodayEdgeAccuracy";
import MLBTodayBettingTrends from "./pages/MLBTodayBettingTrends";
import MLBDailyRegressionReport from "./pages/MLBDailyRegressionReport";
import F5Splits from "./pages/mlb/F5Splits";
import PitcherMatchups from "./pages/mlb/PitcherMatchups";
import PlayerPropsReport from "./pages/mlb/PlayerPropsReport";
import PlayerPropsPerformance from "./pages/mlb/PlayerPropsPerformance";
import NCAABTodayBettingTrends from "./pages/NCAABTodayBettingTrends";
import NCAABTodayHalftimeTrends from "./pages/NCAABTodayHalftimeTrends";
import NCAABTodayEdgeAccuracy from "./pages/NCAABTodayEdgeAccuracy";
import NFLAnalytics from "./pages/NFLAnalytics";
import NFLTeaserSharpness from "./pages/NFLTeaserSharpness";
import WagerBotChat from "./pages/WagerBotChat";
import BetSlipGrader from "./pages/BetSlipGrader";
import LearnWagerProof from "./pages/LearnWagerProof";
import Admin from "./pages/Admin";
import PaywallTest from "./pages/PaywallTest";
// import EditorsPicks from "./pages/EditorsPicks";
import Discord from "./pages/Discord";
import FeatureRequests from "./pages/FeatureRequests";
import CommunityVoting from "./pages/CommunityVoting";
import AccessDenied from "./pages/AccessDenied";
import AISettings from "./pages/admin/AISettings";
import TodayInSportsAdmin from "./pages/admin/TodayInSportsAdmin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import UserWinsAdmin from "./pages/admin/UserWinsAdmin";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import OnboardingPage from "./pages/OnboardingPage"; // Import the new page
import ShareWin from "./pages/ShareWin";
import ScoreBoard from "./pages/ScoreBoard";
import LiveScoreDiagnostics from "./pages/LiveScoreDiagnostics";
import PolymarketTest from "./pages/PolymarketTest";
import MobileApp from "./pages/MobileApp";
import TodayInSports from "./pages/TodayInSports";
import TipJar from "./pages/TipJar";
import FreePicks from "./pages/FreePicks";
import AgentLanding from "./pages/AgentLanding"; // New landing page for the Agent feature
import SupportCenter from "./pages/support/SupportCenter";
import SupportCollection from "./pages/support/SupportCollection";
import SupportArticle from "./pages/support/SupportArticle";
import Agents from "./pages/Agents";
import GamesPage from "./features/games/GamesPage";
import AgentCreate from "./pages/AgentCreate";
import AgentSettings from "./pages/AgentSettings";
import { AuthProvider } from "@/contexts/AuthContext";
import { RevenueCatProvider } from "@/contexts/RevenueCatContext";
import { AdminModeProvider } from "@/contexts/AdminModeContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { OnboardingGuard } from "./components/OnboardingGuard";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppLayout } from "./components/AppLayout";
import { MinimalHeader } from "./components/MinimalHeader";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LiveScoreTicker } from "./components/LiveScoreTicker";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";

// Feature access toggles: keep code in place while hiding features.
const ENABLE_COMMUNITY_PICKS = false;
const ENABLE_BET_SLIP_GRADER = false;

// Configure React Query with optimized caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes (previously cacheTime)
      refetchOnWindowFocus: false, // Don't refetch on window focus (reduces unnecessary calls)
      retry: 1, // Only retry failed queries once
    },
  },
});

// Component to scroll to top on landing page
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Disable browser scroll restoration
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // Only scroll to top for landing page
    if (pathname === '/' || pathname === '/home') {
      // Use a small delay to ensure it overrides any async scroll events
      const timeoutId = setTimeout(() => {
        window.scrollTo(0, 0);
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [pathname]);

  return null;
}

// Component to check Mixpanel initialization status
function MixpanelStatusCheck() {
  useEffect(() => {
    // Check immediately on mount
    logMixpanelStatus();

    // Also check after a delay to see if the real library loads
    const timeoutId = setTimeout(() => {
      logMixpanelStatus();
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, []);

  return null;
}

// Routes that manage their own full-height split-view layout (no page padding,
// panels scroll internally instead of the main scroller).
const SPLIT_VIEW_ROUTES = ['/games', '/agents'];

// Legacy /agents/:id and /agents/public/:id deep links land in the split view.
function LegacyAgentRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/agents?selected=${encodeURIComponent(id ?? '')}`} replace />;
}

// Legacy per-sport list pages collapsed into the unified /games split view.
function LegacySportRedirect({ sport }: { sport: string }) {
  return <Navigate to={`/games?sport=${sport}`} replace />;
}

// Layout wrapper for authenticated pages
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isSplitView = SPLIT_VIEW_ROUTES.includes(location.pathname);

  return (
    <SidebarProvider defaultOpen={true} className="h-svh overflow-hidden">
      <AppLayout />
      <SidebarInset className="overflow-x-hidden dark:bg-black">
        {/* h-full only resolves against a genuinely fixed-height ancestor — that's
            why SidebarProvider above is pinned to h-svh + overflow-hidden instead of
            its default min-h-svh (which lets the whole page grow with content). With
            a real fixed height, this card scrolls internally in <main> below instead
            of the whole page growing, so the recessed margin/rounding stays in view. */}
        <div className="flex h-full flex-col overflow-x-hidden">
          <LiveScoreTicker />
          <MinimalHeader />
          <main
            id={isSplitView ? undefined : "app-scroll-container"}
            className={isSplitView ? "flex min-h-0 flex-1 flex-col" : "flex min-h-0 flex-1 flex-col overflow-auto"}
          >
            {isSplitView ? (
              children
            ) : (
              <div className="w-full px-4 py-6 md:px-8 md:py-8">
                {children}
              </div>
            )}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// Layout wrapper for public pages (no sidebar/header)
function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();
  
  // Determine if current route should use authenticated layout
  const isPublicRoute = [
    '/',
    '/welcome',
    '/home',
    '/privacy-policy',
    '/terms-and-conditions',
    '/press-kit',
    '/onboarding', // Add onboarding to public routes to avoid nested layouts
    '/paywall-test', // Add paywall test to public routes
    '/free-picks', // Free picks landing page - public access
    '/ai-agents', // New separate landing page for the AI Agent feature
  ].includes(location.pathname) || location.pathname.startsWith('/blog') || location.pathname.startsWith('/support');

  // Pages that should not have the layout (landing, welcome)
  if (isPublicRoute) {
    return (
      <PublicLayout>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/home" element={<Landing />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/press-kit" element={<PressKit />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/paywall-test" element={<ProtectedRoute><PaywallTest /></ProtectedRoute>} />
          <Route path="/free-picks" element={<FreePicks />} />
          <Route path="/ai-agents" element={<AgentLanding />} />
          <Route path="/support" element={<SupportCenter />} />
          <Route path="/support/:collectionSlug" element={<SupportCollection />} />
          <Route path="/support/:collectionSlug/:articleSlug" element={<SupportArticle />} />
        </Routes>
      </PublicLayout>
    );
  }

  // All other routes get the authenticated layout with onboarding guard
  return (
    <OnboardingGuard>
      <AuthenticatedLayout>
        <Routes>
          <Route path="/account" element={<Account />} />
          <Route path="/access-denied" element={<AccessDenied />} />
          <Route path="/game-analysis/:gameId" element={<ProtectedRoute><GameAnalysis /></ProtectedRoute>} />
          <Route path="/games" element={<ProtectedRoute allowFreemium={true}><GamesPage /></ProtectedRoute>} />
          <Route path="/college-football" element={<LegacySportRedirect sport="cfb" />} />
          <Route path="/nfl" element={<LegacySportRedirect sport="nfl" />} />
          <Route path="/nba" element={<LegacySportRedirect sport="nba" />} />
          <Route path="/nba/todays-betting-trends" element={<ProtectedRoute allowFreemium={true}><NBATodayBettingTrends /></ProtectedRoute>} />
          <Route path="/nba/halftime-trends" element={<ProtectedRoute allowFreemium={true}><NBATodayHalftimeTrends /></ProtectedRoute>} />
          <Route path="/nba/todays-predictions" element={<ProtectedRoute allowFreemium={true}><NBATodayEdgeAccuracy /></ProtectedRoute>} />
          <Route path="/ncaab" element={<LegacySportRedirect sport="ncaab" />} />
          <Route path="/mlb" element={<LegacySportRedirect sport="mlb" />} />
          <Route path="/mlb/todays-betting-trends" element={<ProtectedRoute allowFreemium={true}><MLBTodayBettingTrends /></ProtectedRoute>} />
          <Route path="/mlb/daily-regression-report" element={<ProtectedRoute><MLBDailyRegressionReport /></ProtectedRoute>} />
          <Route path="/mlb/f5-splits" element={<ProtectedRoute allowFreemium={true}><F5Splits /></ProtectedRoute>} />
          <Route path="/mlb/pitcher-matchups" element={<ProtectedRoute allowFreemium={true}><PitcherMatchups /></ProtectedRoute>} />
          <Route path="/mlb/picks-report" element={<ProtectedRoute allowFreemium={true}><PlayerPropsReport /></ProtectedRoute>} />
          <Route path="/mlb/picks-performance" element={<ProtectedRoute allowFreemium={true}><PlayerPropsPerformance /></ProtectedRoute>} />
          <Route path="/ncaab/todays-betting-trends" element={<ProtectedRoute allowFreemium={true}><NCAABTodayBettingTrends /></ProtectedRoute>} />
          <Route path="/ncaab/halftime-trends" element={<ProtectedRoute allowFreemium={true}><NCAABTodayHalftimeTrends /></ProtectedRoute>} />
          <Route path="/ncaab/todays-predictions" element={<ProtectedRoute allowFreemium={true}><NCAABTodayEdgeAccuracy /></ProtectedRoute>} />
          <Route path="/nfl-analytics" element={<ProtectedRoute><NFLAnalytics /></ProtectedRoute>} />
          <Route path="/nfl/teaser-sharpness" element={<ProtectedRoute><NFLTeaserSharpness /></ProtectedRoute>} />
          <Route path="/wagerbot-chat" element={<ProtectedRoute><WagerBotChat /></ProtectedRoute>} />
          <Route path="/scoreboard" element={<ProtectedRoute><ScoreBoard /></ProtectedRoute>} />
          <Route path="/scoreboard/diagnostics" element={<ProtectedRoute><LiveScoreDiagnostics /></ProtectedRoute>} />
          <Route path="/today-in-sports" element={<ProtectedRoute allowFreemium={true}><TodayInSports /></ProtectedRoute>} />
          <Route
            path="/bet-slip-grader"
            element={
              <ProtectedRoute>
                {ENABLE_BET_SLIP_GRADER ? <BetSlipGrader /> : <AccessDenied />}
              </ProtectedRoute>
            }
          />
          <Route path="/share-win" element={<ProtectedRoute><ShareWin /></ProtectedRoute>} />
          <Route path="/tip-jar" element={<ProtectedRoute><TipJar /></ProtectedRoute>} />
          <Route path="/learn" element={<ProtectedRoute><LearnWagerProof /></ProtectedRoute>} />
          <Route path="/agents" element={<ProtectedRoute><Agents /></ProtectedRoute>} />
          <Route path="/agents/create" element={<ProtectedRoute><AgentCreate /></ProtectedRoute>} />
          <Route path="/agents/public/:id" element={<LegacyAgentRedirect />} />
          <Route path="/agents/:id" element={<LegacyAgentRedirect />} />
          <Route path="/agents/:id/settings" element={<ProtectedRoute><AgentSettings /></ProtectedRoute>} />
          {/* <Route path="/editors-picks" element={<ProtectedRoute><EditorsPicks /></ProtectedRoute>} /> */}
          <Route
            path="/community-voting"
            element={
              <ProtectedRoute>
                {ENABLE_COMMUNITY_PICKS ? <CommunityVoting /> : <AccessDenied />}
              </ProtectedRoute>
            }
          />
          <Route path="/discord" element={<ProtectedRoute><Discord /></ProtectedRoute>} />
          <Route path="/feature-requests" element={<ProtectedRoute><FeatureRequests /></ProtectedRoute>} />
          <Route path="/mobile-app" element={<MobileApp />} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
          <Route path="/admin/user-wins" element={<ProtectedRoute><UserWinsAdmin /></ProtectedRoute>} />
          <Route path="/admin/announcements" element={<ProtectedRoute><AdminAnnouncements /></ProtectedRoute>} />
          <Route path="/admin/ai-settings" element={<ProtectedRoute><AISettings /></ProtectedRoute>} />
          <Route path="/admin/today-in-sports" element={<ProtectedRoute><TodayInSportsAdmin /></ProtectedRoute>} />
          <Route path="/polymarket-test" element={<PolymarketTest />} />
        </Routes>
      </AuthenticatedLayout>
    </OnboardingGuard>
  );
}

const App = () => (
  <GlobalErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <MixpanelStatusCheck />
              <AuthProvider>
                <RevenueCatProvider>
                  <AdminModeProvider>
                    <AppRoutes />
                  </AdminModeProvider>
                </RevenueCatProvider>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </GlobalErrorBoundary>
);

export default App;
