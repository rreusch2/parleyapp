import axios from 'axios';

const SPORTSDATA_API_KEY = 'd174f0ac08504e45806435851b5ab630';
const SPORTSDATA_BASE_URL = 'https://api.sportsdata.io/v3/nfl';

async function debugHeadshots() {
  try {
    console.log('🔍 Debugging NFL headshots from SportsData.io...\n');

    const response = await axios.get(
      `${SPORTSDATA_BASE_URL}/headshots/json/Headshots?key=${SPORTSDATA_API_KEY}`
    );
    
    const headshots = response.data;
    console.log(`📊 Total headshots fetched: ${headshots.length}`);

    // Check URL availability
    const withUsaTodayUrl = headshots.filter((h: any) => h.UsaTodayHeadshotUrl);
    const withUsaTodayNoBackgroundUrl = headshots.filter((h: any) => h.UsaTodayHeadshotNoBackgroundUrl);
    
    console.log(`✅ With UsaTodayHeadshotUrl: ${withUsaTodayUrl.length}`);
    console.log(`✅ With UsaTodayHeadshotNoBackgroundUrl: ${withUsaTodayNoBackgroundUrl.length}`);
    console.log(`❌ With no URLs at all: ${headshots.length - Math.max(withUsaTodayUrl.length, withUsaTodayNoBackgroundUrl.length)}`);

    // Sample some headshots
    console.log('\n🔍 Sample headshots with URLs:');
    withUsaTodayUrl.slice(0, 3).forEach((h: any, i: number) => {
      console.log(`${i + 1}. ${h.Name} (${h.Team} ${h.Position})`);
      console.log(`   UsaTodayHeadshotUrl: ${h.UsaTodayHeadshotUrl}`);
      console.log(`   UsaTodayHeadshotNoBackgroundUrl: ${h.UsaTodayHeadshotNoBackgroundUrl || 'N/A'}`);
    });

    console.log('\n🔍 Sample headshots with NoBackground URLs only:');
    const onlyNoBackground = headshots.filter((h: any) => 
      !h.UsaTodayHeadshotUrl && h.UsaTodayHeadshotNoBackgroundUrl
    );
    onlyNoBackground.slice(0, 3).forEach((h: any, i: number) => {
      console.log(`${i + 1}. ${h.Name} (${h.Team} ${h.Position})`);
      console.log(`   UsaTodayHeadshotUrl: ${h.UsaTodayHeadshotUrl || 'N/A'}`);
      console.log(`   UsaTodayHeadshotNoBackgroundUrl: ${h.UsaTodayHeadshotNoBackgroundUrl}`);
    });

    // Check Jayden Daniels specifically
    const jadenHeadshot = headshots.find((h: any) => 
      h.Name?.includes('Daniels') && h.Position === 'QB' && h.Team === 'WAS'
    );
    
    if (jadenHeadshot) {
      console.log('\n🔍 Jayden Daniels headshot data:');
      console.log(JSON.stringify(jadenHeadshot, null, 2));
    }

    // Check a few QBs
    console.log('\n🔍 Sample QB headshots:');
    const qbs = headshots.filter((h: any) => h.Position === 'QB').slice(0, 5);
    qbs.forEach((qb: any) => {
      console.log(`- ${qb.Name} (${qb.Team}): UsaToday=${!!qb.UsaTodayHeadshotUrl}, NoBackground=${!!qb.UsaTodayHeadshotNoBackgroundUrl}`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

debugHeadshots();
