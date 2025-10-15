import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  TrendingUp,
  Target,
  Zap,
  ChevronRight,
  ChevronDown,
  Star,
  Trophy,
  Shield,
} from 'lucide-react-native';
import { AIPrediction } from '../services/api/aiService';
import { useUITheme } from '../services/uiThemeContext';
import OptimizedImage from './OptimizedImage';
import { getLeagueInfo } from '../utils/leagueLogos';
import { formatGameMatchup, formatGameDateTime } from '../utils/teamAbbreviations';

const { width: screenWidth } = Dimensions.get('window');

interface Props {
  prediction: AIPrediction;
  index: number;
  onPress?: () => void;
}

// League logo mapping with emoji fallbacks
const LEAGUE_LOGOS: Record<string, string> = {
  'MLB': '⚾',
  'NBA': '🏀',
  'NFL': '🏈',
  'NHL': '🏒',
  'WNBA': '🏀',
  'CFB': '🏈',
  'MLS': '⚽',
};

// Sportsbook display names
const SPORTSBOOK_NAMES: Record<string, string> = {
  'draftkings': 'DraftKings',
  'fanduel': 'FanDuel',
  'betmgm': 'BetMGM',
  'caesars': 'Caesars',
  'fanatics': 'Fanatics',
};

export default function PropPredictionCard({ prediction, index, onPress }: Props) {
  const { theme } = useUITheme();
  const [showFullReasoning, setShowFullReasoning] = useState(false);

  // Extract rich metadata from the new AI generation
  const meta: any = (prediction as any).metadata || {};
  const playerName: string = meta.player_name || extractPlayerNameFromPick(prediction.pick);
  const headshotUrl: string | undefined = meta.player_headshot_url;
  const bookmakerKey: string = meta.bookmaker || 'draftkings';
  const bookmakerLogoUrl: string | undefined = meta.bookmaker_logo_url;
  const isAlt: boolean = !!meta.is_alt;
  const propType: string = meta.prop_type || prediction.prop_market_type || 'Player Prop';
  const line: number = meta.line || prediction.line_value || 0;
  const recommendation: string = (meta.recommendation || 'OVER').toUpperCase();
  
  // Game info from metadata with fallbacks
  const gameInfo = meta.game_info || {};
  const awayTeam: string = gameInfo.away_team || '';
  const homeTeam: string = gameInfo.home_team || '';
  const awayTeamAbbr: string = gameInfo.away_team_abbr || '';
  const homeTeamAbbr: string = gameInfo.home_team_abbr || '';
  // Try multiple sources for game time
  const gameTime: string = gameInfo.start_time || prediction.eventTime || '';
  const sport = (prediction.sport || 'MLB').toUpperCase();
  
  // Better fallback for matchup from match_teams field
  const fallbackMatchup = prediction.match || '';

  // Generate initials for fallback avatar
  const initials = generateInitials(playerName);

  // League info
  const leagueInfo = getLeagueInfo(sport);
  const leagueIcon = leagueInfo.emoji;
  const leagueLogoUrl = meta.league_logo_url || leagueInfo.logoUrl;
  
  // Game matchup and time with better fallbacks
  // Use abbreviations from DB if available and different from full names,
  // otherwise fall back to utility function
  let gameMatchup: string;
  if (awayTeamAbbr && homeTeamAbbr && awayTeamAbbr !== awayTeam && homeTeamAbbr !== homeTeam) {
    // DB has good abbreviations, use them
    gameMatchup = `${awayTeamAbbr} @ ${homeTeamAbbr}`;
  } else if (awayTeam && homeTeam) {
    // Fall back to utility function
    gameMatchup = formatGameMatchup(awayTeam, homeTeam, sport);
  } else {
    // Last resort fallback
    gameMatchup = fallbackMatchup || 'TBD';
  }
  const gameDateTime = gameTime ? formatGameDateTime(gameTime) : 'Time TBD';

  // Metrics
  const confidence = prediction.confidence || 0;
  const edge = meta.value_percentage || prediction.value_percentage || 0;
  const roi = meta.roi_estimate || prediction.roi_estimate || 0;
  const riskLevel = prediction.risk_level || getRiskLevelFromConfidence(confidence);

  // Format odds
  const odds = formatOdds(prediction.odds);

  // Colors based on confidence and theme
  const confidenceColor = getConfidenceColor(confidence);
  const riskColor = getRiskColor(riskLevel);

  // Reasoning text with smart truncation
  const reasoning = prediction.reasoning || 'AI analysis in progress...';
  const shouldTruncate = reasoning.length > 120;
  const displayReasoning = showFullReasoning || !shouldTruncate
    ? reasoning
    : reasoning.substring(0, 120) + '...';

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.container,
        { 
          borderColor: theme.borderColor,
          backgroundColor: theme.cardSurface,
        }
      ]}
    >
      {/* Gradient Border Effect for Elite */}
      <LinearGradient
        colors={theme.ctaGradient as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <View style={[styles.innerCard, { backgroundColor: theme.cardSurface }]}>
          
          {/* Header: Player + League Info */}
          <View style={styles.header}>
            {/* Player Avatar */}
            <View style={styles.avatarSection}>
              {headshotUrl ? (
                <OptimizedImage
                  source={{ uri: headshotUrl }}
                  style={styles.headshot}
                  fallback={
                    <View style={[styles.initialsAvatar, { borderColor: theme.accentPrimary }]}>
                      <Text style={[styles.initialsText, { color: theme.accentPrimary }]}>
                        {initials}
                      </Text>
                    </View>
                  }
                />
              ) : (
                <View style={[styles.initialsAvatar, { borderColor: theme.accentPrimary }]}>
                  <Text style={[styles.initialsText, { color: theme.accentPrimary }]}>
                    {initials}
                  </Text>
                </View>
              )}
            </View>

             {/* Player Name + Game Info */}
             <View style={styles.playerInfo}>
               <Text style={[styles.playerName, { color: theme.cardTextPrimary }]} numberOfLines={1}>
                 {playerName}
               </Text>
               <View style={styles.gameInfoRow}>
                 {leagueLogoUrl ? (
                   <Image
                     source={{ uri: leagueLogoUrl }}
                     style={styles.leagueLogo}
                     resizeMode="contain"
                   />
                 ) : (
                   <Text style={styles.leagueIcon}>{leagueIcon}</Text>
                 )}
                 <Text style={[styles.gameMatchupText, { color: theme.surfaceSecondaryText }]} numberOfLines={1}>
                   {gameMatchup}
                 </Text>
                 <Text style={[styles.gameDivider, { color: theme.surfaceSecondaryText }]}>•</Text>
                 <Text style={[styles.gameTimeText, { color: theme.surfaceSecondaryText }]} numberOfLines={1}>
                   {gameDateTime}
                 </Text>
               </View>
             </View>

            {/* Risk Badge */}
            <View style={styles.badges}>
              <LinearGradient
                colors={[riskColor + '30', riskColor + '15']}
                style={styles.riskBadge}
              >
                <Text style={[styles.riskText, { color: riskColor }]}>
                  {riskLevel}
                </Text>
              </LinearGradient>
            </View>
          </View>

          {/* Pick Display - Most Prominent */}
          <View style={styles.pickSection}>
            <LinearGradient
              colors={[theme.accentPrimary + '20', theme.accentPrimary + '05']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.pickBanner}
            >
              <View style={styles.pickContent}>
                <View style={styles.pickLeft}>
                  {recommendation === 'OVER' ? (
                    <TrendingUp size={20} color={theme.accentPrimary} strokeWidth={2.5} />
                  ) : (
                    <View style={{ transform: [{ rotate: '180deg' }] }}>
                      <TrendingUp size={20} color={theme.accentSecondary} strokeWidth={2.5} />
                    </View>
                  )}
                  <View style={styles.pickTextContainer}>
                    <Text style={[styles.pickText, { color: theme.cardTextPrimary }]}>
                      {recommendation} {line}
                    </Text>
                    <Text style={[styles.pickPropType, { color: theme.cardTextPrimary }]}>
                      {formatPropTypeForDisplay(propType, sport)}
                    </Text>
                  </View>
                  {isAlt && (
                    <View style={[styles.altBadge, { backgroundColor: '#FFD700' }]}>
                      <Text style={styles.altText}>ALT</Text>
                    </View>
                  )}
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Odds + Bookmaker */}
          <View style={styles.oddsSection}>
            <View style={styles.oddsLeft}>
              {bookmakerLogoUrl ? (
                <Image
                  source={{ uri: bookmakerLogoUrl }}
                  style={styles.bookmakerLogo}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.bookmakerPlaceholder, { backgroundColor: theme.accentPrimary + '20' }]}>
                  <Text style={[styles.bookmakerInitial, { color: theme.accentPrimary }]}>
                    {(SPORTSBOOK_NAMES[bookmakerKey] || bookmakerKey)[0]}
                  </Text>
                </View>
              )}
              <Text style={[styles.bookmakerName, { color: theme.surfaceSecondaryText }]}>
                {SPORTSBOOK_NAMES[bookmakerKey] || bookmakerKey}
              </Text>
            </View>
            
            <View style={[styles.oddsChip, { backgroundColor: theme.accentPrimary + '15' }]}>
              <Text style={[styles.oddsText, { color: theme.accentPrimary }]}>
                {odds}
              </Text>
            </View>
          </View>

          {/* Metrics Row - Confidence, Edge, ROI */}
          <View style={styles.metricsSection}>
            <View style={styles.metric}>
              <Shield size={14} color={confidenceColor} />
              <Text style={[styles.metricLabel, { color: theme.surfaceSecondaryText }]}>
                Confidence
              </Text>
              <Text style={[styles.metricValue, { color: confidenceColor }]}>
                {confidence}%
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: theme.borderColor }]} />

            <View style={styles.metric}>
              <Target size={14} color={theme.accentSecondary} />
              <Text style={[styles.metricLabel, { color: theme.surfaceSecondaryText }]}>
                Edge
              </Text>
              <Text style={[styles.metricValue, { color: theme.accentSecondary }]}>
                {typeof edge === 'number' ? edge.toFixed(1) : edge}%
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: theme.borderColor }]} />

            <View style={styles.metric}>
              <Zap size={14} color="#FFD700" />
              <Text style={[styles.metricLabel, { color: theme.surfaceSecondaryText }]}>
                ROI
              </Text>
              <Text style={[styles.metricValue, { color: '#FFD700' }]}>
                {typeof roi === 'number' ? roi.toFixed(1) : roi}%
              </Text>
            </View>
          </View>

          {/* AI Reasoning */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowFullReasoning(!showFullReasoning)}
            style={styles.reasoningSection}
          >
            <View style={styles.reasoningHeader}>
              <Text style={[styles.reasoningTitle, { color: theme.cardTextPrimary }]}>
                AI Analysis
              </Text>
              {shouldTruncate && (
                showFullReasoning ? (
                  <ChevronDown size={16} color={theme.accentPrimary} />
                ) : (
                  <ChevronRight size={16} color={theme.accentPrimary} />
                )
              )}
            </View>
            <Text style={[styles.reasoningText, { color: theme.surfaceSecondaryText }]}>
              {displayReasoning}
            </Text>
          </TouchableOpacity>

        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Helper Functions
function extractPlayerNameFromPick(pick: string): string {
  if (!pick) return 'Player';
  // Extract player name from pick like "Victor Robles OVER 0.5 Batter Hits O/U"
  const parts = pick.split(' ');
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0] || 'Player';
}

function formatPropTypeForDisplay(propType: string, sport: string): string {
  // Remove "O/U" suffix if present
  let formatted = propType.replace(/\s+O\/U$/, '').trim();
  
  // For MLB, remove "Batter" prefix but keep "Pitcher"
  if (sport === 'MLB' || sport === 'BASEBALL') {
    if (formatted.startsWith('Batter ')) {
      formatted = formatted.replace('Batter ', '');
    }
    // Keep "Pitcher" prefix for pitcher props
  }
  
  return formatted;
}

function generateInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name[0]?.toUpperCase() || '?';
}

function formatOdds(odds?: string): string {
  if (!odds) return 'N/A';
  const numOdds = typeof odds === 'string' ? parseFloat(odds) : odds;
  if (isNaN(numOdds)) return odds;
  return numOdds > 0 ? `+${numOdds}` : `${numOdds}`;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return '#10B981'; // Green
  if (confidence >= 70) return '#00E5FF'; // Cyan
  if (confidence >= 60) return '#FFD700'; // Gold
  return '#8B5CF6'; // Purple
}

function getRiskColor(riskLevel: string): string {
  const level = (riskLevel || '').toLowerCase();
  if (level === 'low') return '#10B981'; // Green
  if (level === 'medium') return '#FFD700'; // Gold
  return '#F87171'; // Red
}

function getRiskLevelFromConfidence(confidence: number): string {
  if (confidence >= 75) return 'Low';
  if (confidence >= 60) return 'Medium';
  return 'High';
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: screenWidth < 375 ? 8 : 12, // Wider cards - less margin
    marginVertical: 10, // Slightly more vertical spacing
    borderRadius: 18, // Smoother corners
    overflow: 'hidden',
    // Add subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  gradientBorder: {
    padding: 2.5, // Slightly thicker border
    borderRadius: 18,
  },
  innerCard: {
    borderRadius: 15.5,
    padding: 18, // More breathing room inside
    paddingHorizontal: 20, // Extra horizontal padding
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarSection: {
    marginRight: 12,
  },
  headshot: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  initialsAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  initialsText: {
    fontSize: 20,
    fontWeight: '700',
  },
  playerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  playerName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  gameInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  leagueIcon: {
    fontSize: 14,
  },
  leagueLogo: {
    width: 16,
    height: 16,
  },
  gameMatchupText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  gameDivider: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.5,
  },
  gameTimeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  badges: {
    alignItems: 'flex-end',
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickSection: {
    marginBottom: 12,
  },
  pickBanner: {
    borderRadius: 12,
    padding: 14,
  },
  pickContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickTextContainer: {
    flexDirection: 'column',
    gap: 2,
  },
  pickText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pickPropType: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.85,
    letterSpacing: 0.3,
  },
  altBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  altText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  oddsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  oddsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bookmakerLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  bookmakerPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookmakerInitial: {
    fontSize: 14,
    fontWeight: '700',
  },
  bookmakerName: {
    fontSize: 13,
    fontWeight: '600',
  },
  oddsChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  oddsText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  metricsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16, // More breathing room
    paddingHorizontal: 12, // Better spacing
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', // Slightly more visible
    marginBottom: 14,
  },
  metric: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  metricDivider: {
    width: 1,
    height: 32,
    opacity: 0.3,
  },
  reasoningSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  reasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reasoningTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasoningText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
});

