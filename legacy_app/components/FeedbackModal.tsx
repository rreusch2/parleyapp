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
  MessageSquare,
  Star,
  Lightbulb,
  Bug,
  Palette,
  Brain,
  Send,
  Heart
} from 'lucide-react-native';
import { supabase } from '@/app/services/api/supabaseClient';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

const FEEDBACK_TYPES = [
  { 
    value: 'general', 
    label: 'General Feedback', 
    icon: MessageSquare,
    description: 'Share your overall experience with the app'
  },
  { 
    value: 'feature_request', 
    label: 'Feature Request', 
    icon: Lightbulb,
    description: 'Suggest new features or improvements'
  },
  { 
    value: 'ai_suggestion', 
    label: 'AI Features', 
    icon: Brain,
    description: 'Ideas for AI predictions and analysis'
  },
  { 
    value: 'bug_report', 
    label: 'Bug Report', 
    icon: Bug,
    description: 'Report issues or problems you\'ve encountered'
  },
  { 
    value: 'ui_improvement', 
    label: 'UI/UX Ideas', 
    icon: Palette,
    description: 'Suggestions for design and user experience'
  },
];

export default function FeedbackModal({ visible, onClose }: FeedbackModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    feedbackType: 'general',
    message: '',
  });

  const handleSubmitFeedback = async () => {
    if (!formData.email || !formData.message) {
      Alert.alert('Error', 'Please fill in your email and feedback message');
      return;
    }

    if (!selectedRating) {
      Alert.alert('Error', 'Please rate your experience');
      return;
    }

    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('feedback')
        .insert({
          user_id: user?.id,
          email: formData.email,
          feedback_type: formData.feedbackType,
          message: formData.message,
          rating: selectedRating,
        });

      if (error) throw error;

      Alert.alert(
        'Feedback Sent! 🙏',
        'Thank you for helping us improve Predictive Play! Your feedback is incredibly valuable to us.',
        [{ text: 'You\'re Welcome!', onPress: onClose }]
      );
      
      // Reset form
      setFormData({ email: '', feedbackType: 'general', message: '' });
      setSelectedRating(null);
      
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send feedback');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedType = () => FEEDBACK_TYPES.find(type => type.value === formData.feedbackType);

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
                <Heart size={24} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Send Feedback</Text>
                <Text style={styles.headerSubtitle}>Help us improve Predictive Play</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.feedbackContainer}>
            <Text style={styles.sectionTitle}>How would you rate your experience?</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <TouchableOpacity
                  key={rating}
                  style={styles.starButton}
                  onPress={() => setSelectedRating(rating)}
                >
                  <Star
                    size={32}
                    color={selectedRating && rating <= selectedRating ? '#F59E0B' : '#374151'}
                    fill={selectedRating && rating <= selectedRating ? '#F59E0B' : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingText}>
              {selectedRating ? `${selectedRating} out of 5 stars` : 'Tap to rate'}
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
                <Text style={styles.inputLabel}>Feedback Type</Text>
                <View style={styles.typeContainer}>
                  {FEEDBACK_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeCard,
                        formData.feedbackType === type.value && styles.selectedTypeCard
                      ]}
                      onPress={() => setFormData({ ...formData, feedbackType: type.value })}
                    >
                      <View style={[
                        styles.typeIcon,
                        formData.feedbackType === type.value && styles.selectedTypeIcon
                      ]}>
                        <type.icon 
                          size={20} 
                          color={formData.feedbackType === type.value ? '#00E5FF' : '#6B7280'} 
                        />
                      </View>
                      <View style={styles.typeContent}>
                        <Text style={[
                          styles.typeTitle,
                          formData.feedbackType === type.value && styles.selectedTypeTitle
                        ]}>
                          {type.label}
                        </Text>
                        <Text style={[
                          styles.typeDescription,
                          formData.feedbackType === type.value && styles.selectedTypeDescription
                        ]}>
                          {type.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Your Feedback</Text>
                <Text style={styles.inputHint}>
                  {getSelectedType()?.value === 'ai_suggestion' && 
                    'Tell us about AI features you\'d love to see! Better predictions, new analysis tools, smarter insights?'
                  }
                  {getSelectedType()?.value === 'feature_request' && 
                    'What features would make Predictive Play even better for you?'
                  }
                  {getSelectedType()?.value === 'ui_improvement' && 
                    'How can we improve the design and user experience?'
                  }
                  {getSelectedType()?.value === 'bug_report' && 
                    'Please describe the issue you encountered and when it happened.'
                  }
                  {getSelectedType()?.value === 'general' && 
                    'Share your thoughts about Predictive Play - what you love, what could be better, or any ideas you have!'
                  }
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="We'd love to hear your thoughts..."
                  placeholderTextColor="#6B7280"
                  value={formData.message}
                  onChangeText={(text) => setFormData({ ...formData, message: text })}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSubmitFeedback}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  style={styles.submitGradient}
                >
                  <Send size={20} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>
                    {loading ? 'Sending Feedback...' : 'Send Feedback'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.appreciationCard}>
                <LinearGradient
                  colors={['rgba(245, 158, 11, 0.1)', 'rgba(245, 158, 11, 0.05)']}
                  style={styles.appreciationGradient}
                >
                  <Heart size={20} color="#F59E0B" />
                  <Text style={styles.appreciationText}>
                    Your feedback helps us build a better experience for all users. Thank you for taking the time to share your thoughts!
                  </Text>
                </LinearGradient>
              </View>
            </View>
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
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
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
  feedbackContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
  },
  formContainer: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inputHint: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
    fontStyle: 'italic',
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
    height: 140,
  },
  typeContainer: {
    gap: 8,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectedTypeCard: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderColor: '#00E5FF',
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedTypeIcon: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
  },
  typeContent: {
    flex: 1,
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  selectedTypeTitle: {
    color: '#00E5FF',
  },
  typeDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 18,
  },
  selectedTypeDescription: {
    color: '#94A3B8',
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
  appreciationCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
  },
  appreciationGradient: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  appreciationText: {
    flex: 1,
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
}); 