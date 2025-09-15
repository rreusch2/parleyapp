import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RecentLine {
  id: string;
  line: number;
  over_odds: number;
  under_odds: number;
  created_at: string;
  last_update: string;
  bookmaker_name?: string;
}

interface RecentLinesCardProps {
  lines: RecentLine[];
  propName: string;
  loading?: boolean;
}

export default function RecentLinesCard({ lines, propName, loading }: RecentLinesCardProps) {
  const formatOdds = (odds: number): string => {
    if (odds > 0) return `+${odds}`;
    return odds.toString();
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  const getLineMovement = (currentLine: number, previousLine?: number): 'up' | 'down' | 'same' | null => {
    if (!previousLine) return null;
    if (currentLine > previousLine) return 'up';
    if (currentLine < previousLine) return 'down';
    return 'same';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="analytics" size={16} color="#3B82F6" />
          <Text style={styles.headerText}>Recent Lines</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading recent lines...</Text>
        </View>
      </View>
    );
  }

  if (lines.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="analytics" size={16} color="#3B82F6" />
          <Text style={styles.headerText}>Recent Lines</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="information-circle" size={20} color="#6B7280" />
          <Text style={styles.emptyText}>No recent lines available for {propName}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="analytics" size={16} color="#3B82F6" />
        <Text style={styles.headerText}>Recent Lines - {propName}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{lines.length}</Text>
        </View>
      </View>
      
      <View style={styles.linesContainer}>
        {lines.slice(0, 5).map((line, index) => {
          const movement = index < lines.length - 1 ? getLineMovement(line.line, lines[index + 1]?.line) : null;
          
          return (
            <View key={line.id} style={[styles.lineRow, index === 0 && styles.currentLine]}>
              <View style={styles.lineInfo}>
                <View style={styles.lineHeader}>
                  <Text style={[styles.lineValue, index === 0 && styles.currentLineValue]}>
                    {line.line}
                  </Text>
                  {movement && (
                    <View style={[styles.movementIndicator, {
                      backgroundColor: movement === 'up' ? '#10B981' : movement === 'down' ? '#EF4444' : '#6B7280'
                    }]}>
                      <Ionicons 
                        name={movement === 'up' ? 'arrow-up' : movement === 'down' ? 'arrow-down' : 'remove'} 
                        size={10} 
                        color="#FFFFFF" 
                      />
                    </View>
                  )}
                  {index === 0 && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>CURRENT</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.timeAgo}>{formatTimeAgo(line.last_update)}</Text>
              </View>
              
              <View style={styles.oddsContainer}>
                <View style={styles.oddsColumn}>
                  <Text style={styles.oddsLabel}>Over</Text>
                  <Text style={[styles.oddsValue, {
                    color: line.over_odds < 0 ? '#10B981' : '#EF4444'
                  }]}>
                    {formatOdds(line.over_odds)}
                  </Text>
                </View>
                <View style={styles.oddsColumn}>
                  <Text style={styles.oddsLabel}>Under</Text>
                  <Text style={[styles.oddsValue, {
                    color: line.under_odds < 0 ? '#10B981' : '#EF4444'
                  }]}>
                    {formatOdds(line.under_odds)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {lines.length > 5 && (
        <View style={styles.moreIndicator}>
          <Text style={styles.moreText}>+{lines.length - 5} more lines available</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
    flex: 1,
  },
  badge: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    marginLeft: 8,
  },
  linesContainer: {
    gap: 8,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#374151',
  },
  currentLine: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  lineInfo: {
    flex: 1,
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  lineValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 8,
  },
  currentLineValue: {
    color: '#3B82F6',
  },
  movementIndicator: {
    borderRadius: 8,
    padding: 2,
    marginRight: 6,
  },
  currentBadge: {
    backgroundColor: '#059669',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  currentBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '600',
  },
  timeAgo: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  oddsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  oddsColumn: {
    alignItems: 'center',
  },
  oddsLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  oddsValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  moreIndicator: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    alignItems: 'center',
  },
  moreText: {
    color: '#6B7280',
    fontSize: 12,
    fontStyle: 'italic',
  },
});
