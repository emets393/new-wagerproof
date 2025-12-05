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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send, Save, Trash2 } from 'lucide-react';
import { fetchActiveGames, GameOption } from '@/services/communityPicksGameService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import debug from '@/utils/debug';
import { getNBATeamColors, getNCAABTeamColors, getNFLTeamColors, getCFBTeamColors } from '@/utils/teamColors';
import { getNBATeamLogo, getNCAABTeamLogo } from '@/utils/teamLogos';

interface EditorPickCreatorModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingPick?: {
    id: string;
    game_id: string;
    game_type: 'nfl' | 'cfb' | 'nba' | 'ncaab';
    selected_bet_type: string;
    editors_notes: string | null;
    is_published: boolean;
    pick_value?: string | null;
    best_price?: string | null;
    sportsbook?: string | null;
    units?: number | null;
    is_free_pick?: boolean;
    archived_game_data?: any;
  } | null;
}

const leagueOptions = [
  { value: 'nfl', label: 'NFL' },
  { value: 'cfb', label: 'College Football' },
  { value: 'nba', label: 'NBA' },
  { value: 'ncaab', label: 'College Basketball' },
];

const pickTypeOptions = [
  { value: 'spread', label: 'Spread' },
  { value: 'over_under', label: 'Over/Under' },
  { value: 'moneyline', label: 'Moneyline' },
];

const betTypeOptions = [
  { value: 'moneyline', label: 'Moneyline' },
  { value: 'spread', label: 'Spread' },
  { value: 'over_under', label: 'Over/Under' },
  { value: 'teaser', label: 'Teaser' },
  { value: 'parlay', label: 'Parlay' },
];

const unitOptions = [
  { value: '0.5', label: '0.5' },
  { value: '1', label: '1' },
  { value: '1.5', label: '1.5' },
  { value: '2', label: '2' },
  { value: '2.5', label: '2.5' },
  { value: '3', label: '3' },
  { value: '3.5', label: '3.5' },
  { value: '4', label: '4' },
  { value: '4.5', label: '4.5' },
  { value: '5', label: '5' },
];

export function EditorPickCreatorModal({
  open,
  onClose,
  onSuccess,
  editingPick,
}: EditorPickCreatorModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Form state
  const [league, setLeague] = useState<string>('');
  const [games, setGames] = useState<GameOption[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [pickType, setPickType] = useState<string>('');
  const [betType, setBetType] = useState<string>('');
  const [pickValue, setPickValue] = useState('');
  const [bestPrice, setBestPrice] = useState('');
  const [sportsbook, setSportsbook] = useState('');
  const [units, setUnits] = useState<string>('');
  const [editorsNotes, setEditorsNotes] = useState('');
  const [isFreePick, setIsFreePick] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!editingPick;

  // Reset form when modal opens/closes or editingPick changes
  useEffect(() => {
    if (open) {
      if (editingPick) {
        // Populate form with existing pick data
        setLeague(editingPick.game_type);
        setSelectedGameId(editingPick.game_id);
        setPickType(editingPick.selected_bet_type);
        setBetType((editingPick as any).bet_type || '');
        setPickValue(editingPick.pick_value || '');
        setBestPrice(editingPick.best_price || '');
        setSportsbook(editingPick.sportsbook || '');
        setUnits(editingPick.units?.toString() || '');
        setEditorsNotes(editingPick.editors_notes || '');
        setIsFreePick(editingPick.is_free_pick || false);
      } else {
        // Reset form for new pick
        setLeague('');
        setGames([]);
        setSelectedGameId('');
        setPickType('');
        setBetType('');
        setPickValue('');
        setBestPrice('');
        setSportsbook('');
        setUnits('');
        setEditorsNotes('');
        setIsFreePick(false);
      }
    }
  }, [open, editingPick]);

  // Load games when league changes
  useEffect(() => {
    if (league) {
      setLoadingGames(true);
      setSelectedGameId('');
      fetchActiveGames(league)
        .then(setGames)
        .finally(() => setLoadingGames(false));
    } else {
      setGames([]);
    }
  }, [league]);

  // If editing, load games for the league to populate the dropdown
  useEffect(() => {
    if (editingPick && editingPick.game_type) {
      setLoadingGames(true);
      fetchActiveGames(editingPick.game_type)
        .then((fetchedGames) => {
          setGames(fetchedGames);
          // Set the selected game after games are loaded
          setSelectedGameId(editingPick.game_id);
        })
        .finally(() => setLoadingGames(false));
    }
  }, [editingPick]);

  const selectedGame = games.find(g => g.id === selectedGameId);

  const handleClose = () => {
    onClose();
  };

  const validateForm = (): boolean => {
    if (!league) {
      toast({ title: 'Error', description: 'Please select a league', variant: 'destructive' });
      return false;
    }
    if (!selectedGameId) {
      toast({ title: 'Error', description: 'Please select a game', variant: 'destructive' });
      return false;
    }
    if (!pickType) {
      toast({ title: 'Error', description: 'Please select a pick type', variant: 'destructive' });
      return false;
    }
    if (!pickValue.trim()) {
      toast({ title: 'Error', description: 'Please enter a pick value', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validateForm()) return;
    await savePick(false);
  };

  const handlePublish = async () => {
    if (!validateForm()) return;
    if (!editorsNotes.trim()) {
      toast({ title: 'Error', description: 'Please add editor notes before publishing', variant: 'destructive' });
      return;
    }
    await savePick(true);
  };

  const savePick = async (publish: boolean) => {
    if (!user) return;
    
    setSubmitting(true);
    try {
      // Archive game data for historical preservation and Discord posting
      // Get team colors and logos based on sport
      const getTeamLogo = (teamName: string, sport: string): string => {
        switch (sport) {
          case 'nfl':
            const nflLogos: { [key: string]: string } = {
              'Arizona': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
              'Atlanta': 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
              'Baltimore': 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
              'Buffalo': 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
              'Carolina': 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
              'Chicago': 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
              'Cincinnati': 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
              'Cleveland': 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
              'Dallas': 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
              'Denver': 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
              'Detroit': 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
              'Green Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
              'Houston': 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
              'Indianapolis': 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
              'Jacksonville': 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
              'Kansas City': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
              'Las Vegas': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
              'LA Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
              'LA Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
              'Miami': 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
              'Minnesota': 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
              'New England': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
              'New Orleans': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
              'NY Giants': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
              'NY Jets': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
              'Philadelphia': 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
              'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
              'San Francisco': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
              'Seattle': 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
              'Tampa Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
              'Tennessee': 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
              'Washington': 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
            };
            return nflLogos[teamName] || '';
          case 'nba':
            return getNBATeamLogo(teamName);
          case 'ncaab':
            return getNCAABTeamLogo(teamName);
          default:
            return '';
        }
      };

      const getTeamColors = (teamName: string, sport: string) => {
        switch (sport) {
          case 'nfl':
            return getNFLTeamColors(teamName);
          case 'cfb':
            return getCFBTeamColors(teamName);
          case 'nba':
            return getNBATeamColors(teamName);
          case 'ncaab':
            return getNCAABTeamColors(teamName);
          default:
            return { primary: '#10b981', secondary: '#10b981' };
        }
      };

      // Format game date and time properly (e.g., "Mon, Dec 1" and "7:30 PM EST")
      const formatGameDateTime = (dateString: string) => {
        try {
          let date: Date;
          
          // Check if dateString is in YYYY-MM-DD format
          const yyyyMmDdPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
          const match = dateString.match(yyyyMmDdPattern);
          
          if (match) {
            // Parse as local date to avoid timezone conversion issues
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1; // Month is 0-indexed
            const day = parseInt(match[3], 10);
            date = new Date(year, month, day);
          } else {
            // For other formats, use standard Date parsing
            date = new Date(dateString);
          }
          
          // Format date as "Mon, Dec 1"
          const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
          
          // Format time as "7:30 PM EST"
          const formattedTime = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }) + ' EST';
          
          return { formattedDate, formattedTime };
        } catch (error) {
          return { formattedDate: dateString, formattedTime: '' };
        }
      };

      const rawGameDate = selectedGame?.gameDate || new Date().toISOString();
      const { formattedDate, formattedTime } = formatGameDateTime(rawGameDate);
      
      const archivedGameData = selectedGame ? {
        awayTeam: selectedGame.awayTeam,
        homeTeam: selectedGame.homeTeam,
        awayLogo: getTeamLogo(selectedGame.awayTeam, league),
        homeLogo: getTeamLogo(selectedGame.homeTeam, league),
        gameDate: formattedDate,
        gameTime: formattedTime,
        rawGameDate: rawGameDate, // Store the raw date (YYYY-MM-DD or ISO format) for filtering
        awaySpread: selectedGame.awaySpread,
        homeSpread: selectedGame.homeSpread,
        awayMl: selectedGame.awayML,
        homeMl: selectedGame.homeML,
        overLine: selectedGame.total,
        homeTeamColors: getTeamColors(selectedGame.homeTeam, league),
        awayTeamColors: getTeamColors(selectedGame.awayTeam, league),
        archived_at: new Date().toISOString(),
      } : null;

      const pickData: any = {
        game_id: selectedGameId,
        game_type: league,
        editor_id: user.id,
        selected_bet_type: pickType,
        pick_value: pickValue.trim(),
        best_price: bestPrice.trim() || null,
        sportsbook: sportsbook.trim() || null,
        units: units ? parseFloat(units) : null,
        editors_notes: editorsNotes.trim() || null,
        is_published: publish,
        is_free_pick: isFreePick,
        updated_at: new Date().toISOString(),
      };

      // Only include bet_type if it has a value (not empty string)
      if (betType && betType.trim()) {
        pickData.bet_type = betType.trim();
      }

      // Only archive game data on first save or if not already archived
      if (archivedGameData && (!isEditing || !editingPick?.archived_game_data)) {
        pickData.archived_game_data = archivedGameData;
      }

      if (isEditing && editingPick) {
        // Update existing pick
        const { error } = await supabase
          .from('editors_picks')
          .update(pickData)
          .eq('id', editingPick.id);

        if (error) throw error;

        // Post to Discord if publishing
        if (publish && !editingPick.is_published) {
          await postToDiscord(editingPick.id, pickData);
        }

        toast({
          title: publish ? 'Pick Published' : 'Draft Saved',
          description: publish ? 'Your editor pick is now visible to all users.' : 'Your changes have been saved.',
        });
      } else {
        // Create new pick
        const { data, error } = await supabase
          .from('editors_picks')
          .insert({
            ...pickData,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }

        // Post to Discord if publishing
        if (publish && data) {
          await postToDiscord(data.id, pickData);
        }

        toast({
          title: publish ? 'Pick Published' : 'Draft Created',
          description: publish ? 'Your editor pick is now visible to all users.' : 'Your pick has been saved as a draft.',
        });
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      debug.error('Error saving pick:', error);
      console.error('Full error details:', error);
      const errorMessage = error?.message || error?.details || 'Unknown error occurred';
      toast({
        title: 'Error',
        description: `Failed to ${isEditing ? 'update' : 'create'} pick: ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const postToDiscord = async (pickId: string, pickData: any) => {
    try {
      debug.log('🔔 Posting to Discord...');
      console.log('🔍 Discord Debug - pickData:', pickData);
      console.log('🔍 Discord Debug - selectedGame:', selectedGame);
      console.log('🔍 Discord Debug - archived_game_data:', pickData.archived_game_data);
      
      // Build gameData from archived data or selected game
      const gameDataForDiscord = pickData.archived_game_data || (selectedGame ? {
        awayTeam: selectedGame.awayTeam,
        homeTeam: selectedGame.homeTeam,
        awayLogo: getTeamLogo(selectedGame.awayTeam, league),
        homeLogo: getTeamLogo(selectedGame.homeTeam, league),
        gameDate: selectedGame.gameDate,
        gameTime: selectedGame.gameDate, // Using gameDate as gameTime
        awaySpread: selectedGame.awaySpread,
        homeSpread: selectedGame.homeSpread,
        awayMl: selectedGame.awayML,
        homeMl: selectedGame.homeML,
        overLine: selectedGame.total,
        homeTeamColors: getTeamColors(selectedGame.homeTeam, league),
        awayTeamColors: getTeamColors(selectedGame.awayTeam, league),
      } : null);
      
      // Match the exact structure from the working payload
      const discordPayload = {
        pickData: {
          editorNotes: pickData.editors_notes || '',
          gameId: pickData.game_id,
          gameType: pickData.game_type,
          selectedBetTypes: [pickData.selected_bet_type],
          id: pickId,
          pickValue: pickData.pick_value || '',
          bestPrice: pickData.best_price || '',
          sportsbook: pickData.sportsbook || '',
          units: pickData.units || null,
        },
        gameData: gameDataForDiscord ? {
          gameDate: gameDataForDiscord.gameDate,
          awaySpread: gameDataForDiscord.awaySpread,
          awayMl: gameDataForDiscord.awayMl,
          gameTime: gameDataForDiscord.gameTime,
          homeSpread: gameDataForDiscord.homeSpread,
          overLine: gameDataForDiscord.overLine,
          homeTeam: gameDataForDiscord.homeTeam,
          awayTeam: gameDataForDiscord.awayTeam,
          homeLogo: gameDataForDiscord.homeLogo,
          homeMl: gameDataForDiscord.homeMl,
          awayTeamColors: gameDataForDiscord.awayTeamColors,
          homeTeamColors: gameDataForDiscord.homeTeamColors,
          awayLogo: gameDataForDiscord.awayLogo,
        } : null,
        channelId: '1428843931889569893',
      };
      
      console.log('📤 Sending Discord payload:', JSON.stringify(discordPayload, null, 2));

      const discordResponse = await fetch('https://xna68l.buildship.run/discord-editor-pick-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload),
      });

      if (!discordResponse.ok) {
        const errorText = await discordResponse.text();
        debug.error('❌ Discord post failed:', errorText);
      } else {
        debug.log('✅ Posted to Discord successfully');
      }
    } catch (discordError) {
      debug.error('❌ Error posting to Discord:', discordError);
    }
  };

  const handleDelete = async () => {
    if (!editingPick) return;
    if (!confirm('Are you sure you want to delete this editor pick?')) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('editors_picks')
        .delete()
        .eq('id', editingPick.id);

      if (error) throw error;

      toast({
        title: 'Pick Deleted',
        description: 'Editor pick has been removed.',
      });
      onSuccess();
      handleClose();
    } catch (error) {
      debug.error('Error deleting pick:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete pick. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      // Only close if explicitly set to false (user action), not on re-renders
      if (!isOpen) {
        handleClose();
      }
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Editor Pick' : 'Create Editor Pick'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update your editor pick details' : 'Create a new editor pick for users to see'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* League Selection */}
          <div className="space-y-2">
            <Label htmlFor="league">League *</Label>
            <Select value={league} onValueChange={setLeague} disabled={isEditing}>
              <SelectTrigger id="league">
                <SelectValue placeholder="Select a league" />
              </SelectTrigger>
              <SelectContent>
                {leagueOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Game Selection */}
          <div className="space-y-2">
            <Label htmlFor="game">Game *</Label>
            <Select 
              value={selectedGameId} 
              onValueChange={setSelectedGameId}
              disabled={!league || loadingGames || isEditing}
            >
              <SelectTrigger id="game">
                {loadingGames ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading games...</span>
                  </div>
                ) : (
                  <SelectValue placeholder={league ? "Select a game" : "Select a league first"} />
                )}
              </SelectTrigger>
              <SelectContent>
                {games.map(game => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.displayText}
                  </SelectItem>
                ))}
                {games.length === 0 && league && !loadingGames && (
                  <SelectItem value="_no_games" disabled>
                    No upcoming games found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Pick Type */}
          <div className="space-y-2">
            <Label htmlFor="pickType">Pick Type *</Label>
            <Select value={pickType} onValueChange={setPickType}>
              <SelectTrigger id="pickType">
                <SelectValue placeholder="Select pick type" />
              </SelectTrigger>
              <SelectContent>
                {pickTypeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bet Type */}
          <div className="space-y-2">
            <Label htmlFor="betType">Bet Type (Optional)</Label>
            <Select 
              value={betType || undefined} 
              onValueChange={(value) => setBetType(value)}
            >
              <SelectTrigger id="betType">
                <SelectValue placeholder="Select bet type (optional)" />
              </SelectTrigger>
              <SelectContent>
                {betTypeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {betType && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBetType('')}
                className="h-6 text-xs"
              >
                Clear selection
              </Button>
            )}
          </div>

          {/* Pick Value */}
          <div className="space-y-2">
            <Label htmlFor="pickValue">Pick Value *</Label>
            <Input
              id="pickValue"
              placeholder="e.g., 49ers -3.5 or Over 47.5"
              value={pickValue}
              onChange={(e) => setPickValue(e.target.value)}
            />
          </div>

          {/* Best Price */}
          <div className="space-y-2">
            <Label htmlFor="bestPrice">Best Price</Label>
            <Input
              id="bestPrice"
              placeholder="e.g., -110"
              value={bestPrice}
              onChange={(e) => setBestPrice(e.target.value)}
            />
          </div>

          {/* Sportsbook */}
          <div className="space-y-2">
            <Label htmlFor="sportsbook">Sportsbook</Label>
            <Input
              id="sportsbook"
              placeholder="e.g., FanDuel"
              value={sportsbook}
              onChange={(e) => setSportsbook(e.target.value)}
            />
          </div>

          {/* Units */}
          <div className="space-y-2">
            <Label htmlFor="units">Units</Label>
            <Select value={units} onValueChange={setUnits}>
              <SelectTrigger id="units">
                <SelectValue placeholder="Select units (0.5-5)" />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Free Pick Toggle */}
          <div className="flex items-center space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <Checkbox
              id="freePick"
              checked={isFreePick}
              onCheckedChange={(checked) => setIsFreePick(checked === true)}
            />
            <Label htmlFor="freePick" className="cursor-pointer text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Mark as Free Pick (visible to all users)
            </Label>
          </div>

          {/* Editor's Analysis */}
          <div className="space-y-2">
            <Label htmlFor="editorsNotes">Editor's Analysis</Label>
            <Textarea
              id="editorsNotes"
              placeholder="Share your analysis and reasoning for this pick..."
              value={editorsNotes}
              onChange={(e) => setEditorsNotes(e.target.value)}
              className="min-h-[120px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handlePublish}
              disabled={submitting || deleting}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Publish
            </Button>
            <Button
              onClick={handleSaveDraft}
              disabled={submitting || deleting}
              variant="outline"
              className="flex-1"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
            {isEditing && (
              <Button
                onClick={handleDelete}
                disabled={submitting || deleting}
                variant="destructive"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

