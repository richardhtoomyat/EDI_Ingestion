export function formatAnnualRevenue(value) {
  const text = String(value ?? '')
  if (!text.trim()) return ''
  const cleaned = text.replace(/[^\d.]/g, '')
  if (!cleaned) return ''
  const dot = cleaned.indexOf('.')
  const wholeDigits = (dot === -1 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, '')
  const grouped = (wholeDigits || (dot === -1 ? '' : '0')).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (dot === -1) return grouped
  const fraction = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 3)
  return `${grouped || '0'}.${fraction}`
}

export function finishAnnualRevenue(value) {
  const formatted = formatAnnualRevenue(value)
  if (!formatted) return ''
  const [whole, fraction = ''] = formatted.split('.')
  return `${whole}.${fraction.padEnd(3, '0')}`
}
