import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Loader2, Sparkles, FileText, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { buildGameDataPayload, generateCompletion, getCompletionConfigs, updateCompletionConfig } from '@/services/aiCompletionService';
import { getAllMarketsData } from '@/services/polymarketService';
import debug from '@/utils/debug';

interface AIPayloadViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: any;
  sportType: 'nfl' | 'cfb' | 'nba' | 'ncaab';
  /** Callback fired when a new completion is successfully generated */
  onCompletionGenerated?: (gameId: string, widgetType: string) => void;
}

export function AIPayloadViewer({
  open,
  onOpenChange,
  game,
  sportType,
  onCompletionGenerated,
}: AIPayloadViewerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('spread');
  const [generatingSpread, setGeneratingSpread] = useState(false);
  const [generatingOU, setGeneratingOU] = useState(false);
  const [polymarketData, setPolymarketData] = useState<any>(null);
  const [loadingPolymarket, setLoadingPolymarket] = useState(false);
  const [systemPrompts, setSystemPrompts] = useState<Record<string, string>>({});
  const [editablePrompts, setEditablePrompts] = useState<Record<string, string>>({});
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [generatedResponses, setGeneratedResponses] = useState<Record<string, string>>({});
  const [configIds, setConfigIds] = useState<Record<string, string>>({});
  const [savingPrompts, setSavingPrompts] = useState<Record<string, boolean>>({});

  const gameId = game.training_key || game.unique_id || `${game.away_team}_${game.home_team}`;

  // Fetch Polymarket data when modal opens
  useEffect(() => {
    if (open && game) {
      fetchPolymarketData();
      fetchSystemPrompts();
    }
  }, [open, game]);

  const fetchPolymarketData = async () => {
    setLoadingPolymarket(true);
    try {
      const data = await getAllMarketsData(game.away_team, game.home_team, sportType);
      setPolymarketData(data);
      debug.log('Polymarket data fetched for payload:', data);
    } catch (error) {
      debug.error('Error fetching Polymarket data:', error);
      setPolymarketData(null);
    } finally {
      setLoadingPolymarket(false);
    }
  };

  const fetchSystemPrompts = async () => {
    setLoadingPrompts(true);
    try {
      const configs = await getCompletionConfigs();
      const prompts: Record<string, string> = {};
      const ids: Record<string, string> = {};
      
      configs.forEach(config => {
        if (config.sport_type === sportType) {
          prompts[config.widget_type] = config.system_prompt;
          ids[config.widget_type] = config.id;
        }
      });
      
      setSystemPrompts(prompts);
      setEditablePrompts({ ...prompts }); // Initialize editable copy
      setConfigIds(ids);
      debug.log('System prompts fetched:', prompts);
      debug.log('Config IDs:', ids);
    } catch (error) {
      debug.error('Error fetching system prompts:', error);
    } finally {
      setLoadingPrompts(false);
    }
  };

  // Build payloads for different widget types
  const spreadPayload = buildGameDataPayload(game, sportType, 'spread_prediction', polymarketData);
  const ouPayload = buildGameDataPayload(game, sportType, 'ou_prediction', polymarketData);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: 'Payload JSON copied successfully',
    });
  };

  const handleGenerateCompletion = async (widgetType: string) => {
    const setLoading = widgetType === 'spread_prediction' ? setGeneratingSpread : setGeneratingOU;
    const payload = widgetType === 'spread_prediction' ? spreadPayload : ouPayload;
    const customPrompt = editablePrompts[widgetType];

    setLoading(true);

    try {
      debug.log(`Generating ${widgetType} completion for ${gameId}`);
      debug.log('Using custom prompt:', customPrompt);
      
      const result = await generateCompletion(gameId, sportType, widgetType, payload, customPrompt);

      debug.log('Generation result:', result);
      debug.log('Result completion type:', typeof result.completion);
      debug.log('Result completion value:', result.completion);

      if (result.success) {
        // Ensure we're storing a string, not an object
        let completionText: string;
        
        if (typeof result.completion === 'string') {
          completionText = result.completion;
          debug.log('Completion is string, length:', completionText.length);
        } else if (Array.isArray(result.completion)) {
          // If it's an array (shouldn't happen, but handle it)
          debug.error('Completion is an array! Converting to string:', result.completion);
          completionText = 'Error: Received array instead of string. Please check logs.';
        } else if (typeof result.completion === 'object') {
          // If it's an object, stringify it or extract explanation
          debug.error('Completion is an object! Value:', result.completion);
          completionText = result.completion?.explanation || JSON.stringify(result.completion, null, 2);
        } else {
          completionText = 'No completion text returned';
        }
        
        // Store the generated response to display in the modal
        setGeneratedResponses(prev => ({
          ...prev,
          [widgetType]: completionText
        }));

        // Notify parent component to refresh completions
        if (onCompletionGenerated) {
          onCompletionGenerated(gameId, widgetType);
        }

        toast({
          title: 'Completion Generated',
          description: result.cached 
            ? 'Returned cached completion' 
            : 'New AI completion generated successfully',
        });
      } else {
        // Store error message
        setGeneratedResponses(prev => ({
          ...prev,
          [widgetType]: `Error: ${result.error || 'Unknown error occurred'}`
        }));

        toast({
          title: 'Generation Failed',
          description: result.error || 'Unknown error occurred',
          variant: 'destructive',
        });
      }
    } catch (error) {
      debug.error('Error generating completion:', error);
      
      setGeneratedResponses(prev => ({
        ...prev,
        [widgetType]: `Error: ${error instanceof Error ? error.message : 'Failed to generate completion'}`
      }));

      toast({
        title: 'Error',
        description: 'Failed to generate completion',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrompt = async (widgetType: string) => {
    const configId = configIds[widgetType];
    const newPrompt = editablePrompts[widgetType];

    if (!configId) {
      toast({
        title: 'Error',
        description: 'Config ID not found',
        variant: 'destructive',
      });
      return;
    }

    if (!newPrompt || newPrompt.trim() === '') {
      toast({
        title: 'Error',
        description: 'Prompt cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    setSavingPrompts(prev => ({ ...prev, [widgetType]: true }));

    try {
      const success = await updateCompletionConfig(configId, {
        system_prompt: newPrompt,
      });

      if (success) {
        // Update the base prompt to reflect the new saved version
        setSystemPrompts(prev => ({
          ...prev,
          [widgetType]: newPrompt,
        }));

        toast({
          title: 'Prompt Saved',
          description: 'System prompt updated successfully in database',
        });
      } else {
        toast({
          title: 'Save Failed',
          description: 'Failed to update system prompt',
          variant: 'destructive',
        });
      }
    } catch (error) {
      debug.error('Error saving prompt:', error);
      toast({
        title: 'Error',
        description: 'Failed to save system prompt',
        variant: 'destructive',
      });
    } finally {
      setSavingPrompts(prev => ({ ...prev, [widgetType]: false }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Payload Viewer
          </DialogTitle>
          <DialogDescription>
            {game.away_team} @ {game.home_team}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="spread">Spread Prediction</TabsTrigger>
            <TabsTrigger value="ou">Over/Under Prediction</TabsTrigger>
          </TabsList>

          <TabsContent value="spread" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Spread Prediction</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(JSON.stringify(spreadPayload, null, 2))}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Payload
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleGenerateCompletion('spread_prediction')}
                  disabled={generatingSpread || loadingPolymarket || loadingPrompts}
                >
                  {generatingSpread ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>

            {loadingPolymarket && (
              <div className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading Polymarket data...
              </div>
            )}

            {/* System Prompt Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-500" />
                <h4 className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                  System Prompt (Instructions for GPT)
                </h4>
              </div>
              
              {/* Base System Prompt (Read-Only) */}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  Base Prompt (from database):
                </label>
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 p-3 rounded-lg max-h-32 overflow-y-auto">
                  {loadingPrompts ? (
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading system prompt...
                    </div>
                  ) : systemPrompts['spread_prediction'] ? (
                    <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {systemPrompts['spread_prediction']}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">No system prompt configured</p>
                  )}
                </div>
              </div>

              {/* Editable System Prompt for Testing */}
              <div>
                <label className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1 block">
                  Test Prompt (edit to test variations):
                </label>
                <Textarea
                  value={editablePrompts['spread_prediction'] || ''}
                  onChange={(e) => setEditablePrompts(prev => ({
                    ...prev,
                    'spread_prediction': e.target.value
                  }))}
                  className="text-xs font-mono min-h-[120px] bg-purple-50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-700"
                  placeholder="Edit the system prompt to test variations..."
                  disabled={loadingPrompts}
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    ✨ This version will be sent to GPT when you click "Generate"
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSavePrompt('spread_prediction')}
                    disabled={savingPrompts['spread_prediction'] || loadingPrompts}
                    className="text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/20"
                  >
                    {savingPrompts['spread_prediction'] ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-3 h-3 mr-1" />
                        Save as Base Prompt
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* User Message Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  User Message (Game Data Payload)
                </h4>
              </div>
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-xs border border-gray-300 dark:border-gray-700">
                {JSON.stringify(spreadPayload, null, 2)}
              </pre>
            </div>

            {/* Generated Response Section */}
            {generatedResponses['spread_prediction'] && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-green-500" />
                  <h4 className="text-xs font-semibold text-green-600 dark:text-green-400">
                    AI Generated Response
                  </h4>
                </div>
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-300 dark:border-green-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {generatedResponses['spread_prediction']}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(generatedResponses['spread_prediction'])}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Response
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ou" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Over/Under Prediction</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(JSON.stringify(ouPayload, null, 2))}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Payload
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleGenerateCompletion('ou_prediction')}
                  disabled={generatingOU || loadingPolymarket || loadingPrompts}
                >
                  {generatingOU ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>

            {loadingPolymarket && (
              <div className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading Polymarket data...
              </div>
            )}

            {/* System Prompt Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-500" />
                <h4 className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                  System Prompt (Instructions for GPT)
                </h4>
              </div>
              
              {/* Base System Prompt (Read-Only) */}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  Base Prompt (from database):
                </label>
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 p-3 rounded-lg max-h-32 overflow-y-auto">
                  {loadingPrompts ? (
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading system prompt...
                    </div>
                  ) : systemPrompts['ou_prediction'] ? (
                    <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {systemPrompts['ou_prediction']}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">No system prompt configured</p>
                  )}
                </div>
              </div>

              {/* Editable System Prompt for Testing */}
              <div>
                <label className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1 block">
                  Test Prompt (edit to test variations):
                </label>
                <Textarea
                  value={editablePrompts['ou_prediction'] || ''}
                  onChange={(e) => setEditablePrompts(prev => ({
                    ...prev,
                    'ou_prediction': e.target.value
                  }))}
                  className="text-xs font-mono min-h-[120px] bg-purple-50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-700"
                  placeholder="Edit the system prompt to test variations..."
                  disabled={loadingPrompts}
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    ✨ This version will be sent to GPT when you click "Generate"
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSavePrompt('ou_prediction')}
                    disabled={savingPrompts['ou_prediction'] || loadingPrompts}
                    className="text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/20"
                  >
                    {savingPrompts['ou_prediction'] ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-3 h-3 mr-1" />
                        Save as Base Prompt
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* User Message Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  User Message (Game Data Payload)
                </h4>
              </div>
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-xs border border-gray-300 dark:border-gray-700">
                {JSON.stringify(ouPayload, null, 2)}
              </pre>
            </div>

            {/* Generated Response Section */}
            {generatedResponses['ou_prediction'] && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-green-500" />
                  <h4 className="text-xs font-semibold text-green-600 dark:text-green-400">
                    AI Generated Response
                  </h4>
                </div>
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-300 dark:border-green-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {generatedResponses['ou_prediction']}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(generatedResponses['ou_prediction'])}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Response
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg text-xs space-y-2">
          <p className="font-semibold text-blue-900 dark:text-blue-100">💡 How this works:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
            <li><strong>Base Prompt:</strong> Read-only view of the database prompt</li>
            <li><strong>Test Prompt:</strong> Editable version that gets sent to GPT (edit to test variations)</li>
            <li><strong>User Message:</strong> Contains all game data (predictions, lines, weather, Polymarket, public betting)</li>
            <li><strong>Polymarket data:</strong> Automatically fetched and included when modal opens</li>
            <li><strong>Generated Response:</strong> AI completion appears below in green box after clicking "Generate"</li>
            <li>Click "Copy Response" to copy the AI-generated text</li>
            <li>Completions using custom prompts won't be cached (for testing)</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

