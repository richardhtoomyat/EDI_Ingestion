import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPlace,
  fetchSuggestions,
  formatPostal,
  mapSuggestions,
  normalizeRegion,
  parseAddressComponents,
  resolveStreetAddress,
  streetLineFromText,
} from './addressPlaces.js'
import { padAs400 } from './onboardingLink.js'

describe('padAs400', () => {
  it('pads short account numbers to 7 digits', () => {
    expect(padAs400('42')).toBe('0000042')
    expect(padAs400('123')).toBe('0000123')
  })

  it('strips non-digits and leading zeros before padding', () => {
    expect(padAs400('00-8841')).toBe('0008841')
    expect(padAs400('abc')).toBe('')
  })

  it('keeps at most 7 significant digits', () => {
    expect(padAs400('123456789')).toBe('1234567')
  })
})

describe('parseAddressComponents', () => {
  it('parses a Canadian street address', () => {
    const parsed = parseAddressComponents([
      { types: ['street_number'], longText: '100', shortText: '100' },
      { types: ['route'], longText: 'Queen Street West', shortText: 'Queen St W' },
      { types: ['locality'], longText: 'Toronto', shortText: 'Toronto' },
      { types: ['administrative_area_level_1'], longText: 'Ontario', shortText: 'ON' },
      { types: ['postal_code'], longText: 'M5H 2N2', shortText: 'M5H 2N2' },
      { types: ['country'], longText: 'Canada', shortText: 'CA' },
    ])
    expect(parsed).toEqual({
      address: '100 Queen Street West',
      city: 'Toronto',
      region: 'ON',
      postal: 'M5H 2N2',
      country: 'ca',
      streetNumber: '100',
    })
  })

  it('keeps route-only rows when Google omits street_number', () => {
    const parsed = parseAddressComponents([
      { types: ['route'], longText: 'North The Queensway W Islington', shortText: 'N The Queensway W Islington' },
      { types: ['locality'], longText: 'Toronto', shortText: 'Toronto' },
      { types: ['administrative_area_level_1'], longText: 'Ontario', shortText: 'ON' },
      { types: ['country'], longText: 'Canada', shortText: 'CA' },
    ])
    expect(parsed.address).toBe('North The Queensway W Islington')
    expect(parsed.streetNumber).toBe('')
  })

  it('parses a US address and marks country as us', () => {
    const parsed = parseAddressComponents([
      { types: ['street_number'], longText: '1600', shortText: '1600' },
      { types: ['route'], longText: 'Amphitheatre Parkway', shortText: 'Amphitheatre Pkwy' },
      { types: ['locality'], longText: 'Mountain View', shortText: 'Mountain View' },
      { types: ['administrative_area_level_1'], longText: 'California', shortText: 'CA' },
      { types: ['postal_code'], longText: '94043', shortText: '94043' },
      { types: ['country'], longText: 'United States', shortText: 'US' },
    ])
    expect(parsed.country).toBe('us')
    expect(parsed.city).toBe('Mountain View')
    expect(parsed.region).toBe('CA')
  })
})

describe('formatPostal', () => {
  it('formats postal codes as XXX XXX', () => {
    expect(formatPostal('m5h2n2')).toBe('M5H 2N2')
    expect(formatPostal('M5H2N2')).toBe('M5H 2N2')
    expect(formatPostal('M5H 2N2')).toBe('M5H 2N2')
    expect(formatPostal('90210')).toBe('902 10')
    expect(formatPostal('L5')).toBe('L5')
  })
})

describe('normalizeRegion', () => {
  it('keeps valid province and state codes', () => {
    expect(normalizeRegion('on', 'ca')).toBe('ON')
    expect(normalizeRegion('California', 'us')).toBe('CA')
    expect(normalizeRegion('ON', 'us')).toBe('')
  })
})

describe('resolveStreetAddress', () => {
  it('keeps numbered street lines from place details', () => {
    expect(resolveStreetAddress(
      { address: '170 Queensway West', streetNumber: '170' },
      '170 Queensway West, Mississauga, ON, Canada',
    )).toBe('170 Queensway West')
  })

  it('uses the suggestion street line when details drop the number', () => {
    expect(resolveStreetAddress(
      { address: 'North The Queensway W Islington', streetNumber: '' },
      '170 North The Queensway W Islington, Etobicoke, ON, Canada',
      'N The Queensway W Islington, Etobicoke, ON, Canada',
    )).toBe('170 North The Queensway W Islington')
  })

  it('reads the street line before the first comma', () => {
    expect(streetLineFromText('170 Queensway West, Mississauga, ON, Canada')).toBe('170 Queensway West')
  })
})

describe('mapSuggestions', () => {
  it('maps place predictions into option rows', () => {
    const rows = mapSuggestions({
      suggestions: [
        {
          placePrediction: {
            placeId: 'abc',
            text: { text: '100 Queen Street West, Toronto, ON, Canada' },
          },
        },
        { placePrediction: { placeId: '', text: { text: 'skip me' } } },
        {},
      ],
    })
    expect(rows).toEqual([
      { placeId: 'abc', text: '100 Queen Street West, Toronto, ON, Canada' },
    ])
  })
})

describe('fetchSuggestions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts to Places autocomplete and returns mapped rows', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: 'place-1',
              text: { text: '100 Queen Street West, Toronto, ON, Canada' },
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const rows = await fetchSuggestions('test-key', '100 Queen', 'ca')
    expect(rows).toEqual([
      { placeId: 'place-1', text: '100 Queen Street West, Toronto, ON, Canada' },
    ])
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete')
    expect(options.method).toBe('POST')
    expect(options.headers['X-Goog-Api-Key']).toBe('test-key')
    expect(JSON.parse(options.body)).toMatchObject({
      input: '100 Queen',
      includedRegionCodes: ['ca'],
    })
  })

  it('throws when Places autocomplete fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'REQUEST_DENIED' } }),
    }))
    await expect(fetchSuggestions('bad-key', '100 Queen', 'ca')).rejects.toThrow('REQUEST_DENIED')
  })
})

describe('fetchPlace', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads place details and parses address fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        formattedAddress: '100 Queen Street West, Toronto, ON M5H 2N2, Canada',
        addressComponents: [
          { types: ['street_number'], longText: '100', shortText: '100' },
          { types: ['route'], longText: 'Queen Street West', shortText: 'Queen St W' },
          { types: ['locality'], longText: 'Toronto', shortText: 'Toronto' },
          { types: ['administrative_area_level_1'], longText: 'Ontario', shortText: 'ON' },
          { types: ['postal_code'], longText: 'M5H 2N2', shortText: 'M5H 2N2' },
          { types: ['country'], longText: 'Canada', shortText: 'CA' },
        ],
      }),
    }))

    const place = await fetchPlace('test-key', 'place-1')
    expect(place).toEqual({
      address: '100 Queen Street West',
      city: 'Toronto',
      region: 'ON',
      postal: 'M5H 2N2',
      country: 'ca',
    })
  })

  it('keeps the typed street number when details are route-only', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        formattedAddress: 'N The Queensway W Islington, Etobicoke, ON, Canada',
        addressComponents: [
          { types: ['route'], longText: 'North The Queensway W Islington', shortText: 'N The Queensway W Islington' },
          { types: ['locality'], longText: 'Toronto', shortText: 'Toronto' },
          { types: ['administrative_area_level_1'], longText: 'Ontario', shortText: 'ON' },
          { types: ['country'], longText: 'Canada', shortText: 'CA' },
        ],
      }),
    }))

    const place = await fetchPlace(
      'test-key',
      'place-route',
      '170 North The Queensway W Islington, Etobicoke, ON, Canada',
    )
    expect(place.address).toBe('170 North The Queensway W Islington')
    expect(place.city).toBe('Toronto')
    expect(place.region).toBe('ON')
  })
})
