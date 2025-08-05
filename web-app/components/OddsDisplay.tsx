'use client'
import React from 'react';
import { motion } from 'framer-motion';

interface Outcome {
    name: string;
    price: number;
    point?: number;
}

interface OddsDisplayProps {
    homeOutcome: Outcome | null | undefined;
    awayOutcome: Outcome | null | undefined;
    marketName: string;
}

const OddsDisplay: React.FC<OddsDisplayProps> = ({ homeOutcome, awayOutcome, marketName }) => {
    return (
        <motion.div 
            className="bg-gray-800 p-3 rounded-lg text-center"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
            <p className="text-xs text-gray-400 mb-2 font-semibold uppercase">{marketName}</p>
            <div className="flex justify-around items-center">
                <div className="flex-1">
                    <p className="text-sm font-bold text-white">{awayOutcome?.price ? `${awayOutcome.point || ''} ${awayOutcome.price > 0 ? `+${awayOutcome.price}` : awayOutcome.price}`.trim() : 'N/A'}</p>
                </div>
                <div className="flex-1">
                    <p className="text-sm font-bold text-white">{homeOutcome?.price ? `${homeOutcome.point || ''} ${homeOutcome.price > 0 ? `+${homeOutcome.price}` : homeOutcome.price}`.trim() : 'N/A'}</p>
                </div>
            </div>
        </motion.div>
    );
};

export default OddsDisplay;
