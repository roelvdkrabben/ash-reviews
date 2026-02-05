'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// Consistent colors per shop index
const SHOP_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
]

interface Dataset {
  shopId: string
  shopName: string
  past: number[]
}

interface ChartData {
  labels: string[]
  datasets: Dataset[]
}

interface ReviewsChartProps {
  className?: string
}

export function ReviewsChart({ className }: ReviewsChartProps) {
  const [data, setData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    fetchData()
  }, [days])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/stats/reviews-over-time?days=${days}`)
      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }
      const json = await response.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Transform data for Recharts - only past/posted reviews
  const chartData = data?.labels.map((label, index) => {
    const point: Record<string, string | number | null> = {
      date: label,
      // Format date for display
      displayDate: new Date(label).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
      }),
    }
    
    data.datasets.forEach(dataset => {
      const pastValue = dataset.past[index]
      // Keep null for days without reviews, but we'll use connectNulls to draw smooth lines
      point[`${dataset.shopName}`] = pastValue > 0 ? pastValue : null
    })
    
    return point
  }) || []

  // Check if we have any data
  const hasData = data?.datasets.some(d => d.past.some(v => v > 0)) ?? false

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="h-64 bg-gray-100 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <p className="text-red-500">Error: {error}</p>
      </div>
    )
  }

  if (!data || data.datasets.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Reviews over tijd</h2>
        <p className="text-gray-500">Geen data beschikbaar</p>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Reviews over tijd</h2>
          <p className="text-sm text-gray-500 mt-1">Geplaatste reviews per shop</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                days === d
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 12 }}
              stroke="#9CA3AF"
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="#9CA3AF"
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              labelFormatter={(label) => `Datum: ${label}`}
              formatter={(value, name) => {
                if (value === undefined || name === undefined) return [0, '']
                return [value, String(name)]
              }}
            />
            <Legend />
            
            {data.datasets.map((dataset, index) => {
              const color = SHOP_COLORS[index % SHOP_COLORS.length]
              
              // Only show shops that have data
              const hasShopData = dataset.past.some(v => v > 0)
              if (!hasShopData) return null
              
              return (
                <Line
                  key={dataset.shopId}
                  type="monotone"
                  dataKey={dataset.shopName}
                  name={dataset.shopName}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls={true}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
