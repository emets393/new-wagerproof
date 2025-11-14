import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Brain, Save, Loader2, Play, Clock, CheckCircle2, AlertCircle, Sparkles, FileText, Copy, AlertTriangle, EyeOff, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  getCompletionConfigs, 
  updateCompletionConfig, 
  getPageLevelSchedule,
  updatePageLevelSchedule,
  generatePageLevelAnalysis,
  getUnpublishedValueFinds,
  toggleValueFindPublished,
  deleteValueFind,
  bulkGenerateMissingCompletions,
  AICompletionConfig,
  PageLevelSchedule,
  AIValueFind,
} from '@/services/aiCompletionService';
import { getCompletionSettings, setCompletionSetting } from '@/utils/aiCompletionSettings';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { getAllMarketsData } from '@/services/polymarketService';
import { AIValueFindsPreview } from '@/components/AIValueFindsPreview';
import { SportType } from '@/types/sports';
import debug from '@/utils/debug';

export default function AISettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [configs, setConfigs] = useState<AICompletionConfig[]>([]);
  const [nflSchedule, setNflSchedule] = useState<PageLevelSchedule | null>(null);
  const [cfbSchedule, setCfbSchedule] = useState<PageLevelSchedule | null>(null);
  const [nbaSchedule, setNbaSchedule] = useState<PageLevelSchedule | null>(null);
  const [ncaabSchedule, setNcaabSchedule] = useState<PageLevelSchedule | null>(null);
  const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
  const [generatingAnalysis, setGeneratingAnalysis] = useState<Record<string, boolean>>({});
  
  // Emergency toggle state
  const [completionSettings, setCompletionSettings] = useState(getCompletionSettings());
  
  // Bulk generation state
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkGeneratingSport, setBulkGeneratingSport] = useState<SportType | null>(null);
  const [bulkResults, setBulkResults] = useState<{ totalGenerated: number; totalErrors: number; sport?: SportType } | null>(null);
  
  // Payload tester state
  const [payloadTesterOpen, setPayloadTesterOpen] = useState(false);
  const [testerSportType, setTesterSportType] = useState<'nfl' | 'cfb' | 'nba' | 'ncaab'>('nfl');
  const [testerGamesData, setTesterGamesData] = useState<any[]>([]);
  const [testerTestPrompt, setTesterTestPrompt] = useState('');
  const [testerGeneratedResponse, setTesterGeneratedResponse] = useState<string>('');
  const [testerGenerating, setTesterGenerating] = useState(false);
  const [testerFullPayload, setTesterFullPayload] = useState<string>('');
  
  // Preview state for unpublished value finds
  const [nflPreviewData, setNflPreviewData] = useState<AIValueFind | null>(null);
  const [cfbPreviewData, setCfbPreviewData] = useState<AIValueFind | null>(null);
  const [nbaPreviewData, setNbaPreviewData] = useState<AIValueFind | null>(null);
  const [ncaabPreviewData, setNcaabPreviewData] = useState<AIValueFind | null>(null);
  
  // Force unpublish state
  const [forceUnpublishDialog, setForceUnpublishDialog] = useState<{ open: boolean; sport: 'nfl' | 'cfb' | 'nba' | 'ncaab' | null }>({
    open: false,
    sport: null
  });
  const [forceUnpublishing, setForceUnpublishing] = useState(false);
  
  // Delete state
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; sport: 'nfl' | 'cfb' | 'nba' | 'ncaab' | null }>({
    open: false,
    sport: null
  });
  const [deleting, setDeleting] = useState(false);
  

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [configsData, nflSched, cfbSched, nbaSched, ncaabSched, nflPreview, cfbPreview, nbaPreview, ncaabPreview] = await Promise.all([
        getCompletionConfigs(),
        getPageLevelSchedule('nfl'),
        getPageLevelSchedule('cfb'),
        getPageLevelSchedule('nba'),
        getPageLevelSchedule('ncaab'),
        getUnpublishedValueFinds('nfl'),
        getUnpublishedValueFinds('cfb'),
        getUnpublishedValueFinds('nba'),
        getUnpublishedValueFinds('ncaab'),
      ]);

      setConfigs(configsData);
      setNflSchedule(nflSched);
      setCfbSchedule(cfbSched);
      setNbaSchedule(nbaSched);
      setNcaabSchedule(ncaabSched);
      setNflPreviewData(nflPreview);
      setCfbPreviewData(cfbPreview);
      setNbaPreviewData(nbaPreview);
      setNcaabPreviewData(ncaabPreview);

      // Initialize edited prompts
      const prompts: Record<string, string> = {};
      configsData.forEach(config => {
        prompts[config.id] = config.system_prompt;
      });
      if (nflSched) prompts[`schedule_nfl`] = nflSched.system_prompt;
      if (cfbSched) prompts[`schedule_cfb`] = cfbSched.system_prompt;
      if (nbaSched) prompts[`schedule_nba`] = nbaSched.system_prompt;
      if (ncaabSched) prompts[`schedule_ncaab`] = ncaabSched.system_prompt;
      setEditedPrompts(prompts);

    } catch (error) {
      debug.error('Error fetching AI settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load AI settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (config: AICompletionConfig) => {
    setSaving(prev => ({ ...prev, [config.id]: true }));
    try {
      const success = await updateCompletionConfig(config.id, {
        system_prompt: editedPrompts[config.id],
        enabled: config.enabled
      });

      if (success) {
        await fetchData(); // Refresh to get updated data
        toast({
          title: 'Saved',
          description: `Updated ${config.sport_type.toUpperCase()} ${config.widget_type} settings`,
        });
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      debug.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive'
      });
    } finally {
      setSaving(prev => ({ ...prev, [config.id]: false }));
    }
  };

  const handleToggleEnabled = async (config: AICompletionConfig) => {
    const newEnabledState = !config.enabled;
    try {
      const success = await updateCompletionConfig(config.id, {
        enabled: newEnabledState
      });

      if (success) {
        setConfigs(prev => prev.map(c => 
          c.id === config.id ? { ...c, enabled: newEnabledState } : c
        ));
        toast({
          title: newEnabledState ? 'Enabled' : 'Disabled',
          description: `${config.sport_type.toUpperCase()} ${config.widget_type} is now ${newEnabledState ? 'enabled' : 'disabled'}`,
        });
      }
    } catch (error) {
      debug.error('Error toggling enabled:', error);
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive'
      });
    }
  };

  const handleSavePageLevelPrompt = async (sportType: 'nfl' | 'cfb' | 'nba' | 'ncaab') => {
    const key = `schedule_${sportType}`;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      const schedule = 
        sportType === 'nfl' ? nflSchedule :
        sportType === 'cfb' ? cfbSchedule :
        sportType === 'nba' ? nbaSchedule :
        ncaabSchedule;
      if (!schedule) {
        throw new Error('Schedule not found');
      }

      const result = await updatePageLevelSchedule(sportType, {
        system_prompt: editedPrompts[key]
      });

      if (result.success) {
        // Refresh data to get the updated prompt from database
        await fetchData();
        
        toast({
          title: 'Prompt Saved',
          description: `${sportType.toUpperCase()} page-level prompt has been updated`,
        });
      } else {
        throw new Error('Failed to save prompt');
      }
    } catch (error) {
      debug.error('Error saving page-level prompt:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save prompt',
        variant: 'destructive'
      });
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleForceUnpublish = async () => {
    if (!forceUnpublishDialog.sport) return;
    
    setForceUnpublishing(true);
    try {
      const sportType = forceUnpublishDialog.sport;
      const previewData = 
        sportType === 'nfl' ? nflPreviewData :
        sportType === 'cfb' ? cfbPreviewData :
        sportType === 'nba' ? nbaPreviewData :
        ncaabPreviewData;
      
      if (!previewData) {
        throw new Error('No value finds to unpublish');
      }
      
      const result = await toggleValueFindPublished(previewData.id, false);
      
      if (result.success) {
        toast({
          title: 'Unpublished',
          description: `${sportType.toUpperCase()} Value Finds have been hidden from all users`,
        });
        
        // Refresh the preview data
        const preview = await getUnpublishedValueFinds(sportType);
        if (sportType === 'nfl') {
          setNflPreviewData(preview);
        } else if (sportType === 'cfb') {
          setCfbPreviewData(preview);
        } else if (sportType === 'nba') {
          setNbaPreviewData(preview);
        } else {
          setNcaabPreviewData(preview);
        }
      } else {
        throw new Error(result.error || 'Failed to unpublish');
      }
    } catch (error) {
      debug.error('Error unpublishing:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to unpublish',
        variant: 'destructive'
      });
    } finally {
      setForceUnpublishing(false);
      setForceUnpublishDialog({ open: false, sport: null });
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.sport) return;
    
    setDeleting(true);
    try {
      const sportType = deleteDialog.sport;
      const previewData = 
        sportType === 'nfl' ? nflPreviewData :
        sportType === 'cfb' ? cfbPreviewData :
        sportType === 'nba' ? nbaPreviewData :
        ncaabPreviewData;
      
      if (!previewData) {
        throw new Error('No value finds to delete');
      }
      
      const result = await deleteValueFind(previewData.id);
      
      if (result.success) {
        toast({
          title: 'Deleted',
          description: `${sportType.toUpperCase()} Value Finds have been permanently deleted`,
        });
        
        // Clear the preview data
        if (sportType === 'nfl') {
          setNflPreviewData(null);
        } else if (sportType === 'cfb') {
          setCfbPreviewData(null);
        } else if (sportType === 'nba') {
          setNbaPreviewData(null);
        } else {
          setNcaabPreviewData(null);
        }
      } else {
        throw new Error(result.error || 'Failed to delete');
      }
    } catch (error) {
      debug.error('Error deleting:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive'
      });
    } finally {
      setDeleting(false);
      setDeleteDialog({ open: false, sport: null });
    }
  };

  const handleToggleCompletions = (sport: 'nfl' | 'cfb' | 'nba' | 'ncaab', enabled: boolean) => {
    setCompletionSetting(sport, enabled);
    setCompletionSettings(getCompletionSettings());
    
    toast({
      title: enabled ? 'Completions Enabled' : 'Completions Disabled',
      description: `${sport.toUpperCase()} AI completions are now ${enabled ? 'enabled' : 'disabled'}. ${enabled ? '' : 'Static fallbacks will be shown.'}`,
    });
  };

  const handleBulkGenerate = async (sportType?: SportType) => {
    setBulkGenerating(true);
    setBulkGeneratingSport(sportType || null);
    setBulkResults(null);
    
    try {
      const result = await bulkGenerateMissingCompletions(sportType);
      
      if (result.success) {
        setBulkResults({
          totalGenerated: result.totalGenerated || 0,
          totalErrors: result.totalErrors || 0,
          sport: sportType,
        });
        
        toast({
          title: 'Bulk Generation Complete',
          description: `Generated ${result.totalGenerated} completions with ${result.totalErrors} errors.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Generation Failed',
          description: result.error || 'Failed to generate completions',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setBulkGenerating(false);
      setBulkGeneratingSport(null);
    }
  };

  const handleGeneratePageAnalysis = async (sportType: 'nfl' | 'cfb' | 'nba' | 'ncaab') => {
    setGeneratingAnalysis(prev => ({ ...prev, [sportType]: true }));
    try {
      const result = await generatePageLevelAnalysis(sportType);
      
      debug.log('Page analysis result:', result);
      
      if (result.success && result.data) {
        toast({
          title: 'Analysis Complete!',
          description: `Generated ${result.data.high_value_badges?.length || 0} badges, ${result.data.editor_cards?.length || 0} cards`,
        });
        
        // Refresh the preview data
        const preview = await getUnpublishedValueFinds(sportType);
        if (sportType === 'nfl') {
          setNflPreviewData(preview);
        } else {
          setCfbPreviewData(preview);
        }
      } else {
        const errorMsg = result.error || 'Generation failed';
        debug.error('Analysis failed:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      debug.error('Error generating analysis:', error);
      
      // Try to extract detailed error info
      const errorMessage = error.message || error.error || 'Failed to generate analysis';
      const errorDetails = error.stack ? `\n\nDetails: ${error.stack}` : '';
      
      toast({
        title: 'Error Generating Analysis',
        description: errorMessage + errorDetails,
        variant: 'destructive'
      });
    } finally {
      setGeneratingAnalysis(prev => ({ ...prev, [sportType]: false }));
    }
  };


  // Helper function to build comprehensive game data like the edge function does
  const buildGameDataPayload = (game: any, sportType: 'nfl' | 'cfb', polymarketData?: any) => {
    // Determine predicted team and confidence level
    const spreadProb = sportType === 'nfl' 
      ? game.home_away_spread_cover_prob 
      : (game.pred_spread_proba || game.home_away_spread_cover_prob);
    
    const predictedTeam = spreadProb > 0.5 ? 'home' : 'away';
    const confidence = spreadProb > 0.6 || spreadProb < 0.4 ? 'high' : 
                       spreadProb > 0.55 || spreadProb < 0.45 ? 'moderate' : 'low';

    const basePayload = {
      game: {
        away_team: game.away_team || game.away,
        home_team: game.home_team || game.home,
        game_date: game.game_date || new Date().toISOString().split('T')[0],
        game_time: game.game_time || game.start_time || '00:00:00',
      },
      vegas_lines: sportType === 'nfl' ? {
        home_spread: game.home_spread ?? null,
        away_spread: game.away_spread ?? null,
        home_ml: game.home_ml ?? null,
        away_ml: game.away_ml ?? null,
        over_line: game.over_line ?? null,
      } : {
        home_spread: game.api_spread ?? game.home_spread ?? null,
        away_spread: game.api_spread ? -game.api_spread : (game.away_spread ?? null),
        home_ml: game.home_moneyline ?? game.home_ml ?? null,
        away_ml: game.away_moneyline ?? game.away_ml ?? null,
        over_line: game.api_over_line ?? game.total_line ?? null,
      },
      weather: sportType === 'nfl' ? {
        temperature: game.temperature ?? null,
        wind_speed: game.wind_speed ?? null,
        precipitation: game.precipitation ?? null,
        icon: game.icon || game.icon_code || null,
      } : {
        temperature: game.weather_temp_f ?? game.temperature ?? null,
        wind_speed: game.weather_windspeed_mph ?? game.wind_speed ?? null,
        precipitation: game.precipitation ?? null,
        icon: game.weather_icon_text || game.icon_code || null,
      },
      public_betting: {
        spread_split: game.spread_splits_label || null,
        ml_split: game.ml_splits_label || null,
        total_split: game.total_splits_label || null,
      },
      polymarket: null as any,
      predictions: {
        spread_cover_prob: spreadProb ?? null,
        spread_line: (sportType === 'nfl' ? game.home_spread : game.api_spread) ?? null,
        predicted_team: predictedTeam,
        confidence_level: confidence,
        ml_prob: sportType === 'nfl' ? (game.home_away_ml_prob ?? null) : (game.pred_ml_proba ?? game.home_away_ml_prob ?? null),
        ou_prob: sportType === 'nfl' ? (game.ou_result_prob ?? null) : (game.pred_total_proba ?? game.ou_result_prob ?? null),
      },
    };

    // Add Polymarket data if available - use currentAwayOdds/currentHomeOdds from getAllMarketsData
    if (polymarketData) {
      debug.log(`Building payload for ${game.away_team || game.away} @ ${game.home_team || game.home} with polymarket:`, polymarketData);
      
      basePayload.polymarket = {
        moneyline: polymarketData.moneyline ? {
          away_odds: polymarketData.moneyline.currentAwayOdds ?? null,
          home_odds: polymarketData.moneyline.currentHomeOdds ?? null,
        } : null,
        spread: polymarketData.spread ? {
          away_odds: polymarketData.spread.currentAwayOdds ?? null,
          home_odds: polymarketData.spread.currentHomeOdds ?? null,
        } : null,
        total: polymarketData.total ? {
          over_odds: polymarketData.total.currentAwayOdds ?? null,
          under_odds: polymarketData.total.currentHomeOdds ?? null,
        } : null,
      };
      
      debug.log(`Formatted polymarket in payload:`, basePayload.polymarket);
    } else {
      debug.log(`No polymarket data for ${game.away_team || game.away} @ ${game.home_team || game.home}`);
    }

    return basePayload;
  };

  const handleOpenPayloadTester = async (sportType: 'nfl' | 'cfb') => {
    setTesterSportType(sportType);
    setTesterGeneratedResponse('');
    setPayloadTesterOpen(true);
    
    // Load games data
    try {
      let games: any[] = [];
      
      if (sportType === 'nfl') {
        // Get latest run_id
        const { data: latestRun } = await collegeFootballSupabase
          .from('nfl_predictions_epa')
          .select('run_id')
          .order('run_id', { ascending: false })
          .limit(1)
          .single();

        if (latestRun) {
          const { data: nflGames } = await collegeFootballSupabase
            .from('nfl_predictions_epa')
            .select('*')
            .eq('run_id', latestRun.run_id)
            .limit(10); // Limit to 10 for preview

          games = nflGames || [];
        }
      } else {
        const { data: cfbGames } = await collegeFootballSupabase
          .from('cfb_live_weekly_inputs')
          .select('*')
          .limit(10); // Limit to 10 for preview

        games = cfbGames || [];
      }

      setTesterGamesData(games);

      // Fetch AI completions for these games
      const gameIds = games.map(g => g.training_key || g.unique_id || `${g.away_team}_${g.home_team}`);
      const { data: completions } = await collegeFootballSupabase
        .from('ai_completions')
        .select('*')
        .in('game_id', gameIds)
        .eq('sport_type', sportType);

      debug.log(`Fetched ${completions?.length || 0} AI completions`);

      // Fetch Polymarket data for each game using getAllMarketsData (same as AIPayloadViewer)
      const polymarketPromises = games.map(async (game) => {
        try {
          const data = await getAllMarketsData(game.away_team, game.home_team, sportType);
          debug.log(`Polymarket data for ${game.away_team} @ ${game.home_team}:`, data);
          return { game, data };
        } catch (error) {
          debug.error(`Error fetching Polymarket for ${game.away_team} @ ${game.home_team}:`, error);
          return { game, data: null };
        }
      });

      const polymarketResults = await Promise.all(polymarketPromises);
      
      debug.log(`Fetched Polymarket data for ${polymarketResults.filter(r => r.data).length}/${games.length} games`);

      // Build comprehensive payload similar to edge function
      const gamesWithCompletions = polymarketResults.map(({ game, data: polymarketData }) => {
        const gameId = game.training_key || game.unique_id || `${game.away_team}_${game.home_team}`;
        const gameCompletions = completions?.filter(c => c.game_id === gameId) || [];

        return {
          game_id: gameId,
          matchup: `${game.away_team} @ ${game.home_team}`,
          game_data: buildGameDataPayload(game, sportType, polymarketData),
          completions: gameCompletions.reduce((acc, comp) => {
            acc[comp.widget_type] = comp.completion_text;
            return acc;
          }, {} as Record<string, string>),
        };
      });

      const fullPayload = {
        sport: sportType.toUpperCase(),
        date: new Date().toISOString().split('T')[0],
        games: gamesWithCompletions,
        instructions: 'Analyze all games and identify value opportunities where there are mismatches between model predictions, Vegas lines, public betting, and Polymarket odds. Focus on games where the data suggests an edge.',
      };

      setTesterFullPayload(JSON.stringify(fullPayload, null, 2));

      // Set the test prompt to the current schedule prompt
      const prompt = sportType === 'nfl' 
        ? editedPrompts['schedule_nfl'] || nflSchedule?.system_prompt || ''
        : editedPrompts['schedule_cfb'] || cfbSchedule?.system_prompt || '';
      setTesterTestPrompt(prompt);

    } catch (error) {
      debug.error('Error loading games data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load games data',
        variant: 'destructive'
      });
    }
  };

  const handleTestGenerate = async () => {
    setTesterGenerating(true);
    try {
      const result = await generatePageLevelAnalysis(testerSportType);
      
      if (result.success && result.data) {
        // Format the response nicely
        const formatted = JSON.stringify(result.data, null, 2);
        setTesterGeneratedResponse(formatted);
        toast({
          title: 'Test Complete!',
          description: `Generated ${result.data.value_picks?.length || 0} value picks`,
        });
      } else {
        throw new Error(result.error || 'Generation failed');
      }
    } catch (error) {
      debug.error('Error testing generation:', error);
      setTesterGeneratedResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast({
        title: 'Error',
        description: 'Failed to generate test analysis',
        variant: 'destructive'
      });
    } finally {
      setTesterGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Content copied to clipboard',
    });
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

  const nflConfigs = configs.filter(c => c.sport_type === 'nfl');
  const cfbConfigs = configs.filter(c => c.sport_type === 'cfb');
  const nbaConfigs = configs.filter(c => c.sport_type === 'nba');
  const ncaabConfigs = configs.filter(c => c.sport_type === 'ncaab');

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Brain className="w-8 h-8 text-purple-500" />
          <h1 className="text-3xl font-bold">AI Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Manage AI completion configurations and page-level analysis
        </p>
      </div>

      <Tabs defaultValue="page-level" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="page-level">Page-Level Analysis</TabsTrigger>
          <TabsTrigger value="widget-configs">Card Completions (System Prompts)</TabsTrigger>
        </TabsList>

        {/* Widget Configurations Tab */}
        <TabsContent value="widget-configs" className="space-y-6">
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              Widget completions are AI-generated explanations for specific betting widgets (Spread, Over/Under).
              These run automatically twice daily for new games.
            </AlertDescription>
          </Alert>

          {/* Emergency Controls */}
          <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <AlertTriangle className="h-5 w-5" />
                Emergency Override: Disable AI Completions
              </CardTitle>
              <CardDescription>
                Temporarily disable AI completions to show static fallback explanations. Useful if AI responses are problematic.
                Changes take effect immediately without requiring a database update.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">NFL Completions</span>
                  <Badge variant={completionSettings.nfl ? "default" : "secondary"}>
                    {completionSettings.nfl ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <Switch
                  checked={completionSettings.nfl}
                  onCheckedChange={(checked) => handleToggleCompletions('nfl', checked)}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">CFB Completions</span>
                  <Badge variant={completionSettings.cfb ? "default" : "secondary"}>
                    {completionSettings.cfb ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <Switch
                  checked={completionSettings.cfb}
                  onCheckedChange={(checked) => handleToggleCompletions('cfb', checked)}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">NBA Completions</span>
                  <Badge variant={completionSettings.nba ? "default" : "secondary"}>
                    {completionSettings.nba ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <Switch
                  checked={completionSettings.nba}
                  onCheckedChange={(checked) => handleToggleCompletions('nba', checked)}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">NCAAB Completions</span>
                  <Badge variant={completionSettings.ncaab ? "default" : "secondary"}>
                    {completionSettings.ncaab ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <Switch
                  checked={completionSettings.ncaab}
                  onCheckedChange={(checked) => handleToggleCompletions('ncaab', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Bulk Generation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Generate Missing Completions
              </CardTitle>
              <CardDescription>
                Check all games in the next 3 days and generate completions for any that are missing.
                This process may take several minutes depending on how many completions need to be generated.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleBulkGenerate('nfl')}
                  disabled={bulkGenerating}
                  variant="outline"
                  className="w-full"
                >
                  {bulkGenerating && bulkGeneratingSport === 'nfl' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      NFL
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleBulkGenerate('cfb')}
                  disabled={bulkGenerating}
                  variant="outline"
                  className="w-full"
                >
                  {bulkGenerating && bulkGeneratingSport === 'cfb' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      CFB
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleBulkGenerate('nba')}
                  disabled={bulkGenerating}
                  variant="outline"
                  className="w-full"
                >
                  {bulkGenerating && bulkGeneratingSport === 'nba' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      NBA
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleBulkGenerate('ncaab')}
                  disabled={bulkGenerating}
                  variant="outline"
                  className="w-full"
                >
                  {bulkGenerating && bulkGeneratingSport === 'ncaab' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      NCAAB
                    </>
                  )}
                </Button>
              </div>
              
              <div className="pt-2 border-t">
                <Button
                  onClick={() => handleBulkGenerate()}
                  disabled={bulkGenerating}
                  size="lg"
                  className="w-full"
                >
                  {bulkGenerating && !bulkGeneratingSport ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating for All Sports...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Generate All Sports
                    </>
                  )}
                </Button>
              </div>
              
              {bulkResults && (
                <Alert className={bulkResults.totalErrors > 0 ? 'border-orange-500' : 'border-green-500'}>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-1">
                      Generation Complete{bulkResults.sport ? ` (${bulkResults.sport.toUpperCase()})` : ' (All Sports)'}
                    </div>
                    <div className="text-sm">
                      ✓ Generated: {bulkResults.totalGenerated} completions<br />
                      {bulkResults.totalErrors > 0 && (
                        <>✗ Errors: {bulkResults.totalErrors}</>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* NFL Configs */}
          <div className="relative rounded-2xl p-6 bg-gradient-to-br from-blue-500/10 via-blue-600/5 to-indigo-600/10 backdrop-blur-sm border border-blue-500/20 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-2xl pointer-events-none"></div>
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                🏈 NFL Configurations
              </h2>
              <div className="space-y-4">
                {nflConfigs.map(config => (
                <Card key={config.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {config.widget_type.replace('_', ' ').toUpperCase()}
                          {config.enabled && (
                            <Badge className="bg-green-600">Enabled</Badge>
                          )}
                          {!config.enabled && (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {config.updated_at && `Last updated: ${new Date(config.updated_at).toLocaleString()}`}
                        </CardDescription>
                      </div>
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={() => handleToggleEnabled(config)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        System Prompt
                      </label>
                      <Textarea
                        value={editedPrompts[config.id] || ''}
                        onChange={(e) => setEditedPrompts(prev => ({
                          ...prev,
                          [config.id]: e.target.value
                        }))}
                        className="min-h-[200px] font-mono text-sm"
                      />
                    </div>
                    <Button
                      onClick={() => handleSaveConfig(config)}
                      disabled={saving[config.id] || editedPrompts[config.id] === config.system_prompt}
                    >
                      {saving[config.id] ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
                ))}
              </div>
            </div>
          </div>

          {/* CFB Configs */}
          <div className="relative rounded-2xl p-6 bg-gradient-to-br from-orange-500/10 via-orange-600/5 to-red-600/10 backdrop-blur-sm border border-orange-500/20 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent rounded-2xl pointer-events-none"></div>
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-orange-600 dark:text-orange-400">
                🏈 College Football Configurations
              </h2>
              <div className="space-y-4">
                {cfbConfigs.map(config => (
                <Card key={config.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {config.widget_type.replace('_', ' ').toUpperCase()}
                          {config.enabled && (
                            <Badge className="bg-green-600">Enabled</Badge>
                          )}
                          {!config.enabled && (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {config.updated_at && `Last updated: ${new Date(config.updated_at).toLocaleString()}`}
                        </CardDescription>
                      </div>
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={() => handleToggleEnabled(config)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        System Prompt
                      </label>
                      <Textarea
                        value={editedPrompts[config.id] || ''}
                        onChange={(e) => setEditedPrompts(prev => ({
                          ...prev,
                          [config.id]: e.target.value
                        }))}
                        className="min-h-[200px] font-mono text-sm"
                      />
                    </div>
                    <Button
                      onClick={() => handleSaveConfig(config)}
                      disabled={saving[config.id] || editedPrompts[config.id] === config.system_prompt}
                    >
                      {saving[config.id] ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
                ))}
              </div>
            </div>
          </div>

          {/* NBA Configs */}
          <div className="relative rounded-2xl p-6 bg-gradient-to-br from-purple-500/10 via-purple-600/5 to-pink-600/10 backdrop-blur-sm border border-purple-500/20 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-2xl pointer-events-none"></div>
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-purple-600 dark:text-purple-400">
                🏀 NBA Configurations
              </h2>
              <div className="space-y-4">
                {nbaConfigs.map(config => (
                <Card key={config.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {config.widget_type.replace('_', ' ').toUpperCase()}
                          {config.enabled && (
                            <Badge className="bg-green-600">Enabled</Badge>
                          )}
                          {!config.enabled && (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {config.updated_at && `Last updated: ${new Date(config.updated_at).toLocaleString()}`}
                        </CardDescription>
                      </div>
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={() => handleToggleEnabled(config)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        System Prompt
                      </label>
                      <Textarea
                        value={editedPrompts[config.id] || ''}
                        onChange={(e) => setEditedPrompts(prev => ({
                          ...prev,
                          [config.id]: e.target.value
                        }))}
                        className="min-h-[200px] font-mono text-sm"
                      />
                    </div>
                    <Button
                      onClick={() => handleSaveConfig(config)}
                      disabled={saving[config.id] || editedPrompts[config.id] === config.system_prompt}
                    >
                      {saving[config.id] ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
                ))}
              </div>
            </div>
          </div>

          {/* NCAAB Configs */}
          <div className="relative rounded-2xl p-6 bg-gradient-to-br from-cyan-500/10 via-cyan-600/5 to-teal-600/10 backdrop-blur-sm border border-cyan-500/20 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-2xl pointer-events-none"></div>
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                🏀 College Basketball Configurations
              </h2>
              <div className="space-y-4">
                {ncaabConfigs.map(config => (
                <Card key={config.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {config.widget_type.replace('_', ' ').toUpperCase()}
                          {config.enabled && (
                            <Badge className="bg-green-600">Enabled</Badge>
                          )}
                          {!config.enabled && (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {config.updated_at && `Last updated: ${new Date(config.updated_at).toLocaleString()}`}
                        </CardDescription>
                      </div>
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={() => handleToggleEnabled(config)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        System Prompt
                      </label>
                      <Textarea
                        value={editedPrompts[config.id] || ''}
                        onChange={(e) => setEditedPrompts(prev => ({
                          ...prev,
                          [config.id]: e.target.value
                        }))}
                        className="min-h-[200px] font-mono text-sm"
                      />
                    </div>
                    <Button
                      onClick={() => handleSaveConfig(config)}
                      disabled={saving[config.id] || editedPrompts[config.id] === config.system_prompt}
                    >
                      {saving[config.id] ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Page-Level Analysis Tab */}
        <TabsContent value="page-level" className="space-y-6">
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              Page-level analysis generates "Value Finds" - AI-powered picks that identify games with the best betting opportunities.
              These can be run manually or scheduled to run automatically.
            </AlertDescription>
          </Alert>

          {/* NFL Schedule */}
          {nflSchedule && (
            <div className="relative rounded-2xl p-6 bg-gradient-to-br from-blue-500/10 via-blue-600/5 to-indigo-600/10 backdrop-blur-sm border border-blue-500/20 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-2xl pointer-events-none"></div>
              <Card className="relative z-10 bg-transparent border-none shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    🏈 NFL Value Finds
                    {nflSchedule.enabled && (
                      <Badge className="bg-green-600">Scheduled</Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleOpenPayloadTester('nfl')}
                      variant="outline"
                      size="sm"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Test Payload
                    </Button>
                    {nflPreviewData && (
                      <Button
                        onClick={() => setForceUnpublishDialog({ open: true, sport: 'nfl' })}
                        variant="outline"
                        size="sm"
                        disabled={!nflPreviewData.published}
                        className={nflPreviewData.published ? "border-orange-500/50 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950" : ""}
                      >
                        <EyeOff className="w-4 h-4 mr-2" />
                        {nflPreviewData.published ? 'Unpublish' : 'Already Unpublished'}
                      </Button>
                    )}
                    <Button
                      onClick={() => handleGeneratePageAnalysis('nfl')}
                      disabled={generatingAnalysis['nfl']}
                    >
                      {generatingAnalysis['nfl'] ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Generate Now
                        </>
                      )}
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  {nflSchedule.last_run_at && `Last run: ${new Date(nflSchedule.last_run_at).toLocaleString()}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Scheduled Time</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {nflSchedule.scheduled_time}
                    </p>
                  </div>
                  <Switch checked={nflSchedule.enabled} disabled />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Analysis System Prompt
                  </label>
                  <Textarea
                    value={editedPrompts[`schedule_nfl`] || ''}
                    onChange={(e) => setEditedPrompts(prev => ({
                      ...prev,
                      [`schedule_nfl`]: e.target.value
                    }))}
                    className="min-h-[300px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    This prompt guides the AI in analyzing all NFL games to find value opportunities
                  </p>
                  <Button
                    onClick={() => handleSavePageLevelPrompt('nfl')}
                    disabled={saving['schedule_nfl']}
                    className="mt-2"
                    size="sm"
                  >
                    {saving['schedule_nfl'] ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Prompt
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* NFL Preview */}
            {nflPreviewData && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Sparkles className="h-5 w-5" />
                    NFL Value Finds Preview
                  </h3>
                  {nflPreviewData.published ? (
                    <Badge className="bg-green-600">Published</Badge>
                  ) : (
                    <Badge variant="secondary">Unpublished</Badge>
                  )}
                </div>
                <AIValueFindsPreview
                  valueFindData={nflPreviewData}
                  onPublishToggle={() => fetchData()}
                  onRegenerate={() => handleGeneratePageAnalysis('nfl')}
                />
              </div>
            )}
            </div>
          )}

          {/* CFB Schedule */}
          {cfbSchedule && (
            <div className="relative rounded-2xl p-6 bg-gradient-to-br from-orange-500/10 via-orange-600/5 to-red-600/10 backdrop-blur-sm border border-orange-500/20 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent rounded-2xl pointer-events-none"></div>
              <Card className="relative z-10 bg-transparent border-none shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    🏈 College Football Value Finds
                    {cfbSchedule.enabled && (
                      <Badge className="bg-green-600">Scheduled</Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleOpenPayloadTester('cfb')}
                      variant="outline"
                      size="sm"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Test Payload
                    </Button>
                    {cfbPreviewData && (
                      <Button
                        onClick={() => setForceUnpublishDialog({ open: true, sport: 'cfb' })}
                        variant="outline"
                        size="sm"
                        disabled={!cfbPreviewData.published}
                        className={cfbPreviewData.published ? "border-orange-500/50 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950" : ""}
                      >
                        <EyeOff className="w-4 h-4 mr-2" />
                        {cfbPreviewData.published ? 'Unpublish' : 'Already Unpublished'}
                      </Button>
                    )}
                    <Button
                      onClick={() => handleGeneratePageAnalysis('cfb')}
                      disabled={generatingAnalysis['cfb']}
                    >
                      {generatingAnalysis['cfb'] ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Generate Now
                        </>
                      )}
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  {cfbSchedule.last_run_at && `Last run: ${new Date(cfbSchedule.last_run_at).toLocaleString()}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Scheduled Time</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {cfbSchedule.scheduled_time}
                    </p>
                  </div>
                  <Switch checked={cfbSchedule.enabled} disabled />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Analysis System Prompt
                  </label>
                  <Textarea
                    value={editedPrompts[`schedule_cfb`] || ''}
                    onChange={(e) => setEditedPrompts(prev => ({
                      ...prev,
                      [`schedule_cfb`]: e.target.value
                    }))}
                    className="min-h-[300px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    This prompt guides the AI in analyzing all CFB games to find value opportunities
                  </p>
                  <Button
                    onClick={() => handleSavePageLevelPrompt('cfb')}
                    disabled={saving['schedule_cfb']}
                    className="mt-2"
                    size="sm"
                  >
                    {saving['schedule_cfb'] ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Prompt
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* CFB Preview */}
            {cfbPreviewData && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <Sparkles className="h-5 w-5" />
                    College Football Value Finds Preview
                  </h3>
                  {cfbPreviewData.published ? (
                    <Badge className="bg-green-600">Published</Badge>
                  ) : (
                    <Badge variant="secondary">Unpublished</Badge>
                  )}
                </div>
                <AIValueFindsPreview
                  valueFindData={cfbPreviewData}
                  onPublishToggle={() => fetchData()}
                  onRegenerate={() => handleGeneratePageAnalysis('cfb')}
                />
              </div>
            )}
            </div>
          )}

          {/* NBA Schedule */}
          {nbaSchedule && (
            <div className="relative rounded-2xl p-6 bg-gradient-to-br from-purple-500/10 via-purple-600/5 to-pink-600/10 backdrop-blur-sm border border-purple-500/20 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-2xl pointer-events-none"></div>
              <Card className="relative z-10 bg-transparent border-none shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    🏀 NBA Value Finds
                    {nbaSchedule.enabled && (
                      <Badge className="bg-green-600">Scheduled</Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {nbaPreviewData && (
                      <Button
                        onClick={() => setForceUnpublishDialog({ open: true, sport: 'nba' })}
                        variant="outline"
                        size="sm"
                        disabled={!nbaPreviewData.published}
                        className={nbaPreviewData.published ? "border-orange-500/50 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950" : ""}
                      >
                        <EyeOff className="w-4 h-4 mr-2" />
                        {nbaPreviewData.published ? 'Unpublish' : 'Already Unpublished'}
                      </Button>
                    )}
                    <Button
                      onClick={() => handleGeneratePageAnalysis('nba')}
                      disabled={generatingAnalysis['nba']}
                    >
                      {generatingAnalysis['nba'] ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Generate Now
                        </>
                      )}
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  {nbaSchedule.last_run_at && `Last run: ${new Date(nbaSchedule.last_run_at).toLocaleString()}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Scheduled Time</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {nbaSchedule.scheduled_time}
                    </p>
                  </div>
                  <Switch checked={nbaSchedule.enabled} disabled />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Analysis System Prompt
                  </label>
                  <Textarea
                    value={editedPrompts[`schedule_nba`] || ''}
                    onChange={(e) => setEditedPrompts(prev => ({
                      ...prev,
                      [`schedule_nba`]: e.target.value
                    }))}
                    className="min-h-[300px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    This prompt guides the AI in analyzing all NBA games and identifying value opportunities
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => handleSavePageLevelPrompt('nba')}
                    disabled={saving[`schedule_nba`] || editedPrompts[`schedule_nba`] === nbaSchedule.system_prompt}
                  >
                    {saving[`schedule_nba`] ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Prompt
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* NBA Preview */}
            {nbaPreviewData && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-purple-600 dark:text-purple-400">
                    <Sparkles className="h-5 w-5" />
                    NBA Value Finds Preview
                  </h3>
                  {nbaPreviewData.published ? (
                    <Badge className="bg-green-600">Published</Badge>
                  ) : (
                    <Badge variant="secondary">Unpublished</Badge>
                  )}
                </div>
                <AIValueFindsPreview
                  valueFindData={nbaPreviewData}
                  onPublishToggle={() => fetchData()}
                  onRegenerate={() => handleGeneratePageAnalysis('nba')}
                />
              </div>
            )}
            </div>
          )}

          {/* NCAAB Schedule */}
          {ncaabSchedule && (
            <div className="relative rounded-2xl p-6 bg-gradient-to-br from-cyan-500/10 via-cyan-600/5 to-teal-600/10 backdrop-blur-sm border border-cyan-500/20 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-2xl pointer-events-none"></div>
              <Card className="relative z-10 bg-transparent border-none shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    🏀 College Basketball Value Finds
                    {ncaabSchedule.enabled && (
                      <Badge className="bg-green-600">Scheduled</Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {ncaabPreviewData && (
                      <Button
                        onClick={() => setForceUnpublishDialog({ open: true, sport: 'ncaab' })}
                        variant="outline"
                        size="sm"
                        disabled={!ncaabPreviewData.published}
                        className={ncaabPreviewData.published ? "border-orange-500/50 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950" : ""}
                      >
                        <EyeOff className="w-4 h-4 mr-2" />
                        {ncaabPreviewData.published ? 'Unpublish' : 'Already Unpublished'}
                      </Button>
                    )}
                    <Button
                      onClick={() => handleGeneratePageAnalysis('ncaab')}
                      disabled={generatingAnalysis['ncaab']}
                    >
                      {generatingAnalysis['ncaab'] ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Generate Now
                        </>
                      )}
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  {ncaabSchedule.last_run_at && `Last run: ${new Date(ncaabSchedule.last_run_at).toLocaleString()}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Scheduled Time</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {ncaabSchedule.scheduled_time}
                    </p>
                  </div>
                  <Switch checked={ncaabSchedule.enabled} disabled />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Analysis System Prompt
                  </label>
                  <Textarea
                    value={editedPrompts[`schedule_ncaab`] || ''}
                    onChange={(e) => setEditedPrompts(prev => ({
                      ...prev,
                      [`schedule_ncaab`]: e.target.value
                    }))}
                    className="min-h-[300px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    This prompt guides the AI in analyzing all college basketball games and identifying value opportunities
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => handleSavePageLevelPrompt('ncaab')}
                    disabled={saving[`schedule_ncaab`] || editedPrompts[`schedule_ncaab`] === ncaabSchedule.system_prompt}
                  >
                    {saving[`schedule_ncaab`] ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Prompt
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* NCAAB Preview */}
            {ncaabPreviewData && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                    <Sparkles className="h-5 w-5" />
                    College Basketball Value Finds Preview
                  </h3>
                  {ncaabPreviewData.published ? (
                    <Badge className="bg-green-600">Published</Badge>
                  ) : (
                    <Badge variant="secondary">Unpublished</Badge>
                  )}
                </div>
                <AIValueFindsPreview
                  valueFindData={ncaabPreviewData}
                  onPublishToggle={() => fetchData()}
                  onRegenerate={() => handleGeneratePageAnalysis('ncaab')}
                />
              </div>
            )}
            </div>
          )}
        </TabsContent>

      </Tabs>

      {/* Payload Tester Modal */}
      <Dialog open={payloadTesterOpen} onOpenChange={setPayloadTesterOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Page-Level Analysis Tester - {testerSportType.toUpperCase()}
            </DialogTitle>
            <DialogDescription>
              Test and preview how the AI will analyze all games on the {testerSportType === 'nfl' ? 'NFL' : testerSportType === 'cfb' ? 'College Football' : testerSportType === 'nba' ? 'NBA' : 'College Basketball'} page to identify value opportunities.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Explainer Section */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                How Page-Level Value Finds Work
              </h3>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p>
                  <strong>1. Data Collection:</strong> The system gathers comprehensive data for every game from the {testerSportType === 'nfl' ? 'NFL' : testerSportType === 'cfb' ? 'CFB' : testerSportType === 'nba' ? 'NBA' : 'NCAAB'} page: 
                  model predictions, Vegas lines, public betting percentages, weather conditions, Polymarket prediction market odds, and any existing widget-level AI analyses.
                </p>
                <p>
                  <strong>2. AI Analysis:</strong> GPT-4o-mini analyzes the complete dataset with web search enabled to find:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Games where data points conflict (e.g., strong model prediction vs. public betting trends)</li>
                  <li>Real-world factors from news, injuries, weather that create betting opportunities</li>
                  <li>Market inefficiencies between Vegas lines and actual predictions</li>
                </ul>
                <p>
                  <strong>3. Value Identification:</strong> The AI returns structured JSON with:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li><strong>Value Picks:</strong> Specific games and bet types with highest expected value</li>
                  <li><strong>Confidence Scores:</strong> Rated 1-10 based on data alignment</li>
                  <li><strong>Key Factors:</strong> The specific data points driving each recommendation</li>
                  <li><strong>Detailed Explanations:</strong> Human-readable analysis with real-world context</li>
                </ul>
                <p>
                  <strong>4. Publishing:</strong> Approved analyses appear on the Editors Picks page and can be posted to Discord.
                </p>
              </div>
            </div>

            {/* Full Data Payload Preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Complete Data Payload Being Sent to AI ({testerGamesData.length} games)</h3>
                <Button
                  onClick={() => copyToClipboard(testerFullPayload)}
                  variant="ghost"
                  size="sm"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy Full Payload
                </Button>
              </div>
              <div className="bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                <div className="text-xs text-muted-foreground mb-3 space-y-1">
                  <p className="font-semibold">This payload includes all available data per game:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><strong>Game Info:</strong> Teams, date, time</li>
                    <li><strong>Vegas Lines:</strong> Spreads, moneylines, over/under (null if unavailable)</li>
                    <li><strong>Model Predictions:</strong> Win probabilities, confidence levels, predicted team</li>
                    <li><strong>Public Betting:</strong> Spread, ML, and total splits (null if unavailable)</li>
                    <li><strong>Weather:</strong> Temperature, wind, precipitation (null if unavailable)</li>
                    <li><strong>Polymarket Odds:</strong> Prediction market data for ML, spread, and totals (null if unavailable)</li>
                    <li><strong>AI Completions:</strong> Any existing widget-level AI analyses</li>
                  </ul>
                  <p className="text-yellow-600 dark:text-yellow-400 mt-2">
                    ⚠️ Note: Fields showing "null" or empty objects indicate missing data in the database for that game. 
                    The AI will work with whatever data is available.
                  </p>
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {testerFullPayload || 'Loading payload data...'}
                </pre>
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-semibold">System Prompt (Editable for Testing)</label>
                <Button
                  onClick={() => copyToClipboard(testerTestPrompt)}
                  variant="ghost"
                  size="sm"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={testerTestPrompt}
                onChange={(e) => setTesterTestPrompt(e.target.value)}
                className="min-h-[200px] font-mono text-xs"
                placeholder="System prompt will be loaded here..."
              />
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleTestGenerate}
              disabled={testerGenerating}
              className="w-full"
              size="lg"
            >
              {testerGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Analysis...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Test Analysis
                </>
              )}
            </Button>

            {/* Generated Response */}
            {testerGeneratedResponse && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-green-600 dark:text-green-400">Generated Analysis</h3>
                  <Button
                    onClick={() => copyToClipboard(testerGeneratedResponse)}
                    variant="ghost"
                    size="sm"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-green-900 dark:text-green-100">
                    {testerGeneratedResponse}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Unpublish Confirmation Dialog */}
      <AlertDialog open={forceUnpublishDialog.open} onOpenChange={(open) => setForceUnpublishDialog({ open, sport: forceUnpublishDialog.sport })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-orange-500" />
              Unpublish {forceUnpublishDialog.sport?.toUpperCase()} Value Finds?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will <strong>hide</strong> all Value Finds content from users on the {forceUnpublishDialog.sport === 'nfl' ? 'NFL' : 'College Football'} page, including:
              </p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Page-level analysis header</li>
                <li>High value badges on game cards</li>
                <li>Editor picks cards</li>
              </ul>
              <p className="text-yellow-600 dark:text-yellow-400 mt-3">
                ⚠️ Users viewing the page will see this content disappear within 30 seconds or when they switch tabs.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                The value finds will remain in the preview below where you can re-publish them later.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceUnpublish}
              disabled={forceUnpublishing}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {forceUnpublishing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Unpublishing...
                </>
              ) : (
                'Unpublish'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, sport: deleteDialog.sport })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Permanently Delete {deleteDialog.sport?.toUpperCase()} Value Finds?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-red-600 dark:text-red-400">
                ⚠️ This action cannot be undone!
              </p>
              <p>
                This will <strong>permanently delete</strong> all Value Finds content for {deleteDialog.sport?.toUpperCase()}:
              </p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Page-level analysis</li>
                <li>High value badges</li>
                <li>Editor picks cards</li>
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
    </div>
  );
}

