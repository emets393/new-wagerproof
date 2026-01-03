import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useTheme, Switch, Button, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEditorPickSheet } from '@/contexts/EditorPickSheetContext';
import { useThemeContext } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { fetchActiveGames, GameOption } from '@/services/editorPicksGameService';

type League = 'nfl' | 'cfb' | 'nba' | 'ncaab';
type PickType = 'spread' | 'over_under' | 'moneyline';

const UNITS_OPTIONS = ['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'];

export function EditorPickCreatorBottomSheet() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { bottomSheetRef, editingPick, closeSheet, onPickSaved } = useEditorPickSheet();

  // Form state
  const [league, setLeague] = useState<League | ''>('');
  const [games, setGames] = useState<GameOption[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [pickType, setPickType] = useState<PickType | ''>('');
  const [betType, setBetType] = useState<string>('');
  const [pickValue, setPickValue] = useState('');
  const [bestPrice, setBestPrice] = useState('');
  const [sportsbook, setSportsbook] = useState('');
  const [units, setUnits] = useState<string>('');
  const [editorsNotes, setEditorsNotes] = useState('');
  const [isFreePick, setIsFreePick] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const snapPoints = useMemo(() => ['90%'], []);

  const isEditing = !!editingPick;

  // Load editing pick data
  useEffect(() => {
    if (editingPick) {
      setLeague(editingPick.game_type as League);
      setSelectedGameId(editingPick.game_id);
      setPickType(editingPick.selected_bet_type as PickType || '');
      setBetType(editingPick.bet_type || '');
      setPickValue(editingPick.pick_value || '');
      setBestPrice(editingPick.best_price || '');
      setSportsbook(editingPick.sportsbook || '');
      setUnits(editingPick.units?.toString() || '');
      setEditorsNotes(editingPick.editors_notes || '');
      setIsFreePick(editingPick.is_free_pick || false);
    } else {
      resetForm();
    }
  }, [editingPick]);

  // Load games when league changes
  useEffect(() => {
    if (league) {
      loadGames(league);
    } else {
      setGames([]);
    }
  }, [league]);

  const loadGames = async (sport: League) => {
    setLoadingGames(true);
    try {
      const gamesData = await fetchActiveGames(sport);
      setGames(gamesData);
    } catch (error) {
      console.error('Error loading games:', error);
      setGames([]);
    } finally {
      setLoadingGames(false);
    }
  };

  const resetForm = () => {
    setLeague('');
    setSelectedGameId('');
    setPickType('');
    setBetType('');
    setPickValue('');
    setBestPrice('');
    setSportsbook('');
    setUnits('');
    setEditorsNotes('');
    setIsFreePick(false);
    setGames([]);
  };

  const validateForm = (publish: boolean): string | null => {
    if (!league) return 'Please select a league';
    if (!selectedGameId) return 'Please select a game';
    if (!pickType) return 'Please select a pick type';
    if (!pickValue.trim()) return 'Please enter a pick value';
    if (publish && !editorsNotes.trim()) return 'Please add editor notes before publishing';
    return null;
  };

  const handleSave = async (publish: boolean) => {
    const validationError = validateForm(publish);
    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    setSubmitting(true);

    try {
      const pickData: any = {
        game_id: selectedGameId,
        game_type: league,
        editor_id: user.id,
        selected_bet_type: pickType,
        pick_value: pickValue.trim(),
        best_price: bestPrice.trim() || null,
        sportsbook: sportsbook.trim() || null,
        units: units ? parseFloat(units) : null,
        editors_notes: editorsNotes.trim() || null,
        is_published: publish,
        is_free_pick: isFreePick,
        updated_at: new Date().toISOString(),
      };

      if (betType && betType.trim()) {
        pickData.bet_type = betType.trim();
      }

      // Archive game data for new picks
      if (!isEditing) {
        const selectedGame = games.find(g => g.id === selectedGameId);
        if (selectedGame) {
          pickData.archived_game_data = {
            awayTeam: selectedGame.awayTeam,
            homeTeam: selectedGame.homeTeam,
            gameDate: selectedGame.gameDate,
            awaySpread: selectedGame.awaySpread,
            homeSpread: selectedGame.homeSpread,
            awayMl: selectedGame.awayML,
            homeMl: selectedGame.homeML,
            overLine: selectedGame.total,
            archived_at: new Date().toISOString(),
          };
        }
      }

      if (isEditing && editingPick) {
        // Update existing pick
        const { error } = await supabase
          .from('editors_picks')
          .update(pickData)
          .eq('id', editingPick.id);

        if (error) throw error;
        Alert.alert('Success', publish ? 'Pick published!' : 'Pick saved as draft!');
      } else {
        // Create new pick
        const { error } = await supabase
          .from('editors_picks')
          .insert(pickData);

        if (error) throw error;
        Alert.alert('Success', publish ? 'Pick created and published!' : 'Pick saved as draft!');
      }

      onPickSaved?.();
      closeSheet();
      resetForm();
    } catch (error) {
      console.error('Error saving pick:', error);
      Alert.alert('Error', 'Failed to save pick. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingPick) return;

    Alert.alert(
      'Delete Pick',
      'Are you sure you want to delete this pick? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const { error } = await supabase
                .from('editors_picks')
                .delete()
                .eq('id', editingPick.id);

              if (error) throw error;

              Alert.alert('Success', 'Pick deleted');
              onPickSaved?.();
              closeSheet();
              resetForm();
            } catch (error) {
              console.error('Error deleting pick:', error);
              Alert.alert('Error', 'Failed to delete pick. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  const selectedGame = games.find(g => g.id === selectedGameId);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
      }}
      handleIndicatorStyle={{
        backgroundColor: isDark ? '#666' : '#ccc',
      }}
      onClose={() => {
        resetForm();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <BottomSheetScrollView
          contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 200 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <MaterialCommunityIcons name="star-circle" size={28} color="#22c55e" />
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {isEditing ? 'Edit Pick' : 'Create Editor Pick'}
            </Text>
          </View>

          {/* League Selector */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              LEAGUE *
            </Text>
            <View style={styles.chipRow}>
              {(['nfl', 'cfb', 'nba', 'ncaab'] as League[]).map((l) => (
                <Chip
                  key={l}
                  selected={league === l}
                  onPress={() => !isEditing && setLeague(l)}
                  style={[
                    styles.chip,
                    league === l && { backgroundColor: '#22c55e' },
                    isEditing && styles.chipDisabled,
                  ]}
                  textStyle={{ color: league === l ? 'white' : theme.colors.onSurface }}
                  disabled={isEditing}
                >
                  {l.toUpperCase()}
                </Chip>
              ))}
            </View>
          </View>

          {/* Game Selector */}
          {league && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
                SELECT GAME *
              </Text>
              {loadingGames ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : games.length === 0 ? (
                <Text style={[styles.noGamesText, { color: theme.colors.onSurfaceVariant }]}>
                  No upcoming games found
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.gamesScrollView}
                >
                  {games.map((game) => (
                    <TouchableOpacity
                      key={game.id}
                      style={[
                        styles.gameCard,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                          borderColor: selectedGameId === game.id ? '#22c55e' : 'transparent',
                        },
                        isEditing && styles.gameCardDisabled,
                      ]}
                      onPress={() => !isEditing && setSelectedGameId(game.id)}
                      disabled={isEditing}
                    >
                      <Text style={[styles.gameTeams, { color: theme.colors.onSurface }]}>
                        {game.awayTeam}
                      </Text>
                      <Text style={[styles.gameAt, { color: theme.colors.onSurfaceVariant }]}>@</Text>
                      <Text style={[styles.gameTeams, { color: theme.colors.onSurface }]}>
                        {game.homeTeam}
                      </Text>
                      <Text style={[styles.gameDate, { color: theme.colors.onSurfaceVariant }]}>
                        {game.gameDate}
                      </Text>
                      {selectedGameId === game.id && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={20}
                          color="#22c55e"
                          style={styles.checkIcon}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Pick Type Selector */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              PICK TYPE *
            </Text>
            <View style={styles.chipRow}>
              {(['spread', 'over_under', 'moneyline'] as PickType[]).map((pt) => (
                <Chip
                  key={pt}
                  selected={pickType === pt}
                  onPress={() => setPickType(pt)}
                  style={[
                    styles.chip,
                    pickType === pt && { backgroundColor: '#3b82f6' },
                  ]}
                  textStyle={{ color: pickType === pt ? 'white' : theme.colors.onSurface }}
                >
                  {pt === 'over_under' ? 'Over/Under' : pt.charAt(0).toUpperCase() + pt.slice(1)}
                </Chip>
              ))}
            </View>
          </View>

          {/* Pick Value */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              PICK VALUE * (e.g., "Chiefs -3.5" or "Over 47.5")
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  color: theme.colors.onSurface,
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                },
              ]}
              value={pickValue}
              onChangeText={setPickValue}
              placeholder="Enter pick value"
              placeholderTextColor={theme.colors.onSurfaceVariant}
            />
          </View>

          {/* Best Price */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              BEST PRICE (e.g., "-110" or "+120")
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  color: theme.colors.onSurface,
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                },
              ]}
              value={bestPrice}
              onChangeText={setBestPrice}
              placeholder="-110"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          {/* Sportsbook */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              SPORTSBOOK
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  color: theme.colors.onSurface,
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                },
              ]}
              value={sportsbook}
              onChangeText={setSportsbook}
              placeholder="e.g., FanDuel, DraftKings"
              placeholderTextColor={theme.colors.onSurfaceVariant}
            />
          </View>

          {/* Units */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              UNITS
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {UNITS_OPTIONS.map((u) => (
                  <Chip
                    key={u}
                    selected={units === u}
                    onPress={() => setUnits(units === u ? '' : u)}
                    style={[
                      styles.unitChip,
                      units === u && { backgroundColor: '#f59e0b' },
                    ]}
                    textStyle={{ color: units === u ? 'white' : theme.colors.onSurface }}
                  >
                    {u}
                  </Chip>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Free Pick Toggle */}
          <View style={styles.toggleRow}>
            <View>
              <Text style={[styles.toggleLabel, { color: theme.colors.onSurface }]}>
                Free Pick
              </Text>
              <Text style={[styles.toggleDescription, { color: theme.colors.onSurfaceVariant }]}>
                Visible to all users (not just Pro)
              </Text>
            </View>
            <Switch
              value={isFreePick}
              onValueChange={setIsFreePick}
              color="#22c55e"
            />
          </View>

          {/* Editor's Notes */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
              EDITOR'S ANALYSIS (required for publishing)
            </Text>
            <TextInput
              style={[
                styles.textInput,
                styles.textArea,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  color: theme.colors.onSurface,
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                },
              ]}
              value={editorsNotes}
              onChangeText={setEditorsNotes}
              placeholder="Explain your reasoning for this pick..."
              placeholderTextColor={theme.colors.onSurfaceVariant}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <Button
              mode="contained"
              onPress={() => handleSave(true)}
              loading={submitting}
              disabled={submitting || deleting}
              style={[styles.publishButton]}
              buttonColor="#22c55e"
              icon="check"
            >
              {isEditing ? 'Update & Publish' : 'Publish'}
            </Button>

            <Button
              mode="outlined"
              onPress={() => handleSave(false)}
              loading={submitting}
              disabled={submitting || deleting}
              style={styles.draftButton}
              icon="content-save"
            >
              Save as Draft
            </Button>

            {isEditing && (
              <Button
                mode="outlined"
                onPress={handleDelete}
                loading={deleting}
                disabled={submitting || deleting}
                style={styles.deleteButton}
                textColor="#ef4444"
                icon="delete"
              >
                Delete Pick
              </Button>
            )}
          </View>
        </BottomSheetScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 20,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  unitChip: {
    borderRadius: 16,
    minWidth: 50,
  },
  gamesScrollView: {
    maxHeight: 140,
  },
  gameCard: {
    padding: 12,
    borderRadius: 12,
    marginRight: 10,
    minWidth: 140,
    borderWidth: 2,
    position: 'relative',
  },
  gameCardDisabled: {
    opacity: 0.5,
  },
  gameTeams: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  gameAt: {
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 2,
  },
  gameDate: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
  },
  checkIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  noGamesText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
  },
  textArea: {
    minHeight: 100,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  actionsContainer: {
    gap: 12,
    marginTop: 12,
  },
  publishButton: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  draftButton: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  deleteButton: {
    borderRadius: 12,
    paddingVertical: 4,
    borderColor: '#ef4444',
  },
});
