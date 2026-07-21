import { useLocation } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ChevronRight } from "lucide-react";
import { navItems } from "@/nav-items";

interface MinimalHeaderProps {
  rightContent?: React.ReactNode;
}

export function MinimalHeader({ rightContent }: MinimalHeaderProps) {
  const location = useLocation();

  // Find current page title from top-level nav items first.
  const currentNavItem = navItems.find(item =>
    location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  );
  // If not found, resolve against sub-items (e.g. "Todays Outliers" under Agents).
  const currentSubNavItem = currentNavItem
    ? null
    : navItems.flatMap((item) => item.subItems ?? []).find((subItem) =>
        location.pathname === subItem.to || location.pathname.startsWith(subItem.to + '/')
      );

  // Build breadcrumb path
  const getBreadcrumbs = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    
    if (pathSegments.length === 0 || location.pathname === '/') {
      return [{ label: 'NFL', path: '/' }];
    }

    // If we have a current nav item, use it as the main breadcrumb
    if (currentNavItem) {
      return [{ label: currentNavItem.title, path: currentNavItem.to, icon: currentNavItem.icon }];
    }
    if (currentSubNavItem) {
      return [{ label: currentSubNavItem.title, path: currentSubNavItem.to, icon: currentSubNavItem.icon }];
    }

    // Otherwise, build from path segments
    return pathSegments.map((segment, index) => ({
      label: segment.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' '),
      path: '/' + pathSegments.slice(0, index + 1).join('/'),
      icon: undefined,
    }));
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-inherit px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <SidebarTrigger className="hidden md:flex h-8 w-8" title="Toggle Sidebar (Ctrl+B)" />
        <div className="flex items-center gap-1.5 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.path} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {crumb.icon && (
                <span aria-hidden className="text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
                  {crumb.icon}
                </span>
              )}
              <span 
                className={
                  index === breadcrumbs.length - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }
              >
                {crumb.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {rightContent && (
        <div className="flex items-center gap-2">
          {rightContent}
        </div>
      )}
    </header>
  );
}
