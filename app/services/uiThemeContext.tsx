import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscription } from './subscriptionContext';

// Gradient tuple typing compatible with expo-linear-gradient
export type GradientColors = readonly [string, string, ...string[]];

export type ThemeId =
  | 'free_default'
  | 'pro_default'
  | 'elite_default'
  | 'midnight_aqua'
  | 'sunset_gold'
  | 'neon_indigo'
  | 'emerald_noir'
  | 'crimson_blaze';

export interface ThemeTokens {
  id: ThemeId;
  name: string;
  headerGradient: GradientColors;
  headerTextPrimary: string;
  headerTextSecondary: string;
  accentPrimary: string;
  accentSecondary: string;
  ctaGradient: GradientColors; // for cards like "Football is Back" and action CTAs
  cardSurface: string; // fallback background for surfaces
  cardTextPrimary: string;
}

const THEMES: Record<ThemeId, ThemeTokens> = {
  free_default: {
    id: 'free_default',
    name: 'Free Default',
    headerGradient: ['#1E293B', '#334155', '#0F172A'],
    headerTextPrimary: '#FFFFFF',
    headerTextSecondary: 'rgba(255,255,255,0.85)',
    accentPrimary: '#00E5FF',
    accentSecondary: '#0891B2',
    ctaGradient: ['#1a1a2e', '#16213e'],
    cardSurface: '#111827',
    cardTextPrimary: '#FFFFFF',
  },
  pro_default: {
    id: 'pro_default',
    name: 'Pro Default',
    headerGradient: ['#1E40AF', '#7C3AED', '#0F172A'],
    headerTextPrimary: '#FFFFFF',
    headerTextSecondary: 'rgba(255,255,255,0.9)',
    accentPrimary: '#10B981',
    accentSecondary: '#00E5FF',
    ctaGradient: ['#00E5FF', '#0EA5E9'],
    cardSurface: '#0F172A',
    cardTextPrimary: '#FFFFFF',
  },
  elite_default: {
    id: 'elite_default',
    name: 'Elite Default',
    headerGradient: ['#8B5CF6', '#EC4899', '#F59E0B'],
    headerTextPrimary: '#FFFFFF',
    headerTextSecondary: 'rgba(255,255,255,0.92)',
    accentPrimary: '#FFD700',
    accentSecondary: '#F59E0B',
    ctaGradient: ['#8B5CF6', '#EC4899', '#F59E0B'],
    cardSurface: '#0B1220',
    cardTextPrimary: '#FFFFFF',
  },
  midnight_aqua: {
    id: 'midnight_aqua',
    name: 'Midnight Aqua',
    headerGradient: ['#0B1220', '#0E7490', '#06B6D4'],
    headerTextPrimary: '#E6FBFF',
    headerTextSecondary: 'rgba(230,251,255,0.9)',
    accentPrimary: '#00E5FF',
    accentSecondary: '#0891B2',
    ctaGradient: ['#0EA5E9', '#06B6D4'],
    cardSurface: '#0A1A2F',
    cardTextPrimary: '#E6FBFF',
  },
  sunset_gold: {
    id: 'sunset_gold',
    name: 'Sunset Gold',
    headerGradient: ['#7C2D12', '#EA580C', '#F59E0B'],
    headerTextPrimary: '#FFF7ED',
    headerTextSecondary: 'rgba(255,247,237,0.9)',
    accentPrimary: '#FFD700',
    accentSecondary: '#F59E0B',
    ctaGradient: ['#F59E0B', '#EA580C'],
    cardSurface: '#1F130A',
    cardTextPrimary: '#FFF7ED',
  },
  neon_indigo: {
    id: 'neon_indigo',
    name: 'Neon Indigo',
    headerGradient: ['#1E1B4B', '#4338CA', '#7C3AED'],
    headerTextPrimary: '#EEF2FF',
    headerTextSecondary: 'rgba(238,242,255,0.9)',
    accentPrimary: '#A78BFA',
    accentSecondary: '#C084FC',
    ctaGradient: ['#4F46E5', '#7C3AED'],
    cardSurface: '#161531',
    cardTextPrimary: '#EEF2FF',
  },
  emerald_noir: {
    id: 'emerald_noir',
    name: 'Emerald Noir',
    headerGradient: ['#0B1220', '#064E3B', '#10B981'],
    headerTextPrimary: '#ECFDF5',
    headerTextSecondary: 'rgba(236,253,245,0.9)',
    accentPrimary: '#34D399',
    accentSecondary: '#10B981',
    ctaGradient: ['#065F46', '#10B981'],
    cardSurface: '#071A13',
    cardTextPrimary: '#ECFDF5',
  },
  crimson_blaze: {
    id: 'crimson_blaze',
    name: 'Crimson Blaze',
    headerGradient: ['#111827', '#B91C1C', '#EF4444'],
    headerTextPrimary: '#FFE4E6',
    headerTextSecondary: 'rgba(255,228,230,0.9)',
    accentPrimary: '#FDBA74',
    accentSecondary: '#FB7185',
    ctaGradient: ['#EA580C', '#EF4444'],
    cardSurface: '#1A0B0F',
    cardTextPrimary: '#FFE4E6',
  },
};

export const AVAILABLE_PRO_THEMES: { id: ThemeId; name: string }[] = [
  { id: 'pro_default', name: 'Pro Default' },
  { id: 'midnight_aqua', name: 'Midnight Aqua' },
];

export const AVAILABLE_ELITE_THEMES: { id: ThemeId; name: string }[] = [
  { id: 'pro_default', name: 'Pro Default' },
  { id: 'elite_default', name: 'Elite Default' },
  { id: 'midnight_aqua', name: 'Midnight Aqua' },
  { id: 'sunset_gold', name: 'Sunset Gold' },
  { id: 'neon_indigo', name: 'Neon Indigo' },
  { id: 'emerald_noir', name: 'Emerald Noir' },
  { id: 'crimson_blaze', name: 'Crimson Blaze' },
];

export const ALL_THEMES: { id: ThemeId; name: string; tier: 'free' | 'pro' | 'elite' }[] = [
  { id: 'free_default', name: 'Free Default', tier: 'free' },
  { id: 'pro_default', name: 'Pro Default', tier: 'pro' },
  { id: 'midnight_aqua', name: 'Midnight Aqua', tier: 'pro' },
  { id: 'elite_default', name: 'Elite Default', tier: 'elite' },
  { id: 'sunset_gold', name: 'Sunset Gold', tier: 'elite' },
  { id: 'neon_indigo', name: 'Neon Indigo', tier: 'elite' },
  { id: 'emerald_noir', name: 'Emerald Noir', tier: 'elite' },
  { id: 'crimson_blaze', name: 'Crimson Blaze', tier: 'elite' },
];

export function getThemeTokens(id: ThemeId): ThemeTokens {
  return THEMES[id] || THEMES.elite_default;
}

interface UIThemeContextValue {
  themeId: ThemeId;
  theme: ThemeTokens;
  setThemeId: (id: ThemeId) => Promise<void> | void;
}

const UIThemeContext = createContext<UIThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'pp_elite_theme_v1';

export function UIThemeProvider({ children }: { children: React.ReactNode }) {
  const { isElite, isPro } = useSubscription();
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>('elite_default');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && (Object.keys(THEMES) as ThemeId[]).includes(saved as ThemeId)) {
          setSelectedThemeId(saved as ThemeId);
        }
      } catch {}
    })();
  }, []);

  const activeTheme = useMemo<ThemeTokens>(() => {
    if (isElite) {
      // Elite users can use any theme
      return THEMES[selectedThemeId] || THEMES.elite_default;
    }
    if (isPro) {
      // Pro users can only use pro_default and midnight_aqua
      const allowedProThemes: ThemeId[] = ['pro_default', 'midnight_aqua'];
      if (allowedProThemes.includes(selectedThemeId)) {
        return THEMES[selectedThemeId];
      }
      return THEMES.pro_default;
    }
    // Free users always get free_default
    return THEMES.free_default;
  }, [isElite, isPro, selectedThemeId]);

  const setThemeId = async (id: ThemeId) => {
    setSelectedThemeId(id);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, id);
    } catch {}
  };

  const value: UIThemeContextValue = useMemo(
    () => ({ themeId: selectedThemeId, theme: activeTheme, setThemeId }),
    [selectedThemeId, activeTheme]
  );

  return <UIThemeContext.Provider value={value}>{children}</UIThemeContext.Provider>;
}

export function useUITheme() {
  const ctx = useContext(UIThemeContext);
  if (!ctx) throw new Error('useUITheme must be used within a UIThemeProvider');
  return ctx;
}

export function getAvailableThemesForTier(isElite: boolean, isPro: boolean) {
  if (isElite) {
    return AVAILABLE_ELITE_THEMES;
  }
  if (isPro) {
    return AVAILABLE_PRO_THEMES;
  }
  return []; // Free users can't select themes
}

export function canUserAccessTheme(themeId: ThemeId, isElite: boolean, isPro: boolean): boolean {
  const theme = ALL_THEMES.find(t => t.id === themeId);
  if (!theme) return false;
  
  if (theme.tier === 'free') return true;
  if (theme.tier === 'pro') return isPro || isElite;
  if (theme.tier === 'elite') return isElite;
  
  return false;
}
