import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Activity,
  AlertTriangle,
  Clock,
  X,
  Users,
  TrendingUp,
  Calendar,
  ChevronRight,
  Shield,
  Heart,
  Target,
  BarChart3,
  Info
} from 'lucide-react-native';
import { injuryService, InjuryReport, InjuryStats, InjurySummary } from '@/app/services/api/injuryService';
import { useSubscription } from '@/app/services/subscriptionContext';

const { width: screenWidth } = Dimensions.get('window');

interface Props {
  isPro: boolean;
}

export default function InjuryReportsSection({ isPro }: Props) {
  const { openSubscriptionModal } = useSubscription();
  const [injuryStats, setInjuryStats] = useState<InjuryStats>({
    totalInjuries: 0,
    criticalInjuries: 0,
    expectedReturns: 0,
    affectedTeams: 0,
    lastUpdated: new Date().toISOString()
  });
  const [criticalInjuries, setCriticalInjuries] = useState<InjuryReport[]>([]);
  const [showFullReport, setShowFullReport] = useState(false);
  const [allInjuries, setAllInjuries] = useState<InjuryReport[]>([]);
  const [injurySummary, setInjurySummary] = useState<InjurySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isPro) {
      loadInjuryData();
    }
  }, [isPro]);

  const loadInjuryData = async () => {
    try {
      setLoading(true);
      const [stats, critical, all, summary] = await Promise.all([
        injuryService.getInjuryStats(),
        injuryService.getCriticalInjuries(),
        injuryService.getMLBInjuries(),
        injuryService.getInjurySummary()
      ]);

      setInjuryStats(stats);
      setCriticalInjuries(critical);
      setAllInjuries(all);
      setInjurySummary(summary);
    } catch (error) {
      console.error('Error loading injury data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInjuryData();
    setRefreshing(false);
  };

  const formatLastUpdated = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString();
  };

  if (!isPro) {
    return (
      <View style={styles.proUpgradeCard}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.upgradeCard}
        >
          <View style={styles.upgradeContent}>
            <View style={styles.upgradeIcon}>
              <Heart size={32} color="#00E5FF" />
            </View>
            <Text style={styles.upgradeTitle}>Full Daily Injury Reports</Text>
            <Text style={styles.upgradeSubtitle}>Pro Feature</Text>
            <Text style={styles.upgradeDescription}>
              Get comprehensive injury tracking, return timelines, impact analysis, 
              and real-time updates for all MLB players and teams.
            </Text>
            <TouchableOpacity style={styles.upgradeButton} onPress={openSubscriptionModal}>
              <LinearGradient
                colors={['#00E5FF', '#0891B2']}
                style={styles.upgradeButtonGradient}
              >
                <Activity size={16} color="#0F172A" />
                <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                <ChevronRight size={16} color="#0F172A" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <LinearGradient
          colors={['#1E293B', '#334155']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <View style={styles.iconContainer}>
                <Activity size={20} color="#10B981" />
              </View>
              <Text style={styles.title}>MLB Injury Reports</Text>
              <View style={styles.proBadge}>
                <Text style={styles.proText}>PRO</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>
              Live tracking • Updated {formatLastUpdated(injuryStats.lastUpdated)}
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#EF444420' }]}>
                <AlertTriangle size={16} color="#EF4444" />
              </View>
              <Text style={styles.statNumber}>{injuryStats.totalInjuries}</Text>
              <Text style={styles.statLabel}>Total Injuries</Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#DC262620' }]}>
                <Heart size={16} color="#DC2626" />
              </View>
              <Text style={styles.statNumber}>{injuryStats.criticalInjuries}</Text>
              <Text style={styles.statLabel}>Critical</Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#F59E0B20' }]}>
                <Clock size={16} color="#F59E0B" />
              </View>
              <Text style={styles.statNumber}>{injuryStats.expectedReturns}</Text>
              <Text style={styles.statLabel}>This Week</Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#10B98120' }]}>
                <Users size={16} color="#10B981" />
              </View>
              <Text style={styles.statNumber}>{injuryStats.affectedTeams}</Text>
              <Text style={styles.statLabel}>Teams</Text>
            </View>
          </View>

          {/* Critical Injuries Preview */}
          {criticalInjuries.length > 0 && (
            <View style={styles.criticalSection}>
              <Text style={styles.sectionTitle}>🚨 Critical Injuries</Text>
              {criticalInjuries.slice(0, 3).map((injury, index) => {
                const statusInfo = injuryService.getStatusDisplayInfo(injury.injury_status);
                return (
                  <View key={injury.id} style={styles.injuryItem}>
                    <View style={styles.injuryLeft}>
                      <Text style={styles.playerName}>{injury.player_name}</Text>
                      <Text style={styles.teamPosition}>
                        {injury.team_name || 'Team TBD'} • {injury.position || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.injuryRight}>
                      <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}20` }]}>
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>
                          {statusInfo.label}
                        </Text>
                      </View>
                      {injury.estimated_return_date && (
                        <Text style={styles.returnDate}>
                          {injuryService.formatReturnDate(injury.estimated_return_date)}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Full Report Button */}
          <TouchableOpacity 
            style={styles.fullReportButton}
            onPress={() => setShowFullReport(true)}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <BarChart3 size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Full Injury Report Today</Text>
              <ChevronRight size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Full Report Modal */}
      <Modal
        visible={showFullReport}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#0F172A', '#1E293B']}
            style={styles.modalGradient}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Activity size={24} color="#10B981" />
                <Text style={styles.modalTitle}>MLB Injury Report</Text>
              </View>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowFullReport(false)}
              >
                <X size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              {/* Summary Stats */}
              <View style={styles.modalStatsContainer}>
                <Text style={styles.modalSectionTitle}>Overview</Text>
                <View style={styles.modalStatsGrid}>
                  <View style={styles.modalStatCard}>
                    <AlertTriangle size={20} color="#EF4444" />
                    <Text style={styles.modalStatNumber}>{injuryStats.totalInjuries}</Text>
                    <Text style={styles.modalStatLabel}>Total Injuries</Text>
                  </View>
                  <View style={styles.modalStatCard}>
                    <Heart size={20} color="#DC2626" />
                    <Text style={styles.modalStatNumber}>{injuryStats.criticalInjuries}</Text>
                    <Text style={styles.modalStatLabel}>Critical Cases</Text>
                  </View>
                </View>
              </View>

              {/* Status Breakdown */}
              {injurySummary.length > 0 && (
                <View style={styles.summarySection}>
                  <Text style={styles.modalSectionTitle}>Status Breakdown</Text>
                  {injurySummary.map((item, index) => {
                    const statusInfo = injuryService.getStatusDisplayInfo(item.status);
                    return (
                      <View key={index} style={styles.summaryItem}>
                        <View style={styles.summaryLeft}>
                          <Text style={styles.summaryIcon}>{statusInfo.icon}</Text>
                          <Text style={styles.summaryStatus}>{statusInfo.label}</Text>
                        </View>
                        <View style={styles.summaryRight}>
                          <Text style={styles.summaryCount}>{item.count}</Text>
                          <Text style={styles.summaryPercentage}>{item.percentage}%</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* All Injuries List */}
              <View style={styles.allInjuriesSection}>
                <Text style={styles.modalSectionTitle}>All Active Injuries ({allInjuries.length})</Text>
                {allInjuries.map((injury) => {
                  const statusInfo = injuryService.getStatusDisplayInfo(injury.injury_status);
                  return (
                    <View key={injury.id} style={styles.modalInjuryItem}>
                      <View style={styles.modalInjuryHeader}>
                        <Text style={styles.modalPlayerName}>{injury.player_name}</Text>
                        <View style={[styles.modalStatusBadge, { backgroundColor: `${statusInfo.color}20` }]}>
                          <Text style={[styles.modalStatusText, { color: statusInfo.color }]}>
                            {statusInfo.label}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.modalInjuryDetails}>
                        <Text style={styles.modalTeamPosition}>
                          {injury.team_name || 'Team TBD'} • {injury.position || 'Position N/A'}
                        </Text>
                        {injury.estimated_return_date && (
                          <Text style={styles.modalReturnDate}>
                            Expected return: {injuryService.formatReturnDate(injury.estimated_return_date)}
                          </Text>
                        )}
                      </View>
                      {injury.description && (
                        <Text style={styles.modalDescription} numberOfLines={2}>
                          {injury.description}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Footer */}
              <View style={styles.modalFooter}>
                <Text style={styles.footerText}>
                  Data sourced from ESPN • Last updated {formatLastUpdated(injuryStats.lastUpdated)}
                </Text>
              </View>
            </ScrollView>
          </LinearGradient>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradient: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#10B98120',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  proBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  criticalSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  injuryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  injuryLeft: {
    flex: 1,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  teamPosition: {
    fontSize: 12,
    color: '#94A3B8',
  },
  injuryRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  returnDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
  fullReportButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginHorizontal: 8,
  },
  // Modal Styles
  // Pro Upgrade Card Styles (consistent with News section)
  proUpgradeCard: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  upgradeCard: {
    padding: 24,
  },
  upgradeContent: {
    alignItems: 'center',
  },
  upgradeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  upgradeSubtitle: {
    fontSize: 12,
    color: '#00E5FF',
    marginBottom: 16,
    fontWeight: '600',
  },
  upgradeDescription: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  upgradeButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginHorizontal: 8,
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalGradient: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
  },
  modalStatsContainer: {
    padding: 20,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  modalStatsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  modalStatCard: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalStatNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginVertical: 8,
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  summarySection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  summaryStatus: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  summaryPercentage: {
    fontSize: 12,
    color: '#94A3B8',
  },
  allInjuriesSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalInjuryItem: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  modalInjuryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalPlayerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  modalStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modalStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalInjuryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTeamPosition: {
    fontSize: 14,
    color: '#94A3B8',
  },
  modalReturnDate: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
  },
  modalDescription: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
}); 