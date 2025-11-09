import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sparkles, TrendingUp, Eye, EyeOff, Loader2, Trash2, Lock } from 'lucide-react';
import Aurora from '@/components/magicui/aurora';
import { getNFLTeamColors, getCFBTeamColors, getNFLTeamInitials, getCFBTeamInitials, getContrastingTextColor } from '@/utils/teamColors';
import { toggleValueFindPublished, deleteValueFind } from '@/services/aiCompletionService';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { useToast } from '@/hooks/use-toast';
import debug from '@/utils/debug';
import { useFreemiumAccess } from '@/hooks/useFreemiumAccess';
import { useNavigate } from 'react-router-dom';

interface CompactPick {
  game_id: string;
  matchup: string;
  pick: string;
}

interface PageHeaderValueFindsProps {
  sportType: 'nfl' | 'cfb';
  summaryText: string;
  compactPicks: CompactPick[];
  valueFindId?: string;
  isPublished?: boolean;
  onTogglePublish?: () => void;
  onDelete?: () => void;
}

export function PageHeaderValueFinds({ 
  sportType, 
  summaryText, 
  compactPicks,
  valueFindId,
  isPublished,
  onTogglePublish,
  onDelete
}: PageHeaderValueFindsProps) {
  const sportLabel = sportType === 'nfl' ? 'NFL' : 'College Football';
  const { isAdminMode } = useAdminMode();
  const { toast } = useToast();
  const { isFreemiumUser } = useFreemiumAccess();
  const navigate = useNavigate();
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Extract team names from matchup (e.g., "Bills @ Chiefs" -> ["Bills", "Chiefs"])
  const getTeamDataForMatchup = (matchup: string) => {
    const parts = matchup.split('@').map(t => t.trim());
    if (parts.length !== 2) return { away: null, home: null };
    
    const awayTeam = parts[0];
    const homeTeam = parts[1];
    
    const getColors = sportType === 'nfl' ? getNFLTeamColors : getCFBTeamColors;
    const getInitials = sportType === 'nfl' ? getNFLTeamInitials : getCFBTeamInitials;
    
    return {
      away: {
        name: awayTeam,
        colors: getColors(awayTeam),
        initials: getInitials(awayTeam),
      },
      home: {
        name: homeTeam,
        colors: getColors(homeTeam),
        initials: getInitials(homeTeam),
      },
    };
  };

  const handleTogglePublish = async () => {
    if (!valueFindId) return;
    
    setToggling(true);
    try {
      const newStatus = !isPublished;
      const result = await toggleValueFindPublished(valueFindId, newStatus);
      
      if (result.success) {
        toast({
          title: newStatus ? 'Published!' : 'Unpublished',
          description: `Value Finds ${newStatus ? 'are now visible to users' : 'have been hidden from users'}`,
        });
        onTogglePublish?.();
      } else {
        throw new Error(result.error || 'Failed to update status');
      }
    } catch (error) {
      debug.error('Error toggling published status:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      });
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!valueFindId) return;
    
    setDeleting(true);
    try {
      const result = await deleteValueFind(valueFindId);
      
      if (result.success) {
        toast({
          title: 'Deleted',
          description: 'Value Finds have been permanently removed',
        });
        setDeleteDialogOpen(false);
        onDelete?.();
      } else {
        throw new Error(result.error || 'Failed to delete');
      }
    } catch (error) {
      debug.error('Error deleting Value Find:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };
  
  if (!compactPicks || compactPicks.length === 0) {
    return null;
  }

  return (
    <div className="w-full mb-4">
      <Card 
        className="border-purple-200 dark:border-white/20 overflow-hidden relative bg-gradient-to-br from-purple-50/90 to-blue-50/90 dark:from-transparent dark:to-transparent"
        style={{
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
        }}
      >
        <Aurora
          size={600}
          className="opacity-20"
          color1="rgba(139, 92, 246, 0.3)"
          color2="rgba(59, 130, 246, 0.3)"
        />
        
        <CardContent className="p-3 sm:p-4 relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Value Finds</h2>
              </div>
              <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-none text-xs">
                {sportLabel}
              </Badge>
              <Badge variant="outline" className="text-gray-600 dark:text-white/70 border-gray-300 dark:border-white/20 text-xs hidden sm:inline-flex">
                Today's Top Picks
              </Badge>
              {isAdminMode && !isPublished && (
                <Badge variant="outline" className="text-yellow-600 dark:text-yellow-500 border-yellow-500/50 text-xs">
                  Unpublished (Admin View)
                </Badge>
              )}
            </div>
            {isAdminMode && valueFindId && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleTogglePublish}
                  disabled={toggling}
                  size="sm"
                  variant="outline"
                  className="border-white/20 hover:border-white/40"
                >
                  {toggling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : isPublished ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Unpublish
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Publish
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={deleting}
                  size="sm"
                  variant="outline"
                  className="border-red-500/50 hover:border-red-500/70 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Data
                </Button>
              </div>
            )}
          </div>

          {/* Summary Text */}
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Today's Betting Landscape</h3>
            </div>
            <div className="text-sm text-gray-800 dark:text-white/90 leading-snug space-y-1">
              {summaryText.split('\n\n').map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Compact Picks */}
          <div className="relative">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-500 dark:text-yellow-400" />
              Featured Picks
            </h3>
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 ${isFreemiumUser ? 'blur-sm' : ''}`}>
              {compactPicks.map((pick, index) => {
                const teamData = getTeamDataForMatchup(pick.matchup);
                return (
                  <div
                    key={`${pick.game_id}-${index}`}
                    className="bg-gradient-to-br from-purple-100/90 to-blue-100/90 dark:from-purple-600/20 dark:to-blue-600/20 border border-purple-300/60 dark:border-purple-500/30 rounded-lg p-2 hover:border-purple-400 dark:hover:border-purple-400/50 transition-all duration-200"
                  >
                    {/* Team Circles */}
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {teamData.away && (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md"
                          style={{
                            background: `linear-gradient(135deg, ${teamData.away.colors.primary} 0%, ${teamData.away.colors.secondary} 100%)`,
                            color: getContrastingTextColor(teamData.away.colors.primary, teamData.away.colors.secondary),
                            border: `1.5px solid ${teamData.away.colors.primary}`,
                          }}
                        >
                          {teamData.away.initials}
                        </div>
                      )}
                      <span className="text-gray-500 dark:text-white/60 text-[10px] font-semibold">@</span>
                      {teamData.home && (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md"
                          style={{
                            background: `linear-gradient(135deg, ${teamData.home.colors.primary} 0%, ${teamData.home.colors.secondary} 100%)`,
                            color: getContrastingTextColor(teamData.home.colors.primary, teamData.home.colors.secondary),
                            border: `1.5px solid ${teamData.home.colors.primary}`,
                          }}
                        >
                          {teamData.home.initials}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-600 dark:text-white/60 mb-0.5 truncate text-center">{pick.matchup}</div>
                    <div className="text-gray-900 dark:text-white font-bold text-xs text-center">{pick.pick}</div>
                  </div>
                );
              })}
            </div>
            
            {/* Blur Overlay for Freemium Users */}
            {isFreemiumUser && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-50/95 to-blue-50/95 dark:from-black/80 dark:to-black/80 rounded-lg mt-8">
                <div className="text-center px-4">
                  <Lock className="w-10 h-10 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                  <h4 className="text-gray-900 dark:text-white font-bold text-base mb-1">Premium Content</h4>
                  <p className="text-gray-700 dark:text-white/70 text-xs mb-3">
                    Upgrade to unlock expert picks
                  </p>
                  <Button
                    onClick={() => navigate('/account')}
                    size="sm"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-xs"
                  >
                    Upgrade Now
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="mt-2 text-center text-[10px] text-gray-500 dark:text-white/50">
            Expert analysis • Always do your own research before betting
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Value Finds Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all Value Finds data for {sportLabel} including the header, 
              badges, and editor cards. This action cannot be undone. 
              <br /><br />
              You'll need to generate new Value Finds to display them again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Clear Data'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

