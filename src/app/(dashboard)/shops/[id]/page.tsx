'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Shop } from '@/lib/schema'

export default function ShopDetailPage() {
  const params = useParams()
  const router = useRouter()
  const shopId = params.id as string

  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
