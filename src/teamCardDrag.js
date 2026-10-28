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

// Team columns are tall and uneven. The header band is the part that lines up
// across the row, and the card center (not the pointer) is what has crossed sideways.
export function slotUnderCard(slots, card) {
  if (!card) return ''
  const bandTop = card.top
  const bandBottom = card.top + Math.min(72, card.height)
  const bandLeft = card.left
  const bandRight = card.left + card.width
  let bestId = ''
  let bestOverlap = 0
  for (const slot of slots) {
    if (!slot || slot.id === card.id) continue
    const overlapW = Math.min(bandRight, slot.right) - Math.max(bandLeft, slot.left)
    const overlapH = Math.min(bandBottom, slot.bottom) - Math.max(bandTop, slot.top)
    if (overlapW <= 0 || overlapH <= 0) continue
    const needed = Math.min(card.width, slot.right - slot.left) * 0.35
    if (overlapW < needed) continue
    if (overlapW > bestOverlap) {
      bestOverlap = overlapW
      bestId = slot.id
    }
  }
  return bestId
}
