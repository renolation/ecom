'use client'

import { useEffect, useState } from 'react'

/**
 * Below 1100px the extracted stylesheet slides `.rail` off-canvas and only brings it
 * back with a `.show` class (globals.css:306). The prototype toggles that from its own
 * hamburger; this supplies the same control for the React shell.
 */
export function RailToggle({ label }: { label: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.querySelector('.rail')?.classList.toggle('show', open)
  }, [open])

  // Close after navigating, so the panel does not cover the page it just opened.
  useEffect(() => {
    const rail = document.querySelector('.rail')
    if (!rail) return
    const close = () => setOpen(false)
    rail.addEventListener('click', close)
    return () => rail.removeEventListener('click', close)
  }, [])

  return (
    <button
      type="button"
      className="tbtn icon rail-toggle"
      aria-label={label}
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
    >
      {open ? '✕' : '☰'}
    </button>
  )
}
