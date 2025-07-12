import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Check, AlertCircle } from 'lucide-react-native';
import inAppPurchaseService from '../services/inAppPurchases';

interface TestIAPModalProps {
  visible: boolean;
  onClose: () => void;
}

const TestIAPModal: React.FC<TestIAPModalProps> = ({ visible, onClose }) => {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      runDiagnostics();
    }
  }, [visible]);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      await inAppPurchaseService.initialize();
      
      const subscriptions = inAppPurchaseService.getAllSubscriptions();
      
      const diagnosticsData = {
        platform: Platform.OS,
        initialized: true,
        subscriptionsCount: subscriptions.length,
        subscriptions: subscriptions.map(sub => ({
          id: sub.productId,
          title: sub.localizedTitle,
          price: sub.localizedPrice,
          currency: sub.currency,
          description: sub.localizedDescription?.substring(0, 50) + '...'
        })),
        expectedProducts: [
          'com.parleyapp.premium_monthly',
          'com.parleyapp.premiumyearly',
          'com.parleyapp.premium_lifetime'
        ]
      };
      
      setDiagnostics(diagnosticsData);
    } catch (error) {
      console.error('Diagnostics error:', error);
      setDiagnostics({
        error: error.message,
        initialized: false
      });
    } finally {
      setLoading(false);
    }
  };

  const testPurchase = async (productId: string) => {
    try {
      setLoading(true);
      
      Alert.alert(
        'Test Purchase',
        `This will start a REAL purchase for ${productId}. Make sure you're using a sandbox account!`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            onPress: async () => {
              try {
                await inAppPurchaseService.purchaseSubscription(productId);
                Alert.alert('Success', 'Purchase dialog should have appeared');
              } catch (error) {
                Alert.alert('Error', `Purchase failed: ${error.message}`);
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', `Test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <Text style={styles.title}>🧪 IAP Test Panel</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Running diagnostics...</Text>
              </View>
            )}

            {diagnostics && (
              <View style={styles.diagnosticsContainer}>
                <Text style={styles.sectionTitle}>📊 Diagnostics</Text>
                
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Platform:</Text>
                  <Text style={styles.statusValue}>{diagnostics.platform}</Text>
                </View>

                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Initialized:</Text>
                  <View style={styles.statusIndicator}>
                    {diagnostics.initialized ? (
                      <Check size={16} color="#10B981" />
                    ) : (
                      <AlertCircle size={16} color="#EF4444" />
                    )}
                    <Text style={[styles.statusValue, { 
                      color: diagnostics.initialized ? '#10B981' : '#EF4444' 
                    }]}>
                      {diagnostics.initialized ? 'YES' : 'NO'}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Products Found:</Text>
                  <Text style={styles.statusValue}>{diagnostics.subscriptionsCount || 0}</Text>
                </View>

                {diagnostics.subscriptions && diagnostics.subscriptions.length > 0 && (
                  <View style={styles.productsContainer}>
                    <Text style={styles.sectionTitle}>📦 Available Products</Text>
                    {diagnostics.subscriptions.map((product, index) => (
                      <View key={index} style={styles.productItem}>
                        <Text style={styles.productId}>{product.id}</Text>
                        <Text style={styles.productTitle}>{product.title}</Text>
                        <Text style={styles.productPrice}>{product.price}</Text>
                        <TouchableOpacity
                          style={styles.testButton}
                          onPress={() => testPurchase(product.id)}
                        >
                          <Text style={styles.testButtonText}>Test Purchase</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.expectedContainer}>
                  <Text style={styles.sectionTitle}>✅ Expected Products</Text>
                  {diagnostics.expectedProducts.map((productId, index) => (
                    <View key={index} style={styles.expectedItem}>
                      <Text style={styles.expectedId}>{productId}</Text>
                      <View style={styles.statusIndicator}>
                        {diagnostics.subscriptions?.some(sub => sub.id === productId) ? (
                          <Check size={16} color="#10B981" />
                        ) : (
                          <AlertCircle size={16} color="#EF4444" />
                        )}
                      </View>
                    </View>
                  ))}
                </View>

                {diagnostics.error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorTitle}>❌ Error</Text>
                    <Text style={styles.errorText}>{diagnostics.error}</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={runDiagnostics}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>Refresh Diagnostics</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => inAppPurchaseService.testBackendConnection()}
                disabled={loading}
              >
                <Text style={styles.actionButtonText}>Test Backend</Text>
              </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  diagnosticsContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productsContainer: {
    marginTop: 20,
  },
  productItem: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  productId: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: 'monospace',
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginVertical: 4,
  },
  productPrice: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  testButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  expectedContainer: {
    marginTop: 20,
  },
  expectedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expectedId: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: 'monospace',
  },
  errorContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#FCA5A5',
    lineHeight: 20,
  },
  actionButtons: {
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default TestIAPModal; 