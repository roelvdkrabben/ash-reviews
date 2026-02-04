'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import PrioritySliders from '@/components/PrioritySliders'

interface ShopSettings {
  id: string
  name: string
  reviewsPerWeek: number
  activeDays: string[]
  timeSlotStart: string
  timeSlotEnd: string
  minHoursBetween: number
  priorityBestsellers: number
  priorityNoReviews: number
  priorityStale: number
  staleDaysThreshold: number
  autoGenerate: string
}

const DAYS = [
  { key: 'mon', label: 'Ma' },
  { key: 'tue', label: 'Di' },
  { key: 'wed', label: 'Wo' },
  { key: 'thu', label: 'Do' },
  { key: 'fri', label: 'Vr' },
  { key: 'sat', label: 'Za' },
  { key: 'sun', label: 'Zo' },
]

export default function ShopSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const shopId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [shopName, setShopName] = useState('')

  // Form state
  const [reviewsPerWeek, setReviewsPerWeek] = useState(10)
  const [activeDays, setActiveDays] = useState<string[]>(['tue', 'wed', 'thu', 'sat'])
  const [timeSlotStart, setTimeSlotStart] = useState('09:00')
  const [timeSlotEnd, setTimeSlotEnd] = useState('21:00')
  const [minHoursBetween, setMinHoursBetween] = useState(4)
  const [priorityBestsellers, setPriorityBestsellers] = useState(60)
  const [priorityNoReviews, setPriorityNoReviews] = useState(25)
  const [priorityStale, setPriorityStale] = useState(15)
  const [staleDaysThreshold, setStaleDaysThreshold] = useState(30)
  const [autoGenerate, setAutoGenerate] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/shops/${shopId}/settings`)
      if (!res.ok) throw new Error('Instellingen niet gevonden')
      const data: ShopSettings = await res.json()
      
      setShopName(data.name)
      setReviewsPerWeek(data.reviewsPerWeek ?? 10)
      setActiveDays(data.activeDays ?? ['tue', 'wed', 'thu', 'sat'])
      setTimeSlotStart(data.timeSlotStart ?? '09:00')
      setTimeSlotEnd(data.timeSlotEnd ?? '21:00')
      setMinHoursBetween(data.minHoursBetween ?? 4)
      setPriorityBestsellers(data.priorityBestsellers ?? 60)
      setPriorityNoReviews(data.priorityNoReviews ?? 25)
      setPriorityStale(data.priorityStale ?? 15)
      setStaleDaysThreshold(data.staleDaysThreshold ?? 30)
      setAutoGenerate(data.autoGenerate === 'true')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleDayToggle = (day: string) => {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handlePriorityChange = (values: { bestsellers: number; noReviews: number; stale: number }) => {
    setPriorityBestsellers(values.bestsellers)
    setPriorityNoReviews(values.noReviews)
    setPriorityStale(values.stale)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    // Validate priorities sum to 100
    if (priorityBestsellers + priorityNoReviews + priorityStale !== 100) {
      setError('Prioriteiten moeten optellen tot 100%')
      setSaving(false)
      return
    }

    try {
      const res = await fetch(`/api/shops/${shopId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewsPerWeek,
          activeDays,
          timeSlotStart,
          timeSlotEnd,
          minHoursBetween,
          priorityBestsellers,
          priorityNoReviews,
          priorityStale,
          staleDaysThreshold,
          autoGenerate: autoGenerate ? 'true' : 'false',
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Opslaan mislukt')
      }

      setSuccess('Instellingen opgeslagen!')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/shops" className="hover:text-gray-700">Shops</Link>
          <span>→</span>
          <Link href={`/shops/${shopId}`} className="hover:text-gray-700">{shopName}</Link>
          <span>→</span>
          <span>Instellingen</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          ⚙️ Review Instellingen
        </h1>
        <p className="text-gray-600 mt-1">
          Configureer de review generatie voor {shopName}
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Volume Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">📊 Volume</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Reviews per week
                </label>
                <span className="text-sm font-bold text-blue-600 tabular-nums">
                  {reviewsPerWeek}
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="20"
                value={reviewsPerWeek}
                onChange={(e) => setReviewsPerWeek(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>2</span>
                <span>20</span>
              </div>
            </div>
          </div>
        </div>

        {/* Planning Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">📅 Planning</h2>
          </div>
          <div className="px-6 py-4 space-y-6">
            {/* Active Days */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Actieve dagen
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => handleDayToggle(day.key)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors
                      ${activeDays.includes(day.key)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Slot */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Tijdslot start
                </label>
                <input
                  type="time"
                  value={timeSlotStart}
                  onChange={(e) => setTimeSlotStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Tijdslot eind
                </label>
                <input
                  type="time"
                  value={timeSlotEnd}
                  onChange={(e) => setTimeSlotEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Min Hours Between */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Minimale uren tussen reviews
              </label>
              <input
                type="number"
                min="1"
                max="24"
                value={minHoursBetween}
                onChange={(e) => setMinHoursBetween(parseInt(e.target.value) || 4)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                Minimaal {minHoursBetween} uur tussen reviews op dezelfde dag
              </p>
            </div>
          </div>
        </div>

        {/* Priority Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">🎯 Product Prioriteit</h2>
            <p className="text-sm text-gray-500 mt-1">
              Bepaal welke producten prioriteit krijgen voor nieuwe reviews
            </p>
          </div>
          <div className="px-6 py-4">
            <PrioritySliders
              bestsellers={priorityBestsellers}
              noReviews={priorityNoReviews}
              stale={priorityStale}
              onChange={handlePriorityChange}
            />

            {/* Stale Days Threshold */}
            <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Dagen sinds laatste review (voor &quot;lang niet reviewed&quot;)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="7"
                  max="365"
                  value={staleDaysThreshold}
                  onChange={(e) => setStaleDaysThreshold(parseInt(e.target.value) || 30)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">dagen</span>
              </div>
              <p className="text-xs text-gray-500">
                Producten zonder review in de laatste {staleDaysThreshold} dagen worden als &quot;lang niet reviewed&quot; beschouwd
              </p>
            </div>
          </div>
        </div>

        {/* Auto Generate Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">🤖 Automatisch Genereren</h2>
          </div>
          <div className="px-6 py-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoGenerate}
                onChange={(e) => setAutoGenerate(e.target.checked)}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Automatisch reviews genereren
                </span>
                <p className="text-xs text-gray-500">
                  Reviews worden automatisch gegenereerd volgens bovenstaande instellingen
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Link
            href={`/shops/${shopId}`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annuleren
          </Link>
          <button
            type="submit"
            disabled={saving}
            className={`px-6 py-2 text-sm font-medium text-white rounded-md
              ${saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {saving ? 'Opslaan...' : '💾 Opslaan'}
          </button>
        </div>
      </form>
    </div>
  )
}
