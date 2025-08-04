'use client'
import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { useAuth } from '@/contexts/AuthContext'

interface PreferencesModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

const AVAILABLE_SPORTS = ['mlb', 'nba', 'wnba', 'ufc', 'nfl', 'nhl'] as const
type Sport = typeof AVAILABLE_SPORTS[number]

const BETTING_STYLES = ['conservative', 'balanced', 'aggressive'] as const
type BettingStyle = typeof BETTING_STYLES[number]

export default function PreferencesModal({ isOpen, onClose, onComplete }: PreferencesModalProps) {
  const { profile, updateProfile } = useAuth()
  const [selectedSports, setSelectedSports] = useState<Sport[]>(profile?.preferred_sports ?? [])
  const [bettingStyle, setBettingStyle] = useState<BettingStyle>(profile?.risk_tolerance ?? 'balanced')
  const [loading, setLoading] = useState(false)

  const toggleSport = (sport: Sport) => {
    setSelectedSports(prev =>
      prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]
    )
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await updateProfile({ preferred_sports: selectedSports, risk_tolerance: bettingStyle })
      onComplete()
      onClose()
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={onClose}>
        <div className="min-h-screen px-4 text-center">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
          <span className="inline-block h-screen align-middle" aria-hidden="true">\u200E</span>
          <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle bg-white shadow-xl rounded-lg">
            <Dialog.Title className="text-lg font-medium">Your Preferences</Dialog.Title>
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Select your favorite sports</h3>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_SPORTS.map(sport => (
                  <button
                    key={sport}
                    onClick={() => toggleSport(sport)}
                    className={`p-2 border rounded ${selectedSports.includes(sport) ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                  >
                    {sport.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Choose your betting style</h3>
              <div className="space-y-2">
                {BETTING_STYLES.map(style => (
                  <label key={style} className="flex items-center">
                    <input
                      type="radio"
                      name="bettingStyle"
                      value={style}
                      checked={bettingStyle === style}
                      onChange={() => setBettingStyle(style)}
                      className="mr-2"
                    />
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
              <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}