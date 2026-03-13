'use client'

interface ScanAnimationProps {
  active: boolean
  children: React.ReactNode
}

export default function ScanAnimation({ active, children }: ScanAnimationProps) {
  if (!active) return <>{children}</>

  return (
    <div className="relative overflow-hidden">
      {children}
      {/* Sihirli tarama efekti — prefers-reduced-motion destekli */}
      <div
        className="absolute inset-0 pointer-events-none motion-safe:animate-scan-sweep"
        aria-hidden="true"
      >
        <div className="w-full h-1 bg-gradient-to-r from-transparent via-green-400/60 to-transparent blur-sm" />
      </div>
      {/* Skeleton overlay */}
      <div className="absolute inset-0 bg-white/40 pointer-events-none motion-safe:animate-pulse" />
    </div>
  )
}
