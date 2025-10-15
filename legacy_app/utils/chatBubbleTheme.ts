import { RingTheme } from '../services/uiSettingsContext';

export function getRingColors(
  ringTheme: RingTheme,
  opts: { isPro: boolean; isElite: boolean }
): readonly [string, string] {
  const { isPro, isElite } = opts;
  if (ringTheme === 'aqua') return ['#00E5FF', '#0891B2'] as const;
  if (ringTheme === 'sunset') return ['#F59E0B', '#EF4444'] as const;
  if (ringTheme === 'indigo') return ['#4F46E5', '#7C3AED'] as const;
  // auto -> tier-based
  if (isElite) return ['#8B5CF6', '#7C3AED'] as const;
  // Pro: switch from orange to cyan/teal to match Pro UI
  if (isPro) return ['#00E5FF', '#0891B2'] as const;
  return ['#00E5FF', '#0891B2'] as const;
}
