'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewShopPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      slug: formData.get('slug') as string,
      domain: formData.get('domain') as string,
      lightspeedApiKey: (formData.get('lightspeed_api_key') as string) || null,
      lightspeedApiSecret: (formData.get('lightspeed_api_secret') as string) || null,
    }

    try {
      const res = await fetch('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Fout bij opslaan')
      }

      router.push('/shops')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout')
      setLoading(false)
    }
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nieuwe shop toevoegen</h1>
        <p className="text-gray-600 mt-1">Verbind een nieuwe webshop met het platform</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Shop naam *
          </label>
          <input
            type="text"
            name="name"
            id="name"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="Mijn Webshop"
            onChange={(e) => {
              const slugInput = document.getElementById('slug') as HTMLInputElement
              if (slugInput && !slugInput.dataset.modified) {
                slugInput.value = generateSlug(e.target.value)
              }
            }}
          />
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
            Slug *
          </label>
          <input
            type="text"
            name="slug"
            id="slug"
            required
            pattern="[a-z0-9-]+"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="mijn-webshop"
            onChange={(e) => {
              e.currentTarget.dataset.modified = 'true'
            }}
          />
          <p className="text-xs text-gray-500 mt-1">Alleen kleine letters, cijfers en streepjes</p>
        </div>

        <div>
          <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
            Domein *
          </label>
          <input
            type="text"
            name="domain"
            id="domain"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            placeholder="mijnwebshop.nl"
          />
        </div>

        <hr className="border-gray-200" />

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Lightspeed API (optioneel)</h3>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="lightspeed_api_key" className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="text"
                name="lightspeed_api_key"
                id="lightspeed_api_key"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Je Lightspeed API key"
              />
            </div>

            <div>
              <label htmlFor="lightspeed_api_secret" className="block text-sm font-medium text-gray-700 mb-1">
                API Secret
              </label>
              <input
                type="password"
                name="lightspeed_api_secret"
                id="lightspeed_api_secret"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Je Lightspeed API secret"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Bezig...' : 'Shop toevoegen'}
          </button>
        </div>
      </form>
    </div>
  )
}
