import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/api/supabaseClient';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const { width } = Dimensions.get('window');

interface AdminStats {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  weeklyProSubs: number;
  monthlyProSubs: number;
  yearlyProSubs: number;
  lifetimeProSubs: number;
  weeklyEliteSubs: number;
  monthlyEliteSubs: number;
  yearlyEliteSubs: number;
  monthlyRevenue: number;
  newUsers7d: number;
  userGrowthChange: number;
}

export default function AdminAnalyticsDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const { data: stats, error, isLoading, mutate } = useSWR<AdminStats>('/api/admin/stats', fetcher);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        Alert.alert('Access Denied', 'Please log in to access admin dashboard');
        router.push('/');
        return;
      }
      setUser(currentUser);

      const { data: profile } = await supabase
        .from('profiles')
        .select('admin_role')
        .eq('id', currentUser.id)
        .single();

      if (!profile?.admin_role) {
        Alert.alert('Access Denied', 'You do not have admin privileges');
        router.push('/');
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
      Alert.alert('Error', 'Failed to verify admin access');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await mutate();
    setRefreshing(false);
  };

  if (isLoading && !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f1419" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={styles.loadingText}>Loading admin dashboard...</Text>
          <Text style={styles.loadingSubtext}>Fetching analytics data</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !stats) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f1419" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>Failed to load analytics</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f1419" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#60a5fa"
            colors={['#60a5fa']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <LinearGradient
          colors={['#1e40af', '#3b82f6', '#60a5fa']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>← Back to Settings</Text>
          </TouchableOpacity>
          <Text style={styles.title}>📊 Admin Analytics</Text>
          <Text style={styles.subtitle}>Real-time ParleyApp Insights</Text>
        </LinearGradient>
      
        {/* Subscription Breakdown */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📱 Subscription Tiers</Text>
          </View>
          <View style={styles.subscriptionGrid}>
            <View style={[styles.metricCard, styles.subscriptionCard]}>
              <Text style={styles.subscriptionType}>Weekly Pro</Text>
              <Text style={styles.subscriptionCount}>{stats?.weeklyProSubs || 0}</Text>
            </View>
            <View style={[styles.metricCard, styles.subscriptionCard]}>
              <Text style={styles.subscriptionType}>Monthly Pro</Text>
              <Text style={styles.subscriptionCount}>{stats?.monthlyProSubs || 0}</Text>
            </View>
            <View style={[styles.metricCard, styles.subscriptionCard]}>
              <Text style={styles.subscriptionType}>Yearly Pro</Text>
              <Text style={styles.subscriptionCount}>{stats?.yearlyProSubs || 0}</Text>
            </View>
            <View style={[styles.metricCard, styles.subscriptionCard]}>
              <Text style={styles.subscriptionType}>Lifetime Pro</Text>
              <Text style={styles.subscriptionCount}>{stats?.lifetimeProSubs || 0}</Text>
            </View>
            <View style={[styles.metricCard, styles.subscriptionCard]}>
              <Text style={styles.subscriptionType}>Weekly Elite</Text>
              <Text style={styles.subscriptionCount}>{stats?.weeklyEliteSubs || 0}</Text>
            </View>
            <View style={[styles.metricCard, styles.subscriptionCard]}>
              <Text style={styles.subscriptionType}>Monthly Elite</Text>
              <Text style={styles.subscriptionCount}>{stats?.monthlyEliteSubs || 0}</Text>
            </View>
            <View style={[styles.metricCard, styles.subscriptionCard]}>
              <Text style={styles.subscriptionType}>Yearly Elite</Text>
              <Text style={styles.subscriptionCount}>{stats?.yearlyEliteSubs || 0}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f1419',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 32,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    loadingText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 16,
    },
    loadingSubtext: {
        color: '#9ca3af',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    errorIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 24,
    },
    retryButton: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    headerGradient: {
        paddingHorizontal: 20,
        paddingVertical: 32,
        marginBottom: 24,
        borderRadius: 16,
        marginHorizontal: 16,
        marginTop: 16,
        position: 'relative',
    },
    backButton: {
        position: 'absolute',
        top: 16,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        zIndex: 10,
    },
    backButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#e0f2fe',
        textAlign: 'center',
        marginBottom: 24,
        opacity: 0.9,
    },
    section: {
        marginBottom: 28,
        paddingHorizontal: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    subscriptionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    metricCard: {
        backgroundColor: '#1f2937',
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
        minWidth: '48%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    subscriptionCard: {
        backgroundColor: '#1f2937',
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#374151',
    },
    subscriptionType: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    subscriptionCount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#10b981',
        marginBottom: 4,
    },
});
