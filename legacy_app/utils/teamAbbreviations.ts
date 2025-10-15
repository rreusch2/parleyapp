// Team abbreviations and logos for all supported sports

interface TeamInfo {
  abbreviation: string;
  fullName: string;
  logoUrl?: string;
}

// MLB Teams
const MLB_TEAMS: Record<string, TeamInfo> = {
  'Arizona Diamondbacks': { abbreviation: 'ARI', fullName: 'Arizona Diamondbacks' },
  'Atlanta Braves': { abbreviation: 'ATL', fullName: 'Atlanta Braves' },
  'Baltimore Orioles': { abbreviation: 'BAL', fullName: 'Baltimore Orioles' },
  'Boston Red Sox': { abbreviation: 'BOS', fullName: 'Boston Red Sox' },
  'Chicago Cubs': { abbreviation: 'CHC', fullName: 'Chicago Cubs' },
  'Chicago White Sox': { abbreviation: 'CWS', fullName: 'Chicago White Sox' },
  'Cincinnati Reds': { abbreviation: 'CIN', fullName: 'Cincinnati Reds' },
  'Cleveland Guardians': { abbreviation: 'CLE', fullName: 'Cleveland Guardians' },
  'Colorado Rockies': { abbreviation: 'COL', fullName: 'Colorado Rockies' },
  'Detroit Tigers': { abbreviation: 'DET', fullName: 'Detroit Tigers' },
  'Houston Astros': { abbreviation: 'HOU', fullName: 'Houston Astros' },
  'Kansas City Royals': { abbreviation: 'KC', fullName: 'Kansas City Royals' },
  'Los Angeles Angels': { abbreviation: 'LAA', fullName: 'Los Angeles Angels' },
  'Los Angeles Dodgers': { abbreviation: 'LAD', fullName: 'Los Angeles Dodgers' },
  'Miami Marlins': { abbreviation: 'MIA', fullName: 'Miami Marlins' },
  'Milwaukee Brewers': { abbreviation: 'MIL', fullName: 'Milwaukee Brewers' },
  'Minnesota Twins': { abbreviation: 'MIN', fullName: 'Minnesota Twins' },
  'New York Mets': { abbreviation: 'NYM', fullName: 'New York Mets' },
  'New York Yankees': { abbreviation: 'NYY', fullName: 'New York Yankees' },
  'Oakland Athletics': { abbreviation: 'OAK', fullName: 'Oakland Athletics' },
  'Philadelphia Phillies': { abbreviation: 'PHI', fullName: 'Philadelphia Phillies' },
  'Pittsburgh Pirates': { abbreviation: 'PIT', fullName: 'Pittsburgh Pirates' },
  'San Diego Padres': { abbreviation: 'SD', fullName: 'San Diego Padres' },
  'San Francisco Giants': { abbreviation: 'SF', fullName: 'San Francisco Giants' },
  'Seattle Mariners': { abbreviation: 'SEA', fullName: 'Seattle Mariners' },
  'St. Louis Cardinals': { abbreviation: 'STL', fullName: 'St. Louis Cardinals' },
  'Tampa Bay Rays': { abbreviation: 'TB', fullName: 'Tampa Bay Rays' },
  'Texas Rangers': { abbreviation: 'TEX', fullName: 'Texas Rangers' },
  'Toronto Blue Jays': { abbreviation: 'TOR', fullName: 'Toronto Blue Jays' },
  'Washington Nationals': { abbreviation: 'WSH', fullName: 'Washington Nationals' },
};

// NHL Teams
const NHL_TEAMS: Record<string, TeamInfo> = {
  'Anaheim Ducks': { abbreviation: 'ANA', fullName: 'Anaheim Ducks' },
  'Arizona Coyotes': { abbreviation: 'ARI', fullName: 'Arizona Coyotes' },
  'Boston Bruins': { abbreviation: 'BOS', fullName: 'Boston Bruins' },
  'Buffalo Sabres': { abbreviation: 'BUF', fullName: 'Buffalo Sabres' },
  'Calgary Flames': { abbreviation: 'CGY', fullName: 'Calgary Flames' },
  'Carolina Hurricanes': { abbreviation: 'CAR', fullName: 'Carolina Hurricanes' },
  'Chicago Blackhawks': { abbreviation: 'CHI', fullName: 'Chicago Blackhawks' },
  'Colorado Avalanche': { abbreviation: 'COL', fullName: 'Colorado Avalanche' },
  'Columbus Blue Jackets': { abbreviation: 'CBJ', fullName: 'Columbus Blue Jackets' },
  'Dallas Stars': { abbreviation: 'DAL', fullName: 'Dallas Stars' },
  'Detroit Red Wings': { abbreviation: 'DET', fullName: 'Detroit Red Wings' },
  'Edmonton Oilers': { abbreviation: 'EDM', fullName: 'Edmonton Oilers' },
  'Florida Panthers': { abbreviation: 'FLA', fullName: 'Florida Panthers' },
  'Los Angeles Kings': { abbreviation: 'LAK', fullName: 'Los Angeles Kings' },
  'Minnesota Wild': { abbreviation: 'MIN', fullName: 'Minnesota Wild' },
  'Montreal Canadiens': { abbreviation: 'MTL', fullName: 'Montreal Canadiens' },
  'Nashville Predators': { abbreviation: 'NSH', fullName: 'Nashville Predators' },
  'New Jersey Devils': { abbreviation: 'NJD', fullName: 'New Jersey Devils' },
  'New York Islanders': { abbreviation: 'NYI', fullName: 'New York Islanders' },
  'New York Rangers': { abbreviation: 'NYR', fullName: 'New York Rangers' },
  'Ottawa Senators': { abbreviation: 'OTT', fullName: 'Ottawa Senators' },
  'Philadelphia Flyers': { abbreviation: 'PHI', fullName: 'Philadelphia Flyers' },
  'Pittsburgh Penguins': { abbreviation: 'PIT', fullName: 'Pittsburgh Penguins' },
  'San Jose Sharks': { abbreviation: 'SJS', fullName: 'San Jose Sharks' },
  'Seattle Kraken': { abbreviation: 'SEA', fullName: 'Seattle Kraken' },
  'St. Louis Blues': { abbreviation: 'STL', fullName: 'St. Louis Blues' },
  'Tampa Bay Lightning': { abbreviation: 'TBL', fullName: 'Tampa Bay Lightning' },
  'Toronto Maple Leafs': { abbreviation: 'TOR', fullName: 'Toronto Maple Leafs' },
  'Vancouver Canucks': { abbreviation: 'VAN', fullName: 'Vancouver Canucks' },
  'Vegas Golden Knights': { abbreviation: 'VGK', fullName: 'Vegas Golden Knights' },
  'Washington Capitals': { abbreviation: 'WSH', fullName: 'Washington Capitals' },
  'Winnipeg Jets': { abbreviation: 'WPG', fullName: 'Winnipeg Jets' },
};

// NFL Teams
const NFL_TEAMS: Record<string, TeamInfo> = {
  'Arizona Cardinals': { abbreviation: 'ARI', fullName: 'Arizona Cardinals' },
  'Atlanta Falcons': { abbreviation: 'ATL', fullName: 'Atlanta Falcons' },
  'Baltimore Ravens': { abbreviation: 'BAL', fullName: 'Baltimore Ravens' },
  'Buffalo Bills': { abbreviation: 'BUF', fullName: 'Buffalo Bills' },
  'Carolina Panthers': { abbreviation: 'CAR', fullName: 'Carolina Panthers' },
  'Chicago Bears': { abbreviation: 'CHI', fullName: 'Chicago Bears' },
  'Cincinnati Bengals': { abbreviation: 'CIN', fullName: 'Cincinnati Bengals' },
  'Cleveland Browns': { abbreviation: 'CLE', fullName: 'Cleveland Browns' },
  'Dallas Cowboys': { abbreviation: 'DAL', fullName: 'Dallas Cowboys' },
  'Denver Broncos': { abbreviation: 'DEN', fullName: 'Denver Broncos' },
  'Detroit Lions': { abbreviation: 'DET', fullName: 'Detroit Lions' },
  'Green Bay Packers': { abbreviation: 'GB', fullName: 'Green Bay Packers' },
  'Houston Texans': { abbreviation: 'HOU', fullName: 'Houston Texans' },
  'Indianapolis Colts': { abbreviation: 'IND', fullName: 'Indianapolis Colts' },
  'Jacksonville Jaguars': { abbreviation: 'JAX', fullName: 'Jacksonville Jaguars' },
  'Kansas City Chiefs': { abbreviation: 'KC', fullName: 'Kansas City Chiefs' },
  'Las Vegas Raiders': { abbreviation: 'LV', fullName: 'Las Vegas Raiders' },
  'Los Angeles Chargers': { abbreviation: 'LAC', fullName: 'Los Angeles Chargers' },
  'Los Angeles Rams': { abbreviation: 'LAR', fullName: 'Los Angeles Rams' },
  'Miami Dolphins': { abbreviation: 'MIA', fullName: 'Miami Dolphins' },
  'Minnesota Vikings': { abbreviation: 'MIN', fullName: 'Minnesota Vikings' },
  'New England Patriots': { abbreviation: 'NE', fullName: 'New England Patriots' },
  'New Orleans Saints': { abbreviation: 'NO', fullName: 'New Orleans Saints' },
  'New York Giants': { abbreviation: 'NYG', fullName: 'New York Giants' },
  'New York Jets': { abbreviation: 'NYJ', fullName: 'New York Jets' },
  'Philadelphia Eagles': { abbreviation: 'PHI', fullName: 'Philadelphia Eagles' },
  'Pittsburgh Steelers': { abbreviation: 'PIT', fullName: 'Pittsburgh Steelers' },
  'San Francisco 49ers': { abbreviation: 'SF', fullName: 'San Francisco 49ers' },
  'Seattle Seahawks': { abbreviation: 'SEA', fullName: 'Seattle Seahawks' },
  'Tampa Bay Buccaneers': { abbreviation: 'TB', fullName: 'Tampa Bay Buccaneers' },
  'Tennessee Titans': { abbreviation: 'TEN', fullName: 'Tennessee Titans' },
  'Washington Commanders': { abbreviation: 'WAS', fullName: 'Washington Commanders' },
};

// NBA Teams
const NBA_TEAMS: Record<string, TeamInfo> = {
  'Atlanta Hawks': { abbreviation: 'ATL', fullName: 'Atlanta Hawks' },
  'Boston Celtics': { abbreviation: 'BOS', fullName: 'Boston Celtics' },
  'Brooklyn Nets': { abbreviation: 'BKN', fullName: 'Brooklyn Nets' },
  'Charlotte Hornets': { abbreviation: 'CHA', fullName: 'Charlotte Hornets' },
  'Chicago Bulls': { abbreviation: 'CHI', fullName: 'Chicago Bulls' },
  'Cleveland Cavaliers': { abbreviation: 'CLE', fullName: 'Cleveland Cavaliers' },
  'Dallas Mavericks': { abbreviation: 'DAL', fullName: 'Dallas Mavericks' },
  'Denver Nuggets': { abbreviation: 'DEN', fullName: 'Denver Nuggets' },
  'Detroit Pistons': { abbreviation: 'DET', fullName: 'Detroit Pistons' },
  'Golden State Warriors': { abbreviation: 'GSW', fullName: 'Golden State Warriors' },
  'Houston Rockets': { abbreviation: 'HOU', fullName: 'Houston Rockets' },
  'Indiana Pacers': { abbreviation: 'IND', fullName: 'Indiana Pacers' },
  'LA Clippers': { abbreviation: 'LAC', fullName: 'LA Clippers' },
  'Los Angeles Lakers': { abbreviation: 'LAL', fullName: 'Los Angeles Lakers' },
  'Memphis Grizzlies': { abbreviation: 'MEM', fullName: 'Memphis Grizzlies' },
  'Miami Heat': { abbreviation: 'MIA', fullName: 'Miami Heat' },
  'Milwaukee Bucks': { abbreviation: 'MIL', fullName: 'Milwaukee Bucks' },
  'Minnesota Timberwolves': { abbreviation: 'MIN', fullName: 'Minnesota Timberwolves' },
  'New Orleans Pelicans': { abbreviation: 'NOP', fullName: 'New Orleans Pelicans' },
  'New York Knicks': { abbreviation: 'NYK', fullName: 'New York Knicks' },
  'Oklahoma City Thunder': { abbreviation: 'OKC', fullName: 'Oklahoma City Thunder' },
  'Orlando Magic': { abbreviation: 'ORL', fullName: 'Orlando Magic' },
  'Philadelphia 76ers': { abbreviation: 'PHI', fullName: 'Philadelphia 76ers' },
  'Phoenix Suns': { abbreviation: 'PHX', fullName: 'Phoenix Suns' },
  'Portland Trail Blazers': { abbreviation: 'POR', fullName: 'Portland Trail Blazers' },
  'Sacramento Kings': { abbreviation: 'SAC', fullName: 'Sacramento Kings' },
  'San Antonio Spurs': { abbreviation: 'SA', fullName: 'San Antonio Spurs' },
  'Toronto Raptors': { abbreviation: 'TOR', fullName: 'Toronto Raptors' },
  'Utah Jazz': { abbreviation: 'UTA', fullName: 'Utah Jazz' },
  'Washington Wizards': { abbreviation: 'WAS', fullName: 'Washington Wizards' },
};

const ALL_TEAMS = {
  MLB: MLB_TEAMS,
  NHL: NHL_TEAMS,
  NFL: NFL_TEAMS,
  NBA: NBA_TEAMS,
  // Add more as needed
};

/**
 * Get team abbreviation from full name
 */
export function getTeamAbbreviation(teamName: string, sport: string): string {
  const sportTeams = ALL_TEAMS[sport as keyof typeof ALL_TEAMS];
  if (!sportTeams) return teamName.substring(0, 3).toUpperCase();
  
  const team = sportTeams[teamName];
  return team ? team.abbreviation : teamName.substring(0, 3).toUpperCase();
}

/**
 * Get team logo URL (using ESPN or similar)
 */
export function getTeamLogo(teamName: string, sport: string): string | undefined {
  // Try to find team abbreviation
  const abbr = getTeamAbbreviation(teamName, sport);
  
  // Use ESPN logo URLs (they're publicly accessible and reliable)
  const sportKey = sport.toLowerCase();
  
  if (sportKey === 'mlb') {
    return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/mlb/500/${abbr.toLowerCase()}.png&h=200&w=200`;
  } else if (sportKey === 'nhl') {
    return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/${abbr.toLowerCase()}.png&h=200&w=200`;
  } else if (sportKey === 'nfl') {
    return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png&h=200&w=200`;
  } else if (sportKey === 'nba') {
    return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/${abbr.toLowerCase()}.png&h=200&w=200`;
  }
  
  return undefined;
}

/**
 * Format game matchup (Away @ Home)
 */
export function formatGameMatchup(awayTeam: string, homeTeam: string, sport: string): string {
  const awayAbbr = getTeamAbbreviation(awayTeam, sport);
  const homeAbbr = getTeamAbbreviation(homeTeam, sport);
  return `${awayAbbr} @ ${homeAbbr}`;
}

/**
 * Format game date/time
 */
export function formatGameDateTime(dateTimeStr: string): string {
  try {
    const date = new Date(dateTimeStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
    
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    if (isToday) return `Today ${timeStr}`;
    if (isTomorrow) return `Tomorrow ${timeStr}`;
    
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    return `${dateStr} ${timeStr}`;
  } catch (error) {
    return 'Time TBD';
  }
}
