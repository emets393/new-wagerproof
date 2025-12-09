/**
 * WagerBot Suggestion Context
 *
 * Manages state and trigger logic for proactive WagerBot suggestions.
 * Supports three modes:
 * 1. Automatic: Triggers on first sport visit and after 2 minutes
 * 2. Manual: User taps icon to see menu with "Scan this page" and "Open chat" options
 * 3. Floating (Detached): Clippy-like assistant that follows user across app
 */

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { wagerBotSuggestionService, Sport, SuggestionResponse, PageType } from '../services/wagerBotSuggestionService';
import { NFLPrediction } from '../types/nfl';
import { CFBPrediction } from '../types/cfb';
import { NBAGame } from '../types/nba';
import { NCAABGame } from '../types/ncaab';
import { GamePolymarketData } from '../config/wagerBotPrompts';

type GameData = NFLPrediction | CFBPrediction | NBAGame | NCAABGame;

// Page-specific data types for scanning
interface PageDataRefs {
  feed: {
    games: GameData[];
    sport: Sport;
    polymarketData?: Map<string, GamePolymarketData>;
  };
  picks: {
    picks: any[];
  };
  outliers: {
    valueAlerts: any[];
    fadeAlerts: any[];
  };
  scoreboard: {
    liveGames: any[];
  };
}

// Page context for floating assistant
type PageContext = 'feed' | 'game-details' | 'picks' | 'outliers' | 'scoreboard' | 'model-details';

// Page explanation messages for floating assistant
const PAGE_EXPLANATIONS: Record<string, string> = {
  picks: "This is Editor's Picks - curated betting recommendations from our expert analysts. Each pick includes detailed reasoning and historical performance tracking. Tap any pick to see the full analysis!",
  outliers: "Welcome to Outliers - these are games where our model's probability differs significantly from the betting lines. These represent potential value opportunities where the market may have mispriced the odds.",
  scoreboard: "This is the Live Scoreboard - track all games in real-time with live scores, game status, and see how your picks are performing. Games update automatically as they progress.",
  'model-details': "Our prediction model analyzes historical data, team performance, injuries, weather, and dozens of other factors to generate win probabilities. The percentage shown represents the model's confidence in each outcome.",
};

// Position for floating bubble
interface FloatingPosition {
  x: number;
  y: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Floating bubble dimensions (must match FloatingAssistantBubble)
const BUBBLE_WIDTH = 220;
const BUBBLE_MIN_HEIGHT = 140;
const SNAP_MARGIN = 16;
const SNAP_MARGIN_TOP = 60;

// Default floating position (bottom-right corner)
const DEFAULT_FLOATING_POSITION: FloatingPosition = {
  x: SCREEN_WIDTH - 220,
  y: SCREEN_HEIGHT - 300,
};

// Welcome message when first detaching
const WELCOME_MESSAGE = "You can now navigate across the app and I will help you make sense of whatever is on the page automatically, like a pro looking over your shoulder ;)";

// Bubble display modes
type BubbleMode = 'suggestion' | 'menu' | 'scanning';

interface WagerBotSuggestionContextType {
  // State
  isVisible: boolean;
  bubbleMode: BubbleMode;
  currentSuggestion: string;
  currentGameId: string | null;
  currentSport: Sport | null;
  suggestionsEnabled: boolean;
  isLoading: boolean;
  testModeEnabled: boolean;

  // Floating assistant state
  isDetached: boolean;
  floatingPosition: FloatingPosition;
  currentPageContext: PageContext;
  currentOpenGame: GameData | null;
  previousInsights: string[];

  // Actions
  triggerSuggestion: (sport: Sport, gameData: GameData[]) => Promise<void>;
  dismissSuggestion: () => void;
  setSuggestionsEnabled: (enabled: boolean) => Promise<void>;
  setTestModeEnabled: (enabled: boolean) => Promise<void>;
  triggerTestSuggestion: () => void;

  // Manual trigger actions
  openManualMenu: () => void;
  scanCurrentPage: () => Promise<void>;
  openChat: () => void;

  // Floating assistant actions
  detachBubble: (x?: number, y?: number) => void;
  detachBubbleFromPill: (x: number, y: number, pillWidth: number, pillHeight: number) => void;
  dismissFloating: () => void;
  updateFloatingPosition: (x: number, y: number) => void;
  requestMoreDetails: () => Promise<void>;
  requestAnotherInsight: () => Promise<void>;

  // Animation state for pill-to-bubble transition
  initialBubbleDimensions: { width: number; height: number; pillRightEdge?: number } | null;

  // Navigation tracking for floating mode
  onGameSheetOpen: (game: GameData, sport: Sport, polymarket?: GamePolymarketData) => void;
  onGameSheetClose: () => void;
  onPageChange: (page: PageContext) => void;
  onModelDetailsTap: () => void;
  onOutliersPageWithData: (outlierGames: GameData[], sport: Sport) => void;

  // Page data setters for scanning
  setPicksData: (picks: any[]) => void;
  setOutliersData: (valueAlerts: any[], fadeAlerts: any[]) => void;
  setScoreboardData: (liveGames: any[]) => void;
  setPolymarketData: (data: Map<string, GamePolymarketData>) => void;

  // Lifecycle management
  onSportChange: (sport: Sport, gameData: GameData[]) => void;
  onFeedMount: () => void;
  onFeedUnmount: () => void;
}

const STORAGE_KEY = '@wagerproof_suggestions_enabled';
const TEST_MODE_STORAGE_KEY = '@wagerproof_suggestions_test_mode';
const FIRST_VISIT_TRIGGER_DELAY = 2000; // 2 seconds after first visit
const RE_TRIGGER_INTERVAL = 2 * 60 * 1000; // 2 minutes
const AUTO_DISMISS_DURATION = 20000; // 20 seconds

const TEST_SUGGESTIONS = [
  "Chiefs -3 looks strong tonight! Their red zone efficiency is elite this season.",
  "The Over 47.5 in Bills/Dolphins has great value - both offenses are clicking.",
  "Lakers ML at +150 is a steal. LeBron's averaging 30+ in his last 5.",
  "Alabama -7 feels safe. Their defense has been dominant all year.",
  "Celtics -4.5 is the play. They're 8-2 ATS at home this month.",
];

const WagerBotSuggestionContext = createContext<WagerBotSuggestionContextType | undefined>(undefined);

export function WagerBotSuggestionProvider({ children }: { children: ReactNode }) {
  // Suggestion state
  const [isVisible, setIsVisible] = useState(false);
  const [bubbleMode, setBubbleMode] = useState<BubbleMode>('suggestion');
  const [currentSuggestion, setCurrentSuggestion] = useState('');
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [currentSport, setCurrentSport] = useState<Sport | null>(null);
  const [suggestionsEnabled, setSuggestionsEnabledState] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [testModeEnabled, setTestModeEnabledState] = useState(false);

  // Floating assistant state
  const [isDetached, setIsDetached] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState<FloatingPosition>(DEFAULT_FLOATING_POSITION);
  const [currentPageContext, setCurrentPageContext] = useState<PageContext>('feed');
  const [currentOpenGame, setCurrentOpenGame] = useState<GameData | null>(null);
  const [previousInsights, setPreviousInsights] = useState<string[]>([]);
  const [initialBubbleDimensions, setInitialBubbleDimensions] = useState<{ width: number; height: number } | null>(null);

  // Tracking refs
  const visitedSports = useRef<Set<Sport>>(new Set());
  const sportTimestamps = useRef<Record<Sport, number>>({} as Record<Sport, number>);
  const autoDismissTimer = useRef<NodeJS.Timeout | null>(null);
  const reTriggerTimer = useRef<NodeJS.Timeout | null>(null);
  const firstVisitTimer = useRef<NodeJS.Timeout | null>(null);
  const isLoadingRef = useRef(false);
  const isMounted = useRef(false);
  const currentGameDataRef = useRef<GameData[]>([]);
  const currentSportRef = useRef<Sport>('nfl');

  // Page-specific data refs for scanning
  const picksDataRef = useRef<any[]>([]);
  const outliersDataRef = useRef<{ valueAlerts: any[]; fadeAlerts: any[] }>({ valueAlerts: [], fadeAlerts: [] });
  const scoreboardDataRef = useRef<any[]>([]);
  const polymarketDataRef = useRef<Map<string, GamePolymarketData>>(new Map());
  const currentGamePolymarketRef = useRef<GamePolymarketData | undefined>(undefined);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const [enabledValue, testModeValue] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(TEST_MODE_STORAGE_KEY),
      ]);
      if (enabledValue !== null) {
        setSuggestionsEnabledState(enabledValue === 'true');
      }
      if (testModeValue !== null) {
        setTestModeEnabledState(testModeValue === 'true');
      }
    } catch (error) {
      console.error('🤖 Error loading suggestion preferences:', error);
    }
  };

  const setSuggestionsEnabled = async (enabled: boolean) => {
    try {
      setSuggestionsEnabledState(enabled);
      await AsyncStorage.setItem(STORAGE_KEY, String(enabled));
      console.log(`🤖 Suggestions ${enabled ? 'enabled' : 'disabled'}`);

      if (!enabled && isVisible) {
        dismissSuggestion();
      }
    } catch (error) {
      console.error('🤖 Error saving suggestion preference:', error);
    }
  };

  const setTestModeEnabled = async (enabled: boolean) => {
    try {
      setTestModeEnabledState(enabled);
      await AsyncStorage.setItem(TEST_MODE_STORAGE_KEY, String(enabled));
      console.log(`🤖 Test mode ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('🤖 Error saving test mode preference:', error);
    }
  };

  const clearAutoDismissTimer = useCallback(() => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
  }, []);

  const triggerTestSuggestion = useCallback(() => {
    console.log('🤖 Triggering test suggestion');

    if (isVisible) {
      dismissSuggestion();
      setTimeout(() => showTestSuggestion(), 300);
    } else {
      showTestSuggestion();
    }
  }, [isVisible]);

  const showTestSuggestion = () => {
    const randomSuggestion = TEST_SUGGESTIONS[Math.floor(Math.random() * TEST_SUGGESTIONS.length)];

    setCurrentSuggestion(randomSuggestion);
    setCurrentGameId(null);
    setCurrentSport('nfl');
    setBubbleMode('suggestion');
    setIsVisible(true);

    clearAutoDismissTimer();
    autoDismissTimer.current = setTimeout(() => {
      console.log('🤖 Auto-dismissing test suggestion');
      dismissSuggestion();
    }, AUTO_DISMISS_DURATION);
  };

  const clearAllTimers = useCallback(() => {
    clearAutoDismissTimer();
    if (reTriggerTimer.current) {
      clearTimeout(reTriggerTimer.current);
      reTriggerTimer.current = null;
    }
    if (firstVisitTimer.current) {
      clearTimeout(firstVisitTimer.current);
      firstVisitTimer.current = null;
    }
  }, [clearAutoDismissTimer]);

  const dismissSuggestion = useCallback(() => {
    console.log('🤖 Dismissing suggestion');
    setIsVisible(false);
    setIsLoading(false);
    clearAutoDismissTimer();
  }, [clearAutoDismissTimer]);

  // Open manual menu (when user taps the icon)
  // Shows the anchored menu bubble at the top with "Scan this page" and "Open chat" options
  const openManualMenu = useCallback(() => {
    console.log('🤖 Opening manual menu, isDetached:', isDetached, 'isVisible:', isVisible);

    // If floating bubble is active, dismiss it
    if (isDetached) {
      console.log('🤖 Dismissing floating bubble');
      dismissFloating();
      return;
    }

    // Show the anchored menu bubble
    if (isVisible) {
      dismissSuggestion();
      setTimeout(() => {
        setBubbleMode('menu');
        setIsVisible(true);
      }, 300);
    } else {
      setBubbleMode('menu');
      setIsVisible(true);
    }

    // No auto-dismiss for menu mode
    clearAutoDismissTimer();
  }, [isVisible, isDetached, dismissSuggestion, dismissFloating, clearAutoDismissTimer]);

  // Scan current page - fetch AI suggestion based on current page context
  const scanCurrentPage = useCallback(async () => {
    console.log(`🤖 Scanning current page: ${currentPageContext}`);

    // Switch to scanning mode
    setBubbleMode('scanning');
    setIsLoading(true);

    try {
      let response: SuggestionResponse;

      // Use page-specific scanning based on current context
      switch (currentPageContext) {
        case 'feed':
        case 'game-details': {
          const sport = currentSportRef.current;
          const gameData = currentGameDataRef.current;

          if (gameData.length === 0) {
            console.log('🤖 No game data to scan');
            setCurrentSuggestion('No games available to analyze right now.');
            setBubbleMode('suggestion');
            setIsLoading(false);
            autoDismissTimer.current = setTimeout(() => {
              dismissSuggestion();
            }, 5000);
            return;
          }

          response = await wagerBotSuggestionService.scanPage('feed', {
            games: gameData,
            sport,
            polymarketData: polymarketDataRef.current,
          });
          break;
        }

        case 'picks': {
          const picks = picksDataRef.current;

          if (picks.length === 0) {
            console.log('🤖 No picks data to scan');
            setCurrentSuggestion('No editor picks available to analyze right now.');
            setBubbleMode('suggestion');
            setIsLoading(false);
            autoDismissTimer.current = setTimeout(() => {
              dismissSuggestion();
            }, 5000);
            return;
          }

          response = await wagerBotSuggestionService.scanPage('picks', { picks });
          break;
        }

        case 'outliers': {
          const { valueAlerts, fadeAlerts } = outliersDataRef.current;

          if (valueAlerts.length === 0 && fadeAlerts.length === 0) {
            console.log('🤖 No outliers data to scan');
            setCurrentSuggestion('No value alerts or outliers available right now.');
            setBubbleMode('suggestion');
            setIsLoading(false);
            autoDismissTimer.current = setTimeout(() => {
              dismissSuggestion();
            }, 5000);
            return;
          }

          response = await wagerBotSuggestionService.scanPage('outliers', { valueAlerts, fadeAlerts });
          break;
        }

        case 'scoreboard': {
          const liveGames = scoreboardDataRef.current;

          if (liveGames.length === 0) {
            console.log('🤖 No live games to scan');
            setCurrentSuggestion('No live games available right now.');
            setBubbleMode('suggestion');
            setIsLoading(false);
            autoDismissTimer.current = setTimeout(() => {
              dismissSuggestion();
            }, 5000);
            return;
          }

          response = await wagerBotSuggestionService.scanPage('scoreboard', { liveGames });
          break;
        }

        default: {
          // Fallback to feed scanning
          const sport = currentSportRef.current;
          const gameData = currentGameDataRef.current;
          response = await wagerBotSuggestionService.scanPage('feed', {
            games: gameData,
            sport,
            polymarketData: polymarketDataRef.current,
          });
        }
      }

      if (response.success && response.suggestion) {
        console.log(`🤖 Scan complete: "${response.suggestion.substring(0, 50)}..."`);

        setCurrentSuggestion(response.suggestion);
        setCurrentGameId(response.gameId);
        setCurrentSport(currentSportRef.current);
        setBubbleMode('suggestion');

        // Start auto-dismiss timer for the result
        clearAutoDismissTimer();
        autoDismissTimer.current = setTimeout(() => {
          console.log('🤖 Auto-dismissing scan result');
          dismissSuggestion();
        }, AUTO_DISMISS_DURATION);
      } else {
        console.log('🤖 No suggestion received from scan');
        setCurrentSuggestion('No strong picks found at the moment. Check back later!');
        setBubbleMode('suggestion');

        autoDismissTimer.current = setTimeout(() => {
          dismissSuggestion();
        }, 5000);
      }
    } catch (error) {
      console.error('🤖 Scan error:', error);
      setCurrentSuggestion('Something went wrong. Please try again.');
      setBubbleMode('suggestion');

      autoDismissTimer.current = setTimeout(() => {
        dismissSuggestion();
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  }, [currentPageContext, dismissSuggestion, clearAutoDismissTimer]);

  // Open chat - handled by the bubble component via onOpenChat callback
  const openChat = useCallback(() => {
    console.log('🤖 Open chat requested');
    dismissSuggestion();
  }, [dismissSuggestion]);

  const triggerSuggestion = useCallback(async (sport: Sport, gameData: GameData[]) => {
    if (!suggestionsEnabled) {
      console.log('🤖 Suggestions disabled, skipping');
      return;
    }
    if (isLoadingRef.current) {
      console.log('🤖 Already loading a suggestion, skipping');
      return;
    }
    if (gameData.length === 0) {
      console.log('🤖 No game data available, skipping');
      return;
    }
    if (isVisible) {
      console.log('🤖 Suggestion already visible, skipping');
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    console.log(`🤖 Triggering suggestion for ${sport.toUpperCase()}...`);

    try {
      const response = await wagerBotSuggestionService.getSuggestion(sport, gameData);

      if (response.success && response.suggestion) {
        console.log(`🤖 Got suggestion: "${response.suggestion.substring(0, 50)}..."`);

        setCurrentSuggestion(response.suggestion);
        setCurrentGameId(response.gameId);
        setCurrentSport(sport);
        setBubbleMode('suggestion');
        setIsVisible(true);

        autoDismissTimer.current = setTimeout(() => {
          console.log('🤖 Auto-dismissing suggestion');
          dismissSuggestion();
        }, AUTO_DISMISS_DURATION);
      } else {
        console.log('🤖 No valid suggestion received');
      }
    } catch (error) {
      console.error('🤖 Error fetching suggestion:', error);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [suggestionsEnabled, isVisible, dismissSuggestion]);

  const onSportChange = useCallback((sport: Sport, gameData: GameData[]) => {
    // Always store current game data and sport for manual triggers
    currentGameDataRef.current = gameData;
    currentSportRef.current = sport;

    if (!suggestionsEnabled) return;

    // Clear any pending timers
    if (reTriggerTimer.current) {
      clearTimeout(reTriggerTimer.current);
      reTriggerTimer.current = null;
    }
    if (firstVisitTimer.current) {
      clearTimeout(firstVisitTimer.current);
      firstVisitTimer.current = null;
    }

    const now = Date.now();
    const isFirstVisit = !visitedSports.current.has(sport);

    visitedSports.current.add(sport);
    sportTimestamps.current[sport] = now;

    console.log(`🤖 Sport changed to ${sport.toUpperCase()}, first visit: ${isFirstVisit}, games: ${gameData.length}`);

    if (isFirstVisit && gameData.length > 0) {
      console.log(`🤖 Scheduling first-visit suggestion in ${FIRST_VISIT_TRIGGER_DELAY}ms`);
      firstVisitTimer.current = setTimeout(() => {
        triggerSuggestion(sport, gameData);
      }, FIRST_VISIT_TRIGGER_DELAY);
    }

    reTriggerTimer.current = setTimeout(() => {
      console.log(`🤖 Re-trigger timer fired for ${sport.toUpperCase()}`);
      if (currentGameDataRef.current.length > 0) {
        triggerSuggestion(sport, currentGameDataRef.current);
      }
    }, RE_TRIGGER_INTERVAL);
  }, [suggestionsEnabled, triggerSuggestion]);

  // ==================== FLOATING ASSISTANT ACTIONS ====================

  // Detach the bubble and switch to floating mode
  const detachBubble = useCallback((x?: number, y?: number) => {
    console.log('🤖 Detaching bubble to floating mode at:', x, y);
    setIsDetached(true);

    // Use provided coordinates or fall back to default
    if (x !== undefined && y !== undefined) {
      // Center bubble at finger position and clamp to screen bounds
      const adjustedX = Math.max(
        SNAP_MARGIN,
        Math.min(x - BUBBLE_WIDTH / 2, SCREEN_WIDTH - BUBBLE_WIDTH - SNAP_MARGIN)
      );
      const adjustedY = Math.max(SNAP_MARGIN_TOP, y);
      setFloatingPosition({ x: adjustedX, y: adjustedY });
    } else {
      setFloatingPosition(DEFAULT_FLOATING_POSITION);
    }

    setCurrentSuggestion(WELCOME_MESSAGE);
    setBubbleMode('suggestion');
    setIsVisible(true);
    setPreviousInsights([]);

    // Clear auto-dismiss timer - floating mode stays until dismissed
    clearAutoDismissTimer();
  }, [clearAutoDismissTimer]);

  // Detach the bubble from the insight pill with smooth animation
  const detachBubbleFromPill = useCallback((x: number, y: number, pillWidth: number, pillHeight: number) => {
    console.log('🤖 Detaching bubble from pill at:', x, y, 'size:', pillWidth, pillHeight);

    // Set initial dimensions so FloatingAssistantBubble can animate from pill size
    // Also pass the pill's right edge X position so bubble can anchor there during expansion
    const pillRightEdge = x + pillWidth;
    setInitialBubbleDimensions({ width: pillWidth, height: pillHeight, pillRightEdge });

    setIsDetached(true);

    // Start bubble at exact pill position (will expand leftward from right edge)
    setFloatingPosition({ x, y });

    setCurrentSuggestion(WELCOME_MESSAGE);
    setBubbleMode('suggestion');
    setIsVisible(true);
    setPreviousInsights([]);

    // Clear initial dimensions after animation completes
    setTimeout(() => {
      setInitialBubbleDimensions(null);
    }, 400);

    // Clear auto-dismiss timer - floating mode stays until dismissed
    clearAutoDismissTimer();
  }, [clearAutoDismissTimer]);

  // Dismiss the floating assistant
  const dismissFloating = useCallback(() => {
    console.log('🤖 Dismissing floating assistant');
    // Set isDetached first to prevent any auto-triggers
    setIsDetached(false);
    setIsVisible(false);
    setCurrentSuggestion('');
    setCurrentOpenGame(null);
    setCurrentPageContext('feed');
    setPreviousInsights([]);
    setFloatingPosition(DEFAULT_FLOATING_POSITION);
    setBubbleMode('suggestion');
  }, []);

  // Update floating bubble position (from drag)
  const updateFloatingPosition = useCallback((x: number, y: number) => {
    setFloatingPosition({ x, y });
  }, []);

  // Request more details on current insight ("Tell me more")
  const requestMoreDetails = useCallback(async () => {
    if (!currentOpenGame || !currentSport || !currentSuggestion) {
      console.log('🤖 No game context for more details');
      return;
    }

    console.log('🤖 Requesting more details...');
    setBubbleMode('scanning');
    setIsLoading(true);

    try {
      const response = await wagerBotSuggestionService.getMoreDetails(
        currentOpenGame,
        currentSport,
        currentSuggestion
      );

      if (response.success && response.suggestion) {
        console.log(`🤖 More details: "${response.suggestion.substring(0, 50)}..."`);
        // Store current insight before replacing
        setPreviousInsights(prev => [...prev, currentSuggestion]);
        setCurrentSuggestion(response.suggestion);
        setBubbleMode('suggestion');
      } else {
        console.log('🤖 No additional details received');
        setCurrentSuggestion("That's all I've got on this one! Try another game.");
        setBubbleMode('suggestion');
      }
    } catch (error) {
      console.error('🤖 Error getting more details:', error);
      setCurrentSuggestion('Something went wrong. Please try again.');
      setBubbleMode('suggestion');
    } finally {
      setIsLoading(false);
    }
  }, [currentOpenGame, currentSport, currentSuggestion]);

  // Request alternative insight ("Another insight")
  const requestAnotherInsight = useCallback(async () => {
    if (!currentOpenGame || !currentSport) {
      console.log('🤖 No game context for alternative insight');
      return;
    }

    console.log('🤖 Requesting alternative insight...');
    setBubbleMode('scanning');
    setIsLoading(true);

    try {
      // Include current suggestion in previous insights for the API
      const allPreviousInsights = currentSuggestion
        ? [...previousInsights, currentSuggestion]
        : previousInsights;

      const response = await wagerBotSuggestionService.getAlternativeInsight(
        currentOpenGame,
        currentSport,
        allPreviousInsights
      );

      if (response.success && response.suggestion) {
        console.log(`🤖 Alternative insight: "${response.suggestion.substring(0, 50)}..."`);
        // Store current insight before replacing
        if (currentSuggestion) {
          setPreviousInsights(prev => [...prev, currentSuggestion]);
        }
        setCurrentSuggestion(response.suggestion);
        setBubbleMode('suggestion');
      } else {
        console.log('🤖 No alternative insight received');
        setCurrentSuggestion("I've covered all the angles on this one! Check out another game.");
        setBubbleMode('suggestion');
      }
    } catch (error) {
      console.error('🤖 Error getting alternative insight:', error);
      setCurrentSuggestion('Something went wrong. Please try again.');
      setBubbleMode('suggestion');
    } finally {
      setIsLoading(false);
    }
  }, [currentOpenGame, currentSport, currentSuggestion, previousInsights]);

  // Handle game sheet opening (navigation tracking for floating mode)
  const onGameSheetOpen = useCallback(async (game: GameData, sport: Sport, polymarket?: GamePolymarketData) => {
    console.log(`🤖 Game sheet opened: ${game.away_team} @ ${game.home_team}`);

    setCurrentOpenGame(game);
    setCurrentSport(sport);
    setCurrentPageContext('game-details');
    setPreviousInsights([]); // Reset insights for new game
    currentGamePolymarketRef.current = polymarket; // Store Polymarket data for this game

    // Only auto-fetch insight if in floating mode
    if (!isDetached) {
      return;
    }

    console.log('🤖 Auto-fetching game insight (floating mode)...');
    setBubbleMode('scanning');
    setIsLoading(true);

    try {
      // Pass Polymarket data to get richer insights
      const response = await wagerBotSuggestionService.getGameInsight(game, sport, polymarket);

      if (response.success && response.suggestion) {
        console.log(`🤖 Game insight: "${response.suggestion.substring(0, 50)}..."`);
        setCurrentSuggestion(response.suggestion);
        setBubbleMode('suggestion');
      } else {
        console.log('🤖 No game insight received');
        setCurrentSuggestion('Looking at this matchup... check back in a moment!');
        setBubbleMode('suggestion');
      }
    } catch (error) {
      console.error('🤖 Error getting game insight:', error);
      setCurrentSuggestion('Something went wrong. Please try again.');
      setBubbleMode('suggestion');
    } finally {
      setIsLoading(false);
    }
  }, [isDetached]);

  // Handle game sheet closing
  const onGameSheetClose = useCallback(() => {
    console.log('🤖 Game sheet closed');
    setCurrentOpenGame(null);
    setPreviousInsights([]);

    // If floating, show message based on current page context
    if (isDetached) {
      if (currentPageContext === 'feed') {
        setCurrentSuggestion('Tap on a game to get my insights!');
      }
      // Other pages keep their context
      setBubbleMode('suggestion');
    }
  }, [isDetached, currentPageContext]);

  // Handle page navigation changes
  // Always track current page so openManualMenu knows which page user is on
  // Only show floating suggestions when in detached mode
  const onPageChange = useCallback((page: PageContext) => {
    console.log(`🤖 Page changed to: ${page}, isDetached: ${isDetached}`);
    setCurrentPageContext(page);

    // Only show floating suggestions when detached
    if (!isDetached) return;

    setCurrentOpenGame(null);
    setPreviousInsights([]);

    // Show page explanation if available
    const explanation = PAGE_EXPLANATIONS[page];
    if (explanation) {
      setCurrentSuggestion(explanation);
      setBubbleMode('suggestion');
    } else if (page === 'feed') {
      setCurrentSuggestion('Tap on a game to get my insights!');
      setBubbleMode('suggestion');
    }
  }, [isDetached]);

  // Handle model details tap (explain what the model percentages mean)
  const onModelDetailsTap = useCallback(() => {
    if (!isDetached) return;

    console.log('🤖 Model details tapped');
    setCurrentPageContext('model-details');
    setCurrentSuggestion(PAGE_EXPLANATIONS['model-details']);
    setBubbleMode('suggestion');
  }, [isDetached]);

  // Handle outliers page with data - show explanation then follow up with suggestion
  const onOutliersPageWithData = useCallback(async (outlierGames: GameData[], sport: Sport) => {
    if (!isDetached) return;

    console.log(`🤖 Outliers page with ${outlierGames.length} games`);
    setCurrentPageContext('outliers');
    setCurrentSport(sport);

    // First show the explanation
    setCurrentSuggestion(PAGE_EXPLANATIONS['outliers']);
    setBubbleMode('suggestion');

    // After a delay, fetch an outlier suggestion if we have games
    if (outlierGames.length > 0) {
      setTimeout(async () => {
        if (!isDetached) return; // Check again in case dismissed

        setBubbleMode('scanning');
        setIsLoading(true);

        try {
          const response = await wagerBotSuggestionService.getSuggestion(sport, outlierGames);
          if (response.success && response.suggestion) {
            console.log(`🤖 Outlier suggestion: "${response.suggestion.substring(0, 50)}..."`);
            setCurrentSuggestion(response.suggestion);
            setCurrentGameId(response.gameId);
          } else {
            setCurrentSuggestion("These outliers look interesting - tap one to dive deeper!");
          }
          setBubbleMode('suggestion');
        } catch (error) {
          console.error('🤖 Error getting outlier suggestion:', error);
          setCurrentSuggestion("Check out these value opportunities!");
          setBubbleMode('suggestion');
        } finally {
          setIsLoading(false);
        }
      }, 4000); // Wait 4 seconds for user to read explanation
    }
  }, [isDetached]);

  // ==================== END FLOATING ASSISTANT ACTIONS ====================

  const onFeedMount = useCallback(() => {
    console.log('🤖 Feed mounted');
    isMounted.current = true;
  }, []);

  const onFeedUnmount = useCallback(() => {
    console.log('🤖 Feed unmounted, clearing timers');
    isMounted.current = false;
    clearAllTimers();
    visitedSports.current.clear();
  }, [clearAllTimers]);

  // ==================== PAGE DATA SETTERS ====================

  // Set picks page data for scanning
  const setPicksData = useCallback((picks: any[]) => {
    console.log(`🤖 Picks data updated: ${picks.length} picks`);
    picksDataRef.current = picks;
  }, []);

  // Set outliers page data for scanning
  const setOutliersData = useCallback((valueAlerts: any[], fadeAlerts: any[]) => {
    console.log(`🤖 Outliers data updated: ${valueAlerts.length} value alerts, ${fadeAlerts.length} fade alerts`);
    outliersDataRef.current = { valueAlerts, fadeAlerts };
  }, []);

  // Set scoreboard page data for scanning
  const setScoreboardData = useCallback((liveGames: any[]) => {
    console.log(`🤖 Scoreboard data updated: ${liveGames.length} live games`);
    scoreboardDataRef.current = liveGames;
  }, []);

  // Set Polymarket data for feed games
  const setPolymarketData = useCallback((data: Map<string, GamePolymarketData>) => {
    console.log(`🤖 Polymarket data updated: ${data.size} games`);
    polymarketDataRef.current = data;
  }, []);

  // ==================== END PAGE DATA SETTERS ====================

  return (
    <WagerBotSuggestionContext.Provider
      value={{
        // State
        isVisible,
        bubbleMode,
        currentSuggestion,
        currentGameId,
        currentSport,
        suggestionsEnabled,
        isLoading,
        testModeEnabled,

        // Floating assistant state
        isDetached,
        floatingPosition,
        currentPageContext,
        currentOpenGame,
        previousInsights,

        // Actions
        triggerSuggestion,
        dismissSuggestion,
        setSuggestionsEnabled,
        setTestModeEnabled,
        triggerTestSuggestion,
        openManualMenu,
        scanCurrentPage,
        openChat,

        // Floating assistant actions
        detachBubble,
        detachBubbleFromPill,
        dismissFloating,
        updateFloatingPosition,
        requestMoreDetails,
        requestAnotherInsight,
        initialBubbleDimensions,

        // Navigation tracking
        onGameSheetOpen,
        onGameSheetClose,
        onPageChange,
        onModelDetailsTap,
        onOutliersPageWithData,

        // Page data setters for scanning
        setPicksData,
        setOutliersData,
        setScoreboardData,
        setPolymarketData,

        // Lifecycle
        onSportChange,
        onFeedMount,
        onFeedUnmount,
      }}
    >
      {children}
    </WagerBotSuggestionContext.Provider>
  );
}

export function useWagerBotSuggestion() {
  const context = useContext(WagerBotSuggestionContext);
  if (!context) {
    throw new Error('useWagerBotSuggestion must be used within WagerBotSuggestionProvider');
  }
  return context;
}
