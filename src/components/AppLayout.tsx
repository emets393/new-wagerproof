import debug from '@/utils/debug';
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { useRevenueCatWeb } from "@/hooks/useRevenueCatWeb";
import { supabase } from "@/integrations/supabase/client";
import { navItems } from "@/nav-items";
import { isSportInSeason, sportSeasonStartsLabel } from "@/features/games/sportSeasons";
import type { GamesSport } from "@/features/games/types";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { LogOut, Settings, ChevronRight, ChevronLeft } from "lucide-react";
import { AppleLogo, GooglePlayLogo } from "phosphor-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./ThemeToggle";
import {
  SidebarCollapsibleNavItem,
  SidebarNavButton,
} from "@/components/layout/SidebarNavItem";
import { UserAvatar } from "@/components/layout/UserAvatar";
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

/** Section titles live as "ANALYSIS"/"SPORTS" in nav-items; render them as "Analysis". */
function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

const SIDEBAR_SPORT_ROUTES: Record<string, GamesSport> = {
  '/games?sport=nfl': 'nfl',
  '/games?sport=cfb': 'cfb',
  '/games?sport=nba': 'nba',
  '/games?sport=ncaab': 'ncaab',
  '/games?sport=mlb': 'mlb',
};

const APP_STORE_URL = 'https://apps.apple.com/us/app/wagerproof-sports-picks-ai/id6757089957';
const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.wagerproof.mobile';

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { adminModeEnabled } = useAdminMode();
  const { hasProAccess } = useRevenueCatWeb();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, toggleSidebar } = useSidebar();
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
  const visibleNavItems = useMemo(() => {
    const filtered = navItems.filter(item => {
      // Exclude Home and Account from sidebar navigation
      if (item.to === '/home' || item.to === '/account') return false;
      // Keep features in code but hide from sidebar access.
      if (item.hidden) return false;
      // Filter admin-only items - only show when admin mode is enabled
      if (item.requiresAdmin) return adminModeEnabled;
      return true;
    });

    const sportsHeaderIndex = filtered.findIndex((item) => item.isHeader && item.title === 'SPORTS');
    if (sportsHeaderIndex < 0) return filtered;
    const nextHeaderOffset = filtered.slice(sportsHeaderIndex + 1).findIndex((item) => item.isHeader);
    const sportsEndIndex = nextHeaderOffset < 0 ? filtered.length : sportsHeaderIndex + 1 + nextHeaderOffset;
    const sportsItems = filtered.slice(sportsHeaderIndex + 1, sportsEndIndex);

    const seasonAwareSports = sportsItems
      .map((item, originalIndex) => {
        const sport = item.to ? SIDEBAR_SPORT_ROUTES[item.to] : undefined;
        const inSeason = sport ? isSportInSeason(sport) : false;
        return {
          item: sport && !inSeason
            ? { ...item, status: sportSeasonStartsLabel(sport) }
            : item,
          inSeason,
          originalIndex,
        };
      })
      .sort((a, b) => Number(b.inSeason) - Number(a.inSeason) || a.originalIndex - b.originalIndex)
      .map(({ item }) => item);

    return [
      ...filtered.slice(0, sportsHeaderIndex + 1),
      ...seasonAwareSports,
      ...filtered.slice(sportsEndIndex),
    ];
  }, [adminModeEnabled]);

  const isActivePath = (to: string) => {
    const [path, query] = to.split('?');
    // Sport-filtered links (e.g. /games?sport=nfl) are only "active" when the
    // current URL's sport param matches — plain pathname matching would treat
    // every /games view as every sport's link being active.
    if (query) {
      const toParams = new URLSearchParams(query);
      // Keep MLB section highlighted on its Historical Analytics tool page.
      if (toParams.get('sport') === 'mlb' &&
          (location.pathname === '/mlb-analytics' || location.pathname.startsWith('/mlb/'))) {
        return true;
      }
      if (location.pathname !== path) return false;
      const currentParams = new URLSearchParams(location.search);
      for (const [key, value] of toParams.entries()) {
        if (currentParams.get(key) !== value) return false;
      }
      return true;
    }
    // /nfl nav item is also active on the /nfl-analytics tool page
    if (path === '/nfl') {
      return location.pathname === path ||
             location.pathname.startsWith(path + '/') ||
             location.pathname === '/nfl-analytics';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Exactly one row may own the active state — the sliding pill is a single
  // shared element, and two mounted copies would animate against each other.
  // Ties go to the most specific path so a tool sub-page (/mlb/f5-splits) wins
  // over the section that also prefix-matches it (/mlb).
  const activeKey = useMemo(() => {
    const candidates: { key: string; to: string }[] = [];
    for (const item of visibleNavItems) {
      if (item.isHeader || item.comingSoon) continue;
      if (item.to && isActivePath(item.to)) {
        candidates.push({ key: `item:${item.to}`, to: item.to });
      }
      for (const sub of item.subItems ?? []) {
        if (isActivePath(sub.to)) candidates.push({ key: `sub:${sub.to}`, to: sub.to });
      }
    }
    candidates.sort((a, b) => b.to.length - a.to.length);
    return candidates[0]?.key ?? null;
    // isActivePath closes over `location`, so the path/search pair is the real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNavItems, location.pathname, location.search]);

  const handleSettingsClick = () => {
    if (!user) {
      setSignInPromptOpen(true);
    } else {
      setSettingsOpen(true);
    }
  };

  const handleNavItemClick = (to: string) => {
    if (!user) {
      setSignInPromptOpen(true);
    } else {
      navigate(to);
    }
  };

  const handleSignIn = () => {
    setSignInPromptOpen(false);
    navigate('/account');
  };

  return (
    <Sidebar collapsible="icon" variant="inset" className="bg-sidebar overflow-hidden">
      {/* Header Section */}
      {/* Collapsed, horizontal padding is zeroed everywhere: the rail's content
          box is only ~50px, so px-2 would leave a 32px icon just 1px of slack on
          each side. Centering is handled per-row instead (justify-center/mx-auto),
          which keeps the logo, nav icons, and footer icons on one vertical axis. */}
      <SidebarHeader className="border-b border-sidebar-border bg-sidebar px-2 py-3 group-data-[collapsible=icon]:px-0">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
          <Link
            to="/home"
            className="group flex min-w-0 flex-1 items-center gap-2 group-data-[collapsible=icon]:flex-none"
          >
            <div className="flex items-center justify-center w-8 h-8 flex-shrink-0">
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
            <div className="flex items-center gap-2 min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="text-base font-semibold truncate">
                <span className="text-black dark:text-white">Wager</span>
                <GradientText 
                  text="Proof" 
                  gradient="linear-gradient(90deg, #22c55e 0%, #4ade80 20%, #16a34a 50%, #4ade80 80%, #22c55e 100%)"
                  className="inline"
                />
              </span>
              {hasProAccess && (
                <Badge variant="secondary" className="text-xs bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-600 font-bold flex-shrink-0">
                  PRO
                </Badge>
              )}
              {isLaunchMode && (
                <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 border-green-300 dark:border-green-600 flex-shrink-0">
                  beta
                </Badge>
              )}
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            // No room for it beside the logo on the icon rail — MinimalHeader's
            // SidebarTrigger (and Ctrl+B) still expand from the collapsed state.
            className="hidden h-8 w-8 flex-shrink-0 md:flex group-data-[collapsible=icon]:!hidden"
            title={state === "expanded" ? "Minimize Sidebar (Ctrl+B)" : "Expand Sidebar (Ctrl+B)"}
          >
            {state === "expanded" ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="bg-sidebar py-1 pl-1 pr-0 group-data-[collapsible=icon]:px-0">
        {/* gap-0.5 over the shadcn gap-1 — rows read as one list, not stacked chips. */}
        <SidebarMenu className="gap-0.5">
          {visibleNavItems.map((item, index) => {
            const { to, title, icon, comingSoon, wip, status, subItems, isHeader } = item;
            
            // Section Headers
            if (isHeader) {
              return (
                // Sentence case, not uppercase+tracking — a quiet label above the
                // group rather than a second thing competing with the row titles.
                <div key={`header-${title}-${index}`} className="mb-0.5 mt-3 px-2 first:mt-0">
                  <span className="text-[10px] font-medium text-muted-foreground/80 group-data-[collapsible=icon]:hidden">
                    {sentenceCase(title)}
                  </span>
                </div>
              );
            }
            
            // Coming Soon items
            if (comingSoon) {
              return (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    disabled
                    className="cursor-not-allowed text-sm font-medium text-muted-foreground opacity-60"
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
              const activeSub = subItems.find((s) => activeKey === `sub:${s.to}`);
              return (
                <SidebarCollapsibleNavItem
                  key={to ?? title}
                  to={to}
                  title={title}
                  status={status}
                  icon={icon}
                  wip={wip}
                  active={Boolean(to) && activeKey === `item:${to}`}
                  activeSubTo={activeSub?.to ?? null}
                  subItems={subItems}
                  onNavigate={handleNavItemClick}
                />
              );
            }

            // Regular items
            return (
              <SidebarMenuItem key={to}>
                <SidebarNavButton
                  title={title}
                  status={status}
                  icon={icon}
                  wip={wip}
                  active={Boolean(to) && activeKey === `item:${to}`}
                  onClick={() => to && handleNavItemClick(to)}
                  className="mr-0.5"
                />
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer Section */}
      <SidebarFooter className="border-t border-sidebar-border bg-sidebar px-1 py-2 group-data-[collapsible=icon]:px-0">
        <SidebarMenu>
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <div className="grid grid-cols-2 gap-1.5 px-1 pb-2">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download WagerProof on the App Store"
                className="flex min-w-0 items-center gap-1.5 rounded-lg border border-sidebar-border bg-sidebar-accent/45 px-2 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <AppleLogo size={18} weight="fill" className="shrink-0" />
                <span className="min-w-0 text-left leading-none">
                  <span className="block whitespace-nowrap text-[8px] font-medium text-sidebar-foreground/65">Download on</span>
                  <span className="mt-1 block whitespace-nowrap text-[11px] font-semibold">App Store</span>
                </span>
              </a>
              <a
                href={GOOGLE_PLAY_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Get WagerProof on Google Play"
                className="flex min-w-0 items-center gap-1.5 rounded-lg border border-sidebar-border bg-sidebar-accent/45 px-2 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <GooglePlayLogo size={18} weight="fill" className="shrink-0" />
                <span className="min-w-0 text-left leading-none">
                  <span className="block whitespace-nowrap text-[8px] font-medium text-sidebar-foreground/65">Get it on</span>
                  <span className="mt-1 block whitespace-nowrap text-[11px] font-semibold">Google Play</span>
                </span>
              </a>
            </div>
          </SidebarMenuItem>

          <SidebarMenuItem className="hidden flex-col items-center gap-1 group-data-[collapsible=icon]:flex">
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Download WagerProof on the App Store"
              title="Download on the App Store"
              className="grid h-8 w-8 place-items-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <AppleLogo size={17} weight="fill" />
            </a>
            <a
              href={GOOGLE_PLAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Get WagerProof on Google Play"
              title="Get it on Google Play"
              className="grid h-8 w-8 place-items-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <GooglePlayLogo size={17} weight="fill" />
            </a>
          </SidebarMenuItem>

          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <div className="flex items-center justify-between px-1 py-1">
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

          {/* Theme toggle - visible when minimized */}
          <SidebarMenuItem className="hidden group-data-[collapsible=icon]:flex justify-center">
            <ThemeToggle />
          </SidebarMenuItem>

          {user && (
            <>
              <SidebarSeparator className="my-2 bg-sidebar-border group-data-[collapsible=icon]:hidden" />
              <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
                <div className="flex items-center justify-between px-1 py-1">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <UserAvatar email={user.email ?? ''} size={24} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-sidebar-foreground">
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
              
              {/* Logout button - visible when minimized */}
              <SidebarMenuItem className="hidden group-data-[collapsible=icon]:flex justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    debug.log('Sidebar: Logout button clicked');
                    signOut();
                  }}
                  className="h-8 w-8 hover:bg-sidebar-accent"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
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
