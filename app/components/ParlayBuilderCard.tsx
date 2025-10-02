import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Shield, Target } from 'lucide-react-native';
import type { ParlayOptions } from '../services/api/aiService';

interface Props {
  onGenerate: (options: ParlayOptions) => void;
  isGenerating?: boolean;
}

export default function ParlayBuilderCard({ onGenerate, isGenerating }: Props) {
  const [legs, setLegs] = useState<number>(3);
  const [risk, setRisk] = useState<ParlayOptions['riskLevel']>('balanced');
  const [includeTeams, setIncludeTeams] = useState(true);
  const [includeProps, setIncludeProps] = useState(true);

  const legsOptions = [2,3,4,5,6];
  const riskOptions: ParlayOptions['riskLevel'][] = ['safe','balanced','risky'];

  const handleGenerate = () => {
    onGenerate({ legs, riskLevel: risk, includeTeams, includeProps });
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Sparkles size={18} color="#00E5FF" />
          <Text style={styles.title}>AI Parlay Builder</Text>
        </View>
        <View style={styles.badge}>
          <Shield size={12} color="#000" />
          <Text style={styles.badgeText}>Beta</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>Let Professor Lock craft a data-backed same-day parlay.</Text>

      {/* Legs selector */}
      <View style={styles.group}>
        <Text style={styles.groupLabel}>Legs</Text>
        <View style={styles.segmentRow}>
          {legsOptions.map(n => (
            <TouchableOpacity
              key={n}
              style={[styles.segment, legs === n && styles.segmentActive]}
              onPress={() => setLegs(n)}
            >
              <Text style={[styles.segmentText, legs === n && styles.segmentTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Risk selector */}
      <View style={styles.group}>
        <Text style={styles.groupLabel}>Risk</Text>
        <View style={styles.segmentRow}>
          {riskOptions.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.segment, risk === r && styles.segmentActive]}
              onPress={() => setRisk(r)}
            >
              <Text style={[styles.segmentText, risk === r && styles.segmentTextActive]}>{r.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Type toggles */}
      <View style={styles.group}>
        <Text style={styles.groupLabel}>Leg Types</Text>
        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.toggle, includeTeams && styles.toggleActive]}
            onPress={() => setIncludeTeams(v => !v)}
          >
            <Text style={[styles.toggleText, includeTeams && styles.toggleTextActive]}>Teams</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggle, includeProps && styles.toggleActive]}
            onPress={() => setIncludeProps(v => !v)}
          >
            <Text style={[styles.toggleText, includeProps && styles.toggleTextActive]}>Player Props</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Generate button */}
      <TouchableOpacity style={styles.cta} onPress={handleGenerate} disabled={isGenerating}>
        <LinearGradient colors={['#00E5FF', '#0EA5E9']} style={styles.ctaGradient}>
          <Target size={16} color="#000" />
          <Text style={styles.ctaText}>{isGenerating ? 'Generating…' : `Generate ${legs}-Leg Parlay`}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.2)',
    marginHorizontal: 16,
    marginTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  badgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94A3B8',
    marginTop: 8,
    marginBottom: 12,
  },
  group: {
    marginTop: 10,
  },
  groupLabel: {
    color: '#CBD5E1',
    marginBottom: 6,
    fontWeight: '600',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segment: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  segmentActive: {
    backgroundColor: 'rgba(0,229,255,0.15)',
    borderColor: '#00E5FF',
  },
  segmentText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 12,
  },
  segmentTextActive: {
    color: '#E5E7EB',
  },
  toggle: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleActive: {
    backgroundColor: 'rgba(0,229,255,0.15)',
    borderColor: '#00E5FF',
  },
  toggleText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 12,
  },
  toggleTextActive: {
    color: '#E5E7EB',
  },
  cta: {
    marginTop: 16,
  },
  ctaGradient: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaText: {
    color: '#000',
    fontWeight: '800',
  },
});
