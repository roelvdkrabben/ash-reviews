'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Shop {
  id: string
  name: string
  slug: string
  domain: string
  lightspeedApiKey: string | null
  lightspeedApiSecret: string | null
}

export default function EditShopPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shopId, setShopId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    domain: '',
    lightspeedApiKey: '',
    lightspeedApiSecret: '',
  })

  useEffect(() => {
    params.then(p => setShopId(p.id))
  }, [params])

  useEffect(() => {
    if (!shopId) return
    
    async function fetchShop() {
      try {
        const res = await fetch(`/api/shops/${shopId}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('Shop niet gevonden')
          } else {
            throw new Error('Fout bij ophalen')
          }
          return
        }
        const data = await res.json()
        setShop(data)
        setFormData({
          name: data.name || '',
          slug: data.slug || '',
          domain: data.domain || '',
          lightspeedApiKey: data.lightspeedApiKey || '',
          lightspeedApiSecret: data.lightspeedApiSecret || '',
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Onbekende fout')
      } finally {
        setLoading(false)
      }
    }
    fetchShop()
  }, [shopId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop) return
    
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/shops/${shop.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Opslaan mislukt')
      }

      router.push(`/shops/${shop.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error && !shop) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
        <Link href="/shops" className="text-blue-600 hover:text-blue-800">
          ← Terug naar shops
        </Link>
      </div>
    )
  }

  if (!shop) return null

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="text-sm text-gray-500">
        <Link href="/shops" className="hover:text-blue-600">Shops</Link>
        <span className="mx-2">/</span>
        <Link href={`/shops/${shop.id}`} className="hover:text-blue-600">{shop.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Bewerken</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shop Bewerken</h1>
        <p className="text-gray-500 mt-1">Pas de instellingen van {shop.name} aan</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Basisinformatie</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Shop Naam *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Mijn Webshop"
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
              Slug *
            </label>
            <input
              type="text"
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono"
              placeholder="mijn-webshop"
            />
            <p className="mt-1 text-sm text-gray-500">
              Unieke identifier, alleen kleine letters, cijfers en streepjes
            </p>
          </div>

          <div>
            <label htmlFor="domain" className="block text-sm font-medium text-gray-700">
              Domein *
            </label>
            <input
              type="text"
              id="domain"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="mijnwebshop.nl"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Lightspeed API Credentials</h2>
          <p className="text-sm text-gray-500 mt-1">
            Vind je API credentials in je Lightspeed admin onder Instellingen → API
          </p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
              API Key
            </label>
            <input
              type="text"
              id="apiKey"
              value={formData.lightspeedApiKey}
              onChange={(e) => setFormData({ ...formData, lightspeedApiKey: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <label htmlFor="apiSecret" className="block text-sm font-medium text-gray-700">
              API Secret
            </label>
            <input
              type="password"
              id="apiSecret"
              value={formData.lightspeedApiSecret}
              onChange={(e) => setFormData({ ...formData, lightspeedApiSecret: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono"
              placeholder="••••••••••••"
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
          <Link
            href={`/shops/${shop.id}`}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Annuleren
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </form>
    </div>
  )
}
