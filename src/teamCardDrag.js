function plainBox(visual, tx = 0, ty = 0) {
  const left = visual.left - tx
  const top = visual.top - ty
  const width = visual.width
  const height = visual.height
  return { left, top, width, height, right: left + width, bottom: top + height }
}

export function layoutRect(visual, transform) {
  if (!visual) return null
  if (!transform || transform === 'none') return plainBox(visual)
  const match = /matrix\(([^)]+)\)/.exec(transform)
  if (!match) return plainBox(visual)
  const parts = match[1].split(',').map((value) => Number(value.trim()))
  return plainBox(visual, parts[4] || 0, parts[5] || 0)
}

// The swap point is the crossing of the card's horizontal and vertical midlines.
// A shorter neighbor may end above that point, so the column under the crosshair still counts.
export function slotUnderCard(slots, card) {
  if (!card) return ''
  const cx = card.left + card.width / 2
  const cy = card.top + card.height / 2
  let columnId = ''
  let columnDist = Infinity
  for (const slot of slots) {
    if (!slot || slot.id === card.id) continue
    const inX = cx >= slot.left && cx < slot.right
    const inY = cy >= slot.top && cy < slot.bottom
    if (inX && inY) return slot.id
    if (!inX) continue
    const dist = cy < slot.top ? slot.top - cy : cy - slot.bottom
    if (dist < columnDist) {
      columnDist = dist
      columnId = slot.id
    }
  }
  return columnId
}
