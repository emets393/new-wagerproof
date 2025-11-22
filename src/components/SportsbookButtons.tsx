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
}: SportsbookButtonsProps) {
  const { toast } = useToast();
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
          setError('Game not found in sportsbooks');
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
          toast({
            title: 'API Limit Reached',
            description: 'The Odds API quota has been exceeded. Please upgrade your plan or try again later.',
            variant: 'destructive',
          });
        } else {
          setError('Failed to load sportsbook links');
          toast({
            title: 'Error',
            description: err?.message || 'Failed to load sportsbook links. Please try again.',
            variant: 'destructive',
          });
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
    const isQuotaError = error?.includes('quota') || error?.includes('quota exceeded');
    
    return (
      <div className="text-sm py-2">
        {isQuotaError ? (
          <div className="space-y-2">
            <div className="text-destructive font-medium">API Quota Exceeded</div>
            <div className="text-muted-foreground text-xs">
              The Odds API quota has been reached. Please upgrade your plan or try again later.
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground">
            {error || 'Sportsbook links unavailable'}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Place Your Bet
      </div>

      {/* Top 5 Sportsbooks */}
      <div className="flex flex-wrap gap-2">
        {TOP_SPORTSBOOKS.map((sportsbook) => {
          const hasLink = !!betslipLinks[sportsbook.key];
          return (
            <Button
              key={sportsbook.key}
              variant={hasLink ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSportsbookClick(sportsbook.key)}
              disabled={!hasLink}
              className="flex items-center gap-1.5"
            >
              {sportsbook.displayName}
              {hasLink && <ExternalLink className="h-3 w-3" />}
            </Button>
          );
        })}
      </div>

      {/* Additional Free US Sportsbooks Dropdown */}
      {/* Note: Additional sportsbooks will only appear if fetchOdds was called with getAllFreeUSBookmakers() */}
      {ADDITIONAL_SPORTSBOOKS.some(sb => betslipLinks[sb.key]) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              More Sportsbooks ({ADDITIONAL_SPORTSBOOKS.filter(sb => betslipLinks[sb.key]).length})
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-[300px] overflow-y-auto">
            {ADDITIONAL_SPORTSBOOKS.map((sportsbook) => {
              const hasLink = !!betslipLinks[sportsbook.key];
              if (!hasLink) return null;

              return (
                <DropdownMenuItem
                  key={sportsbook.key}
                  onClick={() => handleSportsbookClick(sportsbook.key)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  {sportsbook.displayName}
                  <ExternalLink className="h-3 w-3" />
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

