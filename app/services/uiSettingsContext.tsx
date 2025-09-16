import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo } from 'react-native';

export type ChatBubbleAnimation = 'glow' | 'pulse' | 'shimmer' | 'static';
export type BubbleSize = 'standard' | 'compact';

export interface UISettings {
  chatBubbleAnimation: ChatBubbleAnimation;
  bubbleSize: BubbleSize;
  respectReduceMotion: boolean;
}

const DEFAULT_SETTINGS: UISettings = {
  chatBubbleAnimation: 'glow',
  bubbleSize: 'standard',
  respectReduceMotion: true,
};

const STORAGE_KEY = 'pp_ui_settings_v1';

interface UISettingsContextValue extends UISettings {
  osReduceMotion: boolean;
  shouldReduceMotion: boolean;
  setChatBubbleAnimation: (anim: ChatBubbleAnimation) => Promise<void> | void;
  setBubbleSize: (size: BubbleSize) => Promise<void> | void;
  setRespectReduceMotion: (value: boolean) => Promise<void> | void;
  setSettings: (next: Partial<UISettings>) => Promise<void> | void;
}

const UISettingsContext = createContext<UISettingsContextValue | undefined>(undefined);

export function UISettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<UISettings>(DEFAULT_SETTINGS);
  const [reduceMotionOS, setReduceMotionOS] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as UISettings;
          setSettingsState({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch {}
      try {
        const isReduced = await AccessibilityInfo.isReduceMotionEnabled?.();
        if (typeof isReduced === 'boolean') setReduceMotionOS(isReduced);
      } catch {}
    })();
  }, []);

  const persist = async (next: UISettings) => {
    setSettingsState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const setSettings = async (partial: Partial<UISettings>) => {
    await persist({ ...settings, ...partial });
  };

  const value: UISettingsContextValue = useMemo(() => ({
    ...settings,
    osReduceMotion: reduceMotionOS,
    shouldReduceMotion: settings.respectReduceMotion && reduceMotionOS,
    setChatBubbleAnimation: (anim) => setSettings({ chatBubbleAnimation: anim }),
    setBubbleSize: (size) => setSettings({ bubbleSize: size }),
    setRespectReduceMotion: (value) => setSettings({ respectReduceMotion: value }),
    setSettings,
  }), [settings, reduceMotionOS]);

  // If respecting OS reduce motion, override animation to static at usage sites via this helper flag
  return (
    <UISettingsContext.Provider value={value}>{children}</UISettingsContext.Provider>
  );
}

export function useUISettings() {
  const ctx = useContext(UISettingsContext);
  if (!ctx) throw new Error('useUISettings must be used within UISettingsProvider');
  return ctx;
}
