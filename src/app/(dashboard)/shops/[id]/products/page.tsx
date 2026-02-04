'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { Product, Shop } from '@/lib/schema'

export default function ShopProductsPage() {
  const params = useParams()
  const shopId = params.id as string

  const [shop, setShop] = useState<Shop | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [shopRes, productsRes] = await Promise.all([
        fetch(`/api/shops/${shopId}`),
        fetch(`/api/shops/${shopId}/products`),
      ])

      if (!shopRes.ok) throw new Error('Shop niet gevonden')
      if (!productsRes.ok) throw new Error('Fout bij laden producten')

      const shopData = await shopRes.json()
      const productsData = await productsRes.json()

      setShop(shopData)
      setProducts(productsData)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage(null)
    setError(null)

    try {
      const res = await fetch(`/api/shops/${shopId}/sync`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Sync mislukt')
      }

      setSyncMessage(data.message)
      // Refresh products after sync
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync mislukt')
    } finally {
      setSyncing(false)
    }
  }

  const handleImportReviews = async () => {
    setImporting(true)
    setImportMessage(null)
    setError(null)

    try {
      const res = await fetch(`/api/shops/${shopId}/import-reviews`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Import mislukt')
      }

      setImportMessage(data.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import mislukt')
    } finally {
      setImporting(false)
    }
  }

  const handleGenerateReview = async (productId: string, count: number = 1) => {
    setGeneratingFor(productId)
    setError(null)
    setSuccessMessage(null)

    try {
      const res = await fetch('/api/reviews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, count }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Review genereren mislukt')
      }

      setSuccessMessage(`✅ ${count} review(s) gegenereerd!`)
      // Refresh products to update review count
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review genereren mislukt')
    } finally {
      setGeneratingFor(null)
    }
  }

  const formatPrice = (price: string | null) => {
    if (!price) return '—'
    const num = parseFloat(price)
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(num)
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Nooit'
    return new Date(date).toLocaleString('nl-NL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
            <span>{shop?.name || 'Shop'}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Producten</h1>
          <p className="text-gray-600 mt-1">
            {products.length} producten gevonden
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleImportReviews}
            disabled={importing || !shop?.lightspeedApiKey}
            className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md 
              ${importing || !shop?.lightspeedApiKey
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
          >
            {importing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Importeren...
              </>
            ) : (
              <>
                <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Reviews importeren
              </>
            )}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || !shop?.lightspeedApiKey}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white 
              ${syncing || !shop?.lightspeedApiKey
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {syncing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Synchroniseren...
              </>
            ) : (
              <>
                <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync nu
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {syncMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {syncMessage}
        </div>
      )}

      {importMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{importMessage}</span>
          <Link href="/reviews?status=imported" className="underline font-medium hover:text-green-800">
            Bekijk geïmporteerde reviews →
          </Link>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{successMessage}</span>
          <Link href={`/shops/${shopId}/reviews`} className="underline font-medium hover:text-green-800">
            Bekijk reviews →
          </Link>
        </div>
      )}

      {!shop?.lightspeedApiKey && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          ⚠️ Lightspeed API credentials niet geconfigureerd.{' '}
          <Link href={`/shops/${shopId}`} className="underline font-medium">
            Configureer API →
          </Link>
        </div>
      )}

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Geen producten</h3>
          <p className="text-gray-500 mb-4">
            {shop?.lightspeedApiKey 
              ? 'Klik op "Sync nu" om producten uit Lightspeed op te halen.'
              : 'Configureer eerst je Lightspeed API credentials.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prijs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reviews
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Laatst gesync
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acties
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-10 w-10 rounded object-cover mr-3"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-gray-200 mr-3 flex items-center justify-center">
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900 line-clamp-1">
                          {product.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {product.externalId}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatPrice(product.price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${product.reviewCount && product.reviewCount > 0
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                      }`}>
                      {product.reviewCount || 0} reviews
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(product.syncedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleGenerateReview(product.id)}
                        disabled={generatingFor === product.id}
                        className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md
                          ${generatingFor === product.id
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          }`}
                      >
                        {generatingFor === product.id ? (
                          <>
                            <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Bezig...
                          </>
                        ) : (
                          <>
                            <svg className="-ml-0.5 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            Review genereren
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
