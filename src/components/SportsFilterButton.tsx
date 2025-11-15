import { Filter, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useSportsFilter } from "@/hooks/useSportsFilter";
import { cn } from "@/lib/utils";

interface SportOption {
  key: string;
  label: string;
  icon?: string;
}

const SPORT_OPTIONS: SportOption[] = [
  { key: 'NFL', label: 'NFL', icon: '🏈' },
  { key: 'NCAAF', label: 'College Football', icon: '🏈' },
  { key: 'NBA', label: 'NBA', icon: '🏀' },
  { key: 'NCAAB', label: 'College Basketball', icon: '🏀' },
  { key: 'NHL', label: 'NHL', icon: '🏒' },
  { key: 'MLB', label: 'MLB', icon: '⚾' },
  { key: 'MLS', label: 'MLS', icon: '⚽' },
  { key: 'EPL', label: 'Premier League', icon: '⚽' },
];

export function SportsFilterButton() {
  const { 
    toggleSport, 
    enableAll, 
    disableAll, 
    isSportEnabled, 
    enabledCount, 
    totalCount,
    allEnabled 
  } = useSportsFilter();

  const hasActiveFilters = enabledCount < totalCount;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={hasActiveFilters ? "default" : "outline"}
          size="sm"
          className="flex items-center gap-2 relative"
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filter Sports</span>
          {hasActiveFilters && (
            <Badge 
              variant="secondary" 
              className="ml-1 h-5 px-1.5 text-xs"
            >
              {enabledCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Filter Sports</span>
          <Badge variant="outline" className="ml-2">
            {enabledCount}/{totalCount}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Quick Actions */}
        <div className="flex gap-1 px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              enableAll();
            }}
            className="flex-1 h-7 text-xs"
            disabled={allEnabled}
          >
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              disableAll();
            }}
            className="flex-1 h-7 text-xs"
          >
            None
          </Button>
        </div>
        
        <DropdownMenuSeparator />
        
        {/* Sport Checkboxes */}
        {SPORT_OPTIONS.map((sport) => {
          const isEnabled = isSportEnabled(sport.key);
          return (
            <DropdownMenuItem
              key={sport.key}
              onClick={(e) => {
                e.preventDefault();
                toggleSport(sport.key);
              }}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{sport.icon}</span>
                <span>{sport.label}</span>
              </div>
              <div
                className={cn(
                  "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                  isEnabled
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/50"
                )}
              >
                {isEnabled && <Check className="h-3 w-3" />}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

