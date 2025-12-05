import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme, Button, Divider, Badge } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCardShimmer } from '@/components/AlertCardShimmer';

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  submitted_by: string;
  submitter_display_name: string;
  status: 'pending' | 'approved' | 'roadmap';
  roadmap_status: 'planned' | 'in_progress' | 'completed' | null;
  upvotes: number;
  downvotes: number;
  created_at: string;
  updated_at: string;
}

interface UserVote {
  feature_request_id: string;
  vote_type: 'upvote' | 'downvote';
}

export default function FeatureRequestsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [userVotes, setUserVotes] = useState<UserVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Fetch user's display name
  useEffect(() => {
    async function fetchDisplayName() {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setDisplayName(data.display_name || '');
      }
    }

    fetchDisplayName();
  }, [user]);

  const fetchRequests = useCallback(async () => {
    try {
      // Fetch feature requests - only approved and roadmap for regular users
      const { data: requestsData, error: requestsError } = await supabase
        .from('feature_requests')
        .select('*')
        .in('status', ['approved', 'roadmap'])
        .order('created_at', { ascending: false });

      if (requestsError) {
        throw requestsError;
      }

      setRequests((requestsData || []) as FeatureRequest[]);

      // Fetch user's votes
      if (user) {
        const { data: votesData, error: votesError } = await supabase
          .from('feature_request_votes')
          .select('feature_request_id, vote_type')
          .eq('user_id', user.id);

        if (!votesError) {
          setUserVotes((votesData || []) as UserVote[]);
        }
      }
    } catch (err) {
      console.error('Error fetching feature requests:', err);
      Alert.alert('Error', 'Failed to load feature requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user, fetchRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, [fetchRequests]);

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit a feature request');
      return;
    }

    if (!title.trim() || !description.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from('feature_requests').insert({
        title: title.trim(),
        description: description.trim(),
        submitted_by: user.id,
        submitter_display_name: displayName || 'Anonymous',
        status: 'pending',
      });

      if (error) throw error;

      Alert.alert('Success', 'Feature request submitted! Our team will review it soon.');
      setTitle('');
      setDescription('');
      setSubmitModalVisible(false);
      fetchRequests();
    } catch (err) {
      console.error('Error submitting feature request:', err);
      Alert.alert('Error', 'Failed to submit feature request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (requestId: string, voteType: 'upvote' | 'downvote') => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to vote');
      return;
    }

    try {
      const existingVote = userVotes.find((v) => v.feature_request_id === requestId);

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Remove vote if clicking the same vote type
          const { error } = await supabase
            .from('feature_request_votes')
            .delete()
            .eq('feature_request_id', requestId)
            .eq('user_id', user.id);

          if (error) throw error;
        } else {
          // Update vote if clicking different vote type
          const { error } = await supabase
            .from('feature_request_votes')
            .update({ vote_type: voteType })
            .eq('feature_request_id', requestId)
            .eq('user_id', user.id);

          if (error) throw error;
        }
      } else {
        // Insert new vote
        const { error } = await supabase.from('feature_request_votes').insert({
          feature_request_id: requestId,
          user_id: user.id,
          vote_type: voteType,
        });

        if (error) throw error;
      }

      fetchRequests();
    } catch (err) {
      console.error('Error voting:', err);
      Alert.alert('Error', 'Failed to register vote. Please try again.');
    }
  };

  const getUserVote = (requestId: string) => {
    return userVotes.find((v) => v.feature_request_id === requestId);
  };

  const renderFeatureCard = (request: FeatureRequest) => {
    const userVote = getUserVote(request.id);
    const netVotes = request.upvotes - request.downvotes;
    const isRoadmap = request.status === 'roadmap';

    // Determine card color based on roadmap status
    let cardBgColor = theme.colors.surface;
    let iconName = 'lightbulb-on';
    let iconColor = theme.colors.primary;
    let badgeColor = theme.colors.primary;
    let badgeText = 'Community';

    if (isRoadmap) {
      if (request.roadmap_status === 'planned') {
        cardBgColor = theme.dark ? '#1e3a8a20' : '#dbeafe';
        iconName = 'clock-outline';
        iconColor = '#3b82f6';
        badgeColor = '#3b82f6';
        badgeText = 'Planned';
      } else if (request.roadmap_status === 'in_progress') {
        cardBgColor = theme.dark ? '#581c8720' : '#f3e8ff';
        iconName = 'rocket-launch';
        iconColor = '#a855f7';
        badgeColor = '#a855f7';
        badgeText = 'In Progress';
      } else if (request.roadmap_status === 'completed') {
        cardBgColor = theme.dark ? '#14532d20' : '#dcfce7';
        iconName = 'check-circle';
        iconColor = '#22c55e';
        badgeColor = '#22c55e';
        badgeText = 'Completed';
      }
    }

    return (
      <View
        key={request.id}
        style={[
          styles.card,
          {
            backgroundColor: cardBgColor,
            borderColor: theme.colors.outline,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <MaterialCommunityIcons name={iconName as any} size={24} color={iconColor} />
            <View style={styles.cardHeaderText}>
              <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                {request.title}
              </Text>
              <View style={styles.badgeContainer}>
                <View style={[styles.badge, { backgroundColor: badgeColor + '30' }]}>
                  <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <Text style={[styles.cardDescription, { color: theme.colors.onSurfaceVariant }]}>
          {request.description}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardInfoText, { color: theme.colors.onSurfaceVariant }]}>
              By {request.submitter_display_name}
            </Text>
            <Text style={[styles.cardInfoText, { color: theme.colors.onSurfaceVariant }]}>
              {' • '}
            </Text>
            <Text style={[styles.cardInfoText, { color: theme.colors.onSurfaceVariant }]}>
              {new Date(request.created_at).toLocaleDateString()}
            </Text>
          </View>

          {!isRoadmap && (
            <View style={styles.voteContainer}>
              <TouchableOpacity
                style={[
                  styles.voteButton,
                  {
                    backgroundColor:
                      userVote?.vote_type === 'upvote'
                        ? '#22c55e30'
                        : theme.colors.surfaceVariant,
                  },
                ]}
                onPress={() => handleVote(request.id, 'upvote')}
              >
                <MaterialCommunityIcons
                  name="thumb-up"
                  size={18}
                  color={userVote?.vote_type === 'upvote' ? '#22c55e' : theme.colors.onSurfaceVariant}
                />
              </TouchableOpacity>

              <View
                style={[
                  styles.voteBadge,
                  {
                    backgroundColor:
                      netVotes > 0
                        ? '#22c55e30'
                        : netVotes < 0
                        ? '#ef444430'
                        : theme.colors.surfaceVariant,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.voteBadgeText,
                    {
                      color:
                        netVotes > 0
                          ? '#22c55e'
                          : netVotes < 0
                          ? '#ef4444'
                          : theme.colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {netVotes > 0 ? '+' : ''}
                  {netVotes}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.voteButton,
                  {
                    backgroundColor:
                      userVote?.vote_type === 'downvote'
                        ? '#ef444430'
                        : theme.colors.surfaceVariant,
                  },
                ]}
                onPress={() => handleVote(request.id, 'downvote')}
              >
                <MaterialCommunityIcons
                  name="thumb-down"
                  size={18}
                  color={userVote?.vote_type === 'downvote' ? '#ef4444' : theme.colors.onSurfaceVariant}
                />
              </TouchableOpacity>
            </View>
          )}

          {isRoadmap && (
            <View style={styles.roadmapVoteInfo}>
              <Text style={[styles.roadmapVoteText, { color: theme.colors.onSurfaceVariant }]}>
                {netVotes} votes
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView 
            contentContainerStyle={{ 
                paddingTop: insets.top + 80, 
                paddingHorizontal: 20,
                paddingBottom: 20 
            }}
        >
            <View style={{ marginBottom: 16 }}>
                <View style={{ height: 24, width: 150, backgroundColor: theme.colors.surfaceVariant, borderRadius: 8, marginBottom: 16 }} />
                {[1, 2, 3].map((i) => (
                    <AlertCardShimmer key={`shim-1-${i}`} />
                ))}
            </View>
            
            <Divider style={styles.divider} />

            <View style={{ marginTop: 16 }}>
                <View style={{ height: 24, width: 150, backgroundColor: theme.colors.surfaceVariant, borderRadius: 8, marginBottom: 16 }} />
                {[1, 2, 3].map((i) => (
                    <AlertCardShimmer key={`shim-2-${i}`} />
                ))}
            </View>
        </ScrollView>

        {/* Frosted Glass Header */}
        <BlurView
          intensity={80}
          tint={theme.dark ? 'dark' : 'light'}
          style={[styles.headerBlur, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerContent}>
            <MaterialCommunityIcons name="lightbulb-on" size={32} color={theme.colors.primary} />
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Feature Requests</Text>
          </View>
        </BlurView>
      </View>
    );
  }

  const approvedRequests = requests.filter((r) => r.status === 'approved');
  const roadmapRequests = requests.filter((r) => r.status === 'roadmap');

  const plannedItems = roadmapRequests.filter((r) => r.roadmap_status === 'planned');
  const inProgressItems = roadmapRequests.filter((r) => r.roadmap_status === 'in_progress');
  const completedItems = roadmapRequests.filter((r) => r.roadmap_status === 'completed');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: insets.top + 80, // Space for blurred header
          paddingBottom: 65 + insets.bottom + 20
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
      >
        {/* Community Voting Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Community Voting
          </Text>
          {approvedRequests.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
              <MaterialCommunityIcons
                name="lightbulb-on-outline"
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                No feature requests yet
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.onSurfaceVariant }]}>
                Be the first to submit one!
              </Text>
            </View>
          ) : (
            approvedRequests.map(renderFeatureCard)
          )}
        </View>

        <Divider style={styles.divider} />

        {/* Developer Roadmap Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Developer Roadmap
          </Text>

          {roadmapRequests.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
              <MaterialCommunityIcons
                name="map-marker-path"
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                No roadmap items yet
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.onSurfaceVariant }]}>
                Check back soon!
              </Text>
            </View>
          ) : (
            <>
              {plannedItems.length > 0 && (
                <View style={styles.roadmapSection}>
                  <View style={styles.roadmapHeader}>
                    <MaterialCommunityIcons name="clock-outline" size={24} color="#3b82f6" />
                    <Text style={[styles.roadmapTitle, { color: theme.colors.onSurface }]}>
                      Planned
                    </Text>
                    <View style={[styles.countBadge, { backgroundColor: '#3b82f630' }]}>
                      <Text style={[styles.countBadgeText, { color: '#3b82f6' }]}>
                        {plannedItems.length}
                      </Text>
                    </View>
                  </View>
                  {plannedItems.map(renderFeatureCard)}
                </View>
              )}

              {inProgressItems.length > 0 && (
                <View style={styles.roadmapSection}>
                  <View style={styles.roadmapHeader}>
                    <MaterialCommunityIcons name="rocket-launch" size={24} color="#a855f7" />
                    <Text style={[styles.roadmapTitle, { color: theme.colors.onSurface }]}>
                      In Progress
                    </Text>
                    <View style={[styles.countBadge, { backgroundColor: '#a855f730' }]}>
                      <Text style={[styles.countBadgeText, { color: '#a855f7' }]}>
                        {inProgressItems.length}
                      </Text>
                    </View>
                  </View>
                  {inProgressItems.map(renderFeatureCard)}
                </View>
              )}

              {completedItems.length > 0 && (
                <View style={styles.roadmapSection}>
                  <View style={styles.roadmapHeader}>
                    <MaterialCommunityIcons name="check-circle" size={24} color="#22c55e" />
                    <Text style={[styles.roadmapTitle, { color: theme.colors.onSurface }]}>
                      Completed
                    </Text>
                    <View style={[styles.countBadge, { backgroundColor: '#22c55e30' }]}>
                      <Text style={[styles.countBadgeText, { color: '#22c55e' }]}>
                        {completedItems.length}
                      </Text>
                    </View>
                  </View>
                  {completedItems.map(renderFeatureCard)}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Frosted Glass Header */}
      <BlurView
        intensity={80}
        tint={theme.dark ? 'dark' : 'light'}
        style={[styles.headerBlur, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="lightbulb-on" size={32} color={theme.colors.primary} />
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>Feature Requests</Text>
        </View>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: '#22c55e' }]}
          onPress={() => setSubmitModalVisible(true)}
        >
          <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </BlurView>

      {/* Submit Modal */}
      <Modal
        visible={submitModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSubmitModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
                Submit Feature Request
              </Text>
              <TouchableOpacity onPress={() => setSubmitModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurface} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDescription, { color: theme.colors.onSurfaceVariant }]}>
              Share your ideas to help us improve WagerProof
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.colors.onSurface }]}>Title</Text>
              <RNTextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.onSurface,
                    borderColor: theme.colors.outline,
                  },
                ]}
                placeholder="Brief description of your feature idea"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.colors.onSurface }]}>Description</Text>
              <RNTextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.onSurface,
                    borderColor: theme.colors.outline,
                  },
                ]}
                placeholder="Provide more details about your feature request..."
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={() => setSubmitModalVisible(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.onSurface }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: '#22c55e' }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  cardInfoText: {
    fontSize: 12,
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voteButton: {
    padding: 8,
    borderRadius: 8,
  },
  voteBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  voteBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  roadmapVoteInfo: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roadmapVoteText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  divider: {
    marginVertical: 8,
  },
  roadmapSection: {
    marginBottom: 20,
  },
  roadmapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  roadmapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 120,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

