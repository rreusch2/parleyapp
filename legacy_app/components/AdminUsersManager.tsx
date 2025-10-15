import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { adminApi, AdminUserSummary } from '../services/api/client';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../services/api/client';

interface Paging {
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
}

type TierFilter = 'all' | 'free' | 'pro' | 'elite';

const badgeColorForTier = (tier: string) => {
  switch (tier) {
    case 'pro':
      return styles.badgeBlue;
    case 'elite':
      return styles.badgePurple;
    default:
      return styles.badgeGray;
  }
};

const badgeColorForStatus = (status?: string | null) => {
  switch (status) {
    case 'active':
      return styles.badgeGreen;
    case 'cancelled':
      return styles.badgeRed;
    case 'expired':
      return styles.badgeOrange;
    default:
      return styles.badgeGray;
  }
};

export default function AdminUsersManager() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [paging, setPaging] = useState<Paging>({ page: 1, pageSize: 20, totalPages: 1, totalCount: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [dailyCount, setDailyCount] = useState<number>(0);

  const debouncedSearch = useDebounce(search, 350);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const resp = await adminApi.listUsers({
          page: paging.page,
          pageSize: paging.pageSize,
          search: debouncedSearch || undefined,
          tier: tierFilter === 'all' ? '' : tierFilter,
          sortBy: 'created_at_desc',
        });
        if (!isMounted) return;
        setUsers(resp.users || []);
        setPaging((p) => ({ ...p, totalPages: resp.totalPages, totalCount: resp.totalCount }));
      } catch (e: any) {
        console.error('Failed to load users', e);
        Alert.alert('Error', e?.response?.data?.error || 'Failed to load users');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [paging.page, paging.pageSize, debouncedSearch, tierFilter, refreshKey]);

  // Load daily account count
  useEffect(() => {
    const loadDailyCount = async () => {
      try {
        const response = await apiClient.get('/admin/stats');
        setDailyCount(response.data.newUsersToday || 0);
      } catch (error) {
        console.error('Failed to load daily count:', error);
      }
    };
    loadDailyCount();
  }, [refreshKey]);

  // Reset to first page when filters/search change
  useEffect(() => {
    setPaging((p) => (p.page === 1 ? p : { ...p, page: 1 }));
  }, [tierFilter, debouncedSearch]);

  const onSetTier = async (user: AdminUserSummary, tier: 'free' | 'pro' | 'elite') => {
    if (updatingId) return;
    setUpdatingId(user.id);
    try {
      await adminApi.updateUserTier(user.id, tier);
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      console.error('Failed to update tier', e);
      Alert.alert('Update Failed', e?.response?.data?.error || 'Failed to update user tier');
    } finally {
      setUpdatingId(null);
    }
  };

  const onClearPhone = async (user: AdminUserSummary) => {
    if (updatingId) return;
    setUpdatingId(user.id);
    try {
      await adminApi.clearPhone(user.id);
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      console.error('Failed to clear phone', e);
      Alert.alert('Action Failed', e?.response?.data?.error || 'Failed to clear phone number');
    } finally {
      setUpdatingId(null);
    }
  };

  const renderUser = ({ item }: { item: AdminUserSummary }) => {
    const disabled = !!updatingId;
    return (
      <View style={styles.userCard}>
        <View style={styles.userRowTop}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{(item.email || item.username || 'U').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{item.username || 'No username'}</Text>
            <Text style={styles.userEmail}>{item.email || 'No email'}</Text>
          </View>
          <View style={styles.badgesWrap}>
            <View style={[styles.badge, badgeColorForTier(item.subscription_tier)]}>
              <Text style={styles.badgeText}>{item.subscription_tier.toUpperCase()}</Text>
            </View>
            <View style={[styles.badge, badgeColorForStatus(item.subscription_status || undefined)]}>
              <Text style={styles.badgeText}>{(item.subscription_status || 'inactive').toUpperCase()}</Text>
            </View>
          </View>
        </View>
        <View style={styles.userRowBottom}>
          <InfoBlock label="Plan" value={item.subscription_plan_type || 'N/A'} />
          <InfoBlock label="Expires" value={formatDate(item.subscription_expires_at)} />
          <InfoBlock label="Joined" value={formatDate(item.created_at)} />
          <InfoBlock label="Phone" value={item.phone_number || '—'} />
        </View>
        <View style={styles.actionsRow}>
          <ActionButton
            title="Make Free"
            onPress={() => onSetTier(item, 'free')}
            disabled={disabled || item.subscription_tier === 'free'}
            colors={["#334155", "#475569"] as const}
          />
          <ActionButton
            title="Make Pro"
            onPress={() => onSetTier(item, 'pro')}
            disabled={disabled || item.subscription_tier === 'pro'}
            colors={["#2563eb", "#1d4ed8"] as const}
          />
          <ActionButton
            title="Make Elite"
            onPress={() => onSetTier(item, 'elite')}
            disabled={disabled || item.subscription_tier === 'elite'}
            colors={["#7c3aed", "#6d28d9"] as const}
          />
          <ActionButton
            title="Clear Numba"
            onPress={() => onClearPhone(item)}
            disabled={disabled}
            colors={["#dc2626", "#b91c1c"] as const}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0f172a", "#1e293b"]} style={[styles.header, { paddingTop: Math.max(12, insets.top + 6) }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} accessibilityLabel="Close admin users" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin • Users</Text>
        <Text style={styles.headerSubtitle}>Manage profiles, subscriptions and contact</Text>
        <View style={styles.dailyCounter}>
          <Text style={styles.dailyCounterText}>Today: {dailyCount} new accounts</Text>
        </View>
      </LinearGradient>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.searchWrap}>
          <TextInput
            placeholder="Search username or email…"
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>

        {/* Tier filter row */}
        <View style={styles.filterRow}>
          {(['all','free','pro','elite'] as TierFilter[]).map((tier) => (
            <Chip
              key={tier}
              label={tier === 'all' ? 'All' : tier.charAt(0).toUpperCase() + tier.slice(1)}
              active={tierFilter === tier}
              onPress={() => setTierFilter(tier)}
            />
          ))}
          {(tierFilter !== 'all' || (debouncedSearch && debouncedSearch.length > 0)) && (
            <Chip
              key="reset"
              label="Reset"
              active={false}
              onPress={() => {
                setSearch('');
                setTierFilter('all');
                setPaging((p) => ({ ...p, page: 1 }));
              }}
            />
          )}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#60a5fa" />
            <Text style={styles.loadingText}>Loading users…</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>Showing page {paging.page} of {Math.max(paging.totalPages, 1)} • {paging.totalCount} users</Text>
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.pageBtn, paging.page === 1 && styles.pageBtnDisabled]}
                  disabled={paging.page === 1}
                  onPress={() => setPaging((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                >
                  <Text style={styles.pageBtnText}>Prev</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pageBtn, paging.page >= paging.totalPages && styles.pageBtnDisabled, { marginLeft: 8 }]}
                  disabled={paging.page >= paging.totalPages}
                  onPress={() => setPaging((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={users}
              keyExtractor={(u) => u.id}
              renderItem={renderUser}
              contentContainerStyle={styles.listContent}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ActionButton({ title, onPress, colors, disabled }: { title: string; onPress: () => void; colors: readonly [string, string]; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.actionBtn, disabled && { opacity: 0.6 }]}> 
      <LinearGradient colors={colors} style={styles.actionBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={styles.actionBtnText}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
      <Text style={active ? styles.chipTextActive : styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return 'N/A';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 12,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#cbd5e1',
    marginTop: 4,
  },
  controls: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
  },
  searchWrap: {
    marginBottom: 6,
  },
  searchInput: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 10,
    color: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInactive: {
    backgroundColor: '#0b1220',
    borderColor: '#1f2937',
  },
  chipActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  chipText: {
    color: '#cbd5e1',
    fontWeight: '700',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 10,
  },
  content: {
    flex: 1,
    minHeight: 0,
    paddingTop: 6,
  },
  summaryRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryText: {
    color: '#93c5fd',
  },
  paginationRow: {
    flexDirection: 'row',
  },
  pageBtn: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 0,
  },
  pageBtnDisabled: {
    opacity: 0.5,
  },
  pageBtnText: {
    color: '#e5e7eb',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  list: {
    flex: 1,
  },
  dailyCounter: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  dailyCounterText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '600',
  },
  userCard: {
    backgroundColor: '#0b1220',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  userRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  userEmail: {
    color: '#94a3b8',
    marginTop: 2,
    fontSize: 12,
  },
  badgesWrap: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginLeft: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  badgeBlue: { backgroundColor: '#2563eb' },
  badgePurple: { backgroundColor: '#7c3aed' },
  badgeGreen: { backgroundColor: '#10b981' },
  badgeRed: { backgroundColor: '#ef4444' },
  badgeOrange: { backgroundColor: '#f59e0b' },
  badgeGray: { backgroundColor: '#6b7280' },
  userRowBottom: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoBlock: {
    marginRight: 16,
    marginBottom: 6,
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  infoValue: {
    color: '#e5e7eb',
    fontWeight: '600',
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 8,
    marginBottom: 8,
  },
  actionBtnGradient: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
});
