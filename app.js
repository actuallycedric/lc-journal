import { PROBLEMS, CATEGORIES } from './problems.js'

// ---------------------------------------------------------------------------
// constants

const KEY = 'lcj:v1'
const UI_KEY = 'lcj:ui'
const FILTER_KEY = 'lcj:filters'
const VERSION = 1
const TOTAL = PROBLEMS.length
const INDEX = new Map(PROBLEMS.map((p, i) => [p.id, i]))
const STATUSES = ['todo', 'attempted', 'solved']
const LANGS = ['python', 'java', 'other']
const DIFFS = ['E', 'M', 'H']
const GLYPH = { todo: '[ ]', attempted: '[~]', solved: '[x]' }
const DIFF_NAME = { E: 'easy', M: 'medium', H: 'hard' }
const TEXT_FIELDS = ['approach', 'code', 'time', 'space', 'notes']
const REVIEW_AFTER_DAYS = 14
const BACKUP_AFTER_DAYS = 7
const AUTOSAVE_MS = 800
const lcUrl = (id) => `https://leetcode.com/problems/${id}/`
const NC_URL = 'https://neetcode.io/practice'

const $ = (sel, root = document) => root.querySelector(sel)
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const problem = (id) => PROBLEMS[INDEX.get(id)]
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// ---------------------------------------------------------------------------
// dates: always local, never UTC. "YYYY-MM-DD" strings compare correctly as text.

const pad = (n) => String(n).padStart(2, '0')

function localDay(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

function parseDay(day) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDays(day, n) {
  const d = parseDay(day)
  d.setDate(d.getDate() + n)
  return localDay(d)
}

// whole days from a to b (b - a), immune to DST because it counts calendar days
function daysBetween(a, b) {
  const num = (day) => {
    const [y, m, d] = day.split('-').map(Number)
    return Date.UTC(y, m - 1, d) / 86400000
  }
  return num(b) - num(a)
}

// ---------------------------------------------------------------------------
// storage: every read/write of the journal goes through here

let state
const notices = { corrupt: null, corruptDismissed: false, saveError: null, toast: null }

function emptyState() {
  return { version: VERSION, lastExportAt: null, roadmap: { startDate: null, dailyGoal: 1 }, entries: {} }
}

function normalizeEntry(raw) {
  const e = raw && typeof raw === 'object' ? raw : {}
  const str = (v) => (typeof v === 'string' ? v : '')
  return {
    status: STATUSES.includes(e.status) ? e.status : 'todo',
    starred: e.starred === true,
    lang: LANGS.includes(e.lang) ? e.lang : 'python',
    approach: str(e.approach),
    code: str(e.code),
    time: str(e.time),
    space: str(e.space),
    notes: str(e.notes),
    solvedAt: isDay(e.solvedAt) ? e.solvedAt : null,
    updatedAt: typeof e.updatedAt === 'string' && !Number.isNaN(Date.parse(e.updatedAt)) ? e.updatedAt : new Date(0).toISOString(),
    reviews: Array.isArray(e.reviews) ? e.reviews.filter((r) => typeof r === 'string' && !Number.isNaN(Date.parse(r))) : [],
  }
}

// validates shape and rebuilds the object with a fixed key order
function normalizeState(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not a journal object')
  if (data.version !== VERSION) throw new Error(`unsupported version ${JSON.stringify(data.version)}`)
  if (!data.entries || typeof data.entries !== 'object' || Array.isArray(data.entries)) throw new Error('missing entries')
  const entries = {}
  let unknown = 0
  for (const [id, entry] of Object.entries(data.entries)) {
    if (!INDEX.has(id)) {
      unknown++
      continue
    }
    entries[id] = normalizeEntry(entry)
  }
  const rm = data.roadmap && typeof data.roadmap === 'object' ? data.roadmap : {}
  return {
    unknown,
    state: {
      version: VERSION,
      lastExportAt: typeof data.lastExportAt === 'string' && !Number.isNaN(Date.parse(data.lastExportAt)) ? data.lastExportAt : null,
      roadmap: {
        startDate: isDay(rm.startDate) ? rm.startDate : null,
        dailyGoal: Number.isInteger(rm.dailyGoal) && rm.dailyGoal > 0 ? rm.dailyGoal : 1,
      },
      entries,
    },
  }
}

function load() {
  let raw = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    notices.saveError = 'browser storage is unavailable, so nothing will be saved.'
    return emptyState()
  }
  if (raw === null) return emptyState()
  try {
    return normalizeState(JSON.parse(raw)).state
  } catch {
    // keep the unreadable text, never overwrite it
    notices.corrupt = backupCorrupt(raw)
    return emptyState()
  }
}

function backupCorrupt(raw) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key.startsWith('lcj:corrupt:') && localStorage.getItem(key) === raw) return key
    }
    const key = `lcj:corrupt:${Date.now()}`
    localStorage.setItem(key, raw)
    return key
  } catch {
    return '(the copy could not be written, storage is full)'
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    notices.saveError = null
    return true
  } catch (err) {
    notices.saveError =
      err && err.name === 'QuotaExceededError'
        ? "couldn't save: browser storage is full. export a backup, then free some space."
        : `couldn't save: ${err && err.message ? err.message : err}`
    return false
  } finally {
    renderBanners()
  }
}

function getEntry(id) {
  return state.entries[id] ?? normalizeEntry({})
}

function updateEntry(id, patch) {
  const prev = state.entries[id] ?? normalizeEntry({})
  state.entries[id] = normalizeEntry({ ...prev, ...patch, updatedAt: new Date().toISOString() })
  syncStartDate()
  return save()
}

function deleteEntry(id) {
  delete state.entries[id]
  return save()
}

// startDate auto-sets to the earliest solve the first time anything is solved
function syncStartDate() {
  if (state.roadmap.startDate) return
  const days = Object.values(state.entries)
    .filter((e) => e.status === 'solved' && e.solvedAt)
    .map((e) => e.solvedAt)
    .sort()
  if (days.length) state.roadmap.startDate = days[0]
}

// small prefs that aren't journal data
function readJSON(store, key) {
  try {
    const v = JSON.parse(store.getItem(key))
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}
function writeJSON(store, key, value) {
  try {
    store.setItem(key, JSON.stringify(value))
  } catch {
    // prefs are optional
  }
}

const uiRaw = readJSON(localStorage, UI_KEY)
const ui = {
  collapsed: uiRaw.collapsed && typeof uiRaw.collapsed === 'object' ? uiRaw.collapsed : {},
  backupDismissedUntil: typeof uiRaw.backupDismissedUntil === 'string' ? uiRaw.backupDismissedUntil : null,
}
const saveUi = () => writeJSON(localStorage, UI_KEY, ui)

const DEFAULT_FILTERS = { q: '', status: 'all', diff: [], starred: false, due: false }
function loadFilters() {
  const f = readJSON(sessionStorage, FILTER_KEY)
  return {
    q: typeof f.q === 'string' ? f.q : '',
    status: ['all', ...STATUSES].includes(f.status) ? f.status : 'all',
    diff: Array.isArray(f.diff) ? f.diff.filter((d) => DIFFS.includes(d)) : [],
    starred: f.starred === true,
    due: f.due === true,
  }
}
let filters = loadFilters()
const saveFilters = () => writeJSON(sessionStorage, FILTER_KEY, filters)

// ---------------------------------------------------------------------------
// derived numbers: pure functions of state + today's local date

const statusOf = (id) => state.entries[id]?.status ?? 'todo'
const solvedCount = () => PROBLEMS.reduce((n, p) => n + (statusOf(p.id) === 'solved' ? 1 : 0), 0)

function hasContent(e) {
  return !!e && (e.status !== 'todo' || e.solvedAt !== null || TEXT_FIELDS.some((k) => e[k] !== ''))
}

// day -> { solved: [ids], reviewed: [ids] }. Only solved problems with a
// solvedAt count; reviews count only once all 150 are solved.
function activity() {
  const days = new Map()
  const add = (day, kind, id) => {
    if (!days.has(day)) days.set(day, { solved: [], reviewed: [] })
    days.get(day)[kind].push(id)
  }
  const allSolved = solvedCount() === TOTAL
  for (const p of PROBLEMS) {
    const e = state.entries[p.id]
    if (!e) continue
    if (e.status === 'solved' && e.solvedAt) add(e.solvedAt, 'solved', p.id)
    if (allSolved) for (const r of e.reviews) add(localDay(new Date(r)), 'reviewed', p.id)
  }
  return days
}
const dayCount = (a) => (a ? a.solved.length + a.reviewed.length : 0)

function streaks(act, today) {
  const done = new Set([...act.keys()].filter((d) => dayCount(act.get(d)) > 0))
  const todayDone = done.has(today)
  let current = 0
  let cursor = todayDone ? today : addDays(today, -1)
  while (done.has(cursor)) {
    current++
    cursor = addDays(cursor, -1)
  }
  return { current, todayDone }
}

function lastTouched(e) {
  const days = e.reviews.map((r) => localDay(new Date(r)))
  if (e.solvedAt) days.push(e.solvedAt)
  return days.sort().at(-1) ?? null
}

function isDue(e, today) {
  if (!e || e.status !== 'solved') return false
  const last = lastTouched(e)
  return last !== null && daysBetween(last, today) > REVIEW_AFTER_DAYS
}

function dueCount(today) {
  return PROBLEMS.filter((p) => isDue(state.entries[p.id], today)).length
}

// first unsolved problem in NeetCode order
const nextUnsolved = () => PROBLEMS.find((p) => statusOf(p.id) !== 'solved') ?? null

function matches(p, ctx) {
  const e = state.entries[p.id]
  const status = e?.status ?? 'todo'
  if (filters.status !== 'all' && status !== filters.status) return false
  if (filters.diff.length && !filters.diff.includes(p.difficulty)) return false
  if (filters.starred && !e?.starred) return false
  if (filters.due && !isDue(e, ctx.today)) return false
  const q = filters.q.trim().toLowerCase()
  if (q && !p.title.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) return false
  return true
}

const isFiltering = () =>
  !!(filters.q.trim() || filters.status !== 'all' || filters.diff.length || filters.starred || filters.due)

// ---------------------------------------------------------------------------
// view state

const view = $('#view')
const dialog = $('#dialog')
let current = { name: null, id: null, mode: null }
let listScroll = 0
let renderedDay = localDay()
let editingStart = false
let edit = null // { id, snapshot, timer }
let toastTimer = null

// ---------------------------------------------------------------------------
// banners

function renderBanners() {
  const el = $('#banners')
  if (!el) return
  const out = []
  if (notices.saveError) out.push(`<div class="banner" role="alert"><span>${esc(notices.saveError)}</span></div>`)
  if (notices.corrupt && !notices.corruptDismissed) {
    out.push(
      `<div class="banner" role="alert"><span>the saved journal couldn't be read, so this started empty. the original text is kept in localStorage under <b>${esc(notices.corrupt)}</b>.</span><button type="button" class="link" data-action="dismiss-corrupt" aria-label="dismiss">×</button></div>`,
    )
  }
  if (state && Object.keys(state.entries).length) {
    const dismissed = ui.backupDismissedUntil && Date.parse(ui.backupDismissedUntil) > Date.now()
    const age = state.lastExportAt ? daysBetween(localDay(new Date(state.lastExportAt)), localDay()) : null
    if (!dismissed && (age === null || age > BACKUP_AFTER_DAYS)) {
      const when = age === null ? 'never' : `${plural(age, 'day')} ago`
      out.push(
        `<div class="banner"><span>last backup: ${when}. <button type="button" class="link" data-action="export">export</button></span><button type="button" class="link" data-action="dismiss-backup" aria-label="dismiss for 24 hours">×</button></div>`,
      )
    }
  }
  if (notices.toast) out.push(`<div class="banner quiet" role="status"><span>${esc(notices.toast)}</span></div>`)
  el.innerHTML = out.join('')
}

function toast(message) {
  notices.toast = message
  renderBanners()
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    notices.toast = null
    renderBanners()
  }, 3000)
}

// ---------------------------------------------------------------------------
// routing: #/ list, #/p/<id> problem, #/p/<id>/edit problem in edit mode

function parseHash() {
  const m = /^#\/p\/([a-z0-9-]+)(\/edit)?$/.exec(location.hash)
  if (!m || !INDEX.has(m[1])) return { id: null, edit: false }
  return { id: m[1], edit: !!m[2] }
}

function route() {
  const target = parseHash()
  const mode = target.id && (target.edit || !hasContent(state.entries[target.id])) ? 'edit' : 'read'
  if (edit && (target.id !== edit.id || mode !== 'edit')) closeEditState()
  if (current.name === 'list') listScroll = window.scrollY
  if (target.id) {
    renderProblem(target.id, mode)
    window.scrollTo(0, 0)
    $('#view h1')?.focus({ preventScroll: true })
  } else {
    if (location.hash && location.hash !== '#/') history.replaceState(null, '', '#/')
    renderList()
    window.scrollTo(0, listScroll)
  }
  renderBanners()
}

// navigate synchronously (pushState doesn't fire hashchange); back/forward
// still arrive as hashchange events
function go(hash) {
  if (location.hash !== hash) history.pushState(null, '', hash)
  route()
}

// show the read view without a hashchange (after save/cancel)
function showRead(id) {
  history.replaceState(null, '', `#/p/${id}`)
  renderProblem(id, 'read')
  $('#view h1')?.focus({ preventScroll: true })
}

// ---------------------------------------------------------------------------
// list view

function segHtml(group, label, values) {
  const buttons = values.map((v) => `<button type="button" data-filter="${group}" data-value="${v}">${v}</button>`)
  return `<div class="seg" role="group" aria-label="${label}">${buttons.join('<span class="sep" aria-hidden="true">|</span>')}</div>`
}

function renderList() {
  current = { name: 'list', id: null, mode: null }
  document.title = 'leetcode journal'
  view.innerHTML = `
    <header class="top">
      <div class="title-row">
        <h1 class="site-title"><a href="#/">leetcode journal</a></h1>
        <span id="progress-count"></span>
      </div>
      <div id="progress-bar" class="bar"></div>
      <div class="controls">
        <input type="search" id="search" class="search" placeholder="search..." aria-label="search by title or category" autocomplete="off" spellcheck="false">
        <div class="filter-row">
          ${segHtml('status', 'status', ['all', ...STATUSES])}
          ${segHtml('diff', 'difficulty', DIFFS)}
          <button type="button" class="tog" data-filter="starred" aria-label="starred only">★</button>
          <button type="button" class="tog" data-filter="due" id="due-btn">due (0)</button>
          <button type="button" class="tog" data-action="random">random</button>
        </div>
      </div>
      <p id="list-msg" class="gray" role="status"></p>
    </header>
    <section id="roadmap" class="roadmap" aria-label="roadmap"></section>
    <div id="lists"></div>`
  $('#search').value = filters.q
  renderRoadmap()
  renderLists()
}

function syncControls(ctx) {
  const solved = solvedCount()
  const pct = Math.round((solved / TOTAL) * 100)
  const filled = Math.round((solved / TOTAL) * 20)
  $('#progress-count').textContent = `${solved}/${TOTAL} solved`
  $('#progress-bar').textContent = `[${'#'.repeat(filled)}${'.'.repeat(20 - filled)}] ${pct}%`
  for (const b of view.querySelectorAll('[data-filter]')) {
    const { filter: f, value: v } = b.dataset
    const on = f === 'status' ? filters.status === v : f === 'diff' ? filters.diff.includes(v) : !!filters[f]
    b.setAttribute('aria-pressed', String(on))
  }
  $('#due-btn').textContent = `due (${dueCount(ctx.today)})`
}

function renderLists() {
  const lists = $('#lists')
  if (!lists) return
  const ctx = { today: localDay() }
  syncControls(ctx)
  const focusKey = lists.contains(document.activeElement) ? document.activeElement.dataset.key : null
  const shown = new Set(PROBLEMS.filter((p) => matches(p, ctx)).map((p) => p.id))
  const filtering = isFiltering()
  let html = ''

  const starred = PROBLEMS.filter((p) => state.entries[p.id]?.starred && shown.has(p.id))
  if (starred.length) html += sectionHtml('__starred', `★ starred (${starred.length})`, '', starred, ctx)

  for (const cat of CATEGORIES) {
    const all = PROBLEMS.filter((p) => p.category === cat)
    const rows = all.filter((p) => shown.has(p.id))
    if (!rows.length) continue
    const solved = all.filter((p) => statusOf(p.id) === 'solved').length
    const count = `${solved}/${all.length}${filtering && rows.length !== all.length ? ` · ${rows.length} shown` : ''}`
    html += sectionHtml(cat, cat, count, rows, ctx)
  }
  lists.innerHTML = shown.size ? html : '<p class="gray" style="margin-top:20px">no problems match.</p>'
  if (focusKey) lists.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)?.focus()
}

function sectionHtml(key, label, count, rows, ctx) {
  const collapsed = !!ui.collapsed[key]
  return `<section class="cat">
    <h2><button type="button" class="cat-head" data-action="toggle-cat" data-cat="${esc(key)}" data-key="cat:${esc(key)}" aria-expanded="${!collapsed}">
      <span aria-hidden="true">${collapsed ? '▸' : '▾'}</span><span class="cat-name">${esc(label)}</span><span class="cat-count">${count}</span>
    </button></h2>
    ${collapsed ? '' : `<ul class="rows">${rows.map((p) => rowHtml(p, ctx, key)).join('')}</ul>`}
  </section>`
}

function rowHtml(p, ctx, section) {
  const e = state.entries[p.id]
  const status = e?.status ?? 'todo'
  const starred = !!e?.starred
  const due = isDue(e, ctx.today)
  const date = status === 'solved' && e.solvedAt ? e.solvedAt : ''
  const key = `${section}:${p.id}`
  return `<li class="row">
    <span class="glyph"><span aria-hidden="true">${GLYPH[status]}</span><span class="sr">${status}</span></span>
    <button type="button" class="star" data-action="star" data-id="${p.id}" data-key="star:${esc(key)}" aria-pressed="${starred}" aria-label="star ${esc(p.title)}">${starred ? '★' : '☆'}</button>
    <a class="title" href="#/p/${p.id}" data-key="title:${esc(key)}">${esc(p.title)}</a>
    <span class="diff" title="${DIFF_NAME[p.difficulty]}">${p.difficulty}</span>
    <span class="date">${date}</span>
    <span class="due">${due ? '<span title="due for review" aria-label="due for review">↻</span>' : ''}</span>
  </li>`
}

// ---------------------------------------------------------------------------
// roadmap

function renderRoadmap() {
  const el = $('#roadmap')
  if (!el) return
  const today = localDay()
  renderedDay = today
  const act = activity()
  el.innerHTML = todayHtml(today, act) + paceHtml(today, act)
}

function todayHtml(today, act) {
  const solved = solvedCount()
  const solvedToday = act.get(today)?.solved ?? []
  let body
  if (solved === TOTAL) {
    body = `<span>all 150 done.</span> <button type="button" class="link" data-action="show-due">review something due →</button>`
  } else if (solvedToday.length) {
    const next = nextUnsolved()
    const names = solvedToday.map((id) => `<a href="#/p/${id}">${esc(problem(id).title)}</a>`).join(', ')
    body = `<span>done ✓</span> <span>${names}</span>${next ? ` <a href="#/p/${next.id}/edit" class="gray">do another →</a>` : ''}`
  } else {
    const next = nextUnsolved()
    body = `<span>#${INDEX.get(next.id) + 1}</span> <span>${esc(next.title)}</span> <span title="${DIFF_NAME[next.difficulty]}">${next.difficulty}</span> <span class="gray">${esc(next.category)}</span>
      <a class="btn" href="#/p/${next.id}/edit">open</a>`
  }
  return `<p class="today"><span class="rm-label">today</span> ${body}</p>`
}

function paceHtml(today, act) {
  const { current: streak, todayDone } = streaks(act, today)
  const solved = solvedCount()
  const unsolved = TOTAL - solved
  const goal = state.roadmap.dailyGoal
  const parts = []
  const streakText = `streak ${plural(streak, 'day')}`
  parts.push(!todayDone && streak > 0 ? `<span class="gray">${streakText} · do today's to keep it</span>` : `<span>${streakText}</span>`)
  parts.push(`<span>${solved}/${TOTAL}</span>`)
  if (unsolved > 0) {
    // today counts as day 1 until it's done
    const days = Math.ceil(unsolved / goal)
    parts.push(`<span>finish ~${addDays(today, todayDone ? days : days - 1)}</span>`)
  }
  const start = state.roadmap.startDate
  if (start) {
    const elapsed = Math.max(0, daysBetween(start, today) + 1)
    const diff = solved - elapsed * goal
    parts.push(`<span>${diff > 0 ? `${diff} ahead` : diff < 0 ? `${-diff} behind` : 'on pace'}</span>`)
  }
  const startControl = editingStart
    ? `<label class="gray">start <input type="date" id="start-input" class="start-input" value="${start ?? ''}"></label> <button type="button" class="link gray" data-action="start-done">done</button>`
    : `<button type="button" class="link gray" data-action="set-start" title="${start ? `started ${start}` : 'no start date yet'}">set start</button>`
  return `<p class="pace">${parts.join('<span class="gray" aria-hidden="true">·</span>')} <span class="gray" aria-hidden="true">·</span> ${startControl}</p>`
}

// ---------------------------------------------------------------------------
// problem view

function neighbours(id) {
  const i = INDEX.get(id)
  return { prev: PROBLEMS[(i - 1 + TOTAL) % TOTAL], next: PROBLEMS[(i + 1) % TOTAL] }
}

function linksHtml(p) {
  let html = `<a href="${lcUrl(p.id)}" target="_blank" rel="noopener noreferrer">LC↗</a>`
  if (p.premium) html += ` · premium · <a href="${NC_URL}" target="_blank" rel="noopener noreferrer">NC↗</a>`
  return html
}

function starButton(id) {
  const starred = !!state.entries[id]?.starred
  return `<button type="button" class="star" data-action="star" data-id="${id}" aria-pressed="${starred}" aria-label="star">${starred ? '★' : '☆'}</button>`
}

function renderProblem(id, mode) {
  const p = problem(id)
  if (mode === 'edit' && (!edit || edit.id !== id)) startEdit(id)
  current = { name: 'problem', id, mode }
  document.title = `${p.title} · leetcode journal`
  const crumbs = `<nav class="crumbs" aria-label="breadcrumb"><a href="#/">← leetcode journal</a><span class="gray">${solvedCount()}/${TOTAL} solved</span></nav>`
  view.innerHTML = crumbs + (mode === 'edit' ? editHtml(p) : readHtml(p))
  if (mode === 'edit') setupForm(p)
}

function readHtml(p) {
  const e = getEntry(p.id)
  const today = localDay()
  const meta = [esc(p.category), p.difficulty]
  if (e.time) meta.push(`time ${esc(e.time)}`)
  if (e.space) meta.push(`space ${esc(e.space)}`)
  if (e.solvedAt) meta.push(e.solvedAt)
  meta.push(linksHtml(p))
  const sections = []
  if (e.approach) sections.push(`<section class="sec"><h2>APPROACH</h2><div class="pre-text">${esc(e.approach)}</div></section>`)
  if (e.code) {
    sections.push(`<section class="sec">
      <div class="sec-head"><h2>CODE</h2><span><span class="gray">${e.lang}</span> <button type="button" class="link" data-action="copy">copy</button></span></div>
      <pre class="code"><code>${esc(e.code)}</code></pre>
    </section>`)
  }
  if (e.notes) sections.push(`<section class="sec"><h2>NOTES</h2><div class="pre-text">${esc(e.notes)}</div></section>`)
  if (!sections.length) sections.push(`<p class="sec gray">nothing written yet.</p>`)

  let reviews = ''
  if (e.status === 'solved') {
    const last = e.reviews.length ? localDay(new Date(e.reviews.at(-1))) : null
    const text = e.reviews.length ? `reviewed ${e.reviews.length}× · last ${last}` : 'not reviewed yet'
    reviews = `<div class="reviews"><span class="gray">${text}${isDue(e, today) ? ' · ↻ due' : ''}</span><button type="button" class="btn" data-action="mark-reviewed">mark reviewed</button></div>`
  }
  const { prev, next } = neighbours(p.id)
  return `<article class="problem">
    <div class="p-top"><span>${GLYPH[e.status]} ${e.status.toUpperCase()}</span><span class="p-actions">${starButton(p.id)}<button type="button" class="link" data-action="edit">edit</button></span></div>
    <h1 tabindex="-1">${esc(p.title)}</h1>
    <p class="meta">${meta.join(' · ')}</p>
    ${sections.join('')}
    ${reviews}
    <nav class="pn" aria-label="problems">
      <a href="#/p/${prev.id}" title="${esc(prev.title)}">← prev</a>
      <a href="#/">back to list</a>
      <a href="#/p/${next.id}" title="${esc(next.title)}">next →</a>
    </nav>
  </article>`
}

function radios(name, values, legend) {
  const inputs = values.map((v) => `<label><input type="radio" name="${name}" value="${v}">${v}</label>`).join('')
  return `<fieldset class="field"><legend>${legend}</legend><div class="choice">${inputs}</div></fieldset>`
}

function editHtml(p) {
  return `<article class="problem editing">
    <div class="p-top"><span class="gray">editing</span><span class="p-actions"><span id="save-state" class="gray" aria-live="polite"></span>${starButton(p.id)}</span></div>
    <h1 tabindex="-1">${esc(p.title)}</h1>
    <p class="meta">${esc(p.category)} · ${p.difficulty} · ${linksHtml(p)}</p>
    <form id="edit-form" autocomplete="off" novalidate>
      ${radios('status', STATUSES, 'status')}
      ${radios('lang', LANGS, 'language')}
      <div class="field two">
        <label>time<input type="text" name="time" placeholder="O(n)" spellcheck="false"></label>
        <label>space<input type="text" name="space" placeholder="O(1)" spellcheck="false"></label>
      </div>
      <label class="field"><span class="flabel">approach</span><textarea name="approach" rows="3"></textarea></label>
      <label class="field"><span class="flabel">code <span class="hint" id="tab-hint">tab indents · esc then tab moves on</span></span><textarea name="code" class="code-input" rows="8" wrap="off" spellcheck="false" autocapitalize="off" autocorrect="off"></textarea></label>
      <label class="field"><span class="flabel">notes</span><textarea name="notes" rows="3"></textarea></label>
      <label class="field"><span class="flabel">solved on</span><input type="date" name="solvedAt"></label>
      <div class="form-actions">
        <button type="submit" class="btn">save</button>
        <button type="button" class="btn" data-action="cancel-edit">cancel</button>
        <button type="button" class="btn" data-action="clear-entry">clear entry</button>
      </div>
      <div id="confirm" class="confirm"></div>
    </form>
  </article>`
}

// ---------------------------------------------------------------------------
// edit mode: autosave, cancel, dirty tracking

function startEdit(id) {
  const existing = state.entries[id]
  edit = { id, snapshot: existing ? structuredClone(existing) : null, timer: null }
}

function setupForm(p) {
  const form = $('#edit-form')
  const e = getEntry(p.id)
  const f = form.elements
  f.status.value = e.status
  f.lang.value = e.lang
  for (const k of TEXT_FIELDS) f[k].value = e[k]
  f.solvedAt.value = e.solvedAt ?? ''
  for (const ta of form.querySelectorAll('textarea')) autoGrow(ta)

  form.addEventListener('input', (ev) => {
    if (ev.target.name === 'status' && f.status.value === 'solved' && !f.solvedAt.value) f.solvedAt.value = localDay()
    if (ev.target.tagName === 'TEXTAREA') autoGrow(ev.target)
    scheduleSave()
  })
  form.addEventListener('submit', (ev) => {
    ev.preventDefault()
    saveAndClose()
  })
  const code = f.code
  code.addEventListener('keydown', onCodeKeydown)
  code.addEventListener('blur', () => delete code.dataset.release)
}

function autoGrow(ta) {
  ta.style.height = 'auto'
  ta.style.height = `${ta.scrollHeight + (ta.offsetHeight - ta.clientHeight)}px`
}

function readForm() {
  const f = $('#edit-form')?.elements
  if (!f) return null
  const out = { status: f.status.value || 'todo', lang: f.lang.value || 'python', solvedAt: f.solvedAt.value || null }
  for (const k of TEXT_FIELDS) out[k] = f[k].value
  return out
}

function setSaveState(text) {
  const el = $('#save-state')
  if (el) el.textContent = text
}

function scheduleSave() {
  if (!edit) return
  setSaveState('saving…')
  clearTimeout(edit.timer)
  edit.timer = setTimeout(flushEdit, AUTOSAVE_MS)
}

// writes the pending autosave right away (if one is pending)
function flushEdit() {
  if (!edit || edit.timer === null) return
  clearTimeout(edit.timer)
  edit.timer = null
  const patch = readForm()
  if (!patch) return
  // don't create an entry for a form nobody filled in
  if (!state.entries[edit.id] && !hasContent(normalizeEntry(patch))) {
    setSaveState('')
    return
  }
  const ok = updateEntry(edit.id, patch)
  setSaveState(ok ? 'saved' : 'not saved')
}

// end edit mode, keeping whatever was typed
function closeEditState() {
  flushEdit()
  edit = null
}

function saveAndClose() {
  if (!edit) return
  const id = edit.id
  if (edit.timer === null) edit.timer = 0 // force a write of the current form
  flushEdit()
  edit = null
  refreshAfterChange()
  showRead(id)
}

function cancelEdit() {
  if (!edit) return
  const { id, snapshot } = edit
  clearTimeout(edit.timer)
  edit = null
  if (snapshot) state.entries[id] = snapshot
  else delete state.entries[id]
  save()
  showRead(id)
}

function askClear() {
  const box = $('#confirm')
  box.innerHTML = `<span>clear everything for this problem? this can't be undone.</span>
    <button type="button" class="btn" data-action="clear-yes">yes, clear</button>
    <button type="button" class="link" data-action="clear-no">keep it</button>`
  box.querySelector('button').focus()
}

function clearEntryNow() {
  if (!edit) return
  const id = edit.id
  clearTimeout(edit.timer)
  edit = null
  deleteEntry(id)
  renderProblem(id, 'edit')
  setSaveState('cleared')
}

// tab inserts 4 spaces, shift+tab dedents. esc releases tab for focus moves.
function onCodeKeydown(ev) {
  const ta = ev.currentTarget
  if (ev.key === 'Escape') {
    if (!ta.dataset.release) {
      ta.dataset.release = '1'
      $('#tab-hint').textContent = 'tab moves focus now'
      ev.preventDefault()
    }
    return
  }
  if (ev.key !== 'Tab') {
    if (!['Shift', 'Control', 'Alt', 'Meta'].includes(ev.key)) {
      delete ta.dataset.release
      $('#tab-hint').textContent = 'tab indents · esc then tab moves on'
    }
    return
  }
  if (ta.dataset.release || ev.ctrlKey || ev.metaKey || ev.altKey) return
  ev.preventDefault()
  indent(ta, ev.shiftKey)
}

function insertText(ta, text) {
  ta.focus()
  // execCommand keeps the browser's undo stack; fall back if it's gone
  if (!document.execCommand('insertText', false, text)) {
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end')
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

function indent(ta, dedent) {
  const { value, selectionStart: s, selectionEnd: e } = ta
  const multi = value.slice(s, e).includes('\n')
  if (!dedent && !multi) return insertText(ta, '    ')
  const start = value.lastIndexOf('\n', s - 1) + 1
  const lastLineEnd = multi && value[e - 1] === '\n' ? e - 1 : e
  const nl = value.indexOf('\n', lastLineEnd)
  const end = nl === -1 ? value.length : nl
  const lines = value.slice(start, end).split('\n')
  let firstShift = 0
  const changed = lines.map((line, i) => {
    let shift
    let out
    if (dedent) {
      const n = /^ {1,4}|^\t/.exec(line)?.[0].length ?? 0
      shift = -n
      out = line.slice(n)
    } else {
      shift = 4
      out = `    ${line}`
    }
    if (i === 0) firstShift = shift
    return out
  })
  const replacement = changed.join('\n')
  if (replacement === value.slice(start, end)) return
  ta.setSelectionRange(start, end)
  insertText(ta, replacement)
  if (multi) ta.setSelectionRange(start, start + replacement.length)
  else {
    const pos = Math.max(start, s + firstShift)
    ta.setSelectionRange(pos, pos)
  }
}

// ---------------------------------------------------------------------------
// actions

function refreshAfterChange() {
  if (current.name === 'list') {
    renderRoadmap()
    renderLists()
  }
  renderBanners()
}

function toggleStar(id) {
  const starred = !state.entries[id]?.starred
  updateEntry(id, { starred })
  if (current.name === 'list') renderLists()
  else {
    for (const b of view.querySelectorAll(`.star[data-id="${id}"]`)) {
      b.textContent = starred ? '★' : '☆'
      b.setAttribute('aria-pressed', String(starred))
    }
  }
}

function setFilter(patch) {
  filters = { ...filters, ...patch }
  saveFilters()
  if (current.name !== 'list') go('#/')
  else {
    renderLists()
  }
}

function randomProblem() {
  const ctx = { today: localDay() }
  const pool = PROBLEMS.filter((p) => statusOf(p.id) !== 'solved' && matches(p, ctx))
  if (!pool.length) {
    const msg = isFiltering() ? 'nothing unsolved matches the current filters.' : 'nothing left unsolved.'
    if (current.name === 'list') $('#list-msg').textContent = msg
    else toast(msg)
    return
  }
  go(`#/p/${pool[Math.floor(Math.random() * pool.length)].id}`)
}

function copyCode(button) {
  const code = getEntry(current.id).code
  const done = () => {
    button.textContent = 'copied'
    setTimeout(() => (button.textContent = 'copy'), 1500)
  }
  navigator.clipboard.writeText(code).then(done, () => toast("couldn't copy to the clipboard."))
}

// ---------------------------------------------------------------------------
// backup

function exportJournal() {
  flushEdit()
  state.lastExportAt = new Date().toISOString()
  save()
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leetcode-journal-${localDay()}.json`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  renderBanners()
  const n = Object.keys(state.entries).length
  toast(`exported ${n} ${n === 1 ? 'entry' : 'entries'}.`)
}

let dialogHandler = null

function openDialog(html, handler = null) {
  dialog.innerHTML = html
  dialogHandler = handler
  dialog.showModal()
  dialog.querySelector('button')?.focus()
}

dialog.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-dialog]')
  if (!b) {
    if (ev.target === dialog) dialog.close()
    return
  }
  const handler = dialogHandler
  dialogHandler = null
  dialog.close()
  if (b.dataset.dialog !== 'close') handler?.(b.dataset.dialog)
})

async function importFile(file) {
  let parsed
  try {
    parsed = normalizeState(JSON.parse(await file.text()))
  } catch (err) {
    openDialog(
      `<h2 id="dialog-title">import</h2><p>that file isn't a journal export (${esc(err.message)}). nothing was changed.</p><div class="dialog-actions"><button type="button" class="btn" data-dialog="close">ok</button></div>`,
    )
    return
  }
  const incoming = parsed.state
  const ids = Object.keys(incoming.entries)
  const conflicts = ids.filter(
    (id) => state.entries[id] && JSON.stringify(state.entries[id]) !== JSON.stringify(incoming.entries[id]),
  )
  const skipped = parsed.unknown ? ` (${parsed.unknown} unknown ${parsed.unknown === 1 ? 'id' : 'ids'} skipped)` : ''
  openDialog(
    `<h2 id="dialog-title">import ${esc(file.name)}</h2>
    <p>${ids.length} ${ids.length === 1 ? 'entry' : 'entries'}, ${conflicts.length} conflict with existing${skipped}.</p>
    <p class="gray">replace all overwrites this browser's journal. merge keeps whichever version of each entry was updated last.</p>
    <div class="dialog-actions">
      <button type="button" class="btn" data-dialog="merge">merge (newer updatedAt wins)</button>
      <button type="button" class="btn" data-dialog="replace">replace all</button>
      <button type="button" class="link" data-dialog="close">cancel</button>
    </div>`,
    (choice) => applyImport(incoming, choice),
  )
}

function applyImport(incoming, choice) {
  if (edit) {
    clearTimeout(edit.timer)
    edit = null
  }
  if (choice === 'replace') {
    state = incoming
  } else {
    for (const [id, entry] of Object.entries(incoming.entries)) {
      const mine = state.entries[id]
      if (!mine || Date.parse(entry.updatedAt) > Date.parse(mine.updatedAt)) state.entries[id] = entry
    }
    const starts = [state.roadmap.startDate, incoming.roadmap.startDate].filter(Boolean).sort()
    state.roadmap.startDate = starts[0] ?? null
  }
  syncStartDate()
  save()
  toast(choice === 'replace' ? 'journal replaced from file.' : 'file merged into journal.')
  route()
}

// ---------------------------------------------------------------------------
// events

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-action], [data-filter]')
  if (!t || t.closest('dialog')) return
  const { filter, value } = t.dataset
  if (filter === 'status') return setFilter({ status: value })
  if (filter === 'diff') {
    return setFilter({ diff: filters.diff.includes(value) ? filters.diff.filter((d) => d !== value) : [...filters.diff, value] })
  }
  if (filter === 'starred' || filter === 'due') return setFilter({ [filter]: !filters[filter] })

  const id = t.dataset.id
  switch (t.dataset.action) {
    case 'star':
      return toggleStar(id)
    case 'toggle-cat': {
      const key = t.dataset.cat
      if (ui.collapsed[key]) delete ui.collapsed[key]
      else ui.collapsed[key] = true
      saveUi()
      return renderLists()
    }
    case 'random':
      return randomProblem()
    case 'show-due':
      if ($('#search')) $('#search').value = ''
      return setFilter({ ...DEFAULT_FILTERS, due: true })
    case 'set-start':
      editingStart = true
      renderRoadmap()
      return $('#start-input')?.focus()
    case 'start-done':
      editingStart = false
      renderRoadmap()
      return $('#roadmap [data-action="set-start"]')?.focus()
    case 'edit':
      return go(`#/p/${current.id}/edit`)
    case 'copy':
      return copyCode(t)
    case 'mark-reviewed': {
      const e = getEntry(current.id)
      updateEntry(current.id, { reviews: [...e.reviews, new Date().toISOString()] })
      renderProblem(current.id, 'read')
      return $('[data-action="mark-reviewed"]')?.focus()
    }
    case 'cancel-edit':
      return cancelEdit()
    case 'clear-entry':
      return askClear()
    case 'clear-yes':
      return clearEntryNow()
    case 'clear-no':
      $('#confirm').innerHTML = ''
      return $('#edit-form [name="code"]')?.focus()
    case 'export':
      return exportJournal()
    case 'import':
      return $('#import-file').click()
    case 'dismiss-corrupt':
      notices.corruptDismissed = true
      return renderBanners()
    case 'dismiss-backup':
      ui.backupDismissedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      saveUi()
      return renderBanners()
  }
})

$('#import-file').addEventListener('change', (ev) => {
  const file = ev.target.files[0]
  ev.target.value = ''
  if (file) importFile(file)
})

document.addEventListener('input', (ev) => {
  if (ev.target.id === 'search') {
    filters = { ...filters, q: ev.target.value }
    saveFilters()
    $('#list-msg').textContent = ''
    renderLists()
  }
})

document.addEventListener('change', (ev) => {
  if (ev.target.id === 'start-input') {
    state.roadmap.startDate = isDay(ev.target.value) ? ev.target.value : null
    save()
    renderRoadmap()
  }
})

// a new local day while the tab was in the background: recompute everything
function checkDay() {
  if (localDay() === renderedDay) return
  renderedDay = localDay()
  if (current.name === 'list') {
    renderRoadmap()
    renderLists()
  } else if (current.mode === 'read') renderProblem(current.id, 'read')
  renderBanners()
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushEdit()
  else checkDay()
})
window.addEventListener('focus', checkDay)
window.addEventListener('pagehide', flushEdit)
window.addEventListener('hashchange', route)

// ---------------------------------------------------------------------------
// start

history.scrollRestoration = 'manual'
state = load()
route()
