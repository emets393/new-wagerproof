import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCircle } from './UserCircle';
import { TeamCircle } from './TeamCircle';
import { TailingAvatarList } from './TailingAvatarList';
import { ChevronUp, ChevronDown, Edit, Trash2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { useCommunityPickTails } from '@/hooks/useCommunityPickTails';
import { format } from 'date-fns';

interface CommunityPickCardProps {
  pick: {
    id: string;
    user_id: string;
    sport: string;
    is_native_pick: boolean;
    team_name: string;
    pick_type: string;
    pick_details: string;
    reasoning?: string | null;
    game_date: string;
    opponent_team?: string | null;
    upvotes: number;
    downvotes: number;
    outcome?: string | null;
    is_locked: boolean;
    created_at: string;
  };
  userDisplayName?: string;
  userEmail?: string;
  userVote?: 'upvote' | 'downvote' | null;
  onVote?: (pickId: string, voteType: 'upvote' | 'downvote') => Promise<void>;
  onEdit?: (pickId: string) => void;
  onDelete?: (pickId: string) => Promise<void>;
}

export function CommunityPickCard({
  pick,
  userDisplayName,
  userEmail,
  userVote,
  onVote,
  onEdit,
  onDelete,
}: CommunityPickCardProps) {
  const { user } = useAuth();
  const { adminModeEnabled } = useAdminMode();
  const [isVoting, setIsVoting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { tailingUsers } = useCommunityPickTails(pick.id);

  const isOwnPick = user?.id === pick.user_id;
  const canEdit = isOwnPick && !pick.is_locked && pick.upvotes === 0 && pick.downvotes === 0;
  const canDelete = isOwnPick || adminModeEnabled;

  const netVotes = pick.upvotes - pick.downvotes;

  const handleVote = async (voteType: 'upvote' | 'downvote') => {
    if (!onVote || isVoting || isOwnPick) return;
    
    setIsVoting(true);
    try {
      await onVote(pick.id, voteType);
    } finally {
      setIsVoting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;
    
    if (confirm('Are you sure you want to delete this pick?')) {
      setIsDeleting(true);
      try {
        await onDelete(pick.id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const sportColors: Record<string, string> = {
    nfl: 'bg-blue-500',
    cfb: 'bg-orange-500',
    nba: 'bg-purple-500',
    ncaab: 'bg-indigo-500',
    mlb: 'bg-green-500',
  };

  const pickTypeLabels: Record<string, string> = {
    moneyline: 'ML',
    spread: 'Spread',
    over: 'Over',
    under: 'Under',
  };

  const outcomeColors: Record<string, string> = {
    win: 'bg-green-500',
    loss: 'bg-red-500',
    push: 'bg-gray-500',
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex">
          {/* Vote sidebar */}
          <div className="flex flex-col items-center justify-start bg-muted/30 p-2 gap-1 min-w-[60px]">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900',
                userVote === 'upvote' && 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
              )}
              onClick={() => handleVote('upvote')}
              disabled={isVoting || isOwnPick}
            >
              <ChevronUp className="h-5 w-5" />
            </Button>
            
            <span className={cn(
              'font-bold text-sm',
              netVotes > 0 && 'text-green-600 dark:text-green-400',
              netVotes < 0 && 'text-red-600 dark:text-red-400'
            )}>
              {netVotes}
            </span>
            
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900',
                userVote === 'downvote' && 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
              )}
              onClick={() => handleVote('downvote')}
              disabled={isVoting || isOwnPick}
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
            
            {/* Tailing Users Display */}
            {tailingUsers.length > 0 && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <TailingAvatarList users={tailingUsers} size="sm" className="flex-col space-x-0 space-y-1" />
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                {/* User or Team Circle */}
                {pick.is_native_pick ? (
                  <TeamCircle 
                    teamName={pick.team_name} 
                    sport={pick.sport}
                    size="md"
                  />
                ) : (
                  <UserCircle
                    userId={pick.user_id}
                    displayName={userDisplayName}
                    email={userEmail}
                    size="md"
                  />
                )}

                {/* Pick details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className={cn('text-xs', sportColors[pick.sport] || 'bg-gray-500')}>
                      {pick.sport.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {pickTypeLabels[pick.pick_type] || pick.pick_type}
                    </Badge>
                    {pick.outcome && (
                      <Badge className={cn('text-xs', outcomeColors[pick.outcome])}>
                        {pick.outcome.toUpperCase()}
                      </Badge>
                    )}
                    {pick.is_locked && (
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        Locked
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-bold text-lg mb-1">
                    {pick.pick_details}
                  </h3>

                  <div className="text-sm text-muted-foreground mb-2">
                    {pick.opponent_team && (
                      <span>{pick.team_name} vs {pick.opponent_team} • </span>
                    )}
                    <span>{format(new Date(pick.game_date), 'MMM dd, yyyy')}</span>
                  </div>

                  {pick.reasoning && (
                    <p className="text-sm mt-2 text-foreground/80">
                      {pick.reasoning}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <UserCircle
                      userId={pick.user_id}
                      displayName={userDisplayName}
                      email={userEmail}
                      size="sm"
                    />
                    <span>{userDisplayName || userEmail}</span>
                    <span>•</span>
                    <span>{format(new Date(pick.created_at), 'MMM dd, h:mm a')}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              {(canEdit || canDelete) && (
                <div className="flex gap-1">
                  {canEdit && onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(pick.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

