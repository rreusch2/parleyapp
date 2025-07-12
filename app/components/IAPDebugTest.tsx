import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import inAppPurchaseService from '../services/inAppPurchases';

export default function IAPDebugTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  const testInitialization = async () => {
    try {
      addLog('🚀 Testing IAP initialization...');
      await inAppPurchaseService.initialize();
      setIsInitialized(true);
      addLog('✅ IAP initialized successfully!');
      
      const products = await inAppPurchaseService.getAvailableSubscriptions();
      addLog(`📦 Found ${products.length} products`);
      products.forEach(product => {
        addLog(`- ${product.productId}: ${product.localizedPrice || product.price}`);
      });
      
    } catch (error) {
      addLog(`❌ IAP initialization failed: ${error}`);
      Alert.alert('IAP Test Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const testPurchase = async () => {
    if (!isInitialized) {
      Alert.alert('Error', 'Please initialize IAP first');
      return;
    }

    try {
      addLog('🛒 Testing purchase flow...');
      const result = await inAppPurchaseService.purchaseSubscription('com.parleyapp.premiumyearly');
      addLog(`✅ Purchase result: ${JSON.stringify(result)}`);
    } catch (error) {
      addLog(`❌ Purchase failed: ${error}`);
    }
  };

  const clearLogs = () => setLogs([]);

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#f5f5f5' }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
        IAP Debug Test
      </Text>
      
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <TouchableOpacity
          onPress={testInitialization}
          style={{
            backgroundColor: '#007AFF',
            padding: 12,
            borderRadius: 8,
            flex: 1,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
            Test Init
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={testPurchase}
          style={{
            backgroundColor: isInitialized ? '#34C759' : '#999',
            padding: 12,
            borderRadius: 8,
            flex: 1,
          }}
          disabled={!isInitialized}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
            Test Purchase
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={clearLogs}
          style={{
            backgroundColor: '#FF3B30',
            padding: 12,
            borderRadius: 8,
            flex: 1,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
            Clear
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={{ 
          flex: 1, 
          backgroundColor: '#000', 
          padding: 10, 
          borderRadius: 8 
        }}
        showsVerticalScrollIndicator={true}
      >
        {logs.map((log, index) => (
          <Text 
            key={index} 
            style={{ 
              color: log.includes('❌') ? '#FF6B6B' : 
                     log.includes('✅') ? '#51CF66' : 
                     log.includes('🔥') ? '#FFD43B' : '#FFF',
              fontFamily: 'monospace',
              fontSize: 12,
              marginBottom: 2
            }}
          >
            {log}
          </Text>
        ))}
      </ScrollView>
      
      <Text style={{ 
        marginTop: 10, 
        textAlign: 'center', 
        color: '#666',
        fontSize: 12 
      }}>
        Status: {isInitialized ? '✅ Ready' : '⏳ Not initialized'}
      </Text>
    </View>
  );
}
