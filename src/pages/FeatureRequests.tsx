import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import debug from '@/utils/debug';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  Clock,
  Rocket,
  Plus,
  Loader2,
  MapPin,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  submitted_by: string;
  submitter_display_name: string;
  status: 'pending' | 'approved' | 'roadmap';
  roadmap_status: 'planned' | 'in_progress' | 'completed' | null;
  upvotes: number;
  downvotes: number;
  created_at: string;
  updated_at: string;
}

interface UserVote {
  feature_request_id: string;
  vote_type: 'upvote' | 'downvote';
}

export default function FeatureRequests() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { adminModeEnabled } = useAdminMode();
  
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [userVotes, setUserVotes] = useState<UserVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Redirect to welcome page if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  // Fetch user's display name
  useEffect(() => {
    async function fetchDisplayName() {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data) {
        setDisplayName(data.display_name || '');
      }
    }
    
    fetchDisplayName();
  }, [user]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch feature requests
      let query = supabase.from('feature_requests').select('*');
      
      // Only show approved and roadmap requests if admin mode is not enabled
      if (!adminModeEnabled) {
        query = query.in('status', ['approved', 'roadmap']);
      }

      const { data: requestsData, error: requestsError } = await query.order('created_at', { ascending: false });

      if (requestsError) {
        throw requestsError;
      }

      setRequests((requestsData || []) as FeatureRequest[]);

      // Fetch pending count (always, for public display)
      const { count: pendingCountData, error: pendingCountError } = await supabase
        .from('feature_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (!pendingCountError && pendingCountData !== null) {
        setPendingCount(pendingCountData);
      }

      // Fetch user's votes
      if (user) {
        const { data: votesData, error: votesError } = await supabase
          .from('feature_request_votes')
          .select('feature_request_id, vote_type')
          .eq('user_id', user.id);

        if (!votesError) {
          setUserVotes((votesData || []) as UserVote[]);
        }
      }
    } catch (err) {
      debug.error('Error fetching feature requests:', err);
      setError(`Failed to load feature requests: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [adminModeEnabled, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('You must be logged in to submit a feature request');
      return;
    }

    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('feature_requests')
        .insert({
          title: title.trim(),
          description: description.trim(),
          submitted_by: user.id,
          submitter_display_name: displayName || 'Anonymous',
          status: 'pending',
        });

      if (error) throw error;

      toast.success('Feature request submitted! Our team will review it soon.');
      setTitle('');
      setDescription('');
      setSubmitDialogOpen(false);
      fetchRequests();
    } catch (err) {
      debug.error('Error submitting feature request:', err);
      toast.error('Failed to submit feature request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (requestId: string, voteType: 'upvote' | 'downvote') => {
    if (!user) {
      toast.error('You must be logged in to vote');
      return;
    }

    try {
      const existingVote = userVotes.find(v => v.feature_request_id === requestId);

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Remove vote if clicking the same vote type
          const { error } = await supabase
            .from('feature_request_votes')
            .delete()
            .eq('feature_request_id', requestId)
            .eq('user_id', user.id);

          if (error) throw error;
        } else {
          // Update vote if clicking different vote type
          const { error } = await supabase
            .from('feature_request_votes')
            .update({ vote_type: voteType })
            .eq('feature_request_id', requestId)
            .eq('user_id', user.id);

          if (error) throw error;
        }
      } else {
        // Insert new vote
        const { error } = await supabase
          .from('feature_request_votes')
          .insert({
            feature_request_id: requestId,
            user_id: user.id,
            vote_type: voteType,
          });

        if (error) throw error;
      }

      fetchRequests();
    } catch (err) {
      debug.error('Error voting:', err);
      toast.error('Failed to register vote. Please try again.');
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('feature_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Feature request approved');
      fetchRequests();
    } catch (err) {
      debug.error('Error approving request:', err);
      toast.error('Failed to approve request');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('feature_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Feature request rejected');
      fetchRequests();
    } catch (err) {
      debug.error('Error rejecting request:', err);
      toast.error('Failed to reject request');
    }
  };

  const handleMoveToRoadmap = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('feature_requests')
        .update({ 
          status: 'roadmap',
          roadmap_status: 'planned'
        })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Moved to roadmap');
      fetchRequests();
    } catch (err) {
      debug.error('Error moving to roadmap:', err);
      toast.error('Failed to move to roadmap');
    }
  };

  const handleDelete = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this feature request? This action cannot be undone.')) {
      return;
    }

    try {
      // First delete all votes associated with this request
      const { error: votesError } = await supabase
        .from('feature_request_votes')
        .delete()
        .eq('feature_request_id', requestId);

      if (votesError) throw votesError;

      // Then delete the request itself
      const { error } = await supabase
        .from('feature_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Feature request deleted');
      fetchRequests();
    } catch (err) {
      debug.error('Error deleting request:', err);
      toast.error('Failed to delete request');
    }
  };

  const handleUpdateRoadmapStatus = async (requestId: string, newStatus: 'planned' | 'in_progress' | 'completed') => {
    try {
      const { error } = await supabase
        .from('feature_requests')
        .update({ roadmap_status: newStatus })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Roadmap status updated');
      fetchRequests();
    } catch (err) {
      debug.error('Error updating roadmap status:', err);
      toast.error('Failed to update roadmap status');
    }
  };

  const handleRemoveFromRoadmap = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('feature_requests')
        .update({ 
          status: 'approved',
          roadmap_status: null
        })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Removed from roadmap');
      fetchRequests();
    } catch (err) {
      debug.error('Error removing from roadmap:', err);
      toast.error('Failed to remove from roadmap');
    }
  };

  const getUserVote = (requestId: string) => {
    return userVotes.find(v => v.feature_request_id === requestId);
  };

  const renderFeatureCard = (request: FeatureRequest) => {
    const userVote = getUserVote(request.id);
    const netVotes = request.upvotes - request.downvotes;

    return (
      <motion.div
        key={request.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="bg-card/50 backdrop-blur-sm border">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {/* Vote Section */}
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`p-2 ${
                    userVote?.vote_type === 'upvote'
                      ? 'text-green-600 dark:text-green-400 bg-green-500/20'
                      : 'text-muted-foreground hover:text-green-600 dark:hover:text-green-400 hover:bg-green-500/10'
                  }`}
                  onClick={() => handleVote(request.id, 'upvote')}
                >
                  <ThumbsUp className="h-4 w-4" />
                </Button>
                <Badge className={`${
                  netVotes > 0 ? 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30' :
                  netVotes < 0 ? 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30' :
                  'bg-muted text-muted-foreground border'
                }`}>
                  {netVotes > 0 ? '+' : ''}{netVotes}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`p-2 ${
                    userVote?.vote_type === 'downvote'
                      ? 'text-red-600 dark:text-red-400 bg-red-500/20'
                      : 'text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10'
                  }`}
                  onClick={() => handleVote(request.id, 'downvote')}
                >
                  <ThumbsDown className="h-4 w-4" />
                </Button>
              </div>

              {/* Content Section */}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground mb-2">{request.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{request.description}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Submitted by {request.submitter_display_name}</span>
                    <span>•</span>
                    <span>{new Date(request.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Admin Controls */}
                  {adminModeEnabled && request.status === 'approved' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-purple-500 hover:bg-purple-600 text-white"
                        onClick={() => handleMoveToRoadmap(request.id)}
                      >
                        <MapPin className="h-3 w-3 mr-1" />
                        Move to Roadmap
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(request.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const renderPendingCard = (request: FeatureRequest) => {
    return (
      <motion.div
        key={request.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="bg-yellow-500/10 backdrop-blur-sm border border-yellow-500/30">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-foreground">{request.title}</h3>
                  <Badge className="bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 border border-yellow-500/30">
                    Pending
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{request.description}</p>
                
                <div className="text-xs text-muted-foreground">
                  <span>Submitted by {request.submitter_display_name}</span>
                  <span> • </span>
                  <span>{new Date(request.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => handleApprove(request.id)}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReject(request.id)}
                >
                  Reject
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const renderRoadmapCard = (request: FeatureRequest) => {
    const statusConfig = {
      planned: { 
        icon: Clock, 
        label: 'Planned',
        cardClass: 'bg-blue-500/10 backdrop-blur-sm border border-blue-500/30',
        iconBgClass: 'p-2 rounded-lg bg-blue-500/20',
        iconClass: 'h-5 w-5 text-blue-600 dark:text-blue-400',
        badgeClass: 'bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-500/30'
      },
      in_progress: { 
        icon: Rocket, 
        label: 'In Progress',
        cardClass: 'bg-purple-500/10 backdrop-blur-sm border border-purple-500/30',
        iconBgClass: 'p-2 rounded-lg bg-purple-500/20',
        iconClass: 'h-5 w-5 text-purple-600 dark:text-purple-400',
        badgeClass: 'bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/30'
      },
      completed: { 
        icon: CheckCircle, 
        label: 'Completed',
        cardClass: 'bg-green-500/10 backdrop-blur-sm border border-green-500/30',
        iconBgClass: 'p-2 rounded-lg bg-green-500/20',
        iconClass: 'h-5 w-5 text-green-600 dark:text-green-400',
        badgeClass: 'bg-green-500/20 text-green-800 dark:text-green-300 border border-green-500/30'
      },
    };

    const config = statusConfig[request.roadmap_status || 'planned'];
    const Icon = config.icon;

    return (
      <motion.div
        key={request.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={config.cardClass}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className={config.iconBgClass}>
                <Icon className={config.iconClass} />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-foreground">{request.title}</h3>
                  <Badge className={config.badgeClass}>
                    {config.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{request.description}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Votes: {request.upvotes - request.downvotes}</span>
                    <span>•</span>
                    <span>By {request.submitter_display_name}</span>
                  </div>

                  {/* Admin Controls */}
                  {adminModeEnabled && (
                    <div className="flex gap-2">
                      <Select
                        value={request.roadmap_status || 'planned'}
                        onValueChange={(value: 'planned' | 'in_progress' | 'completed') =>
                          handleUpdateRoadmapStatus(request.id, value)
                        }
                      >
                        <SelectTrigger className="w-[140px] bg-background border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                        onClick={() => handleRemoveFromRoadmap(request.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-6 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (redirect will happen)
  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-8 w-8 text-yellow-500" />
            <h1 className="text-3xl font-bold text-foreground">Feature Requests</h1>
          </div>
        </div>
        <div className="grid gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-card/50 border">
              <CardContent className="pt-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const roadmapRequests = requests.filter(r => r.status === 'roadmap');
  
  const plannedItems = roadmapRequests.filter(r => r.roadmap_status === 'planned');
  const inProgressItems = roadmapRequests.filter(r => r.roadmap_status === 'in_progress');
  const completedItems = roadmapRequests.filter(r => r.roadmap_status === 'completed');

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-8 w-8 text-yellow-500" />
            <h1 className="text-3xl font-bold text-foreground">Feature Requests</h1>
          </div>
          {pendingCount > 0 && (
            <Badge className="bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 border border-yellow-500/30">
              Submissions in Review: {pendingCount}
            </Badge>
          )}
        </div>
        
        <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-500 hover:bg-green-600 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Submit Request
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-background border">
            <DialogHeader>
              <DialogTitle>Submit a Feature Request</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Share your ideas to help us improve WagerProof
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Brief description of your feature idea"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-background border"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Provide more details about your feature request..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-background border min-h-[120px]"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSubmitDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert className="mb-6 bg-red-500/10 border-red-500/30" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Community Voting */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-bold text-foreground">Community Voting</h2>
          </div>

          {/* Pending Requests (Admin Only) */}
          {adminModeEnabled && pendingRequests.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xl font-bold text-foreground">Pending Approval</h3>
                <Badge className="bg-yellow-500 text-white">
                  {pendingRequests.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {pendingRequests.map(renderPendingCard)}
              </div>
            </div>
          )}

          {/* Approved Requests */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-xl font-bold text-foreground">Community Features</h3>
              <Badge className="bg-green-500 text-white">
                {approvedRequests.length}
              </Badge>
            </div>
            {approvedRequests.length === 0 ? (
              <Card className="bg-card/50 border">
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Lightbulb className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h4 className="text-lg font-semibold mb-2 text-foreground">No Feature Requests Yet</h4>
                    <p className="text-muted-foreground">
                      Be the first to submit a feature request!
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {approvedRequests.map(renderFeatureCard)}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Developer Roadmap */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-bold text-foreground">Developer Roadmap</h2>
          </div>

          {/* Planned */}
          {plannedItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xl font-bold text-foreground">Planned</h3>
                <Badge className="bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-500/30">
                  {plannedItems.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {plannedItems.map(renderRoadmapCard)}
              </div>
            </div>
          )}

          {/* In Progress */}
          {inProgressItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Rocket className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                <h3 className="text-xl font-bold text-foreground">In Progress</h3>
                <Badge className="bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/30">
                  {inProgressItems.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {inProgressItems.map(renderRoadmapCard)}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                <h3 className="text-xl font-bold text-foreground">Completed</h3>
                <Badge className="bg-green-500/20 text-green-800 dark:text-green-300 border border-green-500/30">
                  {completedItems.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {completedItems.map(renderRoadmapCard)}
              </div>
            </div>
          )}

          {/* Empty State */}
          {roadmapRequests.length === 0 && (
            <Card className="bg-card/50 border">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h4 className="text-lg font-semibold mb-2 text-foreground">No Roadmap Items Yet</h4>
                  <p className="text-muted-foreground">
                    Check back soon to see what we're working on!
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

