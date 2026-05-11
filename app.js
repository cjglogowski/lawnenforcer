const SUPABASE_URL = 'https://qeerbiujghzshyycwimv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlZXJiaXVqZ2h6c2h5eWN3aW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODc1ODksImV4cCI6MjA5Mzg2MzU4OX0.2BAwLKMA4XAVLLLPccxnp5l2QEpal4Km1FsKuPWGKUw'

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── State ─────────────────────────────────────────────────────────────────────
let customers = []
let allJobs = []
let allSpecialtyJobs = []
let activeCustomer = null
let editingDetailCustomer = false // edit mode in detail panel header
let editingSpecialtyJobId = null  // inline edit on specialty job row

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  await loadData()
  renderSummary()
  renderCustomerList()
  renderSpecialtySection()
  bindStaticEvents()
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadData() {
  const [{ data: custs }, { data: jobs }, { data: specJobs }] = await Promise.all([
    db.from('customers').select('*').order('name'),
    db.from('jobs').select('*').order('mowed_at', { ascending: false }),
    db.from('specialty_jobs').select('*').order('job_date', { ascending: false }),
  ])
  customers        = custs     || []
  allJobs          = jobs      || []
  allSpecialtyJobs = specJobs  || []
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function renderSummary() {
  const priceMap = {}
  customers.forEach(c => { priceMap[c.id] = parseFloat(c.price_per_cut) || 0 })

  const mowCollected   = allJobs.filter(j =>  j.paid).reduce((s, j) => s + (priceMap[j.customer_id] || 0), 0)
  const mowOutstanding = allJobs.filter(j => !j.paid).reduce((s, j) => s + (priceMap[j.customer_id] || 0), 0)
  const specCollected   = allSpecialtyJobs.filter(j =>  j.paid).reduce((s, j) => s + (parseFloat(j.amount) || 0), 0)
  const specOutstanding = allSpecialtyJobs.filter(j => !j.paid).reduce((s, j) => s + (parseFloat(j.amount) || 0), 0)

  document.getElementById('stat-jobs').textContent           = allJobs.length
  document.getElementById('stat-specialty-jobs').textContent = allSpecialtyJobs.length
  document.getElementById('stat-collected').textContent      = fmt(mowCollected + specCollected)
  document.getElementById('stat-outstanding').textContent    = fmt(mowOutstanding + specOutstanding)
}

// ── Customer list ─────────────────────────────────────────────────────────────
function renderCustomerList() {
  const container = document.getElementById('customer-list')
  if (!customers.length) {
    container.innerHTML = '<p class="empty">No customers yet. Add one above.</p>'
    return
  }

  container.innerHTML = customers.map(c => {
    const jobs    = allJobs.filter(j => j.customer_id === c.id)
    const last    = jobs[0]
    const lastTxt = last ? fmtDate(last.mowed_at) : 'Never'
    const unpaidMow  = jobs.filter(j => !j.paid).length
    const unpaidSpec = allSpecialtyJobs.filter(j => j.customer_id === c.id && !j.paid).length
    const unpaid = unpaidMow + unpaidSpec
    const badgeCls = unpaid > 0 ? 'badge-unpaid' : 'badge-paid'
    const badgeTxt = unpaid > 0 ? `${unpaid} unpaid` : 'All paid'

    return `
      <div class="customer-card" data-id="${c.id}">
        <div class="card-top">
          <span class="card-name">${esc(c.name)}</span>
          <span class="badge ${badgeCls}">${badgeTxt}</span>
        </div>
        <div class="card-address">${esc(c.address || '—')}</div>
        <div class="card-bottom">
          <span class="card-meta">Last mowed: ${lastTxt} · ${fmt(c.price_per_cut)}/cut</span>
          <div class="mow-group">
            <input type="date" class="mow-date" data-cid="${c.id}" value="${todayISO()}" />
            <button class="btn-mow" data-cid="${c.id}">Mowed today</button>
          </div>
        </div>
      </div>`
  }).join('')

  container.querySelectorAll('.mow-date').forEach(input => { input.value = todayISO() })

  container.querySelectorAll('.customer-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.mow-group')) return
      openDetail(customers.find(c => c.id === card.dataset.id))
    })
  })

  container.querySelectorAll('.btn-edit-customer').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const cid = btn.dataset.cid
      editingCustomerId = editingCustomerId === cid ? null : cid
      renderCustomerList()
    })
  })

  container.querySelectorAll('.btn-mow').forEach(btn => {
    const dateInput = btn.closest('.mow-group').querySelector('.mow-date')
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      const mowedAt = dateInput.value || todayISO()
      btn.disabled = true
      btn.textContent = 'Saving…'
      await db.from('jobs').insert({ customer_id: btn.dataset.cid, mowed_at: mowedAt, paid: false })
      await loadData()
      renderSummary()
      renderCustomerList()
      renderSpecialtySection()
    })
  })
}

// ── Specialty section (main page) ─────────────────────────────────────────────
function renderSpecialtySection() {
  const select = document.getElementById('specialty-customer-select')
  if (select) {
    const current = select.value
    select.innerHTML = customers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')
    if (current) select.value = current
  }

  const container = document.getElementById('specialty-list')
  if (!allSpecialtyJobs.length) {
    container.innerHTML = '<p class="empty">No specialty jobs yet.</p>'
    return
  }

  const nameMap = {}
  customers.forEach(c => { nameMap[c.id] = c.name })

  container.innerHTML = allSpecialtyJobs.map(j => {
    if (editingSpecialtyJobId === j.id) {
      return `
        <div class="specialty-row" data-sjid="${j.id}">
          <div class="specialty-left">
            <input type="text"   class="spec-edit-input spec-edit-desc"   value="${esc(j.description)}" placeholder="Description" />
            <div class="spec-edit-row">
              <input type="date"   class="spec-edit-input spec-edit-date"   value="${j.job_date}" />
              <input type="number" class="spec-edit-input spec-edit-amount" value="${j.amount}" step="0.01" min="0" placeholder="Amount" />
            </div>
            <div class="form-actions" style="margin-top:6px;">
              <button class="btn-primary spec-edit-save" data-sjid="${j.id}">Save</button>
              <button class="btn-ghost spec-edit-cancel">Cancel</button>
            </div>
          </div>
          <div class="specialty-right">
            <button class="toggle-btn ${j.paid ? 'toggle-paid' : 'toggle-unpaid'}" data-sjid="${j.id}" data-paid="${j.paid}">
              ${j.paid ? 'Paid' : 'Unpaid'}
            </button>
            <button class="btn-delete-job" data-sjid="${j.id}" title="Delete">✕</button>
          </div>
        </div>`
    }
    return `
      <div class="specialty-row" data-sjid="${j.id}">
        <div class="specialty-left">
          <span class="specialty-name">${esc(nameMap[j.customer_id] || 'Unknown')}</span>
          <span class="specialty-desc">${esc(j.description)}</span>
          <span class="specialty-meta">${fmtDate(j.job_date)} · ${fmt(j.amount)}</span>
        </div>
        <div class="specialty-right">
          <button class="btn-edit-spec btn-ghost" data-sjid="${j.id}" title="Edit">✎</button>
          <button class="toggle-btn ${j.paid ? 'toggle-paid' : 'toggle-unpaid'}" data-sjid="${j.id}" data-paid="${j.paid}">
            ${j.paid ? 'Paid' : 'Unpaid'}
          </button>
          <button class="btn-delete-job" data-sjid="${j.id}" title="Delete">✕</button>
        </div>
      </div>`
  }).join('')

  // Edit button
  container.querySelectorAll('.btn-edit-spec').forEach(btn => {
    btn.addEventListener('click', () => {
      editingSpecialtyJobId = btn.dataset.sjid
      renderSpecialtySection()
    })
  })

  // Save spec edit
  container.querySelectorAll('.spec-edit-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row    = btn.closest('.specialty-row')
      const desc   = row.querySelector('.spec-edit-desc').value.trim()
      const date   = row.querySelector('.spec-edit-date').value || todayISO()
      const amount = parseFloat(row.querySelector('.spec-edit-amount').value) || 0
      if (!desc) { row.querySelector('.spec-edit-desc').focus(); return }
      btn.disabled = true
      btn.textContent = 'Saving…'
      await db.from('specialty_jobs').update({ description: desc, job_date: date, amount }).eq('id', btn.dataset.sjid)
      editingSpecialtyJobId = null
      await loadData()
      renderSummary()
      renderCustomerList()
      renderSpecialtySection()
      if (activeCustomer) openDetail(customers.find(c => c.id === activeCustomer.id))
    })
  })

  // Cancel spec edit
  container.querySelectorAll('.spec-edit-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      editingSpecialtyJobId = null
      renderSpecialtySection()
    })
  })

  // Toggle paid
  container.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nowPaid = btn.dataset.paid === 'true'
      btn.disabled = true
      await db.from('specialty_jobs').update({ paid: !nowPaid }).eq('id', btn.dataset.sjid)
      await loadData()
      renderSummary()
      renderCustomerList()
      renderSpecialtySection()
      if (activeCustomer) openDetail(customers.find(c => c.id === activeCustomer.id))
    })
  })

  // Delete
  container.querySelectorAll('.btn-delete-job').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true
      await db.from('specialty_jobs').delete().eq('id', btn.dataset.sjid)
      await loadData()
      renderSummary()
      renderCustomerList()
      renderSpecialtySection()
      if (activeCustomer) openDetail(customers.find(c => c.id === activeCustomer.id))
    })
  })
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function openDetail(customer) {
  activeCustomer = customer
  const jobs     = allJobs.filter(j => j.customer_id === customer.id)
  const specJobs = allSpecialtyJobs.filter(j => j.customer_id === customer.id)
  const price    = parseFloat(customer.price_per_cut) || 0

  const mowPaid  = jobs.filter(j =>  j.paid).length * price
  const mowOwed  = jobs.filter(j => !j.paid).length * price
  const specPaid = specJobs.filter(j =>  j.paid).reduce((s, j) => s + (parseFloat(j.amount) || 0), 0)
  const specOwed = specJobs.filter(j => !j.paid).reduce((s, j) => s + (parseFloat(j.amount) || 0), 0)

  renderSummary()

  // ── Customer info (normal or edit mode) ──
  if (editingDetailCustomer) {
    document.getElementById('detail-name').textContent = ''
    document.getElementById('detail-address').innerHTML = `
      <div class="detail-cust-edit-form">
        <input type="text" class="dce-name"    value="${esc(customer.name)}"          placeholder="Name" />
        <input type="text" class="dce-address" value="${esc(customer.address || '')}" placeholder="Address" />
        <input type="tel"  class="dce-phone"   value="${esc(customer.phone || '')}"   placeholder="Phone" />
        <div class="form-actions" style="margin-top:8px;">
          <button class="btn-primary" id="btn-detail-cust-save">Save</button>
          <button class="btn-ghost"   id="btn-detail-cust-cancel">Cancel</button>
        </div>
      </div>`

    document.getElementById('btn-detail-cust-save').addEventListener('click', async () => {
      const name  = document.querySelector('.dce-name').value.trim()
      const addr  = document.querySelector('.dce-address').value.trim()
      const phone = document.querySelector('.dce-phone').value.trim()
      if (!name) { document.querySelector('.dce-name').focus(); return }
      const saveBtn = document.getElementById('btn-detail-cust-save')
      saveBtn.disabled = true
      saveBtn.textContent = 'Saving…'
      await db.from('customers').update({ name, address: addr, phone }).eq('id', customer.id)
      editingDetailCustomer = false
      await loadData()
      renderSummary()
      renderCustomerList()
      renderSpecialtySection()
      openDetail(customers.find(c => c.id === customer.id))
    })

    document.getElementById('btn-detail-cust-cancel').addEventListener('click', () => {
      editingDetailCustomer = false
      openDetail(customer)
    })
  } else {
    document.getElementById('detail-name').innerHTML =
      `${esc(customer.name)} <button class="btn-ghost btn-edit-detail-cust">✎ Edit</button>`
    document.getElementById('detail-address').textContent = customer.address || '—'

    document.querySelector('.btn-edit-detail-cust').addEventListener('click', () => {
      editingDetailCustomer = true
      openDetail(customer)
    })
  }

  document.getElementById('detail-cuts').textContent = jobs.length
  document.getElementById('detail-paid').textContent = fmt(mowPaid + specPaid)
  document.getElementById('detail-owed').textContent = fmt(mowOwed + specOwed)

  // ── Mowing jobs ──
  const jobList = document.getElementById('job-list')
  if (!jobs.length) {
    jobList.innerHTML = '<p class="empty">No jobs yet.</p>'
  } else {
    jobList.innerHTML = jobs.map(j => `
      <div class="job-row" data-jid="${j.id}">
        <input type="date" class="job-date-input" data-jid="${j.id}" value="${j.mowed_at}" />
        <div style="display:flex;align-items:center;gap:6px;">
          <button class="toggle-btn ${j.paid ? 'toggle-paid' : 'toggle-unpaid'}" data-jid="${j.id}" data-paid="${j.paid}">
            ${j.paid ? 'Paid' : 'Unpaid'}
          </button>
          <button class="btn-delete-job" data-jid="${j.id}" title="Delete job">✕</button>
        </div>
      </div>`).join('')

    jobList.querySelectorAll('.btn-delete-job').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true
        await db.from('jobs').delete().eq('id', btn.dataset.jid)
        await loadData()
        renderSummary()
        renderCustomerList()
        renderSpecialtySection()
        openDetail(customers.find(c => c.id === activeCustomer.id))
      })
    })

    jobList.querySelectorAll('.job-date-input').forEach(input => {
      input.addEventListener('change', async () => {
        if (!input.value) return
        await db.from('jobs').update({ mowed_at: input.value }).eq('id', input.dataset.jid)
        await loadData()
        renderSummary()
        renderCustomerList()
        renderSpecialtySection()
        openDetail(customers.find(c => c.id === activeCustomer.id))
      })
    })

    jobList.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const nowPaid = btn.dataset.paid === 'true'
        btn.disabled = true
        await db.from('jobs').update({ paid: !nowPaid }).eq('id', btn.dataset.jid)
        await loadData()
        renderSummary()
        renderCustomerList()
        renderSpecialtySection()
        openDetail(customers.find(c => c.id === activeCustomer.id))
      })
    })
  }

  // ── Specialty jobs for this customer ──
  const detailSpecList = document.getElementById('detail-specialty-list')
  if (!specJobs.length) {
    detailSpecList.innerHTML = '<p class="empty">No specialty jobs.</p>'
  } else {
    detailSpecList.innerHTML = specJobs.map(j => {
      if (editingSpecialtyJobId === j.id) {
        return `
          <div class="job-row detail-spec-edit-row" data-sjid="${j.id}">
            <div class="detail-spec-edit-left">
              <input type="text"   class="spec-edit-input spec-edit-desc"   value="${esc(j.description)}" placeholder="Description" />
              <div class="spec-edit-row">
                <input type="date"   class="spec-edit-input spec-edit-date"   value="${j.job_date}" />
                <input type="number" class="spec-edit-input spec-edit-amount" value="${j.amount}" step="0.01" min="0" />
              </div>
              <div class="form-actions" style="margin-top:6px;">
                <button class="btn-primary spec-edit-save" data-sjid="${j.id}">Save</button>
                <button class="btn-ghost spec-edit-cancel">Cancel</button>
              </div>
            </div>
            <div class="detail-spec-edit-right">
              <button class="toggle-btn ${j.paid ? 'toggle-paid' : 'toggle-unpaid'}" data-sjid="${j.id}" data-paid="${j.paid}">
                ${j.paid ? 'Paid' : 'Unpaid'}
              </button>
              <button class="btn-delete-job" data-sjid="${j.id}" title="Delete">✕</button>
            </div>
          </div>`
      }
      return `
        <div class="job-row" data-sjid="${j.id}">
          <div class="job-row-left">
            <button class="btn-delete-job" data-sjid="${j.id}" title="Delete">✕</button>
            <div class="spec-detail-info">
              <span class="spec-detail-desc">${esc(j.description)}</span>
              <span class="spec-detail-meta">${fmtDate(j.job_date)} · ${fmt(j.amount)}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="btn-edit-spec btn-ghost" data-sjid="${j.id}" title="Edit">✎</button>
            <button class="toggle-btn ${j.paid ? 'toggle-paid' : 'toggle-unpaid'}" data-sjid="${j.id}" data-paid="${j.paid}">
              ${j.paid ? 'Paid' : 'Unpaid'}
            </button>
          </div>
        </div>`
    }).join('')

    // Edit button
    detailSpecList.querySelectorAll('.btn-edit-spec').forEach(btn => {
      btn.addEventListener('click', () => {
        editingSpecialtyJobId = btn.dataset.sjid
        openDetail(customers.find(c => c.id === activeCustomer.id))
      })
    })

    // Save spec edit
    detailSpecList.querySelectorAll('.spec-edit-save').forEach(btn => {
      btn.addEventListener('click', async () => {
        const row    = btn.closest('.detail-spec-edit-row')
        const desc   = row.querySelector('.spec-edit-desc').value.trim()
        const date   = row.querySelector('.spec-edit-date').value || todayISO()
        const amount = parseFloat(row.querySelector('.spec-edit-amount').value) || 0
        if (!desc) { row.querySelector('.spec-edit-desc').focus(); return }
        btn.disabled = true
        btn.textContent = 'Saving…'
        await db.from('specialty_jobs').update({ description: desc, job_date: date, amount }).eq('id', btn.dataset.sjid)
        editingSpecialtyJobId = null
        await loadData()
        renderSummary()
        renderCustomerList()
        renderSpecialtySection()
        openDetail(customers.find(c => c.id === activeCustomer.id))
      })
    })

    // Cancel spec edit
    detailSpecList.querySelectorAll('.spec-edit-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        editingSpecialtyJobId = null
        openDetail(customers.find(c => c.id === activeCustomer.id))
      })
    })

    // Delete
    detailSpecList.querySelectorAll('.btn-delete-job').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true
        await db.from('specialty_jobs').delete().eq('id', btn.dataset.sjid)
        await loadData()
        renderSummary()
        renderCustomerList()
        renderSpecialtySection()
        openDetail(customers.find(c => c.id === activeCustomer.id))
      })
    })

    // Toggle paid
    detailSpecList.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const nowPaid = btn.dataset.paid === 'true'
        btn.disabled = true
        await db.from('specialty_jobs').update({ paid: !nowPaid }).eq('id', btn.dataset.sjid)
        await loadData()
        renderSummary()
        renderCustomerList()
        renderSpecialtySection()
        openDetail(customers.find(c => c.id === activeCustomer.id))
      })
    })
  }

  document.getElementById('detail-overlay').classList.remove('hidden')
}

function closeDetail() {
  document.getElementById('detail-overlay').classList.add('hidden')
  editingDetailCustomer = false
  editingSpecialtyJobId = null
  activeCustomer = null
}

// ── Static event bindings (run once) ─────────────────────────────────────────
function bindStaticEvents() {
  document.getElementById('btn-show-add').addEventListener('click', () => {
    document.getElementById('add-form').classList.remove('hidden')
    document.getElementById('new-name').focus()
  })
  document.getElementById('btn-cancel-add').addEventListener('click', () => {
    document.getElementById('add-form').classList.add('hidden')
    clearAddForm()
  })

  document.getElementById('btn-save-customer').addEventListener('click', async () => {
    const name  = document.getElementById('new-name').value.trim()
    const addr  = document.getElementById('new-address').value.trim()
    const price = parseFloat(document.getElementById('new-price').value) || 0
    const phone = document.getElementById('new-phone').value.trim()
    const email = document.getElementById('new-email').value.trim()
    if (!name) { document.getElementById('new-name').focus(); return }

    const btn = document.getElementById('btn-save-customer')
    btn.disabled = true
    btn.textContent = 'Saving…'
    await db.from('customers').insert({ name, address: addr, price_per_cut: price, phone, email })
    await loadData()
    renderSummary()
    renderCustomerList()
    renderSpecialtySection()
    document.getElementById('add-form').classList.add('hidden')
    clearAddForm()
    btn.disabled = false
    btn.textContent = 'Save'
  })

  document.getElementById('btn-back').addEventListener('click', closeDetail)
  document.getElementById('detail-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('detail-overlay')) closeDetail()
  })

  document.getElementById('btn-delete-customer').addEventListener('click', async () => {
    if (!activeCustomer) return
    if (!confirm(`Delete ${activeCustomer.name}? All jobs will be removed too.`)) return
    await db.from('customers').delete().eq('id', activeCustomer.id)
    await loadData()
    renderSummary()
    renderCustomerList()
    renderSpecialtySection()
    closeDetail()
  })

  document.getElementById('btn-show-specialty-form').addEventListener('click', () => {
    document.getElementById('specialty-form').classList.remove('hidden')
    document.getElementById('specialty-desc').focus()
  })
  document.getElementById('btn-cancel-specialty').addEventListener('click', () => {
    document.getElementById('specialty-form').classList.add('hidden')
    clearSpecialtyForm()
  })

  document.getElementById('btn-save-specialty').addEventListener('click', async () => {
    const customerId = document.getElementById('specialty-customer-select').value
    const desc   = document.getElementById('specialty-desc').value.trim()
    const amount = parseFloat(document.getElementById('specialty-amount').value) || 0
    const date   = document.getElementById('specialty-date').value || todayISO()
    if (!customerId || !desc) { if (!desc) document.getElementById('specialty-desc').focus(); return }

    const btn = document.getElementById('btn-save-specialty')
    btn.disabled = true
    btn.textContent = 'Saving…'
    await db.from('specialty_jobs').insert({ customer_id: customerId, description: desc, amount, job_date: date, paid: false })
    await loadData()
    renderSpecialtySection()
    renderSummary()
    renderCustomerList()
    document.getElementById('specialty-form').classList.add('hidden')
    clearSpecialtyForm()
    btn.disabled = false
    btn.textContent = 'Save'
  })

  document.getElementById('specialty-date').value = todayISO()
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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

function clearAddForm() {
  document.getElementById('new-name').value    = ''
  document.getElementById('new-address').value = ''
  document.getElementById('new-price').value   = ''
  document.getElementById('new-phone').value   = ''
  document.getElementById('new-email').value   = ''
}

function clearSpecialtyForm() {
  document.getElementById('specialty-desc').value   = ''
  document.getElementById('specialty-amount').value = ''
  document.getElementById('specialty-date').value   = todayISO()
  document.getElementById('specialty-paid').checked = false
}

// ── Go ────────────────────────────────────────────────────────────────────────
init()
