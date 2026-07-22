import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import type { MlbAnalysisBetType, MlbAnalysisFilterState } from '@/types/mlbHistoricalAnalysis';
import { isMlbSideMarket, isMlbSideSymmetric } from '@/utils/mlbSideBreakingDims';
import { verdictBetPhrase, type SystemVerdict } from '@/services/analysisSystemsService';

type Step = 'totals_side' | 'symmetric_side' | 'verdict' | 'name';

interface SaveSystemDialogProps {
  visible: boolean;
  onClose: () => void;
  betType: MlbAnalysisBetType;
  filters: MlbAnalysisFilterState;
  rpcFilters: Record<string, unknown>;
  /** Used to set side/favDog when a symmetric side market needs a side picked. */
  patchFilters: (patch: Partial<MlbAnalysisFilterState>) => void;
  saving: boolean;
  onSave: (args: { name: string; verdict: SystemVerdict; isPublic: boolean }) => void;
}

/**
 * Multi-step "Save this System" dialog. Steps depend on the market:
 *  - totals (total/f5_total): pick Over / Under → name
 *  - side market, symmetric: pick Home/Away/Favorites/Underdogs (sets a filter),
 *    then ON vs AGAINST → name
 *  - side market, not symmetric: ON vs AGAINST → name
 * See .claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md.
 */
export function SaveSystemDialog({
  visible,
  onClose,
  betType,
  filters,
  rpcFilters,
  patchFilters,
  saving,
  onSave,
}: SaveSystemDialogProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();

  const isTotals = betType === 'total' || betType === 'f5_total';
  const isSide = isMlbSideMarket(betType);

  const [step, setStep] = useState<Step>('name');
  const [verdict, setVerdict] = useState<SystemVerdict | null>(null);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  // Initialize the flow whenever the dialog opens.
  useEffect(() => {
    if (!visible) return;
    setName('');
    setIsPublic(false);
    setVerdict(null);
    if (isTotals) {
      setStep('totals_side');
    } else if (isSide) {
      setStep(isMlbSideSymmetric(filters, betType) ? 'symmetric_side' : 'verdict');
    } else {
      // Fallback (shouldn't happen for known bet types) — go straight to name.
      setStep('name');
    }
    // Only re-run when opened / bet type changes — not on every filter edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, betType]);

  const surface = isDark ? '#1c1c1e' : '#ffffff';
  const border = isDark ? '#2c2c2e' : '#e5e7eb';

  const chooseSymmetricSide = (patch: Partial<MlbAnalysisFilterState>) => {
    Haptics.selectionAsync();
    patchFilters(patch);
    setStep('verdict');
  };

  const chooseVerdict = (v: SystemVerdict) => {
    Haptics.selectionAsync();
    setVerdict(v);
    setStep('name');
  };

  const confirmationLine = useMemo(() => {
    if (!verdict) return '';
    return `We'll track this system's record as if you bet ${verdictBetPhrase(verdict)} once in every game that matches your filters.`;
  }, [verdict]);

  const canSave = name.trim().length > 0 && !!verdict && !saving;

  const OptionButton = ({
    icon,
    title,
    subtitle,
    onPress,
  }: {
    icon?: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.optionBtn, { borderColor: border, backgroundColor: isDark ? '#2a2a2c' : '#f7f7f8' }]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      {icon ? <Text style={styles.optionIcon}>{icon}</Text> : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionTitle, { color: theme.colors.onSurface }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.optionSubtitle, { color: theme.colors.onSurfaceVariant }]}>{subtitle}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Save this System</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={22} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            {step === 'totals_side' && (
              <>
                <Text style={[styles.prompt, { color: theme.colors.onSurface }]}>Which side?</Text>
                <OptionButton icon="⬆️" title="The Over" onPress={() => chooseVerdict('over')} />
                <OptionButton icon="⬇️" title="The Under" onPress={() => chooseVerdict('under')} />
              </>
            )}

            {step === 'symmetric_side' && (
              <>
                <Text style={[styles.prompt, { color: theme.colors.onSurface }]}>
                  Your filters describe the game — now pick which side to track. Every game has two
                  teams. Which side does this system bet?
                </Text>
                <View style={styles.sideGrid}>
                  <TouchableOpacity
                    style={[styles.sideChip, { borderColor: border }]}
                    onPress={() => chooseSymmetricSide({ side: 'home' })}
                  >
                    <Text style={[styles.sideChipText, { color: theme.colors.onSurface }]}>Home teams</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sideChip, { borderColor: border }]}
                    onPress={() => chooseSymmetricSide({ side: 'away' })}
                  >
                    <Text style={[styles.sideChipText, { color: theme.colors.onSurface }]}>Away teams</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sideChip, { borderColor: border }]}
                    onPress={() => chooseSymmetricSide({ favDog: 'favorite' })}
                  >
                    <Text style={[styles.sideChipText, { color: theme.colors.onSurface }]}>Favorites</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sideChip, { borderColor: border }]}
                    onPress={() => chooseSymmetricSide({ favDog: 'underdog' })}
                  >
                    <Text style={[styles.sideChipText, { color: theme.colors.onSurface }]}>Underdogs</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 'verdict' && (
              <>
                <Text style={[styles.prompt, { color: theme.colors.onSurface }]}>
                  Which side does this system bet?
                </Text>
                <OptionButton
                  icon="⚡"
                  title="Bet ON these teams"
                  subtitle="Every time a team matches my filters, bet on them."
                  onPress={() => chooseVerdict('team')}
                />
                <OptionButton
                  icon="🔄"
                  title="Bet AGAINST these teams"
                  subtitle="Every time a team matches my filters, bet on the other side."
                  onPress={() => chooseVerdict('fade')}
                />
              </>
            )}

            {step === 'name' && (
              <>
                <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>System name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Home dogs off a blowout"
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                  style={[styles.input, { color: theme.colors.onSurface, borderColor: border, backgroundColor: isDark ? '#2a2a2c' : '#f7f7f8' }]}
                  autoFocus
                  maxLength={60}
                />

                <Text style={[styles.confirmation, { color: theme.colors.onSurfaceVariant }]}>
                  {confirmationLine}
                </Text>

                <TouchableOpacity
                  style={styles.shareRow}
                  activeOpacity={0.8}
                  onPress={() => setIsPublic((v) => !v)}
                >
                  <Switch value={isPublic} onValueChange={setIsPublic} color={theme.colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.shareTitle, { color: theme.colors.onSurface }]}>
                      Share to the Systems Leaderboard
                    </Text>
                    <Text style={[styles.shareHelp, { color: theme.colors.onSurfaceVariant }]}>
                      Other users will see your username, this system&apos;s name, and its record.
                      Systems need 10+ games of history to appear.
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.colors.primary, opacity: canSave ? 1 : 0.5 }]}
                  disabled={!canSave}
                  onPress={() => {
                    if (!verdict) return;
                    onSave({ name: name.trim(), verdict, isPublic });
                  }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                  ) : (
                    <Text style={{ color: theme.colors.onPrimary, fontWeight: '700', fontSize: 16 }}>
                      Save System
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '800' },
  prompt: { fontSize: 15, fontWeight: '600', marginBottom: 12, lineHeight: 21 },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  optionIcon: { fontSize: 22 },
  optionTitle: { fontSize: 15, fontWeight: '700' },
  optionSubtitle: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  sideGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sideChip: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sideChipText: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  confirmation: { fontSize: 13, lineHeight: 19, marginTop: 14 },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
  },
  shareTitle: { fontSize: 14, fontWeight: '700' },
  shareHelp: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  saveBtn: {
    marginTop: 20,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
  },
});
