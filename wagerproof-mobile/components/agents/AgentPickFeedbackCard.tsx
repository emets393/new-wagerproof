import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { submitAgentPickFeedback } from '@/services/agentPickFeedbackService';
import type { AgentPick, AgentProfile } from '@/types/agent';

const DECORATIVE_ICONS = [
  'message-alert',
  'alert',
  'help-circle',
  'forum',
  'hand-wave',
  'flag',
  'inbox',
  'email',
  'check-circle',
  'comment-text',
] as const;

interface AgentPickFeedbackCardProps {
  agent: AgentProfile;
  picks?: AgentPick[];
}

/**
 * Expo port of Honeydew's recipe-detail "How did we do?" card. Same coral
 * gradient chrome and Report → Submit → Thanks flow; writes to
 * `agent_pick_feedback` for periodic review.
 */
export function AgentPickFeedbackCard({ agent, picks = [] }: AgentPickFeedbackCardProps) {
  const { user } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [thanksOpen, setThanksOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const closeReport = () => {
    setReportOpen(false);
    setDescription('');
  };

  const submitReport = async () => {
    if (isSubmitting || !user?.id) {
      closeReport();
      return;
    }
    setIsSubmitting(true);
    try {
      await submitAgentPickFeedback({
        userId: user.id,
        agent,
        picks,
        userDescription: description.trim(),
      });
      closeReport();
      setThanksOpen(true);
    } catch {
      closeReport();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <TouchableOpacity activeOpacity={0.88} onPress={() => setReportOpen(true)}>
        <LinearGradient
          colors={['rgb(255, 64, 77)', 'rgb(255, 158, 128)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.card}
        >
          <View pointerEvents="none" style={styles.chrome}>
            {DECORATIVE_ICONS.map((name, index) => (
              <MaterialCommunityIcons
                key={`${name}-${index}`}
                name={name}
                size={18 + (index % 3) * 3}
                color="rgba(255, 64, 77, 0.35)"
                style={[
                  styles.chromeIcon,
                  { left: `${46 + ((index * 6) % 44)}%`, top: 8 + ((index * 13) % 36) },
                ]}
              />
            ))}
          </View>
          <LinearGradient
            colors={['rgb(255, 64, 77)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.title} numberOfLines={1}>How did we do?</Text>
              <Text style={styles.subtitle} numberOfLines={1}>Tap to report a mistake</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Report</Text>
              <MaterialCommunityIcons name="chevron-right" size={14} color="#111" />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={closeReport}>
        <Pressable style={styles.backdrop} onPress={closeReport}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <Text style={styles.dialogTitle}>Report an Issue</Text>
            <Text style={styles.dialogBody}>What went wrong with this agent's picks?</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue (optional)..."
              placeholderTextColor="#8E8E93"
              style={styles.input}
              multiline
              autoFocus
            />
            <View style={styles.actions}>
              <TouchableOpacity onPress={closeReport} style={styles.actionButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void submitReport()}
                disabled={isSubmitting}
                style={styles.actionButton}
              >
                <Text style={styles.submitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={thanksOpen} transparent animationType="fade" onRequestClose={() => setThanksOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setThanksOpen(false)}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <Text style={styles.dialogTitle}>Thanks for the feedback.</Text>
            <Text style={styles.dialogBody}>
              We will review this agent's picks ASAP and implement fixes for next time.
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => setThanksOpen(false)} style={styles.actionButton}>
                <Text style={styles.submitText}>Ok</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  chrome: {
    ...StyleSheet.absoluteFillObject,
  },
  chromeIcon: {
    position: 'absolute',
  },
  row: {
    flex: 1,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 12,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 999,
    borderWidth: 0.75,
    borderColor: 'rgba(255,255,255,0.32)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  dialog: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 8,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  dialogBody: {
    marginTop: 8,
    fontSize: 13,
    color: '#3C3C43',
    textAlign: 'center',
  },
  input: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: '#000',
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.29)',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 17,
    color: '#8E8E93',
  },
  submitText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
});
