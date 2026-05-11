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

// ── Year selector ─────────────────────────────────────────────────────────────
function populateYearSelect() {
  const select   = document.getElementById('year-input')
  const thisYear = new Date().getFullYear()
  for (let y = thisYear; y >= 2023; y--) {
    const opt = document.createElement('option')
    opt.value = y
    opt.textContent = y
    select.appendChild(opt)
  }
  select.value = thisYear
}

// ── Load & render ─────────────────────────────────────────────────────────────
async function loadAndRender(year) {
  const firstDay = `${year}-01-01`
  const lastDay  = `${year}-12-31`

  const [{ data: jobs }, { data: specJobs }, { data: customers }, { data: expenses }] = await Promise.all([
    db.from('jobs').select('*').gte('mowed_at', firstDay).lte('mowed_at', lastDay),
    db.from('specialty_jobs').select('*').gte('job_date', firstDay).lte('job_date', lastDay),
    db.from('customers').select('*').order('name'),
    db.from('expenses').select('*').gte('expense_date', firstDay).lte('expense_date', lastDay).order('expense_date', { ascending: false }),
  ])

  const jobList  = jobs      || []
  const specList = specJobs  || []
  const custList = customers || []
  const expList  = expenses  || []

  const priceMap = {}
  custList.forEach(c => { priceMap[c.id] = parseFloat(c.price_per_cut) || 0 })

  // ── Summary cards ──
  const mowCollected    = jobList.filter(j =>  j.paid).reduce((s, j) => s + (priceMap[j.customer_id] || 0), 0)
  const mowOutstanding  = jobList.filter(j => !j.paid).reduce((s, j) => s + (priceMap[j.customer_id] || 0), 0)
  const specCollected   = specList.filter(j =>  j.paid).reduce((s, j) => s + (parseFloat(j.amount) || 0), 0)
  const specOutstanding = specList.filter(j => !j.paid).reduce((s, j) => s + (parseFloat(j.amount) || 0), 0)
  const totalCollected  = mowCollected + specCollected
  const totalOutstanding = mowOutstanding + specOutstanding
  const totalExpenses   = expList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const netIncome       = totalCollected - totalExpenses

  document.getElementById('y-jobs').textContent        = jobList.length + specList.length
  document.getElementById('y-collected').textContent   = fmt(totalCollected)
  document.getElementById('y-outstanding').textContent = fmt(totalOutstanding)
  document.getElementById('y-expenses').textContent    = fmt(totalExpenses)
  document.getElementById('y-net-income').textContent  = fmt(netIncome)

  // ── Customer breakdown ──
  const custData = custList.map(c => {
    const cJobs  = jobList.filter(j => j.customer_id === c.id)
    const cSpec  = specList.filter(j => j.customer_id === c.id)
    const price  = priceMap[c.id]

    const mowEarned  = cJobs.length * price
    const specEarned = cSpec.reduce((s, j) => s + (parseFloat(j.amount) || 0), 0)
    const totalEarned = mowEarned + specEarned

    const mowPaid  = cJobs.filter(j => j.paid).length * price
    const specPaid = cSpec.filter(j => j.paid).reduce((s, j) => s + (parseFloat(j.amount) || 0), 0)
    const totalPaid = mowPaid + specPaid
    const totalOwed = totalEarned - totalPaid

    return {
      id: c.id,
      name: c.name,
      mowCount: cJobs.length,
      specCount: cSpec.length,
      totalEarned,
      totalPaid,
      totalOwed,
    }
  }).sort((a, b) => {
    const diff = (b.mowCount + b.specCount) - (a.mowCount + a.specCount)
    return diff !== 0 ? diff : a.name.localeCompare(b.name)
  })

  const custContainer = document.getElementById('customer-breakdown')
  if (!custList.length) {
    custContainer.innerHTML = '<p class="empty">No customers.</p>'
  } else {
    custContainer.innerHTML = custData.map(c => {
      const parts = []
      if (c.mowCount > 0)  parts.push(`${c.mowCount} mowing`)
      if (c.specCount > 0) parts.push(`${c.specCount} specialty`)
      const meta = parts.length ? parts.join(' · ') : 'No jobs this year'
      return `
        <div class="cust-breakdown-row">
          <div class="cust-breakdown-left">
            <a class="cust-breakdown-name" href="index.html?customer=${c.id}" onclick="localStorage.setItem('openCustomer','${c.id}')">${esc(c.name)}</a>
            <span class="cust-breakdown-meta">${meta}</span>
          </div>
          <div class="cust-breakdown-right">
            <div class="cust-stat">
              <div class="cust-stat-label">Earned</div>
              <div class="cust-stat-value">${fmt(c.totalEarned)}</div>
            </div>
            <div class="cust-stat">
              <div class="cust-stat-label">Paid</div>
              <div class="cust-stat-value">${fmt(c.totalPaid)}</div>
            </div>
            <div class="cust-stat">
              <div class="cust-stat-label">Owed</div>
              <div class="cust-stat-value${c.totalOwed > 0 ? ' owed' : ''}">${fmt(c.totalOwed)}</div>
            </div>
          </div>
        </div>`
    }).join('')
  }

  // ── Expenses by category ──
  const catTotals = {}
  const catCounts = {}
  expList.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + (parseFloat(e.amount) || 0)
    catCounts[e.category] = (catCounts[e.category] || 0) + 1
  })

  const catContainer = document.getElementById('category-breakdown')
  if (!expList.length) {
    catContainer.innerHTML = '<p class="empty">No expenses this year.</p>'
  } else {
    const cats = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a])
    catContainer.innerHTML = cats.map(cat => `
      <div class="cat-row">
        <div>
          <div class="cat-name">${esc(cat)}</div>
          <div class="cat-meta">${catCounts[cat]} expense${catCounts[cat] === 1 ? '' : 's'}</div>
        </div>
        <div class="cat-total">${fmt(catTotals[cat])}</div>
      </div>`).join('')
  }

  // ── All expenses ──
  const expContainer = document.getElementById('expenses-year-list')
  if (!expList.length) {
    expContainer.innerHTML = '<p class="empty">No expenses this year.</p>'
  } else {
    expContainer.innerHTML = expList.map(e => `
      <div class="stats-job-row">
        <div class="stats-job-left">
          <span class="stats-job-name">${esc(e.category)}</span>
          ${e.description ? `<span class="stats-job-desc">${esc(e.description)}</span>` : ''}
          <span class="stats-job-date">${fmtDate(e.expense_date)}</span>
        </div>
        <span style="font-weight:600;color:#c0392b;">${fmt(e.amount)}</span>
      </div>`).join('')
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
populateYearSelect()
const yearSelect = document.getElementById('year-input')
yearSelect.addEventListener('change', () => loadAndRender(parseInt(yearSelect.value)))
loadAndRender(parseInt(yearSelect.value))
