import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Share,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  TrendingUp,
  Sparkles,
  Share2,
  Copy,
  Trophy,
  Target,
  DollarSign,
  BarChart3
} from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { useUITheme } from '../services/uiThemeContext';
import * as Clipboard from 'expo-clipboard';
import { useSubscription } from '../services/subscriptionContext';

interface ParlayModalProps {
  visible: boolean;
  onClose: () => void;
  parlayData: any;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ParlayModal({ visible, onClose, parlayData }: ParlayModalProps) {
  const { theme } = useUITheme();
  const { isElite } = useSubscription();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible && parlayData) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
    }
  }, [visible, parlayData]);

  const handleShare = async () => {
    if (!parlayData?.shareText) return;
    
    try {
      await Share.share({
        message: parlayData.shareText,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCopy = async () => {
    if (!parlayData?.shareText) return;
    
    try {
      await Clipboard.setStringAsync(parlayData.shareText);
      // Could show a toast here
    } catch (error) {
      console.error('Error copying:', error);
    }
  };

  if (!parlayData) return null;

  // Markdown styles matching Professor Lock chat
  const markdownStyles = {
    body: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.cardTextPrimary,
      fontFamily: 'System',
    },
    heading1: {
      fontSize: 22,
      fontWeight: '700' as any,
      color: theme.accentPrimary,
      marginTop: 12,
      marginBottom: 10,
    },
    heading2: {
      fontSize: 18,
      fontWeight: '600' as any,
      color: theme.cardTextPrimary,
      marginTop: 12,
      marginBottom: 8,
    },
    heading3: {
      fontSize: 16,
      fontWeight: '600' as any,
      color: theme.cardTextPrimary,
      marginTop: 10,
      marginBottom: 6,
    },
    strong: {
      fontWeight: '700' as any,
      color: theme.accentPrimary,
      fontSize: 15,
    },
    em: {
      fontStyle: 'normal' as any,
      color: '#FBBF24',
      fontWeight: '600' as any,
    },
    list_item: {
      flexDirection: 'row' as any,
      marginVertical: 4,
    },
    bullet_list: {
      marginVertical: 8,
    },
    ordered_list: {
      marginVertical: 8,
    },
    paragraph: {
      marginVertical: 4,
      lineHeight: 22,
    },
    code_inline: {
      backgroundColor: `${theme.accentPrimary}1A`,
      color: theme.accentPrimary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 14,
      fontFamily: 'Menlo',
    },
    blockquote: {
      backgroundColor: `${theme.accentPrimary}0A`,
      borderLeftWidth: 4,
      borderLeftColor: theme.accentPrimary,
      paddingLeft: 12,
      paddingVertical: 8,
      marginVertical: 8,
    },
    hr: {
      backgroundColor: theme.borderColor,
      height: 1,
      marginVertical: 12,
    },
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.cardSurface,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <LinearGradient
            colors={isElite ? theme.ctaGradient as any : ['#8B5CF6', '#EC4899', '#F59E0B']}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Sparkles size={24} color="white" />
                <Text style={styles.headerTitle}>AI Parlay</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color="white" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Parlay Stats Bar */}
          {parlayData.stats && (
            <View style={[styles.statsBar, { backgroundColor: theme.surfaceSecondary }]}>
              <View style={styles.statItem}>
                <Target size={16} color={theme.accentPrimary} />
                <Text style={[styles.statLabel, { color: theme.surfaceSecondaryText }]}>Legs</Text>
                <Text style={[styles.statValue, { color: theme.cardTextPrimary }]}>
                  {parlayData.stats.legs}
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.borderColor }]} />
              <View style={styles.statItem}>
                <DollarSign size={16} color="#10B981" />
                <Text style={[styles.statLabel, { color: theme.surfaceSecondaryText }]}>Odds</Text>
                <Text style={[styles.statValue, { color: '#10B981' }]}>
                  {parlayData.stats.odds}
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.borderColor }]} />
              <View style={styles.statItem}>
                <BarChart3 size={16} color="#FBBF24" />
                <Text style={[styles.statLabel, { color: theme.surfaceSecondaryText }]}>Risk</Text>
                <Text style={[styles.statValue, { color: '#FBBF24' }]}>
                  {parlayData.stats.risk}
                </Text>
              </View>
            </View>
          )}

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
            nestedScrollEnabled={true}
          >
            {/* Player Headshots Section (if available) */}
            {parlayData.players && parlayData.players.length > 0 && (
              <View style={styles.playersSection}>
                <Text style={[styles.playersSectionTitle, { color: theme.cardTextPrimary }]}>
                  Featured Players
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.playersScroll}
                >
                  {parlayData.players.map((player: any, index: number) => (
                    <View key={index} style={[styles.playerCard, { backgroundColor: theme.surfaceSecondary }]}>
                      {player.headshotUrl ? (
                        <Image
                          source={{ uri: player.headshotUrl }}
                          style={styles.playerImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.playerImagePlaceholder, { backgroundColor: theme.accentPrimary + '1A' }]}>
                          <Trophy size={24} color={theme.accentPrimary} />
                        </View>
                      )}
                      <Text style={[styles.playerName, { color: theme.cardTextPrimary }]} numberOfLines={2}>
                        {player.name}
                      </Text>
                      <Text style={[styles.playerTeam, { color: theme.surfaceSecondaryText }]} numberOfLines={1}>
                        {player.team}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Markdown Content */}
            <View style={[styles.markdownContainer, { backgroundColor: theme.cardSurface }]}>
              <Markdown style={markdownStyles}>
                {parlayData.content || ''}
              </Markdown>
            </View>

            {/* Disclaimer */}
            <View style={[styles.disclaimer, { backgroundColor: `${theme.accentPrimary}0A`, borderColor: `${theme.accentPrimary}33` }]}>
              <Text style={[styles.disclaimerText, { color: theme.surfaceSecondaryText }]}>
                ⚠️ AI-generated analysis. Please do your own research and gamble responsibly.
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.actionButtons, { backgroundColor: theme.cardSurface, borderTopColor: theme.borderColor }]}>
            <TouchableOpacity onPress={handleCopy} style={styles.actionButton}>
              <View style={[styles.actionButtonInner, { backgroundColor: theme.surfaceSecondary }]}>
                <Copy size={20} color={theme.accentPrimary} />
                <Text style={[styles.actionButtonText, { color: theme.accentPrimary }]}>Copy</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
              <LinearGradient
                colors={isElite ? theme.ctaGradient as any : ['#8B5CF6', '#EC4899']}
                style={styles.actionButtonGradient}
              >
                <Share2 size={20} color="white" />
                <Text style={styles.actionButtonTextWhite}>Share</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  modalContainer: {
    width: screenWidth > 600 ? 600 : screenWidth * 0.94,
    maxHeight: screenHeight * 0.92,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    flexDirection: 'column',
  },
  header: {
    padding: 20,
    paddingTop: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    padding: 4,
  },
  statsBar: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  playersSection: {
    marginBottom: 20,
  },
  playersSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  playersScroll: {
    marginHorizontal: -4,
  },
  playerCard: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    width: 100,
  },
  playerImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  playerImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  playerTeam: {
    fontSize: 11,
    textAlign: 'center',
  },
  markdownContainer: {
    marginBottom: 12,
    maxWidth: '100%',
  },
  disclaimer: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
  },
  actionButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionButtonTextWhite: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
});
