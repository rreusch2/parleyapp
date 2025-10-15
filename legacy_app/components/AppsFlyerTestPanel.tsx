import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TestTube, Play, CheckCircle, XCircle, Target, TrendingUp } from 'lucide-react-native';
import appsFlyerService from '../services/appsFlyerService';

interface TestResult {
  test: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  timestamp: Date;
}

export default function AppsFlyerTestPanel() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [customEventName, setCustomEventName] = useState('');
  const [customEventValue, setCustomEventValue] = useState('');

  const addTestResult = (test: string, status: 'success' | 'error', message: string) => {
    setTestResults(prev => [...prev, {
      test,
      status,
      message,
      timestamp: new Date()
    }]);
  };

  const runBasicTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      // Test 1: Get AppsFlyer ID
      addTestResult('Getting AppsFlyer ID', 'pending', 'Fetching unique device ID...');
      try {
        const appsFlyerId = await appsFlyerService.getAppsFlyerId();
        if (appsFlyerId) {
          addTestResult('Get AppsFlyer ID', 'success', `ID: ${appsFlyerId.substring(0, 8)}...`);
        } else {
          addTestResult('Get AppsFlyer ID', 'error', 'No ID returned');
        }
      } catch (error) {
        addTestResult('Get AppsFlyer ID', 'error', `Error: ${error}`);
      }

      // Test 2: Track signup event
      addTestResult('Track Signup Event', 'pending', 'Sending signup event...');
      try {
        await appsFlyerService.trackSignup('test');
        addTestResult('Track Signup Event', 'success', 'Signup event sent successfully');
      } catch (error) {
        addTestResult('Track Signup Event', 'error', `Error: ${error}`);
      }

      // Test 3: Track subscription event
      addTestResult('Track Subscription Event', 'pending', 'Sending subscription event...');
      try {
        await appsFlyerService.trackSubscription('monthly', 19.99);
        addTestResult('Track Subscription Event', 'success', 'Subscription event sent successfully');
      } catch (error) {
        addTestResult('Track Subscription Event', 'error', `Error: ${error}`);
      }

      // Test 4: Track prediction view
      addTestResult('Track Prediction View', 'pending', 'Sending prediction view event...');
      try {
        await appsFlyerService.trackPredictionView();
        addTestResult('Track Prediction View', 'success', 'Prediction view event sent successfully');
      } catch (error) {
        addTestResult('Track Prediction View', 'error', `Error: ${error}`);
      }

      // Test 5: Track custom event
      addTestResult('Track Custom Event', 'pending', 'Sending custom test event...');
      try {
        await appsFlyerService.trackEvent('test_event', {
          test_parameter: 'test_value',
          timestamp: new Date().toISOString(),
        });
        addTestResult('Track Custom Event', 'success', 'Custom event sent successfully');
      } catch (error) {
        addTestResult('Track Custom Event', 'error', `Error: ${error}`);
      }

    } finally {
      setIsRunning(false);
    }
  };

  const trackCustomEvent = async () => {
    if (!customEventName.trim()) {
      Alert.alert('Error', 'Please enter an event name');
      return;
    }

    try {
      const eventValues = customEventValue.trim() 
        ? { custom_value: customEventValue, timestamp: new Date().toISOString() }
        : { timestamp: new Date().toISOString() };

      await appsFlyerService.trackEvent(customEventName, eventValues);
      addTestResult('Custom Event', 'success', `Event "${customEventName}" sent successfully`);
      setCustomEventName('');
      setCustomEventValue('');
    } catch (error) {
      addTestResult('Custom Event', 'error', `Error: ${error}`);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getStatusIcon = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} color="#10B981" />;
      case 'error':
        return <XCircle size={16} color="#EF4444" />;
      case 'pending':
        return <TestTube size={16} color="#F59E0B" />;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={['#1F2937', '#111827']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Target size={24} color="#3B82F6" />
          <Text style={styles.headerTitle}>AppsFlyer Testing Panel</Text>
          <Text style={styles.headerSubtitle}>Test TikTok ads attribution & events</Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Basic Tests Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Integration Tests</Text>
          <TouchableOpacity
            style={[styles.button, isRunning && styles.buttonDisabled]}
            onPress={runBasicTests}
            disabled={isRunning}
          >
            <Play size={20} color="white" />
            <Text style={styles.buttonText}>
              {isRunning ? 'Running Tests...' : 'Run All Tests'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Custom Event Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Event Testing</Text>
          <TextInput
            style={styles.input}
            placeholder="Event name (e.g., button_click)"
            placeholderTextColor="#6B7280"
            value={customEventName}
            onChangeText={setCustomEventName}
          />
          <TextInput
            style={styles.input}
            placeholder="Event value (optional)"
            placeholderTextColor="#6B7280"
            value={customEventValue}
            onChangeText={setCustomEventValue}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={trackCustomEvent}
          >
            <TrendingUp size={20} color="white" />
            <Text style={styles.buttonText}>Send Custom Event</Text>
          </TouchableOpacity>
        </View>

        {/* Results Section */}
        {testResults.length > 0 && (
          <View style={styles.section}>
            <View style={styles.resultsHeader}>
              <Text style={styles.sectionTitle}>Test Results</Text>
              <TouchableOpacity onPress={clearResults} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
            
            {testResults.map((result, index) => (
              <View key={index} style={styles.resultItem}>
                <View style={styles.resultHeader}>
                  {getStatusIcon(result.status)}
                  <Text style={styles.resultTest}>{result.test}</Text>
                  <Text style={styles.resultTime}>
                    {result.timestamp.toLocaleTimeString()}
                  </Text>
                </View>
                <Text style={styles.resultMessage}>{result.message}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Instructions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Testing Instructions</Text>
          <View style={styles.instructionsList}>
            <Text style={styles.instruction}>
              1. Run basic tests to verify AppsFlyer integration
            </Text>
            <Text style={styles.instruction}>
              2. Check AppsFlyer dashboard for incoming events
            </Text>
            <Text style={styles.instruction}>
              3. Test custom events for specific user actions
            </Text>
            <Text style={styles.instruction}>
              4. Verify TikTok attribution data in AppsFlyer reports
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 10,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 5,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    padding: 15,
    borderRadius: 10,
    gap: 10,
  },
  buttonDisabled: {
    backgroundColor: '#6B7280',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 10,
    padding: 15,
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  clearButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  resultItem: {
    backgroundColor: '#1F2937',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 5,
  },
  resultTest: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  resultTime: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  resultMessage: {
    color: '#D1D5DB',
    fontSize: 14,
    marginLeft: 26,
  },
  instructionsList: {
    gap: 10,
  },
  instruction: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
  },
});
