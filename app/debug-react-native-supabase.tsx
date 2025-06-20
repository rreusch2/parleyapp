import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { supabase } from '@/app/services/api/supabaseClient';

export default function DebugSupabaseRN() {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testProfilesTable = async () => {
    setLogs([]);
    addLog('🔍 Testing profiles table in React Native...');
    
    try {
      // Test 1: Check profiles table
      addLog('1. Checking profiles table access...');
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);
        
      if (profileError) {
        addLog(`❌ Profiles table error: ${profileError.message}`);
        return;
      } else {
        addLog(`✅ Profiles table accessible, count: ${profiles?.length || 0}`);
      }
      
      // Test 2: Try signup
      addLog('2. Testing signup...');
      const testEmail = `rn-test-${Date.now()}@test.com`;
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: 'test123456',
        options: { 
          data: { 
            username: `rn_user_${Date.now()}`,
          } 
        }
      });
      
      if (error) {
        addLog(`❌ RN Signup failed: ${error.message}`);
        addLog(`   Error status: ${error.status}`);
        addLog(`   Error details: ${JSON.stringify(error, null, 2)}`);
      } else {
        addLog(`✅ RN Signup successful! User ID: ${data?.user?.id}`);
        
        // Check if profile was created
        if (data?.user?.id) {
          addLog('3. Checking profile creation...');
          setTimeout(async () => {
            const { data: profile, error: profileCheckError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id);
              
            if (profileCheckError) {
              addLog(`❌ Profile check error: ${profileCheckError.message}`);
            } else if (profile && profile.length > 0) {
              addLog(`✅ Profile created: ${JSON.stringify(profile[0])}`);
            } else {
              addLog(`❌ No profile found for user`);
            }
          }, 1000);
        }
      }
      
    } catch (err: any) {
      addLog(`💥 Test error: ${err.message}`);
    }
  };

  const testSimpleSignup = async () => {
    setLogs([]);
    addLog('🚀 Testing simple signup (no metadata)...');
    
    try {
      const testEmail = `simple-${Date.now()}@test.com`;
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: 'test123456'
      });
      
      if (error) {
        addLog(`❌ Simple signup failed: ${error.message}`);
      } else {
        addLog(`✅ Simple signup successful! User ID: ${data?.user?.id}`);
      }
    } catch (err: any) {
      addLog(`💥 Simple signup error: ${err.message}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>React Native Supabase Debug</Text>
      
      <TouchableOpacity style={styles.button} onPress={testProfilesTable}>
        <Text style={styles.buttonText}>Test Profiles Table</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={testSimpleSignup}>
        <Text style={styles.buttonText}>Test Simple Signup</Text>
      </TouchableOpacity>
      
      <View style={styles.logsContainer}>
        <Text style={styles.logsTitle}>Logs:</Text>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  logsContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 5,
  },
  logsTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 5,
  },
}); 