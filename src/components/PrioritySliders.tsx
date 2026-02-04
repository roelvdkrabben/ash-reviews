'use client'

import { useState, useEffect, useCallback } from 'react'

interface PrioritySlidersProps {
  bestsellers: number
  noReviews: number
  stale: number
  onChange: (values: { bestsellers: number; noReviews: number; stale: number }) => void
}

export default function PrioritySliders({
  bestsellers: initialBestsellers,
  noReviews: initialNoReviews,
  stale: initialStale,
  onChange,
}: PrioritySlidersProps) {
  const [bestsellers, setBestsellers] = useState(initialBestsellers)
  const [noReviews, setNoReviews] = useState(initialNoReviews)
  const [stale, setStale] = useState(initialStale)

  // Update local state when props change
  useEffect(() => {
    setBestsellers(initialBestsellers)
    setNoReviews(initialNoReviews)
    setStale(initialStale)
  }, [initialBestsellers, initialNoReviews, initialStale])

  // Notify parent of changes
  const notifyChange = useCallback((b: number, n: number, s: number) => {
    onChange({ bestsellers: b, noReviews: n, stale: s })
  }, [onChange])

  // Adjust other sliders proportionally when one changes
  const adjustSliders = (
    changedSlider: 'bestsellers' | 'noReviews' | 'stale',
    newValue: number
  ) => {
    // Clamp to 0-100
    newValue = Math.max(0, Math.min(100, newValue))
    
    const remaining = 100 - newValue
    
    let newBestsellers = bestsellers
    let newNoReviews = noReviews
    let newStale = stale

    if (changedSlider === 'bestsellers') {
      newBestsellers = newValue
      const otherTotal = noReviews + stale
      if (otherTotal === 0) {
        // Split remaining equally
        newNoReviews = Math.round(remaining / 2)
        newStale = remaining - newNoReviews
      } else {
        // Distribute proportionally
        newNoReviews = Math.round((noReviews / otherTotal) * remaining)
        newStale = remaining - newNoReviews
      }
    } else if (changedSlider === 'noReviews') {
      newNoReviews = newValue
      const otherTotal = bestsellers + stale
      if (otherTotal === 0) {
        newBestsellers = Math.round(remaining / 2)
        newStale = remaining - newBestsellers
      } else {
        newBestsellers = Math.round((bestsellers / otherTotal) * remaining)
        newStale = remaining - newBestsellers
      }
    } else {
      newStale = newValue
      const otherTotal = bestsellers + noReviews
      if (otherTotal === 0) {
        newBestsellers = Math.round(remaining / 2)
        newNoReviews = remaining - newBestsellers
      } else {
        newBestsellers = Math.round((bestsellers / otherTotal) * remaining)
        newNoReviews = remaining - newBestsellers
      }
    }

    // Ensure no negative values
    newBestsellers = Math.max(0, newBestsellers)
    newNoReviews = Math.max(0, newNoReviews)
    newStale = Math.max(0, newStale)

    setBestsellers(newBestsellers)
    setNoReviews(newNoReviews)
    setStale(newStale)
    notifyChange(newBestsellers, newNoReviews, newStale)
  }

  const total = bestsellers + noReviews + stale
  const isValid = total === 100

  return (
    <div className="space-y-6">
      {/* Bestsellers Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <span className="text-lg">🔥</span>
            Bestsellers
            <span className="text-gray-400 font-normal">(veel verkocht/reviewed)</span>
          </label>
          <span className="text-sm font-bold text-orange-600 tabular-nums w-12 text-right">
            {bestsellers}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={bestsellers}
          onChange={(e) => adjustSliders('bestsellers', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
        <p className="text-xs text-gray-500">
          → Focus op producten met veel bestaande reviews
        </p>
      </div>

      {/* No Reviews Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <span className="text-lg">🆕</span>
            Geen reviews
            <span className="text-gray-400 font-normal">(0 reviews)</span>
          </label>
          <span className="text-sm font-bold text-blue-600 tabular-nums w-12 text-right">
            {noReviews}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={noReviews}
          onChange={(e) => adjustSliders('noReviews', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <p className="text-xs text-gray-500">
          → Producten die nog 0 reviews hebben
        </p>
      </div>

      {/* Stale Reviews Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <span className="text-lg">⏰</span>
            Lang niet reviewed
          </label>
          <span className="text-sm font-bold text-purple-600 tabular-nums w-12 text-right">
            {stale}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={stale}
          onChange={(e) => adjustSliders('stale', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
        <p className="text-xs text-gray-500">
          → Producten waar lang geen review op kwam
        </p>
      </div>

      {/* Total Indicator */}
      <div className={`flex items-center justify-between p-3 rounded-lg ${isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <span className="text-sm font-medium text-gray-700">Totaal:</span>
        <span className={`text-sm font-bold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
          {total}% {isValid ? '✓' : '(moet 100% zijn)'}
        </span>
      </div>

      {/* Visual Bar */}
      <div className="h-4 rounded-full overflow-hidden flex">
        <div 
          className="bg-orange-500 transition-all duration-200"
          style={{ width: `${bestsellers}%` }}
          title={`Bestsellers: ${bestsellers}%`}
        />
        <div 
          className="bg-blue-500 transition-all duration-200"
          style={{ width: `${noReviews}%` }}
          title={`Geen reviews: ${noReviews}%`}
        />
        <div 
          className="bg-purple-500 transition-all duration-200"
          style={{ width: `${stale}%` }}
          title={`Lang niet reviewed: ${stale}%`}
        />
      </div>
      <div className="flex text-xs text-gray-500 gap-4">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-500"></div>
          <span>Bestsellers</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500"></div>
          <span>Geen reviews</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-purple-500"></div>
          <span>Lang niet reviewed</span>
        </div>
      </div>
    </div>
  )
}
