import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Users, AlertCircle, Filter } from 'lucide-react';
import { CommunityPickCard } from '@/components/CommunityPickCard';
import { PickSubmissionModal, PickFormData } from '@/components/PickSubmissionModal';
import { toast } from 'sonner';
import debug from '@/utils/debug';

interface CommunityPick {
  id: string;
  user_id: string;
  sport: string;
  is_native_pick: boolean;
  game_id?: string;
  team_name: string;
  pick_type: string;
  pick_details: string;
  reasoning?: string;
  game_date: string;
  opponent_team?: string;
  upvotes: number;
  downvotes: number;
  outcome?: string;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

interface UserVote {
  pick_id: string;
  vote_type: 'upvote' | 'downvote';
}

interface UserProfile {
  user_id: string;
  display_name?: string;
  email?: string;
}

const sportTabs = [
  { value: 'all', label: 'All Sports' },
  { value: 'nfl', label: 'NFL' },
  { value: 'cfb', label: 'CFB' },
  { value: 'nba', label: 'NBA' },
  { value: 'ncaab', label: 'NCAAB' },
  { value: 'mlb', label: 'MLB' },
];

export default function CommunityVoting() {
  const { user } = useAuth();
  const [picks, setPicks] = useState<CommunityPick[]>([]);
  const [userVotes, setUserVotes] = useState<UserVote[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  
  // Filters
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [selectedSport, setSelectedSport] = useState('all');
  const [sortBy, setSortBy] = useState<'votes' | 'newest' | 'oldest'>('votes');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'win' | 'loss' | 'push'>('all');

  useEffect(() => {
    if (user) {
      fetchPicks();
      fetchUserVotes();
    }
  }, [user, activeTab, selectedSport]);

  const fetchPicks = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('community_picks')
        .select('*');

      // Filter by active/history
      const today = new Date().toISOString().split('T')[0];
      if (activeTab === 'active') {
        query = query
          .gte('game_date', today)
          .eq('is_locked', false);
      } else {
        query = query.or(`game_date.lt.${today},is_locked.eq.true`);
      }

      // Filter by sport
      if (selectedSport !== 'all') {
        query = query.eq('sport', selectedSport);
      }

      // Sort
      if (sortBy === 'votes') {
        // We'll sort in memory since we need upvotes - downvotes
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: true });
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        debug.error('Error fetching picks:', fetchError);
        setError(fetchError.message);
        return;
      }

      let picksData = data || [];

      // Sort by votes in memory
      if (sortBy === 'votes') {
        picksData = picksData.sort((a, b) => {
          const aVotes = a.upvotes - a.downvotes;
          const bVotes = b.upvotes - b.downvotes;
          return bVotes - aVotes;
        });
      }

      setPicks(picksData);

      // Fetch user profiles for all picks
      const userIds = [...new Set(picksData.map(p => p.user_id))];
      await fetchUserProfiles(userIds);

    } catch (err: any) {
      debug.error('Exception fetching picks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfiles = async (userIds: string[]) => {
    if (userIds.length === 0) return;

    try {
      // First try to get from profiles table
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      // Then get emails from auth.users (we may need to use a function for this)
      const { data: usersData } = await supabase
        .from('admin_user_data')
        .select('id, email')
        .in('id', userIds);

      const profilesMap = new Map<string, UserProfile>();
      
      profilesData?.forEach(profile => {
        profilesMap.set(profile.user_id, {
          user_id: profile.user_id,
          display_name: profile.display_name,
        });
      });

      usersData?.forEach(userData => {
        const existing = profilesMap.get(userData.id);
        profilesMap.set(userData.id, {
          ...existing,
          user_id: userData.id,
          email: userData.email,
        });
      });

      setUserProfiles(profilesMap);
    } catch (err) {
      debug.error('Error fetching user profiles:', err);
    }
  };

  const fetchUserVotes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('community_pick_votes')
        .select('pick_id, vote_type')
        .eq('user_id', user.id);

      if (error) {
        debug.error('Error fetching user votes:', error);
        return;
      }

      setUserVotes(data || []);
    } catch (err) {
      debug.error('Exception fetching user votes:', err);
    }
  };

  const handleVote = async (pickId: string, voteType: 'upvote' | 'downvote') => {
    if (!user) return;

    try {
      const existingVote = userVotes.find(v => v.pick_id === pickId);

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Remove vote (un-vote)
          const { error } = await supabase
            .from('community_pick_votes')
            .delete()
            .eq('pick_id', pickId)
            .eq('user_id', user.id);

          if (error) throw error;

          setUserVotes(userVotes.filter(v => v.pick_id !== pickId));
        } else {
          // Change vote
          const { error } = await supabase
            .from('community_pick_votes')
            .update({ vote_type: voteType })
            .eq('pick_id', pickId)
            .eq('user_id', user.id);

          if (error) throw error;

          setUserVotes(userVotes.map(v => 
            v.pick_id === pickId ? { ...v, vote_type: voteType } : v
          ));
        }
      } else {
        // Add new vote
        const { error } = await supabase
          .from('community_pick_votes')
          .insert({
            pick_id: pickId,
            user_id: user.id,
            vote_type: voteType,
          });

        if (error) throw error;

        setUserVotes([...userVotes, { pick_id: pickId, vote_type: voteType }]);
      }

      // Refresh picks to get updated vote counts
      await fetchPicks();
    } catch (err: any) {
      debug.error('Error voting:', err);
      toast.error('Failed to vote');
    }
  };

  const handleSubmitPick = async (formData: PickFormData) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('community_picks')
        .insert({
          user_id: user.id,
          sport: formData.sport,
          is_native_pick: formData.is_native_pick,
          game_id: formData.game_id,
          team_name: formData.team_name,
          pick_type: formData.pick_type,
          pick_details: formData.pick_details,
          reasoning: formData.reasoning,
          game_date: formData.game_date,
          opponent_team: formData.opponent_team,
        });

      if (error) throw error;

      await fetchPicks();
      setShowSubmitModal(false);
    } catch (err: any) {
      debug.error('Error submitting pick:', err);
      throw err;
    }
  };

  const handleDeletePick = async (pickId: string) => {
    try {
      const { error } = await supabase
        .from('community_picks')
        .delete()
        .eq('id', pickId);

      if (error) throw error;

      toast.success('Pick deleted');
      await fetchPicks();
    } catch (err: any) {
      debug.error('Error deleting pick:', err);
      toast.error('Failed to delete pick');
    }
  };

  const filteredPicks = picks.filter(pick => {
    if (activeTab === 'history' && outcomeFilter !== 'all') {
      return pick.outcome === outcomeFilter;
    }
    return true;
  });

  const groupedPicks = filteredPicks.reduce((acc, pick) => {
    if (!acc[pick.sport]) {
      acc[pick.sport] = [];
    }
    acc[pick.sport].push(pick);
    return acc;
  }, {} as Record<string, CommunityPick[]>);

  if (loading && picks.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Community Picks</h1>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                BETA
              </span>
            </div>
            <p className="text-muted-foreground">
              Share and vote on betting picks from the community
            </p>
          </div>
        </div>
        <Button onClick={() => setShowSubmitModal(true)} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Submit Pick
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            {/* Sport tabs */}
            <div className="flex-1">
              <Tabs value={selectedSport} onValueChange={setSelectedSport}>
                <TabsList className="flex-wrap h-auto">
                  {sportTabs.map(tab => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Sort dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="votes">Most Votes</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active/History Tabs */}
      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="active">Active Picks</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6 mt-6">
          {filteredPicks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No active picks yet</h3>
                <p className="text-muted-foreground mb-4">
                  Be the first to submit a pick for upcoming games!
                </p>
                <Button onClick={() => setShowSubmitModal(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Submit First Pick
                </Button>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedPicks).map(([sport, sportPicks]) => (
              <div key={sport} className="space-y-4">
                <h2 className="text-xl font-bold uppercase">{sport}</h2>
                <div className="space-y-4">
                  {sportPicks.map(pick => {
                    const profile = userProfiles.get(pick.user_id);
                    const userVote = userVotes.find(v => v.pick_id === pick.id);
                    
                    return (
                      <CommunityPickCard
                        key={pick.id}
                        pick={pick}
                        userDisplayName={profile?.display_name}
                        userEmail={profile?.email}
                        userVote={userVote?.vote_type}
                        onVote={handleVote}
                        onDelete={handleDeletePick}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6 mt-6">
          {/* Outcome filter for history */}
          <div className="flex items-center gap-2">
            <Select value={outcomeFilter} onValueChange={(value: any) => setOutcomeFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                <SelectItem value="win">Wins Only</SelectItem>
                <SelectItem value="loss">Losses Only</SelectItem>
                <SelectItem value="push">Pushes Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredPicks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No historical picks</h3>
                <p className="text-muted-foreground">
                  Completed picks will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedPicks).map(([sport, sportPicks]) => (
              <div key={sport} className="space-y-4">
                <h2 className="text-xl font-bold uppercase">{sport}</h2>
                <div className="space-y-4">
                  {sportPicks.map(pick => {
                    const profile = userProfiles.get(pick.user_id);
                    const userVote = userVotes.find(v => v.pick_id === pick.id);
                    
                    return (
                      <CommunityPickCard
                        key={pick.id}
                        pick={pick}
                        userDisplayName={profile?.display_name}
                        userEmail={profile?.email}
                        userVote={userVote?.vote_type}
                        onVote={handleVote}
                        onDelete={handleDeletePick}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Submit Modal */}
      <PickSubmissionModal
        open={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onSubmit={handleSubmitPick}
      />
    </div>
  );
}

