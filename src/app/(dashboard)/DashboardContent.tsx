'use client'

import { useState, useEffect } from 'react'
import { ReviewsChart } from '@/components/ReviewsChart'

interface Stats {
  shops: number
  products: number
  pending: number
  approved: number
  posted: number
  failed: number
  imported: number
  totalGenerated: number
}

export function DashboardContent() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats/dashboard')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ 
    label, 
    value, 
    color = 'text-gray-900' 
  }: { 
    label: string
    value: number | string
    color?: string 
  }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${color}`}>
        {loading ? (
          <div className="h-9 w-16 bg-gray-200 rounded animate-pulse" />
        ) : (
          value
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          label="Shops" 
          value={stats?.shops ?? 0} 
        />
        <StatCard 
          label="Producten" 
          value={stats?.products ?? 0} 
        />
        <StatCard 
          label="Reviews (pending)" 
          value={stats?.pending ?? 0} 
          color="text-yellow-600" 
        />
        <StatCard 
          label="Reviews (gepost)" 
          value={stats?.posted ?? 0} 
          color="text-green-600" 
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          label="Goedgekeurd" 
          value={stats?.approved ?? 0} 
          color="text-blue-600" 
        />
        <StatCard 
          label="Gefaald" 
          value={stats?.failed ?? 0} 
          color="text-red-600" 
        />
        <StatCard 
          label="Geïmporteerd" 
          value={stats?.imported ?? 0} 
          color="text-purple-600" 
        />
        <StatCard 
          label="Totaal gegenereerd" 
          value={stats?.totalGenerated ?? 0} 
        />
      </div>

      {/* Reviews Over Time Chart */}
      <ReviewsChart />

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Snelle acties</h2>
        <div className="flex flex-wrap gap-4">
          <a
            href="/shops"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Shop toevoegen
          </a>
          <a
            href="/reviews"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Reviews bekijken
          </a>
        </div>
      </div>
    </>
  )
}
