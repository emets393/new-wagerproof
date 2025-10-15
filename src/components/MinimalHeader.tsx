import { useLocation } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ChevronRight } from "lucide-react";
import { navItems } from "@/nav-items";

interface MinimalHeaderProps {
  rightContent?: React.ReactNode;
}

export function MinimalHeader({ rightContent }: MinimalHeaderProps) {
  const location = useLocation();

  // Find the current page title from navItems
  const currentNavItem = navItems.find(item => 
    location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  );

  // Build breadcrumb path
  const getBreadcrumbs = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    
    if (pathSegments.length === 0 || location.pathname === '/') {
      return [{ label: 'NFL', path: '/' }];
    }

    // If we have a current nav item, use it as the main breadcrumb
    if (currentNavItem) {
      return [{ label: currentNavItem.title, path: currentNavItem.to }];
    }

    // Otherwise, build from path segments
    return pathSegments.map((segment, index) => ({
      label: segment.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' '),
      path: '/' + pathSegments.slice(0, index + 1).join('/')
    }));
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <div className="flex items-center gap-1.5 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.path} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
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

