import { describe, expect, it } from 'vitest'
import { finishAnnualRevenue, formatAnnualRevenue } from './annualRevenue.js'

describe('formatAnnualRevenue', () => {
  it('inserts thousands separators', () => {
    expect(formatAnnualRevenue('1234567')).toBe('1,234,567')
  })

  it('keeps up to three decimal places', () => {
    expect(formatAnnualRevenue('1234567.8912')).toBe('1,234,567.891')
    expect(formatAnnualRevenue('12.5')).toBe('12.5')
  })

  it('keeps a trailing decimal while typing', () => {
    expect(formatAnnualRevenue('1234.')).toBe('1,234.')
  })

  it('pads to three decimals when the entry is finished', () => {
    expect(finishAnnualRevenue('1234')).toBe('1,234.000')
    expect(finishAnnualRevenue('1,234.5')).toBe('1,234.500')
    expect(finishAnnualRevenue('')).toBe('')
  })
})
