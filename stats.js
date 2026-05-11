const SUPABASE_URL = 'https://qeerbiujghzshyycwimv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlZXJiaXVqZ2h6c2h5eWN3aW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODc1ODksImV4cCI6MjA5Mzg2MzU4OX0.2BAwLKMA4XAVLLLPccxnp5l2QEpal4Km1FsKuPWGKUw'

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── State ─────────────────────────────────────────────────────────────────────
let allExpenses      = []
let editingExpenseId = null

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

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Load & render ─────────────────────────────────────────────────────────────
async function loadAndRender(monthValue) {
  const [year, month] = monthValue.split('-').map(Number)

  const firstDay   = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay    = new Date(year, month, 0)
  const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`

  const [{ data: jobs }, { data: specJobs }, { data: customers }, { data: expenses }] = await Promise.all([
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
    db.from('expenses').select('*').order('expense_date', { ascending: false }),
  ])

  const jobList  = jobs      || []
  const specList = specJobs  || []
  const custList = customers || []
  allExpenses    = expenses  || []

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

  // ── Monthly overview ──
  const monthExpenses  = allExpenses.filter(e => e.expense_date >= firstDay && e.expense_date <= lastDayStr)
  const totalExpenses  = monthExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const totalCollected = mowCollected + specCollected
  const netIncome      = totalCollected - totalExpenses

  document.getElementById('s-total-collected').textContent = fmt(totalCollected)
  document.getElementById('s-total-expenses').textContent  = fmt(totalExpenses)
  document.getElementById('s-net-income').textContent      = fmt(netIncome)

  renderExpensesList()
}

// ── Expenses list ─────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = ['Mower Fuel', 'Truck Fuel', 'Maintenance', 'Purchase', 'Other']

function renderExpensesList() {
  const container = document.getElementById('expenses-list')
  if (!allExpenses.length) {
    container.innerHTML = '<p class="empty">No expenses yet.</p>'
    return
  }

  container.innerHTML = allExpenses.map(e => {
    if (editingExpenseId === e.id) {
      const catOptions = EXPENSE_CATEGORIES.map(cat =>
        `<option value="${cat}" ${e.category === cat ? 'selected' : ''}>${cat}</option>`
      ).join('')
      return `
        <div class="stats-job-row exp-edit-row" data-eid="${e.id}">
          <div class="exp-edit-fields">
            <select class="exp-edit-cat">${catOptions}</select>
            <input type="text"   class="exp-edit-desc"   value="${esc(e.description || '')}" placeholder="Description (optional)" />
            <div style="display:flex;gap:8px;">
              <input type="number" class="exp-edit-amount" value="${e.amount}" step="0.01" min="0" placeholder="Amount ($)" style="flex:1;" />
              <input type="date"   class="exp-edit-date"   value="${e.expense_date}" style="flex:1;" />
            </div>
            <div class="form-actions" style="margin-top:6px;">
              <button class="btn-primary exp-save-btn" data-eid="${e.id}">Save</button>
              <button class="btn-ghost exp-cancel-btn">Cancel</button>
            </div>
          </div>
        </div>`
    }
    return `
      <div class="stats-job-row" data-eid="${e.id}">
        <div class="stats-job-left">
          <span class="stats-job-name">${esc(e.category)}</span>
          ${e.description ? `<span class="stats-job-desc">${esc(e.description)}</span>` : ''}
          <span class="stats-job-date">${fmtDate(e.expense_date)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="exp-amount">${fmt(e.amount)}</span>
          <button class="btn-ghost exp-edit-btn" data-eid="${e.id}" style="font-size:0.72rem;padding:3px 7px;line-height:1.5;">✎</button>
          <button class="btn-delete-job exp-delete-btn" data-eid="${e.id}" title="Delete">✕</button>
        </div>
      </div>`
  }).join('')

  container.querySelectorAll('.exp-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      editingExpenseId = btn.dataset.eid
      renderExpensesList()
    })
  })

  container.querySelectorAll('.exp-save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row    = btn.closest('.exp-edit-row')
      const cat    = row.querySelector('.exp-edit-cat').value
      const desc   = row.querySelector('.exp-edit-desc').value.trim()
      const amount = parseFloat(row.querySelector('.exp-edit-amount').value) || 0
      const date   = row.querySelector('.exp-edit-date').value || todayISO()
      btn.disabled = true
      btn.textContent = 'Saving…'
      await db.from('expenses').update({ category: cat, description: desc || null, amount, expense_date: date }).eq('id', btn.dataset.eid)
      editingExpenseId = null
      await loadAndRender(document.getElementById('month-input').value)
    })
  })

  container.querySelectorAll('.exp-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      editingExpenseId = null
      renderExpensesList()
    })
  })

  container.querySelectorAll('.exp-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true
      await db.from('expenses').delete().eq('id', btn.dataset.eid)
      await loadAndRender(document.getElementById('month-input').value)
    })
  })
}

// ── Boot ──────────────────────────────────────────────────────────────────────
const input = document.getElementById('month-input')
input.value = todayMonthValue()
input.addEventListener('change', () => loadAndRender(input.value))
loadAndRender(input.value)

document.getElementById('expense-date').value = todayISO()

document.getElementById('btn-show-expense-form').addEventListener('click', () => {
  document.getElementById('expense-add-form').classList.remove('hidden')
  document.getElementById('expense-desc').focus()
})

document.getElementById('btn-cancel-expense').addEventListener('click', () => {
  document.getElementById('expense-add-form').classList.add('hidden')
})

document.getElementById('btn-save-expense').addEventListener('click', async () => {
  const cat    = document.getElementById('expense-category').value
  const desc   = document.getElementById('expense-desc').value.trim()
  const amount = parseFloat(document.getElementById('expense-amount').value) || 0
  const date   = document.getElementById('expense-date').value || todayISO()
  if (!amount) { document.getElementById('expense-amount').focus(); return }

  const btn = document.getElementById('btn-save-expense')
  btn.disabled = true
  btn.textContent = 'Saving…'
  await db.from('expenses').insert({ category: cat, description: desc || null, amount, expense_date: date })
  document.getElementById('expense-add-form').classList.add('hidden')
  document.getElementById('expense-desc').value   = ''
  document.getElementById('expense-amount').value = ''
  document.getElementById('expense-date').value   = todayISO()
  btn.disabled = false
  btn.textContent = 'Save'
  await loadAndRender(input.value)
})
