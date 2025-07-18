
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Bookmark } from 'lucide-react';

interface SavePatternButtonProps {
  combo: string;
  features: string[];
  winPct: number;
  opponentWinPct: number;
  games: number;
  featureCount: number;
  target: string;
  dominantSide?: string; // 'primary' or 'opponent'
}

const SavePatternButton: React.FC<SavePatternButtonProps> = ({
  combo,
  features,
  winPct,
  opponentWinPct,
  games,
  featureCount,
  target,
  dominantSide
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [patternName, setPatternName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!patternName.trim()) {
      toast({
        title: "Pattern name required",
        description: "Please enter a name for this pattern.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to save patterns.",
          variant: "destructive"
        });
        return;
      }

      // Determine dominant side if not provided
      const calculatedDominantSide = dominantSide || (winPct > opponentWinPct ? 'primary' : 'opponent');
      
      const { error } = await supabase
        .from('saved_trend_patterns')
        .insert({
          user_id: user.id,
          pattern_name: patternName.trim(),
          features,
          target,
          combo,
          win_pct: winPct,
          opponent_win_pct: opponentWinPct,
          games,
          feature_count: featureCount,
          dominant_side: calculatedDominantSide
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Pattern saved!",
        description: `"${patternName}" has been saved to your patterns.`
      });

      setIsOpen(false);
      setPatternName('');
    } catch (error) {
      console.error('Error saving pattern:', error);
      toast({
        title: "Error saving pattern",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center gap-1"
        >
          <Bookmark className="h-3 w-3" />
          Save
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Trend Pattern</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pattern-name">Pattern Name</Label>
            <Input
              id="pattern-name"
              value={patternName}
              onChange={(e) => setPatternName(e.target.value)}
              placeholder="Enter a descriptive name for this pattern"
            />
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg space-y-2">
            <p className="text-sm font-medium">Pattern Details:</p>
            <p className="text-sm">Win Rate: {(winPct * 100).toFixed(1)}%</p>
            <p className="text-sm">Games: {games}</p>
            <p className="text-sm">Features: {featureCount}</p>
            <p className="text-sm">Target: {target}</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Pattern'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SavePatternButton;
