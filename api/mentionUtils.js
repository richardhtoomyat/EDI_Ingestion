export function displayName(person) {
  return [person?.firstName || person?.first_name, person?.lastName || person?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || person?.email || ''
}

export function findMentionedIds(text, people, actorId) {
  const raw = String(text || '')
  if (!raw.includes('@')) return []
  const ranked = [...(people || [])]
    .map((person) => ({ id: person.id, name: displayName(person) }))
    .filter((person) => person.id && person.name && person.id !== actorId)
    .sort((a, b) => b.name.length - a.name.length)

  const found = []
  for (const person of ranked) {
    const escaped = person.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(^|[^\\w])@${escaped}(?=$|[^\\w])`, 'i')
    if (re.test(raw)) found.push(person.id)
  }
  return [...new Set(found)]
}

export function newlyMentionedIds(prevText, nextText, people, actorId) {
  const previous = new Set(findMentionedIds(prevText, people, actorId))
  return findMentionedIds(nextText, people, actorId).filter((id) => !previous.has(id))
}

export function noteExcerpt(text, limit = 160) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim()
  if (cleaned.length <= limit) return cleaned
  return `${cleaned.slice(0, limit - 1)}…`
}
