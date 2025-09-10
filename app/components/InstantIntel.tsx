import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

interface QueryResult {
  success: boolean;
  answer?: string;
  error?: string;
  query: string;
  timestamp?: string;
  cached?: boolean;
}

interface InstantIntelProps {
  apiUrl?: string;
}

export default function InstantIntel({ apiUrl = 'http://localhost:5001' }: InstantIntelProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const querySuggestions = {
    'Player Stats': [
      'Aaron Judge home runs this season',
      'Bryce Harper batting average',
      'Caitlin Clark assists per game',
      'A\'ja Wilson points this season',
    ],
    'Team Records': [
      'Yankees record this season',
      'Dodgers home record 2024',
      'Las Vegas Aces road record',
    ],
    'League Leaders': [
      'Who has the most home runs in MLB',
      'WNBA scoring leaders this season',
    ]
  };

  const quickActions = [
    { icon: 'american-football-outline' as const, text: 'NFL Leaders', query: 'NFL passing yards leaders this season' },
    { icon: 'football-outline' as const, text: 'NFL Stats', query: 'NFL rushing touchdowns leaders' },
    { icon: 'baseball-outline' as const, text: 'MLB Leaders', query: 'MLB home run leaders this season' },
    { icon: 'basketball-outline' as const, text: 'WNBA Stats', query: 'WNBA scoring leaders' },
    { icon: 'trophy-outline' as const, text: 'Team Records', query: 'best NFL records this season' },
    { icon: 'stats-chart-outline' as const, text: 'Recent Stats', query: 'best batting averages last 7 days' },
  ];

  useEffect(() => {
    loadRecentQueries();
  }, []);

  useEffect(() => {
    if (result) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [result]);

  const loadRecentQueries = async () => {
    try {
      const stored = await AsyncStorage.getItem('instantIntel_recentQueries');
      if (stored) setRecentQueries(JSON.parse(stored));
    } catch (error) {
      console.log('Error loading recent queries:', error);
    }
  };

  const saveRecentQuery = async (query: string) => {
    try {
      const updated = [query, ...recentQueries.filter(q => q !== query)].slice(0, 5);
      setRecentQueries(updated);
      await AsyncStorage.setItem('instantIntel_recentQueries', JSON.stringify(updated));
    } catch (error) {
      console.log('Error saving recent query:', error);
    }
  };

  const executeQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    setLoading(true);
    setResult(null);
    fadeAnim.setValue(0);
    slideAnim.setValue(50);

    try {
      const response = await fetch(`${apiUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      });

      const data: QueryResult = await response.json();
      
      if (data.success && data.answer) {
        setResult(data);
        await saveRecentQuery(queryText);
      } else {
        setResult({
          success: false,
          error: data.error || 'No answer found. Try rephrasing your question.',
          query: queryText,
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'Connection failed. Please check your internet connection.',
        query: queryText,
      });
    } finally {
      setLoading(false);
      setShowSuggestions(false);
    }
  };

  const handleQuickAction = (actionQuery: string) => {
    setQuery(actionQuery);
    executeQuery(actionQuery);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    executeQuery(suggestion);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <LinearGradient
            colors={['#3B82F6', '#8B5CF6']}
            style={styles.iconGradient}
          >
            <Ionicons name="flash" size={20} color="white" />
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={styles.title}>Instant Intel</Text>
            <Text style={styles.subtitle}>Ask anything about sports stats</Text>
          </View>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ask about player stats, team records, or league leaders..."
            placeholderTextColor="#64748B"
            style={styles.textInput}
            onSubmitEditing={() => executeQuery(query)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {loading ? (
            <ActivityIndicator size="small" color="#00E5FF" />
          ) : (
            <TouchableOpacity
              onPress={() => executeQuery(query)}
              disabled={!query.trim()}
              style={styles.submitButton}
            >
              <Ionicons 
                name="arrow-forward-circle" 
                size={24} 
                color={query.trim() ? "#00E5FF" : "#64748B"} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Quick Actions */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActions}>
        {quickActions.map((action, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleQuickAction(action.query)}
            disabled={loading}
            style={styles.quickActionButton}
          >
            <LinearGradient
              colors={['#00E5FF', '#0891B2']}
              style={styles.quickActionGradient}
            >
              <Ionicons name={action.icon} size={20} color="white" />
              <Text style={styles.quickActionText}>{action.text}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Suggestions */}
      {showSuggestions && !result && !loading && (
        <View style={styles.suggestionsContainer}>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.suggestionsScroll}>
            {Object.entries(querySuggestions).map(([category, suggestions]) => (
              <View key={category} style={styles.suggestionCategory}>
                <Text style={styles.categoryTitle}>{category}</Text>
                {suggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleSuggestionSelect(suggestion)}
                    style={styles.suggestionButton}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Recent Queries */}
      {!showSuggestions && !result && !loading && recentQueries.length > 0 && (
        <View style={styles.recentContainer}>
          <Text style={styles.recentTitle}>Recent Searches</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recentQueries.map((recentQuery, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleSuggestionSelect(recentQuery)}
                style={styles.recentTag}
              >
                <Text style={styles.recentTagText}>
                  {recentQuery.length > 30 ? `${recentQuery.substring(0, 30)}...` : recentQuery}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text style={styles.loadingText}>Getting your sports intel...</Text>
        </View>
      )}

      {/* Results */}
      {result && (
        <Animated.View
          style={[
            styles.resultContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          {result.success ? (
            <View style={styles.successContainer}>
              <View style={styles.resultContent}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" style={styles.resultIcon} />
                <View style={styles.resultTextContainer}>
                  <Text style={styles.successText}>{result.answer}</Text>
                  {result.cached && (
                    <Text style={styles.cachedText}>⚡ Cached result</Text>
                  )}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <View style={styles.resultContent}>
                <Ionicons name="alert-circle" size={20} color="#EF4444" style={styles.resultIcon} />
                <View style={styles.resultTextContainer}>
                  <Text style={styles.errorText}>{result.error}</Text>
                  <Text style={styles.errorHint}>
                    Try asking about specific players, teams, or stats like "Aaron Judge home runs" or "Yankees record this season"
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconGradient: {
    borderRadius: 20,
    padding: 8,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  submitButton: {
    marginLeft: 8,
  },
  quickActions: {
    marginBottom: 16,
  },
  quickActionButton: {
    marginRight: 12,
  },
  quickActionGradient: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  quickActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  suggestionsContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  suggestionsScroll: {
    maxHeight: 256,
  },
  suggestionCategory: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00E5FF',
    marginBottom: 8,
  },
  suggestionButton: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  suggestionText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  recentContainer: {
    marginTop: 16,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  recentTag: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  recentTagText: {
    color: '#00E5FF',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  loadingText: {
    color: '#00E5FF',
    marginLeft: 12,
    fontWeight: '500',
  },
  resultContainer: {
    marginTop: 8,
  },
  successContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  resultContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  resultIcon: {
    marginRight: 12,
    marginTop: 4,
  },
  resultTextContainer: {
    flex: 1,
  },
  successText: {
    color: '#10B981',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 24,
  },
  cachedText: {
    color: '#10B981',
    fontSize: 12,
    marginTop: 8,
    opacity: 0.8,
  },
  errorText: {
    color: '#EF4444',
    fontWeight: '500',
    marginBottom: 8,
  },
  errorHint: {
    color: '#EF4444',
    fontSize: 14,
    opacity: 0.8,
  },
});
