'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface QueueTabsProps {
  activeTab: string
  reviewCount: number
  productCount: number
}

export function QueueTabs({ activeTab, reviewCount, productCount }: QueueTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`/reviews/queue?${params.toString()}`)
  }

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8">
        <button
          onClick={() => handleTabChange('reviews')}
          className={`
            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
            ${activeTab === 'reviews'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }
          `}
        >
          <span>📝 Reviews</span>
          {reviewCount > 0 && (
            <span className={`
              inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
              ${activeTab === 'reviews' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}
            `}>
              {reviewCount}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange('products')}
          className={`
            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
            ${activeTab === 'products'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }
          `}
        >
          <span>📦 Producten</span>
          {productCount > 0 && (
            <span className={`
              inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
              ${activeTab === 'products' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}
            `}>
              {productCount}
            </span>
          )}
        </button>
      </nav>
    </div>
  )
}
