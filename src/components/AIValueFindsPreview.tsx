import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, RefreshCw, Loader2, AlertTriangle, Trash2, Clock, Save } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageHeaderValueFinds } from './PageHeaderValueFinds';
import { ValueFindEditorCard } from './ValueFindEditorCard';
import { HighValueBadge } from './HighValueBadge';
import { useToast } from '@/hooks/use-toast';
import { toggleValueFindPublished, deleteValueFind, getPageLevelSchedule, updatePageLevelSchedule } from '@/services/aiCompletionService';
import { supabase } from '@/integrations/supabase/client';
import debug from '@/utils/debug';
import { SportType } from '@/types/sports';

interface AIValueFindsPreviewProps {
  valueFindData: {
    id: string;
    high_value_badges: Array<{
      game_id: string;
      recommended_pick: string;
      confidence: number;
      tooltip_text: string;
    }>;
    page_header_data: {
      summary_text: string;
      compact_picks: Array<{
        game_id: string;
        matchup: string;
        pick: string;
      }>;
    };
    editor_cards: Array<{
      game_id: string;
      matchup: string;
      bet_type: 'spread' | 'ml' | 'ou';
      recommended_pick: string;
      confidence: number;
      key_factors: string[];
      explanation: string;
    }>;
    published: boolean;
    sport_type: SportType;
    generated_at: string;
  };
  mockGamesData?: Map<string, any>;
  onPublishToggle?: () => void;
  onRegenerate?: () => void;
}

export function AIValueFindsPreview({
  valueFindData,
  onPublishToggle,
  onRegenerate,
}: AIValueFindsPreviewProps) {
  const { toast } = useToast();
  const [publishing, setPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState('header');
  const [showUnpublishDialog, setShowUnpublishDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Default to Monday (1)
  const [autoPublish, setAutoPublish] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);

  // Guard against null/undefined data
  if (!valueFindData) {
    return null;
  }

  // Load schedule on mount
  useEffect(() => {
    loadSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueFindData.sport_type]);

  const loadSchedule = async () => {
    try {
      const schedule = await getPageLevelSchedule(valueFindData.sport_type);
      if (schedule) {
        setScheduleEnabled(schedule.enabled || false);
        setScheduledTime(schedule.scheduled_time || '09:00');
        setDayOfWeek((schedule as any).day_of_week ?? 1); // Default to Monday if not set
        // Handle case where auto_publish might not exist yet (migration not run)
        setAutoPublish((schedule as any).auto_publish ?? false);
      }
      setScheduleLoaded(true);
    } catch (error) {
      debug.error('Error loading schedule:', error);
      setScheduleLoaded(true);
    }
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      // Validate scheduled_time format only if auto-generate is enabled
      if (scheduleEnabled) {
        // Check if time is empty or invalid
        const trimmedTime = scheduledTime?.trim() || '';
        console.log('Validating time:', { scheduledTime, trimmedTime, scheduleEnabled });
        
        if (!trimmedTime) {
          toast({
            title: 'Time Required',
            description: 'Please select a time for auto-generation',
            variant: 'destructive',
          });
          setSavingSchedule(false);
          return;
        }

        // Validate time format (HH:MM) - HTML time input should return this format
        // Also accept HH:MM:SS format in case it's already formatted
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9](:00)?$/;
        if (!timeRegex.test(trimmedTime)) {
          console.error('Time validation failed:', trimmedTime);
          toast({
            title: 'Invalid Time Format',
            description: `Please enter time in HH:MM format (24-hour). Received: "${trimmedTime}"`,
            variant: 'destructive',
          });
          setSavingSchedule(false);
          return;
        }
      }

      // Ensure time format includes seconds for PostgreSQL TIME type
      // HTML time input returns HH:MM format, we need HH:MM:SS for PostgreSQL
      let formattedTime = '09:00:00'; // Default
      if (scheduleEnabled && scheduledTime) {
        const trimmed = scheduledTime.trim();
        if (trimmed.includes(':')) {
          const parts = trimmed.split(':');
          if (parts.length === 2) {
            // HH:MM format - add seconds
            formattedTime = `${trimmed}:00`;
          } else if (parts.length === 3) {
            // Already has seconds
            formattedTime = trimmed;
          }
        }
      }

      console.log('Saving schedule with:', {
        sportType: valueFindData.sport_type,
        enabled: scheduleEnabled,
        scheduled_time: formattedTime,
        original_time: scheduledTime,
        auto_publish: autoPublish,
      });

      const result = await updatePageLevelSchedule(valueFindData.sport_type, {
        enabled: scheduleEnabled,
        scheduled_time: formattedTime,
        day_of_week: dayOfWeek,
        auto_publish: autoPublish,
      });

      console.log('Update result:', result);

      if (!result.success) {
        const errorMsg = result.error || 'Failed to save schedule';
        console.error('Schedule update failed:', errorMsg);
        throw new Error(errorMsg);
      }

      // Update cron job via edge function (optional - master scheduler handles this)
      // Note: The master cron job runs hourly and checks all schedules, so this is just for logging
      try {
        const { error: cronError } = await supabase.functions.invoke('update-value-finds-cron', {
          body: {
            sport_type: valueFindData.sport_type,
            enabled: scheduleEnabled,
            scheduled_time: formattedTime,
          },
        });

        if (cronError) {
          debug.warn('Cron update edge function not available (this is OK):', cronError);
          // Don't show error - the master scheduler will handle it
        }
      } catch (error) {
        debug.warn('Cron update edge function not available (this is OK):', error);
        // Don't show error - the master scheduler will handle it
      }

      // Always show success since the schedule was saved
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[dayOfWeek] || 'Monday';
      toast({
        title: 'Schedule saved!',
        description: scheduleEnabled 
          ? `Value Finds will auto-generate weekly on ${dayName}s at ${scheduledTime}${autoPublish ? ' and auto-publish' : ''}. The master scheduler will check this schedule hourly.`
          : 'Auto-generation disabled',
      });
    } catch (error) {
      debug.error('Error saving schedule:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save schedule',
        variant: 'destructive',
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  // Safely get array lengths with fallbacks
  const editorCardsLength = valueFindData.editor_cards?.length || 0;
  const badgesLength = valueFindData.high_value_badges?.length || 0;
  const compactPicksLength = valueFindData.page_header_data?.compact_picks?.length || 0;

  const handleTogglePublish = async () => {
    // If trying to unpublish, show confirmation dialog
    if (valueFindData.published) {
      setShowUnpublishDialog(true);
      return;
    }
    
    // If publishing, proceed directly
    await executeTogglePublish();
  };

  const executeTogglePublish = async () => {
    setPublishing(true);
    try {
      const newStatus = !valueFindData.published;
      const result = await toggleValueFindPublished(valueFindData.id, newStatus);
      
      if (result.success) {
        toast({
          title: newStatus ? 'Published!' : 'Unpublished',
          description: newStatus 
            ? 'Value Finds are now visible on all pages' 
            : 'Value Finds hidden from all users',
        });
        onPublishToggle?.();
      } else {
        throw new Error(result.error || 'Failed to toggle publish status');
      }
    } catch (error) {
      debug.error('Error toggling publish:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
      setShowUnpublishDialog(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteValueFind(valueFindData.id);
      
      if (result.success) {
        toast({
          title: 'Deleted',
          description: 'Value Finds have been permanently deleted',
        });
        onPublishToggle?.(); // Refresh the data
      } else {
        throw new Error(result.error || 'Failed to delete');
      }
    } catch (error) {
      debug.error('Error deleting value finds:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const sportLabel = 
    valueFindData.sport_type === 'nfl' ? 'NFL' :
    valueFindData.sport_type === 'cfb' ? 'College Football' :
    valueFindData.sport_type === 'nba' ? 'NBA' :
    valueFindData.sport_type === 'ncaab' ? 'College Basketball' :
    'Unknown Sport';

  return (
    <>
      <Card className="mt-6 border-purple-500/30 bg-gradient-to-br from-purple-900/10 to-blue-900/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Value Finds Preview</CardTitle>
              <Badge variant="outline" className="text-purple-400 border-purple-400">
                {sportLabel}
              </Badge>
              {valueFindData.published ? (
                <Badge variant="outline" className="text-green-500 border-green-500">
                  ✓ Published (Live)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                  Unpublished (Draft)
                </Badge>
              )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onRegenerate}
              variant="outline"
              size="sm"
              disabled={publishing || deleting}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
            <Button
              onClick={() => setShowDeleteDialog(true)}
              variant="outline"
              size="sm"
              disabled={publishing || deleting}
              className="border-red-500/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </Button>
            <Button
              onClick={handleTogglePublish}
              disabled={publishing || deleting}
              size="sm"
              variant={valueFindData.published ? "destructive" : "default"}
              className={valueFindData.published ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"}
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : valueFindData.published ? (
                <EyeOff className="w-4 h-4 mr-2" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              {valueFindData.published ? 'Unpublish' : 'Publish'}
            </Button>
          </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Generated: {new Date(valueFindData.generated_at).toLocaleString()}
          </p>
        </CardHeader>
      
      <CardContent>
        {/* Auto-Scheduling Section */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-lg">Auto-Scheduling & Deployment</h3>
            </div>
            {scheduleEnabled && (
              <Badge className="bg-green-600">Active</Badge>
            )}
          </div>
          
          {scheduleLoaded ? (
            <div className="space-y-4">
              {/* Auto-Generate Toggle */}
              <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                <div className="flex-1">
                  <Label htmlFor="auto-generate" className="text-base font-medium cursor-pointer">
                    Auto-Generate Weekly
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Automatically generate new Value Finds weekly at the scheduled day and time
                  </p>
                </div>
                <Switch
                  id="auto-generate"
                  checked={scheduleEnabled}
                  onCheckedChange={setScheduleEnabled}
                  disabled={savingSchedule}
                />
              </div>

              {/* Day of Week and Scheduled Time */}
              {scheduleEnabled && (
                <div className="space-y-3 p-3 bg-background rounded-lg">
                  <div>
                    <Label htmlFor="day-of-week" className="text-base font-medium mb-2 block">
                      Day of Week
                    </Label>
                    <Select
                      value={dayOfWeek.toString()}
                      onValueChange={(value) => setDayOfWeek(parseInt(value, 10))}
                      disabled={savingSchedule}
                    >
                      <SelectTrigger id="day-of-week" className="max-w-xs">
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sunday</SelectItem>
                        <SelectItem value="1">Monday</SelectItem>
                        <SelectItem value="2">Tuesday</SelectItem>
                        <SelectItem value="3">Wednesday</SelectItem>
                        <SelectItem value="4">Thursday</SelectItem>
                        <SelectItem value="5">Friday</SelectItem>
                        <SelectItem value="6">Saturday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="scheduled-time" className="text-base font-medium mb-2 block">
                      Scheduled Time (24-hour format)
                    </Label>
                    <Input
                      id="scheduled-time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      disabled={savingSchedule}
                      className="max-w-xs"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Value Finds will be generated weekly on the selected day at this time (server timezone)
                  </p>
                </div>
              )}

              {/* Auto-Publish Toggle */}
              {scheduleEnabled && (
                <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="auto-publish" className="text-base font-medium cursor-pointer">
                      Auto-Publish After Generation
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Automatically publish Value Finds immediately after generation (no review)
                    </p>
                  </div>
                  <Switch
                    id="auto-publish"
                    checked={autoPublish}
                    onCheckedChange={setAutoPublish}
                    disabled={savingSchedule}
                  />
                </div>
              )}

              {/* Save Button */}
              <Button
                onClick={handleSaveSchedule}
                disabled={savingSchedule}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {savingSchedule ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving Schedule...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Schedule Settings
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="header">
              Page Level Analysis
            </TabsTrigger>
            <TabsTrigger value="editor">
              Editor Cards ({editorCardsLength})
            </TabsTrigger>
            <TabsTrigger value="badges">
              High Value Badges ({badgesLength})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="header">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-4">
                This section will appear at the top of the {sportLabel} page:
              </p>
              {valueFindData.page_header_data?.summary_text && valueFindData.page_header_data?.compact_picks ? (
                <div className="bg-background p-4 rounded-lg">
                  <PageHeaderValueFinds
                    sportType={valueFindData.sport_type}
                    summaryText={valueFindData.page_header_data.summary_text}
                    compactPicks={valueFindData.page_header_data.compact_picks}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No page header data available
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="editor">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-4">
                These cards will appear on the Editors Picks page:
              </p>
              {valueFindData.editor_cards && valueFindData.editor_cards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
                  {valueFindData.editor_cards.map((card, index) => (
                    <ValueFindEditorCard
                      key={index}
                      gameId={card.game_id}
                      matchup={card.matchup}
                      betType={card.bet_type}
                      recommendedPick={card.recommended_pick}
                      confidence={card.confidence}
                      keyFactors={card.key_factors}
                      explanation={card.explanation}
                      sportType={valueFindData.sport_type}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No editor cards available
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="badges" className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-3">
                These badges will appear on game cards for the selected games:
              </p>
              {valueFindData.high_value_badges && valueFindData.high_value_badges.length > 0 ? (
                <div className="space-y-3">
                  {valueFindData.high_value_badges.map((badge, index) => (
                    <div key={index} className="flex items-start gap-3 bg-background p-3 rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold mb-1">Game: {badge.game_id}</p>
                        <p className="text-sm text-muted-foreground mb-2">{badge.tooltip_text}</p>
                      </div>
                      <HighValueBadge
                        pick={badge.recommended_pick}
                        confidence={badge.confidence}
                        tooltipText={badge.tooltip_text}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No high value badges available
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>

    {/* Unpublish Confirmation Dialog */}
    <AlertDialog open={showUnpublishDialog} onOpenChange={setShowUnpublishDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-orange-500" />
            Unpublish Value Finds?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will <strong>hide</strong> all Value Finds content from users on the {sportLabel} page, including:
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Page-level analysis header</li>
              <li>High value badges on game cards ({badgesLength} games)</li>
              <li>Editor picks cards ({editorCardsLength} cards)</li>
            </ul>
            <p className="text-yellow-600 dark:text-yellow-400 mt-3">
              ⚠️ Users viewing the page will see this content disappear within 30 seconds or when they switch tabs.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              You can re-publish this later. Use "Delete" if you want to remove it permanently.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={executeTogglePublish}
            className="bg-orange-600 hover:bg-orange-700"
          >
            Unpublish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            Permanently Delete Value Finds?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p className="font-semibold text-red-600 dark:text-red-400">
              ⚠️ This action cannot be undone!
            </p>
            <p>
              This will <strong>permanently delete</strong> all Value Finds content for {sportLabel}:
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Page-level analysis ({compactPicksLength} picks)</li>
              <li>High value badges ({badgesLength} games)</li>
              <li>Editor picks cards ({editorCardsLength} cards)</li>
            </ul>
            <p className="text-muted-foreground mt-3 text-sm">
              You'll need to generate new value finds from scratch if you delete this.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Permanently'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

