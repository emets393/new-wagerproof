import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Trash2, Edit, Send } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsAdmin } from '@/hooks/useIsAdmin';

interface EditorPickCardProps {
  pick: {
    id: string;
    game_id: string;
    game_type: 'nfl' | 'cfb';
    selected_bet_type: 'spread' | 'over_under' | 'moneyline';
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
  };
  onUpdate?: () => void;
  onDelete?: () => void;
}

export function EditorPickCard({ pick, gameData, onUpdate, onDelete }: EditorPickCardProps) {
  const { isAdmin } = useIsAdmin();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(!pick.is_published);
  const [selectedBetType, setSelectedBetType] = useState(pick.selected_bet_type);
  const [notes, setNotes] = useState(pick.editors_notes || '');
  const [isLoading, setIsLoading] = useState(false);

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

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('editors_picks')
        .update({
          selected_bet_type: selectedBetType,
          editors_notes: notes.trim(),
          is_published: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pick.id);

      if (error) throw error;

      toast({
        title: 'Pick Published',
        description: 'Your editor pick is now visible to all users.',
      });
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error publishing pick:', error);
      toast({
        title: 'Error',
        description: 'Failed to publish pick. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('editors_picks')
        .update({
          selected_bet_type: selectedBetType,
          editors_notes: notes.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', pick.id);

      if (error) throw error;

      toast({
        title: 'Draft Saved',
        description: 'Your changes have been saved.',
      });
      onUpdate?.();
    } catch (error) {
      console.error('Error saving draft:', error);
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
      console.error('Error unpublishing pick:', error);
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
      console.error('Error deleting pick:', error);
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
    <Card className="relative overflow-hidden bg-gradient-to-br from-gray-100/90 via-gray-200/90 to-gray-100/90 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border-2 border-blue-200 dark:border-blue-800 shadow-xl">
      {/* Status Badge */}
      {!pick.is_published && (
        <div className="absolute top-4 right-4 z-10">
          <Badge variant="secondary" className="bg-yellow-500 text-white">
            DRAFT
          </Badge>
        </div>
      )}

      <CardContent className="space-y-4 sm:space-y-6 pt-4 pb-4 sm:pt-6 sm:pb-6">
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

        {/* Team Logos and Names */}
        <div className="space-y-3 sm:space-y-4 pt-2">
          <div className="flex justify-between items-start">
            {/* Away Team */}
            <div className="text-center flex-1">
              {gameData.away_logo && (
                <div className="h-16 w-16 mx-auto mb-3 rounded-full flex items-center justify-center">
                  <img src={gameData.away_logo} alt={gameData.away_team} className="h-full w-full object-contain" />
                </div>
              )}
              <div className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                {gameData.away_team}
              </div>
            </div>

            {/* @ Symbol */}
            <div className="text-center px-4 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold text-gray-400 dark:text-gray-500">@</span>
            </div>

            {/* Home Team */}
            <div className="text-center flex-1">
              {gameData.home_logo && (
                <div className="h-16 w-16 mx-auto mb-3 rounded-full flex items-center justify-center">
                  <img src={gameData.home_logo} alt={gameData.home_team} className="h-full w-full object-contain" />
                </div>
              )}
              <div className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                {gameData.home_team}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Bet Section */}
        {isEditing && isAdmin ? (
          <div className="space-y-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
            <div>
              <Label className="text-sm font-bold text-gray-900 dark:text-gray-100">Select Bet Type</Label>
              <RadioGroup value={selectedBetType} onValueChange={(value) => setSelectedBetType(value as typeof selectedBetType)} className="mt-2 space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="spread" id="spread" />
                  <Label htmlFor="spread" className="cursor-pointer">
                    Spread: {gameData.away_team} {formatSpread(gameData.away_spread)} / {gameData.home_team} {formatSpread(gameData.home_spread)}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="over_under" id="over_under" />
                  <Label htmlFor="over_under" className="cursor-pointer">
                    Over/Under: {gameData.over_line || 'N/A'}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="moneyline" id="moneyline" />
                  <Label htmlFor="moneyline" className="cursor-pointer">
                    Moneyline: {gameData.away_team} {formatMoneyline(gameData.away_ml)} / {gameData.home_team} {formatMoneyline(gameData.home_ml)}
                  </Label>
                </div>
              </RadioGroup>
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
                  <Button onClick={handlePublish} disabled={isLoading} className="flex-1">
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
            {/* Display Selected Bet */}
            <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-700">
              <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-2">Editor's Pick</h4>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {selectedBetType === 'spread' && (
                  <span>Spread: {gameData.away_team} {formatSpread(gameData.away_spread)} / {gameData.home_team} {formatSpread(gameData.home_spread)}</span>
                )}
                {selectedBetType === 'over_under' && (
                  <span>Over/Under: {gameData.over_line || 'N/A'}</span>
                )}
                {selectedBetType === 'moneyline' && (
                  <span>Moneyline: {gameData.away_team} {formatMoneyline(gameData.away_ml)} / {gameData.home_team} {formatMoneyline(gameData.home_ml)}</span>
                )}
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
            {isAdmin && pick.is_published && (
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

