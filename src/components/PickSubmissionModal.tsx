import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { CommunityPickCard } from './CommunityPickCard';
import { fetchActiveGames, GameOption, getPickOptions } from '@/services/communityPicksGameService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PickSubmissionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (pick: PickFormData) => Promise<void>;
  editingPick?: any;
}

export interface PickFormData {
  sport: string;
  is_native_pick: boolean;
  game_id?: string;
  team_name: string;
  pick_type: 'moneyline' | 'spread' | 'over' | 'under';
  pick_details: string;
  reasoning?: string;
  game_date: string;
  opponent_team?: string;
}

const sportOptions = [
  { value: 'nfl', label: 'NFL' },
  { value: 'cfb', label: 'College Football' },
  { value: 'nba', label: 'NBA' },
  { value: 'ncaab', label: 'College Basketball' },
  { value: 'mlb', label: 'MLB' },
  { value: 'nhl', label: 'NHL' },
  { value: 'mma', label: 'MMA' },
  { value: 'boxing', label: 'Boxing' },
  { value: 'soccer', label: 'Soccer' },
  { value: 'other', label: 'Other' },
];

export function PickSubmissionModal({
  open,
  onClose,
  onSubmit,
  editingPick,
}: PickSubmissionModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [sport, setSport] = useState('');
  const [pickSource, setPickSource] = useState<'native' | 'custom'>('native');
  const [games, setGames] = useState<GameOption[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameOption | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<'away' | 'home' | ''>('');
  const [pickType, setPickType] = useState<'moneyline' | 'spread' | 'over' | 'under' | ''>('');
  const [pickDetails, setPickDetails] = useState('');
  const [reasoning, setReasoning] = useState('');
  
  // Custom pick fields
  const [customTeam, setCustomTeam] = useState('');
  const [customOpponent, setCustomOpponent] = useState('');
  const [customGameDate, setCustomGameDate] = useState('');

  // Load games when sport is selected
  useEffect(() => {
    if (sport && pickSource === 'native' && ['nfl', 'cfb'].includes(sport)) {
      setLoadingGames(true);
      fetchActiveGames(sport)
        .then(setGames)
        .finally(() => setLoadingGames(false));
    }
  }, [sport, pickSource]);

  // Auto-generate pick details for native picks
  useEffect(() => {
    if (pickSource === 'native' && selectedGame && selectedTeam && pickType) {
      const teamName = selectedTeam === 'away' ? selectedGame.awayTeam : selectedGame.homeTeam;
      const options = getPickOptions(selectedGame, selectedTeam);
      
      if (pickType === 'moneyline' && options.moneyline) {
        setPickDetails(options.moneyline.label);
      } else if (pickType === 'spread' && options.spread) {
        setPickDetails(options.spread.label);
      } else if ((pickType === 'over' || pickType === 'under') && options.total) {
        setPickDetails(`${pickType === 'over' ? 'Over' : 'Under'} ${options.total.value}`);
      }
    }
  }, [pickSource, selectedGame, selectedTeam, pickType]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const formData: PickFormData = {
        sport,
        is_native_pick: pickSource === 'native',
        team_name: pickSource === 'native' 
          ? (selectedTeam === 'away' ? selectedGame!.awayTeam : selectedGame!.homeTeam)
          : customTeam,
        pick_type: pickType as any,
        pick_details: pickDetails,
        reasoning: reasoning || undefined,
        game_date: pickSource === 'native' ? selectedGame!.gameDate : customGameDate,
        opponent_team: pickSource === 'native'
          ? (selectedTeam === 'away' ? selectedGame!.homeTeam : selectedGame!.awayTeam)
          : (customOpponent || undefined),
        game_id: pickSource === 'native' ? selectedGame!.id : undefined,
      };

      await onSubmit(formData);
      toast.success('Pick submitted successfully!');
      handleClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit pick');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSport('');
    setPickSource('native');
    setSelectedGame(null);
    setSelectedTeam('');
    setPickType('');
    setPickDetails('');
    setReasoning('');
    setCustomTeam('');
    setCustomOpponent('');
    setCustomGameDate('');
    setStep(1);
    onClose();
  };

  const canGoToStep2 = sport !== '';
  const canGoToStep3 = 
    pickSource === 'custom' || 
    (pickSource === 'native' && selectedGame && selectedTeam);
  const canSubmit = 
    sport && 
    pickType && 
    pickDetails && 
    ((pickSource === 'native' && selectedGame && selectedTeam) ||
     (pickSource === 'custom' && customTeam && customGameDate));

  // Preview pick data
  const previewPick = {
    id: 'preview',
    user_id: user?.id || '',
    sport,
    is_native_pick: pickSource === 'native',
    team_name: pickSource === 'native' 
      ? (selectedTeam === 'away' ? selectedGame?.awayTeam : selectedGame?.homeTeam) || ''
      : customTeam,
    pick_type: pickType,
    pick_details: pickDetails || 'Pick details will appear here',
    reasoning: reasoning || undefined,
    game_date: pickSource === 'native' ? selectedGame?.gameDate || '' : customGameDate,
    opponent_team: pickSource === 'native'
      ? (selectedTeam === 'away' ? selectedGame?.homeTeam : selectedGame?.awayTeam)
      : customOpponent,
    upvotes: 0,
    downvotes: 0,
    is_locked: false,
    created_at: new Date().toISOString(),
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit a Pick</DialogTitle>
          <DialogDescription>
            Share your betting pick with the community
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-4">
            {/* Step 1: Select Sport */}
            <div className="space-y-2">
              <Label htmlFor="sport">Sport *</Label>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger id="sport">
                  <SelectValue placeholder="Select a sport" />
                </SelectTrigger>
                <SelectContent>
                  {sportOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Pick Source */}
            {canGoToStep2 && (
              <div className="space-y-2">
                <Label>Pick Source *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={pickSource === 'native' ? 'default' : 'outline'}
                    onClick={() => setPickSource('native')}
                    className="flex-1"
                    disabled={!['nfl', 'cfb'].includes(sport)}
                  >
                    From Current Games
                  </Button>
                  <Button
                    type="button"
                    variant={pickSource === 'custom' ? 'default' : 'outline'}
                    onClick={() => setPickSource('custom')}
                    className="flex-1"
                  >
                    Custom Pick
                  </Button>
                </div>
                {!['nfl', 'cfb'].includes(sport) && pickSource === 'native' && (
                  <p className="text-xs text-muted-foreground">
                    Native picks only available for NFL and CFB currently
                  </p>
                )}
              </div>
            )}

            {/* Native Pick Fields */}
            {pickSource === 'native' && ['nfl', 'cfb'].includes(sport) && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="game">Game *</Label>
                  {loadingGames ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <Select 
                      value={selectedGame?.id || ''} 
                      onValueChange={(id) => setSelectedGame(games.find(g => g.id === id) || null)}
                    >
                      <SelectTrigger id="game">
                        <SelectValue placeholder="Select a game" />
                      </SelectTrigger>
                      <SelectContent>
                        {games.map(game => (
                          <SelectItem key={game.id} value={game.id}>
                            {game.displayText}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {selectedGame && (
                  <>
                    <div className="space-y-2">
                      <Label>Team *</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={selectedTeam === 'away' ? 'default' : 'outline'}
                          onClick={() => setSelectedTeam('away')}
                          className="flex-1"
                        >
                          {selectedGame.awayTeam}
                        </Button>
                        <Button
                          type="button"
                          variant={selectedTeam === 'home' ? 'default' : 'outline'}
                          onClick={() => setSelectedTeam('home')}
                          className="flex-1"
                        >
                          {selectedGame.homeTeam}
                        </Button>
                      </div>
                    </div>

                    {selectedTeam && (
                      <div className="space-y-2">
                        <Label>Bet Type *</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {getPickOptions(selectedGame, selectedTeam).moneyline && (
                            <Button
                              type="button"
                              variant={pickType === 'moneyline' ? 'default' : 'outline'}
                              onClick={() => setPickType('moneyline')}
                            >
                              Moneyline
                            </Button>
                          )}
                          {getPickOptions(selectedGame, selectedTeam).spread && (
                            <Button
                              type="button"
                              variant={pickType === 'spread' ? 'default' : 'outline'}
                              onClick={() => setPickType('spread')}
                            >
                              Spread
                            </Button>
                          )}
                          {getPickOptions(selectedGame, selectedTeam).total && (
                            <>
                              <Button
                                type="button"
                                variant={pickType === 'over' ? 'default' : 'outline'}
                                onClick={() => setPickType('over')}
                              >
                                Over
                              </Button>
                              <Button
                                type="button"
                                variant={pickType === 'under' ? 'default' : 'outline'}
                                onClick={() => setPickType('under')}
                              >
                                Under
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Custom Pick Fields */}
            {pickSource === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="customTeam">Team/Selection *</Label>
                  <Input
                    id="customTeam"
                    value={customTeam}
                    onChange={(e) => setCustomTeam(e.target.value)}
                    placeholder="e.g., Patriots"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customOpponent">Opponent (Optional)</Label>
                  <Input
                    id="customOpponent"
                    value={customOpponent}
                    onChange={(e) => setCustomOpponent(e.target.value)}
                    placeholder="e.g., Cowboys"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bet Type *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={pickType === 'moneyline' ? 'default' : 'outline'}
                      onClick={() => setPickType('moneyline')}
                    >
                      Moneyline
                    </Button>
                    <Button
                      type="button"
                      variant={pickType === 'spread' ? 'default' : 'outline'}
                      onClick={() => setPickType('spread')}
                    >
                      Spread
                    </Button>
                    <Button
                      type="button"
                      variant={pickType === 'over' ? 'default' : 'outline'}
                      onClick={() => setPickType('over')}
                    >
                      Over
                    </Button>
                    <Button
                      type="button"
                      variant={pickType === 'under' ? 'default' : 'outline'}
                      onClick={() => setPickType('under')}
                    >
                      Under
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pickDetails">Pick Details *</Label>
                  <Input
                    id="pickDetails"
                    value={pickDetails}
                    onChange={(e) => setPickDetails(e.target.value)}
                    placeholder="e.g., Patriots -3.5, Over 47.5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customGameDate">Game Date *</Label>
                  <Input
                    id="customGameDate"
                    type="date"
                    value={customGameDate}
                    onChange={(e) => setCustomGameDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </>
            )}

            {/* Reasoning (common for both) */}
            {canGoToStep3 && pickType && (
              <div className="space-y-2">
                <Label htmlFor="reasoning">Reasoning (Optional)</Label>
                <Textarea
                  id="reasoning"
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Why do you like this pick?"
                  rows={4}
                />
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Pick'
                )}
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="border rounded-lg p-4 bg-muted/10">
              {canSubmit ? (
                <CommunityPickCard
                  pick={previewPick as any}
                  userDisplayName={user?.email}
                  userEmail={user?.email}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Fill out the form to see a preview of your pick
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

