/**
 * SportsbookButtons component
 * Displays top 5 sportsbooks as buttons and additional sportsbooks in a dropdown
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import { TOP_SPORTSBOOKS, ADDITIONAL_SPORTSBOOKS, type Sportsbook } from '@/utils/sportsbookConfig';
import { fetchOdds, findMatchingEvent, getSportKey, getAllFreeUSBookmakers } from '@/services/theOddsApi';
import { generateBetslipLinks } from '@/utils/betslipLinkGenerator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAdminMode } from '@/contexts/AdminModeContext';

interface SportsbookButtonsProps {
  pickId: string;
  gameType: 'nfl' | 'cfb' | 'nba' | 'ncaab';
  awayTeam: string;
  homeTeam: string;
  selectedBetType: string;
  awaySpread?: number | null;
  homeSpread?: number | null;
  overLine?: number | null;
  awayMl?: number | null;
  homeMl?: number | null;
  existingLinks?: Record<string, string> | null; // Links from database
  onLinksUpdated?: () => void; // Callback when links are saved
  compact?: boolean;
}

export function SportsbookButtons({
  pickId,
  gameType,
  awayTeam,
  homeTeam,
  selectedBetType,
  awaySpread,
  homeSpread,
  overLine,
  awayMl,
  homeMl,
  existingLinks,
  onLinksUpdated,
  compact = false,
}: SportsbookButtonsProps) {
  const { toast } = useToast();
  const { adminModeEnabled } = useAdminMode();
  const [loading, setLoading] = useState(false);
  const [betslipLinks, setBetslipLinks] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  
  // Track if we've already saved links to prevent duplicate saves
  const hasSavedLinks = useRef(false);
  const hasAttemptedFetch = useRef(false);

  // Determine which team/line to use based on bet type
  const getBetDetails = () => {
    const betTypes = selectedBetType.split(',').map(bt => bt.trim());
    const firstBet = betTypes[0];

    if (firstBet === 'spread_away' || firstBet === 'spread') {
      return { teamName: awayTeam, line: awaySpread };
    } else if (firstBet === 'spread_home') {
      return { teamName: homeTeam, line: homeSpread };
    } else if (firstBet === 'ml_away' || firstBet === 'moneyline') {
      return { teamName: awayTeam };
    } else if (firstBet === 'ml_home') {
      return { teamName: homeTeam };
    } else if (firstBet === 'over' || firstBet === 'over_under') {
      return { line: overLine };
    } else if (firstBet === 'under') {
      return { line: overLine };
    }

    return {};
  };

  useEffect(() => {
    const loadOdds = async () => {
      // First, check if we already have links stored in the database
      if (existingLinks && Object.keys(existingLinks).length > 0) {
        console.log(`✅ Using stored betslip links for pick ${pickId}`);
        setBetslipLinks(existingLinks);
        setLoading(false);
        return;
      }

      // Prevent duplicate fetches - only fetch once per component mount
      if (hasAttemptedFetch.current) {
        console.log(`⏭️ Already attempted fetch for pick ${pickId}, skipping...`);
        return;
      }
      
      hasAttemptedFetch.current = true;

      // No stored links, fetch from API
      setLoading(true);
      setError(null);

      try {
        const sportKey = getSportKey(gameType);
        if (!sportKey) {
          setError('Sport not supported');
          return;
        }

        console.log(`📡 Fetching betslip links from API for pick ${pickId}...`);
        
        // Fetch odds from The Odds API
        // Defaults to top 5 bookmakers to conserve API quota
        const { events } = await fetchOdds(sportKey); // Top 5 only by default

        // Find matching event
        const matchingEvent = findMatchingEvent(awayTeam, homeTeam, events);

        if (!matchingEvent) {
          // Don't set error state here to avoid showing "Game not found" message to users
          // Just return early, effectively showing nothing
          setLoading(false);
          return;
        }

        // Generate betslip links for all available sportsbooks
        const betDetails = getBetDetails();
        const links = generateBetslipLinks(
          matchingEvent,
          selectedBetType,
          betDetails.teamName,
          betDetails.line
        );

        // Save links to database (only once)
        if (Object.keys(links).length > 0 && !hasSavedLinks.current) {
          hasSavedLinks.current = true; // Set flag BEFORE the async operation
          
          const { error: updateError } = await supabase
            .from('editors_picks')
            .update({ betslip_links: links as any })
            .eq('id', pickId);

          if (updateError) {
            console.error('Error saving betslip links:', updateError);
            hasSavedLinks.current = false; // Reset on error so it can retry
            // Still show links even if save fails
          } else {
            console.log(`💾 Saved betslip links to database for pick ${pickId}`);
            // NOTE: We do NOT call onLinksUpdated() here anymore!
            // This was causing an infinite loop because it triggered parent re-render
            // The links will be available on next page load from the database
          }
        }

        setBetslipLinks(links);
      } catch (err: any) {
        console.error('Error loading odds:', err);
        hasAttemptedFetch.current = false; // Reset on error so it can retry

        // Handle quota exceeded error specifically
        if (err?.isQuotaExceeded || err?.message?.includes('quota')) {
          setError('API quota exceeded');
          // Only show toast to admins
          if (adminModeEnabled) {
            toast({
              title: 'API Limit Reached',
              description: 'The Odds API quota has been exceeded. Please upgrade your plan or try again later.',
              variant: 'destructive',
            });
          }
        } else {
          setError('Failed to load sportsbook links');
          // Only show toast to admins
          if (adminModeEnabled) {
            toast({
              title: 'Error',
              description: err?.message || 'Failed to load sportsbook links. Please try again.',
              variant: 'destructive',
            });
          }
        }
      } finally {
        setLoading(false);
      }
    };

    loadOdds();
    // CRITICAL: Removed onLinksUpdated from dependencies to prevent infinite loop
    // Each parent re-render creates a new function reference, which would trigger this effect again
  }, [pickId, gameType, awayTeam, homeTeam, selectedBetType, existingLinks]);

  const handleSportsbookClick = (sportsbookKey: string) => {
    const link = betslipLinks[sportsbookKey];
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      toast({
        title: 'Link unavailable',
        description: 'This sportsbook link is not available for this game.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading sportsbook links...</span>
      </div>
    );
  }

  if (error || Object.keys(betslipLinks).length === 0) {
    // Don't show anything if no links are found
    // Only show quota error UI to admins
    const isQuotaError = error?.includes('quota') || error?.includes('quota exceeded');

    if (!isQuotaError || !adminModeEnabled) {
      return null;
    }

    return (
      <div className="text-sm py-2">
        <div className="space-y-2">
          <div className="text-destructive font-medium">API Quota Exceeded</div>
          <div className="text-muted-foreground text-xs">
            The Odds API quota has been reached. Please upgrade your plan or try again later.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${compact ? 'pt-0' : 'pt-2'}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="default" 
            size={compact ? "sm" : "default"}
            className={`w-full flex items-center justify-center gap-2 ${compact ? 'h-8 text-xs' : ''} bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md border-0 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]`}
          >
            <span>Place Bet</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 max-h-[300px] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl rounded-xl p-1.5">
           <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
             Available Sportsbooks
           </div>
           
          {[...TOP_SPORTSBOOKS, ...ADDITIONAL_SPORTSBOOKS].map((sportsbook) => {
            const hasLink = !!betslipLinks[sportsbook.key];
            if (!hasLink) return null;

            return (
              <DropdownMenuItem
                key={sportsbook.key}
                onClick={() => handleSportsbookClick(sportsbook.key)}
                className="flex items-center justify-between cursor-pointer py-2.5 px-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:bg-blue-50 dark:focus:bg-blue-900/20 transition-colors"
              >
                <span className="font-medium text-gray-700 dark:text-gray-200">{sportsbook.displayName}</span>
                <ExternalLink className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

