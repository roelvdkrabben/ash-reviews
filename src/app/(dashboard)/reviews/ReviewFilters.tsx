'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface ReviewFiltersProps {
  currentStatus: string
  counts: {
    all: number
    pending: number
    approved: number
    posted: number
    imported: number
  }
}

export function ReviewFilters({ currentStatus, counts }: ReviewFiltersProps) {
  const tabs = [
    { key: 'all', label: 'Alle', count: counts.all },
    { key: 'pending', label: 'Wachtend', count: counts.pending },
    { key: 'approved', label: 'Goedgekeurd', count: counts.approved },
    { key: 'posted', label: 'Gepost', count: counts.posted },
    { key: 'imported', label: 'Geïmporteerd', count: counts.imported },
  ]

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => {
          const isActive = currentStatus === tab.key
          return (
            <Link
              key={tab.key}
              href={tab.key === 'all' ? '/reviews' : `/reviews?status=${tab.key}`}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                ${isActive 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              {tab.label}
              <span className={`
                px-2 py-0.5 text-xs rounded-full
                ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
              `}>
                {tab.count}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
