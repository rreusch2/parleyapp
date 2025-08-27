import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  Linking,
  Vibration,
  Modal,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Share
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import UserPreferencesModal from '../components/UserPreferencesModal';
import { 
  Bell,
  Shield,
  HelpCircle,
  ChevronRight,
  User,
  Target,
  LogOut,
  ChevronDown,
  Crown,
  Sparkles,
  Lock,
  Brain,
  Eye,
  EyeOff,
  Trash2,
  Share2,
  Gift,
  Copy,
  Star
} from 'lucide-react-native';
import { supabase } from '../services/api/supabaseClient';
import { useSubscription } from '../services/subscriptionContext';
import { useReview } from '../hooks/useReview';
import facebookAnalyticsService from '../services/facebookAnalyticsService';
import PointsService from '../services/pointsService';
import PointsRedemptionModal from '../components/PointsRedemptionModal';
import { aiService } from '../services/api/aiService';
import { userApi } from '../services/api/client';
import { router } from 'expo-router';
import HelpCenterModal from '../components/HelpCenterModal';
import FeedbackModal from '../components/FeedbackModal';
import AboutModal from '../components/AboutModal';
import TermsOfServiceModal from '../components/TermsOfServiceModal';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import AdminAnalyticsDashboard from '../components/AdminAnalyticsDashboard';
import * as Clipboard from 'expo-clipboard';

interface UserProfile {
  id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  subscription_tier: 'free' | 'pro' | 'elite';
  created_at: string;
  sport_preferences?: Record<string, boolean>;
  betting_style?: 'conservative' | 'balanced' | 'aggressive';
  pick_distribution?: Record<string, number>;
  max_daily_picks?: number;
  confidence_range?: [number, number];
  preferred_sports?: string[];
  risk_tolerance?: string;
  phone_number?: string;
  has_used_trial?: boolean;
  referral_code?: string;
  referred_by?: string;
  discount_eligible?: boolean;
}

export default function SettingsScreen() {
  const { isPro, isElite, restorePurchases, openSubscriptionModal } = useSubscription();
  const { showManualReview } = useReview();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile section state
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  
  // Modal states
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [showSetUsernameModal, setShowSetUsernameModal] = useState(false);
  const [showHelpCenterModal, setShowHelpCenterModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showUserPreferencesModal, setShowUserPreferencesModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Auth state - check if user has Apple auth and/or password
  const [hasAppleAuth, setHasAppleAuth] = useState(false);
  const [hasPasswordAuth, setHasPasswordAuth] = useState(false);
  const [hasUsername, setHasUsername] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Set username state
  const [newUsername, setNewUsername] = useState('');
  const [setUsernameLoading, setSetUsernameLoading] = useState(false);

  // Referral state
  const [userReferralCode, setUserReferralCode] = useState('');
  const [referralStats, setReferralStats] = useState({ totalReferrals: 0, pendingRewards: 0 });
  const [pointsBalance, setPointsBalance] = useState(0);
  const [showPointsModal, setShowPointsModal] = useState(false);

  // Profile and preference states
  const [riskTolerance, setRiskTolerance] = useState('medium');
  const [bankroll, setBankroll] = useState('');
  const [maxBetPercentage, setMaxBetPercentage] = useState(5);
  const [pushAlertsEnabled, setPushAlertsEnabled] = useState(true);

  // Load initial push alerts setting
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data, error } = await supabase
            .from('profiles')
            .select('notification_settings')
            .eq('id', user.id)
            .single();
          if (!error && data?.notification_settings) {
            setPushAlertsEnabled(Boolean(data.notification_settings.push_alerts));
          }
        }
      } catch (err) {
        console.error('Failed to load notification settings', err);
      }
    })();
  }, []);

  const [availableSports] = useState([
    { id: 1, name: 'Football' },
    { id: 2, name: 'Basketball' },
    { id: 3, name: 'Baseball' },
    { id: 4, name: 'Tennis' },
    { id: 5, name: 'Golf' },
    { id: 6, name: 'Cricket' },
    { id: 7, name: 'Hockey' },
    { id: 8, name: 'Volleyball' },
    { id: 9, name: 'Handball' },
  ]);
  const [selectedSports, setSelectedSports] = useState<number[]>([]);

  // Load user profile data
  useEffect(() => {
    fetchUserProfile();
    checkAdminStatus();
    checkAuthMethods();

    // Set up keyboard listeners
    const keyboardWillShowListener = Platform.OS === 'ios' ?
      Keyboard.addListener('keyboardWillShow', (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }) :
      Keyboard.addListener('keyboardDidShow', (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      });

    const keyboardWillHideListener = Platform.OS === 'ios' ?
      Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardHeight(0);
      }) :
      Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardHeight(0);
      });

    // Cleanup listeners
    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Check what auth methods the user has
  const checkAuthMethods = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check app_metadata for provider info
      const provider = user.app_metadata?.provider || 'email';
      const providers = user.app_metadata?.providers || [provider];
      
      // Apple users will have 'apple' in their providers array or as their main provider
      setHasAppleAuth(providers.includes('apple') || provider === 'apple');
      
      // If they have Apple auth, check if they also have a password set
      // We'll assume they don't have a password if they only have Apple auth
      // and no other providers
      if (providers.includes('apple') && providers.length === 1) {
        setHasPasswordAuth(false);
      } else {
        // They either don't have Apple auth or have multiple auth methods
        setHasPasswordAuth(true);
      }
    } catch (error) {
      console.error('Error checking auth methods:', error);
      // Assume password auth if we can't check
      setHasPasswordAuth(true);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('admin_role')
          .eq('id', user.id)
          .single();
        
        setIsAdmin(data?.admin_role === true);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Fetch user profile from profiles table
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          // Fallback to auth user data
          setUserProfile({
            id: user.id,
            username: user.user_metadata?.username || null,
            email: user.email || null,
            avatar_url: null,
            subscription_tier: 'free',
            created_at: user.created_at
          });
          setHasUsername(!!user.user_metadata?.username);
        } else {
          setUserProfile({
            id: profile.id,
            username: profile.username,
            email: user.email || profile.email,
            avatar_url: profile.avatar_url,
            subscription_tier: profile.subscription_tier || 'free',
            created_at: profile.created_at
          });
          setHasUsername(!!profile.username && profile.username.trim() !== '');
          setUserReferralCode(profile.referral_code || '');
          
          // Fetch referral stats if user has a referral code
          if (profile.referral_code) {
            fetchReferralStats(profile.referral_code, user.id);
          }

          // Load points balance
          loadPointsBalance(user.id);
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferralStats = async (referralCode: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', userId);

      if (!error && data) {
        const totalReferrals = data.length;
        const pendingRewards = data.filter(r => r.status === 'completed' && !r.reward_granted).length;
        setReferralStats({ totalReferrals, pendingRewards });
      }
    } catch (error) {
      console.error('Error fetching referral stats:', error);
    }
  };

  const loadPointsBalance = async (userId: string) => {
    try {
      const pointsService = PointsService.getInstance();
      const balance = await pointsService.getPointsBalance(userId);
      setPointsBalance(balance.availablePoints);
    } catch (error) {
      console.error('Error loading points balance:', error);
    }
  };

  const handleShareReferralCode = async () => {
    if (!userReferralCode) {
      Alert.alert('Error', 'No referral code found. Please contact support.');
      return;
    }

    const shareMessage = `🚀 Join me on Predictive Play - the AI-powered sports betting app! Get premium picks and insights. Use my referral code: ${userReferralCode}\n\nDownload: https://apps.apple.com/app/predictive-play`;

    try {
      await Share.share({
        message: shareMessage,
        title: 'Join Predictive Play',
      });
    } catch (error) {
      console.error('Error sharing referral code:', error);
      Alert.alert('Error', 'Unable to open the share sheet on this device.');
    }
  };

  const handleCopyReferralCode = async () => {
    if (!userReferralCode) {
      Alert.alert('Error', 'No referral code found. Please contact support.');
      return;
    }

    try {
      await Clipboard.setStringAsync(userReferralCode);
      Vibration.vibrate(50);
      Alert.alert('Copied!', `Your referral code "${userReferralCode}" has been copied to clipboard.`);
    } catch (error) {
      console.error('Error copying referral code:', error);
      Alert.alert('Error', 'Failed to copy referral code.');
    }
  };

  const handleSetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    // Check for password requirements (at least 8 chars)
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    try {
      setChangePasswordLoading(true);
      Keyboard.dismiss();

      // For Apple users setting a password for the first time
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        Alert.alert('Error', updateError.message);
        return;
      }

      Alert.alert(
        'Success',
        'Password set successfully! You can now sign in with your email and password.',
        [{ 
          text: 'OK', 
          onPress: () => {
            setShowSetPasswordModal(false);
            setHasPasswordAuth(true);
            // Clear form
            setNewPassword('');
            setConfirmPassword('');
          }
        }]
      );
    } catch (error: any) {
      console.error('Set password error:', error);
      Alert.alert('Error', error.message || 'Failed to set password');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleSetUsername = async () => {
    if (!newUsername || newUsername.trim() === '') {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    if (newUsername.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters long');
      return;
    }

    // Clean username (alphanumeric and underscores only)
    const cleanUsername = newUsername.replace(/[^a-zA-Z0-9_]/g, '');
    if (cleanUsername !== newUsername) {
      Alert.alert('Error', 'Username can only contain letters, numbers, and underscores');
      return;
    }

    try {
      setSetUsernameLoading(true);
      Keyboard.dismiss();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to set username');
        return;
      }

      // Update username in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          username: cleanUsername,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        if (updateError.message.includes('duplicate') || updateError.message.includes('unique')) {
          Alert.alert('Error', 'This username is already taken. Please choose another.');
        } else {
          Alert.alert('Error', updateError.message);
        }
        return;
      }

      Alert.alert(
        'Success',
        'Username set successfully!',
        [{ 
          text: 'OK', 
          onPress: () => {
            setShowSetUsernameModal(false);
            setHasUsername(true);
            // Update local profile
            if (userProfile) {
              setUserProfile({
                ...userProfile,
                username: cleanUsername
              });
            }
            // Clear form
            setNewUsername('');
          }
        }]
      );
    } catch (error: any) {
      console.error('Set username error:', error);
      Alert.alert('Error', error.message || 'Failed to set username');
    } finally {
      setSetUsernameLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters long');
      return;
    }

    // Check for password requirements (at least 8 chars with at least one letter and one number)
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      Alert.alert('Error', 'Password must be at least 8 characters long and include at least one letter and one number');
      return;
    }

    try {
      setChangePasswordLoading(true);
      Keyboard.dismiss();

      // Verify user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to change your password');
        return;
      }

      // First, verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email || '',
        password: currentPassword
      });
      
      if (signInError) {
        Alert.alert('Error', 'Current password is incorrect');
        return;
      }

      // Update password directly - Supabase handles authentication internally
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        // Handle specific error cases
        if (updateError.message.includes('same')) {
          Alert.alert('Error', 'New password must be different from your current password');
        } else if (updateError.message.includes('weak')) {
          Alert.alert('Error', 'Password is too weak. Please choose a stronger password');
        } else {
          Alert.alert('Error', updateError.message);
        }
        return;
      }

      Alert.alert(
        'Success',
        'Password changed successfully! You may need to sign in again.',
        [{ text: 'OK', onPress: () => setShowChangePasswordModal(false) }]
      );

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

    } catch (error: any) {
      console.error('Password change error:', error);
      Alert.alert('Error', error.message || 'Failed to change password');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const proFeatures = [
    { icon: Brain, title: 'Unlimited AI Picks', description: 'Get AI predictions for all games' },
    { icon: Target, title: 'Advanced Analytics', description: 'Detailed stats and trend analysis' },
    { icon: Crown, title: 'Multi-Book Odds', description: 'Compare odds across all sportsbooks' },
    { icon: Sparkles, title: 'Live AI Chat', description: 'Ask anything about bets and strategy' },
    { icon: Bell, title: 'Priority Alerts', description: 'Real-time value bet notifications' },
    { icon: Shield, title: 'Exclusive Insights', description: 'Access all premium research content' }
  ];

  const handleSavePreferences = async () => {
    try {
      // Convert selectedSports IDs to sport names
      const sportNames = selectedSports.map(id => 
        availableSports.find(sport => sport.id === id)?.name || ''
      ).filter(name => name !== '');
      
      // Prepare data for API
      const preferences = {
        risk_tolerance: riskTolerance,
        sports: sportNames,
        bet_types: ['moneyline', 'spread', 'total'],
        max_bet_size: parseInt(bankroll) ? Math.floor(parseInt(bankroll) * (maxBetPercentage / 100)) : 0,
        notification_preferences: {
          frequency: 'daily',
          types: ['new_predictions', 'bet_results']
        }
      };
      
      // Use the aiService to save preferences with proper URL handling
      await aiService.saveUserPreferences(preferences);
      
      Alert.alert('Success', 'Preferences saved successfully!');
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', error.message || 'Failed to save preferences');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🚪 Logging out user...');
              
              // Sign out from Supabase
              const { error } = await supabase.auth.signOut();
              
              if (error) {
                console.error('Logout error:', error);
                Alert.alert('Error', 'Failed to log out. Please try again.');
                return;
              }
              
              console.log('✅ Successfully logged out');
              
              // Navigate to login screen
              await router.replace('/(auth)/login');
              
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your data.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleteAccountLoading(true);
              console.log('🗑️ Deleting user account...');
              
              if (!userProfile?.id) {
                Alert.alert('Error', 'User not found. Please try logging out and back in.');
                return;
              }
              
              // Call the delete account API
              await userApi.deleteAccount(userProfile.id);
              
              console.log('✅ Account successfully deleted');
              
              // Sign out and navigate to login
              const { error } = await supabase.auth.signOut();
              if (error) {
                console.error('Signout after account deletion error:', error);
              }
              
              // Navigate to login screen
              await router.replace('/(auth)/login');
              
              Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
              
            } catch (error) {
              console.error('Delete account error:', error);
              Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
            } finally {
              setDeleteAccountLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleManageSubscription = () => {
    if (isPro) {
      // For Pro users, show subscription management options
      Alert.alert(
        'Manage Subscription',
        'What would you like to do?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'View in App Store',
            onPress: () => {
              // Open subscription management in App Store
              if (Platform.OS === 'ios') {
                Linking.openURL('https://apps.apple.com/account/subscriptions');
              }
            }
          },
          {
            text: 'Contact Support',
            onPress: () => {
              // Open support email
              Linking.openURL('mailto:support@Predictive Play.com?subject=Subscription%20Support');
            }
          }
        ]
      );
    } else {
      // For free users, open the subscription modal
      openSubscriptionModal();
    }
  };

  // Handler for link items
  const handleLinkPress = (itemId: string) => {
    switch (itemId) {
      case 'password':
        setShowChangePasswordModal(true);
        break;
      
      case 'setPassword':
        setShowSetPasswordModal(true);
        break;
      
      case 'setUsername':
        setShowSetUsernameModal(true);
        break;
      
      case 'help':
        setShowHelpCenterModal(true);
        break;
      
      case 'feedback':
        setShowFeedbackModal(true);
        break;
      
      case 'about':
        setShowAboutModal(true);
        break;
      
      case 'terms':
        setShowTermsModal(true);
        break;
        
      case 'privacy':
        setShowPrivacyModal(true);
        break;
      
      default:
        Alert.alert('Coming Soon', 'This feature will be available in a future update.');
        break;
    }
  };

  // Get user display name and initials
  const getUserDisplayName = () => {
    if (userProfile?.username && userProfile.username.trim() !== '') {
      return userProfile.username;
    }
    if (userProfile?.email) {
      return userProfile.email.split('@')[0];
    }
    return 'User';
  };

  const getUserInitials = () => {
    const displayName = getUserDisplayName();
    return displayName.substring(0, 2).toUpperCase();
  };

  const handleBiometricComingSoon = () => {
    Alert.alert(
      'Coming Soon! 🔐',
      'Biometric login is coming in a future update. Stay tuned for secure and convenient authentication options!',
      [{ text: 'Got it!', style: 'default' }]
    );
  };

  const handleReviewApp = async () => {
    try {
      Vibration.vibrate(50);
      const success = await showManualReview();
      
      if (!success) {
        Alert.alert(
          'Review Not Available 📱',
          'App Store reviews are not available right now. This could be because:\n\n• You recently left a review (wait 7 days)\n• Reviews aren\'t supported on this device\n• You\'re using a simulator\n\nThanks for wanting to support us!',
          [{ text: 'Okay', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Manual review error:', error);
      Alert.alert(
        'Error',
        'Unable to open App Store review. Please try again later or visit the App Store directly.',
        [{ text: 'Okay', style: 'default' }]
      );
    }
  };

  // Toggle push alerts handler (single definition)
  const handleTogglePushAlerts = async (value: boolean) => {
    setPushAlertsEnabled(value);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { error } = await supabase
          .from('profiles')
          .update({ notification_settings: { push_alerts: value } })
          .eq('id', user.id);
        if (error) console.error('Error updating notification settings', error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const settingsSections = [
    {
      title: 'Account',
      icon: User,
      iconColor: '#00E5FF',
      items: [
        { 
          id: 'subscription', 
          title: 'Subscription', 
          type: 'link', 
          badge: isElite ? 'ELITE' : isPro ? 'PRO' : 'FREE',
          badgeColor: isElite ? '#FFD700' : isPro ? '#F59E0B' : '#6B7280',
          action: handleManageSubscription
        },
        {
          id: 'preferences',
          title: 'User Preferences',
          type: 'link',
          subtitle: 'Sports, betting style & pick distribution',
          action: () => setShowUserPreferencesModal(true)
        },
        {
          id: 'restore',
          title: 'Restore Purchases',
          type: 'link',
          action: async () => {
            try {
              await restorePurchases();
              Alert.alert('Success', 'Purchases restored successfully!');
            } catch (error) {
              Alert.alert('Error', 'Failed to restore purchases. Please try again.');
            }
          }
        }
      ]
    },
    {
      title: 'Referrals & Points',
      icon: Share2,
      iconColor: '#10B981',
      items: [
        {
          id: 'points_balance',
          title: 'Points Balance',
          type: 'link',
          subtitle: `${pointsBalance.toLocaleString()} points ($${(pointsBalance / 100).toFixed(2)} value)`,
          badge: pointsBalance > 0 ? 'Redeem' : undefined,
          badgeColor: '#3B82F6',
          action: () => setShowPointsModal(true)
        },
        {
          id: 'share_referral',
          title: 'Share Referral Code',
          type: 'link',
          subtitle: userReferralCode ? `Your code: ${userReferralCode}` : 'Get rewards for inviting friends',
          badge: referralStats.totalReferrals > 0 ? `${referralStats.totalReferrals} referred` : undefined,
          badgeColor: '#10B981',
          action: handleShareReferralCode
        },
        {
          id: 'copy_referral',
          title: 'Copy Referral Code',
          type: 'link',
          subtitle: 'Copy to clipboard',
          action: handleCopyReferralCode
        }
      ]
    },
    {
      title: 'Notifications',
      icon: Bell,
      iconColor: '#F59E0B',
      items: [
        {
          id: 'push_alerts',
          title: 'Push Alerts',
          type: 'toggle',
          value: pushAlertsEnabled,
          onToggle: handleTogglePushAlerts,
        },
      ]
    },
    {
      title: 'Security',
      icon: Shield,
      iconColor: '#10B981',
      items: [
        // Conditionally show Set Username if user doesn't have one
        ...(!hasUsername ? [{
          id: 'setUsername',
          title: 'Set Username',
          type: 'link',
          badge: 'NEW',
          badgeColor: '#00E5FF'
        }] : []),
        
        // Show either Set Password (for Apple users) or Change Password
        ...(hasAppleAuth && !hasPasswordAuth ? [{
          id: 'setPassword',
          title: 'Set Password',
          type: 'link',
          badge: 'OPTIONAL',
          badgeColor: '#F59E0B'
        }] : (hasPasswordAuth ? [{
          id: 'password',
          title: 'Change Password',
          type: 'link'
        }] : [])),
        
        // Payment History removed per requirements
        // Biometric Login removed per requirements
      ]
    },
    {
      title: 'Support',
      icon: HelpCircle,
      iconColor: '#8B5CF6',
      items: [
        { 
          id: 'review_app', 
          title: 'Review Our App ⭐', 
          type: 'link',
          subtitle: 'Help others discover Predictive Play',
          action: handleReviewApp
        },
        { id: 'help', title: 'Help Center', type: 'link' },
        { id: 'feedback', title: 'Send Feedback', type: 'link' },
        { id: 'about', title: 'About Predictive Play', type: 'link' },
        { id: 'terms', title: 'Terms of Service', type: 'link' },
        { id: 'privacy', title: 'Privacy Policy', type: 'link' },
      ]
    }
  ];

  const renderSettingItem = (item: any) => {
    return (
      <TouchableOpacity 
        key={item.id}
        style={[styles.settingItem, item.locked && styles.settingItemLocked]}
        onPress={() => {
          if (item.action) {
            item.action();
          } else if (item.type === 'toggle' && !item.locked) {
            // toggleSwitch(item.id); // This function is removed
          } else if (item.type === 'link' && !item.locked) {
            handleLinkPress(item.id);
          } else if (item.locked) {
            Alert.alert(
              'Pro Feature 🌟',
              `${item.title} is available for Pro members only.`,
              [
                { text: 'Maybe Later', style: 'cancel' },
                { 
                  text: 'Upgrade to Pro', 
                  onPress: () => openSubscriptionModal(),
                  style: 'default'
                }
              ]
            );
          }
        }}
      >
        <View style={styles.settingLeft}>
          <Text style={[styles.settingTitle, item.locked && styles.settingTitleLocked]}>
            {item.title}
          </Text>
          {item.locked && (
            <Lock size={14} color="#6B7280" style={{ marginLeft: 8 }} />
          )}
          {item.badge && (
            <View style={[styles.badge, { backgroundColor: `${item.badgeColor}20` }]}>
              <Text style={[styles.badgeText, { color: item.badgeColor }]}>{item.badge}</Text>
            </View>
          )}
        </View>
        <View style={styles.settingRight}>
          {item.type === 'toggle' && !item.locked && (
            <Switch
              value={item.value}
              onValueChange={(val) => item.onToggle?.(val)}
              trackColor={{ false: '#374151', true: '#00E5FF' }}
              thumbColor={item.value ? '#FFFFFF' : '#9CA3AF'}
            />
          )}
          {item.type === 'coming-soon' && (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>{item.subtitle || 'Coming Soon'}</Text>
            </View>
          )}
          {item.type === 'link' && (
            <ChevronRight size={16} color="#6B7280" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {isAdmin && (
        <TouchableOpacity 
          style={[styles.settingsGroup, { marginBottom: 20, backgroundColor: '#1E3A8A' }]}
          onPress={() => router.push('/admin-dashboard')}
        >
          <View style={styles.adminSettingItem}>
            <View style={styles.settingIcon}>
              <Crown size={24} color="#FFD700" />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, { color: '#FFFFFF' }]}>Admin Dashboard</Text>
              <Text style={[styles.settingDescription, { color: '#CCCCCC' }]}>Access analytics and admin controls</Text>
            </View>
            <ChevronRight size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      )}
      {/* Profile & Stats Section */}
      <View style={styles.profileSection}>
        <TouchableOpacity 
          style={styles.profileToggleButton}
          onPress={() => setShowProfileDetails(!showProfileDetails)}
        >
          <View style={styles.profileToggleContent}>
            <View style={styles.profileBasicInfo}>
              <LinearGradient
                colors={isElite ? ['#8B5CF6', '#7C3AED'] : (isPro ? ['#F59E0B', '#D97706'] : ['#1E293B', '#374151'])}
                style={styles.profileImagePlaceholder}
              >
                {(isPro || isElite) && <Crown size={20} color="#FFFFFF" />}
                {!isPro && !isElite && <Text style={styles.profileInitials}>{getUserInitials()}</Text>}
              </LinearGradient>
              <View style={styles.profileDetails}>
                <View style={styles.profileNameContainer}>
                  <Text style={styles.profileName}>{loading ? 'Loading...' : getUserDisplayName()}</Text>
                  {(isPro || isElite) && (
                    <View style={[styles.proBadge, isElite && styles.eliteBadge]}>
                      <Crown size={12} color={isElite ? "#FFD700" : "#F59E0B"} />
                      <Text style={[styles.proBadgeText, isElite && styles.eliteBadgeText]}>
                        {isElite ? 'ELITE' : 'PRO'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.profileStatus}>
                  {userProfile?.email || 'Loading...'}
                </Text>
                <Text style={styles.profileMemberStatus}>
                  {isElite ? 'Elite Member • 30 Picks' : (isPro ? 'Pro Member • 20 Picks' : 'Free Member • Starter')}
                </Text>
              </View>
            </View>
            {showProfileDetails ? (
              <ChevronDown size={20} color="#00E5FF" />
            ) : (
              <ChevronRight size={20} color="#00E5FF" />
            )}
          </View>
        </TouchableOpacity>

        {showProfileDetails && (
          <View style={styles.profileDetailsSection}>
            {/* Account Info */}
            <View style={styles.accountInfoCard}>
              <View style={styles.accountInfoHeader}>
                <View style={styles.accountInfoIcon}>
                  <User size={20} color="#00E5FF" />
                </View>
                <Text style={styles.accountInfoTitle}>Account Information</Text>
              </View>
              
              <View style={styles.accountInfoContent}>
                <View style={styles.accountInfoItem}>
                  <Text style={styles.accountInfoLabel}>Username</Text>
                  <Text style={styles.accountInfoValue}>
                    {userProfile?.username || 'Not set'}
                  </Text>
                </View>
                
                <View style={styles.accountInfoItem}>
                  <Text style={styles.accountInfoLabel}>Email</Text>
                  <Text style={styles.accountInfoValue}>
                    {userProfile?.email || 'Loading...'}
                  </Text>
                </View>
                
                <View style={styles.accountInfoItem}>
                  <Text style={styles.accountInfoLabel}>Member Since</Text>
                  <Text style={styles.accountInfoValue}>
                    {userProfile?.created_at ? new Date(userProfile.created_at).toLocaleDateString() : 'Loading...'}
                  </Text>
                </View>
                
                <View style={styles.accountInfoItem}>
                  <Text style={styles.accountInfoLabel}>Subscription</Text>
                  <View style={styles.subscriptionBadge}>
                    <Text style={[styles.subscriptionBadgeText, { 
                      color: isElite ? '#8B5CF6' : (isPro ? '#F59E0B' : '#6B7280'),
                      backgroundColor: isElite ? 'rgba(139, 92, 246, 0.1)' : (isPro ? 'rgba(245, 158, 11, 0.1)' : 'rgba(107, 114, 128, 0.1)')
                    }]}>
                      {isElite ? 'ELITE MEMBER' : (isPro ? 'PRO MEMBER' : 'FREE MEMBER')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* AI Features Summary */}
            <View style={styles.featuresCard}>
              <View style={styles.featuresHeader}>
                <View style={styles.featuresIcon}>
                  <Brain size={20} color="#8B5CF6" />
                </View>
                <Text style={styles.featuresTitle}>AI Features</Text>
              </View>
              
              <View style={styles.featuresContent}>
                <Text style={styles.featuresDescription}>
                  {isElite 
                    ? 'You have access to all Elite AI features including 30 daily picks, advanced analytics, live AI chat, and exclusive Lock of the Day.'
                    : (isPro 
                      ? 'You have access to all Pro AI features including 20 daily picks, advanced analytics, and live AI chat.'
                      : 'Upgrade to Pro to unlock unlimited AI picks, advanced analytics, live chat, and more premium features.')
                  }
                </Text>
                
                {!isPro && (
                  <TouchableOpacity 
                    style={styles.upgradeButton}
                    onPress={() => openSubscriptionModal()}
                  >
                    <LinearGradient
                      colors={['rgba(245, 158, 11, 0.2)', 'rgba(245, 158, 11, 0.1)']}
                      style={styles.upgradeGradient}
                    >
                      <Sparkles size={16} color="#F59E0B" />
                      <Text style={styles.upgradeText}>
                        Upgrade to Pro
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Settings Sections */}
      {settingsSections.map((section, index) => (
        <View key={index} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: `${section.iconColor}20` }]}>
              <section.icon size={20} color={section.iconColor} />
            </View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
          <View style={styles.sectionContent}>
            {section.items.map((item) => renderSettingItem(item))}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <LogOut size={18} color="#EF4444" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.deleteAccountButton, deleteAccountLoading && styles.buttonDisabled]} 
        onPress={handleDeleteAccount}
        disabled={deleteAccountLoading}
      >
        <Trash2 size={18} color="#DC2626" />
        <Text style={styles.deleteAccountText}>
          {deleteAccountLoading ? 'Deleting Account...' : 'Delete Account'}
        </Text>
      </TouchableOpacity>

      <View style={styles.versionInfo}>
        <Text style={styles.versionText}>Predictive Play v1.0.0</Text>
        <Text style={styles.copyrightText}>© 2025 Predictive Play Inc.</Text>
      </View>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1} 
            onPress={() => Keyboard.dismiss()}
          >
            <View 
              style={[styles.modalContent, { marginBottom: keyboardHeight > 0 ? keyboardHeight * 0.5 : 0 }]}
            >
              <Text style={styles.modalTitle}>Change Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Current Password"
                  placeholderTextColor="#888"
                  secureTextEntry={!showCurrentPassword}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />
                <TouchableOpacity 
                  style={styles.passwordToggle}
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? 
                    <Eye size={20} color="#666" /> : 
                    <EyeOff size={20} color="#666" />}
                </TouchableOpacity>
              </View>
              
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="New Password"
                  placeholderTextColor="#888"
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TouchableOpacity 
                  style={styles.passwordToggle}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? 
                    <Eye size={20} color="#666" /> : 
                    <EyeOff size={20} color="#666" />}
                </TouchableOpacity>
              </View>
              
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Confirm Password"
                  placeholderTextColor="#888"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity 
                  style={styles.passwordToggle}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? 
                    <Eye size={20} color="#666" /> : 
                    <EyeOff size={20} color="#666" />}
                </TouchableOpacity>
              </View>
              
              <Text style={styles.passwordRequirements}>
                Password must be at least 8 characters with at least one number and one special character.
              </Text>
              
              <TouchableOpacity
                style={styles.changePasswordButton}
                onPress={handleChangePassword}
                disabled={changePasswordLoading}
              >
                <Text style={styles.changePasswordText}>
                  {changePasswordLoading ? 'Changing...' : 'Change Password'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowChangePasswordModal(false);
                  // Clear form data when closing
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={changePasswordLoading}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Set Password Modal (for Apple Sign In users) */}
      <Modal
        visible={showSetPasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSetPasswordModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1} 
            onPress={() => Keyboard.dismiss()}
          >
            <View 
              style={[styles.modalContent, { marginBottom: keyboardHeight > 0 ? keyboardHeight * 0.5 : 0 }]}
            >
              <Text style={styles.modalTitle}>Set Password</Text>
              <Text style={styles.modalSubtitle}>
                Create a password to sign in with email in addition to Apple Sign In
              </Text>
              
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="New Password"
                  placeholderTextColor="#888"
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TouchableOpacity 
                  style={styles.passwordToggle}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? 
                    <Eye size={20} color="#666" /> : 
                    <EyeOff size={20} color="#666" />}
                </TouchableOpacity>
              </View>
              
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Confirm Password"
                  placeholderTextColor="#888"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity 
                  style={styles.passwordToggle}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? 
                    <Eye size={20} color="#666" /> : 
                    <EyeOff size={20} color="#666" />}
                </TouchableOpacity>
              </View>
              
              <Text style={styles.passwordRequirements}>
                Password must be at least 8 characters long.
              </Text>
              
              <TouchableOpacity
                style={styles.changePasswordButton}
                onPress={handleSetPassword}
                disabled={changePasswordLoading}
              >
                <Text style={styles.changePasswordText}>
                  {changePasswordLoading ? 'Setting Password...' : 'Set Password'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowSetPasswordModal(false);
                  // Clear form data when closing
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={changePasswordLoading}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Set Username Modal */}
      <Modal
        visible={showSetUsernameModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSetUsernameModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1} 
            onPress={() => Keyboard.dismiss()}
          >
            <View 
              style={[styles.modalContent, { marginBottom: keyboardHeight > 0 ? keyboardHeight * 0.5 : 0 }]}
            >
              <Text style={styles.modalTitle}>Set Username</Text>
              <Text style={styles.modalSubtitle}>
                Choose a username for your profile
              </Text>
              
              <TextInput
                style={styles.usernameInput}
                placeholder="Enter username"
                placeholderTextColor="#888"
                value={newUsername}
                onChangeText={(text) => {
                  // Allow only alphanumeric and underscores
                  const cleanText = text.replace(/[^a-zA-Z0-9_]/g, '');
                  setNewUsername(cleanText);
                }}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              <Text style={styles.usernameRequirements}>
                Username must be 3-20 characters, letters, numbers, and underscores only
              </Text>
              
              <TouchableOpacity
                style={styles.changePasswordButton}
                onPress={handleSetUsername}
                disabled={setUsernameLoading}
              >
                <Text style={styles.changePasswordText}>
                  {setUsernameLoading ? 'Setting Username...' : 'Set Username'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowSetUsernameModal(false);
                  // Clear form data when closing
                  setNewUsername('');
                }}
                disabled={setUsernameLoading}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Help Center Modal */}
      <HelpCenterModal 
        visible={showHelpCenterModal}
        onClose={() => setShowHelpCenterModal(false)}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        visible={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />
      
      {/* About Modal */}
      <AboutModal
        visible={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
      
      {/* Terms of Service Modal */}
      <TermsOfServiceModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />
      
      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />

      {/* User Preferences Modal */}
      <UserPreferencesModal
        visible={showUserPreferencesModal}
        onClose={() => setShowUserPreferencesModal(false)}
        onPreferencesUpdated={fetchUserProfile}
      />

      <PointsRedemptionModal
        visible={showPointsModal}
        onClose={() => setShowPointsModal(false)}
        userId={userProfile?.id || ''}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  contentContainer: {
    paddingTop: 20,
    paddingBottom: 30,
  },
  // Profile styles
  profileSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    margin: 16,
    marginTop: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  profileToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  profileToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileBasicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInitials: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileDetails: {
    flex: 1,
  },
  profileNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  proBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadgeText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
  },
  eliteBadge: {
    backgroundColor: '#FFD700',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  eliteBadgeText: {
    color: '#1A1611',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  profileStatus: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 4,
  },
  profileMemberStatus: {
    fontSize: 14,
    color: '#E2E8F0',
  },
  containerAlt: {
    flex: 1,
    backgroundColor: '#111827',
  },
  contentContainerAlt: {
    paddingTop: 20,
    paddingBottom: 100,
  },
  profileSectionAlt: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      },
    }),
    marginTop: 8,
  },
  profileCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  profileAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2E3C50',
  },
  profileBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  profileBadgeIcon: {
    color: '#0F172A',
    fontSize: 12,
  },
  profileInfo: {
    flex: 1,
  },
  profileNameAlt: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileEmail: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 4,
  },
  profileMemberSince: {
    fontSize: 14,
    color: '#E2E8F0',
    marginBottom: 4,
  },
  profileMemberStatusAlt: {
    fontSize: 14,
    color: '#E2E8F0',
    marginBottom: 8,
  },
  profileDetailsSection: {
    padding: 16,
  },
  statsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsFilterText: {
    color: '#00E5FF',
    fontSize: 14,
    marginRight: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  settingsGroup: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  adminSettingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingDescription: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  statItem: {
    width: '48%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  recentBetsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  recentBetsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recentBetsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    color: '#00E5FF',
    fontSize: 14,
    marginRight: 2,
  },
  betsList: {
    
  },
  betItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  betMatch: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  betPick: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  betDate: {
    fontSize: 12,
    color: '#64748B',
  },
  betDetails: {
    alignItems: 'flex-end',
  },
  betAmount: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  betReturn: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  betStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  betStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileActionsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  profileActionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  profileActionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  profileActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  profileActionItemLocked: {
    opacity: 0.6,
  },
  profileActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileActionTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  profileActionTitleLocked: {
    color: '#94A3B8',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.3)',
  },
  settingItemLocked: {
    opacity: 0.6,
  },
  settingLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  settingTitleLocked: {
    color: '#94A3B8',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  section: {
    marginVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionContent: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectValue: {
    fontSize: 14,
    color: '#94A3B8',
    marginRight: 6,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeContainer: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 10,
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  comingSoonText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  deleteAccountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  versionInfo: {
    alignItems: 'center',
    marginTop: 30,
  },
  versionText: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 4,
  },
  copyrightText: {
    color: '#64748B',
    fontSize: 12,
  },
  subscriptionSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    margin: 16,
    marginTop: 0,
    padding: 16,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  subscriptionPlans: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  planCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  planGradient: {
    flex: 1,
    padding: 16,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  popularBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  popularText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '600',
  },
  saveBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  saveText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '600',
  },
  planPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planPeriod: {
    fontSize: 12,
    color: '#94A3B8',
  },
  planDescription: {
    fontSize: 12,
    color: '#94A3B8',
  },
  proFeaturesSection: {
    marginTop: 16,
  },
  proFeaturesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  proFeaturesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  proFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    width: '50%',
  },
  proFeatureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  proFeatureContent: {
    flex: 1,
  },
  proFeatureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  proFeatureDescription: {
    fontSize: 12,
    color: '#94A3B8',
  },
  lockedBetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  lockedBetText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 8,
  },
  upgradeStatsButton: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  upgradeStatsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeStatsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1F2937',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#0F172A',
    borderRadius: 12,
  },
  modalOptionSelected: {
    backgroundColor: '#00E5FF',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  modalOptionTextSelected: {
    color: '#0F172A',
    fontWeight: '600',
  },
  checkMark: {
    fontSize: 18,
    color: '#0F172A',
    fontWeight: '700',
  },
  modalCancelButton: {
    marginTop: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 15,
    marginTop: 15,
    color: '#FFFFFF',
  },
  usernameInput: {
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 15,
    marginTop: 15,
    color: '#FFFFFF',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    backgroundColor: '#374151',
    borderRadius: 10,
    marginTop: 15,
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    color: '#FFFFFF',
  },
  passwordToggle: {
    paddingHorizontal: 15,
  },
  passwordRequirements: {
    marginTop: 12,
    marginBottom: 8,
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
  },
  usernameRequirements: {
    marginTop: 12,
    marginBottom: 8,
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
  },
  changePasswordButton: {
    backgroundColor: '#00E5FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  changePasswordText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  // Account Info Card styles
  accountInfoCard: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  accountInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  accountInfoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  accountInfoContent: {
    gap: 12,
  },
  accountInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  accountInfoLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  accountInfoValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  subscriptionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subscriptionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Features Card styles
  featuresCard: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  featuresHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featuresIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  featuresContent: {
    gap: 12,
  },
  featuresDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  upgradeButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  upgradeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  // Coming Soon Badge styles
  comingSoonBadgeAlt: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderWidth: 1,
    borderColor: '#F97316',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonTextAlt: {
    color: '#F97316',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center'
  }
});