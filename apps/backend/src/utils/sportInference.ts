export type StatMuseSport = 'MLB' | 'NFL' | 'NBA' | 'WNBA' | 'NHL' | 'CFB';

export const STATMUSE_SPORTS: StatMuseSport[] = ['MLB', 'NFL', 'NBA', 'WNBA', 'NHL', 'CFB'];

type Weights = Partial<Record<StatMuseSport, number>>;

interface Signal {
  phrases: string[];
  weights: Weights;
}

const LEAGUE_NAMES: Signal[] = [
  { phrases: ['mlb', 'major league baseball', 'baseball', 'world series'], weights: { MLB: 100 } },
  { phrases: ['nfl', 'national football league', 'super bowl'], weights: { NFL: 100 } },
  { phrases: ['wnba', "women's basketball", 'womens basketball'], weights: { WNBA: 100 } },
  { phrases: ['nba', 'national basketball association'], weights: { NBA: 100 } },
  { phrases: ['nhl', 'national hockey league', 'hockey', 'stanley cup'], weights: { NHL: 100 } },
  {
    phrases: ['cfb', 'college football', 'ncaaf', 'ncaa football', 'heisman', 'sec', 'big ten', 'big 12'],
    weights: { CFB: 100 },
  },
];

// Nicknames that belong to exactly one of the leagues we support.
const UNIQUE_TEAMS: Signal[] = [
  {
    weights: { MLB: 45 },
    phrases: [
      'yankees', 'red sox', 'blue jays', 'orioles', 'rays', 'guardians', 'twins', 'white sox',
      'tigers', 'royals', 'astros', 'mariners', 'athletics', 'braves', 'mets', 'phillies',
      'marlins', 'nationals', 'cubs', 'brewers', 'reds', 'pirates', 'dodgers', 'padres',
      'diamondbacks', 'dbacks', 'rockies',
    ],
  },
  {
    weights: { NFL: 45 },
    phrases: [
      'chiefs', 'bills', 'patriots', 'dolphins', 'ravens', 'bengals', 'browns', 'steelers',
      'texans', 'colts', 'jaguars', 'jags', 'titans', 'broncos', 'chargers', 'raiders',
      'cowboys', 'eagles', 'commanders', 'bears', 'lions', 'packers', 'vikings', 'buccaneers',
      'bucs', 'saints', 'falcons', '49ers', 'niners', 'seahawks', 'rams',
    ],
  },
  {
    weights: { NBA: 45 },
    phrases: [
      'lakers', 'celtics', 'warriors', 'nets', 'knicks', 'bulls', 'heat', 'bucks', '76ers',
      'sixers', 'suns', 'mavericks', 'mavs', 'nuggets', 'clippers', 'grizzlies', 'pelicans',
      'thunder', 'timberwolves', 'jazz', 'spurs', 'rockets', 'trail blazers', 'blazers',
      'hawks', 'hornets', 'cavaliers', 'cavs', 'pistons', 'pacers', 'magic', 'raptors', 'wizards',
    ],
  },
  {
    weights: { WNBA: 45 },
    phrases: [
      'aces', 'liberty', 'fever', 'sky', 'mystics', 'dream', 'lynx', 'storm', 'mercury',
      'wings', 'sparks', 'valkyries', 'sun',
    ],
  },
  {
    weights: { NHL: 45 },
    phrases: [
      'bruins', 'canadiens', 'maple leafs', 'sabres', 'senators', 'lightning', 'red wings',
      'islanders', 'devils', 'flyers', 'penguins', 'capitals', 'blue jackets', 'hurricanes',
      'blackhawks', 'avalanche', 'wild', 'predators', 'blues', 'oilers', 'flames', 'canucks',
      'kraken', 'golden knights', 'ducks', 'sharks',
    ],
  },
  {
    weights: { CFB: 45 },
    phrases: [
      'crimson tide', 'buckeyes', 'wolverines', 'longhorns', 'sooners', 'aggies', 'razorbacks',
      'gators', 'volunteers', 'bulldogs', 'tigers lsu', 'fighting irish', 'nittany lions',
      'seminoles', 'hurricanes miami', 'ducks oregon', 'trojans', 'cornhuskers', 'badgers',
      'hawkeyes', 'utes', 'horned frogs', 'red raiders', 'mountaineers',
    ],
  },
];

// School names, scored below pro nicknames. Names shared with a pro market
// (texas, miami, washington, arizona, indiana, ...) are deliberately left out.
const CFB_SCHOOLS: Signal[] = [
  {
    weights: { CFB: 35 },
    phrases: [
      'alabama', 'georgia', 'ohio state', 'michigan state', 'michigan', 'oklahoma state',
      'oklahoma', 'lsu', 'clemson', 'notre dame', 'usc', 'ucla', 'oregon state', 'oregon',
      'penn state', 'florida state', 'florida', 'tennessee', 'auburn', 'texas a&m', 'texas am',
      'ole miss', 'mississippi state', 'arkansas', 'missouri', 'kentucky', 'south carolina',
      'vanderbilt', 'north carolina', 'nc state', 'duke', 'virginia tech', 'louisville',
      'syracuse', 'boston college', 'wake forest', 'byu', 'tcu', 'baylor', 'texas tech',
      'kansas state', 'kansas', 'iowa state', 'iowa', 'cincinnati', 'west virginia', 'ucf',
      'wisconsin', 'nebraska', 'illinois', 'northwestern', 'purdue', 'rutgers', 'boise state',
      'smu', 'tulane', 'notre dame', 'army', 'navy', 'air force',
    ],
  },
];

// Nicknames shared by more than one league; the city qualifier decides.
const DISAMBIGUATED_TEAMS: Signal[] = [
  { phrases: ['san francisco giants', 'sf giants'], weights: { MLB: 70 } },
  { phrases: ['new york giants', 'ny giants'], weights: { NFL: 70 } },
  { phrases: ['st louis cardinals', 'stl cardinals'], weights: { MLB: 70 } },
  { phrases: ['arizona cardinals'], weights: { NFL: 70 } },
  { phrases: ['texas rangers'], weights: { MLB: 70 } },
  { phrases: ['new york rangers', 'ny rangers'], weights: { NHL: 70 } },
  { phrases: ['new york jets', 'ny jets'], weights: { NFL: 70 } },
  { phrases: ['winnipeg jets'], weights: { NHL: 70 } },
  { phrases: ['carolina panthers'], weights: { NFL: 70 } },
  { phrases: ['florida panthers'], weights: { NHL: 70 } },
  { phrases: ['sacramento kings'], weights: { NBA: 70 } },
  { phrases: ['los angeles kings', 'la kings'], weights: { NHL: 70 } },
  { phrases: ['los angeles angels', 'la angels'], weights: { MLB: 70 } },
  { phrases: ['dallas stars'], weights: { NHL: 70 } },
  { phrases: ['giants'], weights: { MLB: 12, NFL: 12 } },
  { phrases: ['cardinals'], weights: { MLB: 12, NFL: 12 } },
  { phrases: ['rangers'], weights: { MLB: 12, NHL: 12 } },
  { phrases: ['jets'], weights: { NFL: 12, NHL: 12 } },
  { phrases: ['panthers'], weights: { NFL: 12, NHL: 12 } },
  { phrases: ['kings'], weights: { NBA: 12, NHL: 12 } },
  { phrases: ['stars'], weights: { NHL: 10 } },
  { phrases: ['angels'], weights: { MLB: 12 } },
];

const STAT_KEYWORDS: Signal[] = [
  {
    weights: { MLB: 30 },
    phrases: [
      'home run', 'home runs', 'homer', 'homers', 'batting average', 'rbi', 'rbis', 'era',
      'ops', 'slugging', 'on base', 'obp', 'at bats', 'stolen base', 'stolen bases', 'innings',
      'pitcher', 'pitchers', 'pitching', 'batter', 'batters', 'strikeouts pitched', 'whip',
      'doubles', 'triples', 'grand slam', 'no hitter', 'earned runs', 'hits', 'walks', 'runs batted in',
    ],
  },
  {
    weights: { NFL: 30 },
    phrases: [
      'passing yards', 'rushing yards', 'receiving yards', 'touchdown', 'touchdowns', 'sacks',
      'quarterback', 'receptions', 'targets', 'field goal', 'field goals', 'completions',
      'carries', 'red zone', 'tackles', 'rushing attempts', 'passer rating', 'interceptions thrown',
    ],
  },
  {
    weights: { NBA: 22, WNBA: 22 },
    phrases: [
      'points per game', 'rebounds', 'assists per game', 'three pointers', 'threes', '3 pointers',
      'double double', 'triple double', 'blocks', 'steals', 'free throws', 'field goal percentage',
      'ppg', 'rpg', 'apg',
    ],
  },
  {
    weights: { NHL: 30 },
    phrases: [
      'power play', 'hat trick', 'shots on goal', 'save percentage', 'penalty minutes',
      'faceoff', 'plus minus', 'goalie', 'goals', 'assists on goals',
    ],
  },
];

// Basketball is the one collision the upstream cannot resolve on its own: a WNBA
// name queried against the NBA endpoint returns a confident but wrong answer.
const WNBA_PLAYERS = [
  'caitlin clark', "a'ja wilson", 'aja wilson', 'breanna stewart', 'sabrina ionescu',
  'angel reese', 'napheesa collier', 'alyssa thomas', 'jewell loyd', 'kelsey plum',
  'arike ogunbowale', 'paige bueckers', 'kahleah copper', 'nneka ogwumike', 'jonquel jones',
  'dearica hamby', 'satou sabally', 'rhyne howard', 'aliyah boston', 'kelsey mitchell',
  'brittney griner', 'chelsea gray', 'jackie young', 'ariel atkins', 'kayla mcbride',
  'courtney williams', 'marina mabrey', 'tina charles', 'diana taurasi', 'sophie cunningham',
  'cameron brink', 'hailey van lith', 'sabally', 'clark',
];

// Month index (0-11) -> leagues that are actually playing, used only to break ties.
const IN_SEASON_BY_MONTH: StatMuseSport[][] = [
  ['NFL', 'NBA', 'NHL', 'CFB'],
  ['NFL', 'NBA', 'NHL'],
  ['NBA', 'NHL'],
  ['MLB', 'NBA', 'NHL'],
  ['MLB', 'NBA', 'NHL', 'WNBA'],
  ['MLB', 'WNBA', 'NBA'],
  ['MLB', 'WNBA'],
  ['MLB', 'WNBA', 'NFL'],
  ['MLB', 'NFL', 'CFB', 'WNBA'],
  ['MLB', 'NFL', 'CFB', 'NBA', 'NHL'],
  ['NFL', 'CFB', 'NBA', 'NHL'],
  ['NFL', 'CFB', 'NBA', 'NHL'],
];

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

function contains(haystack: string, phrase: string): boolean {
  return haystack.includes(` ${phrase} `);
}

function applySignals(haystack: string, signals: Signal[], scores: Record<StatMuseSport, number>): void {
  for (const signal of signals) {
    const matched = signal.phrases.some((phrase) => contains(haystack, phrase));
    if (!matched) continue;
    for (const [sport, weight] of Object.entries(signal.weights)) {
      scores[sport as StatMuseSport] += weight as number;
    }
  }
}

/**
 * Orders every supported league by how likely it is that `text` belongs to it.
 * The caller is expected to walk the list until the upstream returns an answer.
 */
export function rankSports(text: string, now: Date = new Date()): StatMuseSport[] {
  const haystack = normalize(text || '');
  const scores = STATMUSE_SPORTS.reduce((acc, sport) => {
    acc[sport] = 0;
    return acc;
  }, {} as Record<StatMuseSport, number>);

  applySignals(haystack, LEAGUE_NAMES, scores);
  applySignals(haystack, UNIQUE_TEAMS, scores);
  applySignals(haystack, CFB_SCHOOLS, scores);
  applySignals(haystack, DISAMBIGUATED_TEAMS, scores);
  applySignals(haystack, STAT_KEYWORDS, scores);

  if (WNBA_PLAYERS.some((player) => contains(haystack, player))) {
    scores.WNBA += 55;
  }

  const inSeason = IN_SEASON_BY_MONTH[now.getMonth()];
  inSeason.forEach((sport, index) => {
    scores[sport] += Math.max(1, 6 - index);
  });

  return [...STATMUSE_SPORTS].sort((a, b) => scores[b] - scores[a]);
}

export function inferSport(text: string, now: Date = new Date()): StatMuseSport {
  return rankSports(text, now)[0];
}

export function normalizeSport(value: unknown): StatMuseSport | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (upper === 'NCAAF') return 'CFB';
  return (STATMUSE_SPORTS as string[]).includes(upper) ? (upper as StatMuseSport) : null;
}
