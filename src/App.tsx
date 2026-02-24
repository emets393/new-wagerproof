import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { useEffect } from "react";
import { logMixpanelStatus } from "@/lib/mixpanel";
import Landing from "./pages/NewLanding";
import { GameAnalysis, Account, Welcome, Blog, BlogPost, PressKit } from "./pages";
import CollegeFootball from "./pages/CollegeFootball";
import NFL from "./pages/NFL";
import NBA from "./pages/NBA";
import NBATodayBettingTrends from "./pages/NBATodayBettingTrends";
import NBATodayHalftimeTrends from "./pages/NBATodayHalftimeTrends";
import NBATodayEdgeAccuracy from "./pages/NBATodayEdgeAccuracy";
import NCAAB from "./pages/NCAAB";
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
import Agents from "./pages/Agents";
import AgentCreate from "./pages/AgentCreate";
import AgentDetail from "./pages/AgentDetail";
import AgentSettings from "./pages/AgentSettings";
import PublicAgentDetail from "./pages/PublicAgentDetail";
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
import { AnnouncementsBanner } from "./components/AnnouncementsBanner";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";

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

// Layout wrapper for authenticated pages
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppLayout />
      <SidebarInset className="overflow-x-hidden">
        <div className="overflow-x-hidden w-full">
          <AnnouncementsBanner />
          <LiveScoreTicker />
          <MinimalHeader />
          <main className="flex flex-1 flex-col overflow-auto">
            <div className="w-full px-4 py-6 md:px-8 md:py-8">
              {children}
            </div>
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
  ].includes(location.pathname) || location.pathname.startsWith('/blog');

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
          <Route path="/college-football" element={<ProtectedRoute allowFreemium={true}><CollegeFootball /></ProtectedRoute>} />
          <Route path="/nfl" element={<ProtectedRoute allowFreemium={true}><NFL /></ProtectedRoute>} />
          <Route path="/nba" element={<ProtectedRoute allowFreemium={true}><NBA /></ProtectedRoute>} />
          <Route path="/nba/todays-betting-trends" element={<ProtectedRoute allowFreemium={true}><NBATodayBettingTrends /></ProtectedRoute>} />
          <Route path="/nba/halftime-trends" element={<ProtectedRoute allowFreemium={true}><NBATodayHalftimeTrends /></ProtectedRoute>} />
          <Route path="/nba/todays-predictions" element={<ProtectedRoute allowFreemium={true}><NBATodayEdgeAccuracy /></ProtectedRoute>} />
          <Route path="/ncaab" element={<ProtectedRoute allowFreemium={true}><NCAAB /></ProtectedRoute>} />
          <Route path="/ncaab/todays-betting-trends" element={<ProtectedRoute allowFreemium={true}><NCAABTodayBettingTrends /></ProtectedRoute>} />
          <Route path="/ncaab/halftime-trends" element={<ProtectedRoute allowFreemium={true}><NCAABTodayHalftimeTrends /></ProtectedRoute>} />
          <Route path="/ncaab/todays-predictions" element={<ProtectedRoute allowFreemium={true}><NCAABTodayEdgeAccuracy /></ProtectedRoute>} />
          <Route path="/nfl-analytics" element={<ProtectedRoute><NFLAnalytics /></ProtectedRoute>} />
          <Route path="/nfl/teaser-sharpness" element={<ProtectedRoute><NFLTeaserSharpness /></ProtectedRoute>} />
          <Route path="/wagerbot-chat" element={<ProtectedRoute><WagerBotChat /></ProtectedRoute>} />
          <Route path="/scoreboard" element={<ProtectedRoute><ScoreBoard /></ProtectedRoute>} />
          <Route path="/scoreboard/diagnostics" element={<ProtectedRoute><LiveScoreDiagnostics /></ProtectedRoute>} />
          <Route path="/today-in-sports" element={<ProtectedRoute allowFreemium={true}><TodayInSports /></ProtectedRoute>} />
          <Route path="/bet-slip-grader" element={<ProtectedRoute><BetSlipGrader /></ProtectedRoute>} />
          <Route path="/share-win" element={<ProtectedRoute><ShareWin /></ProtectedRoute>} />
          <Route path="/tip-jar" element={<ProtectedRoute><TipJar /></ProtectedRoute>} />
          <Route path="/learn" element={<ProtectedRoute><LearnWagerProof /></ProtectedRoute>} />
          <Route path="/agents" element={<ProtectedRoute><Agents /></ProtectedRoute>} />
          <Route path="/agents/create" element={<ProtectedRoute><AgentCreate /></ProtectedRoute>} />
          <Route path="/agents/public/:id" element={<ProtectedRoute><PublicAgentDetail /></ProtectedRoute>} />
          <Route path="/agents/:id" element={<ProtectedRoute><AgentDetail /></ProtectedRoute>} />
          <Route path="/agents/:id/settings" element={<ProtectedRoute><AgentSettings /></ProtectedRoute>} />
          {/* <Route path="/editors-picks" element={<ProtectedRoute><EditorsPicks /></ProtectedRoute>} /> */}
          <Route path="/community-voting" element={<ProtectedRoute><CommunityVoting /></ProtectedRoute>} />
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
