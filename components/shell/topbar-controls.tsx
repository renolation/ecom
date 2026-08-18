'use client'

import { useEffect, useState } from 'react'

/**
 * Theme toggle — ui-2.html:396 (`toggleTheme`). The stylesheet keys every dark
 * value off `data-theme="dark"` on the root element, so flipping that attribute
 * is the whole mechanism.
 */
export function ThemeToggle({ title }: { title: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <button
      type="button"
      className="tbtn icon"
      title={title}
      aria-label={title}
      onClick={() => setTheme((v) => (v === 'light' ? 'dark' : 'light'))}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  )
}

/** Notification bell — ui-2.html:325. The prototype only raises a toast; so does this. */
export function NotificationBell({ message, count }: { message: string; count: number }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!shown) return
    const timer = setTimeout(() => setShown(false), 2600)
    return () => clearTimeout(timer)
  }, [shown])

  return (
    <>
      <button
        type="button"
        className="tbtn icon dot-badge"
        aria-label={message}
        onClick={() => setShown(true)}
      >
        🔔
      </button>
      <div className={`toast ${shown ? 'show' : ''}`}>
        <span>✓</span>{message}
      </div>
    </>
  )
}

/**
 * Persona picker — ui-2.html:1118. A dropdown rather than a row of icons, matching
 * the prototype; each entry is a link so persona switching stays a plain navigation.
 */
export function PersonaSelector({
  current, personas, lang, label,
}: {
  current: { code: string; icon: string; name: string; org: string }
  personas: Array<{ code: string; icon: string; name: string; org: string }>
  lang: string
  label: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.psel')) setOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  return (
    <div className="persona">
      <div className="persona-lbl">{label}</div>
      <div className="psel">
        <button type="button" className="psel-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <div className="psel-ic" data-persona={current.code}>{current.icon}</div>
          <div className="psel-tx"><b>{current.name}</b><span>{current.org}</span></div>
          <span style={{ color: 'var(--text-3)', fontSize: 11 }}>▾</span>
        </button>
        <div className={`psel-menu ${open ? 'open' : ''}`}>
          {personas.map((p) => (
            <a key={p.code} className={`psel-item ${p.code === current.code ? 'on' : ''}`} href={`/${p.code}?lang=${lang}`}>
              <div className="psel-ic" data-persona={p.code}>{p.icon}</div>
              <div className="psel-tx"><b>{p.name}</b><span>{p.org}</span></div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
