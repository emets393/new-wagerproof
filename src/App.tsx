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
import NFLAnalytics from "./pages/NFLAnalytics";
import NFLTeaserSharpness from "./pages/NFLTeaserSharpness";
import WagerBotChat from "./pages/WagerBotChat";
import BetSlipGrader from "./pages/BetSlipGrader";
import LearnWagerProof from "./pages/LearnWagerProof";
import Admin from "./pages/Admin";
import PaywallTest from "./pages/PaywallTest";
import EditorsPicks from "./pages/EditorsPicks";
import Discord from "./pages/Discord";
import FeatureRequests from "./pages/FeatureRequests";
import AccessDenied from "./pages/AccessDenied";
import AISettings from "./pages/admin/AISettings";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";
import OnboardingPage from "./pages/OnboardingPage"; // Import the new page
import ScoreBoard from "./pages/ScoreBoard";
import PolymarketTest from "./pages/PolymarketTest";
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

const queryClient = new QueryClient();

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
          <Route path="/nfl-analytics" element={<ProtectedRoute><NFLAnalytics /></ProtectedRoute>} />
          <Route path="/nfl/teaser-sharpness" element={<ProtectedRoute><NFLTeaserSharpness /></ProtectedRoute>} />
          <Route path="/wagerbot-chat" element={<ProtectedRoute><WagerBotChat /></ProtectedRoute>} />
          <Route path="/scoreboard" element={<ProtectedRoute><ScoreBoard /></ProtectedRoute>} />
          <Route path="/bet-slip-grader" element={<ProtectedRoute><BetSlipGrader /></ProtectedRoute>} />
          <Route path="/learn" element={<ProtectedRoute><LearnWagerProof /></ProtectedRoute>} />
          <Route path="/editors-picks" element={<ProtectedRoute><EditorsPicks /></ProtectedRoute>} />
          <Route path="/discord" element={<ProtectedRoute><Discord /></ProtectedRoute>} />
          <Route path="/feature-requests" element={<ProtectedRoute><FeatureRequests /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="/admin/ai-settings" element={<ProtectedRoute><AISettings /></ProtectedRoute>} />
          <Route path="/polymarket-test" element={<PolymarketTest />} />
        </Routes>
      </AuthenticatedLayout>
    </OnboardingGuard>
  );
}

const App = () => (
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
);

export default App;
