import debug from '@/utils/debug';
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { supabase } from "@/integrations/supabase/client";
import { navItems } from "@/nav-items";
import { GradientText } from "@/components/ui/gradient-text";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { LogOut, Settings, User, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./ThemeToggle";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SettingsModal } from "./SettingsModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { adminModeEnabled } = useAdminMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);
  const [isLaunchMode, setIsLaunchMode] = useState(false);

  // Fetch launch mode setting
  useEffect(() => {
    async function fetchLaunchMode() {
      try {
        const { data, error } = await (supabase as any)
          .from('site_settings')
          .select('launch_mode')
          .single();
        
        if (error) {
          debug.error('Error fetching launch mode:', error);
          setIsLaunchMode(false);
        } else {
          setIsLaunchMode(data?.launch_mode || false);
        }
      } catch (err) {
        debug.error('Unexpected error fetching launch mode:', err);
        setIsLaunchMode(false);
      }
    }

    fetchLaunchMode();
  }, []);

  // Onboarding check is now handled by OnboardingGuard component

  // Filter nav items based on admin mode and exclude Home/Account from sidebar
  const visibleNavItems = navItems.filter(item => {
    // Exclude Home and Account from sidebar navigation
    if (item.to === '/home' || item.to === '/account') {
      return false;
    }
    // Filter admin-only items - only show when admin mode is enabled
    if (item.requiresAdmin) {
      return adminModeEnabled;
    }
    return true;
  });

  const isActivePath = (path: string) => {
    // Handle both /nfl/teaser-sharpness and /nfl-analytics patterns
    if (path === '/nfl') {
      return location.pathname === path || 
             location.pathname.startsWith(path + '/') || 
             location.pathname === '/nfl-analytics';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleSettingsClick = () => {
    if (!user) {
      setSignInPromptOpen(true);
    } else {
      setSettingsOpen(true);
    }
  };

  const handleSignIn = () => {
    setSignInPromptOpen(false);
    navigate('/account');
  };

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border bg-sidebar overflow-hidden">
      {/* Header Section */}
      <SidebarHeader className="border-b border-sidebar-border bg-sidebar px-4 py-4">
        <Link to="/home" className="flex items-center gap-2 group">
          <div className="flex items-center justify-center w-8 h-8">
            <img 
              src="/wagerproofGreenLight.png" 
              alt="Wagerproof Logo" 
              className="w-8 h-8 object-contain rounded-lg dark:hidden"
              onError={(e) => {
                // Fallback to letter W if icon fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <img 
              src="/wagerproofGreenDark.png" 
              alt="Wagerproof Logo" 
              className="w-8 h-8 object-contain rounded-lg hidden dark:block"
              onError={(e) => {
                // Fallback to letter W if icon fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="hidden items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-bold">W</span>
            </div>
          </div>
          <span className="text-base font-semibold">
            <span className="text-black dark:text-white">Wager</span>
            <GradientText 
              text="Proof" 
              gradient="linear-gradient(90deg, #22c55e 0%, #4ade80 20%, #16a34a 50%, #4ade80 80%, #22c55e 100%)"
              className="inline"
            />
          </span>
          {isLaunchMode && (
            <Badge variant="secondary" className="ml-2 text-xs bg-green-500/20 text-green-600 dark:text-green-400 border-green-300 dark:border-green-600">
              beta
            </Badge>
          )}
        </Link>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="px-2 py-2 bg-sidebar">
        <SidebarMenu>
          {visibleNavItems.map((item) => {
            const { to, title, icon, comingSoon, subItems } = item;
            
            // Coming Soon items
            if (comingSoon) {
              return (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    disabled
                    className="text-sm font-medium opacity-60 cursor-not-allowed"
                  >
                    {icon}
                    <span>{title}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Soon
                    </Badge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            // Items with sub-navigation
            if (subItems && subItems.length > 0) {
              return (
                <Collapsible key={to} defaultOpen={isActivePath(to)} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        asChild
                        isActive={isActivePath(to)}
                        className={`text-sm font-medium transition-all duration-200 rounded-md mr-2 ${
                          isActivePath(to) 
                            ? 'bg-gradient-to-r from-honeydew-200 to-honeydew-100 dark:from-honeydew-900/30 dark:to-honeydew-800/20 text-honeydew-800 dark:text-honeydew-300 border-r-2 border-honeydew-600 shadow-lg shadow-honeydew-500/20 dark:shadow-honeydew-500/10' 
                            : subItems?.some(subItem => isActivePath(subItem.to))
                              ? 'bg-gradient-to-r from-honeydew-100 to-honeydew-50 dark:from-honeydew-900/20 dark:to-honeydew-800/10 text-honeydew-700 dark:text-honeydew-400 border-r-2 border-honeydew-500 shadow-md shadow-honeydew-400/15 dark:shadow-honeydew-400/8'
                              : 'hover:bg-honeydew-100 dark:hover:bg-honeydew-900/10 hover:text-honeydew-700 dark:hover:text-honeydew-400'
                        }`}
                      >
                        <Link to={to}>
                          <span className={`transition-colors duration-200 ${
                            isActivePath(to) || subItems?.some(subItem => isActivePath(subItem.to)) ? 'text-honeydew-700 dark:text-honeydew-400' : ''
                          }`}>
                            {icon}
                          </span>
                          <span>{title}</span>
                          {(isActivePath(to) || subItems?.some(subItem => isActivePath(subItem.to))) && (
                            <div className="w-2 h-2 bg-honeydew-500 rounded-full animate-pulse shadow-sm shadow-honeydew-500/50 mr-2"></div>
                          )}
                          <ChevronRight className={`ml-auto h-4 w-4 transition-all duration-200 group-data-[state=open]/collapsible:rotate-90 ${
                            isActivePath(to) ? 'text-honeydew-700 dark:text-honeydew-400' : ''
                          }`} />
                        </Link>
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {subItems.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.to}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActivePath(subItem.to)}
                              className={`transition-all duration-200 rounded-md mr-2 ${
                                isActivePath(subItem.to) 
                                  ? 'bg-gradient-to-r from-honeydew-200 to-honeydew-100 dark:from-honeydew-900/30 dark:to-honeydew-800/20 text-honeydew-800 dark:text-honeydew-300 border-r-2 border-honeydew-600 shadow-lg shadow-honeydew-500/20 dark:shadow-honeydew-500/10' 
                                  : 'hover:bg-honeydew-100 dark:hover:bg-honeydew-900/10 hover:text-honeydew-700 dark:hover:text-honeydew-400'
                              }`}
                            >
                              <Link to={subItem.to}>
                                <span className={`transition-colors duration-200 ${
                                  isActivePath(subItem.to) ? 'text-honeydew-700 dark:text-honeydew-400' : ''
                                }`}>
                                  {subItem.icon}
                                </span>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            }

            // Regular items
            return (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton
                  asChild
                  isActive={isActivePath(to)}
                  className={`text-sm font-medium transition-all duration-200 rounded-md mr-2 ${
                    isActivePath(to) 
                      ? 'bg-gradient-to-r from-honeydew-200 to-honeydew-100 dark:from-honeydew-900/30 dark:to-honeydew-800/20 text-honeydew-800 dark:text-honeydew-300 border-r-2 border-honeydew-600 shadow-lg shadow-honeydew-500/20 dark:shadow-honeydew-500/10' 
                      : 'hover:bg-honeydew-100 dark:hover:bg-honeydew-900/10 hover:text-honeydew-700 dark:hover:text-honeydew-400'
                  }`}
                >
                  <Link to={to}>
                    <span className={`transition-colors duration-200 ${
                      isActivePath(to) ? 'text-honeydew-700 dark:text-honeydew-400' : ''
                    }`}>
                      {icon}
                    </span>
                    <span>{title}</span>
                    {isActivePath(to) && (
                      <div className="ml-auto w-2 h-2 bg-honeydew-500 rounded-full animate-pulse shadow-sm shadow-honeydew-500/50"></div>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer Section */}
      <SidebarFooter className="border-t border-sidebar-border bg-sidebar px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between px-2 py-1.5">
              <SidebarMenuButton 
                onClick={handleSettingsClick} 
                className="text-sm flex-1 cursor-pointer"
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </SidebarMenuButton>
              <ThemeToggle />
            </div>
          </SidebarMenuItem>

          {user && (
            <>
              <SidebarSeparator className="my-2 bg-sidebar-border" />
              <SidebarMenuItem>
                <div className="flex items-center justify-between px-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sidebar-accent text-sidebar-accent-foreground flex-shrink-0">
                      <User className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-sidebar-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      debug.log('Sidebar: Logout button clicked');
                      signOut();
                    }}
                    className="h-6 w-6 flex-shrink-0 hover:bg-sidebar-accent"
                    title="Sign out"
                  >
                    <LogOut className="h-3 w-3" />
                  </Button>
                </div>
              </SidebarMenuItem>
            </>
          )}
        </SidebarMenu>
      </SidebarFooter>
      
      {user && <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />}
      
      <AlertDialog open={signInPromptOpen} onOpenChange={setSignInPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex flex-col items-center justify-center p-4">
              <img
                src="/wagerproofGreenLight.png"
                alt="Wagerproof Logo"
                className="w-12 h-12 object-contain rounded-lg mb-2 dark:hidden"
              />
              <img
                src="/wagerproofGreenDark.png"
                alt="Wagerproof Logo"
                className="w-12 h-12 object-contain rounded-lg mb-2 hidden dark:block"
              />
            </div>
            <AlertDialogTitle>Sign In Required</AlertDialogTitle>
            <AlertDialogDescription>
              Please sign in to access your settings and manage your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setSignInPromptOpen(false)}>
              Cancel
            </Button>
            <AlertDialogAction asChild>
              <Button variant="outline" onClick={handleSignIn} className="bg-white text-foreground dark:bg-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600">
                Sign In
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}

