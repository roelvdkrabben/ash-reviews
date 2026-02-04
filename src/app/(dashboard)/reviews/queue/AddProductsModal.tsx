'use client'

import { useState, useEffect, useCallback } from 'react'
import type { products, shops } from '@/lib/schema'

interface AddProductsModalProps {
  shops: Array<typeof shops.$inferSelect>
  onClose: () => void
  onSuccess: () => void
}

interface Product {
  id: string
  name: string
  category: string | null
  imageUrl: string | null
  reviewCount: number
  lastReviewedAt: string | null
}

export function AddProductsModal({ shops, onClose, onSuccess }: AddProductsModalProps) {
  const [selectedShop, setSelectedShop] = useState<string>(shops[0]?.id || '')
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)

  // Fetch products for selected shop
  const fetchProducts = useCallback(async () => {
    if (!selectedShop) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams({ shopId: selectedShop })
      if (search) params.set('search', search)
      
      const res = await fetch(`/api/products?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      
      const data = await res.json()
      setProducts(data.products || [])
    } catch (e) {
      console.error(e)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [selectedShop, search])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const toggleProduct = (id: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedProducts(new Set(products.map(p => p.id)))
  }

  const deselectAll = () => {
    setSelectedProducts(new Set())
  }

  const handleAdd = async () => {
    if (selectedProducts.size === 0) return
    
    setAdding(true)
    try {
      const res = await fetch('/api/queue/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from(selectedProducts),
          shopId: selectedShop
        })
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add products')
      }
      
      const result = await res.json()
      alert(`${result.inserted} product(en) toegevoegd aan de wachtrij!${result.skipped > 0 ? ` (${result.skipped} overgeslagen - al in queue)` : ''}`)
      onSuccess()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Kon producten niet toevoegen')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Producten toevoegen aan wachtrij</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          
          {/* Filters */}
          <div className="mt-4 flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Shop</label>
              <select
                value={selectedShop}
                onChange={(e) => {
                  setSelectedShop(e.target.value)
                  setSelectedProducts(new Set())
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {shops.map(shop => (
                  <option key={shop.id} value={shop.id}>{shop.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Zoeken</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Zoek op naam of merk..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Selection controls */}
        <div className="px-6 py-3 bg-gray-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{selectedProducts.size} geselecteerd</span>
            <button onClick={selectAll} className="text-sm text-blue-600 hover:text-blue-700">
              Alles
            </button>
            <button onClick={deselectAll} className="text-sm text-gray-500 hover:text-gray-700">
              Geen
            </button>
          </div>
          
          <span className="text-sm text-gray-500">{products.length} producten</span>
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-2">📦</div>
              Geen producten gevonden
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => toggleProduct(product.id)}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                    ${selectedProducts.has(product.id) 
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(product.id)}
                    onChange={() => toggleProduct(product.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  
                  {product.imageUrl ? (
                    <img 
                      src={product.imageUrl} 
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-lg">
                      📦
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{product.name}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      {product.category && <span className="truncate">{product.category}</span>}
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                        {product.reviewCount} reviews
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Annuleren
          </button>
          
          <button
            onClick={handleAdd}
            disabled={adding || selectedProducts.size === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Toevoegen...
              </span>
            ) : (
              `➕ ${selectedProducts.size} product${selectedProducts.size !== 1 ? 'en' : ''} toevoegen`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
