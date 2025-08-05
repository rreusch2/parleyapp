'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Server, Clock, AlertTriangle } from 'lucide-react'

interface WebhookEvent {
  id: string
  source: string
  event_type: string
  processed: boolean
  created_at: string
}

export default function WebhookEvents() {
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('webhook_events')
        .select('*')
        .order('created_at', { descending: true })
        .limit(15)

      if (error) {
        console.error('Error fetching webhook events:', error)
      } else {
        setEvents(data || [])
      }
      setLoading(false)
    }

    fetchEvents()
  }, [])

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-6">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center">
        <Server className="w-6 h-6 mr-2 text-blue-400" />
        Recent Server Notifications
      </h2>
      {loading ? (
        <p className="text-gray-400">Loading events...</p>
      ) : (
        <ul className="space-y-4">
          {events.map(event => (
            <li key={event.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <span className={`mr-3 capitalize font-semibold ${event.source === 'apple' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {event.source}
                </span>
                <span className="text-gray-300">{event.event_type}</span>
              </div>
              <div className="flex items-center text-gray-400">
                <Clock className="w-4 h-4 mr-1.5" />
                {new Date(event.created_at).toLocaleTimeString()}
                {!event.processed && <AlertTriangle className="w-4 h-4 ml-3 text-red-500" title="Not Processed" />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
