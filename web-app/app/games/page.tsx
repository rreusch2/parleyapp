'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import GameCard from '@/components/GameCard'
import type { GameEvent } from '@/components/GameCard'
import { useSubscription } from '@/contexts/SubscriptionContext'
import Head from 'next/head'

const sports = ['All', 'MLB', 'WNBA', 'NFL', 'NBA', 'NCAAF', 'Soccer'];

export default function GamesPage() {
  const { subscriptionTier } = useSubscription();
  const [games, setGames] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState('All');

  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true);
      let query = supabase.from('sports_events').select('*');

      if (selectedSport !== 'All') {
        const sportKeyMap: { [key: string]: string } = {
            'MLB': 'baseball_mlb',
            'WNBA': 'basketball_wnba',
            'NFL': 'americanfootball_nfl',
            'NBA': 'basketball_nba',
            'NCAAF': 'americanfootball_ncaaf',
            'Soccer': 'soccer_usa_mls'
        };
        query = query.eq('sport_key', sportKeyMap[selectedSport]);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching games:', error);
      } else {
        const formattedGames = data.map(game => ({
          id: game.id,
          sport_key: game.sport_key,
          sport_title: game.sport,
          commence_time: game.start_time,
          home_team: game.home_team,
          away_team: game.away_team,
          bookmakers: game.metadata?.full_data?.bookmakers || [],
        }));
        setGames(formattedGames);
      }
      setLoading(false);
    };

    fetchGames();
  }, [selectedSport]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  return (
    <>
    <Head>
        <title>Games & Odds | Predictive Play</title>
    </Head>
    <div className="min-h-screen bg-gray-900 text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              Live Games & Odds
            </span>
          </h1>
          <p className="mt-4 text-lg text-gray-400">
            Your daily hub for sports betting action.
          </p>
        </div>

        <div className="mb-8">
            <div className="flex justify-center space-x-1 bg-gray-800 rounded-lg p-1">
                {sports.map((sport) => (
                <button
                    key={sport}
                    onClick={() => setSelectedSport(sport)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    selectedSport === sport
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                >
                    {sport}
                </button>
                ))}
            </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : games.length === 0 ? (
            <div className="text-center text-gray-500">
                <p>No games available for {selectedSport}.</p>
            </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {games.map(game => (
              <GameCard key={game.id} game={game} />
            ))}
          </motion.div>
        )}
      </main>
    </div>
    </>
  );
}
