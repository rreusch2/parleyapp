/**
 * League Logo & Icon Utilities
 * 
 * Provides consistent league branding across the app
 * Supports emoji fallbacks and future Supabase storage integration
 */

export interface LeagueInfo {
  key: string;
  name: string;
  emoji: string;
  color: string;
  logoUrl?: string; // Future: From Supabase storage or CDN
}

export const LEAGUES: Record<string, LeagueInfo> = {
  MLB: {
    key: 'MLB',
    name: 'Major League Baseball',
    emoji: '⚾',
    color: '#002D72',
    logoUrl: 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/mlb.png'
  },
  NBA: {
    key: 'NBA',
    name: 'National Basketball Association',
    emoji: '🏀',
    color: '#C8102E',
    logoUrl: 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/nba.png'
  },
  NFL: {
    key: 'NFL',
    name: 'National Football League',
    emoji: '🏈',
    color: '#013369',
    logoUrl: 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/nfl.png'
  },
  NHL: {
    key: 'NHL',
    name: 'National Hockey League',
    emoji: '🏒',
    color: '#000000',
    logoUrl: 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/nhl.png'
  },
  WNBA: {
    key: 'WNBA',
    name: "Women's National Basketball Association",
    emoji: '🏀',
    color: '#FF6600',
    logoUrl: 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/wnba.png'
  },
  CFB: {
    key: 'CFB',
    name: 'College Football',
    emoji: '🏈',
    color: '#862633',
    logoUrl: 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/cfb.png'
  },
  MLS: {
    key: 'MLS',
    name: 'Major League Soccer',
    emoji: '⚽',
    color: '#C39E6D',
    logoUrl: 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/mls.png'
  },
  UFC: {
    key: 'UFC',
    name: 'Ultimate Fighting Championship',
    emoji: '🥊',
    color: '#D20A0A',
    logoUrl: 'https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/ufc.png'
  },
};

/**
 * Get league info by key with fuzzy matching
 * Handles variations like "mlb", "MLB", "Baseball", etc.
 */
export function getLeagueInfo(sportOrLeague: string): LeagueInfo {
  if (!sportOrLeague) {
    return {
      key: 'UNKNOWN',
      name: 'Sports',
      emoji: '🏟️',
      color: '#6B7280',
    };
  }

  const normalized = sportOrLeague.toUpperCase().trim();

  // Direct match
  if (LEAGUES[normalized]) {
    return LEAGUES[normalized];
  }

  // Fuzzy matching
  if (normalized.includes('MLB') || normalized.includes('BASEBALL')) {
    return LEAGUES.MLB;
  }
  if (normalized.includes('NBA') || normalized.includes('BASKETBALL')) {
    return LEAGUES.NBA;
  }
  if (normalized.includes('NFL') || normalized.includes('FOOTBALL')) {
    return LEAGUES.NFL;
  }
  if (normalized.includes('NHL') || normalized.includes('HOCKEY')) {
    return LEAGUES.NHL;
  }
  if (normalized.includes('WNBA')) {
    return LEAGUES.WNBA;
  }
  if (normalized.includes('CFB') || normalized.includes('COLLEGE')) {
    return LEAGUES.CFB;
  }
  if (normalized.includes('MLS') || normalized.includes('SOCCER')) {
    return LEAGUES.MLS;
  }
  if (normalized.includes('UFC') || normalized.includes('MMA')) {
    return LEAGUES.UFC;
  }

  // Default fallback
  return {
    key: normalized,
    name: sportOrLeague,
    emoji: '🏟️',
    color: '#6B7280',
  };
}

/**
 * Get league emoji icon
 */
export function getLeagueEmoji(sportOrLeague: string): string {
  return getLeagueInfo(sportOrLeague).emoji;
}

/**
 * Get league brand color
 */
export function getLeagueColor(sportOrLeague: string): string {
  return getLeagueInfo(sportOrLeague).color;
}

/**
 * Get league logo URL (when available)
 * Falls back to emoji if no logo URL set
 */
export function getLeagueLogoUrl(sportOrLeague: string): string | undefined {
  return getLeagueInfo(sportOrLeague).logoUrl;
}

/**
 * Check if league has a logo URL available
 */
export function hasLeagueLogo(sportOrLeague: string): boolean {
  return !!getLeagueInfo(sportOrLeague).logoUrl;
}

/**
 * Get display name for league
 */
export function getLeagueName(sportOrLeague: string): string {
  return getLeagueInfo(sportOrLeague).name;
}

export default {
  LEAGUES,
  getLeagueInfo,
  getLeagueEmoji,
  getLeagueColor,
  getLeagueLogoUrl,
  hasLeagueLogo,
  getLeagueName,
};

