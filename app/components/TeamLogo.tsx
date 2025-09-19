import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { TeamLogo as TeamLogoData } from '../services/teamLogoService';

interface TeamLogoProps {
  teamData: TeamLogoData | null;
  teamName: string;
  size?: 'small' | 'medium' | 'large';
  league?: string;
  showBorder?: boolean;
  borderColor?: string;
}

export const TeamLogo: React.FC<TeamLogoProps> = ({
  teamData,
  teamName,
  size = 'medium',
  league = '',
  showBorder = true,
  borderColor
}) => {
  // Size configurations
  const sizeConfig = {
    small: { container: 24, logo: 22, borderRadius: 12, fontSize: 8 },
    medium: { container: 32, logo: 30, borderRadius: 16, fontSize: 10 },
    large: { container: 48, logo: 46, borderRadius: 24, fontSize: 14 }
  };

  const config = sizeConfig[size];

  // Get sport color for border
  const getSportColor = (league: string) => {
    switch (league.toUpperCase()) {
      case 'NFL': return '#013369';
      case 'NBA': return '#1D428A';
      case 'MLB': return '#041E42';
      case 'NHL': return '#000000';
      case 'CFB':
      case 'NCAAF': return '#CC0000';
      case 'WNBA': return '#FE5000';
      case 'MMA':
      case 'UFC': return '#D20A0A';
      default: return '#00E5FF';
    }
  };

  // Generate fallback abbreviation
  const getFallbackAbbreviation = (name: string) => {
    if (teamData?.team_abbreviation) {
      return teamData.team_abbreviation;
    }
    
    const words = name.split(' ').filter(word => 
      word.length > 2 && 
      !['the', 'of', 'and', 'at'].includes(word.toLowerCase())
    );
    
    if (words.length >= 2) {
      return words.slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
    } else if (words.length === 1) {
      return words[0].substring(0, 3).toUpperCase();
    }
    
    return name.substring(0, 3).toUpperCase();
  };

  const effectiveBorderColor = borderColor || getSportColor(league);

  return (
    <View
      style={[
        styles.container,
        {
          width: config.container,
          height: config.container,
          borderRadius: config.borderRadius,
          borderColor: showBorder ? effectiveBorderColor : 'transparent',
          borderWidth: showBorder ? 1.5 : 0,
        }
      ]}
    >
      {teamData?.logo_url ? (
        <Image
          source={{ uri: teamData.logo_url }}
          style={[
            styles.logo,
            {
              width: config.logo,
              height: config.logo,
              borderRadius: config.borderRadius - 1,
            }
          ]}
          onError={() => {
            console.log('Failed to load logo for', teamName);
          }}
          resizeMode="contain"
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: config.logo,
              height: config.logo,
              borderRadius: config.borderRadius - 1,
            }
          ]}
        >
          <Text
            style={[
              styles.fallbackText,
              {
                fontSize: config.fontSize,
                color: effectiveBorderColor,
              }
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {getFallbackAbbreviation(teamName)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  logo: {
    backgroundColor: '#FFFFFF',
  },
  fallback: {
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fallbackText: {
    fontWeight: '700',
    textAlign: 'center',
  },
});
