import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { navItems } from "./nav-items";
import { Index, SavedPatterns, GameAnalysis, Account, Welcome } from "./pages";
import CollegeFootball from "./pages/CollegeFootball";
import NFL from "./pages/NFL";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, User, LogOut } from "lucide-react";

const queryClient = new QueryClient();

function AppHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="w-full border-b bg-background px-4 py-2 mb-4 flex items-center justify-between">
      <div className="flex items-center">
        <Sheet>
          <SheetTrigger asChild>
            <button className="p-2 rounded hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Open navigation</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <nav className="flex flex-col gap-1 p-4">
              {navItems.map(({ to, title, icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-2 px-3 py-2 rounded hover:bg-accent transition-colors text-base font-medium"
                >
                  {icon}
                  <span>{title}</span>
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
        <span className="ml-4 text-lg font-bold">Wagerproof</span>
      </div>
      
      <div className="flex items-center gap-2">
        {user ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link to="/account">
              <User className="h-4 w-4 mr-2" />
              Sign In
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}

function AppWithHeader() {
  const location = useLocation();
  const showHeader = location.pathname !== '/welcome';
  
  return (
    <>
      {showHeader && <AppHeader />}
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/account" element={<Account />} />
        <Route path="/saved-patterns" element={<SavedPatterns />} />
        <Route path="/game-analysis/:gameId" element={<GameAnalysis />} />
        <Route path="/college-football" element={<CollegeFootball />} />
        <Route path="/nfl" element={<NFL />} />
        {navItems.map(({ to, page }) => (
          <Route key={to} path={to} element={page} />
        ))}
      </Routes>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppWithHeader />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
