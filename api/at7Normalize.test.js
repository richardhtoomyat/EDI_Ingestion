import { describe, expect, it } from 'vitest'
import { at7CustomCount, normalizeAt7, statusId } from './at7Normalize.js'
import { NORMAL_STATUSES } from '../src/formConfig.js'

describe('normalizeAt7', () => {
  it('returns empty when 214 is not selected', () => {
    expect(normalizeAt7({ sets: ['990'], normalStatuses: ['AF:0:Depart Shipper'] }, 'prefill')).toEqual([])
  })

  it('flags customized AT7 codes and snapshots defaults', () => {
    const id = statusId(NORMAL_STATUSES[0], 0)
    const rows = normalizeAt7({
      sets: ['214'],
      normalStatuses: [id],
      normalCodes: { [id]: { at701: 'ZZ', at702: 'NS' } },
      exceptionStatuses: [],
      exceptionCodes: {},
    }, 'prefill')

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      source: 'prefill',
      group_kind: 'normal',
      status_key: id,
      status_name: 'Depart Shipper',
      status_code: 'AF',
      default_at701: 'AF',
      default_at702: 'NS',
      at701: 'ZZ',
      at702: 'NS',
      is_custom: true,
      custom_fields: ['at701'],
    })
    expect(at7CustomCount(rows)).toBe(1)
  })

  it('keeps defaults as non-custom', () => {
    const id = statusId(NORMAL_STATUSES[0], 0)
    const rows = normalizeAt7({
      sets: ['214'],
      normalStatuses: [id],
      normalCodes: {},
      exceptionStatuses: [],
    }, 'submission')
    expect(rows[0].is_custom).toBe(false)
    expect(rows[0].custom_fields).toEqual([])
    expect(at7CustomCount(rows)).toBe(0)
  })
})
