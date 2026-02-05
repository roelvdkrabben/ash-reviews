'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import PrioritySliders from '@/components/PrioritySliders'
import ScheduledReviewsTimeline from '@/components/ScheduledReviewsTimeline'
import type { Shop } from '@/lib/schema'

interface SyncResult {
  success: boolean
  productsSync: { created: number; updated: number; total: number }
  reviewsImport: { imported: number; skipped: number; failed: number }
  reviewsLinked: number
  error?: string
  duration: number
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

function formatRelativeTime(date: Date | string | null): string {
  if (!date) return 'Nog nooit'
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Zojuist'
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minuut' : 'minuten'} geleden`
  if (diffHours < 24) return `${diffHours} uur geleden`
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'dag' : 'dagen'} geleden`
  return then.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function ShopDetailPage() {
  const params = useParams()
  const router = useRouter()
  const shopId = params.id as string

  const [shop, setShop] = useState<Shop | null>(null)
  const [allShops, setAllShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [generateResult, setGenerateResult] = useState<{ generated: number; products: string[] } | null>(null)

  // API Form state
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')

  // Settings Form state
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

  const fetchShop = useCallback(async () => {
    try {
      const [shopRes, settingsRes, allShopsRes] = await Promise.all([
        fetch(`/api/shops/${shopId}`),
        fetch(`/api/shops/${shopId}/settings`),
        fetch(`/api/shops`)
      ])
      
      if (!shopRes.ok) throw new Error('Shop niet gevonden')
      const shopData = await shopRes.json()
      setShop(shopData)
      setApiKey(shopData.lightspeedApiKey || '')
      setApiSecret(shopData.lightspeedApiSecret || '')
      
      if (allShopsRes.ok) {
        const shopsData = await allShopsRes.json()
        setAllShops(shopsData)
      }

      if (settingsRes.ok) {
        const settings = await settingsRes.json()
        setReviewsPerWeek(settings.reviewsPerWeek ?? 10)
        setActiveDays(settings.activeDays ?? ['tue', 'wed', 'thu', 'sat'])
        setTimeSlotStart(settings.timeSlotStart ?? '09:00')
        setTimeSlotEnd(settings.timeSlotEnd ?? '21:00')
        setMinHoursBetween(settings.minHoursBetween ?? 4)
        setPriorityBestsellers(settings.priorityBestsellers ?? 60)
        setPriorityNoReviews(settings.priorityNoReviews ?? 25)
        setPriorityStale(settings.priorityStale ?? 15)
        setStaleDaysThreshold(settings.staleDaysThreshold ?? 30)
        setAutoGenerate(settings.autoGenerate === 'true' || settings.autoGenerate === true)
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => { fetchShop() }, [fetchShop])

  const handleSaveApi = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/shops/${shopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lightspeedApiKey: apiKey || null, lightspeedApiSecret: apiSecret || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Opslaan mislukt')
      setSuccess('API credentials opgeslagen!')
      await fetchShop()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (priorityBestsellers + priorityNoReviews + priorityStale !== 100) {
      setError('Prioriteiten moeten optellen tot 100%')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/shops/${shopId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewsPerWeek, activeDays, timeSlotStart, timeSlotEnd, minHoursBetween,
          priorityBestsellers, priorityNoReviews, priorityStale, staleDaysThreshold,
          autoGenerate: autoGenerate ? 'true' : 'false',
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Opslaan mislukt')
      setSuccess('Instellingen opgeslagen!')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    setSuccess(null)
    setSyncResult(null)

    try {
      const res = await fetch(`/api/shops/${shopId}/sync-all`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Sync mislukt')
      setSyncResult(data)
      setSuccess('Synchronisatie voltooid!')
      await fetchShop()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync mislukt')
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Weet je zeker dat je deze shop wilt verwijderen?')) return
    try {
      const res = await fetch(`/api/shops/${shopId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Verwijderen mislukt')
      router.push('/shops')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verwijderen mislukt')
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setSuccess(null)
    setGenerateResult(null)

    try {
      const res = await fetch(`/api/shops/${shopId}/generate`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 3 }) // Generate 3 reviews at a time
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Generatie mislukt')
      setGenerateResult({ generated: data.generated, products: data.products })
      setSuccess(`${data.generated} review(s) gegenereerd!`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generatie mislukt')
    } finally {
      setGenerating(false)
    }
  }

  const handleDayToggle = (day: string) => {
    setActiveDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
  if (!shop) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">Shop niet gevonden</div>

  const hasApiCredentials = shop.lightspeedApiKey && shop.lightspeedApiSecret

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/shops" className="hover:text-gray-700">Shops</Link>
            <span>→</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={shopId}
              onChange={(e) => router.push(`/shops/${e.target.value}`)}
              className="text-2xl font-bold text-gray-900 bg-transparent border-none cursor-pointer hover:text-blue-600 focus:outline-none focus:ring-0 pr-8 -ml-1"
              style={{ appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0 center', backgroundSize: '1.5rem' }}
            >
              {allShops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <p className="text-gray-600 mt-1">{shop.domain}</p>
        </div>
        <Link href={`/shops/${shopId}/products`} className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
          Bekijk producten →
        </Link>
      </div>

      {/* Messages */}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">{success}</div>}
      {syncResult && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg">
          <div className="font-medium mb-2">Sync resultaat:</div>
          <ul className="text-sm space-y-1">
            <li>✓ Producten: {syncResult.productsSync.created} nieuw, {syncResult.productsSync.updated} bijgewerkt</li>
            <li>✓ Reviews: {syncResult.reviewsImport.imported} geïmporteerd, {syncResult.reviewsImport.skipped} overgeslagen</li>
            <li>✓ Reviews gekoppeld: {syncResult.reviewsLinked}</li>
          </ul>
        </div>
      )}
      {generateResult && (
        <div className="bg-purple-50 border border-purple-200 text-purple-800 px-4 py-3 rounded-lg">
          <div className="font-medium mb-2">Generatie resultaat:</div>
          <ul className="text-sm space-y-1">
            <li>✓ {generateResult.generated} review(s) gegenereerd</li>
            {generateResult.products.map((p, i) => (
              <li key={i} className="text-purple-600">• {p}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Sync Section */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">🔄 Synchronisatie</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">Laatste products sync</div>
                  <div className="font-medium text-sm">{formatRelativeTime(shop.lastProductsSync)}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500">Laatste reviews sync</div>
                  <div className="font-medium text-sm">{formatRelativeTime(shop.lastReviewsSync)}</div>
                </div>
              </div>
              <button onClick={handleSync} disabled={syncing || !hasApiCredentials}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md text-white font-medium ${syncing || !hasApiCredentials ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
                {syncing ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> Synchroniseren...</> : '🔄 Sync Producten & Reviews'}
              </button>
              {!hasApiCredentials && <p className="text-sm text-amber-600 text-center">Configureer eerst je API credentials</p>}
            </div>
          </div>

          {/* Generate Section */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">✨ Reviews Genereren</h2>
              <p className="text-sm text-gray-500 mt-1">Genereer direct reviews op basis van je instellingen</p>
            </div>
            <div className="px-6 py-4">
              <button onClick={handleGenerate} disabled={generating}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md text-white font-medium ${generating ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
                {generating ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> Genereren...</> : '✨ Genereer 3 Reviews Nu'}
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Selecteert producten op basis van je priority instellingen
              </p>
            </div>
          </div>

          {/* API Configuration */}
          <form onSubmit={handleSaveApi} className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">🔑 Lightspeed API</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">API Key</label>
                <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-3 py-2 border" placeholder="Je Lightspeed API key" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">API Secret</label>
                <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-3 py-2 border" placeholder="Je Lightspeed API secret" />
              </div>
              <div className="flex justify-between items-center pt-2">
                <button type="button" onClick={handleDelete} className="text-red-600 hover:text-red-800 text-sm">Shop verwijderen</button>
                <button type="submit" disabled={saving} className={`px-4 py-2 text-sm font-medium rounded-md text-white ${saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column - Settings */}
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Volume */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">📊 Volume & Planning</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">Reviews per week</span>
                  <span className="font-bold text-blue-600">{reviewsPerWeek}</span>
                </div>
                <input type="range" min="2" max="20" value={reviewsPerWeek} onChange={e => setReviewsPerWeek(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Actieve dagen</label>
                <div className="flex flex-wrap gap-1">
                  {DAYS.map(day => (
                    <button key={day.key} type="button" onClick={() => handleDayToggle(day.key)}
                      className={`px-2 py-1 rounded text-xs font-medium ${activeDays.includes(day.key) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Van</label>
                  <input type="time" value={timeSlotStart} onChange={e => setTimeSlotStart(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tot</label>
                  <input type="time" value={timeSlotEnd} onChange={e => setTimeSlotEnd(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Min. uren tussen reviews</label>
                <input type="number" min="1" max="24" value={minHoursBetween} onChange={e => setMinHoursBetween(parseInt(e.target.value) || 4)}
                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md" />
              </div>
            </div>
          </div>

          {/* Priority */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">🎯 Product Prioriteit</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <PrioritySliders bestsellers={priorityBestsellers} noReviews={priorityNoReviews} stale={priorityStale}
                onChange={v => { setPriorityBestsellers(v.bestsellers); setPriorityNoReviews(v.noReviews); setPriorityStale(v.stale) }} />
              <div className="pt-3 border-t">
                <label className="block text-xs font-medium text-gray-700 mb-1">Dagen voor "lang niet reviewed"</label>
                <input type="number" min="7" max="365" value={staleDaysThreshold} onChange={e => setStaleDaysThreshold(parseInt(e.target.value) || 30)}
                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md" />
              </div>
            </div>
          </div>

          {/* Auto Generate + Save */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={autoGenerate} onChange={e => setAutoGenerate(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded" />
                <span className="text-sm font-medium text-gray-700">🤖 Auto-genereren</span>
              </label>
              <button type="submit" disabled={saving}
                className={`px-4 py-2 text-sm font-medium rounded-md text-white ${saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {saving ? 'Opslaan...' : '💾 Instellingen opslaan'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Scheduled Reviews Timeline - Full Width */}
      <ScheduledReviewsTimeline shopId={shopId} />
    </div>
  )
}
