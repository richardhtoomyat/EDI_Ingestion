import { useEffect, useMemo, useRef, useState } from 'react'

function personLabel(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim() || person?.email || ''
}

function mentionQueryAt(text, caret) {
  const before = String(text || '').slice(0, caret)
  const match = before.match(/(^|[\s([{])@([^\s@]*)$/)
  if (!match) return null
  return {
    start: match.index + match[1].length,
    query: match[2] || '',
  }
}

export default function MentionNote({
  value,
  team = [],
  selfId = '',
  disabled = false,
  rows = 3,
  placeholder = 'Only the EDI team sees this. Type @ to mention someone.',
  onChange,
  onCommit,
}) {
  const textareaRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [mention, setMention] = useState(null)

  const candidates = useMemo(() => {
    const query = (mention?.query || '').trim().toLowerCase()
    return team
      .filter((person) => person.id && person.id !== selfId)
      .map((person) => ({ ...person, label: personLabel(person) }))
      .filter((person) => person.label)
      .filter((person) => {
        if (!query) return true
        const hay = `${person.label} ${person.email || ''}`.toLowerCase()
        return hay.includes(query)
      })
      .slice(0, 8)
  }, [team, selfId, mention])

  useEffect(() => {
    setActive(0)
  }, [mention?.query, candidates.length])

  const syncMention = (text, caret) => {
    const next = mentionQueryAt(text, caret)
    setMention(next)
    setOpen(Boolean(next) && true)
  }

  const applyMention = (person) => {
    const el = textareaRef.current
    if (!el || !mention) return
    const label = personLabel(person)
    const start = mention.start
    const end = el.selectionStart
    const before = value.slice(0, start)
    const after = value.slice(end)
    const insert = `@${label} `
    const next = `${before}${insert}${after}`
    onChange?.(next)
    setOpen(false)
    setMention(null)
    requestAnimationFrame(() => {
      const pos = before.length + insert.length
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="mention-note">
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value
          onChange?.(next)
          syncMention(next, event.target.selectionStart)
        }}
        onClick={(event) => syncMention(event.target.value, event.target.selectionStart)}
        onKeyUp={(event) => syncMention(event.target.value, event.target.selectionStart)}
        onBlur={(event) => {
          // Delay so option click can fire first
          setTimeout(() => setOpen(false), 120)
          onCommit?.(event.target.value)
        }}
        onKeyDown={(event) => {
          if (!open || candidates.length === 0) return
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActive((current) => (current + 1) % candidates.length)
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((current) => (current - 1 + candidates.length) % candidates.length)
          } else if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault()
            applyMention(candidates[active])
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && mention && (
        <div className="mention-menu" role="listbox" aria-label="Mention teammate">
          {candidates.length === 0 ? (
            <div className="mention-empty">No teammates match</div>
          ) : (
            candidates.map((person, index) => (
              <button
                key={person.id}
                type="button"
                role="option"
                aria-selected={index === active}
                className={`mention-option${index === active ? ' active' : ''}`}
                onMouseDown={(event) => {
                  event.preventDefault()
                  applyMention(person)
                }}
              >
                <strong>{person.label}</strong>
                <span>{person.email}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
