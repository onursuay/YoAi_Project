'use client'

import React from 'react'

interface TableShimmerProps {
  isRefreshing: boolean
  children: React.ReactNode
}

export default function TableShimmer({ isRefreshing, children }: TableShimmerProps) {
  return (
    <div className="relative">
      {/* Shimmer bar overlay - only visible when refreshing */}
      {isRefreshing && (
        <div className="absolute top-0 left-0 right-0 h-1 z-10 pointer-events-none overflow-hidden rounded-t-xl">
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-green-500/25 to-transparent animate-shimmer-sweep"></div>
        </div>
      )}
      {children}
    </div>
  )
}
