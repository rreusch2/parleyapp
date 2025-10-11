import React from 'react';
import { View, Text, StyleSheet, ScrollView, PlatformColor, Platform, Pressable } from 'react-native';
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, Target, Zap, Crown, Star, ChevronRight } from 'lucide-react-native';

interface PremiumPickCardProps {
  matchTeams: string;
  pick: string;
  odds: string;
  confidence: number;
  betType: string;
  reasoning?: string;
  isPremium?: boolean;
  onPress?: () => void;
}

/**
 * Elite Liquid Glass Pick Card
 * Stunning card design for AI predictions with liquid glass effect
 */
export const PremiumLiquidGlassPickCard: React.FC<PremiumPickCardProps> = ({
  matchTeams,
  pick,
  odds,
  confidence,
  betType,
  reasoning,
  isPremium = false,
  onPress,
}) => {
  const confidenceColor = confidence >= 70 ? '#10B981' : confidence >= 60 ? '#F59E0B' : '#6B7280';
  const isHighConfidence = confidence >= 70;

  return (
    <Pressable onPress={onPress} style={styles.cardWrapper}>
      <View style={styles.cardContainer}>
        {/* Premium badge glow */}
        {isPremium && <View style={styles.premiumGlow} />}
        
        {isLiquidGlassSupported ? (
          <LiquidGlassView
            style={[
              styles.glassCard,
              isPremium && styles.premiumCard,
            ]}
            interactive={true}
            effect="clear"
            tintColor={isPremium ? 'rgba(255, 215, 0, 0.08)' : undefined}
            colorScheme="system"
          >
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Crown size={12} color="#FFD700" strokeWidth={2.5} />
                <Text style={styles.premiumBadgeText}>ELITE</Text>
              </View>
            )}
            
            <CardContent
              matchTeams={matchTeams}
              pick={pick}
              odds={odds}
              confidence={confidence}
              betType={betType}
              reasoning={reasoning}
              confidenceColor={confidenceColor}
              isHighConfidence={isHighConfidence}
            />
          </LiquidGlassView>
        ) : (
          <LinearGradient
            colors={isPremium 
              ? ['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.05)']
              : ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
            style={[styles.glassCard, styles.fallbackCard, isPremium && styles.premiumCard]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Crown size={12} color="#FFD700" strokeWidth={2.5} />
                <Text style={styles.premiumBadgeText}>ELITE</Text>
              </View>
            )}
            
            <CardContent
              matchTeams={matchTeams}
              pick={pick}
              odds={odds}
              confidence={confidence}
              betType={betType}
              reasoning={reasoning}
              confidenceColor={confidenceColor}
              isHighConfidence={isHighConfidence}
            />
          </LinearGradient>
        )}
      </View>
    </Pressable>
  );
};

const CardContent: React.FC<{
  matchTeams: string;
  pick: string;
  odds: string;
  confidence: number;
  betType: string;
  reasoning?: string;
  confidenceColor: string;
  isHighConfidence: boolean;
}> = ({ matchTeams, pick, odds, confidence, betType, reasoning, confidenceColor, isHighConfidence }) => (
  <>
    {/* Header */}
    <View style={styles.header}>
      <View style={styles.matchInfo}>
        <Text
          style={[
            styles.matchTeams,
            { color: Platform.select({ ios: PlatformColor('labelColor'), default: '#FFFFFF' }) },
          ]}
          numberOfLines={2}
        >
          {matchTeams}
        </Text>
        <View style={styles.betTypeContainer}>
          <View style={[styles.betTypeBadge, { backgroundColor: confidenceColor + '20' }]}>
            <Text style={[styles.betTypeText, { color: confidenceColor }]}>
              {betType.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </View>

    {/* Pick Details */}
    <View style={styles.pickDetails}>
      <View style={styles.pickRow}>
        <Target size={20} color={confidenceColor} strokeWidth={2.5} />
        <Text
          style={[
            styles.pickText,
            { color: Platform.select({ ios: PlatformColor('labelColor'), default: '#FFFFFF' }) },
          ]}
        >
          {pick}
        </Text>
      </View>
      
      <View style={styles.oddsConfidenceRow}>
        <View style={styles.oddsContainer}>
          <Text
            style={[
              styles.oddsLabel,
              { color: Platform.select({ ios: PlatformColor('secondaryLabelColor'), default: '#9CA3AF' }) },
            ]}
          >
            Odds
          </Text>
          <Text
            style={[
              styles.oddsValue,
              { color: Platform.select({ ios: PlatformColor('labelColor'), default: '#FFFFFF' }) },
            ]}
          >
            {odds}
          </Text>
        </View>

        <View style={styles.confidenceContainer}>
          <View style={[styles.confidenceBar, { backgroundColor: confidenceColor + '20' }]}>
            <View
              style={[
                styles.confidenceFill,
                { width: `${confidence}%`, backgroundColor: confidenceColor },
              ]}
            />
          </View>
          <View style={styles.confidenceTextRow}>
            {isHighConfidence && <Zap size={14} color={confidenceColor} fill={confidenceColor} />}
            <Text style={[styles.confidenceText, { color: confidenceColor }]}>
              {confidence}% Confidence
            </Text>
          </View>
        </View>
      </View>
    </View>

    {/* Reasoning */}
    {reasoning && (
      <View style={styles.reasoningContainer}>
        <Text
          style={[
            styles.reasoningText,
            { color: Platform.select({ ios: PlatformColor('secondaryLabelColor'), default: '#9CA3AF' }) },
          ]}
          numberOfLines={2}
        >
          {reasoning}
        </Text>
      </View>
    )}

    {/* Action indicator */}
    <View style={styles.actionIndicator}>
      <ChevronRight
        size={20}
        color={Platform.select({ ios: PlatformColor('tertiaryLabelColor').toString(), default: '#6B7280' })}
      />
    </View>
  </>
);

/**
 * Elite Picks Container with merging glass effects
 */
export const PremiumLiquidGlassPicksContainer: React.FC<{
  picks: any[];
  onPickPress?: (pick: any) => void;
  isPremium?: boolean;
}> = ({ picks, onPickPress, isPremium = false }) => {
  if (!picks || picks.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Star size={48} color="#6B7280" strokeWidth={1.5} />
        <Text style={styles.emptyText}>No picks available</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {picks.map((pick, index) => (
        <PremiumLiquidGlassPickCard
          key={pick.id || index}
          matchTeams={pick.match_teams || pick.match}
          pick={pick.pick}
          odds={pick.odds}
          confidence={pick.confidence}
          betType={pick.bet_type}
          reasoning={pick.reasoning}
          isPremium={isPremium && index < 3} // First 3 picks get premium styling
          onPress={() => onPickPress?.(pick)}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 16,
  },
  cardContainer: {
    position: 'relative',
  },
  premiumGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 28,
    zIndex: -1,
  },
  glassCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  premiumCard: {
    borderColor: 'rgba(255, 215, 0, 0.3)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fallbackCard: {
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
  },
  premiumBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 0.5,
  },
  header: {
    marginBottom: 16,
  },
  matchInfo: {
    gap: 8,
  },
  matchTeams: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  betTypeContainer: {
    flexDirection: 'row',
  },
  betTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  betTypeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pickDetails: {
    gap: 16,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  oddsConfidenceRow: {
    flexDirection: 'row',
    gap: 16,
  },
  oddsContainer: {
    flex: 1,
    gap: 4,
  },
  oddsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  oddsValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  confidenceContainer: {
    flex: 1,
    gap: 6,
  },
  confidenceBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  reasoningContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  reasoningText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  actionIndicator: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});
