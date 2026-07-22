import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '@/contexts/ThemeContext';
import {
  useDeleteSystem,
  useMySystems,
  useRenameSystem,
  useSetSystemPublic,
} from '@/hooks/useAnalysisSystems';
import {
  sinceSavedLabel,
  verdictLabel,
  type SavedSystemRow,
} from '@/services/analysisSystemsService';

interface MySystemsSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (row: SavedSystemRow) => void;
}

/** Bottom-sheet-style modal listing the user's saved MLB systems. */
export function MySystemsSheet({ visible, onClose, onApply }: MySystemsSheetProps) {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { data: systems, isLoading } = useMySystems({ enabled: visible });
  const renameMutation = useRenameSystem();
  const setPublicMutation = useSetSystemPublic();
  const deleteMutation = useDeleteSystem();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const surface = isDark ? '#1c1c1e' : '#ffffff';
  const border = isDark ? '#2c2c2e' : '#e5e7eb';
  const rowBg = isDark ? '#2a2a2c' : '#f7f7f8';

  const commitRename = (id: string) => {
    const trimmed = editName.trim();
    if (trimmed.length > 0) {
      renameMutation.mutate({ id, name: trimmed });
    }
    setEditingId(null);
    setEditName('');
  };

  const confirmDelete = (row: SavedSystemRow) => {
    Alert.alert('Delete System', `Delete "${row.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          deleteMutation.mutate(row.id);
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: border }]}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>My Systems</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurface} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={theme.colors.primary} />
          ) : !systems || systems.length === 0 ? (
            <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
              You haven&apos;t saved any systems yet. Build a filter and tap Save System.
            </Text>
          ) : (
            systems.map((row) => (
              <View key={row.id} style={[styles.row, { backgroundColor: rowBg, borderColor: border }]}>
                <TouchableOpacity
                  style={styles.rowMain}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onApply(row);
                  }}
                  disabled={editingId === row.id}
                >
                  {editingId === row.id ? (
                    <TextInput
                      value={editName}
                      onChangeText={setEditName}
                      onSubmitEditing={() => commitRename(row.id)}
                      onBlur={() => commitRename(row.id)}
                      autoFocus
                      maxLength={60}
                      style={[styles.editInput, { color: theme.colors.onSurface, borderColor: theme.colors.primary }]}
                    />
                  ) : (
                    <Text style={[styles.name, { color: theme.colors.onSurface }]} numberOfLines={1}>
                      {row.name}
                    </Text>
                  )}
                  <Text style={[styles.verdict, { color: theme.colors.onSurfaceVariant }]}>
                    {verdictLabel(row.verdict)}{row.verdict ? ' · ' : ''}{(row.bet_type || '').toUpperCase()}
                  </Text>
                  <Text style={[styles.since, { color: theme.colors.onSurfaceVariant }]}>
                    {sinceSavedLabel(row.since_saved)}
                  </Text>
                </TouchableOpacity>

                {/* Share toggle */}
                <View style={styles.shareCol}>
                  <Switch
                    value={row.is_public}
                    onValueChange={(v) => setPublicMutation.mutate({ id: row.id, isPublic: v })}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.shareLabel, { color: theme.colors.onSurfaceVariant }]}>Share</Text>
                </View>

                {/* Rename / delete */}
                <View style={styles.actionsCol}>
                  <TouchableOpacity
                    hitSlop={8}
                    style={styles.iconBtn}
                    onPress={() => {
                      setEditingId(row.id);
                      setEditName(row.name);
                    }}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.colors.onSurfaceVariant} />
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={8} style={styles.iconBtn} onPress={() => confirmDelete(row)}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontWeight: '800' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14, lineHeight: 20, paddingHorizontal: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  rowMain: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '700' },
  editInput: {
    fontSize: 15,
    fontWeight: '700',
    borderBottomWidth: 1.5,
    paddingVertical: 2,
  },
  verdict: { fontSize: 12, fontWeight: '600' },
  since: { fontSize: 12 },
  shareCol: { alignItems: 'center' },
  shareLabel: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  actionsCol: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 6 },
});
