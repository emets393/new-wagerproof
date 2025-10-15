import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Landing from "./pages/NewLanding";
import { GameAnalysis, Account, Welcome } from "./pages";
import CollegeFootball from "./pages/CollegeFootball";
import NFL from "./pages/NFL";
import NFLAnalytics from "./pages/NFLAnalytics";
import NFLTeaserSharpness from "./pages/NFLTeaserSharpness";
import WagerBotChat from "./pages/WagerBotChat";
import LearnWagerProof from "./pages/LearnWagerProof";
import Admin from "./pages/Admin";
import EditorsPicks from "./pages/EditorsPicks";
import AccessDenied from "./pages/AccessDenied";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminModeProvider } from "@/contexts/AdminModeContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppLayout } from "./components/AppLayout";
import { MinimalHeader } from "./components/MinimalHeader";
import { ThemeProvider } from "@/contexts/ThemeContext";

const queryClient = new QueryClient();

// Layout wrapper for authenticated pages
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppLayout />
      <SidebarInset>
        <MinimalHeader />
        <main className="flex flex-1 flex-col overflow-auto">
          <div className="w-full px-4 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>
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
  const isPublicRoute = ['/', '/welcome', '/home', '/access-denied'].includes(location.pathname);

  // Pages that should not have the layout (landing, welcome, access denied)
  if (isPublicRoute) {
    return (
      <PublicLayout>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/home" element={<Landing />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/access-denied" element={<AccessDenied />} />
        </Routes>
      </PublicLayout>
    );
  }

  // All other routes get the authenticated layout
  return (
    <AuthenticatedLayout>
      <Routes>
        <Route path="/account" element={<Account />} />
        <Route path="/game-analysis/:gameId" element={<ProtectedRoute><GameAnalysis /></ProtectedRoute>} />
        <Route path="/college-football" element={<ProtectedRoute><CollegeFootball /></ProtectedRoute>} />
        <Route path="/nfl" element={<ProtectedRoute><NFL /></ProtectedRoute>} />
        <Route path="/nfl-analytics" element={<ProtectedRoute><NFLAnalytics /></ProtectedRoute>} />
        <Route path="/nfl/teaser-sharpness" element={<ProtectedRoute><NFLTeaserSharpness /></ProtectedRoute>} />
        <Route path="/wagerbot-chat" element={<ProtectedRoute><WagerBotChat /></ProtectedRoute>} />
        <Route path="/learn" element={<ProtectedRoute><LearnWagerProof /></ProtectedRoute>} />
        <Route path="/editors-picks" element={<EditorsPicks />} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      </Routes>
    </AuthenticatedLayout>
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
            <AuthProvider>
              <AdminModeProvider>
                <AppRoutes />
              </AdminModeProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
