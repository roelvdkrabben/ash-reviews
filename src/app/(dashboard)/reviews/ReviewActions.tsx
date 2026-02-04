'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface ReviewActionsProps {
  reviewId: string
}

export function ReviewActions({ reviewId }: ReviewActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)

  async function handleAction(action: 'approve' | 'reject') {
    setLoading(action)
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: action === 'approve' ? 'approved' : 'failed' 
        })
      })
      
      if (!res.ok) {
        throw new Error('Failed to update review')
      }
      
      router.refresh()
    } catch (error) {
      console.error('Error updating review:', error)
      alert('Kon review niet bijwerken')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex gap-2">
      <button 
        onClick={() => handleAction('approve')}
        disabled={loading !== null}
        className="px-3 py-1 text-sm text-green-600 border border-green-600 rounded hover:bg-green-50 disabled:opacity-50"
      >
        {loading === 'approve' ? '...' : 'Goedkeuren'}
      </button>
      <button 
        onClick={() => handleAction('reject')}
        disabled={loading !== null}
        className="px-3 py-1 text-sm text-red-600 border border-red-600 rounded hover:bg-red-50 disabled:opacity-50"
      >
        {loading === 'reject' ? '...' : 'Afwijzen'}
      </button>
    </div>
  )
}
