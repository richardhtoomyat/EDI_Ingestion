import { describe, expect, it } from 'vitest'
import { layoutRect, slotUnderCard } from './teamCardDrag.js'

const slots = [
  { id: 'a', left: 0, top: 0, right: 240, bottom: 420 },
  { id: 'b', left: 252, top: 0, right: 492, bottom: 420 },
  { id: 'c', left: 504, top: 0, right: 744, bottom: 420 },
]

describe('slotUnderCard', () => {
  it('does not move while the midpoint is still in its own slot', () => {
    expect(slotUnderCard(slots, { id: 'a', left: 0, top: 0, width: 240, height: 420 })).toBe('')
  })

  it('does not move just because the card edge overlaps the next slot', () => {
    // Right edge reaches B, but the midpoint (x = 200) is still left of B.
    expect(slotUnderCard(slots, { id: 'a', left: 80, top: 0, width: 240, height: 420 })).toBe('')
  })

  it('moves right once the midpoint enters the next slot, even if the pointer is still over the gap', () => {
    // Midpoint is x = 320, inside B. A left-side grab would still have the pointer over A's gap.
    expect(slotUnderCard(slots, { id: 'a', left: 200, top: 0, width: 240, height: 420 })).toBe('b')
  })

  it('moves left once the card center enters the previous slot', () => {
    expect(slotUnderCard(slots, { id: 'b', left: 40, top: 0, width: 240, height: 420 })).toBe('a')
  })

  it('can move across more than one slot to the right', () => {
    expect(slotUnderCard(slots, { id: 'a', left: 450, top: 0, width: 240, height: 420 })).toBe('c')
  })

  it('uses the column under the midpoint when that neighbor is shorter than the crosshair', () => {
    const row = [
      { id: 'a', left: 0, top: 0, right: 240, bottom: 800 },
      { id: 'b', left: 252, top: 0, right: 492, bottom: 180 },
    ]
    // Midpoint is (280, 400), below B, but B is the column that contains x = 280.
    expect(slotUnderCard(row, { id: 'a', left: 160, top: 0, width: 240, height: 800 })).toBe('b')
  })
})

describe('layoutRect', () => {
  it('copies rectangle fields that live on the prototype, like a DOMRect', () => {
    const proto = {}
    Object.defineProperties(proto, {
      left: { get() { return 10 } },
      top: { get() { return 20 } },
      width: { get() { return 30 } },
      height: { get() { return 40 } },
      right: { get() { return 40 } },
      bottom: { get() { return 60 } },
    })
    const box = layoutRect(Object.create(proto), 'none')
    expect({ ...box }).toEqual({ left: 10, top: 20, width: 30, height: 40, right: 40, bottom: 60 })
  })
})
