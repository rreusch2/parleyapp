import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, X, Filter } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');

export interface SportOption {
  key: string;
  name: string;
  fullName: string;
  logoUrl: string;
  color: string;
}

const sportOptions: SportOption[] = [
  {
    key: 'ALL',
    name: 'ALL',
    fullName: 'All Sports',
    logoUrl: '', // No logo for "All"
    color: '#00E5FF',
  },
  {
    key: 'NFL',
    name: 'NFL',
    fullName: 'National Football League',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/National_Football_League_logo.svg/1200px-National_Football_League_logo.svg.png',
    color: '#2c5aa0',
  },
  {
    key: 'CFB',
    name: 'CFB',
    fullName: 'College Football',
    logoUrl: 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/cfb.png',
    color: '#dc2626',
  },
  {
    key: 'MLB',
    name: 'MLB',
    fullName: 'Major League Baseball',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Major_League_Baseball_logo.svg/1200px-Major_League_Baseball_logo.svg.png',
    color: '#059669',
  },
  {
    key: 'NHL',
    name: 'NHL',
    fullName: 'National Hockey League',
    logoUrl: 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/nhl.png',
    color: '#0891b2',
  },
  {
    key: 'NBA',
    name: 'NBA',
    fullName: 'National Basketball Association',
    logoUrl: 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/nba.png',
    color: '#dc2626',
  },
  {
    key: 'WNBA',
    name: 'WNBA',
    fullName: "Women's National Basketball Association",
    logoUrl: 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/wnba.png',
    color: '#7c3aed',
  },
  {
    key: 'UFC',
    name: 'UFC',
    fullName: 'Ultimate Fighting Championship',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/1200px-UFC_Logo.svg.png',
    color: '#ea580c',
  },
];

interface SportFilterDropdownProps {
  selectedSport: string;
  onSelectSport: (sportKey: string) => void;
  isElite?: boolean;
  theme?: any;
}

export default function SportFilterDropdown({
  selectedSport,
  onSelectSport,
  isElite = false,
  theme,
}: SportFilterDropdownProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = sportOptions.find(s => s.key === selectedSport) || sportOptions[0];
  const accentColor = isElite && theme?.accentPrimary ? theme.accentPrimary : '#00E5FF';

  const handleSelect = (sportKey: string) => {
    onSelectSport(sportKey);
    setModalVisible(false);
  };

  return (
    <>
      {/* Filter Button */}
      <TouchableOpacity
        style={[styles.filterButton, isElite && { borderColor: accentColor }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <View style={styles.filterButtonContent}>
          {selectedOption.key !== 'ALL' && selectedOption.logoUrl ? (
            <Image 
              source={{ uri: selectedOption.logoUrl }}
              style={styles.buttonLogo}
              resizeMode="contain"
            />
          ) : (
            <Filter size={18} color={accentColor} />
          )}
          <Text style={[styles.filterButtonText, isElite && { color: accentColor }]}>
            {selectedOption.name}
          </Text>
          <ChevronDown size={16} color={accentColor} />
        </View>
        {selectedOption.key !== 'ALL' && (
          <View style={[styles.activeIndicator, { backgroundColor: selectedOption.color }]} />
        )}
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <LinearGradient
              colors={isElite ? (theme?.headerGradient || ['#1a1a2e', '#16213e']) : ['#1a1a2e', '#16213e', '#0f3460']}
              style={styles.modalGradient}
            >
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <Filter size={20} color={accentColor} />
                  <Text style={[styles.modalTitle, isElite && { color: accentColor }]}>
                    Filter by Sport
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.closeButton}
                >
                  <X size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Info Text */}
              <Text style={styles.infoText}>
                {selectedSport === 'ALL' 
                  ? 'Showing picks from your preferred sports'
                  : 'Overriding your preferences to show only this sport'
                }
              </Text>

              {/* Sport Options */}
              <ScrollView 
                style={styles.optionsScroll}
                showsVerticalScrollIndicator={false}
              >
                {sportOptions.map((sport) => (
                  <TouchableOpacity
                    key={sport.key}
                    style={[
                      styles.sportOption,
                      selectedSport === sport.key && styles.sportOptionActive,
                      selectedSport === sport.key && isElite && { 
                        backgroundColor: `${accentColor}15`,
                        borderColor: accentColor 
                      }
                    ]}
                    onPress={() => handleSelect(sport.key)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sportOptionLeft}>
                      {sport.key !== 'ALL' && sport.logoUrl ? (
                        <View style={styles.logoContainer}>
                          <Image 
                            source={{ uri: sport.logoUrl }}
                            style={styles.optionLogo}
                            resizeMode="contain"
                          />
                        </View>
                      ) : (
                        <View style={[styles.logoContainer, styles.allSportsIcon]}>
                          <Filter size={20} color={accentColor} />
                        </View>
                      )}
                      <View style={styles.sportTextContainer}>
                        <Text style={[
                          styles.sportName,
                          selectedSport === sport.key && styles.sportNameActive,
                          selectedSport === sport.key && isElite && { color: accentColor }
                        ]}>
                          {sport.name}
                        </Text>
                        <Text style={styles.sportFullName}>{sport.fullName}</Text>
                      </View>
                    </View>
                    {selectedSport === sport.key && (
                      <View style={[styles.checkmark, { backgroundColor: sport.key === 'ALL' ? accentColor : sport.color }]}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Reset Button */}
              {selectedSport !== 'ALL' && (
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={() => handleSelect('ALL')}
                >
                  <LinearGradient
                    colors={isElite ? [accentColor, accentColor] : ['#00E5FF', '#0891B2']}
                    style={styles.resetGradient}
                  >
                    <Text style={styles.resetText}>Reset to Preferences</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </LinearGradient>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  filterButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0,229,255,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 8,
    position: 'relative',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonLogo: {
    width: 18,
    height: 18,
  },
  filterButtonText: {
    color: '#00E5FF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activeIndicator: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: screenWidth > 768 ? '70%' : '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalGradient: {
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00E5FF',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
    lineHeight: 18,
  },
  optionsScroll: {
    maxHeight: 400,
  },
  sportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sportOptionActive: {
    backgroundColor: 'rgba(0,229,255,0.15)',
    borderColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sportOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  logoContainer: {
    width: 42,
    height: 42,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allSportsIcon: {
    backgroundColor: 'rgba(0,229,255,0.2)',
  },
  optionLogo: {
    width: '100%',
    height: '100%',
  },
  sportTextContainer: {
    flex: 1,
  },
  sportName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  sportNameActive: {
    color: '#00E5FF',
  },
  sportFullName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  resetButton: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  resetGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

