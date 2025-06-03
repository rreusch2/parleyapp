import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert
} from 'react-native';
import { supabase } from '@/app/services/api/supabaseClient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

interface AdminGameFormProps {
  onSuccess?: () => void;
}

export default function AdminGameForm({ onSuccess }: AdminGameFormProps) {
  const [formData, setFormData] = useState({
    sport: 'MLB',
    league: 'MLB',
    home_team: '',
    away_team: '',
    start_time: new Date(),
    status: 'scheduled',
    venue: '',
    city: '',
    home_score: '',
    away_score: '',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const sportOptions = ['MLB', 'NBA', 'NHL', 'NFL'];
  const statusOptions = ['scheduled', 'live', 'completed', 'postponed', 'cancelled'];

  const handleSubmit = async () => {
    try {
      const gameData = {
        external_event_id: `manual_${Date.now()}`,
        sport: formData.sport,
        league: formData.league,
        home_team: formData.home_team,
        away_team: formData.away_team,
        start_time: formData.start_time.toISOString(),
        status: formData.status,
        odds: {},
        stats: {
          venue: formData.venue,
          city: formData.city,
          home_score: formData.home_score ? parseInt(formData.home_score) : null,
          away_score: formData.away_score ? parseInt(formData.away_score) : null,
          status_detail: formData.status
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('sports_events')
        .insert(gameData);

      if (error) throw error;

      Alert.alert('Success', 'Game added successfully!');
      
      // Reset form
      setFormData({
        sport: 'MLB',
        league: 'MLB',
        home_team: '',
        away_team: '',
        start_time: new Date(),
        status: 'scheduled',
        venue: '',
        city: '',
        home_score: '',
        away_score: '',
      });

      if (onSuccess) onSuccess();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add game');
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDateTime = new Date(formData.start_time);
      newDateTime.setFullYear(selectedDate.getFullYear());
      newDateTime.setMonth(selectedDate.getMonth());
      newDateTime.setDate(selectedDate.getDate());
      setFormData({ ...formData, start_time: newDateTime });
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDateTime = new Date(formData.start_time);
      newDateTime.setHours(selectedTime.getHours());
      newDateTime.setMinutes(selectedTime.getMinutes());
      setFormData({ ...formData, start_time: newDateTime });
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Add New Game</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Sport</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={formData.sport}
            onValueChange={(value) => setFormData({ ...formData, sport: value, league: value })}
            style={styles.picker}
          >
            {sportOptions.map((sport) => (
              <Picker.Item key={sport} label={sport} value={sport} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Status</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
            style={styles.picker}
          >
            {statusOptions.map((status) => (
              <Picker.Item key={status} label={status} value={status} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Home Team</Text>
        <TextInput
          style={styles.input}
          value={formData.home_team}
          onChangeText={(text) => setFormData({ ...formData, home_team: text })}
          placeholder="Enter home team"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Away Team</Text>
        <TextInput
          style={styles.input}
          value={formData.away_team}
          onChangeText={(text) => setFormData({ ...formData, away_team: text })}
          placeholder="Enter away team"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Date & Time</Text>
        <View style={styles.dateTimeContainer}>
          <TouchableOpacity 
            style={styles.dateTimeButton} 
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateTimeButtonText}>
              {formData.start_time.toLocaleDateString()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dateTimeButton} 
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.dateTimeButtonText}>
              {formData.start_time.toLocaleTimeString()}
            </Text>
          </TouchableOpacity>
        </View>
        {(showDatePicker || showTimePicker) && (
          <DateTimePicker
            value={formData.start_time}
            mode={showDatePicker ? 'date' : 'time'}
            is24Hour={true}
            onChange={showDatePicker ? onDateChange : onTimeChange}
          />
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Venue</Text>
        <TextInput
          style={styles.input}
          value={formData.venue}
          onChangeText={(text) => setFormData({ ...formData, venue: text })}
          placeholder="Enter venue"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          value={formData.city}
          onChangeText={(text) => setFormData({ ...formData, city: text })}
          placeholder="Enter city"
          placeholderTextColor="#666"
        />
      </View>

      {formData.status !== 'scheduled' && (
        <>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Home Score</Text>
            <TextInput
              style={styles.input}
              value={formData.home_score}
              onChangeText={(text) => setFormData({ ...formData, home_score: text })}
              placeholder="Enter home score"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Away Score</Text>
            <TextInput
              style={styles.input}
              value={formData.away_score}
              onChangeText={(text) => setFormData({ ...formData, away_score: text })}
              placeholder="Enter away score"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>
        </>
      )}

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Add Game</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#111827',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  pickerContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    color: '#FFFFFF',
    height: 50,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dateTimeButton: {
    flex: 1,
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dateTimeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#00E5FF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 