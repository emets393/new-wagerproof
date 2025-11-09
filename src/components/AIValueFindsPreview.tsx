import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, RefreshCw, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
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
import { toggleValueFindPublished, deleteValueFind } from '@/services/aiCompletionService';
import debug from '@/utils/debug';

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
    sport_type: 'nfl' | 'cfb';
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

  // Guard against null/undefined data
  if (!valueFindData) {
    return null;
  }

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

  const sportLabel = valueFindData.sport_type === 'nfl' ? 'NFL' : 'College Football';

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

