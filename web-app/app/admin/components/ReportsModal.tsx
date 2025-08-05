'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, BarChart2, PieChart, Download, Users, DollarSign, TrendingUp } from 'lucide-react'

interface ReportsModalProps {
  isOpen: boolean
  onClose: () => void
}

const ReportsModal = ({ isOpen, onClose }: ReportsModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-6xl h-[90vh] text-white shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-gray-800 rounded-lg">
                  <BarChart2 className="w-6 h-6 text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Business Intelligence Reports</h2>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
                onClick={onClose}
              >
                <X className="w-6 h-6" />
              </motion.button>
            </header>

            <main className="flex-1 p-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Placeholder for charts */}
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 text-gray-300">Revenue Overview</h3>
                  <div className="h-64 flex items-center justify-center text-gray-500">Chart will be here</div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 text-gray-300">Downloads & Acquisition</h3>
                  <div className="h-64 flex items-center justify-center text-gray-500">Chart will be here</div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 text-gray-300">Subscription Events</h3>
                  <div className="h-64 flex items-center justify-center text-gray-500">Chart will be here</div>
                </div>
              </div>
            </main>

            <footer className="p-6 border-t border-gray-800 flex justify-end">
              <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                <Download className="w-5 h-5" />
                Export All Data
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ReportsModal
