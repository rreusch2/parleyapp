import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, PlatformColor, Platform, Pressable, Animated } from 'react-native';
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { LinearGradient } from 'expo-linear-gradient';
import {
  TrendingUp,
  Activity,
  AlertCircle,
  Brain,
  Zap,
  Target,
  Crown,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';

interface InsightCardProps {
  title: string;
  content: string;
  category: string;
  confidence?: number;
  isPremium?: boolean;
  onPress?: () => void;
}

const getCategoryIcon = (category: string) => {
  const iconProps = { size: 20, strokeWidth: 2.5 };
  switch (category.toLowerCase()) {
    case 'trend':
    case 'trends':
      return <TrendingUp {...iconProps} />;
    case 'injury':
      return <AlertCircle {...iconProps} />;
    case 'pitcher':
    case 'matchup':
      return <Target {...iconProps} />;
    case 'research':
      return <Brain {...iconProps} />;
    case 'bullpen':
      return <Activity {...iconProps} />;
    default:
      return <Sparkles {...iconProps} />;
  }
};

const getCategoryColor = (category: string): string => {
  switch (category.toLowerCase()) {
    case 'trend':
    case 'trends':
      return '#10B981';
    case 'injury':
      return '#EF4444';
    case 'pitcher':
    case 'matchup':
      return '#8B5CF6';
    case 'research':
      return '#3B82F6';
    case 'bullpen':
      return '#F59E0B';
    default:
      return '#6366F1';
  }
};

/**
 * Elite Liquid Glass Insight Card
 */
export const LiquidGlassInsightCard: React.FC<InsightCardProps> = ({
  title,
  content,
  category,
  confidence,
  isPremium = false,
  onPress,
}) => {
  const [pressed, setPressed] = useState(false);
  const categoryColor = getCategoryColor(category);
  const categoryIcon = getCategoryIcon(category);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={styles.insightWrapper}
    >
      <View style={styles.insightContainer}>
        {/* Premium glow effect */}
        {isPremium && <View style={[styles.insightGlow, { backgroundColor: `${categoryColor}15` }]} />}

        {isLiquidGlassSupported ? (
          <LiquidGlassView
            style={[
              styles.insightCard,
              isPremium && styles.premiumInsight,
              pressed && styles.pressedCard,
            ]}
            interactive={true}
            effect={isPremium ? 'clear' : 'regular'}
            tintColor={isPremium ? `${categoryColor}10` : undefined}
            colorScheme="system"
          >
            <InsightContent
              title={title}
              content={content}
              category={category}
              categoryColor={categoryColor}
              categoryIcon={categoryIcon}
              confidence={confidence}
              isPremium={isPremium}
            />
          </LiquidGlassView>
        ) : (
          <LinearGradient
            colors={
              isPremium
                ? [`${categoryColor}20`, `${categoryColor}08`]
                : ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)']
            }
            style={[
              styles.insightCard,
              styles.fallbackInsight,
              isPremium && styles.premiumInsight,
              pressed && styles.pressedCard,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <InsightContent
              title={title}
              content={content}
              category={category}
              categoryColor={categoryColor}
              categoryIcon={categoryIcon}
              confidence={confidence}
              isPremium={isPremium}
            />
          </LinearGradient>
        )}
      </View>
    </Pressable>
  );
};

const InsightContent: React.FC<{
  title: string;
  content: string;
  category: string;
  categoryColor: string;
  categoryIcon: React.ReactNode;
  confidence?: number;
  isPremium: boolean;
}> = ({ title, content, category, categoryColor, categoryIcon, confidence, isPremium }) => (
  <>
    {/* Header with category badge */}
    <View style={styles.insightHeader}>
      <View style={[styles.categoryBadge, { backgroundColor: `${categoryColor}20` }]}>
        <View style={{ color: categoryColor }}>{categoryIcon}</View>
        <Text style={[styles.categoryText, { color: categoryColor }]}>
          {category.toUpperCase()}
        </Text>
      </View>

      {isPremium && (
        <View style={styles.eliteBadge}>
          <Crown size={12} color="#FFD700" strokeWidth={2.5} />
        </View>
      )}
    </View>

    {/* Title */}
    <Text
      style={[
        styles.insightTitle,
        { color: Platform.select({ ios: PlatformColor('labelColor'), default: '#FFFFFF' }) },
      ]}
      numberOfLines={2}
    >
      {title}
    </Text>

    {/* Content */}
    <Text
      style={[
        styles.insightContent,
        { color: Platform.select({ ios: PlatformColor('secondaryLabelColor'), default: '#9CA3AF' }) },
      ]}
      numberOfLines={3}
    >
      {content}
    </Text>

    {/* Footer with confidence */}
    {confidence && (
      <View style={styles.insightFooter}>
        <View style={styles.confidenceMini}>
          <Zap size={14} color={categoryColor} fill={categoryColor} />
          <Text style={[styles.confidenceMiniText, { color: categoryColor }]}>
            {confidence}% Confidence
          </Text>
        </View>
      </View>
    )}

    {/* Action indicator */}
    <View style={styles.insightAction}>
      <ChevronRight size={18} color="#6B7280" />
    </View>
  </>
);

/**
 * Elite Insights Grid with Liquid Glass Container
 */
export const LiquidGlassInsightsGrid: React.FC<{
  insights: any[];
  onInsightPress?: (insight: any) => void;
  isPremium?: boolean;
}> = ({ insights, onInsightPress, isPremium = false }) => {
  if (!insights || insights.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Brain size={48} color="#6B7280" strokeWidth={1.5} />
        <Text style={styles.emptyText}>No insights available</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.insightsScroll}
      contentContainerStyle={styles.insightsContent}
      showsVerticalScrollIndicator={false}
    >
      {isLiquidGlassSupported ? (
        <LiquidGlassContainerView spacing={12}>
          {insights.map((insight, index) => (
            <LiquidGlassInsightCard
              key={insight.id || index}
              title={insight.title}
              content={insight.content}
              category={insight.category}
              confidence={insight.confidence}
              isPremium={isPremium && index < 4}
              onPress={() => onInsightPress?.(insight)}
            />
          ))}
        </LiquidGlassContainerView>
      ) : (
        <View style={styles.insightsGrid}>
          {insights.map((insight, index) => (
            <LiquidGlassInsightCard
              key={insight.id || index}
              title={insight.title}
              content={insight.content}
              category={insight.category}
              confidence={insight.confidence}
              isPremium={isPremium && index < 4}
              onPress={() => onInsightPress?.(insight)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  insightWrapper: {
    marginBottom: 12,
  },
  insightContainer: {
    position: 'relative',
  },
  insightGlow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 24,
    zIndex: -1,
  },
  insightCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    minHeight: 140,
    overflow: 'hidden',
  },
  premiumInsight: {
    borderColor: 'rgba(255, 215, 0, 0.25)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  pressedCard: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  fallbackInsight: {
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  eliteBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 22,
    marginBottom: 8,
  },
  insightContent: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 12,
  },
  insightFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confidenceMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confidenceMiniText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  insightAction: {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: [{ translateY: -9 }],
  },
  insightsScroll: {
    flex: 1,
  },
  insightsContent: {
    padding: 20,
  },
  insightsGrid: {
    gap: 12,
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
