'use client'
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Zap, Clock, Shield, BarChart2 } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import SportsbookSelector from './SportsbookSelector';
import OddsDisplay from './OddsDisplay';

// Types based on the database schema and mobile app
interface BookmakerOdds {
  key: string;
  title: string;
  last_update: string;
  markets: Market[];
}

interface Market {
  key: string;
  last_update: string;
  outcomes: Outcome[];
}

interface Outcome {
  name: string;
  price: number;
  point?: number;
}

export interface GameEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: BookmakerOdds[];
}

interface GameCardProps {
  game: GameEvent;
}

const GameCard: React.FC<GameCardProps> = ({ game }) => {
  const { subscriptionTier } = useSubscription();
  const [selectedBook, setSelectedBook] = useState<BookmakerOdds>(game.bookmakers[0]);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const getOdds = (marketKey: 'h2h' | 'spreads' | 'totals') => {
    const market = selectedBook?.markets.find(m => m.key === marketKey);
    if (!market) return { home: null, away: null };
    
    const homeOutcome = market.outcomes.find(o => o.name === game.home_team);
    const awayOutcome = market.outcomes.find(o => o.name === game.away_team);

    return { home: homeOutcome, away: awayOutcome };
  };

  const moneyline = getOdds('h2h');
  const spread = getOdds('spreads');
  const total = getOdds('totals');

  const renderTierSpecificContent = () => {
    switch (subscriptionTier) {
      case 'elite':
        return (
          <>
            <div className="grid grid-cols-3 gap-2 text-center mt-4">
              <OddsDisplay homeOutcome={spread.home} awayOutcome={spread.away} marketName="Spread" />
              <OddsDisplay homeOutcome={moneyline.home} awayOutcome={moneyline.away} marketName="Moneyline" />
              <OddsDisplay homeOutcome={total.home} awayOutcome={total.away} marketName="Total" />
            </div>
            <SportsbookSelector bookmakers={game.bookmakers} selectedBook={selectedBook} onSelectBook={setSelectedBook} />
          </>
        );
      case 'pro':
        return (
            <>
                <div className="grid grid-cols-3 gap-2 text-center mt-4">
                    <OddsDisplay homeOutcome={spread.home} awayOutcome={spread.away} marketName="Spread" />
                    <OddsDisplay homeOutcome={moneyline.home} awayOutcome={moneyline.away} marketName="Moneyline" />
                    <OddsDisplay homeOutcome={total.home} awayOutcome={total.away} marketName="Total" />
                </div>
                <SportsbookSelector bookmakers={game.bookmakers} selectedBook={selectedBook} onSelectBook={setSelectedBook} />
            </>
        );
      case 'free':
      default:
        return (
          <div className="flex flex-col justify-around items-center p-3 bg-gray-800 rounded-lg mt-4 text-center">
            <Crown className="w-6 h-6 text-yellow-500 mb-2" />
            <h4 className="font-bold text-white">Upgrade to Pro</h4>
            <p className="text-sm text-gray-400">to unlock live odds and insights</p>
          </div>
        );
    }
  };

  return (
    <motion.div
      variants={cardVariants}
      className={`rounded-lg p-4 shadow-lg transition-shadow duration-300 ${subscriptionTier === 'elite' ? 'bg-gradient-to-br from-blue-900 via-gray-900 to-gray-900 border-2 border-blue-500' : 'bg-gray-900 border border-gray-700'}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-bold text-white uppercase">{game.sport_title}</p>
          <p className="text-xs text-gray-400">
            <Clock className="inline w-3 h-3 mr-1" />
            {new Date(game.commence_time).toLocaleString()}
          </p>
        </div>
        {subscriptionTier === 'elite' && (
          <div className="flex items-center gap-2">
             <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-1.5 bg-blue-500/20 rounded-md hover:bg-blue-500/40">
                <BarChart2 className="w-4 h-4 text-blue-400" />
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-1.5 bg-purple-500/20 rounded-md hover:bg-purple-500/40">
                <Zap className="w-4 h-4 text-purple-400" />
            </motion.button>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
            <span className="font-semibold text-lg text-white">{game.away_team}</span>
        </div>
        <div className="flex items-center justify-center my-2">
            <span className="text-gray-500">vs</span>
        </div>
        <div className="flex items-center justify-between">
            <span className="font-semibold text-lg text-white">{game.home_team}</span>
        </div>
      </div>
      
      {renderTierSpecificContent()}
    </motion.div>
  );
};

export default GameCard;
