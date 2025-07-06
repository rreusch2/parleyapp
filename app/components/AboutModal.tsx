import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Zap,
  Users,
  Brain,
  TrendingUp,
  Shield,
  Star,
  Cpu,
  BarChart3,
  Trophy,
  Target,
  Sparkles
} from 'lucide-react-native';

interface AboutModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AboutModal({ visible, onClose }: AboutModalProps) {
  const achievements = [
    { icon: Brain, label: 'AI-Powered Predictions', value: '67%+ Win Rate' },
    { icon: Zap, label: 'Real-Time Analysis', value: 'Live Odds & Data' },
    { icon: Trophy, label: 'Multi-Sport Coverage', value: '5+ Major Leagues' },
    { icon: Target, label: 'Precision Technology', value: 'DeepSeek AI' },
  ];

  const features = [
    {
      icon: Brain,
      title: 'Advanced AI Engine',
      description: 'Powered by DeepSeek orchestrator with multiple ML models analyzing thousands of data points'
    },
    {
      icon: BarChart3,
      title: 'Real-Time Analytics',
      description: 'Live odds comparison, injury reports, and market movement tracking from top sportsbooks'
    },
    {
      icon: Sparkles,
      title: 'Intelligent Insights',
      description: 'Automated content generation with personalized predictions and expert-level analysis'
    },
    {
      icon: Shield,
      title: 'Professional Grade',
      description: 'Enterprise-level monitoring, performance optimization, and data security'
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <LinearGradient
                colors={['#00E5FF', '#0891B2']}
                style={styles.logoContainer}
              >
                <Sparkles size={28} color="#FFFFFF" />
              </LinearGradient>
              <View>
                <Text style={styles.headerTitle}>Predictive Play</Text>
                <Text style={styles.headerSubtitle}>AI-Powered Sports Intelligence</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

                 <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
           {/* Mission Statement */}
           <View style={[styles.section, styles.firstSection]}>
             <Text style={styles.missionText}>
              Revolutionizing sports betting through cutting-edge artificial intelligence, 
              real-time data analysis, and professional-grade insights that empower smarter decisions.
            </Text>
          </View>

          {/* Founders Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Users size={24} color="#00E5FF" />
              <Text style={styles.sectionTitle}>Founded by Professionals</Text>
            </View>
            
                         <View style={styles.foundersContainer}>
               <View style={styles.founderCard}>
                 <LinearGradient
                   colors={['rgba(245, 158, 11, 0.1)', 'rgba(245, 158, 11, 0.05)']}
                   style={styles.founderGradient}
                 >
                   <Text style={styles.founderName}>Logan McKinney</Text>
                   <Text style={styles.founderTitle}>Co-Founder & Sports Analytics</Text>
                   <Text style={styles.founderDescription}>
                     Professional sports analyst with extensive experience in betting markets, 
                     statistical modeling, and sports intelligence. Expert in translating 
                     complex sports data into profitable betting strategies and insights.
                   </Text>
                 </LinearGradient>
               </View>

               <View style={styles.founderCard}>
                 <LinearGradient
                   colors={['rgba(0, 229, 255, 0.1)', 'rgba(0, 229, 255, 0.05)']}
                   style={styles.founderGradient}
                 >
                   <Text style={styles.founderName}>Reid Reusch</Text>
                   <Text style={styles.founderTitle}>Co-Founder & Technology Lead</Text>
                   <Text style={styles.founderDescription}>
                     Experienced technology professional with deep expertise in AI systems, 
                     data analytics, and sports technology platforms. Specializes in building 
                     scalable, intelligent applications that transform complex data into actionable insights.
                   </Text>
                 </LinearGradient>
               </View>
             </View>
          </View>

          {/* Technology Stack */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Cpu size={24} color="#8B5CF6" />
              <Text style={styles.sectionTitle}>Advanced Technology</Text>
            </View>
            
            <View style={styles.techContainer}>
              {features.map((feature, index) => (
                <View key={index} style={styles.featureCard}>
                  <View style={styles.featureHeader}>
                    <View style={[styles.featureIcon, { backgroundColor: `rgba(139, 92, 246, 0.${index + 1}0)` }]}>
                      <feature.icon size={20} color="#8B5CF6" />
                    </View>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                  </View>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Achievements */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Star size={24} color="#F59E0B" />
              <Text style={styles.sectionTitle}>Key Achievements</Text>
            </View>
            
            <View style={styles.achievementsGrid}>
              {achievements.map((achievement, index) => (
                <View key={index} style={styles.achievementCard}>
                  <LinearGradient
                    colors={['rgba(245, 158, 11, 0.1)', 'rgba(245, 158, 11, 0.05)']}
                    style={styles.achievementGradient}
                  >
                    <View style={styles.achievementIcon}>
                      <achievement.icon size={24} color="#F59E0B" />
                    </View>
                    <Text style={styles.achievementValue}>{achievement.value}</Text>
                    <Text style={styles.achievementLabel}>{achievement.label}</Text>
                  </LinearGradient>
                </View>
              ))}
            </View>
          </View>

          {/* Vision */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <TrendingUp size={24} color="#10B981" />
              <Text style={styles.sectionTitle}>Our Vision</Text>
            </View>
            
            <View style={styles.visionCard}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.05)']}
                style={styles.visionGradient}
              >
                <Text style={styles.visionText}>
                  To democratize professional-grade sports analytics by making advanced AI predictions 
                  and real-time market intelligence accessible to every sports enthusiast. We&apos;re building 
                  the future where data-driven insights level the playing field between casual fans 
                  and professional analysts.
                </Text>
              </LinearGradient>
            </View>
          </View>

          {/* App Info */}
          <View style={styles.appInfoContainer}>
            <View style={styles.appInfoRow}>
              <Text style={styles.appInfoLabel}>Version</Text>
              <Text style={styles.appInfoValue}>1.0.0</Text>
            </View>
            <View style={styles.appInfoRow}>
              <Text style={styles.appInfoLabel}>Build</Text>
              <Text style={styles.appInfoValue}>Production</Text>
            </View>
            <View style={styles.appInfoRow}>
              <Text style={styles.appInfoLabel}>Platform</Text>
              <Text style={styles.appInfoValue}>iOS • React Native</Text>
            </View>
          </View>

                     {/* Footer */}
           <View style={styles.footer}>
             <Text style={styles.copyrightText}>© 2025 Predictive Play Inc.</Text>
             <Text style={styles.taglineText}>
               Powered by AI. Built by Professionals. Trusted by Winners.
             </Text>
           </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#00E5FF',
    marginTop: 2,
    fontWeight: '600',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  section: {
    padding: 20,
    paddingTop: 0,
  },
  firstSection: {
    paddingTop: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  missionText: {
    fontSize: 18,
    color: '#E2E8F0',
    lineHeight: 26,
    textAlign: 'center',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  foundersContainer: {
    gap: 16,
  },
  founderCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  founderGradient: {
    padding: 20,
  },
  founderName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  founderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00E5FF',
    marginBottom: 12,
  },
  founderDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  techContainer: {
    gap: 12,
  },
  featureCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  featureDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 18,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  achievementGradient: {
    padding: 16,
    alignItems: 'center',
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  achievementValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  achievementLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '500',
  },
  visionCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  visionGradient: {
    padding: 20,
  },
  visionText: {
    fontSize: 16,
    color: '#E2E8F0',
    lineHeight: 24,
    textAlign: 'center',
  },
  appInfoContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    margin: 20,
    marginTop: 0,
    overflow: 'hidden',
  },
  appInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  appInfoLabel: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  appInfoValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  copyrightText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  taglineText: {
    fontSize: 16,
    color: '#00E5FF',
    fontWeight: '600',
    textAlign: 'center',
  },
}); 