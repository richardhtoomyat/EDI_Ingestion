import { readFileSync } from 'node:fs'
import { fetchPlace, fetchSuggestions } from '../src/addressPlaces.js'

function env(name) {
  const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .find((item) => item.startsWith(`${name}=`))
  return line ? line.slice(name.length + 1).trim() : ''
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const key = env('VITE_GOOGLE_MAPS_API_KEY') || process.env.VITE_GOOGLE_MAPS_API_KEY || ''
assert(key, 'VITE_GOOGLE_MAPS_API_KEY is missing')

const suggestions = await fetchSuggestions(key, '100 Queen Street Toronto', 'ca')
assert(suggestions.length > 0, 'Expected at least one CA address suggestion')
assert(suggestions[0].placeId && suggestions[0].text, 'Suggestion is missing placeId/text')

const place = await fetchPlace(key, suggestions[0].placeId)
assert(place.address, 'Place address missing')
assert(place.city, 'Place city missing')
assert(place.region, 'Place region missing')
assert(place.postal, 'Place postal missing')
assert(place.country === 'ca' || place.country === 'us', 'Place country invalid')

const usSuggestions = await fetchSuggestions(key, '1600 Amphitheatre', 'us')
assert(usSuggestions.length > 0, 'Expected at least one US address suggestion')

console.log(JSON.stringify({
  ok: true,
  caSuggestion: suggestions[0].text,
  caPlace: place,
  usSuggestion: usSuggestions[0].text,
}, null, 2))
