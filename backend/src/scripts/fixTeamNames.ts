#!/usr/bin/env node

import { supabase } from '../services/supabase/client';
import { logger } from '../utils/logger';

/**
 * Extract team names from injury descriptions and update records
 */

const MLB_TEAMS = [
  'Angels', 'Astros', 'Athletics', 'Blue Jays', 'Braves', 'Brewers', 'Cardinals', 'Cubs', 'Diamondbacks',
  'Dodgers', 'Giants', 'Guardians', 'Mariners', 'Marlins', 'Mets', 'Nationals', 'Orioles', 'Padres',
  'Phillies', 'Pirates', 'Rangers', 'Rays', 'Red Sox', 'Reds', 'Rockies', 'Royals', 'Tigers', 'Twins',
  'White Sox', 'Yankees'
];

const NFL_TEAMS = [
  'Bills', 'Dolphins', 'Patriots', 'Jets', 'Ravens', 'Bengals', 'Browns', 'Steelers', 'Texans', 'Colts',
  'Jaguars', 'Titans', 'Broncos', 'Chiefs', 'Raiders', 'Chargers', 'Cowboys', 'Giants', 'Eagles', 'Commanders',
  'Bears', 'Lions', 'Packers', 'Vikings', 'Falcons', 'Panthers', 'Saints', 'Buccaneers', 'Cardinals',
  'Rams', '49ers', 'Seahawks'
];

const NBA_TEAMS = [
  'Hawks', 'Celtics', 'Nets', 'Hornets', 'Bulls', 'Cavaliers', 'Mavericks', 'Nuggets', 'Pistons', 'Warriors',
  'Rockets', 'Pacers', 'Clippers', 'Lakers', 'Grizzlies', 'Heat', 'Bucks', 'Timberwolves', 'Pelicans',
  'Knicks', 'Thunder', 'Magic', '76ers', 'Suns', 'Trail Blazers', 'Kings', 'Spurs', 'Raptors', 'Jazz',
  'Wizards'
];

const NHL_TEAMS = [
  'Bruins', 'Sabres', 'Red Wings', 'Panthers', 'Canadiens', 'Senators', 'Lightning', 'Maple Leafs',
  'Hurricanes', 'Blue Jackets', 'Devils', 'Islanders', 'Rangers', 'Flyers', 'Penguins', 'Capitals',
  'Blackhawks', 'Avalanche', 'Stars', 'Wild', 'Predators', 'Blues', 'Jets', 'Flames', 'Oilers',
  'Canucks', 'Ducks', 'Kings', 'Sharks', 'Coyotes', 'Golden Knights', 'Kraken'
];

function extractTeamName(description: string, sport: string): string {
  if (!description) return '';
  
  let teams: string[] = [];
  switch (sport.toUpperCase()) {
    case 'MLB': teams = MLB_TEAMS; break;
    case 'NFL': teams = NFL_TEAMS; break;
    case 'NBA': teams = NBA_TEAMS; break;
    case 'NHL': teams = NHL_TEAMS; break;
    default: return '';
  }
  
  // Look for team names in the description
  for (const team of teams) {
    if (description.includes(team)) {
      return team;
    }
  }
  
  return '';
}

async function fixTeamNames() {
  try {
    console.log('🏈 Starting team name extraction...');
    
    // Get all records with empty team names
    const { data: records, error } = await supabase
      .from('injury_reports')
      .select('id, description, sport, team_name')
      .eq('is_active', true)
      .or('team_name.is.null,team_name.eq.');
    
    if (error) {
      throw error;
    }
    
    console.log(`Found ${records?.length || 0} records to process`);
    
    let updated = 0;
    
    for (const record of records || []) {
      const teamName = extractTeamName(record.description, record.sport);
      
      if (teamName) {
        const { error: updateError } = await supabase
          .from('injury_reports')
          .update({ team_name: teamName })
          .eq('id', record.id);
        
        if (updateError) {
          logger.warn(`Failed to update record ${record.id}:`, updateError);
        } else {
          updated++;
        }
      }
    }
    
    console.log(`✅ Updated ${updated} records with team names`);
    
    // Show summary
    const { data: summary } = await supabase
      .from('injury_reports')
      .select('sport, team_name')
      .eq('is_active', true)
      .not('team_name', 'is', null)
      .not('team_name', 'eq', '');
    
    const teamCounts: Record<string, number> = {};
    summary?.forEach(record => {
      const key = `${record.sport}-${record.team_name}`;
      teamCounts[key] = (teamCounts[key] || 0) + 1;
    });
    
    console.log('\n📊 Team summary:');
    Object.entries(teamCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 20)
      .forEach(([key, count]) => {
        console.log(`  ${key}: ${count} injuries`);
      });
    
  } catch (error) {
    console.error('❌ Error fixing team names:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixTeamNames()
    .then(() => {
      console.log('✅ Team name extraction completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Team name extraction failed:', error);
      process.exit(1);
    });
}

export { fixTeamNames }; 