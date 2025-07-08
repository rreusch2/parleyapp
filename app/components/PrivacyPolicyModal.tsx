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
  Lock,
  User,
  Info,
  Eye,
  Database,
  Share2,
  Globe,
  Settings,
  Mail,
} from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  visible,
  onClose,
}) => {
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
                <Lock size={32} color="#ffffff" />
              </View>
              <Text style={styles.headerTitle}>Privacy Policy</Text>
              <Text style={styles.headerSubtitle}>
                Predictive Play - AI-Powered Sports Betting Predictions
              </Text>
              <Text style={styles.lastUpdated}>
                Last Updated: January 2025
              </Text>
            </View>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Introduction */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Info size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>Introduction</Text>
              </View>
              <Text style={styles.sectionText}>
                Predictive Play ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application Predictive Play ("the App"). This policy applies to all users of our AI-powered sports betting predictions service.
              </Text>
              <Text style={styles.sectionText}>
                <Text style={styles.bold}>By using Predictive Play, you consent to the data practices described in this Privacy Policy.</Text>
              </Text>
            </View>

            {/* Information We Collect */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Database size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>Information We Collect</Text>
              </View>
              
              <Text style={styles.subSectionTitle}>Personal Information You Provide</Text>
              <View style={styles.bulletPoints}>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Account Information</Text>: Email address, username, password (encrypted)</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Profile Data</Text>: Betting preferences, risk tolerance, bankroll information</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Subscription Information</Text>: Payment details processed by Apple/Google (we do not store payment information)</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Communication Data</Text>: Messages sent to our AI chatbot and support team</Text>
              </View>

              <Text style={styles.subSectionTitle}>Information Collected Automatically</Text>
              <View style={styles.bulletPoints}>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Usage Data</Text>: App interactions, features used, time spent in app</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Device Information</Text>: Device type, operating system, unique device identifiers</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Location Data</Text>: Approximate location for region-specific odds and legal compliance (when permitted)</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Performance Data</Text>: Crash reports, error logs, performance metrics</Text>
              </View>

              <Text style={styles.subSectionTitle}>AI and Analytics Data</Text>
              <View style={styles.bulletPoints}>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Prediction Interactions</Text>: How you interact with predictions and betting suggestions</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Betting Outcomes</Text>: Results of predictions you follow (if shared with us)</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Analytics</Text>: App usage patterns to improve our services</Text>
              </View>
            </View>

            {/* How We Use Your Information */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Settings size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>How We Use Your Information</Text>
              </View>
              <Text style={styles.sectionText}>
                We use the information we collect to:
              </Text>
              <View style={styles.bulletPoints}>
                <Text style={styles.bulletPoint}>&bull; Provide, maintain, and improve our services</Text>
                <Text style={styles.bulletPoint}>&bull; Process subscriptions and transactions</Text>
                <Text style={styles.bulletPoint}>&bull; Personalize your experience with tailored predictions</Text>
                <Text style={styles.bulletPoint}>&bull; Train and improve our AI prediction models</Text>
                <Text style={styles.bulletPoint}>&bull; Send important notifications about our services</Text>
                <Text style={styles.bulletPoint}>&bull; Respond to your comments and questions</Text>
                <Text style={styles.bulletPoint}>&bull; Analyze usage patterns to enhance our app</Text>
                <Text style={styles.bulletPoint}>&bull; Protect against fraudulent or unauthorized activity</Text>
              </View>
            </View>

            {/* Information Sharing and Disclosure */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Share2 size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>Information Sharing and Disclosure</Text>
              </View>
              <Text style={styles.sectionText}>
                We do not sell your personal information. We may share your information with:
              </Text>
              <View style={styles.bulletPoints}>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Service Providers</Text>: Third parties that help us deliver our services (e.g., cloud hosting, payment processors)</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Business Partners</Text>: For joint offerings you've opted into</Text>
                <Text style={styles.bulletPoint}>&bull; <Text style={styles.bold}>Affiliated Companies</Text>: Our parent company, subsidiaries, or affiliates</Text>
              </View>
              <Text style={styles.sectionText}>
                We may disclose your information when required by law, court order, or to:
              </Text>
              <View style={styles.bulletPoints}>
                <Text style={styles.bulletPoint}>&bull; Comply with legal obligations</Text>
                <Text style={styles.bulletPoint}>&bull; Protect our rights and property</Text>
                <Text style={styles.bulletPoint}>&bull; Prevent fraud or security threats</Text>
              </View>
            </View>

            {/* Your Choices and Rights */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <User size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>Your Choices and Rights</Text>
              </View>
              <Text style={styles.sectionText}>
                Depending on your location, you may have the right to:
              </Text>
              <View style={styles.bulletPoints}>
                <Text style={styles.bulletPoint}>&bull; Access the personal information we hold about you</Text>
                <Text style={styles.bulletPoint}>&bull; Correct inaccurate or incomplete information</Text>
                <Text style={styles.bulletPoint}>&bull; Delete your personal information</Text>
                <Text style={styles.bulletPoint}>&bull; Object to or restrict certain processing</Text>
                <Text style={styles.bulletPoint}>&bull; Export your data in a portable format</Text>
              </View>
              <Text style={styles.sectionText}>
                You can update your account information and preferences in the app's settings. To exercise other rights, please contact us at predictiveplay2025@gmail.com.
              </Text>
            </View>

            {/* Security */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Shield size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>Security</Text>
              </View>
              <Text style={styles.sectionText}>
                We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission or storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
              </Text>
            </View>

            {/* International Data Transfers */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Globe size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>International Data Transfers</Text>
              </View>
              <Text style={styles.sectionText}>
                Your information may be stored and processed in countries where we or our service providers maintain facilities. By using our app, you consent to the transfer of information to countries that may have different data protection rules than your country.
              </Text>
            </View>

            {/* Contact Us */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Mail size={20} color="#00E5FF" />
                <Text style={styles.sectionTitle}>Contact Us</Text>
              </View>
              <Text style={styles.sectionText}>
                If you have questions about this Privacy Policy or our data practices, please contact us at:
              </Text>
              <Text style={styles.sectionText}>
                Email: predictiveplay2025@gmail.com
              </Text>
            </View>
          </ScrollView>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e0e0e0',
    marginBottom: 8,
    textAlign: 'center',
  },
  lastUpdated: {
    fontSize: 14,
    color: '#b0b0b0',
    marginBottom: 16,
  },
  content: {
    flex: 1,
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 10,
  },
  subSectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 12,
    marginTop: 16,
  },
  sectionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#e0e0e0',
    marginBottom: 12,
  },
  bold: {
    fontWeight: '600',
    color: '#ffffff',
  },
  bulletPoints: {
    marginLeft: 8,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 16,
    lineHeight: 24,
    color: '#e0e0e0',
    marginBottom: 8,
  },
});

export default PrivacyPolicyModal;
