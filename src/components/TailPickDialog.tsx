import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface TailPickDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gameUniqueId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  lines?: {
    home_ml?: number | null;
    away_ml?: number | null;
    home_spread?: number | null;
    away_spread?: number | null;
    total?: number | null;
  };
  onSubmit: (teamSelection: 'home' | 'away', pickType: 'moneyline' | 'spread' | 'over_under') => Promise<void>;
  existingTail?: {
    team_selection: 'home' | 'away';
    pick_type: 'moneyline' | 'spread' | 'over_under';
  } | null;
}

export function TailPickDialog({
  isOpen,
  onClose,
  gameUniqueId,
  sport,
  homeTeam,
  awayTeam,
  lines,
  onSubmit,
  existingTail,
}: TailPickDialogProps) {
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away' | null>(
    existingTail?.team_selection || null
  );
  const [selectedPickType, setSelectedPickType] = useState<'moneyline' | 'spread' | 'over_under' | null>(
    existingTail?.pick_type || null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOverUnderMode, setIsOverUnderMode] = useState(false);

  const handleSubmit = async () => {
    if (!selectedTeam || !selectedPickType) return;

    setIsSubmitting(true);
    try {
      await onSubmit(selectedTeam, selectedPickType);
      onClose();
    } catch (error) {
      console.error('Error submitting tail:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedTeam(existingTail?.team_selection || null);
      setSelectedPickType(existingTail?.pick_type || null);
      setIsOverUnderMode(false);
      onClose();
    }
  };

  const handleTeamOrTotalClick = (type: 'home' | 'away' | 'over_under') => {
    if (type === 'over_under') {
      setIsOverUnderMode(true);
      setSelectedTeam(null);
      setSelectedPickType('over_under');
    } else {
      setIsOverUnderMode(false);
      setSelectedTeam(type);
      setSelectedPickType(null);
    }
  };

  const formatSpread = (spread: number | null | undefined) => {
    if (!spread) return 'N/A';
    return spread > 0 ? `+${spread}` : spread.toString();
  };

  const formatMoneyline = (ml: number | null | undefined) => {
    if (!ml) return 'N/A';
    return ml > 0 ? `+${ml}` : ml.toString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {existingTail ? 'Update Your Tail' : 'Tail This Pick'}
          </DialogTitle>
          <DialogDescription>
            Select the team and pick type you want to tail
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: Select Team or Total */}
          <div>
            <h3 className="text-sm font-semibold mb-3">1. Select Pick Category</h3>
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant={selectedTeam === 'away' && !isOverUnderMode ? 'default' : 'outline'}
                className={cn(
                  'h-auto flex-col items-center gap-2 py-4',
                  selectedTeam === 'away' && !isOverUnderMode && 'ring-2 ring-primary'
                )}
                onClick={() => handleTeamOrTotalClick('away')}
              >
                {selectedTeam === 'away' && !isOverUnderMode && (
                  <Check className="h-4 w-4 absolute top-2 right-2" />
                )}
                <span className="text-xs text-muted-foreground">Away</span>
                <span className="font-bold text-base">{awayTeam}</span>
              </Button>

              <Button
                variant={selectedTeam === 'home' && !isOverUnderMode ? 'default' : 'outline'}
                className={cn(
                  'h-auto flex-col items-center gap-2 py-4',
                  selectedTeam === 'home' && !isOverUnderMode && 'ring-2 ring-primary'
                )}
                onClick={() => handleTeamOrTotalClick('home')}
              >
                {selectedTeam === 'home' && !isOverUnderMode && (
                  <Check className="h-4 w-4 absolute top-2 right-2" />
                )}
                <span className="text-xs text-muted-foreground">Home</span>
                <span className="font-bold text-base">{homeTeam}</span>
              </Button>

              <Button
                variant={isOverUnderMode ? 'default' : 'outline'}
                className={cn(
                  'h-auto flex-col items-center gap-2 py-4',
                  isOverUnderMode && 'ring-2 ring-primary'
                )}
                onClick={() => handleTeamOrTotalClick('over_under')}
              >
                {isOverUnderMode && (
                  <Check className="h-4 w-4 absolute top-2 right-2" />
                )}
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="font-bold text-base">O/U</span>
              </Button>
            </div>
          </div>

          {/* Step 2: Select Pick Type */}
          <div>
            <h3 className="text-sm font-semibold mb-3">2. Select Pick Type</h3>
            
            {/* Team-based picks */}
            {selectedTeam && !isOverUnderMode && (
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant={selectedPickType === 'moneyline' ? 'default' : 'outline'}
                  className={cn(
                    'h-auto justify-between px-4 py-3',
                    selectedPickType === 'moneyline' && 'ring-2 ring-primary'
                  )}
                  onClick={() => setSelectedPickType('moneyline')}
                >
                  <span className="font-semibold">Moneyline</span>
                  <div className="flex gap-3 items-center">
                    <Badge variant="secondary" className="text-xs">
                      {selectedTeam === 'away' 
                        ? formatMoneyline(lines?.away_ml)
                        : formatMoneyline(lines?.home_ml)}
                    </Badge>
                    {selectedPickType === 'moneyline' && <Check className="h-4 w-4" />}
                  </div>
                </Button>

                <Button
                  variant={selectedPickType === 'spread' ? 'default' : 'outline'}
                  className={cn(
                    'h-auto justify-between px-4 py-3',
                    selectedPickType === 'spread' && 'ring-2 ring-primary'
                  )}
                  onClick={() => setSelectedPickType('spread')}
                >
                  <span className="font-semibold">Spread</span>
                  <div className="flex gap-3 items-center">
                    <Badge variant="secondary" className="text-xs">
                      {selectedTeam === 'away'
                        ? formatSpread(lines?.away_spread)
                        : formatSpread(lines?.home_spread)}
                    </Badge>
                    {selectedPickType === 'spread' && <Check className="h-4 w-4" />}
                  </div>
                </Button>
              </div>
            )}

            {/* Over/Under picks */}
            {isOverUnderMode && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={selectedTeam === 'home' && selectedPickType === 'over_under' ? 'default' : 'outline'}
                  className={cn(
                    'h-auto flex-col items-center gap-2 py-4',
                    selectedTeam === 'home' && selectedPickType === 'over_under' && 'ring-2 ring-primary'
                  )}
                  onClick={() => {
                    setSelectedTeam('home');
                    setSelectedPickType('over_under');
                  }}
                >
                  {selectedTeam === 'home' && selectedPickType === 'over_under' && (
                    <Check className="h-4 w-4 absolute top-2 right-2" />
                  )}
                  <span className="font-bold text-lg">Over</span>
                  <Badge variant="secondary" className="text-xs">
                    {lines?.total || 'N/A'}
                  </Badge>
                </Button>

                <Button
                  variant={selectedTeam === 'away' && selectedPickType === 'over_under' ? 'default' : 'outline'}
                  className={cn(
                    'h-auto flex-col items-center gap-2 py-4',
                    selectedTeam === 'away' && selectedPickType === 'over_under' && 'ring-2 ring-primary'
                  )}
                  onClick={() => {
                    setSelectedTeam('away');
                    setSelectedPickType('over_under');
                  }}
                >
                  {selectedTeam === 'away' && selectedPickType === 'over_under' && (
                    <Check className="h-4 w-4 absolute top-2 right-2" />
                  )}
                  <span className="font-bold text-lg">Under</span>
                  <Badge variant="secondary" className="text-xs">
                    {lines?.total || 'N/A'}
                  </Badge>
                </Button>
              </div>
            )}

            {/* Placeholder when nothing selected */}
            {!selectedTeam && !isOverUnderMode && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Select a team or total above to continue
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedTeam || !selectedPickType || isSubmitting}
          >
            {isSubmitting ? 'Saving...' : existingTail ? 'Update Tail' : 'Tail This Pick'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

