export const CA_PROVINCES = [
  { code: 'AB', label: 'Alberta' },
  { code: 'BC', label: 'British Columbia' },
  { code: 'MB', label: 'Manitoba' },
  { code: 'NB', label: 'New Brunswick' },
  { code: 'NL', label: 'Newfoundland and Labrador' },
  { code: 'NS', label: 'Nova Scotia' },
  { code: 'NT', label: 'Northwest Territories' },
  { code: 'NU', label: 'Nunavut' },
  { code: 'ON', label: 'Ontario' },
  { code: 'PE', label: 'Prince Edward Island' },
  { code: 'QC', label: 'Quebec' },
  { code: 'SK', label: 'Saskatchewan' },
  { code: 'YT', label: 'Yukon' },
]

export const US_STATES = [
  { code: 'AL', label: 'Alabama' },
  { code: 'AK', label: 'Alaska' },
  { code: 'AZ', label: 'Arizona' },
  { code: 'AR', label: 'Arkansas' },
  { code: 'CA', label: 'California' },
  { code: 'CO', label: 'Colorado' },
  { code: 'CT', label: 'Connecticut' },
  { code: 'DE', label: 'Delaware' },
  { code: 'DC', label: 'District of Columbia' },
  { code: 'FL', label: 'Florida' },
  { code: 'GA', label: 'Georgia' },
  { code: 'HI', label: 'Hawaii' },
  { code: 'ID', label: 'Idaho' },
  { code: 'IL', label: 'Illinois' },
  { code: 'IN', label: 'Indiana' },
  { code: 'IA', label: 'Iowa' },
  { code: 'KS', label: 'Kansas' },
  { code: 'KY', label: 'Kentucky' },
  { code: 'LA', label: 'Louisiana' },
  { code: 'ME', label: 'Maine' },
  { code: 'MD', label: 'Maryland' },
  { code: 'MA', label: 'Massachusetts' },
  { code: 'MI', label: 'Michigan' },
  { code: 'MN', label: 'Minnesota' },
  { code: 'MS', label: 'Mississippi' },
  { code: 'MO', label: 'Missouri' },
  { code: 'MT', label: 'Montana' },
  { code: 'NE', label: 'Nebraska' },
  { code: 'NV', label: 'Nevada' },
  { code: 'NH', label: 'New Hampshire' },
  { code: 'NJ', label: 'New Jersey' },
  { code: 'NM', label: 'New Mexico' },
  { code: 'NY', label: 'New York' },
  { code: 'NC', label: 'North Carolina' },
  { code: 'ND', label: 'North Dakota' },
  { code: 'OH', label: 'Ohio' },
  { code: 'OK', label: 'Oklahoma' },
  { code: 'OR', label: 'Oregon' },
  { code: 'PA', label: 'Pennsylvania' },
  { code: 'RI', label: 'Rhode Island' },
  { code: 'SC', label: 'South Carolina' },
  { code: 'SD', label: 'South Dakota' },
  { code: 'TN', label: 'Tennessee' },
  { code: 'TX', label: 'Texas' },
  { code: 'UT', label: 'Utah' },
  { code: 'VT', label: 'Vermont' },
  { code: 'VA', label: 'Virginia' },
  { code: 'WA', label: 'Washington' },
  { code: 'WV', label: 'West Virginia' },
  { code: 'WI', label: 'Wisconsin' },
  { code: 'WY', label: 'Wyoming' },
]

export function regionsForCountry(country = 'ca') {
  return country === 'us' ? US_STATES : CA_PROVINCES
}

export function formatPostal(value) {
  const core = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
  if (core.length <= 3) return core
  return `${core.slice(0, 3)} ${core.slice(3)}`
}

export function normalizeRegion(value, country = 'ca') {
  const code = String(value || '').trim().toUpperCase()
  if (!code) return ''
  const regions = regionsForCountry(country)
  if (regions.some((item) => item.code === code)) return code
  const byLabel = regions.find((item) => item.label.toUpperCase() === code)
  return byLabel?.code || ''
}

function component(parts, type, useShort = false) {
  const match = (parts || []).find((part) => (part.types || []).includes(type))
  if (!match) return ''
  return useShort ? (match.shortText || match.text || '') : (match.longText || match.text || '')
}

export function parseAddressComponents(parts) {
  const streetNumber = component(parts, 'street_number')
  const route = component(parts, 'route')
  const address = [streetNumber, route].filter(Boolean).join(' ')
  const city = component(parts, 'locality')
    || component(parts, 'postal_town')
    || component(parts, 'sublocality')
    || component(parts, 'administrative_area_level_3')
  const region = component(parts, 'administrative_area_level_1', true)
  const postal = component(parts, 'postal_code')
  const countryCode = component(parts, 'country', true).toLowerCase()
  const country = countryCode === 'us' ? 'us' : 'ca'
  return { address, city, region, postal, country, streetNumber }
}

export function streetLineFromText(text) {
  return String(text || '').split(',')[0].trim()
}

export function resolveStreetAddress(parsed, hintText = '', formattedAddress = '') {
  const fromParts = String(parsed?.address || '').trim()
  const fromHint = streetLineFromText(hintText)
  const fromFormatted = streetLineFromText(formattedAddress)
  const hasNumber = (value) => /^\d/.test(value)

  // Places sometimes returns route-only details for incomplete predictions
  // (e.g. "170 North The Queensway…" → route "North The Queensway…" with no street_number).
  if (hasNumber(fromParts) || parsed?.streetNumber) return fromParts
  if (hasNumber(fromHint)) return fromHint
  if (hasNumber(fromFormatted)) return fromFormatted
  return fromParts || fromHint || fromFormatted
}

export function mapSuggestions(payload) {
  return (payload?.suggestions || [])
    .map((item) => item.placePrediction)
    .filter(Boolean)
    .map((prediction) => ({
      placeId: prediction.placeId,
      text: prediction.text?.text || prediction.structuredFormat?.mainText?.text || '',
    }))
    .filter((item) => item.placeId && item.text)
}

export async function fetchSuggestions(apiKey, input, country) {
  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: [country],
      includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route'],
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Address suggestions failed')
  }
  return mapSuggestions(payload)
}

export async function fetchPlace(apiKey, placeId, hintText = '') {
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'addressComponents,formattedAddress',
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Could not load that address')
  }
  const parsed = parseAddressComponents(payload.addressComponents || [])
  const address = resolveStreetAddress(parsed, hintText, payload.formattedAddress || '')
  const { streetNumber, ...place } = parsed
  return {
    ...place,
    address,
    region: normalizeRegion(place.region, place.country),
    postal: formatPostal(place.postal),
  }
}
