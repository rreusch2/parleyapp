export const mockPredictionData = [
  {
    id: '1',
    sportId: 'nfl',
    sport: 'NFL',
    matchup: 'Kansas City Chiefs vs Baltimore Ravens',
    time: 'Today, 4:25 PM ET',
    type: 'Spread',
    pick: 'Chiefs -3.5',
    odds: '-110',
    confidence: 87,
    insight: 'Historical matchup data shows Chiefs covering in 7 of last 9 games vs Ravens with Mahomes at QB.'
  },
  {
    id: '2',
    sportId: 'nba',
    sport: 'NBA',
    matchup: 'Golden State Warriors vs Los Angeles Lakers',
    time: 'Today, 7:30 PM ET',
    type: 'Total',
    pick: 'Over 232.5',
    odds: '-105',
    confidence: 92,
    insight: 'Both teams in top 5 for pace of play and offensive efficiency in last 10 games.'
  },
  {
    id: '3',
    sportId: 'mlb',
    sport: 'MLB',
    matchup: 'New York Yankees vs Boston Red Sox',
    time: 'Tomorrow, 1:05 PM ET',
    type: 'Moneyline',
    pick: 'Yankees',
    odds: '-135',
    confidence: 78,
    insight: 'Yankees starter has 2.31 ERA vs Red Sox in last 3 starts. Red Sox batting .218 vs left-handed pitchers.'
  },
  {
    id: '4',
    sportId: 'nba',
    sport: 'NBA',
    matchup: 'Boston Celtics vs Miami Heat',
    time: 'Tomorrow, 8:00 PM ET',
    type: 'Spread',
    pick: 'Celtics -5.5',
    odds: '-110',
    confidence: 84,
    insight: 'Celtics 9-2 ATS in last 11 road games. Heat missing key defensive player.'
  },
  {
    id: '5',
    sportId: 'nhl',
    sport: 'NHL',
    matchup: 'Toronto Maple Leafs vs Montreal Canadiens',
    time: 'Tomorrow, 7:00 PM ET',
    type: 'Moneyline',
    pick: 'Maple Leafs',
    odds: '-160',
    confidence: 81,
    insight: 'Maple Leafs power play converting at 28% in last 10 games. Montreal penalty kill struggling at 73%.'
  }
];

export const mockLiveGames = [
  {
    id: '1',
    sport: 'nba',
    sportName: 'NBA',
    status: '3rd Quarter - 8:22',
    homeTeam: {
      name: 'Los Angeles Lakers',
      shortName: 'LAL',
      score: 68
    },
    awayTeam: {
      name: 'Golden State Warriors',
      shortName: 'GSW',
      score: 72
    },
    odds: {
      spread: {
        home: '+3.5 (-110)',
        away: '-3.5 (-110)',
        homeMovement: { direction: 'up', value: '0.5' },
        awayMovement: { direction: 'down', value: '0.5' }
      },
      total: {
        over: 'O 238.5 (-110)',
        under: 'U 238.5 (-110)',
        overMovement: { direction: 'up', value: '1.5' }
      },
      moneyline: {
        home: '+155',
        away: '-175',
        homeMovement: { direction: 'down', value: '5' },
        awayMovement: { direction: 'up', value: '5' }
      }
    },
    aiPrediction: {
      text: 'Lakers +3.5',
      confidence: 76
    }
  },
  {
    id: '2',
    sport: 'nfl',
    sportName: 'NFL',
    status: '2nd Quarter - 4:15',
    homeTeam: {
      name: 'Kansas City Chiefs',
      shortName: 'KC',
      score: 14
    },
    awayTeam: {
      name: 'Baltimore Ravens',
      shortName: 'BAL',
      score: 10
    },
    odds: {
      spread: {
        home: '-3.5 (-110)',
        away: '+3.5 (-110)',
      },
      total: {
        over: 'O 51.5 (-110)',
        under: 'U 51.5 (-110)',
        underMovement: { direction: 'up', value: '0.5' }
      },
      moneyline: {
        home: '-180',
        away: '+160',
        homeMovement: { direction: 'up', value: '10' },
        awayMovement: { direction: 'down', value: '10' }
      }
    },
    aiPrediction: {
      text: 'Over 51.5',
      confidence: 82
    }
  },
  {
    id: '3',
    sport: 'mlb',
    sportName: 'MLB',
    status: '5th Inning',
    homeTeam: {
      name: 'New York Yankees',
      shortName: 'NYY',
      score: 2
    },
    awayTeam: {
      name: 'Boston Red Sox',
      shortName: 'BOS',
      score: 1
    },
    odds: {
      spread: {
        home: '-1.5 (+140)',
        away: '+1.5 (-160)',
      },
      total: {
        over: 'O 8.5 (-110)',
        under: 'U 8.5 (-110)',
      },
      moneyline: {
        home: '-135',
        away: '+115',
      }
    },
    aiPrediction: {
      text: 'Yankees ML',
      confidence: 68
    }
  }
];