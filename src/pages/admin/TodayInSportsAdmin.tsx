import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Brain, Save, Loader2, Play, Clock, CheckCircle2, Sparkles, CalendarDays, Trash2, Upload, AlertCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { renderTextWithLinks } from '@/utils/markdownLinks';
import { 
  getTodayInSportsSchedule,
  updateTodayInSportsSchedule,
  generateTodayInSportsCompletion,
  sendTestDiscordNotification,
  getTodayInSportsCompletion,
  deleteTodayInSportsCompletion,
  publishTodayInSportsCompletion,
  TodayInSportsCompletion,
  PageLevelSchedule
} from '@/services/aiCompletionService';
import debug from '@/utils/debug';

export default function TodayInSportsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [todaySchedule, setTodaySchedule] = useState<PageLevelSchedule | null>(null);
  const [todayPrompt, setTodayPrompt] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('10:00');
  const [todayCompletion, setTodayCompletion] = useState<TodayInSportsCompletion | null>(null);
  const [generatingToday, setGeneratingToday] = useState(false);
  const [sendingDiscord, setSendingDiscord] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [todaySched, todayComp] = await Promise.all([
        getTodayInSportsSchedule(),
        getTodayInSportsCompletion(true), // Include unpublished completions in admin view
      ]);

      setTodaySchedule(todaySched);
      setTodayCompletion(todayComp);

      if (todaySched) {
        setTodayPrompt(todaySched.system_prompt);
        // Parse scheduled_time (HH:MM:SS) to HH:MM for input field
        if (todaySched.scheduled_time) {
          const timeParts = todaySched.scheduled_time.split(':');
          setScheduledTime(`${timeParts[0]}:${timeParts[1]}`);
        }
      }
    } catch (error) {
      debug.error('Error fetching Today in Sports data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load Today in Sports settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTodayPrompt = async () => {
    setSaving(true);
    try {
      // Convert HH:MM to HH:MM:SS for database
      const scheduledTimeFormatted = `${scheduledTime}:00`;
      
      const success = await updateTodayInSportsSchedule({
        system_prompt: todayPrompt,
        scheduled_time: scheduledTimeFormatted,
      });

      if (success) {
        await fetchData();
        toast({
          title: 'Saved',
          description: 'Today in Sports settings updated successfully',
        });
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      debug.error('Error saving today prompt:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateTodayCompletion = async () => {
    setGeneratingToday(true);
    try {
      // Pass force: true to always generate a new completion for testing
      const result = await generateTodayInSportsCompletion(true);
      
      if (result.success && result.completion) {
        // Immediately update the preview with the completion from the response
        // This avoids any database fetch delays and shows the preview instantly
        // Get today's date in Eastern Time using reliable method (same as TodayInSports.tsx)
        const getTodayET = () => {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          
          const parts = formatter.formatToParts(new Date());
          const year = parts.find(p => p.type === 'year')?.value;
          const month = parts.find(p => p.type === 'month')?.value;
          const day = parts.find(p => p.type === 'day')?.value;
          
          return `${year}-${month}-${day}`;
        };
        const today = getTodayET();
        
        const newCompletion: TodayInSportsCompletion = {
          id: result.completion_id || 'temp-' + Date.now(),
          completion_date: today,
          completion_text: result.completion,
          generated_at: new Date().toISOString(),
          published: true,
          sent_to_discord: false,
          discord_message_id: null,
        };
        
        // Set the completion immediately to show preview
        setTodayCompletion(newCompletion);
        
        // Invalidate React Query cache so public page refreshes immediately
        queryClient.invalidateQueries({ queryKey: ['today-in-sports-completion'] });
        
        // Try to fetch the full completion object in the background (for accurate sent_to_discord status)
        // But don't wait for it - show preview immediately
        getTodayInSportsCompletion(true) // Include unpublished to get the latest
          .then(fullCompletion => {
            if (fullCompletion) {
              setTodayCompletion(fullCompletion);
              // Invalidate again after fetching to ensure public page has latest data
              queryClient.invalidateQueries({ queryKey: ['today-in-sports-completion'] });
            }
          })
          .catch(fetchError => {
            debug.error('Error fetching completion after generation:', fetchError);
            // Keep showing the completion we already set
          });
        
        toast({
          title: 'Success',
          description: 'Today in Sports completion generated successfully',
        });
      } else {
        throw new Error(result.error || 'Generation failed');
      }
    } catch (error) {
      debug.error('Error generating today completion:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate completion',
        variant: 'destructive'
      });
    } finally {
      setGeneratingToday(false);
    }
  };

  const handleTestDiscord = async () => {
    if (!todayCompletion) {
      toast({
        title: 'No Completion Available',
        description: 'Generate a completion first before testing Discord',
        variant: 'destructive'
      });
      return;
    }

    setSendingDiscord(true);
    try {
      const result = await sendTestDiscordNotification(todayCompletion.completion_text);
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Test message sent to Discord successfully',
        });
      } else {
        // Show detailed error message with configuration help
        const errorMessage = result.error || 'Send failed';
        const errorDetails = result.details || '';
        
        const fullMessage = errorDetails 
          ? `${errorMessage}\n\n${errorDetails}`
          : errorMessage;
        
        toast({
          title: 'Discord Configuration Error',
          description: fullMessage,
          variant: 'destructive',
          duration: 10000, // Show longer for configuration errors
        });
      }
    } catch (error) {
      debug.error('Error sending to Discord:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send to Discord',
        variant: 'destructive'
      });
    } finally {
      setSendingDiscord(false);
    }
  };

  const handleClearCompletion = async () => {
    setClearing(true);
    try {
      const result = await deleteTodayInSportsCompletion();
      
      if (result.success) {
        setTodayCompletion(null);
        // Invalidate React Query cache so public page refreshes
        queryClient.invalidateQueries({ queryKey: ['today-in-sports-completion'] });
        toast({
          title: 'Success',
          description: 'Today in Sports completion cleared successfully',
        });
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      debug.error('Error clearing completion:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to clear completion',
        variant: 'destructive'
      });
    } finally {
      setClearing(false);
    }
  };

  const handlePublishCompletion = async () => {
    if (!todayCompletion) {
      toast({
        title: 'No Completion Available',
        description: 'Generate a completion first before publishing',
        variant: 'destructive'
      });
      return;
    }

    setPublishing(true);
    try {
      // Toggle publish status - if already published, unpublish it; otherwise publish it
      const newPublishedStatus = !todayCompletion.published;
      
      const result = await publishTodayInSportsCompletion(
        todayCompletion.id,
        newPublishedStatus,
        todayCompletion.completion_text
      );
      
      if (result.success) {
        // Update local state immediately
        setTodayCompletion({
          ...todayCompletion,
          published: newPublishedStatus,
        });
        
        // Refresh to get the updated completion from database (include unpublished)
        const updatedCompletion = await getTodayInSportsCompletion(true);
        if (updatedCompletion) {
          setTodayCompletion(updatedCompletion);
        }
        
        // Invalidate React Query cache so public page refreshes
        queryClient.invalidateQueries({ queryKey: ['today-in-sports-completion'] });
        
        toast({
          title: 'Success',
          description: newPublishedStatus 
            ? 'Completion published successfully and is now live'
            : 'Completion unpublished successfully',
        });
      } else {
        throw new Error(result.error || 'Update failed');
      }
    } catch (error) {
      debug.error('Error updating completion:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update completion',
        variant: 'destructive'
      });
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8 text-purple-500" />
          <h1 className="text-3xl font-bold">Today in Sports Admin</h1>
        </div>
        <p className="text-muted-foreground">
          Manage the daily sports news briefing generation and Discord integration
        </p>
      </div>

      <div className="space-y-6">
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription>
            The Today in Sports completion generates a daily sports news briefing using ChatGPT with web search.
            It runs automatically at your scheduled time and posts to Discord #🗣️︳general channel.
          </AlertDescription>
        </Alert>

        {/* Model Information Alert */}
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <strong>✅ Current Model: gpt-4o</strong>
            <br />
            <span className="text-sm">
              Web search is enabled via OpenAI Responses API. The model uses real-time web search for accurate, up-to-date sports news and information.
            </span>
          </AlertDescription>
        </Alert>

        {/* System Prompt Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Configuration
            </CardTitle>
            <CardDescription>
              Control when and how the AI generates the daily sports briefing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scheduled Time Input */}
            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Scheduled Generation Time
              </label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Server time (UTC). The automation checks every hour and runs if within 5 minutes of this time.
              </p>
            </div>

            {/* System Prompt */}
            <div>
              <label className="text-sm font-medium mb-2 block">System Prompt</label>
              <Textarea
                value={todayPrompt}
                onChange={(e) => setTodayPrompt(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                placeholder="System prompt for today in sports completion..."
              />
            </div>

            <Button
              onClick={handleSaveTodayPrompt}
              disabled={saving}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Test & Preview
            </CardTitle>
            <CardDescription>
              Manually generate and test completions before they go live
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={handleGenerateTodayCompletion}
                disabled={generatingToday}
                variant="default"
                className="w-full"
              >
                {generatingToday ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Test Generate Completion
                  </>
                )}
              </Button>

              <Button
                onClick={handleTestDiscord}
                disabled={sendingDiscord || !todayCompletion}
                variant="outline"
                className="w-full"
              >
                {sendingDiscord ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Test Send to Discord
                  </>
                )}
              </Button>
            </div>

            {!todayCompletion && (
              <p className="text-sm text-muted-foreground text-center">
                Generate a completion first to test Discord integration
              </p>
            )}
          </CardContent>
        </Card>

        {/* Latest Completion Preview */}
        {todayCompletion && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Latest Completion Preview
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={todayCompletion.sent_to_discord ? "default" : "outline"}>
                    {todayCompletion.sent_to_discord ? 'Sent to Discord' : 'Not Sent'}
                  </Badge>
                  <Badge variant={todayCompletion.published ? "default" : "secondary"}>
                    {todayCompletion.published ? 'Published' : 'Draft'}
                  </Badge>
                </div>
              </CardTitle>
              <CardDescription>
                Generated on {new Date(todayCompletion.completion_date).toLocaleDateString()}
                {todayCompletion.generated_at && (
                  <> at {new Date(todayCompletion.generated_at).toLocaleTimeString()}</>
                )}
                {!todayCompletion.published && (
                  <span className="block mt-2 text-orange-600 dark:text-orange-400 font-medium">
                    ⚠️ This completion is not published and won't be visible to users until you publish it.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Prominent Publish Button */}
              {!todayCompletion.published && (
                <Alert className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
                  <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <AlertDescription className="flex items-center justify-between">
                    <span className="text-orange-800 dark:text-orange-200 font-medium">
                      This completion is in draft mode. Publish it to make it visible on the Today in Sports page.
                    </span>
                    <Button
                      onClick={handlePublishCompletion}
                      disabled={publishing}
                      variant="default"
                      size="lg"
                      className="ml-4 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {publishing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Publishing...
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 mr-2" />
                          Publish Now
                        </>
                      )}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2 pb-4 border-b">
                <Button
                  onClick={handlePublishCompletion}
                  disabled={publishing}
                  variant={todayCompletion.published ? "outline" : "default"}
                  size="lg"
                  className="flex-1"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {todayCompletion.published ? 'Unpublishing...' : 'Publishing...'}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      {todayCompletion.published ? 'Unpublish Completion' : 'Publish Completion'}
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleClearCompletion}
                  disabled={clearing}
                  variant="destructive"
                  size="lg"
                  className="flex-1"
                >
                  {clearing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear Current Completion
                    </>
                  )}
                </Button>
              </div>
              
              {/* Preview matching the actual page style */}
              <Card 
                className="p-6 border-white/20 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 50%, rgba(139, 92, 246, 0.1) 100%)',
                  backdropFilter: 'blur(40px)',
                  WebkitBackdropFilter: 'blur(40px)',
                }}
              >
                {/* Animated gradient background */}
                <div 
                  className="absolute inset-0 opacity-30"
                  style={{
                    background: 'linear-gradient(45deg, #10b981 0%, #3b82f6 50%, #8b5cf6 100%)',
                    backgroundSize: '200% 200%',
                    animation: 'gradient-shift 8s ease infinite',
                  }}
                />
                
                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                          Today in Sports
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-1">
                          <CalendarDays className="h-3 w-3" />
                          {(() => {
                            // Parse completion_date (YYYY-MM-DD) as a local date to avoid timezone issues
                            const parts = todayCompletion.completion_date.split('-');
                            const date = parts.length === 3
                              ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
                              : new Date(todayCompletion.completion_date);
                            return format(date, 'EEEE, MMMM d, yyyy');
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Completion Text */}
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                      {renderTextWithLinks(todayCompletion.completion_text)}
                    </div>
                  </div>

                  {/* Footer */}
                  {todayCompletion.generated_at && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Generated {format(new Date(todayCompletion.generated_at), 'h:mm a')} ET
                      </p>
                    </div>
                  )}
                </div>

                <style>{`
                  @keyframes gradient-shift {
                    0% {
                      background-position: 0% 50%;
                    }
                    50% {
                      background-position: 100% 50%;
                    }
                    100% {
                      background-position: 0% 50%;
                    }
                  }
                `}</style>
              </Card>
            </CardContent>
          </Card>
        )}

        {/* Schedule Info */}
        {todaySchedule && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>Automated Schedule:</strong> Completions generate daily at {scheduledTime} (UTC) and automatically post to Discord.
              {!todaySchedule.enabled && (
                <span className="text-orange-600 ml-2">(Currently Disabled)</span>
              )}
              <br />
              <span className="text-xs text-muted-foreground">
                The master scheduler runs hourly and checks if it's time to generate. Web search is enabled via OpenAI Responses API.
              </span>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

