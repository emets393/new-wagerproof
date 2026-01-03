import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { useTheme, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Widget colors matching the native Swift implementation
const WIDGET_COLORS = {
  background: '#0a0a0a',
  surface: '#27272a',
  green: '#22c55e',
  gray: '#9ca3af',
  darkGray: '#374151',
  amber: '#fbbf24',
  red: '#ef4444',
  nflBlue: '#013369',
  nbaBlue: '#1d428a',
  cfbRed: '#8b0000',
  ncaabOrange: '#ff6600',
};

// Sample data matching widget format
const SAMPLE_EDITOR_PICKS = [
  { id: '1', gameType: 'NFL', matchup: 'Ravens @ Chiefs', pick: 'Ravens -3.5', price: '-110' },
  { id: '2', gameType: 'NBA', matchup: 'Lakers @ Celtics', pick: 'Over 224.5', price: '-105', result: 'WON' },
  { id: '3', gameType: 'CFB', matchup: 'Alabama @ Georgia', pick: 'Georgia -7', price: '-115' },
  { id: '4', gameType: 'NCAAB', matchup: 'Duke @ UNC', pick: 'Duke +2.5', price: '-108' },
  { id: '5', gameType: 'NFL', matchup: 'Bills @ Dolphins', pick: 'Under 48.5', price: '-112' },
];

const SAMPLE_FADE_ALERTS = [
  { id: '1', sport: 'NFL', matchup: '49ers @ Cowboys', fade: 'Fade to Cowboys', confidence: 85, type: 'Spread' },  // Shows as 85%
  { id: '2', sport: 'CFB', matchup: 'Ohio State @ Michigan', fade: 'Fade to Under', confidence: 12, type: 'Total' },  // Shows as 12pt
  { id: '3', sport: 'NBA', matchup: 'Warriors @ Suns', fade: 'Fade to Suns', confidence: 11, type: 'Spread' },  // Shows as 11pt
  { id: '4', sport: 'NCAAB', matchup: 'Kansas @ Kentucky', fade: 'Fade to Kansas', confidence: 7, type: 'Spread' },  // Shows as 7pt
  { id: '5', sport: 'NFL', matchup: 'Eagles @ Giants', fade: 'Fade to Over', confidence: 83, type: 'Total' },  // Shows as 83%
];

const SAMPLE_MARKET_VALUES = [
  { id: '1', sport: 'NFL', matchup: 'Packers @ Bears', side: 'Packers', percentage: 62, type: 'Spread' },
  { id: '2', sport: 'NBA', matchup: 'Nuggets @ Heat', side: 'Nuggets', percentage: 87, type: 'ML' },
  { id: '3', sport: 'CFB', matchup: 'Texas @ Oklahoma', side: 'Over', percentage: 59, type: 'Total' },
  { id: '4', sport: 'NCAAB', matchup: 'Gonzaga @ UCLA', side: 'Gonzaga', percentage: 64, type: 'Spread' },
  { id: '5', sport: 'NFL', matchup: 'Bengals @ Steelers', side: 'Under', percentage: 58, type: 'Total' },
];

// Sport badge component
const SportBadge = ({ sport }: { sport: string }) => {
  const getBadgeColor = () => {
    switch (sport.toUpperCase()) {
      case 'NFL': return WIDGET_COLORS.nflBlue;
      case 'NBA': return WIDGET_COLORS.nbaBlue;
      case 'CFB': return WIDGET_COLORS.cfbRed;
      case 'NCAAB': return WIDGET_COLORS.ncaabOrange;
      default: return WIDGET_COLORS.darkGray;
    }
  };

  return (
    <View style={[styles.sportBadge, { backgroundColor: getBadgeColor() }]}>
      <Text style={styles.sportBadgeText}>{sport}</Text>
    </View>
  );
};

// Result badge component
const ResultBadge = ({ result }: { result: string }) => {
  const getResultColor = () => {
    switch (result.toUpperCase()) {
      case 'WON': return WIDGET_COLORS.green;
      case 'LOST': return WIDGET_COLORS.red;
      case 'PUSH': return WIDGET_COLORS.amber;
      default: return WIDGET_COLORS.gray;
    }
  };

  return (
    <View style={[styles.resultBadge, { backgroundColor: getResultColor() }]}>
      <Text style={styles.resultBadgeText}>{result}</Text>
    </View>
  );
};

// Glass card wrapper
const GlassCard = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.glassCard}>
    {children}
  </View>
);

// Widget preview component
const WidgetPreview = ({
  title,
  icon,
  children,
  size = 'large'
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  size?: 'medium' | 'large';
}) => (
  <View style={[
    styles.widgetContainer,
    size === 'medium' && styles.widgetMedium
  ]}>
    {/* Widget Header */}
    <View style={styles.widgetHeader}>
      <View style={styles.widgetHeaderLeft}>
        <MaterialCommunityIcons name={icon as any} size={14} color={WIDGET_COLORS.green} />
        <Text style={styles.widgetTitle}>{title}</Text>
      </View>
      <Text style={styles.widgetBrand}>WagerProof</Text>
    </View>

    {/* Widget Content */}
    <View style={styles.widgetContent}>
      {children}
    </View>
  </View>
);

// Editor Pick Row
const EditorPickRow = ({ pick }: { pick: typeof SAMPLE_EDITOR_PICKS[0] }) => (
  <GlassCard>
    <View style={styles.rowContainer}>
      <SportBadge sport={pick.gameType} />
      <View style={styles.rowMiddle}>
        <View style={styles.rowTopLine}>
          <Text style={styles.matchupText}>{pick.matchup}</Text>
          {pick.result && <ResultBadge result={pick.result} />}
        </View>
        <Text style={styles.pickText}>{pick.pick}</Text>
      </View>
      <Text style={styles.priceText}>{pick.price}</Text>
    </View>
  </GlassCard>
);

// Fade Alert Row
const FadeAlertRow = ({ alert }: { alert: typeof SAMPLE_FADE_ALERTS[0] }) => {
  // NFL uses percentage, other sports use point deltas
  const confidenceDisplay = alert.sport.toUpperCase() === 'NFL'
    ? `${alert.confidence}%`
    : `${alert.confidence}pt`;

  return (
    <GlassCard>
      <View style={styles.rowContainer}>
        <SportBadge sport={alert.sport} />
        <View style={styles.rowMiddle}>
          <View style={styles.rowTopLine}>
            <Text style={styles.matchupText}>{alert.matchup}</Text>
            <View style={styles.confidenceContainer}>
              <MaterialCommunityIcons name="lightning-bolt" size={10} color={WIDGET_COLORS.amber} />
              <Text style={styles.confidenceText}>{confidenceDisplay}</Text>
            </View>
          </View>
          <Text style={styles.pickText}>{alert.fade}</Text>
        </View>
        <Text style={styles.typeText}>{alert.type}</Text>
      </View>
    </GlassCard>
  );
};

// Market Value Row
const MarketValueRow = ({ value }: { value: typeof SAMPLE_MARKET_VALUES[0] }) => (
  <GlassCard>
    <View style={styles.rowContainer}>
      <SportBadge sport={value.sport} />
      <View style={styles.rowMiddle}>
        <View style={styles.rowTopLine}>
          <Text style={styles.matchupText}>{value.matchup}</Text>
          <Text style={styles.marketTypeText}>{value.type}</Text>
        </View>
        <Text style={styles.pickText}>{value.side}</Text>
      </View>
      <View style={styles.percentageContainer}>
        <Text style={styles.percentageText}>{value.percentage}%</Text>
        <Text style={styles.publicLabel}>public</Text>
      </View>
    </View>
  </GlassCard>
);

export default function IOSWidgetScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedWidget, setSelectedWidget] = React.useState<'picks' | 'fades' | 'market'>('picks');

  // Only show on iOS
  if (Platform.OS !== 'ios') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onSurface, textAlign: 'center', marginTop: 100 }}>
          iOS Widgets are only available on iOS devices.
        </Text>
      </View>
    );
  }

  const renderWidgetContent = () => {
    switch (selectedWidget) {
      case 'picks':
        return SAMPLE_EDITOR_PICKS.map(pick => (
          <EditorPickRow key={pick.id} pick={pick} />
        ));
      case 'fades':
        return SAMPLE_FADE_ALERTS.map(alert => (
          <FadeAlertRow key={alert.id} alert={alert} />
        ));
      case 'market':
        return SAMPLE_MARKET_VALUES.map(value => (
          <MarketValueRow key={value.id} value={value} />
        ));
    }
  };

  const getWidgetTitle = () => {
    switch (selectedWidget) {
      case 'picks': return 'Editor Picks';
      case 'fades': return 'Fade Alerts';
      case 'market': return 'Market Value';
    }
  };

  const getWidgetIcon = () => {
    switch (selectedWidget) {
      case 'picks': return 'star';
      case 'fades': return 'lightning-bolt';
      case 'market': return 'chart-line';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={['rgba(34, 211, 95, 0.1)', 'transparent']}
        style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons name="close" size={28} color={theme.colors.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            iOS Widget
          </Text>
          <View style={{ width: 28 }} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro Section */}
        <View style={styles.introContainer}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
            <MaterialCommunityIcons name="widgets" size={48} color={WIDGET_COLORS.green} />
          </View>
          <Text style={[styles.mainTitle, { color: theme.colors.onSurface }]}>
            WagerProof Widget
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Add our widget to your Home Screen for instant access to picks, fade alerts, and market insights.
          </Text>
        </View>

        {/* Widget Type Selector */}
        <View style={styles.selectorContainer}>
          <TouchableOpacity
            style={[
              styles.selectorButton,
              selectedWidget === 'picks' && styles.selectorButtonActive
            ]}
            onPress={() => setSelectedWidget('picks')}
          >
            <MaterialCommunityIcons
              name="star"
              size={16}
              color={selectedWidget === 'picks' ? '#fff' : WIDGET_COLORS.gray}
            />
            <Text style={[
              styles.selectorText,
              selectedWidget === 'picks' && styles.selectorTextActive
            ]}>Picks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.selectorButton,
              selectedWidget === 'fades' && styles.selectorButtonActive
            ]}
            onPress={() => setSelectedWidget('fades')}
          >
            <MaterialCommunityIcons
              name="lightning-bolt"
              size={16}
              color={selectedWidget === 'fades' ? '#fff' : WIDGET_COLORS.gray}
            />
            <Text style={[
              styles.selectorText,
              selectedWidget === 'fades' && styles.selectorTextActive
            ]}>Fades</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.selectorButton,
              selectedWidget === 'market' && styles.selectorButtonActive
            ]}
            onPress={() => setSelectedWidget('market')}
          >
            <MaterialCommunityIcons
              name="chart-line"
              size={16}
              color={selectedWidget === 'market' ? '#fff' : WIDGET_COLORS.gray}
            />
            <Text style={[
              styles.selectorText,
              selectedWidget === 'market' && styles.selectorTextActive
            ]}>Market</Text>
          </TouchableOpacity>
        </View>

        {/* Widget Preview */}
        <View style={styles.previewContainer}>
          <Text style={[styles.previewLabel, { color: theme.colors.onSurfaceVariant }]}>
            WIDGET PREVIEW
          </Text>
          <WidgetPreview title={getWidgetTitle()} icon={getWidgetIcon()}>
            {renderWidgetContent()}
          </WidgetPreview>
        </View>

        {/* Instructions Card */}
        <Card style={[styles.instructionsCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={[styles.instructionsTitle, { color: theme.colors.onSurface }]}>
              How to Add the Widget
            </Text>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.colors.onSurfaceVariant }]}>
                Long press on your Home Screen until apps start jiggling
              </Text>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.colors.onSurfaceVariant }]}>
                Tap the <Text style={styles.bold}>+</Text> button in the top corner
              </Text>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.colors.onSurfaceVariant }]}>
                Search for <Text style={styles.bold}>"WagerProof"</Text>
              </Text>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.colors.onSurfaceVariant }]}>
                Choose Medium or Large size, then tap <Text style={styles.bold}>Add Widget</Text>
              </Text>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>5</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.colors.onSurfaceVariant }]}>
                Long press the widget and select <Text style={styles.bold}>Edit Widget</Text> to choose content type
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <MaterialCommunityIcons name="information" size={20} color={WIDGET_COLORS.green} />
          <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
            The widget updates automatically when you open the app. Data refreshes every 30-60 minutes.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  introContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  selectorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(39, 39, 42, 0.8)',
  },
  selectorButtonActive: {
    backgroundColor: WIDGET_COLORS.green,
  },
  selectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: WIDGET_COLORS.gray,
  },
  selectorTextActive: {
    color: '#fff',
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  widgetContainer: {
    width: width - 40,
    backgroundColor: WIDGET_COLORS.background,
    borderRadius: 24,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  widgetMedium: {
    maxHeight: 180,
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  widgetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  widgetTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
  widgetBrand: {
    fontSize: 10,
    fontWeight: '500',
    color: WIDGET_COLORS.gray,
  },
  widgetContent: {
    gap: 4,
  },
  glassCard: {
    backgroundColor: 'rgba(39, 39, 42, 0.6)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sportBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sportBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  resultBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  resultBadgeText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#fff',
  },
  rowMiddle: {
    flex: 1,
    gap: 1,
  },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchupText: {
    fontSize: 9,
    color: WIDGET_COLORS.gray,
  },
  pickText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  priceText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: WIDGET_COLORS.green,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '500',
    color: WIDGET_COLORS.gray,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  confidenceText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: WIDGET_COLORS.amber,
  },
  marketTypeText: {
    fontSize: 8,
    fontWeight: '500',
    color: WIDGET_COLORS.darkGray,
  },
  percentageContainer: {
    alignItems: 'flex-end',
  },
  percentageText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: WIDGET_COLORS.green,
  },
  publicLabel: {
    fontSize: 7,
    fontWeight: '500',
    color: WIDGET_COLORS.darkGray,
  },
  instructionsCard: {
    borderRadius: 16,
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: WIDGET_COLORS.green,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
