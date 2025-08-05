'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Target } from 'lucide-react'
import AIPredictionsSection from './AIPredictionsSection'

interface TodaysPicksModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function TodaysPicksModal({ isOpen, onClose }: TodaysPicksModalProps) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-slate-800 rounded-xl max-w-7xl w-full max-h-[90vh] overflow-hidden border border-white/10"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-2xl font-bold text-white flex items-center space-x-3">
              <Target className="w-6 h-6 text-purple-400" />
              <span>Today's AI Predictions</span>
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <AIPredictionsSection />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}