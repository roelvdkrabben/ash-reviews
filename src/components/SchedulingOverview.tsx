'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface SchedulingData {
  overview: {
    totalScheduled: number
    totalPending: number
    totalApproved: number
    latestScheduledDate: string | null
    daysOfCoverage: number
    weeksOfCoverage: number
  }
  dailyCounts: Record<string, { pending: number; approved: number; total: number }>
  dates: string[]
  shopStats: Array<{
    shopId: string
    shopName: string
    targetPerWeek: number
    totalScheduled: number
    pending: number
    approved: number
    latestScheduledDate: string | null
    daysOfCoverage: number
    dailyBreakdown: Record<string, number>
  }>
}

const WEEKDAYS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`
}

function formatWeekday(dateStr: string): string {
  const date = new Date(dateStr)
  return WEEKDAYS[date.getDay()]
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0]
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay()
  return day === 0 || day === 6
}

// Mini calendar heatmap for a single shop
function ShopMiniCalendar({ 
  shopName, 
  dailyBreakdown, 
  daysOfCoverage,
  totalScheduled,
  latestDate 
}: {
  shopName: string
  dailyBreakdown: Record<string, number>
  daysOfCoverage: number
  totalScheduled: number
  latestDate: string | null
}) {
  const dates = Object.keys(dailyBreakdown).sort()
  const maxCount = Math.max(...Object.values(dailyBreakdown), 1)

  const getCellColor = (count: number) => {
    if (count === 0) return 'bg-gray-100'
    const intensity = count / maxCount
    if (intensity >= 0.75) return 'bg-purple-600'
    if (intensity >= 0.5) return 'bg-purple-400'
    if (intensity >= 0.25) return 'bg-purple-300'
    return 'bg-purple-200'
  }

  const coverageColor = 
    daysOfCoverage >= 14 ? 'text-green-600' :
    daysOfCoverage >= 7 ? 'text-yellow-600' :
    'text-red-600'

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-900 text-sm truncate">{shopName}</h4>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">{totalScheduled} gepland</span>
          <span className={`font-semibold ${coverageColor}`}>
            {daysOfCoverage}d
          </span>
        </div>
      </div>
      
      {/* Mini grid - 2 weeks */}
      <div className="flex gap-0.5 flex-wrap">
        {dates.map((date, idx) => {
          const count = dailyBreakdown[date]
          const dayOfWeek = new Date(date).getDay()
          
          return (
            <div key={date} className="relative group">
              <div
                className={`w-5 h-5 rounded-sm ${getCellColor(count)} ${
                  isToday(date) ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                }`}
                title={`${formatShortDate(date)}: ${count} reviews`}
              />
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                {formatWeekday(date)} {formatShortDate(date)}: {count}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Coverage indicator */}
      {latestDate && (
        <div className="mt-2 text-xs text-gray-500">
          Tot {formatShortDate(latestDate)}
        </div>
      )}
    </div>
  )
}

// Custom tooltip for main chart
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white px-3 py-2 shadow-lg rounded-lg border border-gray-200">
        <p className="font-medium text-gray-900">
          {formatWeekday(data.date)} {formatShortDate(data.date)}
        </p>
        <div className="text-sm space-y-1 mt-1">
          {data.approved > 0 && (
            <p className="text-green-600">✅ {data.approved} goedgekeurd</p>
          )}
          {data.pending > 0 && (
            <p className="text-yellow-600">⏳ {data.pending} wachtend</p>
          )}
          {data.total === 0 && (
            <p className="text-gray-400">Geen reviews gepland</p>
          )}
        </div>
      </div>
    )
  }
  return null
}

export default function SchedulingOverview() {
  const [data, setData] = useState<SchedulingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/stats/scheduling-overview?days=21')
        if (!res.ok) throw new Error('Failed to fetch')
        const json = await res.json()
        setData(json)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">📊 Planning Overzicht</h2>
        </div>
        <div className="px-6 py-8 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">📊 Planning Overzicht</h2>
        </div>
        <div className="px-6 py-4">
          <div className="text-red-600 text-sm">{error || 'Geen data'}</div>
        </div>
      </div>
    )
  }

  // Prepare chart data
  const chartData = data.dates.map(date => ({
    date,
    label: formatShortDate(date),
    day: formatWeekday(date),
    ...data.dailyCounts[date],
  }))

  const coverageColorClass = 
    data.overview.daysOfCoverage >= 14 ? 'bg-green-100 text-green-800 border-green-200' :
    data.overview.daysOfCoverage >= 7 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
    'bg-red-100 text-red-800 border-red-200'

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium text-gray-900">📊 Planning Overzicht</h2>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-gray-600"
            >
              {expanded ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>

          {/* Coverage indicator */}
          <div className={`px-3 py-1 rounded-full border text-sm font-medium ${coverageColorClass}`}>
            Gepland tot: {data.overview.latestScheduledDate 
              ? `${formatShortDate(data.overview.latestScheduledDate)} (${data.overview.daysOfCoverage} dagen)`
              : 'Niets gepland'}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-6 space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-700">{data.overview.totalScheduled}</div>
              <div className="text-xs text-purple-600">Totaal gepland</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{data.overview.totalApproved}</div>
              <div className="text-xs text-green-600">Goedgekeurd</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-700">{data.overview.totalPending}</div>
              <div className="text-xs text-yellow-600">Wachtend</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{data.overview.weeksOfCoverage}</div>
              <div className="text-xs text-blue-600">Weken vooruit</div>
            </div>
          </div>

          {/* Bar chart - Reviews per day */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Reviews per dag (komende 3 weken)</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 10 }}
                    interval={0}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="approved" 
                    stackId="a" 
                    fill="#22c55e"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar 
                    dataKey="pending" 
                    stackId="a" 
                    fill="#eab308"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex justify-center gap-4 mt-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-gray-600">Goedgekeurd</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span className="text-gray-600">Wachtend</span>
              </div>
            </div>
          </div>

          {/* Per-shop mini calendars */}
          {data.shopStats.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Per winkel (2 weken)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.shopStats
                  .filter(shop => shop.totalScheduled > 0 || Object.keys(shop.dailyBreakdown).length > 0)
                  .sort((a, b) => b.totalScheduled - a.totalScheduled)
                  .map(shop => (
                    <ShopMiniCalendar
                      key={shop.shopId}
                      shopName={shop.shopName}
                      dailyBreakdown={shop.dailyBreakdown}
                      daysOfCoverage={shop.daysOfCoverage}
                      totalScheduled={shop.totalScheduled}
                      latestDate={shop.latestScheduledDate}
                    />
                  ))}
              </div>
              {data.shopStats.filter(shop => shop.totalScheduled > 0).length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">Geen shops met geplande reviews</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
