import { describe, expect, it } from 'vitest'
import { slotUnderCard } from './teamCardDrag.js'

const slots = [
  { id: 'a', left: 0, top: 0, right: 240, bottom: 420 },
  { id: 'b', left: 252, top: 0, right: 492, bottom: 420 },
  { id: 'c', left: 504, top: 0, right: 744, bottom: 420 },
]

describe('slotUnderCard', () => {
  it('does not move while the card center is still in its own slot', () => {
    expect(slotUnderCard(slots, { id: 'a', left: 0, top: 0, width: 240, height: 420 })).toBe('')
  })

  it('moves right once the card center enters the next slot, even if the pointer is still over the gap', () => {
    // Grabbed near the left edge. Pointer is at 210, still inside A's gap (0–240),
    // but the card body is centered over B.
    expect(slotUnderCard(slots, { id: 'a', left: 200, top: 0, width: 240, height: 420 })).toBe('b')
  })

  it('moves left once the card center enters the previous slot', () => {
    expect(slotUnderCard(slots, { id: 'b', left: 40, top: 0, width: 240, height: 420 })).toBe('a')
  })

  it('can move across more than one slot to the right', () => {
    expect(slotUnderCard(slots, { id: 'a', left: 450, top: 0, width: 240, height: 420 })).toBe('c')
  })
})
