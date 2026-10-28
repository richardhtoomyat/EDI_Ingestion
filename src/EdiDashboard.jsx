import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Shell } from './chrome.jsx'
import { CreateOnboarding } from './AgentApp.jsx'
import MentionNote from './MentionNote.jsx'
import {
  emptyDeveloper, loadEdiTeam, loadNotifications, loadOnboardings, markNotificationsRead,
  reorderEdiBucket, updateEdiTeamView, updateEdiAssignment,
} from './onboardingLink.js'
import { layoutRect, slotUnderCard } from './teamCardDrag.js'

const LONG_PRESS_MS = 420
const PERSON_PREFIX = 'person:'
const SHUFFLE_EASE = 'cubic-bezier(.22,1,.36,1)'

function settleCard(node, fromRect) {
  if (!node || !fromRect) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const last = node.getBoundingClientRect()
  const dx = fromRect.left - last.left
  const dy = fromRect.top - last.top
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
  node.style.transition = 'none'
  node.style.transform = `translate(${dx}px, ${dy}px)`
  node.style.zIndex = '3'
  node.getBoundingClientRect()
  node.style.transition = `transform 280ms ${SHUFFLE_EASE}`
  node.style.transform = ''
  const clear = (event) => {
    if (event.propertyName !== 'transform') return
    node.style.transition = ''
    node.style.zIndex = ''
    node.removeEventListener('transitionend', clear)
  }
  node.addEventListener('transitionend', clear)
}

function playCardShuffle(board, before) {
  if (!board || !before?.size) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const nodes = [...board.querySelectorAll('[data-person-id]')]
  nodes.forEach((node) => {
    node.style.transition = 'none'
    node.style.transform = 'none'
  })
  board.getBoundingClientRect()
  const moving = []
  nodes.forEach((node) => {
    const first = before.get(node.getAttribute('data-person-id'))
    if (!first) return
    const last = node.getBoundingClientRect()
    const dx = first.left - last.left
    const dy = first.top - last.top
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
    node.style.transform = `translate(${dx}px, ${dy}px)`
    node.style.zIndex = '2'
    moving.push(node)
  })
  board.getBoundingClientRect()
  moving.forEach((node) => {
    node.style.transition = `transform 340ms ${SHUFFLE_EASE}`
    node.style.transform = ''
    const clear = (event) => {
      if (event.propertyName !== 'transform') return
      node.style.transition = ''
      node.style.zIndex = ''
      node.removeEventListener('transitionend', clear)
    }
    node.addEventListener('transitionend', clear)
  })
}

function readDragPayload(dataTransfer) {
  const plain = dataTransfer.getData('text/plain') || ''
  if (plain.startsWith(PERSON_PREFIX)) {
    return { type: 'person', id: plain.slice(PERSON_PREFIX.length) }
  }
  if (plain) return { type: 'item', id: plain }
  return { type: '', id: '' }
}

const STATUSES = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending-customer', label: 'Pending customer' },
  { value: 'pending', label: 'Pending' },
  { value: 'ready', label: 'Ready' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'started', label: 'Started' },
  { value: 'test', label: 'Test' },
  { value: 'production', label: 'Production' },
]

const EDI_STAGES = [
  { value: 'started', label: 'Started' },
  { value: 'test', label: 'Test' },
  { value: 'production', label: 'Production' },
]

const PHASES = {
  backlog: { value: 'backlog', label: 'Backlog', order: 0 },
  'in-progress': { value: 'in-progress', label: 'In Progress', order: 1 },
  complete: { value: 'complete', label: 'Complete', order: 2 },
}

const DAY_MS = 24 * 60 * 60 * 1000

function personName(team, id) {
  const person = team.find((item) => item.id === id)
  return person ? `${person.firstName} ${person.lastName}` : ''
}

function personFirstName(team, id) {
  const person = team.find((item) => item.id === id)
  return person?.firstName || person?.email || ''
}

function statusLabel(value, item, team = []) {
  if (value === 'assigned') {
    const first = personFirstName(team, item?.ownerId)
    return first ? `Assigned (${first})` : 'Assigned'
  }
  return STATUSES.find((status) => status.value === value)?.label || value
}

function formatCreated(value) {
  return new Date(value).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function techContact(record) {
  const draft = record.draft || {}
  const submission = record.submission || {}
  return {
    ...emptyDeveloper(),
    ...(draft.developer || {}),
    ...(submission.developer || {}),
  }
}

function techContactComplete(record) {
  const tech = techContact(record)
  return Boolean(
    String(tech.developerName || '').trim()
    && String(tech.email || '').trim()
    && String(tech.tel || '').trim(),
  )
}

function traderIdsComplete(record) {
  return Boolean(String(record.traderIdQa || '').trim() && String(record.traderIdProd || '').trim())
}

function deriveStatus(record) {
  if (record.ediStage === 'production' || record.completedAt) return 'production'
  if (record.ediStage === 'test') return 'test'
  if (record.ediStage === 'started') return 'started'
  if (record.ediOwnerId) return 'assigned'
  if (!techContactComplete(record)) return 'pending-customer'
  if (!traderIdsComplete(record)) return 'pending'
  return 'ready'
}

function isDoneStatus(status) {
  return status === 'production'
}

function phaseForStatus(status) {
  if (status === 'started' || status === 'test') return PHASES['in-progress']
  if (status === 'production' || status === 'completed') return PHASES.complete
  return PHASES.backlog
}

function recordToItem(record) {
  const draft = record.draft || {}
  const submission = record.submission || {}
  const kickoff = Array.isArray(submission.kickoffWeeks)
    ? submission.kickoffWeeks
    : (Array.isArray(draft.kickoffWeeks) ? draft.kickoffWeeks : [])
  const tech = techContact(record)
  return {
    id: record.id,
    company: record.companyName || '—',
    email: record.customerEmail || '',
    agent: record.agentName || '—',
    created: formatCreated(record.createdAt),
    createdAt: record.createdAt || 0,
    status: deriveStatus(record),
    phase: phaseForStatus(deriveStatus(record)),
    kickoff,
    technicalContact: tech.developerName || '',
    technicalEmail: tech.email || '',
    technicalMobile: tech.tel || '',
    mobileVerified: Boolean(tech.mobileVerified),
    ownerId: record.ediOwnerId || '',
    ediStage: record.ediStage || '',
    estimatedCompletionDate: record.estimatedCompletionDate || '',
    ediBucketOrder: Number.isFinite(Number(record.ediBucketOrder)) ? Number(record.ediBucketOrder) : 0,
    completed: Boolean(record.completedAt) || record.ediStage === 'production',
    note: record.ediNote || '',
    readyAt: record.readyAt || null,
    assignedAt: record.assignedAt || null,
    startedAt: record.startedAt || null,
    testAt: record.testAt || null,
    productionAt: record.productionAt || null,
    completedAt: record.completedAt || record.productionAt || null,
    traderIdQa: record.traderIdQa || '',
    traderIdProd: record.traderIdProd || '',
    needsAt7Mapping: Boolean(record.needsAt7Mapping),
    at7CustomCount: record.at7CustomCount || 0,
    codes: (record.at7Codes || []).map((code) => ({
      name: code.name,
      at701: code.at701,
      at702: code.at702,
      custom: code.custom || [],
      isCustom: Boolean(code.isCustom),
    })),
  }
}

function gaps(item) {
  const missing = []
  if (item.status === 'pending-customer') missing.push('Technical contact incomplete')
  if (item.status === 'pending') missing.push('Trader ID QA/Prod missing')
  if (item.needsAt7Mapping) missing.push(item.at7CustomCount > 1 ? `Custom mapping (${item.at7CustomCount})` : 'Custom mapping')
  return missing
}

function avgDays(samples) {
  if (!samples.length) return null
  const total = samples.reduce((sum, value) => sum + value, 0)
  return total / samples.length
}

function formatAvgDays(value) {
  if (value == null) return '—'
  if (value < 1) return `${Math.round(value * 24)}h`
  return `${value.toFixed(1)}d`
}

function startOfDay(ms) {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function dayKey(ms) {
  const date = new Date(ms)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function ageDays(fromMs, now = Date.now()) {
  if (!fromMs) return 0
  return Math.max(0, Math.floor((now - fromMs) / DAY_MS))
}

function ageBucket(days) {
  if (days <= 2) return 'fresh'
  if (days <= 7) return 'warn'
  return 'stale'
}

function buildCompletionCalendar(items, weeks = 26) {
  const today = startOfDay(Date.now())
  const counts = new Map()
  items.forEach((item) => {
    if (!item.completedAt) return
    const key = dayKey(item.completedAt)
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  const start = new Date(today)
  start.setDate(start.getDate() - ((weeks * 7) - 1) - start.getDay())
  const days = []
  for (let i = 0; i < weeks * 7; i += 1) {
    const ms = start.getTime() + (i * DAY_MS)
    const key = dayKey(ms)
    days.push({
      key,
      ms,
      count: counts.get(key) || 0,
      future: ms > today,
      label: new Date(ms).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    })
  }
  const weekStarts = []
  for (let i = 0; i < weeks; i += 1) weekStarts.push(days[i * 7])
  return { days, weekStarts, counts }
}

function completionLevel(count) {
  if (!count) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count <= 4) return 3
  return 4
}

function OnboardingTable({ rows, team, onOpen, draggable = false }) {
  return (
    <table className="edi-table">
      <colgroup>
        <col className="edi-col-customer" />
        <col className="edi-col-phase" />
        <col className="edi-col-status" />
        <col className="edi-col-flags" />
        <col className="edi-col-action" />
      </colgroup>
      <thead>
        <tr>
          <th>Customer</th>
          <th>Phase</th>
          <th>Status</th>
          <th>Flags</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => (
          <tr
            key={item.id}
            draggable={draggable}
            onDragStart={draggable ? (event) => event.dataTransfer.setData('text/plain', item.id) : undefined}
          >
            <td><strong>{item.company}</strong><div className="intro">{item.email}</div></td>
            <td><span className={`edi-pill phase-${item.phase.value}`}>{item.phase.label}</span></td>
            <td><span className={`edi-pill ${item.status}`}>{statusLabel(item.status, item, team)}</span></td>
            <td>{gaps(item).map((flag) => <span key={flag} className="edi-flag">{flag}</span>)}</td>
            <td><button type="button" className="secondary status-edit" onClick={() => onOpen(item.id)}>Open</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function KpiTab({ items, onOpen }) {
  const now = Date.now()
  const readyUnassigned = useMemo(
    () => items
      .filter((item) => item.status === 'ready' && !item.ownerId)
      .map((item) => ({
        ...item,
        age: ageDays(item.readyAt || item.createdAt, now),
      }))
      .sort((a, b) => b.age - a.age),
    [items, now],
  )

  const avgCreatedToReady = useMemo(() => {
    const samples = items
      .filter((item) => item.readyAt && item.createdAt)
      .map((item) => (item.readyAt - item.createdAt) / DAY_MS)
    return avgDays(samples)
  }, [items])

  const avgCreatedToComplete = useMemo(() => {
    const samples = items
      .filter((item) => item.completedAt && item.createdAt)
      .map((item) => (item.completedAt - item.createdAt) / DAY_MS)
    return avgDays(samples)
  }, [items])

  const calendar = useMemo(() => buildCompletionCalendar(items, 26), [items])
  const weekStart = startOfDay(now) - (new Date(now).getDay() * DAY_MS)
  const completedThisWeek = items.filter((item) => item.completedAt && item.completedAt >= weekStart).length
  const monthLabels = useMemo(() => {
    const labels = []
    let last = ''
    calendar.weekStarts.forEach((day, index) => {
      const label = new Date(day.ms).toLocaleDateString('en-CA', { month: 'short' })
      if (label !== last) {
        labels.push({ index, label })
        last = label
      }
    })
    return labels
  }, [calendar])

  return (
    <>
      <div className="edi-stats kpi-stats">
        <div>
          <b>{formatAvgDays(avgCreatedToReady)}</b>
          <span>Avg created → ready</span>
        </div>
        <div>
          <b>{formatAvgDays(avgCreatedToComplete)}</b>
          <span>Avg created → complete</span>
        </div>
        <div>
          <b>{readyUnassigned.length}</b>
          <span>Ready unassigned</span>
        </div>
        <div>
          <b>{completedThisWeek}</b>
          <span>Completed this week</span>
        </div>
      </div>

      <section className="card">
        <div className="dash-top">
          <div>
            <h3 className="dash-title">Completions</h3>
            <p className="intro">Last 26 weeks · darker = more completions that day</p>
          </div>
          <p className="intro">{completedThisWeek} this week</p>
        </div>
        <div className="kpi-calendar" role="img" aria-label="Completion activity calendar">
          <div className="kpi-cal-months" style={{ gridTemplateColumns: `repeat(${calendar.weekStarts.length}, 12px)` }}>
            {monthLabels.map((item) => (
              <span key={`${item.label}-${item.index}`} style={{ gridColumn: item.index + 1 }}>{item.label}</span>
            ))}
          </div>
          <div className="kpi-cal-body">
            <div className="kpi-cal-dow" aria-hidden="true">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>
            <div className="kpi-cal-grid" style={{ gridTemplateColumns: `repeat(${calendar.weekStarts.length}, 12px)` }}>
              {calendar.days.map((day) => (
                <span
                  key={day.key}
                  className={`kpi-cal-cell level-${day.future ? 0 : completionLevel(day.count)}`}
                  title={day.future ? '' : `${day.label}: ${day.count} completed`}
                />
              ))}
            </div>
          </div>
          <div className="kpi-cal-legend">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => <span key={level} className={`kpi-cal-cell level-${level}`} />)}
            <span>More</span>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="dash-title">Ready unassigned</h3>
        <p className="intro">Aging from the Ready timestamp (or created date if Ready was never stamped).</p>
        {readyUnassigned.length === 0 ? (
          <p className="intro">Nothing waiting in Ready.</p>
        ) : (
          <table className="edi-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Age</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {readyUnassigned.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.company}</strong><div className="intro">{item.email}</div></td>
                  <td><span className={`edi-pill age-${ageBucket(item.age)}`}>{item.age}d</span></td>
                  <td><button type="button" className="secondary status-edit" onClick={() => onOpen(item.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

export function EdiDashboardPreview() {
  return (
    <EdiDashboard
      profile={{ firstName: 'Alex', lastName: 'EDI', role: 'edi' }}
      onSignOut={() => {}}
    />
  )
}

export default function EdiDashboard({
  profile, onSignOut, onAccount, onSwitchWorkplace, onAdministration, currentWorkplace,
}) {
  const [tab, setTab] = useState('board')
  const [records, setRecords] = useState([])
  const [team, setTeam] = useState([])
  const [teamHidden, setTeamHidden] = useState([])
  const [hidePickerOpen, setHidePickerOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [openId, setOpenId] = useState('')
  const [editing, setEditing] = useState(null)
  const [dragOver, setDragOver] = useState('')
  const [dragOverItem, setDragOverItem] = useState('')
  const [dragOverPerson, setDragOverPerson] = useState('')
  const [armedItemId, setArmedItemId] = useState('')
  const [armedPersonId, setArmedPersonId] = useState('')
  const [stagePrompt, setStagePrompt] = useState(null)
  const [estimateDraft, setEstimateDraft] = useState('')
  const longPressTimer = useRef(null)
  const suppressClick = useRef(false)
  const armedItemRef = useRef('')
  const armedPersonRef = useRef('')
  const dragKindRef = useRef('')
  const draggingPersonRef = useRef('')
  const teamOrderDirtyRef = useRef(false)
  const teamRef = useRef([])
  const teamHiddenRef = useRef([])
  const workbucketsRef = useRef(null)
  const flipFromRef = useRef(null)
  const liftRef = useRef(null)
  const liftedNodeRef = useRef(null)
  const settleFromRef = useRef(null)
  const personDragCleanupRef = useRef(null)
  const [draggingPersonId, setDraggingPersonId] = useState('')
  const firstName = profile?.firstName || ''
  const welcome = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const startLongPress = (arm) => (event) => {
    if (event.button != null && event.button !== 0) return
    clearLongPress()
    longPressTimer.current = setTimeout(() => {
      arm()
      longPressTimer.current = null
    }, LONG_PRESS_MS)
  }

  const cancelLongPress = () => {
    clearLongPress()
  }

  const disarmAll = () => {
    clearLongPress()
    armedItemRef.current = ''
    armedPersonRef.current = ''
    setArmedItemId('')
    setArmedPersonId('')
  }

  const sortBucket = (list) => [...list].sort((a, b) => {
    const orderDiff = (a.ediBucketOrder || 0) - (b.ediBucketOrder || 0)
    if (orderDiff !== 0) return orderDiff
    return (b.createdAt || 0) - (a.createdAt || 0)
  })

  const refreshNotifications = () => loadNotifications()
    .then((next) => {
      setNotifications(next.notifications || [])
      setUnreadCount(next.unreadCount || 0)
    })
    .catch(() => {
      // Notifications are optional until SQL is applied.
    })

  useEffect(() => () => {
    personDragCleanupRef.current?.()
    document.body.classList.remove('team-card-dragging')
  }, [])

  useEffect(() => {
    let cancel = false
    setLoading(true)
    Promise.all([loadOnboardings(), loadEdiTeam()])
      .then(([nextRecords, nextTeam]) => {
        if (cancel) return
        setRecords(nextRecords)
        setTeam(nextTeam.profiles || [])
        setTeamHidden(nextTeam.teamHidden || [])
        setLoadError('')
      })
      .catch((error) => {
        if (cancel) return
        setLoadError(error.message)
        setRecords([])
        setTeam([])
        setTeamHidden([])
      })
      .finally(() => { if (!cancel) setLoading(false) })
    refreshNotifications()
    const timer = setInterval(refreshNotifications, 30000)
    return () => {
      cancel = true
      clearInterval(timer)
    }
  }, [])

  const items = useMemo(() => records.map(recordToItem), [records])
  const hiddenSet = useMemo(() => new Set(teamHidden), [teamHidden])
  teamRef.current = team
  teamHiddenRef.current = teamHidden

  useLayoutEffect(() => {
    const before = flipFromRef.current
    flipFromRef.current = null
    if (before) playCardShuffle(workbucketsRef.current, before)
    const settle = settleFromRef.current
    settleFromRef.current = null
    if (!settle || draggingPersonId) return
    const card = workbucketsRef.current?.querySelector(`[data-person-id="${CSS.escape(settle.id)}"] .workbucket`)
    settleCard(card, settle.rect)
  }, [team, draggingPersonId])

  useLayoutEffect(() => {
    if (!draggingPersonId) return undefined
    const node = liftedNodeRef.current
    const lift = liftRef.current
    if (!node || !lift) return undefined
    node.style.left = `${lift.left}px`
    node.style.top = `${lift.top}px`
    node.style.width = `${lift.width}px`
    node.style.height = `${lift.height}px`
    return undefined
  }, [draggingPersonId])
  const visibleTeam = useMemo(
    () => team.filter((person) => !hiddenSet.has(person.id)),
    [team, hiddenSet],
  )
  const reloadTeam = () => loadEdiTeam()
    .then((next) => {
      setTeam(next.profiles || [])
      setTeamHidden(next.teamHidden || [])
    })
    .catch(() => {})
  const sortBoard = (list) => [...list].sort((a, b) => {
    const phaseDiff = (a.phase?.order ?? 0) - (b.phase?.order ?? 0)
    if (phaseDiff !== 0) return phaseDiff
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
  const rows = useMemo(() => {
    const filtered = items.filter((item) => {
      const haystack = `${item.company} ${item.email}`.toLowerCase()
      if (query.trim() && !haystack.includes(query.trim().toLowerCase())) return false
      if (status !== 'all' && item.status !== status) return false
      return true
    })
    return sortBoard(filtered)
  }, [items, query, status])
  const myRows = useMemo(() => {
    if (!profile?.id) return []
    return sortBoard(items.filter((item) => item.ownerId === profile.id))
  }, [items, profile?.id])
  const open = items.find((item) => item.id === openId)
  const weeks = useMemo(() => {
    const map = new Map()
    items.forEach((item) => item.kickoff.forEach((week) => {
      map.set(week, [...(map.get(week) || []), item])
    }))
    return [...map.entries()]
  }, [items])

  const applyRecord = (saved) => {
    setRecords((current) => current.map((item) => (item.id === saved.id ? saved : item)))
  }

  const persistEdi = async (id, patch) => {
    setBusyId(id)
    setSaveError('')
    try {
      const saved = await updateEdiAssignment(id, patch)
      applyRecord(saved)
      return saved
    } catch (error) {
      setSaveError(error.message)
      throw error
    } finally {
      setBusyId('')
    }
  }

  const assign = (id, ownerId) => {
    persistEdi(id, { ediOwnerId: ownerId }).catch(() => {})
  }

  const applyRecords = (savedList) => {
    if (!savedList?.length) return
    setRecords((current) => {
      const map = new Map(savedList.map((item) => [item.id, item]))
      return current.map((item) => map.get(item.id) || item)
    })
  }

  const persistBucketOrder = async (orderedItems) => {
    const bucketOrders = orderedItems.map((item, index) => ({
      id: item.id,
      ediBucketOrder: index,
    }))
    // Optimistic local update
    setRecords((current) => current.map((record) => {
      const next = bucketOrders.find((entry) => entry.id === record.id)
      return next ? { ...record, ediBucketOrder: next.ediBucketOrder } : record
    }))
    setSaveError('')
    try {
      const saved = await reorderEdiBucket(bucketOrders)
      applyRecords(saved)
    } catch (error) {
      setSaveError(error.message)
      // Reload to resync if persist failed
      loadOnboardings().then(setRecords).catch(() => {})
    }
  }

  const reorderInBucket = (ownerId, draggedId, targetId) => {
    if (!draggedId || !targetId || draggedId === targetId) return
    const bucket = sortBucket(items.filter((item) => (
      ownerId === ''
        ? !item.ownerId && !isDoneStatus(item.status)
        : item.ownerId === ownerId
    )))
    const from = bucket.findIndex((item) => item.id === draggedId)
    const to = bucket.findIndex((item) => item.id === targetId)
    if (from < 0 || to < 0) return
    const next = [...bucket]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    persistBucketOrder(next)
  }

  const onDropInBucket = (ownerId) => (event) => {
    event.preventDefault()
    const payload = readDragPayload(event.dataTransfer)
    const targetId = event.currentTarget.getAttribute('data-item-id') || ''
    setDragOver('')
    setDragOverItem('')
    setArmedItemId('')
    dragKindRef.current = ''
    if (payload.type !== 'item' || !payload.id) return
    const id = payload.id
    const current = items.find((item) => item.id === id)
    const currentOwner = current?.ownerId || ''
    if (currentOwner === ownerId && targetId) {
      reorderInBucket(ownerId, id, targetId)
      return
    }
    if (currentOwner !== ownerId) {
      // Move to this bucket, then optionally place before target
      persistEdi(id, { ediOwnerId: ownerId }).then(async () => {
        if (!targetId) return
        const refreshed = await loadOnboardings()
        setRecords(refreshed)
        const mapped = refreshed.map(recordToItem)
        const bucket = sortBucket(mapped.filter((item) => (
          ownerId === ''
            ? !item.ownerId && !isDoneStatus(item.status)
            : item.ownerId === ownerId
        )))
        const from = bucket.findIndex((item) => item.id === id)
        const to = bucket.findIndex((item) => item.id === targetId)
        if (from < 0 || to < 0 || from === to) return
        const next = [...bucket]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        await persistBucketOrder(next)
      }).catch(() => {})
    }
  }

  const persistTeamOrder = async (orderedVisible) => {
    const hidden = team.filter((person) => hiddenSet.has(person.id))
    const nextTeam = [...orderedVisible, ...hidden]
    setTeam(nextTeam)
    setSaveError('')
    try {
      await updateEdiTeamView({ teamViewOrder: nextTeam.map((person) => person.id) })
    } catch (error) {
      setSaveError(error.message)
      reloadTeam()
    }
  }

  const persistTeamHidden = async (nextHidden) => {
    setTeamHidden(nextHidden)
    setSaveError('')
    try {
      await updateEdiTeamView({ teamHidden: nextHidden })
    } catch (error) {
      setSaveError(error.message)
      reloadTeam()
    }
  }

  const toggleTeamHidden = (personId, hide) => {
    if (!personId) return
    if (hide) {
      if (hiddenSet.has(personId)) return
      persistTeamHidden([...teamHidden, personId])
      return
    }
    if (!hiddenSet.has(personId)) return
    persistTeamHidden(teamHidden.filter((id) => id !== personId))
  }

  const placeTeamCard = (draggedId, targetId) => {
    if (!draggedId || !targetId || draggedId === targetId) return false
    const hiddenIds = new Set(teamHiddenRef.current)
    const current = teamRef.current
    const visible = current.filter((person) => !hiddenIds.has(person.id))
    const hidden = current.filter((person) => hiddenIds.has(person.id))
    const from = visible.findIndex((person) => person.id === draggedId)
    const to = visible.findIndex((person) => person.id === targetId)
    if (from < 0 || to < 0 || from === to) return false
    const nextVisible = [...visible]
    const [moved] = nextVisible.splice(from, 1)
    nextVisible.splice(to, 0, moved)
    const nextTeam = [...nextVisible, ...hidden]
    const board = workbucketsRef.current
    if (board) {
      const before = new Map()
      board.querySelectorAll('[data-person-id]').forEach((node) => {
        before.set(node.getAttribute('data-person-id'), node.getBoundingClientRect())
      })
      flipFromRef.current = before
    }
    teamRef.current = nextTeam
    teamOrderDirtyRef.current = true
    setTeam(nextTeam)
    return true
  }

  const endPersonDrag = () => {
    personDragCleanupRef.current?.()
    personDragCleanupRef.current = null
    const lift = liftRef.current
    const node = liftedNodeRef.current
    if (node && lift) settleFromRef.current = { id: lift.id, rect: node.getBoundingClientRect() }
    const dirty = teamOrderDirtyRef.current
    teamOrderDirtyRef.current = false
    liftRef.current = null
    liftedNodeRef.current = null
    draggingPersonRef.current = ''
    dragKindRef.current = ''
    document.body.classList.remove('team-card-dragging')
    disarmAll()
    setDragOverPerson('')
    setDraggingPersonId('')
    if (!dirty) return
    const hiddenIds = new Set(teamHiddenRef.current)
    const visible = teamRef.current.filter((member) => !hiddenIds.has(member.id))
    persistTeamOrder(visible)
  }

  const movePersonDrag = (event) => {
    const lift = liftRef.current
    if (!lift) return
    const left = event.clientX - lift.offsetX
    const top = event.clientY - lift.offsetY
    lift.left = left
    lift.top = top
    const node = liftedNodeRef.current
    if (node) {
      node.style.left = `${left}px`
      node.style.top = `${top}px`
    }
    const board = workbucketsRef.current
    if (!board) return
    const slots = [...board.querySelectorAll('[data-person-id]')].map((slot) => ({
      id: slot.getAttribute('data-person-id'),
      ...layoutRect(slot.getBoundingClientRect(), getComputedStyle(slot).transform),
    }))
    const targetId = slotUnderCard(slots, {
      id: lift.id,
      left,
      top,
      width: lift.width,
      height: lift.height,
    })
    if (targetId) placeTeamCard(lift.id, targetId)
  }

  const beginPersonDrag = (personId, card, origin) => {
    const rect = card.getBoundingClientRect()
    const slot = card.parentElement
    const slotRect = slot?.getBoundingClientRect()
    const style = getComputedStyle(card)
    const extra = (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0)
    liftRef.current = {
      id: personId,
      offsetX: origin.x - rect.left,
      offsetY: origin.y - rect.top,
      width: rect.width,
      height: rect.height,
      slotHeight: Math.max(slotRect?.height || 0, rect.height + extra),
      left: rect.left,
      top: rect.top,
    }
    dragKindRef.current = 'person'
    draggingPersonRef.current = personId
    teamOrderDirtyRef.current = false
    armedPersonRef.current = personId
    document.body.classList.add('team-card-dragging')
    setArmedPersonId(personId)
    setDraggingPersonId(personId)
    const move = (event) => movePersonDrag(event)
    const up = () => endPersonDrag()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    personDragCleanupRef.current = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }

  const requestStage = (item, stage) => {
    if (stage === 'started') {
      setEstimateDraft(item.estimatedCompletionDate || '')
      setStagePrompt({ id: item.id, company: item.company, stage: 'started' })
      return
    }
    persistEdi(item.id, { ediStage: stage }).catch(() => {})
  }

  const confirmStartStage = async () => {
    if (!stagePrompt) return
    const date = String(estimateDraft || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSaveError('Enter an estimated completion date')
      return
    }
    try {
      await persistEdi(stagePrompt.id, { ediStage: 'started', estimatedCompletionDate: date })
      setStagePrompt(null)
      setEstimateDraft('')
    } catch {
      // saveError already set
    }
  }

  const onDropOwner = (ownerId) => (event) => {
    event.preventDefault()
    setDragOver('')
    setDragOverItem('')
    setDragOverPerson('')
    setArmedPersonId('')
    dragKindRef.current = ''
    const payload = readDragPayload(event.dataTransfer)
    if (payload.type === 'person') return
    if (payload.type !== 'item' || !payload.id) return
    const current = items.find((item) => item.id === payload.id)
    if ((current?.ownerId || '') === ownerId) return
    assign(payload.id, ownerId)
  }

  const renderBucketCard = (item, ownerId) => {
    const armed = armedItemId === item.id
    return (
      <button
        key={item.id}
        type="button"
        className={`bucket-card${dragOverItem === item.id ? ' drop-target' : ''}${armed ? ' armed' : ''}`}
        data-item-id={item.id}
        draggable
        onPointerDown={startLongPress(() => {
          suppressClick.current = true
          armedItemRef.current = item.id
          armedPersonRef.current = ''
          setArmedItemId(item.id)
          setArmedPersonId('')
        })}
        onPointerUp={() => {
          cancelLongPress()
          if (dragKindRef.current !== 'item') {
            setTimeout(() => {
              if (armedItemRef.current === item.id && dragKindRef.current !== 'item') {
                armedItemRef.current = ''
                setArmedItemId('')
                suppressClick.current = false
              }
            }, 0)
          }
        }}
        onPointerCancel={disarmAll}
        onContextMenu={(event) => {
          if (armedItemRef.current === item.id || longPressTimer.current) event.preventDefault()
        }}
        onDragStart={(event) => {
          if (armedItemRef.current !== item.id) {
            event.preventDefault()
            cancelLongPress()
            return
          }
          suppressClick.current = true
          dragKindRef.current = 'item'
          event.dataTransfer.setData('text/plain', item.id)
          event.dataTransfer.effectAllowed = 'move'
        }}
        onDragEnd={() => {
          disarmAll()
          setDragOverItem('')
          dragKindRef.current = ''
          setTimeout(() => { suppressClick.current = false }, 0)
        }}
        onDragOver={(event) => {
          if (dragKindRef.current === 'person') return
          event.preventDefault()
          event.stopPropagation()
          setDragOver(ownerId === '' ? 'none' : ownerId)
          setDragOverItem(item.id)
        }}
        onDragLeave={() => {
          setDragOverItem((current) => (current === item.id ? '' : current))
        }}
        onDrop={(event) => {
          event.stopPropagation()
          onDropInBucket(ownerId)(event)
        }}
        onClick={() => {
          if (suppressClick.current || armedItemRef.current === item.id) {
            suppressClick.current = false
            armedItemRef.current = ''
            setArmedItemId('')
            return
          }
          setOpenId(item.id)
        }}
      >
        <strong>{item.company}</strong>
        <span>{statusLabel(item.status, item, team)}</span>
        {item.needsAt7Mapping && <span className="edi-flag">Custom mapping</span>}
      </button>
    )
  }

  const openRecord = (id) => {
    const record = records.find((item) => item.id === id)
    if (record) {
      setOpenId('')
      setEditing(record)
    }
  }

  const openNotification = async (item) => {
    if (!item?.readAt && item?.id) {
      try {
        await markNotificationsRead({ id: item.id })
        setNotifications((current) => current.map((row) => (
          row.id === item.id ? { ...row, readAt: Date.now() } : row
        )))
        setUnreadCount((count) => Math.max(0, count - 1))
      } catch {
        // Keep list usable even if mark-read fails.
      }
    }
    if (item?.onboardingId) setOpenId(item.onboardingId)
  }

  const markAllNotificationsRead = async () => {
    try {
      await markNotificationsRead({ all: true })
      setNotifications((current) => current.map((row) => (
        row.readAt ? row : { ...row, readAt: Date.now() }
      )))
      setUnreadCount(0)
    } catch (error) {
      setSaveError(error.message)
    }
  }

  const tabTitle = {
    board: 'All onboardings',
    mine: 'My assignment',
    team: 'EDI team',
    calendar: 'Kickoff calendar',
    kpi: 'KPIs',
    notifications: 'Notifications',
  }[tab] || 'All onboardings'

  if (editing) {
    return (
      <CreateOnboarding
        profile={profile}
        record={editing}
        onCancel={() => setEditing(null)}
        onSignOut={onSignOut}
        onAccount={onAccount}
        onSwitchWorkplace={onSwitchWorkplace}
        onAdministration={onAdministration}
        currentWorkplace={currentWorkplace}
        onCreated={(saved) => {
          setRecords((current) => current.map((item) => (item.id === saved.id ? saved : item)))
          setEditing(saved)
        }}
      />
    )
  }

  const headerNav = (
    <div className="edi-tabs header-tabs" role="tablist">
      {[
        ['board', 'Onboardings'],
        ['mine', 'My Assignment'],
        ['team', 'Team'],
        ['calendar', 'Kickoff'],
        ['kpi', 'KPIs'],
        ['notifications', unreadCount > 0 ? `Notifications (${unreadCount})` : 'Notifications'],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={tab === value}
          className={`secondary edi-tab${tab === value ? ' active' : ''}${value === 'notifications' && unreadCount > 0 ? ' has-unread' : ''}`}
          onClick={() => {
            setTab(value)
            if (value === 'notifications') refreshNotifications()
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <Shell
      title="EDI Portal"
      subtitle={firstName ? `Welcome, ${firstName}` : (welcome ? `Welcome, ${welcome}` : '')}
      profile={profile}
      onSignOut={onSignOut}
      onAccount={onAccount}
      onSwitchWorkplace={onSwitchWorkplace}
      onAdministration={onAdministration}
      currentWorkplace={currentWorkplace}
      nav={headerNav}
    >
      <main className="page edi-page">
        <div className="dash-top">
          <h2 className="dash-title">{tabTitle}</h2>
        </div>

        {loadError && <div className="banner err" role="alert">{loadError}</div>}
        {saveError && <div className="banner err" role="alert">{saveError}</div>}
        {loading && <p className="intro">Loading onboardings…</p>}

        {tab === 'board' && !loading && (
          <>
            <div className="edi-stats">
              <div><b>{items.filter((item) => !isDoneStatus(item.status)).length}</b><span>Active</span></div>
              <div><b>{items.filter((item) => item.status === 'started').length}</b><span>Started</span></div>
              <div><b>{items.filter((item) => item.status === 'test').length}</b><span>Test</span></div>
              <div><b>{items.filter((item) => item.status === 'production').length}</b><span>Production</span></div>
            </div>
            <section className="card">
              <div className="edi-filters">
                <label className="field">
                  <span>Search</span>
                  <input value={query} placeholder="Company or email" onChange={(event) => setQuery(event.target.value)} />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>
              {rows.length === 0 ? (
                <p className="intro">No onboardings match these filters.</p>
              ) : (
                <OnboardingTable rows={rows} team={team} onOpen={setOpenId} draggable />
              )}
            </section>
          </>
        )}

        {tab === 'mine' && !loading && (
          <section className="card">
            {myRows.length === 0 ? (
              <p className="intro">No customers are assigned to you yet. Assign one from Team or Open → EDI owner.</p>
            ) : (
              <OnboardingTable rows={myRows} team={team} onOpen={setOpenId} />
            )}
          </section>
        )}

        {tab === 'team' && !loading && (
          <div className="workbuckets-layout">
            <div className="workbuckets-main">
              <div className="team-view-toolbar">
                <button
                  type="button"
                  className={`team-hide-toggle${hidePickerOpen ? ' open' : ''}`}
                  aria-expanded={hidePickerOpen}
                  onClick={() => setHidePickerOpen((open) => !open)}
                >
                  Hide
                  {teamHidden.length > 0 ? ` (${teamHidden.length})` : ''}
                </button>
                {hidePickerOpen && (
                  <div className="team-hide-picker">
                    {team.length === 0 ? (
                      <p className="intro">No team members yet.</p>
                    ) : (
                      team.map((person) => {
                        const label = [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email
                        const checked = hiddenSet.has(person.id)
                        return (
                          <label key={person.id} className="team-hide-option">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => toggleTeamHidden(person.id, event.target.checked)}
                            />
                            <span>{label}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
              <div className="workbuckets" ref={workbucketsRef}>
                {team.length === 0 && (
                  <section className="card">
                    <p className="intro">No EDI accounts yet. Team members appear here after they create an account with the EDI role.</p>
                  </section>
                )}
                {visibleTeam.map((person) => {
                  const bucket = sortBucket(items.filter((item) => item.ownerId === person.id))
                  const lifted = draggingPersonId === person.id
                  const label = [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email
                  const body = (
                    <>
                      <h3>{label}</h3>
                      {bucket.map((item) => renderBucketCard(item, person.id))}
                    </>
                  )
                  return (
                    <div
                      key={person.id}
                      data-person-id={person.id}
                      className="workbucket-slot"
                      style={lifted ? { height: liftRef.current?.slotHeight } : undefined}
                    >
                      {lifted ? createPortal(
                        <section ref={liftedNodeRef} className="card workbucket lifted armed">
                          {body}
                        </section>,
                        document.body,
                      ) : (
                        <section
                          className={`card workbucket${dragOver === person.id ? ' over' : ''}${dragOverPerson === person.id ? ' person-target' : ''}`}
                          onPointerDown={(event) => {
                            if (event.target.closest('.bucket-card')) return
                            if (event.button != null && event.button !== 0) return
                            const card = event.currentTarget
                            const origin = { x: event.clientX, y: event.clientY }
                            const cancelIfMoved = (ev) => {
                              if (liftRef.current) return
                              if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) > 8) {
                                cancelLongPress()
                                window.removeEventListener('pointermove', cancelIfMoved)
                              }
                            }
                            window.addEventListener('pointermove', cancelIfMoved)
                            const stopWatch = () => window.removeEventListener('pointermove', cancelIfMoved)
                            window.addEventListener('pointerup', stopWatch, { once: true })
                            startLongPress(() => {
                              stopWatch()
                              beginPersonDrag(person.id, card, origin)
                            })(event)
                          }}
                          onPointerUp={() => {
                            if (dragKindRef.current === 'person') return
                            cancelLongPress()
                          }}
                          onContextMenu={(event) => {
                            if (armedPersonRef.current === person.id || longPressTimer.current) event.preventDefault()
                          }}
                          onDragOver={(event) => {
                            if (dragKindRef.current === 'person') return
                            event.preventDefault()
                            setDragOver(person.id)
                          }}
                          onDragLeave={() => {
                            if (dragKindRef.current === 'person') return
                            setDragOver('')
                            setDragOverItem('')
                          }}
                          onDrop={onDropOwner(person.id)}
                        >
                          {body}
                        </section>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <section
              className={`card workbucket workbucket-unassigned${dragOver === 'none' ? ' over' : ''}`}
              onDragOver={(event) => {
                if (dragKindRef.current === 'person') return
                event.preventDefault()
                setDragOver('none')
              }}
              onDragLeave={() => { setDragOver(''); setDragOverItem('') }}
              onDrop={onDropOwner('')}
            >
              <h3>Unassigned</h3>
              {sortBucket(items.filter((item) => !item.ownerId && !isDoneStatus(item.status))).map((item) => (
                renderBucketCard(item, '')
              ))}
            </section>
          </div>
        )}

        {tab === 'calendar' && !loading && (
          <section className="card">
            <h3>Shared kickoff weeks</h3>
            {weeks.length === 0 ? (
              <p className="intro">No kickoff weeks selected yet.</p>
            ) : (
              <div className="kickoff-board">
                {weeks.map(([week, customers]) => (
                  <article key={week} className={customers.length > 1 ? 'clash' : ''}>
                    <strong>{week}</strong>
                    {customers.length > 1 && <span className="edi-flag">Two customers this week</span>}
                    {customers.map((item) => <p key={item.id}>{item.company}<span>{personName(team, item.ownerId) || item.agent}</span></p>)}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'kpi' && !loading && (
          <KpiTab items={items} onOpen={setOpenId} />
        )}

        {tab === 'notifications' && !loading && (
          <section className="card">
            <div className="dash-top">
              <div>
                <h3 className="dash-title">Notifications</h3>
                <p className="intro">Mentions, assignments, and unassignments from your teammates.</p>
              </div>
              {unreadCount > 0 && (
                <button type="button" className="secondary status-edit" onClick={markAllNotificationsRead}>
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="intro">No notifications yet.</p>
            ) : (
              <ul className="notification-list">
                {notifications.map((item) => {
                  const action = item.kind === 'assigned'
                    ? `${item.actorName} assigned you`
                    : item.kind === 'unassigned'
                      ? `${item.actorName} unassigned you`
                      : `${item.actorName} mentioned you`
                  return (
                    <li key={item.id} className={item.readAt ? '' : 'unread'}>
                      <button type="button" className="notification-item" onClick={() => openNotification(item)}>
                        <strong>{item.companyName}</strong>
                        <span>{action}</span>
                        {item.noteExcerpt && <em>{item.noteExcerpt}</em>}
                        <span className="notification-time">
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

      </main>
      {open && createPortal(
        <div className="edi-detail" role="dialog" aria-modal="true" aria-label={`${open.company} onboarding`}>
          <button type="button" className="edi-scrim" aria-label="Close" onClick={() => setOpenId('')} />
          <div className="edi-sheet">
            <div className="dash-top">
              <div>
                <h2>{open.company}</h2>
                <p className="edi-created">Created on {open.created}</p>
                <p className="intro">Sales Agent: {open.agent || '—'}</p>
                <p className="intro">EDI owner: {personName(team, open.ownerId) || '—'}</p>
              </div>
              <button type="button" className="secondary status-edit" onClick={() => setOpenId('')}>Close</button>
            </div>
            <section className="edi-tech">
              <h3>Technical contact</h3>
              <p className="intro"><span>Name:</span> {open.technicalContact}</p>
              <p className="intro"><span>Email:</span> {open.technicalEmail}</p>
              <p className="intro"><span>Mobile:</span> {open.technicalMobile}</p>
            </section>
            <p><span className={`edi-pill ${open.status}`}>{statusLabel(open.status, open, team)}</span></p>
            {open.estimatedCompletionDate && (
              <p className="intro">Estimated completion: {open.estimatedCompletionDate}</p>
            )}
            {gaps(open).length > 0 && <div className="flag-row">{gaps(open).map((flag) => <span key={flag} className="edi-flag">{flag}</span>)}</div>}
            <p className="intro">Trader ID QA: {open.traderIdQa || '—'} · Trader ID Prod: {open.traderIdProd || '—'}</p>
            <h3>214 codes</h3>
            {open.codes.length === 0 && <p className="intro">No 214 statuses selected yet.</p>}
            {open.needsAt7Mapping && (
              <p className="intro">Custom mapping values need EDI work before go-live.</p>
            )}
            <ul className="code-review">
              {open.codes.map((code) => (
                <li key={`${code.name}-${code.at701}-${code.at702}`}>
                  <span>{code.name}{code.isCustom ? ' (custom)' : ''}</span>
                  <b className={code.custom.includes('at701') ? 'custom-code' : ''}>{code.at701}</b>
                  <b className={code.custom.includes('at702') ? 'custom-code' : ''}>{code.at702}</b>
                </li>
              ))}
            </ul>
            <label className="field">
              <span>EDI owner</span>
              <select
                value={open.ownerId}
                disabled={busyId === open.id}
                onChange={(event) => assign(open.id, event.target.value)}
              >
                <option value="">Unassigned</option>
                {team.map((person) => (
                  <option key={person.id} value={person.id}>
                    {[person.firstName, person.lastName].filter(Boolean).join(' ') || person.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Internal note</span>
              <MentionNote
                value={open.note}
                team={team}
                selfId={profile?.id || ''}
                disabled={busyId === open.id}
                onChange={(note) => {
                  setRecords((current) => current.map((item) => (
                    item.id === open.id ? { ...item, ediNote: note } : item
                  )))
                }}
                onCommit={(note) => {
                  persistEdi(open.id, { ediNote: note })
                    .then(() => refreshNotifications())
                    .catch(() => {})
                }}
              />
            </label>
            <div className="actions stage-actions">
              <button type="button" className="secondary" onClick={() => openRecord(open.id)}>View form</button>
              {(tab === 'mine' || open.ownerId === profile?.id) && (
                <label className="stage-dropdown">
                  <span className="visually-hidden">Update stage</span>
                  <select
                    value={open.ediStage || ''}
                    disabled={busyId === open.id}
                    onChange={(event) => {
                      const next = event.target.value
                      if (!next) return
                      requestStage(open, next)
                    }}
                  >
                    <option value="" disabled>{open.ediStage ? 'Change stage…' : 'Set stage…'}</option>
                    {EDI_STAGES.map((stage) => (
                      <option key={stage.value} value={stage.value}>{stage.label}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
      {stagePrompt && createPortal(
        <div className="edi-detail stage-prompt" role="dialog" aria-modal="true" aria-label="Estimated completion date">
          <button type="button" className="edi-scrim" aria-label="Close" onClick={() => setStagePrompt(null)} />
          <form
            className="edi-sheet stage-prompt-sheet"
            onSubmit={(event) => {
              event.preventDefault()
              confirmStartStage()
            }}
          >
            <div className="dash-top">
              <div>
                <h2>Start {stagePrompt.company}</h2>
                <p className="intro">Enter the estimated completion date to move this onboarding to Started.</p>
              </div>
              <button type="button" className="secondary status-edit" onClick={() => setStagePrompt(null)}>Cancel</button>
            </div>
            <label className="field">
              <span>Estimated completion date</span>
              <input
                type="date"
                required
                value={estimateDraft}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setEstimateDraft(event.target.value)}
              />
            </label>
            <div className="actions">
              <button type="submit" disabled={busyId === stagePrompt.id}>
                {busyId === stagePrompt.id ? 'Saving…' : 'Start'}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </Shell>
  )
}
