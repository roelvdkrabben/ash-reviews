'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Shop } from '@/lib/schema'

interface SyncResult {
  success: boolean
  productsSync: {
    created: number
    updated: number
    total: number
  }
  reviewsImport: {
    imported: number
    skipped: number
    failed: number
  }
  reviewsLinked: number
  error?: string
  duration: number
}

/**
 * Format relative time in Dutch
 */
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
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'uur' : 'uur'} geleden`
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'dag' : 'dagen'} geleden`
  
  return then.toLocaleDateString('nl-NL', { 
    day: 'numeric', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function ShopDetailPage() {
  const params = useParams()
  const router = useRouter()
  const shopId = params.id as string

  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  // Form state
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')

  const fetchShop = useCallback(async () => {
    try {
      const res = await fetch(`/api/shops/${shopId}`)
      if (!res.ok) throw new Error('Shop niet gevonden')
      const data = await res.json()
      setShop(data)
      setApiKey(data.lightspeedApiKey || '')
      setApiSecret(data.lightspeedApiSecret || '')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    fetchShop()
  }, [fetchShop])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/shops/${shopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lightspeedApiKey: apiKey || null,
          lightspeedApiSecret: apiSecret || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Opslaan mislukt')
      }

      setSuccess('API credentials opgeslagen!')
      await fetchShop()
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
      const res = await fetch(`/api/shops/${shopId}/sync-all`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Synchronisatie mislukt')
      }

      setSyncResult(data)
      setSuccess('Synchronisatie voltooid!')
      await fetchShop() // Refresh to get updated timestamps
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Synchronisatie mislukt')
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Weet je zeker dat je deze shop wilt verwijderen? Dit verwijdert ook alle producten en reviews.')) {
      return
    }

    try {
      const res = await fetch(`/api/shops/${shopId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Verwijderen mislukt')
      }

      router.push('/shops')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verwijderen mislukt')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        Shop niet gevonden
      </div>
    )
  }

  const hasApiCredentials = shop.lightspeedApiKey && shop.lightspeedApiSecret

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/shops" className="hover:text-gray-700">
              Shops
            </Link>
            <span>→</span>
            <span>{shop.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
          <p className="text-gray-600 mt-1">{shop.domain}</p>
        </div>
        <Link
          href={`/shops/${shopId}/products`}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Bekijk producten →
        </Link>
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

      {/* Sync Result Details */}
      {syncResult && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg">
          <div className="font-medium mb-2">Synchronisatie resultaat:</div>
          <ul className="text-sm space-y-1">
            <li>✓ Producten: {syncResult.productsSync.created} nieuw, {syncResult.productsSync.updated} bijgewerkt</li>
            <li>✓ Reviews: {syncResult.reviewsImport.imported} geïmporteerd, {syncResult.reviewsImport.skipped} overgeslagen</li>
            <li>✓ Reviews gekoppeld: {syncResult.reviewsLinked}</li>
            <li className="text-gray-600">Duur: {(syncResult.duration / 1000).toFixed(1)}s</li>
          </ul>
        </div>
      )}

      {/* Sync Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Synchronisatie</h2>
          <p className="text-sm text-gray-500 mt-1">
            Synchroniseer producten en reviews van Lightspeed.
          </p>
        </div>

        <div className="px-6 py-4">
          {/* Sync Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl">📦</div>
              <div>
                <div className="text-sm text-gray-500">Laatste producten sync</div>
                <div className="font-medium text-gray-900">
                  {formatRelativeTime(shop.lastProductsSync)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl">⭐</div>
              <div>
                <div className="text-sm text-gray-500">Laatste reviews sync</div>
                <div className="font-medium text-gray-900">
                  {formatRelativeTime(shop.lastReviewsSync)}
                </div>
              </div>
            </div>
          </div>

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={syncing || !hasApiCredentials}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md text-white font-medium transition-colors
              ${syncing 
                ? 'bg-gray-400 cursor-not-allowed' 
                : hasApiCredentials
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
          >
            {syncing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Synchroniseren...
              </>
            ) : (
              <>
                🔄 Sync Producten & Reviews
              </>
            )}
          </button>

          {!hasApiCredentials && (
            <p className="text-sm text-amber-600 mt-2 text-center">
              Configureer eerst je Lightspeed API credentials hieronder.
            </p>
          )}
        </div>
      </div>

      {/* API Configuration */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Lightspeed API Configuratie</h2>
          <p className="text-sm text-gray-500 mt-1">
            Vul je Lightspeed eCom API credentials in om producten te synchroniseren.
          </p>
        </div>

        <form onSubmit={handleSave} className="px-6 py-4 space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
              API Key
            </label>
            <input
              type="text"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              placeholder="Je Lightspeed API key"
            />
          </div>

          <div>
            <label htmlFor="apiSecret" className="block text-sm font-medium text-gray-700">
              API Secret
            </label>
            <input
              type="password"
              id="apiSecret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              placeholder="Je Lightspeed API secret"
            />
            <p className="mt-1 text-xs text-gray-500">
              Je vindt deze in Lightspeed onder Instellingen → API
            </p>
          </div>

          <div className="flex justify-between items-center pt-4">
            <button
              type="button"
              onClick={handleDelete}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Shop verwijderen
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white 
                ${saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow px-6 py-4">
          <div className="text-sm text-gray-500">API Status</div>
          <div className="mt-1">
            {shop.lightspeedApiKey ? (
              <span className="text-green-600 font-medium">✓ Geconfigureerd</span>
            ) : (
              <span className="text-yellow-600 font-medium">○ Niet geconfigureerd</span>
            )}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow px-6 py-4">
          <div className="text-sm text-gray-500">Slug</div>
          <div className="mt-1 font-medium text-gray-900">{shop.slug}</div>
        </div>
        <div className="bg-white rounded-lg shadow px-6 py-4">
          <div className="text-sm text-gray-500">Aangemaakt</div>
          <div className="mt-1 font-medium text-gray-900">
            {shop.createdAt ? new Date(shop.createdAt).toLocaleDateString('nl-NL') : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}
