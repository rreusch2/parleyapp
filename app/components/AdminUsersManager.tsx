import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { adminApi, AdminUserSummary } from '../services/api/client';

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
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [planFilter, setPlanFilter] = useState<'' | 'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'admin_manual'>('');
  const [paging, setPaging] = useState<Paging>({ page: 1, pageSize: 20, totalPages: 1, totalCount: 0 });
  const [refreshKey, setRefreshKey] = useState(0);

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
          plan: planFilter || undefined,
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
  }, [paging.page, paging.pageSize, debouncedSearch, tierFilter, planFilter, refreshKey]);

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
            colors={["#334155", "#475569"]}
          />
          <ActionButton
            title="Make Pro"
            onPress={() => onSetTier(item, 'pro')}
            disabled={disabled || item.subscription_tier === 'pro'}
            colors={["#2563eb", "#1d4ed8"]}
          />
          <ActionButton
            title="Make Elite"
            onPress={() => onSetTier(item, 'elite')}
            disabled={disabled || item.subscription_tier === 'elite'}
            colors={["#7c3aed", "#6d28d9"]}
          />
          <ActionButton
            title="Clear Numba"
            onPress={() => onClearPhone(item)}
            disabled={disabled}
            colors={["#dc2626", "#b91c1c"]}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0f172a", "#1e293b"]} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={styles.headerTitle}>Admin • Users</Text>
        <Text style={styles.headerSubtitle}>Manage profiles, subscriptions and contact</Text>
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
        <View style={styles.filtersRow}>
          <Segmented
            options={[{ label: 'All', value: 'all' }, { label: 'Free', value: 'free' }, { label: 'Pro', value: 'pro' }, { label: 'Elite', value: 'elite' }]}
            value={tierFilter}
            onChange={(v) => setTierFilter(v as TierFilter)}
          />
          <Segmented
            options={[{ label: 'Any Plan', value: '' }, { label: 'Weekly', value: 'weekly' }, { label: 'Monthly', value: 'monthly' }, { label: 'Yearly', value: 'yearly' }, { label: 'Lifetime', value: 'lifetime' }, { label: 'Admin', value: 'admin_manual' }]}
            value={planFilter}
            onChange={(v) => setPlanFilter(v as any)}
          />
        </View>
      </View>

      {/* Content */}
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
                style={[styles.pageBtn, paging.page >= paging.totalPages && styles.pageBtnDisabled]}
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
          />
        </>
      )}
    </View>
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

function ActionButton({ title, onPress, colors, disabled }: { title: string; onPress: () => void; colors: string[]; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.actionBtn, disabled && { opacity: 0.6 }]}> 
      <LinearGradient colors={colors} style={styles.actionBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={styles.actionBtnText}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function Segmented({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity key={opt.value} onPress={() => onChange(opt.value)} style={[styles.segment, active ? styles.segmentActive : styles.segmentInactive]}>
            <Text style={active ? styles.segmentTextActive : styles.segmentText}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
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
    paddingVertical: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#cbd5e1',
    marginTop: 6,
  },
  controls: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchWrap: {
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 10,
    color: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#0b1220',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    flex: 1,
  },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flex: 1,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#1d4ed8',
  },
  segmentInactive: {
    backgroundColor: 'transparent',
  },
  segmentText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '700',
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
    gap: 8,
  },
  pageBtn: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
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
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
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
    gap: 8,
  },
  actionBtn: {
    borderRadius: 10,
    overflow: 'hidden',
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
