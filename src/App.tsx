import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { navItems } from "./nav-items";
import Index from "./pages/Index";
import SavedPatterns from "./pages/SavedPatterns";
import GameAnalysis from "./pages/GameAnalysis";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* Hamburger menu and sidebar navigation */}
        <header className="w-full border-b bg-background px-4 py-2 mb-4 flex items-center">
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
          {/* Optionally, add your app name/logo here */}
          <span className="ml-4 text-lg font-bold">Wagerproof</span>
        </header>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/saved-patterns" element={<SavedPatterns />} />
          <Route path="/game-analysis/:gameId" element={<GameAnalysis />} />
          {navItems.map(({ to, page }) => (
            <Route key={to} path={to} element={page} />
          ))}
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
