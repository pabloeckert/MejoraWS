// dashboard/src/components/onboarding/first-time-hint.tsx
// Contextual hints for first-time users — shows once per hint, dismissable

'use client'

import { useState, useEffect, ReactNode } from 'react'
import { X } from 'lucide-react'

interface FirstTimeHintProps {
  id: string
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * Shows a hint tooltip once per `id`. Dismissed permanently after first view.
 *
 * Usage:
 *   <FirstTimeHint id="pipeline-drag">
 *     <p>Arrastrá deals entre etapas para actualizar tu pipeline</p>
 *   </FirstTimeHint>
 */
export function FirstTimeHint({ id, children, position = 'bottom' }: FirstTimeHintProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(`hint_dismissed_${id}`)
    if (!dismissed) {
      // Small delay so the page loads first
      const timer = setTimeout(() => setVisible(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [id])

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(`hint_dismissed_${id}`, 'true')
  }

  if (!visible) return null

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div className={`absolute z-50 ${positionClasses[position]}`}>
      <div className="relative rounded-lg border bg-popover p-3 shadow-md max-w-xs animate-in fade-in zoom-in-95">
        <button
          onClick={dismiss}
          className="absolute -top-1.5 -right-1.5 rounded-full bg-muted p-0.5 hover:bg-accent"
        >
          <X className="h-3 w-3" />
        </button>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

/**
 * Reset all hints (for testing or re-onboarding)
 */
export function resetAllHints() {
  const keys = Object.keys(localStorage)
  for (const key of keys) {
    if (key.startsWith('hint_dismissed_')) {
      localStorage.removeItem(key)
    }
  }
}
