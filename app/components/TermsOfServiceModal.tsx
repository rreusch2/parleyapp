import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Shield,
  FileText,
  AlertCircle,
  Clock,
  DollarSign,
  Users,
  Mail,
  Scale,
  Eye,
} from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TermsOfServiceModalProps {
  visible: boolean;
  onClose: () => void;
}

const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({
  visible,
  onClose,
}) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a2a6c', '#b21f1f']}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                <FileText size={32} color="#ffffff" />
              </View>
              <Text style={styles.headerTitle}>Terms of Service</Text>
              <Text style={styles.headerSubtitle}>
                Predictive Play - AI-Powered Sports Betting Predictions
              </Text>
              <Text style={styles.lastUpdated}>
                Last Updated: {currentDate}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Section 1: Acceptance */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Shield size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
              </View>
              <Text style={styles.sectionText}>
                By creating an account and using Predictive Play (&quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the Service.
              </Text>
              <Text style={styles.sectionText}>
                These Terms apply to all users of the Service, including free and premium subscribers.
              </Text>
            </View>

            {/* Section 2: Service Description */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Eye size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>2. Service Description</Text>
              </View>
              <Text style={styles.sectionText}>
                Predictive Play provides AI-powered sports betting predictions, analytics, and insights. Our Service includes:
              </Text>
              <View style={styles.bulletPoints}>
                <Text style={styles.bulletPoint}>&bull; AI-generated sports betting predictions and picks</Text>
                <Text style={styles.bulletPoint}>&bull; Advanced analytics and statistics</Text>
                <Text style={styles.bulletPoint}>&bull; Live injury reports and news</Text>
                <Text style={styles.bulletPoint}>&bull; Recurring trends analysis</Text>
                <Text style={styles.bulletPoint}>&bull; Real-time odds comparison</Text>
                <Text style={styles.bulletPoint}>&bull; AI chatbot for betting advice</Text>
              </View>
              <Text style={styles.disclaimer}>
                <AlertCircle size={16} color="#F59E0B" /> IMPORTANT: Predictive Play provides information and predictions for entertainment purposes only. We do not facilitate actual gambling or betting transactions.
              </Text>
            </View>

            {/* Section 3: User Accounts */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Users size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>3. User Accounts and Registration</Text>
              </View>
              <Text style={styles.sectionText}>
                To access certain features, you must create an account. You agree to:
              </Text>
              <View style={styles.bulletPoints}>
                <Text style={styles.bulletPoint}>&bull; Provide accurate and complete information</Text>
                <Text style={styles.bulletPoint}>&bull; Maintain the security of your account credentials</Text>
                <Text style={styles.bulletPoint}>&bull; Be at least 18 years old or the legal gambling age in your jurisdiction</Text>
                <Text style={styles.bulletPoint}>&bull; Use the Service only where legally permitted</Text>
                <Text style={styles.bulletPoint}>&bull; Not share your account with others</Text>
              </View>
              <Text style={styles.sectionText}>
                You are responsible for all activities that occur under your account.
              </Text>
            </View>

            {/* Section 4: Payment Terms */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <DollarSign size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>4. Payment and Subscription Terms</Text>
              </View>
              <Text style={styles.sectionText}>
                Predictive Play offers both free and premium subscription tiers:
              </Text>
              <View style={styles.bulletPoints}>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Free Tier:</Text> Limited daily picks and basic features</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Pro Day Pass:</Text> $4.99 (24-hour access, non-renewable)</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Weekly Pro:</Text> $9.99/week, auto-renewable</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Monthly Pro:</Text> $19.99/month, auto-renewable</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Yearly Pro:</Text> $149.99/year, auto-renewable (3-day free trial)</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Lifetime Pro:</Text> $399.99 one-time payment</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Weekly Elite:</Text> $14.99/week, auto-renewable</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Monthly Elite:</Text> $29.99/month, auto-renewable</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Yearly Elite:</Text> $199.99/year, auto-renewable (3-day free trial)</Text>
              </View>
              <Text style={styles.sectionText}>
                Subscription fees are charged through your app store account. Cancellation policies follow your platform&apos;s standard terms. No refunds for partial periods.
              </Text>
            </View>

            {/* Section 5: User Conduct */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Scale size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>5. User Conduct and Prohibited Uses</Text>
              </View>
              <Text style={styles.sectionText}>
                You agree not to:
              </Text>
              <View style={styles.bulletPoints}>
                <Text style={styles.bulletPoint}>&bull; Use the Service for illegal gambling where prohibited</Text>
                <Text style={styles.bulletPoint}>&bull; Reverse engineer or attempt to extract our algorithms</Text>
                <Text style={styles.bulletPoint}>&bull; Share, resell, or redistribute our predictions</Text>
                <Text style={styles.bulletPoint}>&bull; Use automated tools to scrape our content</Text>
                <Text style={styles.bulletPoint}>&bull; Harass other users or our support team</Text>
                <Text style={styles.bulletPoint}>&bull; Attempt to gain unauthorized access to our systems</Text>
              </View>
            </View>

            {/* Section 6: AI Predictions Disclaimer */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <AlertCircle size={20} color="#F59E0B" />
                <Text style={styles.sectionTitle}>6. AI Predictions and Disclaimers</Text>
              </View>
              <Text style={styles.disclaimer}>
                IMPORTANT DISCLAIMERS:
              </Text>
              <View style={styles.bulletPoints}>
                <Text style={styles.bulletPoint}>&bull; Our AI predictions are not guarantees of outcomes</Text>
                <Text style={styles.bulletPoint}>&bull; Past performance does not indicate future results</Text>
                <Text style={styles.bulletPoint}>&bull; Sports betting involves risk of financial loss</Text>
                <Text style={styles.bulletPoint}>&bull; Only bet what you can afford to lose</Text>
                <Text style={styles.bulletPoint}>&bull; Seek help if you have a gambling problem</Text>
              </View>
              <Text style={styles.warningText}>
                The Service is provided &quot;AS IS&quot; without warranties of any kind. We do not guarantee accuracy, completeness, or profitability of our predictions.
              </Text>
            </View>

            {/* Section 7: Limitation of Liability */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Shield size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
              </View>
              <Text style={styles.sectionText}>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW:
              </Text>
              <View style={styles.bulletPoints}>
                <Text style={styles.bulletPoint}>&bull; We are not liable for any betting losses</Text>
                <Text style={styles.bulletPoint}>&bull; Our total liability is limited to the amount you paid for the Service</Text>
                <Text style={styles.bulletPoint}>&bull; We are not responsible for third-party sportsbook actions</Text>
                <Text style={styles.bulletPoint}>&bull; We disclaim all warranties, express or implied</Text>
              </View>
            </View>

            {/* Section 8: Privacy */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Eye size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>8. Privacy Policy</Text>
              </View>
              <Text style={styles.sectionText}>
                Your privacy is important to us. Our Privacy Policy, which is incorporated into these Terms, describes how we collect, use, and protect your information.
              </Text>
              <Text style={styles.sectionText}>
                By using the Service, you consent to our data practices as described in our Privacy Policy.
              </Text>
            </View>

            {/* Section 9: Termination */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Clock size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>9. Termination</Text>
              </View>
              <Text style={styles.sectionText}>
                We may terminate or suspend your account immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
              </Text>
              <Text style={styles.sectionText}>
                You may terminate your account at any time by contacting our support team.
              </Text>
            </View>

            {/* Section 10: Changes to Terms */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FileText size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>10. Changes to Terms</Text>
              </View>
              <Text style={styles.sectionText}>
                We reserve the right to modify these Terms at any time. We will notify users of material changes via email or in-app notification.
              </Text>
              <Text style={styles.sectionText}>
                Continued use of the Service after changes constitutes acceptance of the new Terms.
              </Text>
            </View>

            {/* Section 11: Contact Information */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Mail size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>11. Contact Information</Text>
              </View>
              <Text style={styles.sectionText}>
                If you have questions about these Terms of Service, please contact us at:
              </Text>
              <View style={styles.contactInfo}>
                <Text style={styles.contactText}>Email: predictiveplay2025@gmail.com</Text>
                <Text style={styles.contactText}>Website: https://rreusch2.github.io/ppwebsite</Text>
              </View>
            </View>

            {/* Responsible Gambling */}
            <View style={styles.responsibleGambling}>
              <LinearGradient
                colors={['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0.1)']}
                style={styles.responsibleGamblingGradient}
              >
                <AlertCircle size={24} color="#EF4444" />
                <Text style={styles.responsibleGamblingTitle}>Responsible Gambling</Text>
                <Text style={styles.responsibleGamblingText}>
                  If you or someone you know has a gambling problem, please seek help:
                </Text>
                <Text style={styles.helplineText}>&bull; National Problem Gambling Helpline: 1-800-522-4700</Text>
                <Text style={styles.helplineText}>&bull; gamblingtherapy.org</Text>
                <Text style={styles.helplineText}>&bull; ncpgambling.org</Text>
              </LinearGradient>
            </View>

            <View style={styles.bottomSpacing} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.acceptButton} onPress={onClose}>
              <LinearGradient
                colors={['#ffffff', '#f0f0f0']}
                style={styles.acceptGradient}
              >
                <FileText size={20} color="#1a2a6c" />
                <Text style={styles.acceptText}>I Have Read the Terms</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    alignSelf: 'flex-end',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 10,
    flex: 1,
  },
  sectionText: {
    fontSize: 15,
    color: '#e0e0e0',
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletPoints: {
    marginVertical: 8,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#e0e0e0',
    lineHeight: 20,
    marginBottom: 4,
    paddingLeft: 8,
  },
  bold: {
    fontWeight: '700',
    color: '#ffffff',
  },
  disclaimer: {
    fontSize: 15,
    color: '#F59E0B',
    fontWeight: '600',
    marginTop: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
    marginTop: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  contactInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  contactText: {
    fontSize: 15,
    color: '#ffffff',
    marginBottom: 4,
    fontWeight: '500',
  },
  responsibleGambling: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  responsibleGamblingGradient: {
    padding: 20,
    alignItems: 'center',
  },
  responsibleGamblingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
  },
  responsibleGamblingText: {
    fontSize: 15,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  helplineText: {
    fontSize: 14,
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: 4,
  },
  bottomSpacing: {
    height: 40,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 16,
  },
  acceptButton: {
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  acceptText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a2a6c',
    marginLeft: 8,
  },
});

export default TermsOfServiceModal;