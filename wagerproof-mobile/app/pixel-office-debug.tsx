import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme, Chip, Divider, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PixelOffice } from '@/components/agents/PixelOffice';
import { useUserAgents } from '@/hooks/useAgents';

// ── All defined rooms ──
const ROOMS = [
  { id: 'entryway', label: 'Entryway', icon: 'door', color: '#f59e0b' },
  { id: 'office', label: 'Main Office', icon: 'desktop-tower-monitor', color: '#3b82f6' },
  { id: 'kitchen', label: 'Kitchen', icon: 'coffee-maker', color: '#10b981' },
  { id: 'lounge', label: 'Lounge', icon: 'sofa', color: '#8b5cf6' },
  { id: 'patio', label: 'Patio', icon: 'grill', color: '#f97316' },
] as const;

// ── Agent states ──
const AGENT_STATES = [
  { id: 'idle', label: 'Idle', color: '#94a3b8' },
  { id: 'working', label: 'Working', color: '#f97316' },
  { id: 'thinking', label: 'Thinking', color: '#8b5cf6' },
  { id: 'done', label: 'Done', color: '#22c55e' },
  { id: 'error', label: 'Error', color: '#ef4444' },
] as const;

// ── All possible activities (grouped by room) ──
const ACTIVITIES = {
  entryway: [
    { id: 'arriving', label: 'Arriving', icon: 'login' },
    { id: 'leaving', label: 'Leaving', icon: 'logout' },
    { id: 'reading_bulletin', label: 'Reading Bulletin', icon: 'bulletin-board' },
  ],
  office: [
    { id: 'working_desk', label: 'Working at Desk', icon: 'desktop-tower-monitor' },
    { id: 'thinking_whiteboard', label: 'At Whiteboard', icon: 'presentation' },
    { id: 'printing', label: 'Printing', icon: 'printer' },
    { id: 'stretching', label: 'Stretching', icon: 'human-handsup' },
    { id: 'checking_servers', label: 'Server Rack', icon: 'server' },
    { id: 'chatting_aisle', label: 'Aisle Chat', icon: 'chat' },
  ],
  kitchen: [
    { id: 'getting_coffee', label: 'Getting Coffee', icon: 'coffee' },
    { id: 'getting_water', label: 'Water Cooler', icon: 'cup-water' },
    { id: 'eating', label: 'Eating Lunch', icon: 'food' },
    { id: 'microwaving', label: 'Microwaving', icon: 'microwave' },
    { id: 'checking_fridge', label: 'Checking Fridge', icon: 'fridge' },
    { id: 'snacking', label: 'Raiding Snacks', icon: 'food-apple' },
    { id: 'socializing', label: 'Table Chat', icon: 'account-group' },
  ],
  lounge: [
    { id: 'watching_tv', label: 'Watching TV', icon: 'television' },
    { id: 'celebrating', label: 'Celebrating Win', icon: 'party-popper' },
    { id: 'mourning', label: 'Mourning Loss', icon: 'emoticon-sad' },
    { id: 'reading', label: 'Reading', icon: 'book-open-variant' },
    { id: 'gaming', label: 'Arcade Gaming', icon: 'gamepad-variant' },
    { id: 'napping', label: 'Napping', icon: 'sleep' },
    { id: 'chatting_couch', label: 'Couch Chat', icon: 'chat-outline' },
  ],
  patio: [
    { id: 'grilling', label: 'Grilling', icon: 'grill' },
    { id: 'outdoor_meeting', label: 'Outdoor Meeting', icon: 'table-furniture' },
    { id: 'relaxing', label: 'Lounge Chair', icon: 'seat-recline-extra' },
    { id: 'cornhole', label: 'Playing Cornhole', icon: 'bullseye' },
    { id: 'fire_hangout', label: 'Fire Pit Hangout', icon: 'fire' },
    { id: 'petting_dog', label: 'Petting Dog', icon: 'dog' },
    { id: 'listening_music', label: 'Listening to Music', icon: 'music' },
    { id: 'getting_drink', label: 'Getting a Drink', icon: 'beer' },
    { id: 'gardening', label: 'Gardening', icon: 'flower' },
  ],
} as const;

// ── Particle effects ──
const PARTICLES = [
  { id: 'coffee_steam', label: 'Coffee Steam', icon: 'weather-fog' },
  { id: 'monitor_glow', label: 'Monitor Glow', icon: 'monitor' },
  { id: 'fire_embers', label: 'Fire Embers', icon: 'fire' },
  { id: 'string_lights', label: 'String Light Twinkle', icon: 'string-lights' },
  { id: 'server_leds', label: 'Server LEDs', icon: 'led-on' },
  { id: 'dust_motes', label: 'Dust Motes', icon: 'blur' },
  { id: 'confetti', label: 'Confetti', icon: 'party-popper' },
  { id: 'rain_cloud', label: 'Rain Cloud', icon: 'weather-rainy' },
  { id: 'zzz', label: 'Sleep Z\'s', icon: 'sleep' },
  { id: 'music_notes', label: 'Music Notes', icon: 'music-note' },
] as const;

export default function PixelOfficeDebugScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: agents } = useUserAgents();

  // ── State ──
  const [isNightMode, setIsNightMode] = useState(false);
  const [agentCount, setAgentCount] = useState(4);
  const [selectedAgent, setSelectedAgent] = useState(0);
  const [forcedState, setForcedState] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [showInteractionPoints, setShowInteractionPoints] = useState(false);
  const [activeParticles, setActiveParticles] = useState<Set<string>>(new Set());
  const [useRealAgents, setUseRealAgents] = useState(false);

  const isDark = true; // debug page always dark

  const toggleParticle = (id: string) => {
    setActiveParticles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleActivityTap = (roomId: string, activityId: string) => {
    Alert.alert(
      'Activity Triggered',
      `Agent ${selectedAgent} → ${activityId} in ${roomId}\n\n(Activity system not yet wired — this will work once the new map + activity engine are implemented)`,
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: '#0f1118' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pixel Office Debug</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Live Preview ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Preview</Text>
          <View style={styles.previewContainer}>
            <PixelOffice
              agents={useRealAgents && agents ? [...agents].sort((a, b) => (b.performance?.net_units ?? -Infinity) - (a.performance?.net_units ?? -Infinity)).slice(0, 6) : undefined}
              agentCount={useRealAgents ? undefined : agentCount}
              forceNight={isNightMode}
              forceAgentState={forcedState ?? undefined}
            />
          </View>
        </View>

        {/* ── Data Source ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Source</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Use real agents ({agents?.length ?? 0} available)</Text>
            <Switch value={useRealAgents} onValueChange={setUseRealAgents} color="#8b5cf6" />
          </View>
        </View>

        {/* ── Day / Night ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lighting</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>
              {isNightMode ? 'Night Mode' : 'Day Mode'}
            </Text>
            <Switch value={isNightMode} onValueChange={setIsNightMode} color="#f59e0b" />
          </View>
          <Text style={styles.hint}>
            Applies a night tint overlay. Full day/night asset swap will work once dual asset sets are created.
          </Text>
        </View>

        {/* ── Agent Count ── */}
        {!useRealAgents && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Agent Count: {agentCount}</Text>
            <View style={styles.chipRow}>
              {[1, 2, 3, 4, 5, 6].map(n => (
                <Chip
                  key={n}
                  selected={agentCount === n}
                  onPress={() => setAgentCount(n)}
                  style={[styles.chip, agentCount === n && styles.chipActive]}
                  textStyle={{ color: agentCount === n ? '#fff' : '#8b949e', fontSize: 13 }}
                >
                  {n}
                </Chip>
              ))}
            </View>
          </View>
        )}

        {/* ── Select Agent ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selected Agent: #{selectedAgent}</Text>
          <View style={styles.chipRow}>
            {Array.from({ length: agentCount }, (_, i) => (
              <Chip
                key={i}
                selected={selectedAgent === i}
                onPress={() => setSelectedAgent(i)}
                style={[styles.chip, selectedAgent === i && styles.chipActive]}
                textStyle={{ color: selectedAgent === i ? '#fff' : '#8b949e', fontSize: 13 }}
              >
                Agent {i}
              </Chip>
            ))}
          </View>
        </View>

        {/* ── Force State ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Force Agent State</Text>
          <View style={styles.chipRow}>
            {AGENT_STATES.map(s => (
              <Chip
                key={s.id}
                selected={forcedState === s.id}
                onPress={() => {
                  setForcedState(forcedState === s.id ? null : s.id);
                }}
                style={[styles.chip, forcedState === s.id && { backgroundColor: s.color }]}
                textStyle={{ color: forcedState === s.id ? '#fff' : '#8b949e', fontSize: 12 }}
              >
                {s.label}
              </Chip>
            ))}
          </View>
        </View>

        <Divider style={styles.divider} />

        {/* ── Rooms ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rooms</Text>
          <Text style={styles.hint}>Tap a room to highlight it, then pick an activity below</Text>
          <View style={styles.chipRow}>
            {ROOMS.map(r => (
              <Chip
                key={r.id}
                icon={() => <MaterialCommunityIcons name={r.icon as any} size={16} color={activeRoom === r.id ? '#fff' : r.color} />}
                selected={activeRoom === r.id}
                onPress={() => setActiveRoom(activeRoom === r.id ? null : r.id)}
                style={[styles.chip, activeRoom === r.id && { backgroundColor: r.color }]}
                textStyle={{ color: activeRoom === r.id ? '#fff' : '#8b949e', fontSize: 12 }}
              >
                {r.label}
              </Chip>
            ))}
          </View>
        </View>

        {/* ── Activities (for selected room) ── */}
        {activeRoom && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Activities — {ROOMS.find(r => r.id === activeRoom)?.label}
            </Text>
            <View style={styles.activityGrid}>
              {ACTIVITIES[activeRoom as keyof typeof ACTIVITIES]?.map(a => (
                <TouchableOpacity
                  key={a.id}
                  style={styles.activityCard}
                  onPress={() => handleActivityTap(activeRoom, a.id)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name={a.icon as any} size={24} color="#e0e4ec" />
                  <Text style={styles.activityLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Divider style={styles.divider} />

        {/* ── Overlays ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Map Overlays</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Show Tile Grid</Text>
            <Switch value={showGrid} onValueChange={setShowGrid} color="#3b82f6" />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Show Interaction Points</Text>
            <Switch value={showInteractionPoints} onValueChange={setShowInteractionPoints} color="#22c55e" />
          </View>
          <Text style={styles.hint}>
            (Overlays will render once new map tiles are implemented)
          </Text>
        </View>

        <Divider style={styles.divider} />

        {/* ── Particles ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Particle Effects</Text>
          <View style={styles.activityGrid}>
            {PARTICLES.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.activityCard,
                  activeParticles.has(p.id) && styles.activityCardActive,
                ]}
                onPress={() => toggleParticle(p.id)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={p.icon as any}
                  size={24}
                  color={activeParticles.has(p.id) ? '#f59e0b' : '#8b949e'}
                />
                <Text style={[
                  styles.activityLabel,
                  activeParticles.has(p.id) && { color: '#f59e0b' },
                ]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>
            (Particle system not yet implemented — this catalogs the planned effects)
          </Text>
        </View>

        <Divider style={styles.divider} />

        {/* ── Asset Library ── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.assetLibraryButton}
            onPress={() => router.push('/asset-library' as any)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="view-grid" size={24} color="#fff" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.assetLibraryTitle}>Asset Library</Text>
              <Text style={styles.assetLibrarySubtitle}>Browse all pixel office assets individually</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#8b949e" />
          </TouchableOpacity>
        </View>

        <Divider style={styles.divider} />

        {/* ── Quick Reference ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Reference</Text>
          <View style={styles.refCard}>
            <Text style={styles.refTitle}>Map Dimensions</Text>
            <Text style={styles.refValue}>640 x 960 px (32px tiles, 20x30 grid)</Text>
          </View>
          <View style={styles.refCard}>
            <Text style={styles.refTitle}>Sprite Frame Size</Text>
            <Text style={styles.refValue}>48 x 64 px (8 cols x 9 rows per sheet)</Text>
          </View>
          <View style={styles.refCard}>
            <Text style={styles.refTitle}>Character Sheets</Text>
            <Text style={styles.refValue}>8 avatars (avatar_0.webp – avatar_7.webp)</Text>
          </View>
          <View style={styles.refCard}>
            <Text style={styles.refTitle}>Animation States</Text>
            <Text style={styles.refValue}>18 current (idle, walk, sit, work, dance, alert × 4 dirs)</Text>
          </View>
          <View style={styles.refCard}>
            <Text style={styles.refTitle}>Interaction Points</Text>
            <Text style={styles.refValue}>~34 defined across 5 rooms</Text>
          </View>
          <View style={styles.refCard}>
            <Text style={styles.refTitle}>Asset Layers</Text>
            <Text style={styles.refValue}>3 layers: background, objects/characters, foreground</Text>
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e0e4ec',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 6,
    fontStyle: 'italic',
  },
  previewContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    marginBottom: 6,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#e0e4ec',
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: {
    backgroundColor: '#8b5cf6',
  },
  divider: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 8,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityCard: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  activityCardActive: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  activityLabel: {
    fontSize: 10,
    color: '#8b949e',
    textAlign: 'center',
    fontWeight: '600',
  },
  refCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    marginBottom: 4,
  },
  refTitle: {
    fontSize: 12,
    color: '#8b949e',
    fontWeight: '600',
  },
  refValue: {
    fontSize: 12,
    color: '#e0e4ec',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  assetLibraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
    borderRadius: 14,
    padding: 16,
  },
  assetLibraryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  assetLibrarySubtitle: {
    fontSize: 11,
    color: '#8b949e',
    marginTop: 2,
  },
});
