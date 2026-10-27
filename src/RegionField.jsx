import { useEffect, useMemo, useRef, useState } from 'react'

export default function RegionField({
  label = 'Prov/State',
  value,
  options,
  onChange,
  required,
  placeholder = 'Select…',
}) {
  const wrap = useRef(null)
  const searchRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find((item) => item.code === value)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((item) => (
      item.code.toLowerCase().includes(needle)
      || item.label.toLowerCase().includes(needle)
    ))
  }, [options, query])

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (!wrap.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return undefined
    }
    const timer = setTimeout(() => searchRef.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    setOpen(false)
    setQuery('')
  }, [options])

  return (
    <label className="field region-field" ref={wrap}>
      <span>{label}{required && <b className="req"> *</b>}</span>
      <button
        type="button"
        className={`region-trigger${open ? ' open' : ''}${selected ? ' has-value' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          <>
            <span className="region-label">{selected.label}</span>
            <b className="region-code">{selected.code}</b>
          </>
        ) : (
          <span className="region-placeholder">{placeholder}</span>
        )}
        <svg className="region-chev" viewBox="0 0 12 8" width="12" height="8" aria-hidden="true">
          <path d="M1 1.5 L6 6.5 L11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="region-menu">
          <input
            ref={searchRef}
            className="region-search"
            type="text"
            value={query}
            placeholder="Search…"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
              if (event.key === 'Enter' && filtered[0]) {
                event.preventDefault()
                onChange?.(filtered[0].code)
                setOpen(false)
              }
            }}
          />
          <ul role="listbox" aria-label={label}>
            {filtered.length === 0 && <li className="region-empty">No matches</li>}
            {filtered.map((item) => (
              <li key={item.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={item.code === value}
                  className={item.code === value ? 'selected' : undefined}
                  onClick={() => {
                    onChange?.(item.code)
                    setOpen(false)
                  }}
                >
                  <span>{item.label}</span>
                  <b>{item.code}</b>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </label>
  )
}
