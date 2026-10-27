import { useEffect, useRef, useState } from 'react'
import { fetchPlace, fetchSuggestions } from './addressPlaces.js'

const COUNTRIES = [
  { iso: 'ca', label: 'Canada', short: 'CA' },
  { iso: 'us', label: 'United States', short: 'US' },
]

function Flag({ iso }) {
  return <img className="flag" src={`https://flagcdn.com/w80/${iso}.png`} alt="" width="22" height="22" />
}

export default function AddressField({
  label = 'Address',
  value,
  country = 'ca',
  onChange,
  onPlace,
  required,
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  const picker = useRef(null)
  const wrap = useRef(null)
  const onChangeRef = useRef(onChange)
  const onPlaceRef = useRef(onPlace)
  const skipLookup = useRef(false)
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState('')
  const selected = COUNTRIES.find((item) => item.iso === country) || COUNTRIES[0]

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onPlaceRef.current = onPlace }, [onPlace])

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (!picker.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  useEffect(() => {
    const close = (event) => {
      if (!wrap.current?.contains(event.target)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    if (skipLookup.current) {
      skipLookup.current = false
      setSuggestions([])
      setShowSuggestions(false)
      setError('')
      return undefined
    }
    if (!apiKey) {
      setSuggestions([])
      setError('')
      return undefined
    }
    const query = String(value || '').trim()
    if (query.length < 3) {
      setSuggestions([])
      setError('')
      return undefined
    }
    let cancel = false
    const timer = setTimeout(async () => {
      try {
        const next = await fetchSuggestions(apiKey, query, selected.iso)
        if (!cancel) {
          setSuggestions(next)
          setShowSuggestions(true)
          setError('')
        }
      } catch (err) {
        if (!cancel) {
          setSuggestions([])
          setError(err.message || 'Address suggestions failed')
        }
      }
    }, 250)
    return () => {
      cancel = true
      clearTimeout(timer)
    }
  }, [apiKey, value, selected.iso])

  const choose = async (suggestion) => {
    skipLookup.current = true
    setShowSuggestions(false)
    setSuggestions([])
    setError('')
    try {
      const place = await fetchPlace(apiKey, suggestion.placeId, suggestion.text)
      onChangeRef.current?.(place.address || streetFallback(suggestion.text))
      onPlaceRef.current?.(place)
    } catch (err) {
      skipLookup.current = true
      onChangeRef.current?.(streetFallback(suggestion.text))
      setError(err.message || 'Could not load that address')
    }
  }

  return (
    <label className="field address-field" ref={wrap}>
      <span>{label}{required && <b className="req"> *</b>}</span>
      <div className="address-row">
        <div className="country-picker" ref={picker}>
          <button
            type="button"
            className="country-btn"
            aria-label="Address country"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <Flag iso={selected.iso} />
            <span>{selected.short}</span>
          </button>
          {open && (
            <ul className="country-menu" role="listbox">
              {COUNTRIES.map((item) => (
                <li key={item.iso}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={item.iso === selected.iso}
                    onClick={() => {
                      setOpen(false)
                      onPlaceRef.current?.({ country: item.iso })
                    }}
                  >
                    <Flag iso={item.iso} />
                    <span>{item.label}</span>
                    <b>{item.short}</b>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="address-input-wrap">
          <input
            type="text"
            value={value}
            autoComplete="off"
            placeholder={apiKey ? 'Start typing an address…' : 'Street address'}
            onChange={(event) => {
              skipLookup.current = false
              onChangeRef.current?.(event.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => { if (suggestions.length) setShowSuggestions(true) }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="address-suggestions" role="listbox">
              {suggestions.map((item) => (
                <li key={item.placeId}>
                  <button type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}>
                    {item.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {!apiKey && <em className="intro">Add VITE_GOOGLE_MAPS_API_KEY to enable Google address suggestions.</em>}
      {error && <em className="intro" role="alert">{error}</em>}
    </label>
  )
}

function streetFallback(text) {
  return String(text || '').split(',')[0].trim() || String(text || '')
}
