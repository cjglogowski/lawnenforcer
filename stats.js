const SUPABASE_URL = 'https://qeerbiujghzshyycwimv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlZXJiaXVqZ2h6c2h5eWN3aW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODc1ODksImV4cCI6MjA5Mzg2MzU4OX0.2BAwLKMA4XAVLLLPccxnp5l2QEpal4Km1FsKuPWGKUw'

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) {
  return '$' + (parseFloat(n) || 0).toFixed(2)
}

function fmtDate(str) {
  if (!str) return '—'
  const [y, m, d] = str.split('-')
  return `${parseInt(m)}/${parseInt(d)}/${y}`
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function todayMonthValue() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

// ── Load & render ─────────────────────────────────────────────────────────────
async function loadAndRender(monthValue) {
  const [year, month] = monthValue.split('-').map(Number)

  const firstDay   = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay    = new Date(year, month, 0)
  const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`

  const [{ data: jobs }, { data: specJobs }, { data: customers }] = await Promise.all([
    db.from('jobs')
      .select('*')
      .gte('mowed_at', firstDay)
      .lte('mowed_at', lastDayStr)
      .order('mowed_at', { ascending: false }),
    db.from('specialty_jobs')
      .select('*')
      .gte('job_date', firstDay)
      .lte('job_date', lastDayStr)
      .order('job_date', { ascending: false }),
    db.from('customers').select('id, name, price_per_cut'),
  ])

  const jobList  = jobs      || []
  const specList = specJobs  || []
  const custList = customers || []

  const priceMap = {}
  const nameMap  = {}
  custList.forEach(c => {
    priceMap[c.id] = parseFloat(c.price_per_cut) || 0
    nameMap[c.id]  = c.name
  })

  // ── Mowing summary ──
  const mowCollected   = jobList.filter(j =>  j.paid).reduce((s, j) => s + (priceMap[j.customer_id] || 0), 0)
  const mowOutstanding = jobList.filter(j => !j.paid).reduce((s, j) => s + (priceMap[j.customer_id] || 0), 0)

  document.getElementById('s-jobs').textContent        = jobList.length
  document.getElementById('s-collected').textContent   = fmt(mowCollected)
  document.getElementById('s-outstanding').textContent = fmt(mowOutstanding)

  const mowContainer = document.getElementById('stats-job-list')
  if (!jobList.length) {
    mowContainer.innerHTML = '<p class="empty">No mowing jobs this month.</p>'
  } else {
    mowContainer.innerHTML = jobList.map(j => {
      const paid = j.paid
      return `
        <div class="stats-job-row">
          <div class="stats-job-left">
            <span class="stats-job-name">${esc(nameMap[j.customer_id] || 'Unknown')}</span>
            <span class="stats-job-date">${fmtDate(j.mowed_at)} · ${fmt(priceMap[j.customer_id])}</span>
          </div>
          <span class="badge ${paid ? 'badge-paid' : 'badge-unpaid'}">${paid ? 'Paid' : 'Unpaid'}</span>
        </div>`
    }).join('')
  }

  // ── Specialty summary ──
  const specCollected   = specList.filter(j =>  j.paid).reduce((s, j) => s + (parseFloat(j.amount) || 0), 0)
  const specOutstanding = specList.filter(j => !j.paid).reduce((s, j) => s + (parseFloat(j.amount) || 0), 0)

  document.getElementById('s-spec-jobs').textContent        = specList.length
  document.getElementById('s-spec-collected').textContent   = fmt(specCollected)
  document.getElementById('s-spec-outstanding').textContent = fmt(specOutstanding)

  const specContainer = document.getElementById('stats-specialty-list')
  if (!specList.length) {
    specContainer.innerHTML = '<p class="empty">No specialty jobs this month.</p>'
  } else {
    specContainer.innerHTML = specList.map(j => {
      const paid = j.paid
      return `
        <div class="stats-job-row">
          <div class="stats-job-left">
            <span class="stats-job-name">${esc(nameMap[j.customer_id] || 'Unknown')}</span>
            <span class="stats-job-desc">${esc(j.description)}</span>
            <span class="stats-job-date">${fmtDate(j.job_date)} · ${fmt(j.amount)}</span>
          </div>
          <span class="badge ${paid ? 'badge-paid' : 'badge-unpaid'}">${paid ? 'Paid' : 'Unpaid'}</span>
        </div>`
    }).join('')
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
const input = document.getElementById('month-input')
input.value = todayMonthValue()
input.addEventListener('change', () => loadAndRender(input.value))
loadAndRender(input.value)
