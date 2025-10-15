import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Send,
  MessageCircle,
  Star,
  Settings,
  CreditCard,
  Zap
} from 'lucide-react-native';
import { supabase } from '@/app/services/api/supabaseClient';

interface HelpCenterModalProps {
  visible: boolean;
  onClose: () => void;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  icon: any;
}

const FAQS: FAQ[] = [
  {
    id: '1',
    question: 'How do AI predictions work?',
    answer: 'Our AI analyzes thousands of data points including team performance, player stats, weather conditions, and historical matchups to generate high-confidence predictions. The AI considers real-time factors and market movements to provide you with the most accurate picks.',
    category: 'AI Features',
    icon: Zap
  },
  {
    id: '2',
    question: 'What\'s the difference between Free and Pro?',
    answer: 'Free users get 2 AI picks per day and basic insights. Pro members get unlimited picks, advanced analytics, live AI chat, priority alerts, multi-book odds comparison, and exclusive research content.',
    category: 'Subscription',
    icon: Star
  },
  {
    id: '3',
    question: 'How do I upgrade to Pro?',
    answer: 'Tap on your profile in Settings, then tap "Subscription" to see Pro plans. You can choose monthly, yearly, or lifetime options. All subscriptions include a free trial period.',
    category: 'Subscription',
    icon: CreditCard
  },
  {
    id: '4',
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes! You can cancel your Pro subscription at any time through your device\'s App Store settings. You\'ll continue to have Pro access until the end of your billing period.',
    category: 'Subscription',
    icon: Settings
  },
  {
    id: '5',
    question: 'How accurate are the AI predictions?',
    answer: 'Our AI maintains a 67%+ win rate across all sports. Individual prediction confidence scores help you identify the highest-value picks. Results may vary based on market conditions and unforeseen events.',
    category: 'AI Features',
    icon: Zap
  },
  {
    id: '6',
    question: 'What sports are supported?',
    answer: 'We currently support NFL, NBA, MLB, NHL, and major soccer leagues. We\'re constantly adding new sports and leagues based on user demand.',
    category: 'General',
    icon: MessageCircle
  },
];

const SUPPORT_CATEGORIES = [
  { value: 'technical', label: 'Technical Issue' },
  { value: 'billing', label: 'Billing & Subscription' },
  { value: 'account', label: 'Account Help' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
];

export default function HelpCenterModal({ visible, onClose }: HelpCenterModalProps) {
  const [activeTab, setActiveTab] = useState<'faq' | 'contact'>('faq');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Contact form state
  const [formData, setFormData] = useState({
    email: '',
    subject: '',
    message: '',
    category: 'technical'
  });

  const handleSubmitSupport = async () => {
    if (!formData.email || !formData.subject || !formData.message) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('support_requests')
        .insert({
          user_id: user?.id,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
          category: formData.category,
        });

      if (error) throw error;

      Alert.alert(
        'Support Request Sent! 🎯',
        'We\'ve received your request and will get back to you within 24 hours.',
        [{ text: 'OK', onPress: onClose }]
      );
      
      // Reset form
      setFormData({ email: '', subject: '', message: '', category: 'technical' });
      
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send support request');
    } finally {
      setLoading(false);
    }
  };

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  const categoryFaqs = (category: string) => FAQS.filter(faq => faq.category === category);
  const categories = [...new Set(FAQS.map(faq => faq.category))];

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
              <View style={styles.iconContainer}>
                <HelpCircle size={24} color="#00E5FF" />
              </View>
              <Text style={styles.headerTitle}>Help Center</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'faq' && styles.activeTab]}
              onPress={() => setActiveTab('faq')}
            >
              <Text style={[styles.tabText, activeTab === 'faq' && styles.activeTabText]}>
                FAQs
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'contact' && styles.activeTab]}
              onPress={() => setActiveTab('contact')}
            >
              <Text style={[styles.tabText, activeTab === 'contact' && styles.activeTabText]}>
                Contact Support
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'faq' ? (
            <View style={styles.faqContainer}>
              {categories.map((category) => (
                <View key={category} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  {categoryFaqs(category).map((faq) => (
                    <TouchableOpacity
                      key={faq.id}
                      style={styles.faqItem}
                      onPress={() => toggleFaq(faq.id)}
                    >
                      <View style={styles.faqHeader}>
                        <View style={styles.faqIconContainer}>
                          <faq.icon size={18} color="#00E5FF" />
                        </View>
                        <Text style={styles.faqQuestion}>{faq.question}</Text>
                        {expandedFaq === faq.id ? (
                          <ChevronDown size={20} color="#6B7280" />
                        ) : (
                          <ChevronRight size={20} color="#6B7280" />
                        )}
                      </View>
                      {expandedFaq === faq.id && (
                        <View style={styles.faqAnswer}>
                          <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.contactContainer}>
              <Text style={styles.contactTitle}>Get Help</Text>
              <Text style={styles.contactSubtitle}>
                Can&apos;t find what you&apos;re looking for? Send us a message and we&apos;ll get back to you within 24 hours.
              </Text>

              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="your.email@example.com"
                    placeholderTextColor="#6B7280"
                    value={formData.email}
                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Category</Text>
                  <View style={styles.pickerContainer}>
                    {SUPPORT_CATEGORIES.map((category) => (
                      <TouchableOpacity
                        key={category.value}
                        style={[
                          styles.categoryChip,
                          formData.category === category.value && styles.selectedCategoryChip
                        ]}
                        onPress={() => setFormData({ ...formData, category: category.value })}
                      >
                        <Text style={[
                          styles.categoryChipText,
                          formData.category === category.value && styles.selectedCategoryChipText
                        ]}>
                          {category.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Subject</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Brief description of your issue"
                    placeholderTextColor="#6B7280"
                    value={formData.subject}
                    onChangeText={(text) => setFormData({ ...formData, subject: text })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Message</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Please describe your issue in detail..."
                    placeholderTextColor="#6B7280"
                    value={formData.message}
                    onChangeText={(text) => setFormData({ ...formData, message: text })}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                  onPress={handleSubmitSupport}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#00E5FF', '#0891B2']}
                    style={styles.submitGradient}
                  >
                    <Send size={20} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>
                      {loading ? 'Sending...' : 'Send Support Request'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    paddingBottom: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeTabText: {
    color: '#00E5FF',
  },
  content: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  faqContainer: {
    padding: 20,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  faqItem: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  faqIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  faqAnswer: {
    paddingHorizontal: 60,
    paddingBottom: 16,
  },
  faqAnswerText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94A3B8',
  },
  contactContainer: {
    padding: 20,
  },
  contactTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  contactSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    lineHeight: 22,
    marginBottom: 24,
  },
  formContainer: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
  },
  textArea: {
    height: 120,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectedCategoryChip: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    borderColor: '#00E5FF',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
  },
  selectedCategoryChipText: {
    color: '#00E5FF',
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
}); 