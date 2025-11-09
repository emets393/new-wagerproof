import debug from '@/utils/debug';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Trash2, Edit, Send } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { motion, AnimatePresence } from 'framer-motion';
import Aurora from '@/components/magicui/aurora';

interface EditorPickCardProps {
  pick: {
    id: string;
    game_id: string;
    game_type: 'nfl' | 'cfb';
    selected_bet_type: string; // Can be single string or comma-separated string
    editors_notes: string | null;
    is_published: boolean;
    editor_id: string;
  };
  gameData: {
    away_team: string;
    home_team: string;
    away_logo?: string;
    home_logo?: string;
    game_date?: string;
    game_time?: string;
    away_spread?: number | null;
    home_spread?: number | null;
    over_line?: number | null;
    away_ml?: number | null;
    home_ml?: number | null;
    opening_spread?: number | null; // For CFB games
    home_team_colors: { primary: string; secondary: string };
    away_team_colors: { primary: string; secondary: string };
  };
  onUpdate?: () => void;
  onDelete?: () => void;
}

export function EditorPickCard({ pick, gameData, onUpdate, onDelete }: EditorPickCardProps) {
  const { adminModeEnabled } = useAdminMode();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(!pick.is_published);
  
  // Parse bet types - handle both single strings and comma-separated strings
  const parseBetTypes = (betTypeString: string): string[] => {
    if (!betTypeString) return ['spread_home'];
    
    // Split by comma if it's a comma-separated list
    const types = betTypeString.includes(',') 
      ? betTypeString.split(',').map(t => t.trim())
      : [betTypeString];
    
    // Normalize old bet types to new format
    return types.map(betType => {
      if (betType === 'spread') return 'spread_home';
      if (betType === 'moneyline') return 'ml_home';
      if (betType === 'over_under') return 'over';
      return betType;
    });
  };
  
  const [selectedBetTypes, setSelectedBetTypes] = useState<string[]>(parseBetTypes(pick.selected_bet_type));
  const [notes, setNotes] = useState(pick.editors_notes || '');
  const [isLoading, setIsLoading] = useState(false);
  
  const getAuroraColors = (): string[] => {
    const firstBet = selectedBetTypes[0];

    if (firstBet?.includes('home')) {
      return [gameData.home_team_colors.primary, gameData.home_team_colors.secondary, gameData.home_team_colors.primary];
    }
    if (firstBet?.includes('away')) {
      return [gameData.away_team_colors.primary, gameData.away_team_colors.secondary, gameData.away_team_colors.primary];
    }
    if (firstBet === 'over' || firstBet === 'under') {
      if (gameData.home_spread !== null && gameData.home_spread < 0) {
        return [gameData.home_team_colors.primary, gameData.home_team_colors.secondary, gameData.home_team_colors.primary];
      }
      if (gameData.away_spread !== null && gameData.away_spread < 0) {
        return [gameData.away_team_colors.primary, gameData.away_team_colors.secondary, gameData.away_team_colors.primary];
      }
    }
    // Fallback
    return [gameData.home_team_colors.primary, gameData.away_team_colors.primary, gameData.home_team_colors.secondary];
  };

  const auroraColors = getAuroraColors();

  // Toggle a bet type selection
  const toggleBetType = (betType: string) => {
    setSelectedBetTypes(prev => {
      if (prev.includes(betType)) {
        return prev.filter(t => t !== betType);
      } else {
        return [...prev, betType];
      }
    });
  };

  const formatSpread = (spread: number | null | undefined): string => {
    if (spread === null || spread === undefined) return '-';
    if (spread > 0) return `+${spread}`;
    return spread.toString();
  };

  const formatMoneyline = (ml: number | null | undefined): string => {
    if (ml === null || ml === undefined) return '-';
    if (ml > 0) return `+${ml}`;
    return ml.toString();
  };

  const handlePublish = async () => {
    if (!notes.trim()) {
      toast({
        title: 'Notes Required',
        description: 'Please add editor notes before publishing.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedBetTypes.length === 0) {
      toast({
        title: 'Bet Selection Required',
        description: 'Please select at least one bet type.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const updateData = {
        selected_bet_type: selectedBetTypes.join(','), // Store as comma-separated string
        editors_notes: notes.trim(),
        is_published: true,
        updated_at: new Date().toISOString(),
      };
      
      debug.log('📤 Publishing with data:', updateData);
      
      const { error } = await supabase
        .from('editors_picks')
        .update(updateData)
        .eq('id', pick.id);

      if (error) {
        debug.error('❌ Supabase error:', error);
        throw error;
      }

      // Post to Discord after successful publish
      try {
        debug.log('🔔 Posting to Discord...');
        
        const discordPayload = {
          pickData: {
            id: pick.id,
            gameId: pick.game_id,
            gameType: pick.game_type,
            selectedBetTypes: selectedBetTypes,
            editorNotes: notes.trim(),
          },
          gameData: {
            awayTeam: gameData.away_team,
            homeTeam: gameData.home_team,
            awayLogo: gameData.away_logo,
            homeLogo: gameData.home_logo,
            gameDate: gameData.game_date,
            gameTime: gameData.game_time,
            awaySpread: gameData.away_spread,
            homeSpread: gameData.home_spread,
            awayMl: gameData.away_ml,
            homeMl: gameData.home_ml,
            overLine: gameData.over_line,
            homeTeamColors: gameData.home_team_colors,
            awayTeamColors: gameData.away_team_colors,
          },
          channelId: '1428843931889569893', // editors-picks channel
        };

        const discordResponse = await fetch('https://xna68l.buildship.run/discord-editor-pick-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload),
        });

        if (!discordResponse.ok) {
          const errorText = await discordResponse.text();
          debug.error('❌ Discord post failed:', errorText);
          // Don't throw - pick is published, Discord is secondary
        } else {
          debug.log('✅ Posted to Discord successfully');
        }
      } catch (discordError) {
        debug.error('❌ Error posting to Discord:', discordError);
        // Don't throw - pick is already published
      }

      toast({
        title: 'Pick Published',
        description: 'Your editor pick is now visible to all users.',
      });
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      debug.error('Error publishing pick:', error);
      debug.error('Error details:', JSON.stringify(error, null, 2));
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Error',
        description: `Failed to publish pick: ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (selectedBetTypes.length === 0) {
      toast({
        title: 'Bet Selection Required',
        description: 'Please select at least one bet type.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const updateData = {
        selected_bet_type: selectedBetTypes.join(','), // Store as comma-separated string
        editors_notes: notes.trim(),
        updated_at: new Date().toISOString(),
      };
      
      debug.log('💾 Saving draft with data:', updateData);
      
      const { error } = await supabase
        .from('editors_picks')
        .update(updateData)
        .eq('id', pick.id);

      if (error) {
        debug.error('❌ Supabase error:', error);
        debug.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      toast({
        title: 'Draft Saved',
        description: 'Your changes have been saved.',
      });
      onUpdate?.();
    } catch (error) {
      debug.error('Error saving draft:', error);
      toast({
        title: 'Error',
        description: 'Failed to save draft. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnpublish = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('editors_picks')
        .update({
          is_published: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pick.id);

      if (error) throw error;

      toast({
        title: 'Pick Unpublished',
        description: 'Pick moved back to drafts.',
      });
      setIsEditing(true);
      onUpdate?.();
    } catch (error) {
      debug.error('Error unpublishing pick:', error);
      toast({
        title: 'Error',
        description: 'Failed to unpublish pick. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this editor pick?')) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('editors_picks')
        .delete()
        .eq('id', pick.id);

      if (error) throw error;

      toast({
        title: 'Pick Deleted',
        description: 'Editor pick has been removed.',
      });
      onDelete?.();
    } catch (error) {
      debug.error('Error deleting pick:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete pick. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="relative overflow-hidden bg-gradient-to-b from-gray-600/95 via-gray-300/90 to-gray-100/90 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-2 border-blue-200 dark:border-blue-800 shadow-xl">
      {/* Aurora Effect */}
      <AnimatePresence>
        {pick.is_published && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute top-0 left-0 right-0 h-40 z-[1] pointer-events-none overflow-hidden rounded-t-lg opacity-60"
          >
            <Aurora
              colorStops={auroraColors}
              amplitude={1.2}
              blend={0.6}
              speed={0.8}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Status Badge */}
      {!pick.is_published && (
        <div className="absolute top-4 right-4 z-10">
          <Badge variant="secondary" className="bg-yellow-500 text-white">
            DRAFT
          </Badge>
        </div>
      )}

      <CardContent className="space-y-4 sm:space-y-6 pt-4 pb-4 sm:pt-6 sm:pb-6 relative z-10">
        {/* Game Date and Time */}
        {(gameData.game_date || gameData.game_time) && (
          <div className="text-center space-y-2">
            {gameData.game_date && (
              <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
                {gameData.game_date}
              </div>
            )}
            {gameData.game_time && (
              <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 sm:px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 inline-block">
                {gameData.game_time}
              </div>
            )}
          </div>
        )}

        {/* Team Logos and Betting Info - Horizontal Layout */}
        <div className="space-y-2 sm:space-y-4 pt-1.5">
          {/* Team Logos Row */}
          <div className="flex justify-center items-center space-x-4 sm:space-x-6">
            {/* Away Team Logo */}
            <div className="text-center w-[140px] sm:w-[160px]">
              {gameData.away_logo && (
                <img 
                  src={gameData.away_logo} 
                  alt={`${gameData.away_team} logo`}
                  className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-2 sm:mb-3 drop-shadow-lg filter hover:scale-105 transition-transform duration-200"
                />
              )}
              <div className="text-sm sm:text-base font-bold mb-1 sm:mb-2 min-h-[3rem] sm:min-h-[3.5rem] flex items-start justify-center text-foreground leading-tight text-center break-words px-1 pt-2">
                {gameData.away_team}
              </div>
            </div>

            {/* @ Symbol */}
            <div className="text-center">
              <span className="text-4xl sm:text-5xl font-bold text-gray-400 dark:text-gray-500">@</span>
            </div>

            {/* Home Team Logo */}
            <div className="text-center w-[140px] sm:w-[160px]">
              {gameData.home_logo && (
                <img 
                  src={gameData.home_logo} 
                  alt={`${gameData.home_team} logo`}
                  className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-2 sm:mb-3 drop-shadow-lg filter hover:scale-105 transition-transform duration-200"
                />
              )}
              <div className="text-sm sm:text-base font-bold mb-1 sm:mb-2 min-h-[3rem] sm:min-h-[3.5rem] flex items-start justify-center text-foreground leading-tight text-center break-words px-1 pt-2">
                {gameData.home_team}
              </div>
            </div>
          </div>

          {/* Betting Lines Row */}
          <div className="flex justify-between items-center">
            {/* Away Team Betting */}
            <div className="text-center flex-1">
              <div className="text-base sm:text-lg font-bold h-6 sm:h-8 flex items-center justify-center text-blue-600 dark:text-blue-400">
                {formatMoneyline(gameData.away_ml)}
              </div>
              <div className="text-sm sm:text-base font-bold h-5 sm:h-6 flex items-center justify-center text-foreground">
                {formatSpread(gameData.away_spread)}
              </div>
              {pick.game_type === 'cfb' && typeof gameData.opening_spread === 'number' && (
                <div className="mt-1 flex justify-center">
                  <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full border bg-background text-foreground border-border">
                    Open: {formatSpread(gameData.opening_spread ? -gameData.opening_spread : null)}
                  </span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="text-center px-2 sm:px-4">
              <div className="text-xs sm:text-sm font-bold text-foreground bg-primary/10 dark:bg-primary/20 px-2 sm:px-3 py-1 rounded-full border border-primary/30">
                Total: {gameData.over_line || '-'}
              </div>
            </div>

            {/* Home Team Betting */}
            <div className="text-center flex-1">
              <div className="text-base sm:text-lg font-bold h-6 sm:h-8 flex items-center justify-center text-green-600 dark:text-green-400">
                {formatMoneyline(gameData.home_ml)}
              </div>
              <div className="text-sm sm:text-base font-bold h-5 sm:h-6 flex items-center justify-center text-foreground">
                {formatSpread(gameData.home_spread)}
              </div>
              {pick.game_type === 'cfb' && typeof gameData.opening_spread === 'number' && (
                <div className="mt-1 flex justify-center">
                  <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full border bg-background text-foreground border-border">
                    Open: {formatSpread(gameData.opening_spread)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Selected Bet Section */}
        {isEditing && adminModeEnabled ? (
          <div className="space-y-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
            <div>
              <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">Select Bet Types (Multiple Allowed)</Label>
              <div className="mt-2 space-y-3">
                {/* Spread Options */}
                <div className="space-y-2 pl-2 border-l-2 border-blue-300 dark:border-blue-700">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">SPREAD</div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="spread_away" 
                      checked={selectedBetTypes.includes('spread_away')}
                      onCheckedChange={() => toggleBetType('spread_away')}
                    />
                    <Label htmlFor="spread_away" className="cursor-pointer font-normal">
                      {gameData.away_team} {formatSpread(gameData.away_spread)}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="spread_home" 
                      checked={selectedBetTypes.includes('spread_home')}
                      onCheckedChange={() => toggleBetType('spread_home')}
                    />
                    <Label htmlFor="spread_home" className="cursor-pointer font-normal">
                      {gameData.home_team} {formatSpread(gameData.home_spread)}
                    </Label>
                  </div>
                </div>

                {/* Moneyline Options */}
                <div className="space-y-2 pl-2 border-l-2 border-green-300 dark:border-green-700">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">MONEYLINE</div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="ml_away" 
                      checked={selectedBetTypes.includes('ml_away')}
                      onCheckedChange={() => toggleBetType('ml_away')}
                    />
                    <Label htmlFor="ml_away" className="cursor-pointer font-normal">
                      {gameData.away_team} {formatMoneyline(gameData.away_ml)}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="ml_home" 
                      checked={selectedBetTypes.includes('ml_home')}
                      onCheckedChange={() => toggleBetType('ml_home')}
                    />
                    <Label htmlFor="ml_home" className="cursor-pointer font-normal">
                      {gameData.home_team} {formatMoneyline(gameData.home_ml)}
                    </Label>
                  </div>
                </div>

                {/* Over/Under Options */}
                <div className="space-y-2 pl-2 border-l-2 border-purple-300 dark:border-purple-700">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">OVER/UNDER</div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="over" 
                      checked={selectedBetTypes.includes('over')}
                      onCheckedChange={() => toggleBetType('over')}
                    />
                    <Label htmlFor="over" className="cursor-pointer font-normal">
                      Over {gameData.over_line || 'N/A'}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="under" 
                      checked={selectedBetTypes.includes('under')}
                      onCheckedChange={() => toggleBetType('under')}
                    />
                    <Label htmlFor="under" className="cursor-pointer font-normal">
                      Under {gameData.over_line || 'N/A'}
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes" className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Editor's Notes
              </Label>
              <Textarea
                id="notes"
                placeholder="Share your analysis and reasoning for this pick..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2 min-h-[120px]"
              />
            </div>

            <div className="flex gap-2">
              {!pick.is_published ? (
                <>
                  <Button 
                    onClick={handlePublish} 
                    disabled={isLoading} 
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-700"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Publish
                  </Button>
                  <Button onClick={handleSaveDraft} disabled={isLoading} variant="outline" className="flex-1">
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save Draft
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(false)} variant="outline" className="flex-1">
                  Cancel Edit
                </Button>
              )}
              <Button onClick={handleDelete} disabled={isLoading} variant="destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
            {/* Display Selected Bets */}
            <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-700">
              <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-3">Editor's Picks</h4>
              <div className="space-y-2">
                {selectedBetTypes.map((betType, index) => {
                  // Helper function to get bet display text
                  const getBetDisplay = (type: string) => {
                    switch(type) {
                      case 'spread_away':
                        return `Spread: ${gameData.away_team} ${formatSpread(gameData.away_spread)}`;
                      case 'spread_home':
                        return `Spread: ${gameData.home_team} ${formatSpread(gameData.home_spread)}`;
                      case 'ml_away':
                        return `Moneyline: ${gameData.away_team} ${formatMoneyline(gameData.away_ml)}`;
                      case 'ml_home':
                        return `Moneyline: ${gameData.home_team} ${formatMoneyline(gameData.home_ml)}`;
                      case 'over':
                        return `Over ${gameData.over_line || 'N/A'}`;
                      case 'under':
                        return `Under ${gameData.over_line || 'N/A'}`;
                      // Legacy support
                      case 'spread':
                        return `Spread: ${gameData.home_team} ${formatSpread(gameData.home_spread)}`;
                      case 'moneyline':
                        return `Moneyline: ${gameData.home_team} ${formatMoneyline(gameData.home_ml)}`;
                      case 'over_under':
                        return `Over ${gameData.over_line || 'N/A'}`;
                      default:
                        return type;
                    }
                  };

                  return (
                    <div key={index} className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
                      <span className="text-blue-600 dark:text-blue-400 mr-2">•</span>
                      {getBetDisplay(betType)}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Display Notes */}
            {notes && (
              <div className="bg-gradient-to-br from-gray-50 to-slate-50/30 dark:from-gray-800/50 dark:to-slate-800/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">Analysis</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{notes}</p>
              </div>
            )}

            {/* Admin Actions for Published Picks */}
            {adminModeEnabled && pick.is_published && (
              <div className="flex gap-2">
                <Button onClick={() => setIsEditing(true)} variant="outline" className="flex-1">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button onClick={handleUnpublish} disabled={isLoading} variant="outline" className="flex-1">
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Unpublish
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

