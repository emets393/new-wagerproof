import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
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
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);

  // Filter nav items based on admin status and exclude Home/Account from sidebar
  const visibleNavItems = navItems.filter(item => {
    // Exclude Home and Account from sidebar navigation
    if (item.to === '/home' || item.to === '/account') {
      return false;
    }
    // Filter admin-only items
    if (item.requiresAdmin) {
      return isAdmin;
    }
    return true;
  });

  const isActivePath = (path: string) => {
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
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
      {/* Header Section */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link to="/home" className="flex items-center gap-2 group">
          <div className="flex items-center justify-center w-8 h-8">
            <img 
              src="/wagerproof-logo-main.png" 
              alt="Wagerproof Logo" 
              className="w-8 h-8 object-contain rounded-lg"
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
        </Link>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="px-2 py-2">
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
                        className="text-sm font-medium"
                      >
                        <Link to={to}>
                          {icon}
                          <span>{title}</span>
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
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
                            >
                              <Link to={subItem.to}>
                                {subItem.icon}
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
                  className="text-sm font-medium"
                >
                  <Link to={to}>
                    {icon}
                    <span>{title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer Section */}
      <SidebarFooter className="border-t border-sidebar-border px-2 py-3">
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
              <SidebarSeparator className="my-2" />
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
                      console.log('Sidebar: Logout button clicked');
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
            <AlertDialogTitle>Sign In Required</AlertDialogTitle>
            <AlertDialogDescription>
              Please sign in to access your settings and manage your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setSignInPromptOpen(false)}>
              Cancel
            </Button>
            <AlertDialogAction onClick={handleSignIn}>
              Sign In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}

