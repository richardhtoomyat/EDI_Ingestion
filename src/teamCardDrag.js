export function layoutRect(visual, transform) {
  if (!visual) return null
  if (!transform || transform === 'none') return visual
  const match = /matrix\(([^)]+)\)/.exec(transform)
  if (!match) return visual
  const parts = match[1].split(',').map((value) => Number(value.trim()))
  const tx = parts[4] || 0
  const ty = parts[5] || 0
  return {
    left: visual.left - tx,
    top: visual.top - ty,
    width: visual.width,
    height: visual.height,
    right: visual.right - tx,
    bottom: visual.bottom - ty,
  }
}

// The pointer can stay over the gap while the card body already covers the next slot,
// especially when dragging right from a grab point on the left of a wide card.
export function slotUnderCard(slots, card) {
  if (!card) return ''
  const cx = card.left + card.width / 2
  const cy = card.top + card.height / 2
  for (const slot of slots) {
    if (!slot || slot.id === card.id) continue
    if (cx >= slot.left && cx < slot.right && cy >= slot.top && cy < slot.bottom) return slot.id
  }
  return ''
}
