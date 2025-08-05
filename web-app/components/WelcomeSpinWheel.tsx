'use client'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Sparkles, 
  Gift, 
  Star, 
  Zap,
  Crown,
  Trophy
} from 'lucide-react'

interface WelcomeSpinWheelProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (picks: number) => void
}

interface WheelSegment {
  picks: number
  label: string
  color: string
  startAngle: number
  endAngle: number
}

const WHEEL_SEGMENTS: WheelSegment[] = [
  { picks: 1, label: '1 Pick', color: '#ef4444', startAngle: 0, endAngle: 72 },
  { picks: 2, label: '2 Picks', color: '#f97316', startAngle: 72, endAngle: 144 },
  { picks: 3, label: '3 Picks', color: '#eab308', startAngle: 144, endAngle: 216 },
  { picks: 4, label: '4 Picks', color: '#22c55e', startAngle: 216, endAngle: 288 },
  { picks: 5, label: '5 Picks!', color: '#8b5cf6', startAngle: 288, endAngle: 360 },
]

const createPieSlice = (centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(centerX, centerY, radius, endAngle)
  const end = polarToCartesian(centerX, centerY, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"
  
  return [
    "M", centerX, centerY,
    "L", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    "Z"
  ].join(" ")
}

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  }
}

export default function WelcomeSpinWheel({ isOpen, onClose, onComplete }: WelcomeSpinWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false)
  const [hasSpun, setHasSpun] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [mounted, setMounted] = useState(false)
  
  const wheelRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    setMounted(true)
    if (isOpen) {
      // Reset state when modal opens
      setIsSpinning(false)
      setHasSpun(false)
      setResult(null)
      setShowConfetti(false)
      setRotation(0)
    }
  }, [isOpen])

  const spinWheel = () => {
    if (isSpinning || hasSpun) return
    
    setIsSpinning(true)
    
    // EXACTLY match React Native logic - always land on 5 picks!
    // Target the middle of segment 5 (288-360 degrees): 324 degrees
    const targetAngle = 324
    const spins = 5 // Number of full rotations (same as mobile)
    const finalRotation = spins * 360 + targetAngle
    
    console.log('🎰 Spinning to GUARANTEE 5 picks (matching mobile app):', {
      targetAngle,
      finalRotation,
      totalDegrees: finalRotation
    })
    
    // Animate the rotation
    const duration = 4000
    const startTime = Date.now()
    const startRotation = rotation
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const currentRotation = startRotation + (finalRotation - startRotation) * easeOut
      
      setRotation(currentRotation)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        // Animation complete
        setIsSpinning(false)
        setHasSpun(true)
        setResult(5) // Always lands on 5
        setShowConfetti(true)
      }
    }
    
    requestAnimationFrame(animate)
  }

  const handleComplete = () => {
    onComplete(5) // Always give 5 picks
  }

  if (!mounted) return null

  const WHEEL_SIZE = 280
  const WHEEL_RADIUS = WHEEL_SIZE / 2

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 rounded-3xl p-8 max-w-2xl w-full border border-purple-500/30 shadow-2xl"
          >
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Gift className="w-8 h-8 text-purple-400" />
                <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Welcome Bonus!
                </h2>
                <Sparkles className="w-8 h-8 text-yellow-400" />
              </div>
              <p className="text-gray-300 text-lg">
                Spin the wheel to unlock your free premium picks!
              </p>
            </div>

            {/* Floating Sparkles */}
            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ 
                      x: Math.random() * 400, 
                      y: -20,
                      rotate: 0,
                      scale: 0
                    }}
                    animate={{ 
                      y: 500,
                      rotate: 360,
                      scale: [0, 1, 0]
                    }}
                    transition={{ 
                      duration: 3,
                      delay: Math.random() * 2,
                      repeat: Infinity
                    }}
                    className="absolute"
                  >
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Wheel Container */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                {/* Pointer - Bigger and prominent (pointing down into wheel) */}
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="relative">
                    {/* Glow effect behind arrow */}
                    <div className="absolute inset-0 w-0 h-0 border-l-8 border-r-8 border-t-16 border-l-transparent border-r-transparent border-t-yellow-300 blur-sm opacity-60"></div>
                    {/* Main arrow */}
                    <div className="w-0 h-0 border-l-6 border-r-6 border-t-14 border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-xl"></div>
                  </div>
                </div>
                
                {/* Wheel */}
                <div 
                  ref={wheelRef}
                  className="relative"
                  style={{ 
                    transform: `rotate(${rotation}deg)`,
                    transition: isSpinning ? 'none' : 'transform 0.3s ease-out'
                  }}
                >
                  <svg width={WHEEL_SIZE} height={WHEEL_SIZE} className="drop-shadow-2xl">
                    {/* Wheel segments */}
                    {WHEEL_SEGMENTS.map((segment, index) => (
                      <g key={index}>
                        <path
                          d={createPieSlice(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_RADIUS - 10, segment.startAngle, segment.endAngle)}
                          fill={segment.color}
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="drop-shadow-lg"
                        />
                        {/* Text labels */}
                        <text
                          x={WHEEL_RADIUS + (WHEEL_RADIUS - 40) * Math.cos(((segment.startAngle + segment.endAngle) / 2 - 90) * Math.PI / 180)}
                          y={WHEEL_RADIUS + (WHEEL_RADIUS - 40) * Math.sin(((segment.startAngle + segment.endAngle) / 2 - 90) * Math.PI / 180)}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontSize="14"
                          fontWeight="bold"
                          className="drop-shadow-sm"
                        >
                          {segment.label}
                        </text>
                      </g>
                    ))}
                    
                    {/* Center circle */}
                    <circle
                      cx={WHEEL_RADIUS}
                      cy={WHEEL_RADIUS}
                      r="25"
                      fill="url(#centerGradient)"
                      stroke="#ffffff"
                      strokeWidth="3"
                      className="drop-shadow-lg"
                    />
                    
                    {/* Gradient definition */}
                    <defs>
                      <linearGradient id="centerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#7c3aed" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-xl -z-10 animate-pulse"></div>
              </div>
            </div>

            {/* Result Display */}
            {hasSpun && result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center mb-8"
              >
                <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl p-6 border border-purple-500/30">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Trophy className="w-8 h-8 text-yellow-400" />
                    <h3 className="text-2xl font-bold text-white">Congratulations!</h3>
                    <Crown className="w-8 h-8 text-yellow-400" />
                  </div>
                  <p className="text-purple-300 text-lg mb-2">You won</p>
                  <div className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    5 Premium Picks!
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    🔥 Worth $24.95 - Yours free for 24 hours!
                  </p>
                  <div className="mt-3 px-4 py-2 bg-green-500/20 border border-green-400/30 rounded-lg">
                    <p className="text-green-300 text-sm font-semibold">
                      ✅ Guaranteed: Always lands on 5 picks!
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4">
              {!hasSpun ? (
                <button
                  onClick={spinWheel}
                  disabled={isSpinning}
                  className="flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold text-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 disabled:opacity-50 shadow-2xl transform hover:scale-105"
                >
                  {isSpinning ? (
                    <>
                      <Zap className="w-6 h-6 animate-pulse" />
                      <span>Spinning...</span>
                    </>
                  ) : (
                    <>
                      <Gift className="w-6 h-6" />
                      <span>SPIN TO WIN!</span>
                      <Sparkles className="w-5 h-5" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  className="flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-2xl transform hover:scale-105"
                >
                  <Star className="w-6 h-6" />
                  <span>Claim My 5 Premium Picks!</span>
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="text-center mt-6">
              <p className="text-sm text-gray-400">
                🔥 Limited time welcome bonus - Premium picks usually cost $4.99 each!
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}