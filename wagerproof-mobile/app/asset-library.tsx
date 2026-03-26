import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// ── Asset Registry ──
type AssetEntry = {
  id: string;
  name: string;
  category: 'tileset' | 'furniture' | 'electronics' | 'structure' | 'character' | 'animation' | 'legacy';
  source: any;
  width: number;
  height: number;
  description?: string;
  badge?: string; // e.g. "NEW", "PIXELLAB"
};

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'view-grid' },
  { id: 'tileset', label: 'Tilesets', icon: 'grid' },
  { id: 'structure', label: 'Structure', icon: 'wall' },
  { id: 'furniture', label: 'Furniture', icon: 'sofa' },
  { id: 'electronics', label: 'Electronics', icon: 'monitor' },
  { id: 'character', label: 'Characters', icon: 'account' },
  { id: 'animation', label: 'Animations', icon: 'run' },
  { id: 'legacy', label: 'Legacy', icon: 'archive' },
] as const;

// ── Agent HQ v2 Assets ──
const ASSETS: AssetEntry[] = [
  // ═══════════════════════════════════════════
  // FLOOR TILESETS (8) — Wang tilesets, 32x32
  // ═══════════════════════════════════════════
  { id: 'ts_grass', name: 'Grass', category: 'tileset', source: require('@/assets/pixel-office/objects/floors/ts_grass.png'), width: 128, height: 128, description: 'Lush green grass with wildflowers. Wang tileset with earth-to-grass transitions.', badge: 'FLOOR' },
  { id: 'ts_wood_deck', name: 'Wood Deck', category: 'tileset', source: require('@/assets/pixel-office/objects/floors/ts_wood_deck.png'), width: 128, height: 128, description: 'Warm brown wooden deck planks. Grass-to-deck transitions for patio.', badge: 'FLOOR' },
  { id: 'ts_hardwood_dark', name: 'Hardwood (Dark)', category: 'tileset', source: require('@/assets/pixel-office/objects/floors/ts_hardwood_dark.png'), width: 128, height: 128, description: 'Dark brown polished hardwood. Hallway/entryway floor.', badge: 'FLOOR' },
  { id: 'ts_hardwood_ceo', name: 'Hardwood (CEO)', category: 'tileset', source: require('@/assets/pixel-office/objects/floors/ts_hardwood_ceo.png'), width: 128, height: 128, description: 'Medium warm brown hardwood. Executive office floor.', badge: 'FLOOR' },
  { id: 'ts_checkered', name: 'Checkered Tile', category: 'tileset', source: require('@/assets/pixel-office/objects/floors/ts_checkered.png'), width: 128, height: 128, description: 'Black & white checkered tile. Bullpen developer area.', badge: 'FLOOR' },
  { id: 'ts_kitchen', name: 'Kitchen Tile', category: 'tileset', source: require('@/assets/pixel-office/objects/floors/ts_kitchen.png'), width: 128, height: 128, description: 'Light beige ceramic tile. Kitchen/break room floor.', badge: 'FLOOR' },
  { id: 'ts_conference', name: 'Conference Carpet', category: 'tileset', source: require('@/assets/pixel-office/objects/floors/ts_conference.png'), width: 128, height: 128, description: 'Gray-blue carpet tile. Conference room floor.', badge: 'FLOOR' },
  { id: 'ts_stone_path', name: 'Stone Path', category: 'tileset', source: require('@/assets/pixel-office/objects/floors/ts_stone_path.png'), width: 128, height: 128, description: 'Gray stone concrete pathway. Outdoor walkway.', badge: 'FLOOR' },

  // ═══════════════════════════════════════════
  // STRUCTURE (1)
  // ═══════════════════════════════════════════
  { id: 'lattice_fence', name: 'Lattice Fence', category: 'structure', source: require('@/assets/pixel-office/objects/furniture/lattice_fence.png'), width: 128, height: 32, description: 'Brown wooden lattice privacy fence with climbing green vines. Patio boundary.', badge: 'HQ2' },

  // ═══════════════════════════════════════════
  // FURNITURE — Bullpen (4)
  // ═══════════════════════════════════════════
  { id: 'desk_bullpen', name: 'Bullpen Desk', category: 'furniture', source: require('@/assets/pixel-office/objects/furniture/desk_bullpen.png'), width: 96, height: 64, description: 'L-shaped wooden office desk with monitor hutch. Developer workstation.', badge: 'HQ2' },
  { id: 'monitor_dual', name: 'Dual Monitors', category: 'electronics', source: require('@/assets/pixel-office/objects/furniture/monitor_dual.png'), width: 48, height: 32, description: 'Dual desktop monitors showing green code on dark screens.', badge: 'HQ2' },
  { id: 'swivel_chair', name: 'Swivel Chair', category: 'furniture', source: require('@/assets/pixel-office/objects/furniture/swivel_chair.png'), width: 32, height: 32, description: 'White swivel office chair on casters. Developer seating.', badge: 'HQ2' },

  // ═══════════════════════════════════════════
  // FURNITURE — Conference Room (4)
  // ═══════════════════════════════════════════
  { id: 'conference_table', name: 'Conference Table', category: 'furniture', source: require('@/assets/pixel-office/objects/furniture/conference_table.png'), width: 128, height: 80, description: 'Large rectangular white conference table for 8 people.', badge: 'HQ2' },
  { id: 'conference_chair', name: 'Conference Chair', category: 'furniture', source: require('@/assets/pixel-office/objects/furniture/conference_chair.png'), width: 32, height: 32, description: 'Green padded rolling office chair with armrests.', badge: 'HQ2' },
  { id: 'whiteboard', name: 'Whiteboard', category: 'electronics', source: require('@/assets/pixel-office/objects/furniture/whiteboard.png'), width: 48, height: 32, description: 'Rolling whiteboard on metal stand with notes and diagrams.', badge: 'HQ2' },
  { id: 'tv_wall', name: 'Wall TV', category: 'electronics', source: require('@/assets/pixel-office/objects/furniture/tv_wall.png'), width: 64, height: 32, description: 'Large wall-mounted flat screen TV, dark screen.', badge: 'HQ2' },

  // ═══════════════════════════════════════════
  // FURNITURE — CEO Office (3)
  // ═══════════════════════════════════════════
  { id: 'executive_desk', name: 'Executive Desk', category: 'furniture', source: require('@/assets/pixel-office/objects/furniture/executive_desk.png'), width: 96, height: 48, description: 'Large dark brown wood executive desk with drawers.', badge: 'HQ2' },
  { id: 'green_sofa', name: 'Green Sofa', category: 'furniture', source: require('@/assets/pixel-office/objects/furniture/green_sofa.png'), width: 96, height: 48, description: 'Dark green three-cushion sofa couch. CEO/Lounge.', badge: 'HQ2' },
  { id: 'coffee_table_rug', name: 'Coffee Table + Rug', category: 'furniture', source: require('@/assets/pixel-office/objects/furniture/coffee_table_rug.png'), width: 48, height: 48, description: 'Round wooden coffee table on blue oval area rug.', badge: 'HQ2' },
  { id: 'bookshelf', name: 'Bookshelf', category: 'furniture', source: require('@/assets/pixel-office/objects/furniture/bookshelf.png'), width: 48, height: 64, description: 'Tall wooden bookshelf full of colorful books.', badge: 'HQ2' },

  // ═══════════════════════════════════════════
  // FURNITURE — Kitchen / Break Room (4)
  // ═══════════════════════════════════════════
  { id: 'kitchen_counter', name: 'Kitchen Counter', category: 'furniture', source: require('@/assets/pixel-office/objects/furniture/kitchen_counter.png'), width: 128, height: 96, description: 'L-shaped kitchen counter with sink, gray countertop, dark cabinets.', badge: 'HQ2' },
  { id: 'dining_table', name: 'Dining Table', category: 'furniture', source: require('@/assets/pixel-office/objects/furniture/dining_table.png'), width: 48, height: 48, description: 'Small square light wood dining table for 4.', badge: 'HQ2' },
  { id: 'dining_chair', name: 'Dining Chair', category: 'furniture', source: require('@/assets/pixel-office/objects/furniture/dining_chair.png'), width: 32, height: 32, description: 'Simple light wood dining chair. Kitchen seating.', badge: 'HQ2' },
  { id: 'water_cooler', name: 'Water Cooler', category: 'furniture', source: require('@/assets/pixel-office/objects/furniture/water_cooler.png'), width: 32, height: 32, description: 'Blue water jug on white stand dispenser.', badge: 'HQ2' },

  // ═══════════════════════════════════════════
  // FURNITURE — Utility Room (2)
  // ═══════════════════════════════════════════
  { id: 'printer', name: 'Printer/Copier', category: 'electronics', source: require('@/assets/pixel-office/objects/furniture/printer.png'), width: 48, height: 48, description: 'Large office printer copier machine.', badge: 'HQ2' },
  { id: 'filing_cabinet', name: 'Filing Cabinet', category: 'furniture', source: require('@/assets/pixel-office/objects/furniture/filing_cabinet.png'), width: 32, height: 48, description: 'Tall gray metal filing cabinet, 4 drawers.', badge: 'HQ2' },

  // ═══════════════════════════════════════════
  // FURNITURE — Patio (2)
  // ═══════════════════════════════════════════
  { id: 'bean_bag_yellow', name: 'Yellow Bean Bag', category: 'furniture', source: require('@/assets/pixel-office/objects/furniture/bean_bag_yellow.png'), width: 32, height: 32, description: 'Yellow bean bag chair. Patio seating.', badge: 'HQ2' },

  // ═══════════════════════════════════════════
  // PLANTS & OUTDOOR (4)
  // ═══════════════════════════════════════════
  { id: 'potted_plant_small', name: 'Small Plant', category: 'furniture', source: require('@/assets/pixel-office/objects/plants/potted_plant_small.png'), width: 32, height: 32, description: 'Small green potted plant in terra cotta pot.', badge: 'HQ2' },
  { id: 'palm_tall', name: 'Tall Palm', category: 'furniture', source: require('@/assets/pixel-office/objects/plants/palm_tall.png'), width: 32, height: 64, description: 'Tall tropical palm plant in large white pot.', badge: 'HQ2' },
  { id: 'hydrangea', name: 'Hydrangea Bush', category: 'furniture', source: require('@/assets/pixel-office/objects/plants/hydrangea.png'), width: 48, height: 48, description: 'Blue hydrangea flower bush. Patio garden.', badge: 'HQ2' },
  { id: 'evergreen_tree', name: 'Evergreen Tree', category: 'furniture', source: require('@/assets/pixel-office/objects/plants/evergreen_tree.png'), width: 64, height: 64, description: 'Large dark green pine tree. Outdoor.', badge: 'HQ2' },

  // ═══════════════════════════════════════════
  // LEGACY
  // ═══════════════════════════════════════════
  { id: 'office_bg_day', name: 'Office BG (Day) v1', category: 'legacy', source: require('@/assets/pixel-office/day/office_bg_day.webp'), width: 640, height: 960, description: 'Original composited background - being replaced by HQ v2.' },
  { id: 'office_bg_night', name: 'Office BG (Night) v1', category: 'legacy', source: require('@/assets/pixel-office/night/office_bg_night.webp'), width: 640, height: 960, description: 'Original night background.' },
];

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function AssetLibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<AssetEntry | null>(null);

  const filteredAssets =
    selectedCategory === 'all'
      ? ASSETS
      : ASSETS.filter(a => a.category === selectedCategory);

  const hq2Count = ASSETS.filter(a => a.badge === 'HQ2').length;
  const floorCount = ASSETS.filter(a => a.badge === 'FLOOR').length;

  return (
    <View style={[styles.container, { backgroundColor: '#0f1118' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Agent HQ v2 Assets</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filteredAssets.length}</Text>
        </View>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{ASSETS.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#22c55e' }]}>{floorCount}</Text>
          <Text style={styles.statLabel}>Floors</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#8b5cf6' }]}>{hq2Count}</Text>
          <Text style={styles.statLabel}>Objects</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>7</Text>
          <Text style={styles.statLabel}>Rooms</Text>
        </View>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryBar}
        contentContainerStyle={styles.categoryContent}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              selectedCategory === cat.id && styles.categoryChipActive,
            ]}
            onPress={() => {
              setSelectedCategory(cat.id);
              setSelectedAsset(null);
            }}
          >
            <MaterialCommunityIcons
              name={cat.icon as any}
              size={16}
              color={selectedCategory === cat.id ? '#fff' : '#8b949e'}
            />
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === cat.id && styles.categoryLabelActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Selected Asset Detail */}
        {selectedAsset && (
          <View style={styles.detailPanel}>
            <View style={styles.detailHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text style={styles.detailTitle} numberOfLines={1}>{selectedAsset.name}</Text>
                {selectedAsset.badge && (
                  <View style={[styles.badgePill, getBadgeStyle(selectedAsset.badge)]}>
                    <Text style={styles.badgeText}>{selectedAsset.badge}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setSelectedAsset(null)}>
                <MaterialCommunityIcons name="close" size={20} color="#8b949e" />
              </TouchableOpacity>
            </View>

            {/* Large Preview */}
            <View style={styles.detailPreviewContainer}>
              <View style={styles.checkerboard}>
                <Image
                  source={selectedAsset.source}
                  style={{
                    width: Math.min(SCREEN_WIDTH - 64, selectedAsset.width * getScale(selectedAsset)),
                    height: Math.min(400, selectedAsset.height * getScale(selectedAsset)),
                  }}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Metadata */}
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Dimensions</Text>
                <Text style={styles.metaValue}>{selectedAsset.width} x {selectedAsset.height}px</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Category</Text>
                <Text style={styles.metaValue}>{selectedAsset.category}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>ID</Text>
                <Text style={styles.metaValue}>{selectedAsset.id}</Text>
              </View>
            </View>
            {selectedAsset.description && (
              <Text style={styles.detailDesc}>{selectedAsset.description}</Text>
            )}
          </View>
        )}

        {/* Asset Grid */}
        <View style={styles.assetGrid}>
          {filteredAssets.map(asset => (
            <TouchableOpacity
              key={asset.id}
              style={[
                styles.assetCard,
                selectedAsset?.id === asset.id && styles.assetCardSelected,
              ]}
              onPress={() => setSelectedAsset(asset)}
              activeOpacity={0.7}
            >
              {asset.badge && (
                <View style={[styles.cardBadge, getBadgeStyle(asset.badge)]}>
                  <Text style={styles.cardBadgeText}>{asset.badge}</Text>
                </View>
              )}
              <View style={styles.assetThumbContainer}>
                <Image
                  source={asset.source}
                  style={styles.assetThumb}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.assetName} numberOfLines={2}>
                {asset.name}
              </Text>
              <Text style={styles.assetDims}>
                {asset.width}x{asset.height}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

function getScale(asset: AssetEntry): number {
  const maxW = SCREEN_WIDTH - 64;
  const maxH = 400;
  const scaleW = maxW / asset.width;
  const scaleH = maxH / asset.height;
  const scale = Math.min(scaleW, scaleH);
  if (asset.width <= 64 && asset.height <= 64) {
    return Math.max(scale, 4);
  }
  if (asset.width <= 128 && asset.height <= 128) {
    return Math.max(scale, 2);
  }
  return Math.max(scale, 1);
}

function getBadgeStyle(badge: string) {
  switch (badge) {
    case 'HQ2': return { backgroundColor: 'rgba(139,92,246,0.25)', borderColor: 'rgba(139,92,246,0.5)' };
    case 'FLOOR': return { backgroundColor: 'rgba(34,197,94,0.25)', borderColor: 'rgba(34,197,94,0.5)' };
    default: return { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' };
  }
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
  countBadge: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    minWidth: 32,
    alignItems: 'center',
  },
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  // Stats
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#e0e4ec',
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // Categories
  categoryBar: {
    maxHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  categoryContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  categoryChipActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  categoryLabel: {
    fontSize: 13,
    color: '#8b949e',
    fontWeight: '600',
  },
  categoryLabelActive: {
    color: '#fff',
  },
  scrollContent: {
    padding: 16,
  },
  // Detail Panel
  detailPanel: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
    padding: 16,
    marginBottom: 20,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    flexShrink: 1,
  },
  detailPreviewContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  checkerboard: {
    backgroundColor: '#1a1d27',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  metaItem: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 8,
  },
  metaLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    color: '#e0e4ec',
    fontWeight: '600',
  },
  detailDesc: {
    fontSize: 12,
    color: '#8b949e',
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Badges
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#e0e4ec',
    letterSpacing: 0.5,
  },
  cardBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  cardBadgeText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#e0e4ec',
    letterSpacing: 0.3,
  },
  // Asset Grid
  assetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  assetCard: {
    width: (SCREEN_WIDTH - 32 - 20) / 3,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 8,
    alignItems: 'center',
  },
  assetCardSelected: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  assetThumbContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#1a1d27',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  assetThumb: {
    width: '80%',
    height: '80%',
  },
  assetName: {
    fontSize: 10,
    color: '#e0e4ec',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  assetDims: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '500',
  },
});
