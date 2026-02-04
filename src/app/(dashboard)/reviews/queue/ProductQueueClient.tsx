'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { productQueue, products, shops } from '@/lib/schema'
import { AddProductsModal } from './AddProductsModal'

interface QueueItemWithRelations {
  queueItem: typeof productQueue.$inferSelect
  product: typeof products.$inferSelect | null
  shop: typeof shops.$inferSelect | null
}

interface ProductQueueClientProps {
  queueItems: QueueItemWithRelations[]
  shops: Array<typeof shops.$inferSelect>
  currentShopFilter: string
  stats: { pending: number; generating: number; completed: number; failed: number }
}

const statusConfig = {
  pending: { label: '⏳ Wacht', color: 'bg-yellow-100 text-yellow-800' },
  generating: { label: '✍️ Genereren', color: 'bg-blue-100 text-blue-800' },
  completed: { label: '✅ Klaar', color: 'bg-green-100 text-green-800' },
  failed: { label: '❌ Mislukt', color: 'bg-red-100 text-red-800' },
}

export function ProductQueueClient({ 
  queueItems: initialItems, 
  shops, 
  currentShopFilter,
  stats: initialStats 
}: ProductQueueClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [queueItems, setQueueItems] = useState(initialItems)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [stats, setStats] = useState(initialStats)

  // Update list when props change
  useEffect(() => {
    setQueueItems(initialItems)
    setSelectedIds(new Set())
    setStats(initialStats)
  }, [initialItems, initialStats])

  const handleShopChange = (shopId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (shopId === 'all') {
      params.delete('shop')
    } else {
      params.set('shop', shopId)
    }
    params.set('tab', 'products')
    router.push(`/reviews/queue?${params.toString()}`)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
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
    setSelectedIds(new Set(queueItems.filter(i => i.queueItem.status === 'pending').map(i => i.queueItem.id)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const handleRemove = async (id: string) => {
    setLoading(id)
    try {
      const res = await fetch(`/api/queue/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove')
      
      setQueueItems(prev => prev.filter(i => i.queueItem.id !== id))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch (e) {
      console.error(e)
      alert('Kon item niet verwijderen')
    } finally {
      setLoading(null)
    }
  }

  const handleBulkRemove = async () => {
    if (selectedIds.size === 0) return
    
    setLoading('bulk')
    try {
      const res = await fetch('/api/queue/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      })
      if (!res.ok) throw new Error('Failed to remove')
      
      setQueueItems(prev => prev.filter(i => !selectedIds.has(i.queueItem.id)))
      setSelectedIds(new Set())
    } catch (e) {
      console.error(e)
      alert('Kon items niet verwijderen')
    } finally {
      setLoading(null)
    }
  }

  const handleClearCompleted = async () => {
    setLoading('clear')
    try {
      const res = await fetch('/api/queue/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearCompleted: true })
      })
      if (!res.ok) throw new Error('Failed to clear')
      
      setQueueItems(prev => prev.filter(i => i.queueItem.status !== 'completed'))
      router.refresh()
    } catch (e) {
      console.error(e)
      alert('Kon voltooide items niet wissen')
    } finally {
      setLoading(null)
    }
  }

  const handleProcess = async (ids?: string[]) => {
    setProcessing(true)
    try {
      const res = await fetch('/api/queue/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, limit: 5 })
      })
      
      if (!res.ok) throw new Error('Failed to process')
      
      const result = await res.json()
      
      // Show result
      alert(`Verwerkt: ${result.processed}\nGeslaagd: ${result.succeeded}\nMislukt: ${result.failed}`)
      
      // Refresh the page to get updated data
      router.refresh()
    } catch (e) {
      console.error(e)
      alert('Kon queue niet verwerken')
    } finally {
      setProcessing(false)
      setSelectedIds(new Set())
    }
  }

  const handleProcessSelected = () => {
    if (selectedIds.size === 0) return
    handleProcess(Array.from(selectedIds))
  }

  const handleUpdatePriority = async (id: string, priority: number) => {
    try {
      const res = await fetch(`/api/queue/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority })
      })
      if (!res.ok) throw new Error('Failed to update')
      
      setQueueItems(prev => prev.map(i => 
        i.queueItem.id === id 
          ? { ...i, queueItem: { ...i.queueItem, priority } }
          : i
      ))
    } catch (e) {
      console.error(e)
    }
  }

  const handleProductsAdded = () => {
    setShowAddModal(false)
    router.refresh()
  }

  return (
    <>
      {/* Controls */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow p-4 flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Shop filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Shop:</label>
            <select
              value={currentShopFilter}
              onChange={(e) => handleShopChange(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle shops</option>
              {shops.map(shop => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
          </div>

          {/* Selection controls */}
          <div className="flex items-center gap-2 border-l pl-4">
            <span className="text-sm text-gray-600">{selectedIds.size} geselecteerd</span>
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Alles
            </button>
            <button
              onClick={deselectAll}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Geen
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            ➕ Producten toevoegen
          </button>
          <button
            onClick={() => handleProcess()}
            disabled={processing || stats.pending === 0}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? '⏳ Bezig...' : `▶️ Verwerk Queue (${stats.pending})`}
          </button>
        </div>
      </div>

      {/* Bulk actions row */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <span className="text-sm text-blue-800 font-medium">{selectedIds.size} geselecteerd:</span>
          <button
            onClick={handleProcessSelected}
            disabled={processing}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
          >
            ▶️ Genereer nu
          </button>
          <button
            onClick={handleBulkRemove}
            disabled={loading === 'bulk'}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
          >
            🗑️ Verwijderen
          </button>
        </div>
      )}

      {/* Clear completed button */}
      {stats.completed > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleClearCompleted}
            disabled={loading === 'clear'}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            🧹 Voltooide items wissen ({stats.completed})
          </button>
        </div>
      )}

      {/* Empty state */}
      {queueItems.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Product wachtrij is leeg</h3>
          <p className="text-gray-500 mb-4">Voeg producten toe om reviews te genereren.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            ➕ Producten toevoegen
          </button>
        </div>
      )}

      {/* Queue items */}
      {queueItems.length > 0 && (
        <div className="space-y-3">
          {queueItems.map((item) => (
            <QueueItemCard
              key={item.queueItem.id}
              item={item}
              isSelected={selectedIds.has(item.queueItem.id)}
              onToggleSelect={() => toggleSelect(item.queueItem.id)}
              onRemove={() => handleRemove(item.queueItem.id)}
              onUpdatePriority={(p) => handleUpdatePriority(item.queueItem.id, p)}
              loading={loading === item.queueItem.id}
            />
          ))}
        </div>
      )}

      {/* Add products modal */}
      {showAddModal && (
        <AddProductsModal
          shops={shops}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleProductsAdded}
        />
      )}
    </>
  )
}

interface QueueItemCardProps {
  item: QueueItemWithRelations
  isSelected: boolean
  onToggleSelect: () => void
  onRemove: () => void
  onUpdatePriority: (priority: number) => void
  loading: boolean
}

function QueueItemCard({ item, isSelected, onToggleSelect, onRemove, onUpdatePriority, loading }: QueueItemCardProps) {
  const { queueItem, product, shop } = item
  const status = statusConfig[queueItem.status as keyof typeof statusConfig] || statusConfig.pending

  return (
    <div className={`bg-white rounded-lg shadow p-4 transition-all ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
      <div className="flex items-center gap-4">
        {/* Checkbox - only for pending items */}
        {queueItem.status === 'pending' && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        )}
        {queueItem.status !== 'pending' && <div className="w-5" />}

        {/* Product image */}
        {product?.imageUrl ? (
          <img 
            src={product.imageUrl} 
            alt={product.name}
            className="w-16 h-16 object-cover rounded-lg"
          />
        ) : (
          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
            📦
          </div>
        )}

        {/* Product info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-900 truncate">{product?.name || 'Onbekend product'}</h3>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.color}`}>
              {status.label}
            </span>
          </div>
          
          <div className="flex items-center gap-3 text-sm text-gray-500">
            {shop && (
              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                🏪 {shop.name}
              </span>
            )}
            <span>
              📅 {new Date(queueItem.addedAt!).toLocaleDateString('nl-NL', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          {/* Error message */}
          {queueItem.status === 'failed' && queueItem.error && (
            <p className="text-sm text-red-600 mt-1">❌ {queueItem.error}</p>
          )}

          {/* Link to review if completed */}
          {queueItem.status === 'completed' && queueItem.reviewId && (
            <Link
              href={`/reviews/${queueItem.reviewId}`}
              className="text-sm text-blue-600 hover:text-blue-800 mt-1 inline-block"
            >
              📝 Bekijk review →
            </Link>
          )}
        </div>

        {/* Priority input - only for pending items */}
        {queueItem.status === 'pending' && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Prioriteit:</label>
            <input
              type="number"
              value={queueItem.priority || 0}
              onChange={(e) => onUpdatePriority(parseInt(e.target.value) || 0)}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
              min={0}
              max={100}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {queueItem.status === 'pending' && (
            <button
              onClick={onRemove}
              disabled={loading}
              className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm disabled:opacity-50"
            >
              🗑️
            </button>
          )}
          {queueItem.status === 'completed' && (
            <button
              onClick={onRemove}
              disabled={loading}
              className="px-3 py-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded text-sm disabled:opacity-50"
              title="Verwijder uit geschiedenis"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
