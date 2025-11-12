import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TailingAvatarList } from './TailingAvatarList';
import { TailPickDialog } from './TailPickDialog';
import { useGameTails } from '@/hooks/useGameTails';
import { useAuth } from '@/contexts/AuthContext';
import { Users, UserPlus, UserMinus, ArrowRightLeft, BarChart, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameTailSectionProps {
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
  compact?: boolean;
}

export function GameTailSection({
  gameUniqueId,
  sport,
  homeTeam,
  awayTeam,
  lines,
  compact = false,
}: GameTailSectionProps) {
  const { user } = useAuth();
  const { tails, userTail, createGameTail, deleteGameTail, loading } = useGameTails(gameUniqueId);
  const [showDialog, setShowDialog] = useState(false);

  const handleSubmitTail = async (
    teamSelection: 'home' | 'away',
    pickType: 'moneyline' | 'spread' | 'over_under'
  ) => {
    const result = await createGameTail(sport, teamSelection, pickType);
    if (result.success) {
      setShowDialog(false);
    }
  };

  const handleRemoveTail = async () => {
    if (!userTail) return;
    await deleteGameTail(userTail.id);
  };

  // Group tails by pick type and team
  const tailsByPick = tails.reduce((acc, tail) => {
    const key = `${tail.team_selection}_${tail.pick_type}`;
    if (!acc[key]) {
      acc[key] = {
        teamSelection: tail.team_selection,
        pickType: tail.pick_type,
        users: [],
      };
    }
    acc[key].users.push({
      user_id: tail.user_id,
      display_name: tail.user?.display_name,
      email: tail.user?.email,
    });
    return acc;
  }, {} as Record<string, any>);

  const pickTypeLabels = {
    moneyline: 'ML',
    spread: 'Spread',
    over_under: 'O/U',
  };

  const getDisplayLabel = (teamSelection: 'home' | 'away', pickType: string) => {
    if (pickType === 'over_under') {
      return teamSelection === 'home' ? 'Over' : 'Under';
    }
    return teamSelection === 'home' ? homeTeam : awayTeam;
  };

  // Helper function to get pick type icon
  const getPickTypeIcon = (pickType: string) => {
    if (pickType === 'spread') return ArrowRightLeft;
    if (pickType === 'over_under') return BarChart;
    if (pickType === 'moneyline') return DollarSign;
    return ArrowRightLeft;
  };

  // Helper function to get pick type color classes
  const getPickTypeColorClasses = (pickType: string) => {
    if (pickType === 'spread') {
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    }
    if (pickType === 'over_under') {
      return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    }
    if (pickType === 'moneyline') {
      return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    }
    return 'bg-white/10 text-white border-white/20';
  };

  if (!user) {
    return null; // Don't show tailing section if not logged in
  }

  return (
    <>
      <div className={cn('space-y-3', compact && 'space-y-2')}>
        {/* Action Button */}
        <div className="flex items-center gap-2">
          {userTail ? (
            <Button
              variant="outline"
              size={compact ? 'sm' : 'default'}
              onClick={handleRemoveTail}
              disabled={loading}
              className="flex-1"
            >
              <UserMinus className="h-4 w-4 mr-2" />
              Remove Tail
            </Button>
          ) : (
            <Button
              variant="default"
              size={compact ? 'sm' : 'default'}
              onClick={() => setShowDialog(true)}
              disabled={loading}
              className="flex-1"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Tail This Pick
            </Button>
          )}
          
          {tails.length > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {tails.length}
            </Badge>
          )}
        </div>

        {/* Tailing Users Display */}
        {tails.length > 0 && (
          <div className="space-y-2">
            {Object.entries(tailsByPick).map(([key, data]) => {
              const PickTypeIcon = getPickTypeIcon(data.pickType);
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 text-xs flex-wrap"
                >
                  <Badge className={`${getPickTypeColorClasses(data.pickType)} flex items-center gap-1.5 shrink-0 text-[10px]`}>
                    <PickTypeIcon className="h-3 w-3" />
                    <span>
                      {getDisplayLabel(data.teamSelection, data.pickType)}{' '}
                      {data.pickType !== 'over_under' && pickTypeLabels[data.pickType]}
                    </span>
                  </Badge>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <TailingAvatarList users={data.users} size="sm" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {userTail && (
          <div className="text-xs text-muted-foreground">
            You're tailing: {getDisplayLabel(userTail.team_selection, userTail.pick_type)}{' '}
            {userTail.pick_type !== 'over_under' && pickTypeLabels[userTail.pick_type]}
          </div>
        )}
      </div>

      <TailPickDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        gameUniqueId={gameUniqueId}
        sport={sport}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        lines={lines}
        onSubmit={handleSubmitTail}
        existingTail={userTail}
      />
    </>
  );
}

