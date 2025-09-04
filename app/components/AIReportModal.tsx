import React, { useState, useEffect } from 'react';
import {
  View,
  Modal,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert
} from 'react-native';
import { Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useSubscription } from '../services/subscriptionContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AIReportModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
}

export default function AIReportModal({ visible, onClose, onUpgrade }: AIReportModalProps) {
  const [report, setReport] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [generatedAt, setGeneratedAt] = useState<string>('');
  const { subscriptionTier, openSubscriptionModal } = useSubscription();

  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';

  const fetchReport = async (forceRefresh = false) => {
    try {
      setError(null);
      
      // No authentication required - reports are now public
      const endpoint = `${backendUrl}/api/ai/daily-report`;

      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI report');
      }

      const data = await response.json();
      
      if (data.success && data.report) {
        setReport(data.report);
        setMetadata(data.metadata);
        setGeneratedAt(data.generated_at);
      } else {
        throw new Error(data.error || 'Failed to generate report');
      }
    } catch (err) {
      console.error('Error fetching AI report:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchReport();
    }
  }, [visible]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReport(true);
  };

  const formatGeneratedTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  const markdownStyles: any = {
    body: {
      color: '#FFFFFF',
      fontSize: 15,
      lineHeight: 24,
    },
    heading1: {
      fontSize: 24,
      fontWeight: 'bold' as const,
      marginVertical: 15,
      color: '#FFFFFF',
    },
    heading2: {
      fontSize: 20,
      fontWeight: 'bold' as const,
      marginVertical: 12,
      color: '#FFFFFF',
    },
    heading3: {
      fontSize: 18,
      fontWeight: '600' as const,
      marginVertical: 10,
      color: '#FFFFFF',
    },
    paragraph: {
      marginVertical: 8,
      lineHeight: 24,
    },
    strong: {
      fontWeight: 'bold' as const,
      color: '#60A5FA',
    },
    em: {
      fontStyle: 'italic' as const,
      color: '#93C5FD',
    },
    blockquote: {
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderLeftWidth: 4,
      borderLeftColor: '#3B82F6',
      paddingLeft: 15,
      paddingVertical: 10,
      marginVertical: 10,
    },
    bullet_list: {
      marginLeft: 10,
      marginVertical: 8,
    },
    ordered_list: {
      marginLeft: 10,
      marginVertical: 8,
    },
    list_item: {
      marginVertical: 4,
      flexDirection: 'row' as const,
    },
    code_inline: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: 'monospace',
      fontSize: 14,
    },
    code_block: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      padding: 10,
      borderRadius: 5,
      marginVertical: 5,
    },
    table: {
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      marginVertical: 10,
    },
    thead: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    tbody: {},
    th: {
      padding: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      fontWeight: 'bold' as const,
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    td: {
      padding: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    link: {
      color: '#60A5FA',
      textDecorationLine: 'underline' as const,
    },
    hr: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      height: 1,
      marginVertical: 15,
    },
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <BlurView intensity={95} style={StyleSheet.absoluteFillObject} />
        
        <View style={styles.modalContent}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f3460']}
            style={styles.gradientBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="analytics" size={24} color="#4ADE80" />
              <Text style={styles.headerTitle}>AI Daily Report</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Generated Time */}
          {generatedAt && (
            <View style={styles.timestampContainer}>
              <Ionicons name="time-outline" size={14} color="#9CA3AF" />
              <Text style={styles.timestamp}>
                Generated {formatGeneratedTime(generatedAt)}
              </Text>
            </View>
          )}

          {/* Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#4ADE80"
                colors={['#4ADE80']}
              />
            }
          >
            {loading && !refreshing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4ADE80" />
                <Text style={styles.loadingText}>Generating AI Report...</Text>
                <Text style={styles.loadingSubtext}>Analyzing trends and data</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => fetchReport(true)}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.reportContainer}>
                {subscriptionTier === 'free' ? (
                  <>
                    {/* Free User - Partial Report with Upgrade Prompt */}
                    <View style={styles.freePreviewContainer}>
                      <Markdown style={markdownStyles}>
                        {report.split('\n').slice(0, 8).join('\n')}
                      </Markdown>
                    </View>
                    
                    {/* Gradient Overlay */}
                    <LinearGradient
                      colors={['rgba(26, 26, 46, 0)', 'rgba(26, 26, 46, 0.8)', 'rgba(26, 26, 46, 1)']}
                      style={styles.gradientOverlay}
                    />
                    
                    {/* Lock Section */}
                    <View style={styles.lockSection}>
                      <View style={styles.lockIcon}>
                        <Ionicons name="lock-closed" size={32} color="#F59E0B" />
                      </View>
                      
                      <Text style={styles.lockTitle}>
                        Unlock Full AI Reports
                      </Text>
                      
                      <Text style={styles.lockSubtitle}>
                        Get complete daily analysis, advanced insights, and betting trends with Pro or Elite membership
                      </Text>
                      
                      {/* Feature List */}
                      <View style={styles.featureList}>
                        <View style={styles.featureRow}>
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                          <Text style={styles.featureText}>Complete market analysis</Text>
                        </View>
                        <View style={styles.featureRow}>
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                          <Text style={styles.featureText}>AI betting recommendations</Text>
                        </View>
                        <View style={styles.featureRow}>
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                          <Text style={styles.featureText}>Advanced trend insights</Text>
                        </View>
                        <View style={styles.featureRow}>
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                          <Text style={styles.featureText}>Daily value picks</Text>
                        </View>
                      </View>
                      
                      {/* Upgrade Button */}
                      <TouchableOpacity 
                        style={styles.upgradeButton}
                        onPress={() => {
                          if (onUpgrade) {
                            onUpgrade();
                          } else {
                            openSubscriptionModal();
                          }
                        }}
                      >
                        <LinearGradient
                          colors={['#F59E0B', '#D97706']}
                          style={styles.upgradeGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Ionicons name="star" size={20} color="#FFFFFF" />
                          <Text style={styles.upgradeText}>Upgrade Now</Text>
                          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                        </LinearGradient>
                      </TouchableOpacity>
                      
                      <Text style={styles.disclaimerText}>
                        Starting at $4.99/month • Cancel anytime
                      </Text>
                    </View>
                  </>
                ) : (
                  /* Pro/Elite Users - Full Report */
                  <Markdown style={markdownStyles}>
                    {report}
                  </Markdown>
                )}
              </View>
            )}

            {/* Metadata Footer */}
            {metadata && !loading && !error && (
              <View style={styles.metadataContainer}>
                <Text style={styles.metadataTitle}>Report Statistics</Text>
                <View style={styles.metadataGrid}>
                  {metadata.active_sports && (
                    <View style={styles.metadataItem}>
                      <Text style={styles.metadataLabel}>Sports Analyzed</Text>
                      <Text style={styles.metadataValue}>
                        {metadata.active_sports.join(', ')}
                      </Text>
                    </View>
                  )}
                  {metadata.data_points_analyzed && (
                    <>
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Player Props</Text>
                        <Text style={styles.metadataValue}>
                          {metadata.data_points_analyzed.player_props || 0}
                        </Text>
                      </View>
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Team Trends</Text>
                        <Text style={styles.metadataValue}>
                          {metadata.data_points_analyzed.team_trends || 0}
                        </Text>
                      </View>
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>Predictions</Text>
                        <Text style={styles.metadataValue}>
                          {metadata.data_points_analyzed.predictions || 0}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalContent: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 50 : 30,
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 5,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 5,
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  freePreviewContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 300,
    zIndex: 1,
  },
  lockSection: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    alignItems: 'center',
    zIndex: 2,
  },
  lockIcon: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  lockTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  lockSubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  featureList: {
    width: '100%',
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  upgradeButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  upgradeGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  upgradeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  disclaimerText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingSubtext: {
    marginTop: 5,
    fontSize: 14,
    color: '#9CA3AF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  errorText: {
    marginTop: 15,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: '#4ADE80',
    borderRadius: 8,
  },
  retryText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  reportContainer: {
    paddingVertical: 20,
  },
  metadataContainer: {
    marginTop: 30,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
  },
  metadataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ADE80',
    marginBottom: 15,
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  metadataItem: {
    flex: 1,
    minWidth: '45%',
  },
  metadataLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 3,
  },
  metadataValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
