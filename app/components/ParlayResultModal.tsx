import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { ParlayLeg } from '../services/api/aiService';

interface Props {
  visible: boolean;
  markdown: string;
  legs?: ParlayLeg[];
  onClose: () => void;
}

export default function ParlayResultModal({ visible, markdown, legs = [], onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <LinearGradient colors={['#0b1220', '#111827']} style={styles.header}>
            <Text style={styles.headerTitle}>AI Parlay</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>

          {/* Headshots row (when available) */}
          {legs.some(l => !!l.headshot_url) && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.headshotsRow}>
              {legs.map((leg, idx) => (
                <View key={idx} style={styles.headshotItem}>
                  {leg.headshot_url ? (
                    <Image source={{ uri: leg.headshot_url }} style={styles.headshotImg} />
                  ) : (
                    <View style={[styles.headshotImg, styles.headshotPlaceholder]} />
                  )}
                  <Text numberOfLines={1} style={styles.headshotLabel}>
                    {leg.player_name || leg.team || leg.match}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
            <Markdown style={markdownStyles}>{markdown || '*No content returned*'}</Markdown>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const markdownStyles: any = {
  body: { color: '#FFFFFF', fontSize: 15, lineHeight: 24 },
  heading1: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 22, marginVertical: 12 },
  heading2: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 18, marginVertical: 10 },
  strong: { color: '#60A5FA' },
  code_block: { backgroundColor: 'rgba(255,255,255,0.06)', padding: 10, borderRadius: 6 },
  link: { color: '#60A5FA', textDecorationLine: 'underline' },
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: '#0b1220',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)'
  },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  closeBtn: { position: 'absolute', right: 10, top: 10, padding: 6 },
  headshotsRow: { paddingHorizontal: 12, paddingTop: 10 },
  headshotItem: { alignItems: 'center', marginRight: 12, width: 72 },
  headshotImg: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#111827' },
  headshotPlaceholder: { backgroundColor: 'rgba(148,163,184,0.2)' },
  headshotLabel: { marginTop: 6, color: '#CBD5E1', fontSize: 10, textAlign: 'center' },
  body: { paddingHorizontal: 16, paddingVertical: 12 },
});
