/* ═══════════════════════════════════════════
   VENSHA SKIN — Admin Panel SPA Engine
   Reusable CRUD components + 15 section views
   ═══════════════════════════════════════════ */

/* ─── State ─── */
const state = {
  currentTab: 'dashboard',
  user: null,
  sidebarOpen: false,
};

/* ─── Toast System ─── */
function showToast(msg, type = '') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

/* ─── Modal System ─── */
function openModal({ title, body, wide, full, onClose }) {
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''} ${full ? 'full' : ''}">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" data-close>&times;</button>
      </div>
      <div class="modal-body">${body}</div>
    </div>`;

  overlay.querySelector('[data-close]').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  if (onClose) {
    const observer = new MutationObserver(() => {
      if (!document.body.contains(overlay)) { onClose(); observer.disconnect(); }
    });
    observer.observe(document.body, { childList: true });
  }
  return overlay;
}

function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
}

/* ─── Confirm Dialog ─── */
function confirmDialog(msg) {
  return new Promise((resolve) => {
    const overlay = openModal({
      title: 'Confirm',
      body: `
        <div class="confirm-dialog">
          <div class="confirm-icon">&#9888;</div>
          <p>${msg}</p>
          <div class="form-actions" style="justify-content:center;">
            <button class="btn" data-cancel>Cancel</button>
            <button class="btn btn-primary" data-confirm>Confirm</button>
          </div>
        </div>`,
    });
    overlay.querySelector('[data-confirm]').addEventListener('click', () => { closeModal(); resolve(true); });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => { closeModal(); resolve(false); });
  });
}

/* ─── API Helper ─── */
async function api(path, options = {}) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  const token = localStorage.getItem('vensha_token');
  if (token) headers.Authorization = `Bearer ${token}`;

  const fetchOptions = { ...options, headers };
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    fetchOptions.body = JSON.stringify(options.body);
  }
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
    fetchOptions.body = options.body;
  }

  const res = await fetch(`${window.VENSHA_API || window.location.origin}${path}`, fetchOptions);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ─── Date Formatting ─── */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
function fmtDateShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/* ─── Status Badge ─── */
function statusBadge(status) {
  const cls = String(status).toLowerCase().replace(/\s+/g, '-');
  return `<span class="status-pill ${cls}">${status}</span>`;
}

/* ═══════════════════════════════════════════
   REUSABLE CRUD BUILDER
   ═══════════════════════════════════════════ */

function createCrudManager(config) {
  const {
    container,      // DOM element to render into
    title,          // Section title
    description,    // Optional description
    apiBase,        // API base path (e.g. '/api/admin/faqs')
    columns,        // Array of column defs: { key, label, render?, sortable? }
    formFields,     // Array of form field defs: { key, label, type, required?, options?, placeholder? }
    searchable,     // Enable search
    pageSize = 20,  // Items per page
    rowActions,     // Array: 'edit', 'delete', or custom { label, action, class? }
    onTransform,    // Transform API response to array: (data) => items[]
    onCreated,      // Callback after create
    onUpdated,      // Callback after update
    onDeleted,      // Callback after delete
    idKey = 'id',   // ID field name
    filterBar,      // Optional filter config: { options: [{label, value, filter: fn}], default: value }
    emptyMessage = 'No items found.',
    noSearchResults = 'No results match your search.',
    formLayout = 'grid', // 'grid' or 'single'
  } = config;

  let items = [];
  let filteredItems = [];
  let currentPage = 1;
  let sortKey = null;
  let sortDir = 'asc';
  let searchQuery = '';
  let currentFilter = null;

  /* ─── Fetch ─── */
  async function load() {
    try {
      container.innerHTML = '<div class="loading">Loading</div>';
      const data = await api(apiBase);
      items = onTransform ? onTransform(data) : data.items || data[Object.keys(data).find(k => Array.isArray(data[k]))] || [];
      applyFilters();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  }

  /* ─── Filtering & Sorting ─── */
  function applyFilters() {
    let result = [...items];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        columns.some(col => {
          const val = item[col.key];
          return val != null && String(val).toLowerCase().includes(q);
        })
      );
    }

    if (currentFilter) {
      result = result.filter(currentFilter);
    }

    if (sortKey) {
      result.sort((a, b) => {
        const va = a[sortKey] ?? '';
        const vb = b[sortKey] ?? '';
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    filteredItems = result;
    currentPage = 1;
    render();
  }

  function handleSearch(val) {
    searchQuery = val;
    applyFilters();
  }

  function handleSort(key) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = 'asc';
    }
    applyFilters();
  }

  /* ─── Render ─── */
  function render() {
    const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
    const start = (currentPage - 1) * pageSize;
    const pageItems = filteredItems.slice(start, start + pageSize);

    const searchHtml = searchable
      ? `<input class="search-input" type="text" placeholder="Search ${title.toLowerCase()}..." value="${searchQuery}" data-search />`
      : '';

    const filterHtml = filterBar
      ? `<div class="filter-bar">${filterBar.options.map(opt => `
        <button class="filter-btn ${currentFilter === opt.filter ? 'active' : ''}" data-filter="${opt.value}">${opt.label}</button>
      `).join('')}</div>`
      : '';

    let tableHtml = '';
    if (pageItems.length === 0) {
      tableHtml = `<div class="empty-state">
        <div class="empty-icon">&#128196;</div>
        <h3>${searchQuery ? noSearchResults : emptyMessage}</h3>
        <p>${searchQuery ? 'Try a different search term.' : `Get started by adding your first item.`}</p>
      </div>`;
    } else {
      tableHtml = `<div class="data-table-wrap">
        <div class="table-toolbar">
          ${searchHtml}
          <div class="toolbar-actions">
            ${filterHtml}
            <button class="btn btn-primary btn-sm" data-add>&plus; Add</button>
          </div>
        </div>
        <table class="data-table">
          <thead><tr>
            ${columns.map(col => `
              <th class="${sortKey === col.key ? (sortDir === 'asc' ? 'sort-asc' : 'sort-desc') : ''}"
                  ${col.sortable !== false ? `data-sort="${col.key}"` : ''}>
                ${col.label}
                ${col.sortable !== false ? `<span class="sort-icon">${sortKey === col.key ? (sortDir === 'asc' ? '&#9650;' : '&#9660;') : '&#9650;&#9660;'}</span>` : ''}
              </th>
            `).join('')}
            ${rowActions ? '<th style="width:120px">Actions</th>' : ''}
          </tr></thead>
          <tbody>
            ${pageItems.map(item => `<tr>
              ${columns.map(col => `<td>${col.render ? col.render(item) : (item[col.key] ?? '—')}</td>`).join('')}
              ${rowActions ? `<td>
                ${rowActions.map(action => {
                  if (action === 'edit') return `<button class="btn btn-sm btn-ghost" data-edit="${item[idKey]}">&#9998; Edit</button>`;
                  if (action === 'delete') return `<button class="btn btn-sm btn-danger" data-delete="${item[idKey]}">&#128465; Delete</button>`;
                  if (typeof action === 'object') return `<button class="btn btn-sm ${action.class || 'btn-ghost'}" data-custom="${item[idKey]}" data-action="${action.label}">${action.label}</button>`;
                  return '';
                }).join('')}
              </td>` : ''}
            </tr>`).join('')}
          </tbody>
        </table>
        ${totalPages > 1 ? `<div class="pagination">
          <button class="page-btn" data-page="1" ${currentPage <= 1 ? 'disabled' : ''}>&laquo;</button>
          <button class="page-btn" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>&lsaquo;</button>
          <span class="page-info">Page ${currentPage} of ${totalPages}</span>
          <button class="page-btn" data-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>&rsaquo;</button>
          <button class="page-btn" data-page="${totalPages}" ${currentPage >= totalPages ? 'disabled' : ''}>&raquo;</button>
        </div>` : ''}
      </div>`;
    }

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h2>${title}</h2>
          ${description ? `<p>${description}</p>` : ''}
        </div>
      </div>
      ${tableHtml}`;

    /* ─── Event Binding ─── */
    container.querySelector('[data-search]')?.addEventListener('input', (e) => handleSearch(e.target.value));

    container.querySelectorAll('[data-sort]').forEach(el => {
      el.addEventListener('click', () => handleSort(el.dataset.sort));
    });

    container.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', () => { currentPage = Math.max(1, Math.min(totalPages, Number(el.dataset.page))); render(); });
    });

    container.querySelector('[data-add]')?.addEventListener('click', () => openFormModal());

    container.querySelectorAll('[data-edit]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.edit;
        const item = items.find(i => i[idKey] === id);
        if (item) openFormModal(item);
      });
    });

    container.querySelectorAll('[data-delete]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.delete;
        const confirmed = await confirmDialog('Are you sure you want to delete this item? This action cannot be undone.');
        if (confirmed) {
          try {
            await api(`${apiBase}/${id}`, { method: 'DELETE' });
            showToast('Deleted successfully.', 'success');
            if (onDeleted) onDeleted(id);
            load();
          } catch (err) { showToast(err.message, 'error'); }
        }
      });
    });

    container.querySelectorAll('[data-custom]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.custom;
        const item = items.find(i => i[idKey] === id);
        if (item) {
          const action = rowActions.find(a => typeof a === 'object' && a.label === el.dataset.action);
          if (action?.action) action.action(item, load);
        }
      });
    });

    container.querySelectorAll('[data-filter]').forEach(el => {
      el.addEventListener('click', () => {
        const opt = filterBar.options.find(o => o.value === el.dataset.filter);
        currentFilter = currentFilter === opt.filter ? null : opt.filter;
        applyFilters();
      });
    });
  }

  /* ─── Form Modal ─── */
  function openFormModal(editItem = null) {
    const isEdit = !!editItem;
    const fieldsHtml = formFields.map(f => {
      const val = isEdit ? (editItem[f.key] ?? '') : (f.default ?? '');
      const required = f.required ? 'required' : '';
      const rowClass = f.fullWidth ? 'full' : '';

      if (f.type === 'textarea') {
        return `<div class="form-group ${rowClass}">
          <label for="field-${f.key}">${f.label}${f.required ? ' *' : ''}</label>
          <textarea id="field-${f.key}" ${required} placeholder="${f.placeholder || ''}">${val}</textarea>
          ${f.help ? `<span class="form-help">${f.help}</span>` : ''}
        </div>`;
      }
      if (f.type === 'select') {
        return `<div class="form-group ${rowClass}">
          <label for="field-${f.key}">${f.label}${f.required ? ' *' : ''}</label>
          <select id="field-${f.key}" ${required}>
            ${!f.required ? '<option value="">— Select —</option>' : ''}
            ${(f.options || []).map(o => {
              const optVal = typeof o === 'object' ? o.value : o;
              const optLbl = typeof o === 'object' ? o.label : o;
              return `<option value="${optVal}" ${String(val) === String(optVal) ? 'selected' : ''}>${optLbl}</option>`;
            }).join('')}
          </select>
        </div>`;
      }
      if (f.type === 'checkbox') {
        return `<div class="form-group checkbox ${rowClass}">
          <input type="checkbox" id="field-${f.key}" ${val ? 'checked' : ''} />
          <label for="field-${f.key}">${f.label}</label>
        </div>`;
      }
      if (f.type === 'datetime-local') {
        const dtVal = val ? new Date(val).toISOString().slice(0, 16) : '';
        return `<div class="form-group ${rowClass}">
          <label for="field-${f.key}">${f.label}${f.required ? ' *' : ''}</label>
          <input type="datetime-local" id="field-${f.key}" value="${dtVal}" ${required} />
        </div>`;
      }
      if (f.type === 'date') {
        const dtVal = val ? new Date(val).toISOString().slice(0, 10) : '';
        return `<div class="form-group ${rowClass}">
          <label for="field-${f.key}">${f.label}${f.required ? ' *' : ''}</label>
          <input type="date" id="field-${f.key}" value="${dtVal}" ${required} />
        </div>`;
      }
      // Default: text, email, tel, number, url, password, color
      return `<div class="form-group ${rowClass}">
        <label for="field-${f.key}">${f.label}${f.required ? ' *' : ''}</label>
        <input type="${f.type || 'text'}" id="field-${f.key}" value="${val}" ${required} placeholder="${f.placeholder || ''}" />
        ${f.help ? `<span class="form-help">${f.help}</span>` : ''}
      </div>`;
    }).join('');

    openModal({
      title: isEdit ? `Edit ${title.slice(0, -1)}` : `Add ${title.slice(0, -1)}`,
      body: `
        <form class="form-grid" data-form>
          ${fieldsHtml}
          <div class="form-actions full">
            <button type="button" class="btn" data-cancel>Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create'}</button>
          </div>
        </form>`,
      wide: formFields.some(f => f.type === 'textarea'),
      onClose: () => {},
    });

    const overlay = document.querySelector('.modal-overlay');
    const form = overlay.querySelector('[data-form]');
    overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {};
      for (const f of formFields) {
        const el = form.querySelector(`#field-${f.key}`);
        if (!el) continue;
        if (f.type === 'checkbox') data[f.key] = el.checked;
        else if (f.type === 'number' || f.type === 'float') {
          data[f.key] = el.value ? (f.type === 'float' ? parseFloat(el.value) : Number(el.value)) : null;
        } else data[f.key] = el.value;
      }

      try {
        if (isEdit) {
          await api(`${apiBase}/${editItem[idKey]}`, { method: 'PUT', body: data });
          showToast('Updated successfully.', 'success');
          if (onUpdated) onUpdated(data);
        } else {
          await api(apiBase, { method: 'POST', body: data });
          showToast('Created successfully.', 'success');
          if (onCreated) onCreated(data);
        }
        closeModal();
        load();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  /* ─── Init ─── */
  load();
  return { load, reload: load };
}

/* ═══════════════════════════════════════════
   SECTION RENDERERS
   ═══════════════════════════════════════════ */

/* ─── 1. Dashboard ─── */
async function renderDashboard() {
  const container = document.getElementById('tab-dashboard');
  try {
    const data = await api('/api/admin/dashboard/enhanced');
    const { stats, recentActivity } = data;

    // Combine consultations + machine inquiries into a unified list
    const allInquiries = [];
    if (recentActivity.consultations) {
      recentActivity.consultations.forEach(c => {
        allInquiries.push({ type: 'Consultation', name: c.name, status: c.status, date: c.createdAt, treatment: c.treatment });
      });
    }
    if (recentActivity.machineInquiries) {
      recentActivity.machineInquiries.forEach(m => {
        allInquiries.push({ type: 'Purchase', name: m.name || m.businessName || '—', status: m.status, date: m.createdAt });
      });
    }
    // Sort by date descending
    allInquiries.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = `
      <div class="toggle-row">
        <div>
          <strong>Coming Soon Mode</strong>
          <p>When enabled, the public landing page shows only a &ldquo;Coming Soon&rdquo; screen.</p>
        </div>
        <button type="button" class="toggle-btn ${data.comingSoon ? 'active' : ''}" id="comingSoonToggle">${data.comingSoon ? 'Coming Soon: ON' : 'Coming Soon: OFF'}</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card gold"><div class="num">${stats.consultations}</div><div class="lbl">Consultations</div></div>
        <div class="stat-card gold"><div class="num">${stats.machineInquiries}</div><div class="lbl">Machine Inquiries</div></div>
        <div class="stat-card gold"><div class="num">${stats.users}</div><div class="lbl">Clients</div></div>
        <div class="stat-card gold"><div class="num">${stats.messages}</div><div class="lbl">Unread Messages</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr;gap:16px;">
        <div class="data-table-wrap">
          <div class="table-toolbar"><strong>All Inquiries</strong></div>
          ${allInquiries.length ? `<table class="data-table">
            <thead><tr>
              <th>Type</th>
              <th>Name</th>
              <th>Status</th>
              <th>Date</th>
            </tr></thead>
            <tbody>
            ${allInquiries.slice(0, 10).map(i => `<tr>
              <td><span class="type-badge type-${i.type.toLowerCase()}">${i.type}</span></td>
              <td><strong>${i.name}</strong></td>
              <td>${statusBadge(i.status)}</td>
              <td>${fmtDateShort(i.date)}</td>
            </tr>`).join('')}
          </tbody></table>` : '<div class="empty-state"><p>No inquiries yet.</p></div>'}
        </div>
      </div>`;

    const toggle = container.querySelector('#comingSoonToggle');
    let comingSoon = data.comingSoon;
    toggle.addEventListener('click', async () => {
      try {
        const result = await api('/api/admin/settings/coming-soon', { method: 'PUT', body: { enabled: !comingSoon } });
        comingSoon = result.enabled;
        toggle.textContent = comingSoon ? 'Coming Soon: ON' : 'Coming Soon: OFF';
        toggle.classList.toggle('active', comingSoon);
        showToast(`Coming soon mode ${comingSoon ? 'enabled' : 'disabled'}.`, 'success');
      } catch (err) { showToast(err.message, 'error'); }
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
  }
}

/* ═══ Machine Inquiries ═══ */
let miStatusFilter = 'all';
let miSearchQuery = '';

function renderMachineInquiries() {
  const tab = document.getElementById('tab-machine-inquiries');
  if (!tab) return;
  
  const filters = tab.querySelectorAll('.filter-tab');
  filters.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filters.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      miStatusFilter = e.target.dataset.miStatus;
      loadMachineInquiries();
    });
  });

  const searchInput = tab.querySelector('#miSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      miSearchQuery = e.target.value.toLowerCase();
      loadMachineInquiries();
    });
  }

  loadMachineInquiries();
}

async function loadMachineInquiries() {
  const container = document.getElementById('machineInquiriesList');
  const detail = document.getElementById('machineInquiryDetail');
  if (!container) return;
  detail.style.display = 'none';
  container.style.display = 'block';

  try {
    let url = '/api/admin/machine-inquiries';
    if (miStatusFilter !== 'all') url += `?status=${miStatusFilter}`;
    const data = await api(url);
    const inquiries = data.inquiries || data;
    
    const filtered = miSearchQuery
      ? inquiries.filter(i => 
          (i.name || '').toLowerCase().includes(miSearchQuery) ||
          (i.businessName || '').toLowerCase().includes(miSearchQuery) ||
          (i.email || '').toLowerCase().includes(miSearchQuery)
        )
      : inquiries;

    if (!filtered.length) {
      container.innerHTML = '<div class="empty-state"><p>No machine inquiries found.</p></div>';
      return;
    }

    container.innerHTML = `<table class="data-table">
      <thead><tr>
        <th>Status</th>
        <th>Contact</th>
        <th>Business</th>
        <th>Timeline</th>
        <th>Submitted</th>
        <th>Actions</th>
      </tr></thead>
      <tbody>${filtered.map(i => `<tr class="${i.status === 'new' ? 'row-unread' : ''}">
        <td>${statusBadge(i.status)}</td>
        <td><strong>${i.name || '—'}</strong><br><small class="text-muted">${i.email}</small></td>
        <td>${i.businessName || i.companyName || '—'}</td>
        <td>${i.purchaseTimeline || '—'}</td>
        <td>${timeAgo(i.createdAt)}</td>
        <td><button class="btn-sm" data-view-mi="${i.id}">View</button></td>
      </tr>`).join('')}</tbody>
    </table>`;

    container.querySelectorAll('[data-view-mi]').forEach(btn => {
      btn.addEventListener('click', () => loadMachineInquiryDetail(btn.dataset.viewMi));
    });
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Failed to load inquiries.</p></div>';
  }
}

async function loadMachineInquiryDetail(id) {
  const container = document.getElementById('machineInquiriesList');
  const detail = document.getElementById('machineInquiryDetail');
  
  try {
    const data = await api(`/api/admin/machine-inquiries/${id}`);
    const inquiry = data.inquiry || data;
    const emailHistory = data.emailHistory || [];
    container.style.display = 'none';
    detail.style.display = 'block';
    
    detail.innerHTML = `
      <div class="detail-header">
        <button class="btn-back" onclick="loadMachineInquiries()">← Back to Inquiries</button>
        <div class="detail-actions">
          <select class="status-select" data-mi-id="${inquiry.id}">
            <option value="new" ${inquiry.status === 'new' ? 'selected' : ''}>New</option>
            <option value="pending" ${inquiry.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="replied" ${inquiry.status === 'replied' ? 'selected' : ''}>Replied</option>
            <option value="completed" ${inquiry.status === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="archived" ${inquiry.status === 'archived' ? 'selected' : ''}>Archived</option>
          </select>
          <button class="btn btn-primary" data-action="reply-mi">✉ Reply to Client</button>
        </div>
      </div>
      
      <div class="detail-body">
        <div class="detail-card">
          <div class="detail-card-header">
            <h3>Contact Information</h3>
            ${statusBadge(inquiry.status)}
          </div>
          <div class="detail-grid">
            <div class="detail-item"><label>Name</label><p>${inquiry.name || '—'}</p></div>
            <div class="detail-item"><label>Email</label><p><a href="mailto:${inquiry.email}">${inquiry.email}</a></p></div>
            <div class="detail-item"><label>Phone</label><p><a href="tel:${inquiry.phone}">${inquiry.phone || '—'}</a></p></div>
            <div class="detail-item"><label>Company</label><p>${inquiry.companyName || '—'}</p></div>
          </div>
        </div>

        <div class="detail-card">
          <h3>Business Details</h3>
          <div class="detail-grid">
            <div class="detail-item"><label>Business Name</label><p>${inquiry.businessName || '—'}</p></div>
            <div class="detail-item"><label>Business Type</label><p>${inquiry.businessType || '—'}</p></div>
            <div class="detail-item"><label>Machine Model</label><p>${inquiry.machineModel || 'Contour Pro Max'}</p></div>
            <div class="detail-item"><label>Purchase Timeline</label><p>${inquiry.purchaseTimeline || '—'}</p></div>
          </div>
        </div>

        ${inquiry.message ? `<div class="detail-card">
          <h3>Client Message</h3>
          <div class="detail-message-box">${inquiry.message}</div>
        </div>` : ''}

        ${emailHistory.length ? `<div class="detail-card">
          <h3>Email History</h3>
          <div class="email-thread">${emailHistory.map(e => `
            <div class="email-item ${e.fromEmail === inquiry.email ? 'incoming' : 'outgoing'}">
              <div class="email-meta">
                <strong>${e.fromEmail === inquiry.email ? inquiry.name || 'Client' : 'VENSHA SKIN'}</strong>
                <span>${fmtDateShort(e.createdAt)}</span>
              </div>
              <div class="email-subject">${e.subject}</div>
              <div class="email-body">${e.body}</div>
            </div>
          `).join('')}</div>
        </div>` : ''}

        <div class="detail-meta">
          Submitted ${fmtDateShort(inquiry.createdAt)} · Last updated ${fmtDateShort(inquiry.updatedAt)}
        </div>
      </div>
    `;

    // Status change handler
    detail.querySelector('.status-select').addEventListener('change', async (e) => {
      try {
        await api(`/api/admin/machine-inquiries/${inquiry.id}`, {
          method: 'PUT',
          body: { status: e.target.value },
        });
        showToast('Status updated', 'success');
      } catch (err) {
        showToast('Failed to update status', 'error');
      }
    });

    // Reply button
    detail.querySelector('[data-action="reply-mi"]').addEventListener('click', () => {
      openMachineReplyModal(inquiry);
    });
  } catch (err) {
    detail.innerHTML = '<div class="empty-state"><p>Failed to load inquiry details.</p></div>';
  }
}

function openMachineReplyModal(inquiry) {
  const name = inquiry.name || 'Valued Client';
  const defaultSubject = 'Thank You for Your Interest in Contour Pro Max';
  const defaultMessage = `Hello ${name},\n\nThank you for your interest in the Contour Pro Max.\n\nOne of our specialists will contact you shortly regarding pricing, demonstrations, financing options, and availability.\n\nThank you,\nVENSHA SKIN`;
  
  openReplyModalGeneric({
    id: inquiry.id,
    name: name,
    email: inquiry.email,
    subject: defaultSubject,
    message: defaultMessage,
    endpoint: `/api/admin/machine-inquiries/${inquiry.id}/reply`,
    onSuccess: () => loadMachineInquiryDetail(inquiry.id),
  });
}

/* ─── 3. Users ─── */
/* ─── 3. Inbox ─── */
function renderInbox() {
  const container = document.getElementById('tab-inbox');

  async function load() {
    try {
      const data = await api('/api/admin/messages');
      const messages = data.messages || [];

      container.innerHTML = `
        <div class="section-header">
          <div>
            <h2>Inbox</h2>
            <p>${messages.filter(m => !m.isRead).length} unread messages</p>
          </div>
          <input class="search-input" type="text" placeholder="Search messages..." id="inboxSearch" style="width:200px;" />
        </div>
        <div class="data-table-wrap">
          ${messages.length ? `<ul class="inbox-list">
            ${messages.map(m => `
              <li class="inbox-item ${!m.isRead ? 'unread' : ''} ${m.isArchived ? 'archived' : ''}" data-id="${m.id}">
                <span class="inbox-from">${m.fromEmail}</span>
                <span class="inbox-subject">${m.subject || '(no subject)'}</span>
                <span class="inbox-date">${fmtDate(m.createdAt)}</span>
                <span style="display:flex;gap:4px;flex-shrink:0;">
                  <button class="btn btn-sm btn-ghost" data-star="${m.id}" title="${m.isStarred ? 'Unstar' : 'Star'}">${m.isStarred ? '&#9733;' : '&#9734;'}</button>
                  <button class="btn btn-sm btn-ghost" data-archive="${m.id}" title="${m.isArchived ? 'Unarchive' : 'Archive'}">${m.isArchived ? '&#128194;' : '&#128193;'}</button>
                  <button class="btn btn-sm btn-danger" data-delete="${m.id}">&#128465;</button>
                </span>
              </li>
            `).join('')}
          </ul>` : `<div class="empty-state"><h3>No messages</h3><p>Your inbox is empty.</p></div>`}
        </div>`;

      container.querySelector('#inboxSearch').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        container.querySelectorAll('.inbox-item').forEach(el => {
          el.style.display = el.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
        });
      });

      container.querySelectorAll('.inbox-item').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          const id = el.dataset.id;
          const msg = messages.find(m => m.id === id);
          if (msg) viewMessage(msg, load);
        });
      });

      container.querySelectorAll('[data-star]').forEach(el => {
        el.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await api(`/api/admin/messages/${el.dataset.star}/star`, { method: 'PATCH' });
            showToast('Updated.', 'success');
            load();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });

      container.querySelectorAll('[data-archive]').forEach(el => {
        el.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await api(`/api/admin/messages/${el.dataset.archive}/archive`, { method: 'PATCH' });
            showToast('Updated.', 'success');
            load();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });

      container.querySelectorAll('[data-delete]').forEach(el => {
        el.addEventListener('click', async (e) => {
          e.stopPropagation();
          const ok = await confirmDialog('Delete this message?');
          if (!ok) return;
          try {
            await api(`/api/admin/messages/${el.dataset.delete}`, { method: 'DELETE' });
            showToast('Deleted.', 'success');
            load();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  }

  function viewMessage(msg, reload) {
    openModal({
      title: msg.subject || '(no subject)',
      wide: true,
      body: `
        <div class="detail-view">
          <div class="detail-row"><span class="detail-label">From</span><span class="detail-value">${msg.fromEmail}</span></div>
          <div class="detail-row"><span class="detail-label">To</span><span class="detail-value">${msg.toEmail}</span></div>
          <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${fmtDate(msg.createdAt)}</span></div>
          <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">${msg.isRead ? 'Read' : 'Unread'}</span></div>
          ${msg.user ? `<div class="detail-row"><span class="detail-label">User</span><span class="detail-value">${msg.user.firstName} ${msg.user.lastName} (${msg.user.email})</span></div>` : ''}
        </div>
        <div style="padding:16px;background:var(--body-bg);border-radius:6px;margin-top:8px;white-space:pre-wrap;font-size:0.85rem;line-height:1.6;">${msg.body}</div>
        <div class="form-actions" style="margin-top:16px;">
          <button class="btn btn-primary" data-reply>Reply via Email</button>
        </div>`,
    });

    const overlay = document.querySelector('.modal-overlay');
    overlay.querySelector('[data-reply]')?.addEventListener('click', () => {
      closeModal();
      switchTab('settings');
      // Pre-populate email form
      setTimeout(() => {
        const toField = document.getElementById('settings-email-to');
        const subjectField = document.getElementById('settings-email-subject');
        if (toField) {
          toField.value = msg.fromEmail;
          toField.closest('.form-group')?.scrollIntoView();
        }
        if (subjectField) subjectField.value = `Re: ${msg.subject || ''}`;
      }, 300);
    });
  }

  load();
}

/* ─── 5. Gallery ─── */
function renderGallery() {
  createCrudManager({
    container: document.getElementById('tab-gallery'),
    title: 'Gallery',
    description: 'Manage clinic and treatment photos.',
    apiBase: '/api/admin/gallery',
    searchable: true,
    columns: [
      { key: 'preview', label: 'Image', render: (g) => g.imageUrl ? `<img src="${g.imageUrl}" style="width:60px;height:40px;object-fit:cover;border-radius:4px;" />` : '—' },
      { key: 'title', label: 'Title', render: (g) => g.title || '—' },
      { key: 'caption', label: 'Caption', render: (g) => g.caption || '—' },
      { key: 'category', label: 'Category', render: (g) => g.category || '—' },
      { key: 'displayOrder', label: 'Order' },
      { key: 'isActive', label: 'Active', render: (g) => g.isActive ? '&#10003;' : '&#10007;' },
    ],
    onTransform: (data) => data.items || [],
    rowActions: ['edit', 'delete'],
    formFields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'imageUrl', label: 'Image URL', type: 'text', required: true, placeholder: '/uploads/filename.jpg' },
      { key: 'caption', label: 'Caption', type: 'text' },
      { key: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Clinic, Equipment, Results' },
      { key: 'displayOrder', label: 'Display Order', type: 'number', default: 0 },
      { key: 'isActive', label: 'Active', type: 'checkbox', default: true },
    ],
  });
}

/* ─── 8. Testimonials ─── */
function renderTestimonials() {
  createCrudManager({
    container: document.getElementById('tab-testimonials'),
    title: 'Testimonials',
    description: 'Client testimonials displayed on the website.',
    apiBase: '/api/admin/testimonials',
    searchable: true,
    columns: [
      { key: 'author', label: 'Author' },
      { key: 'quote', label: 'Quote', render: (t) => `&ldquo;${(t.quote || '').slice(0, 80)}${t.quote?.length > 80 ? '&hellip;' : ''}&rdquo;` },
      { key: 'featured', label: 'Featured', render: (t) => t.featured ? '&#9733;' : '—' },
      { key: 'displayOrder', label: 'Order' },
      { key: 'isActive', label: 'Active', render: (t) => t.isActive ? '&#10003;' : '&#10007;' },
    ],
    onTransform: (data) => data.testimonials || [],
    rowActions: ['edit', 'delete'],
    formFields: [
      { key: 'author', label: 'Author Name', type: 'text', required: true },
      { key: 'quote', label: 'Quote', type: 'textarea', required: true },
      { key: 'imageUrl', label: 'Image URL', type: 'text', placeholder: '/uploads/photo.jpg' },
      { key: 'featured', label: 'Featured', type: 'checkbox' },
      { key: 'displayOrder', label: 'Display Order', type: 'number', default: 0 },
      { key: 'isActive', label: 'Active', type: 'checkbox', default: true },
    ],
  });
}

/* ─── 9. Research ─── */
function renderResearch() {
  createCrudManager({
    container: document.getElementById('tab-research'),
    title: 'Research',
    description: 'Clinical studies, educational content, and safety information.',
    apiBase: '/api/admin/research',
    searchable: true,
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'category', label: 'Category', render: (r) => r.category ? statusBadge(r.category) : '—' },
      { key: 'author', label: 'Author', render: (r) => r.author || '—' },
      { key: 'isActive', label: 'Active', render: (r) => r.isActive ? '&#10003;' : '&#10007;' },
      { key: 'createdAt', label: 'Added', render: (r) => fmtDateShort(r.createdAt) },
    ],
    onTransform: (data) => data.items || [],
    rowActions: ['edit', 'delete'],
    formFields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'summary', label: 'Summary', type: 'textarea' },
      { key: 'content', label: 'Content', type: 'textarea', required: true, fullWidth: true },
      { key: 'imageUrl', label: 'Image URL', type: 'text' },
      { key: 'category', label: 'Category', type: 'select', options: ['Clinical Study', 'Educational', 'Safety', 'Wellness', 'Other'] },
      { key: 'author', label: 'Author', type: 'text' },
      { key: 'source', label: 'Source', type: 'text', placeholder: 'e.g. Journal of Aesthetic Dermatology' },
      { key: 'displayOrder', label: 'Display Order', type: 'number', default: 0 },
      { key: 'isActive', label: 'Active', type: 'checkbox', default: true },
    ],
  });
}

/* ─── 10. FAQs ─── */
function renderFaqs() {
  createCrudManager({
    container: document.getElementById('tab-faqs'),
    title: 'FAQs',
    description: 'Frequently asked questions displayed on the website.',
    apiBase: '/api/admin/faqs',
    searchable: true,
    columns: [
      { key: 'question', label: 'Question' },
      { key: 'answer', label: 'Answer', render: (f) => `${(f.answer || '').slice(0, 80)}${f.answer?.length > 80 ? '&hellip;' : ''}` },
      { key: 'displayOrder', label: 'Order' },
      { key: 'isActive', label: 'Active', render: (f) => f.isActive ? '&#10003;' : '&#10007;' },
    ],
    onTransform: (data) => data.faqs || [],
    rowActions: ['edit', 'delete'],
    formFields: [
      { key: 'question', label: 'Question', type: 'text', required: true },
      { key: 'answer', label: 'Answer', type: 'textarea', required: true, fullWidth: true },
      { key: 'displayOrder', label: 'Display Order', type: 'number', default: 0 },
      { key: 'isActive', label: 'Active', type: 'checkbox', default: true },
    ],
  });
}

/* ─── 11. Promotions ─── */
function renderPromotions() {
  createCrudManager({
    container: document.getElementById('tab-promotions'),
    title: 'Promotions',
    description: 'Manage promotions, offers, and discounts.',
    apiBase: '/api/admin/promotions',
    searchable: true,
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'discountPercent', label: 'Discount', render: (p) => p.discountPercent ? `${p.discountPercent}%` : '—' },
      { key: 'status', label: 'Status', render: (p) => statusBadge(p.status) },
      { key: 'startDate', label: 'Start', render: (p) => fmtDateShort(p.startDate) },
      { key: 'endDate', label: 'End', render: (p) => fmtDateShort(p.endDate) },
    ],
    onTransform: (data) => data.promotions || [],
    rowActions: ['edit', 'delete'],
    formFields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea', fullWidth: true },
      { key: 'bannerImageUrl', label: 'Banner Image URL', type: 'text' },
      { key: 'discountPercent', label: 'Discount %', type: 'number' },
      { key: 'startDate', label: 'Start Date', type: 'date', required: true },
      { key: 'endDate', label: 'End Date', type: 'date', required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['DRAFT', 'ACTIVE', 'EXPIRED'] },
      { key: 'displayLocation', label: 'Display Location', type: 'text', placeholder: 'e.g. homepage, sidebar' },
    ],
  });
}

/* ─── 12. Notifications ─── */
function renderNotifications() {
  const container = document.getElementById('tab-notifications');

  async function load() {
    try {
      const data = await api('/api/admin/notifications');
      const notifications = data.notifications || [];

      container.innerHTML = `
        <div class="section-header">
          <div>
            <h2>Notifications</h2>
            <p>Send and manage notifications</p>
          </div>
          <button class="btn btn-primary" data-send>&#9993; Send Notification</button>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>User</th><th>Title</th><th>Channel</th><th>Read</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              ${notifications.length ? notifications.map(n => `
                <tr>
                  <td>${n.user ? `${n.user.firstName} ${n.user.lastName}` : 'All Users'}</td>
                  <td>${n.title}</td>
                  <td>${statusBadge(n.channel)}</td>
                  <td>${n.isRead ? '&#10003;' : '&#10007;'}</td>
                  <td>${fmtDate(n.createdAt)}</td>
                  <td><button class="btn btn-sm btn-danger" data-delete="${n.id}">&#128465;</button></td>
                </tr>
              `).join('') : `<tr><td colspan="6" class="empty-row">No notifications yet.</td></tr>`}
            </tbody>
          </table>
        </div>`;

      container.querySelector('[data-send]').addEventListener('click', () => sendNotification(load));
      container.querySelectorAll('[data-delete]').forEach(el => {
        el.addEventListener('click', async () => {
          const ok = await confirmDialog('Delete this notification?');
          if (!ok) return;
          try {
            await api(`/api/admin/notifications/${el.dataset.delete}`, { method: 'DELETE' });
            showToast('Deleted.', 'success');
            load();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  }

  function sendNotification(reload) {
    openModal({
      title: 'Send Notification',
      body: `
        <form class="form-grid" data-form>
          <div class="form-group">
            <label>Recipient</label>
            <select id="notif-user">
              <option value="ALL">All Clients</option>
            </select>
          </div>
          <div class="form-group">
            <label>Channel</label>
            <select id="notif-channel">
              <option value="WEBSITE">Website</option>
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
            </select>
          </div>
          <div class="form-group full">
            <label>Title *</label>
            <input type="text" id="notif-title" required />
          </div>
          <div class="form-group full">
            <label>Body *</label>
            <textarea id="notif-body" rows="4" required></textarea>
          </div>
          <div class="form-actions full">
            <button type="button" class="btn" data-cancel>Cancel</button>
            <button type="submit" class="btn btn-primary">Send</button>
          </div>
        </form>`,
    });

    // Load users for the dropdown
    api('/api/admin/users').then(data => {
      const select = document.querySelector('#notif-user');
      if (data.users) {
        data.users.filter(u => u.role === 'CLIENT').forEach(u => {
          select.innerHTML += `<option value="${u.id}">${u.firstName} ${u.lastName} (${u.email})</option>`;
        });
      }
    }).catch(() => {});

    const overlay = document.querySelector('.modal-overlay');
    overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
    overlay.querySelector('[data-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        userId: overlay.querySelector('#notif-user').value,
        title: overlay.querySelector('#notif-title').value,
        body: overlay.querySelector('#notif-body').value,
        channel: overlay.querySelector('#notif-channel').value,
      };
      try {
        await api('/api/admin/notifications/send', { method: 'POST', body: data });
        showToast('Notification sent.', 'success');
        closeModal();
        reload();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  load();
}

/* ─── 13. Website CMS ─── */
function renderCms() {
  const container = document.getElementById('tab-cms');

  async function load() {
    try {
      const data = await api('/api/admin/content');
      const content = data.content || [];

      // Group by section
      const sections = {};
      content.forEach(c => {
        if (!sections[c.section]) sections[c.section] = [];
        sections[c.section].push(c);
      });

      let html = `
        <div class="section-header">
          <div>
            <h2>Website CMS</h2>
            <p>Edit content across all pages — changes take effect immediately.</p>
          </div>
          <button class="btn btn-primary" data-add>&plus; Add Field</button>
        </div>`;

      for (const [section, items] of Object.entries(sections)) {
        html += `<div class="data-table-wrap" style="margin-bottom:16px;">
          <div class="table-toolbar"><strong style="text-transform:capitalize;">${section}</strong></div>
          <table class="data-table">
            <thead><tr><th>Key</th><th>Value</th><th>Type</th><th>Actions</th></tr></thead>
            <tbody>
              ${items.map(c => `
                <tr>
                  <td><code>${c.key}</code></td>
                  <td>${(c.value || '').slice(0, 60)}${c.value?.length > 60 ? '&hellip;' : ''}</td>
                  <td>${c.type || 'text'}</td>
                  <td><button class="btn btn-sm btn-ghost" data-edit="${c.key}">&#9998; Edit</button> <button class="btn btn-sm btn-danger" data-delete="${c.key}">&#128465;</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
      }

      container.innerHTML = html;

      container.querySelector('[data-add]').addEventListener('click', () => addContentField(load));
      container.querySelectorAll('[data-edit]').forEach(el => {
        el.addEventListener('click', () => {
          const item = content.find(c => c.key === el.dataset.edit);
          if (item) editContentField(item, load);
        });
      });
      container.querySelectorAll('[data-delete]').forEach(el => {
        el.addEventListener('click', async () => {
          const ok = await confirmDialog(`Delete "${el.dataset.edit}"?`);
          if (!ok) return;
          try {
            await api(`/api/admin/content/${el.dataset.edit}`, { method: 'DELETE' });
            showToast('Deleted.', 'success');
            load();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  }

  function editContentField(item, reload) {
    openModal({
      title: `Edit: ${item.key}`,
      body: `
        <form class="form-grid" data-form>
          <div class="form-group full"><label>Key</label><input type="text" value="${item.key}" disabled style="opacity:0.6;" /></div>
          <div class="form-group">
            <label>Section</label>
            <input type="text" id="cms-section" value="${item.section}" />
          </div>
          <div class="form-group">
            <label>Type</label>
            <select id="cms-type">
              <option value="text" ${item.type === 'text' ? 'selected' : ''}>Text</option>
              <option value="html" ${item.type === 'html' ? 'selected' : ''}>HTML</option>
              <option value="image" ${item.type === 'image' ? 'selected' : ''}>Image URL</option>
            </select>
          </div>
          <div class="form-group full">
            <label>Value</label>
            ${item.type === 'html' || item.value?.includes('<')
              ? `<textarea id="cms-value" rows="6">${item.value || ''}</textarea>`
              : `<input type="text" id="cms-value" value="${item.value || ''}" />`}
          </div>
          <div class="form-actions full">
            <button type="button" class="btn" data-cancel>Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>`,
    });

    const overlay = document.querySelector('.modal-overlay');
    overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
    overlay.querySelector('[data-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        section: overlay.querySelector('#cms-section').value,
        type: overlay.querySelector('#cms-type').value,
        value: overlay.querySelector('#cms-value').value,
      };
      try {
        await api(`/api/admin/content/${item.key}`, { method: 'PUT', body: data });
        showToast('Saved.', 'success');
        closeModal();
        reload();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  function addContentField(reload) {
    openModal({
      title: 'Add Content Field',
      body: `
        <form class="form-grid" data-form>
          <div class="form-group full"><label>Key *</label><input type="text" id="cms-key" required placeholder="e.g. hero_title" /></div>
          <div class="form-group"><label>Section *</label><input type="text" id="cms-section" required placeholder="e.g. hero" /></div>
          <div class="form-group">
            <label>Type</label>
            <select id="cms-type">
              <option value="text">Text</option>
              <option value="html">HTML</option>
              <option value="image">Image URL</option>
            </select>
          </div>
          <div class="form-group full"><label>Value</label><textarea id="cms-value" rows="4"></textarea></div>
          <div class="form-actions full">
            <button type="button" class="btn" data-cancel>Cancel</button>
            <button type="submit" class="btn btn-primary">Create</button>
          </div>
        </form>`,
    });

    const overlay = document.querySelector('.modal-overlay');
    overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
    overlay.querySelector('[data-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        key: overlay.querySelector('#cms-key').value,
        section: overlay.querySelector('#cms-section').value,
        type: overlay.querySelector('#cms-type').value,
        value: overlay.querySelector('#cms-value').value,
      };
      try {
        await api('/api/admin/content', { method: 'POST', body: data });
        showToast('Created.', 'success');
        closeModal();
        reload();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  load();
}

/* ─── 14. Media Library ─── */
function renderMedia() {
  const container = document.getElementById('tab-media');

  async function load() {
    try {
      const data = await api('/api/admin/media');
      const media = data.media || [];

      container.innerHTML = `
        <div class="section-header">
          <div>
            <h2>Media Library</h2>
            <p>${media.length} assets</p>
          </div>
          <button class="btn btn-primary" data-upload>&#128247; Upload</button>
        </div>
        ${media.length ? `<div class="media-grid">
          ${media.map(m => `
            <div class="media-item">
              ${m.mimeType?.startsWith('image/') ? `<img src="${m.url}" alt="${m.altText || m.filename}" />` : `<div style="padding:40px;text-align:center;background:var(--body-bg);">${m.filename}</div>`}
              <div class="media-info">${m.filename}</div>
              <div class="media-actions">
                <button class="btn btn-sm btn-ghost" data-copy="${m.url}" title="Copy URL">&#128203;</button>
                <button class="btn btn-sm btn-ghost" data-edit="${m.id}" title="Edit alt text">&#9998;</button>
                <button class="btn btn-sm btn-danger" data-delete="${m.id}" title="Delete">&#128465;</button>
              </div>
            </div>
          `).join('')}
        </div>` : `<div class="empty-state"><h3>No media yet</h3><p>Upload images to use across the website.</p></div>`}`;

      container.querySelector('[data-upload]').addEventListener('click', () => uploadMedia(load));
      container.querySelectorAll('[data-copy]').forEach(el => {
        el.addEventListener('click', () => {
          navigator.clipboard.writeText(el.dataset.copy).then(() => showToast('URL copied!', 'success')).catch(() => {});
        });
      });
      container.querySelectorAll('[data-edit]').forEach(el => {
        el.addEventListener('click', () => editMedia(el.dataset.edit, load));
      });
      container.querySelectorAll('[data-delete]').forEach(el => {
        el.addEventListener('click', async () => {
          const ok = await confirmDialog('Delete this media asset?');
          if (!ok) return;
          try {
            await api(`/api/admin/media/${el.dataset.delete}`, { method: 'DELETE' });
            showToast('Deleted.', 'success');
            load();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  }

  function uploadMedia(reload) {
    openModal({
      title: 'Upload Media',
      body: `
        <form class="form-grid" data-form>
          <div class="form-group full">
            <label>File *</label>
            <input type="file" id="media-file" accept="image/*,video/mp4,application/pdf" required />
          </div>
          <div class="form-group full">
            <label>Alt Text</label>
            <input type="text" id="media-alt" placeholder="Describe the image" />
          </div>
          <div class="form-actions full">
            <button type="button" class="btn" data-cancel>Cancel</button>
            <button type="submit" class="btn btn-primary">Upload</button>
          </div>
        </form>`,
    });

    const overlay = document.querySelector('.modal-overlay');
    overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
    overlay.querySelector('[data-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = overlay.querySelector('#media-file');
      if (!fileInput.files[0]) return;
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('altText', overlay.querySelector('#media-alt').value);
      try {
        await api('/api/admin/media/upload', { method: 'POST', body: formData });
        showToast('Uploaded!', 'success');
        closeModal();
        reload();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  function editMedia(id, reload) {
    api('/api/admin/media').then(data => {
      const item = data.media?.find(m => m.id === id);
      if (!item) return;
      openModal({
        title: 'Edit Media',
        body: `
          <form class="form-grid" data-form>
            <div class="form-group full"><label>Filename</label><input type="text" value="${item.filename}" disabled style="opacity:0.6;" /></div>
            <div class="form-group full"><label>Alt Text</label><input type="text" id="media-alt" value="${item.altText || ''}" /></div>
            <div class="form-actions full">
              <button type="button" class="btn" data-cancel>Cancel</button>
              <button type="submit" class="btn btn-primary">Save</button>
            </div>
          </form>`,
      });
      const overlay = document.querySelector('.modal-overlay');
      overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
      overlay.querySelector('[data-form]').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await api(`/api/admin/media/${id}`, { method: 'PUT', body: { altText: overlay.querySelector('#media-alt').value } });
          showToast('Saved.', 'success');
          closeModal();
          reload();
        } catch (err) { showToast(err.message, 'error'); }
      });
    }).catch(() => {});
  }

  load();
}

/* ─── 15. Settings ─── */
function renderSettings() {
  const container = document.getElementById('tab-settings');
  let settingsCache = [];

  async function load() {
    try {
      const data = await api('/api/admin/settings');
      settingsCache = data.settings || [];

      const getVal = (key, fallback = '') => {
        const s = settingsCache.find(s => s.key === key);
        return s ? s.value : fallback;
      };

      container.innerHTML = `
        <div class="section-header">
          <div>
            <h2>Settings</h2>
            <p>Site configuration and preferences</p>
          </div>
        </div>

        <div style="display:grid;gap:20px;">

        <!-- General Settings -->
        <div class="data-table-wrap">
          <div class="table-toolbar"><strong>General</strong></div>
          <div style="padding:16px;">
            <form class="form-grid" id="settings-general">
              <div class="form-group">
                <label>Site Coming Soon</label>
                <div class="flex items-center gap-3">
                  <button type="button" class="toggle-btn ${getVal('site_coming_soon') === 'true' ? 'active' : ''}" id="settings-coming-soon">${getVal('site_coming_soon') === 'true' ? 'Coming Soon: ON' : 'Coming Soon: OFF'}</button>
                </div>
              </div>
              <div class="form-group"><label>Site Tagline</label><input type="text" id="setting-tagline" value="${getVal('tagline')}" /></div>
              <div class="form-group"><label>Contact Phone</label><input type="tel" id="setting-contact_phone" value="${getVal('contact_phone')}" /></div>
              <div class="form-group"><label>Contact Email</label><input type="email" id="setting-contact_email" value="${getVal('contact_email')}" /></div>
              <div class="form-group full"><label>Address</label><input type="text" id="setting-contact_address" value="${getVal('contact_address')}" /></div>
              <div class="form-group"><label>Business Hours</label><input type="text" id="setting-business_hours" value="${getVal('business_hours')}" /></div>
              <div class="form-group"><label>Admin Email</label><input type="email" id="setting-admin_email" value="${getVal('admin_email')}" /></div>
              <div class="form-actions full"><button type="submit" class="btn btn-primary">Save General</button></div>
            </form>
          </div>
        </div>

        <!-- Social Media -->
        <div class="data-table-wrap">
          <div class="table-toolbar"><strong>Social Media</strong></div>
          <div style="padding:16px;">
            <form class="form-grid" id="settings-social">
              <div class="form-group"><label>Instagram</label><input type="text" id="setting-social_instagram" value="${getVal('social_instagram')}" placeholder="username" /></div>
              <div class="form-group"><label>Facebook</label><input type="text" id="setting-social_facebook" value="${getVal('social_facebook')}" placeholder="page name" /></div>
              <div class="form-group"><label>WhatsApp</label><input type="tel" id="setting-social_whatsapp" value="${getVal('social_whatsapp')}" /></div>
              <div class="form-actions full"><button type="submit" class="btn btn-primary">Save Social</button></div>
            </form>
          </div>
        </div>

        <!-- Custom Settings -->
        <div class="data-table-wrap">
          <div class="table-toolbar"><strong>All Settings</strong> <button class="btn btn-sm btn-primary" data-add-setting>&plus; Add</button></div>
          <table class="data-table">
            <thead><tr><th>Key</th><th>Value</th><th>Actions</th></tr></thead>
            <tbody>
              ${settingsCache.map(s => `
                <tr>
                  <td><code>${s.key}</code></td>
                  <td>${(s.value || '').slice(0, 60)}</td>
                  <td><button class="btn btn-sm btn-ghost" data-edit-setting="${s.key}">&#9998;</button> <button class="btn btn-sm btn-danger" data-delete-setting="${s.key}">&#128465;</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        </div>`;

      /* ─── Coming Soon toggle ─── */
      const csToggle = container.querySelector('#settings-coming-soon');
      let csEnabled = getVal('site_coming_soon') === 'true';
      csToggle.addEventListener('click', async () => {
        try {
          await api('/api/admin/settings/coming-soon', { method: 'PUT', body: { enabled: !csEnabled } });
          csEnabled = !csEnabled;
          csToggle.textContent = csEnabled ? 'Coming Soon: ON' : 'Coming Soon: OFF';
          csToggle.classList.toggle('active', csEnabled);
          showToast(`Coming soon ${csEnabled ? 'enabled' : 'disabled'}.`, 'success');
        } catch (err) { showToast(err.message, 'error'); }
      });

      /* ─── Save General ─── */
      container.querySelector('#settings-general').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const keys = ['tagline', 'contact_phone', 'contact_email', 'contact_address', 'business_hours', 'admin_email'];
        try {
          for (const key of keys) {
            const el = form.querySelector(`#setting-${key}`);
            if (el) await api(`/api/admin/settings/${key}`, { method: 'PUT', body: { value: el.value } });
          }
          showToast('Settings saved.', 'success');
          load();
        } catch (err) { showToast(err.message, 'error'); }
      });

      /* ─── Save Social ─── */
      container.querySelector('#settings-social').addEventListener('submit', async (e) => {
        e.preventDefault();
        const keys = ['social_instagram', 'social_facebook', 'social_whatsapp'];
        try {
          for (const key of keys) {
            const el = e.target.querySelector(`#setting-${key}`);
            if (el) await api(`/api/admin/settings/${key}`, { method: 'PUT', body: { value: el.value } });
          }
          showToast('Social links saved.', 'success');
          load();
        } catch (err) { showToast(err.message, 'error'); }
      });

      /* ─── Add setting ─── */
      container.querySelector('[data-add-setting]').addEventListener('click', () => {
        openModal({
          title: 'Add Setting',
          body: `<form class="form-grid" data-form>
            <div class="form-group full"><label>Key *</label><input type="text" id="new-setting-key" required placeholder="setting_key" /></div>
            <div class="form-group full"><label>Value</label><input type="text" id="new-setting-value" /></div>
            <div class="form-actions full">
              <button type="button" class="btn" data-cancel>Cancel</button>
              <button type="submit" class="btn btn-primary">Create</button>
            </div>
          </form>`,
        });
        const overlay = document.querySelector('.modal-overlay');
        overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
        overlay.querySelector('[data-form]').addEventListener('submit', async (e) => {
          e.preventDefault();
          const key = overlay.querySelector('#new-setting-key').value;
          const value = overlay.querySelector('#new-setting-value').value;
          try {
            await api(`/api/admin/settings/${key}`, { method: 'PUT', body: { value } });
            showToast('Created.', 'success');
            closeModal();
            load();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });

      /* ─── Edit setting ─── */
      container.querySelectorAll('[data-edit-setting]').forEach(el => {
        el.addEventListener('click', () => {
          const s = settingsCache.find(s => s.key === el.dataset.editSetting);
          if (!s) return;
          openModal({
            title: `Edit: ${s.key}`,
            body: `<form class="form-grid" data-form>
              <div class="form-group full"><label>Key</label><input type="text" value="${s.key}" disabled style="opacity:0.6;" /></div>
              <div class="form-group full"><label>Value</label><input type="text" id="edit-setting-value" value="${s.value || ''}" /></div>
              <div class="form-actions full">
                <button type="button" class="btn" data-cancel>Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
              </div>
            </form>`,
          });
          const overlay = document.querySelector('.modal-overlay');
          overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
          overlay.querySelector('[data-form]').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
              await api(`/api/admin/settings/${s.key}`, { method: 'PUT', body: { value: overlay.querySelector('#edit-setting-value').value } });
              showToast('Saved.', 'success');
              closeModal();
              load();
            } catch (err) { showToast(err.message, 'error'); }
          });
        });
      });

      container.querySelectorAll('[data-delete-setting]').forEach(el => {
        el.addEventListener('click', async () => {
          const ok = await confirmDialog(`Delete setting "${el.dataset.deleteSetting}"?`);
          if (!ok) return;
          try {
            const key = el.dataset.deleteSetting;
            await api(`/api/admin/settings/${key}`, { method: 'PUT', body: { value: '' } });
            showToast('Cleared.', 'success');
            load();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });

    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  }

  load();
}

/* ─── 15. Email Templates ─── */
function renderEmailTemplates() {
  const container = document.getElementById('tab-email-templates');

  const TEMPLATE_INFO = {
    'booking': { label: 'Booking Confirmation', desc: 'Sent when a client books an appointment.' },
    'booking-admin': { label: 'Booking Alert (Admin)', desc: 'Notifies admin of a new booking.' },
    'reminder': { label: 'Appointment Reminder', desc: 'Sent before a scheduled appointment.' },
    'promotion': { label: 'Promotional Offer', desc: 'Sent for promotions and discounts.' },
    'newsletter': { label: 'Newsletter', desc: 'General newsletter to subscribers.' },
    'general-reply': { label: 'General Reply', desc: 'Used for admin replies and general messages.' },
    'consultation-admin': { label: 'Consultation Alert (Admin)', desc: 'Notifies admin of a new consultation request.' },
    'welcome': { label: 'Welcome Email', desc: 'Sent to new client accounts.' },
  };

  async function load() {
    try {
      const data = await api('/api/admin/email-templates');
      const templates = data.templates || [];

      container.innerHTML = `
        <div class="section-header">
          <div>
            <h2>Email Templates</h2>
            <p>Customize the subject lines and body content for automated emails. Changes take effect immediately.</p>
          </div>
        </div>
        <div style="display:grid;gap:16px;">
          ${templates.map(t => {
            const info = TEMPLATE_INFO[t.slug] || { label: t.name, desc: '' };
            return `
            <div class="data-table-wrap">
              <div class="table-toolbar" style="cursor:pointer;" data-toggle="${t.slug}">
                <strong style="color:var(--gold);">${info.label}</strong>
                <span style="font-size:0.75rem;color:var(--muted);">${t.slug}</span>
                <span class="status-pill ${t.isActive ? 'active' : 'inactive'}" style="margin-left:auto;">${t.isActive ? 'Active' : 'Inactive'}</span>
                <span style="margin-left:12px;font-size:0.7rem;color:var(--muted);">&#9660;</span>
              </div>
              <div class="template-editor" id="template-${t.slug}" style="display:none;padding:16px;">
                <form class="form-grid" data-template-form="${t.slug}">
                  <div class="form-group full">
                    <label>Template Name</label>
                    <input type="text" id="tpl-name-${t.slug}" value="${t.name || info.label}" />
                  </div>
                  <div class="form-group full">
                    <label>Subject Line</label>
                    <input type="text" id="tpl-subject-${t.slug}" value="${(t.subject || '').replace(/"/g, '&quot;')}" placeholder="e.g. Your Appointment — VENSHA SKIN" />
                  </div>
                  <div class="form-group full">
                    <label>Body HTML</label>
                    <textarea id="tpl-body-${t.slug}" rows="8" placeholder="Enter HTML content or leave blank to use the default." style="font-family:monospace;font-size:0.8rem;">${(t.bodyHtml || '').replace(/"/g, '&quot;')}</textarea>
                    <span class="form-help">Available variables: {{name}}, {{message}}, {{headline}}, {{intro}}, {{preheader}}, {{category_label}}, {{footer_note}}, {{year}}</span>
                  </div>
                  <div class="form-group checkbox">
                    <input type="checkbox" id="tpl-active-${t.slug}" ${t.isActive ? 'checked' : ''} />
                    <label for="tpl-active-${t.slug}">Active (enabled for sending)</label>
                  </div>
                  <div class="form-actions full">
                    <button type="submit" class="btn btn-primary">Save Template</button>
                    <button type="button" class="btn btn-ghost" data-preview="${t.slug}">&#128065; Preview</button>
                  </div>
                </form>
              </div>
            </div>`;
          }).join('')}
        </div>`;

      /* ─── Toggle editor visibility ─── */
      container.querySelectorAll('[data-toggle]').forEach(el => {
        el.addEventListener('click', () => {
          const slug = el.dataset.toggle;
          const editor = container.querySelector(`#template-${slug}`);
          if (editor) {
            const isVisible = editor.style.display !== 'none';
            editor.style.display = isVisible ? 'none' : 'block';
            el.querySelector(':scope > span:last-child').textContent = isVisible ? '&#9660;' : '&#9650;';
          }
        });
      });

      /* ─── Save template ─── */
      container.querySelectorAll('[data-template-form]').forEach(form => {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const slug = form.dataset.templateForm;
          const data = {
            name: container.querySelector(`#tpl-name-${slug}`).value,
            subject: container.querySelector(`#tpl-subject-${slug}`).value,
            bodyHtml: container.querySelector(`#tpl-body-${slug}`).value,
            isActive: container.querySelector(`#tpl-active-${slug}`).checked,
          };
          try {
            await api(`/api/admin/email-templates/${slug}`, { method: 'PUT', body: data });
            showToast(`"${data.name || slug}" saved successfully.`, 'success');
            load();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });

      /* ─── Preview template ─── */
      container.querySelectorAll('[data-preview]').forEach(el => {
        el.addEventListener('click', () => {
          const slug = el.dataset.preview;
          const name = container.querySelector(`#tpl-name-${slug}`)?.value || TEMPLATE_INFO[slug]?.label || slug;
          const subject = container.querySelector(`#tpl-subject-${slug}`)?.value || 'Email Preview';
          const bodyHtml = container.querySelector(`#tpl-body-${slug}`)?.value || '<p>Default content will be used.</p>';
          const previewHtml = bodyHtml || '<p><em>No custom content — using system default.</em></p>';

          openModal({
            title: `Preview: ${name}`,
            wide: true,
            body: `
              <div class="detail-view">
                <div class="detail-row"><span class="detail-label">Subject</span><span class="detail-value">${subject}</span></div>
                <div class="detail-row"><span class="detail-label">Slug</span><span class="detail-value"><code>${slug}</code></span></div>
              </div>
              <div style="margin-top:12px;padding:20px;background:#fff;border:1px solid var(--border);border-radius:8px;max-height:500px;overflow-y:auto;font-family:monospace;font-size:0.8rem;white-space:pre-wrap;">${previewHtml.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              <p style="margin-top:12px;font-size:0.75rem;color:var(--muted);">HTML preview shown as source. Variables ({{name}}, etc.) are replaced at send time.</p>
              <div class="form-actions" style="margin-top:8px;">
                <button class="btn" data-close-preview>Close</button>
              </div>`,
          });
          document.querySelector('[data-close-preview]')?.addEventListener('click', closeModal);
        });
      });

    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  }

  load();
}

/* ─── Consultations ─── */
function renderConsultations() {
  const container = document.getElementById('tab-consultations');
  let currentView = 'list';
  let currentFilter = 'all';
  let searchQuery = '';
  let consultations = [];

  function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return fmtDateShort(dateStr);
  }

  async function loadList() {
    currentView = 'list';
    try {
      const params = new URLSearchParams();
      if (currentFilter !== 'all') params.set('status', currentFilter);
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', '50');

      const data = await api(`/api/admin/consultations?${params}`);
      consultations = data.consultations || [];
      renderList();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  }

  function renderList() {
    const filters = [
      { label: 'All', value: 'all' },
      { label: 'New', value: 'new' },
      { label: 'Pending', value: 'pending' },
      { label: 'Replied', value: 'replied' },
      { label: 'Completed', value: 'completed' },
      { label: 'Archived', value: 'archived' },
    ];

    const filtered = currentFilter === 'all'
      ? consultations
      : consultations.filter(c => c.status === currentFilter);

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h2>Consultation Requests</h2>
          <p>${consultations.length} total requests</p>
        </div>
      </div>

      <div class="filter-bar">
        ${filters.map(f => `
          <button class="filter-btn ${currentFilter === f.value ? 'active' : ''}" data-filter="${f.value}">${f.label}</button>
        `).join('')}
      </div>

      <div class="data-table-wrap">
        <div class="table-toolbar">
          <input class="search-input" type="text" placeholder="Search by name, email, or phone..." value="${searchQuery}" data-search />
          <div class="toolbar-actions">
            <span class="text-sm text-muted">${filtered.length} result${filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        ${filtered.length ? `
        <table class="data-table">
          <thead><tr>
            <th>Status</th>
            <th>Client</th>
            <th>Treatment</th>
            <th>Preferred Date</th>
            <th>Submitted</th>
            <th style="width:80px">Actions</th>
          </tr></thead>
          <tbody>
            ${filtered.map(c => `
              <tr>
                <td>${statusBadge(c.status)}</td>
                <td>
                  <strong>${c.name}</strong><br>
                  <small style="color:var(--muted);">${c.email}</small>
                </td>
                <td>${c.treatment}</td>
                <td>${c.preferredDate || '—'}</td>
                <td><span class="time-ago">${timeAgo(c.createdAt)}</span></td>
                <td><button class="btn btn-sm btn-ghost" data-view="${c.id}">View</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : `
        <div class="empty-state">
          <div class="empty-icon">&#128203;</div>
          <h3>${searchQuery ? 'No results found' : 'No consultation requests'}</h3>
          <p>${searchQuery ? 'Try a different search term.' : 'New consultation requests will appear here.'}</p>
        </div>`}
      </div>`;

    /* Bind events */
    container.querySelectorAll('[data-filter]').forEach(el => {
      el.addEventListener('click', () => {
        currentFilter = el.dataset.filter;
        renderList();
      });
    });

    let searchTimer;
    container.querySelector('[data-search]')?.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchQuery = e.target.value;
        loadList();
      }, 300);
    });

    container.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', () => loadDetail(el.dataset.view));
    });
  }

  async function loadDetail(id) {
    currentView = 'detail';
    container.innerHTML = '<div class="loading">Loading consultation...</div>';

    try {
      const data = await api(`/api/admin/consultations/${id}`);
      const c = data.consultation;
      const emails = data.emailHistory || [];

      container.innerHTML = `
        <button class="back-btn" data-back>&#8592; Back to Consultations</button>

        <div class="section-header">
          <div>
            <h2>Consultation Request</h2>
            <p>Submitted ${timeAgo(c.createdAt)} &mdash; ${fmtDate(c.createdAt)}</p>
          </div>
        </div>

        <div class="consultation-detail">
          <div class="consultation-main">

            <!-- Client Information -->
            <div class="detail-card">
              <div class="detail-card-header">Client Information</div>
              <div class="detail-card-body">
                <div class="detail-field">
                  <span class="field-label">Name</span>
                  <span class="field-value">${c.name}</span>
                </div>
                <div class="detail-field">
                  <span class="field-label">Email</span>
                  <span class="field-value"><a href="mailto:${c.email}" style="color:var(--gold);text-decoration:none;">${c.email}</a></span>
                </div>
                <div class="detail-field">
                  <span class="field-label">Phone</span>
                  <span class="field-value"><a href="tel:${c.phone}" style="color:var(--gold);text-decoration:none;">${c.phone}</a></span>
                </div>
                <div class="detail-field">
                  <span class="field-label">Preferred Treatment</span>
                  <span class="field-value"><strong>${c.treatment}</strong></span>
                </div>
                <div class="detail-field">
                  <span class="field-label">Preferred Date</span>
                  <span class="field-value">${c.preferredDate || 'Not specified'}</span>
                </div>
                <div class="detail-field">
                  <span class="field-label">Preferred Time</span>
                  <span class="field-value">${c.preferredTime || 'Not specified'}</span>
                </div>
                ${c.message ? `
                <div class="detail-field">
                  <span class="field-label">Message</span>
                  <span class="field-value message-text">${c.message}</span>
                </div>` : ''}
              </div>
            </div>

            <!-- Internal Notes -->
            <div class="detail-card">
              <div class="detail-card-header">Internal Notes</div>
              <div class="detail-card-body">
                <div class="form-group">
                  <label>Status</label>
                  <select id="consult-status">
                    ${['new','pending','replied','completed','archived'].map(s =>
                      `<option value="${s}" ${c.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
                    ).join('')}
                  </select>
                </div>
                <div class="form-group" style="margin-top:12px;">
                  <label>Assigned Staff</label>
                  <input type="text" id="consult-assigned" value="${c.assignedTo || ''}" placeholder="e.g. Administrator" />
                </div>
                <div class="form-group" style="margin-top:12px;">
                  <label>Notes <span style="font-weight:400;text-transform:none;letter-spacing:0;">(Internal only)</span></label>
                  <textarea id="consult-notes" rows="4" placeholder="Add internal notes about this consultation...">${c.notes || ''}</textarea>
                </div>
                <div style="margin-top:14px;">
                  <button class="btn btn-primary" id="saveNotesBtn">Save Notes</button>
                </div>
              </div>
            </div>

            <!-- Email History -->
            <div class="detail-card">
              <div class="detail-card-header">Email History</div>
              <div class="detail-card-body">
                ${emails.length ? `
                <ul class="email-timeline">
                  ${emails.map(e => {
                    const isOutgoing = e.fromEmail !== c.email;
                    const icon = isOutgoing ? '&#9993;' : '&#8617;';
                    const label = isOutgoing ? 'Sent' : 'Received';
                    return `
                    <li class="email-timeline-item">
                      <div class="timeline-icon ${isOutgoing ? 'outgoing' : ''}">${icon}</div>
                      <div class="timeline-content">
                        <div class="timeline-subject">&#10003; ${e.subject}</div>
                        <div class="timeline-meta">${label} &mdash; ${fmtDate(e.createdAt)}</div>
                      </div>
                    </li>`;
                  }).join('')}
                </ul>` : `
                <p style="color:var(--muted);font-size:0.82rem;text-align:center;padding:16px 0;">No email history yet.</p>`}
              </div>
            </div>
          </div>

          <!-- Sidebar Actions -->
          <div class="consultation-sidebar">
            <div class="detail-card">
              <div class="detail-card-header">Actions</div>
              <div class="detail-card-body">
                <div class="action-buttons">
                  <button class="btn btn-primary" data-action="reply">&#9993; Reply to Client</button>
                  <button class="btn btn-info" data-action="schedule">&#128197; Schedule Consultation</button>
                  <button class="btn btn-warning" data-action="status-pending">Mark as Pending</button>
                  <button class="btn btn-success" data-action="status-completed">&#10003; Mark as Completed</button>
                  <button class="btn btn-archive" data-action="status-archived">&#128451; Archive Request</button>
                </div>
              </div>
            </div>

            <!-- Quick Info -->
            <div class="detail-card">
              <div class="detail-card-header">Quick Info</div>
              <div class="detail-card-body">
                <div class="detail-field">
                  <span class="field-label">Request ID</span>
                  <span class="field-value" style="font-family:monospace;font-size:0.72rem;color:var(--muted);">${c.id}</span>
                </div>
                <div class="detail-field">
                  <span class="field-label">Created</span>
                  <span class="field-value">${fmtDate(c.createdAt)}</span>
                </div>
                ${c.updatedAt ? `
                <div class="detail-field">
                  <span class="field-label">Last Updated</span>
                  <span class="field-value">${fmtDate(c.updatedAt)}</span>
                </div>` : ''}
              </div>
            </div>
          </div>
        </div>`;

      /* Bind detail events */
      container.querySelector('[data-back]').addEventListener('click', () => loadList());

      /* Save notes */
      container.querySelector('#saveNotesBtn').addEventListener('click', async () => {
        const status = container.querySelector('#consult-status').value;
        const assignedTo = container.querySelector('#consult-assigned').value;
        const notes = container.querySelector('#consult-notes').value;

        try {
          await api(`/api/admin/consultations/${id}/notes`, {
            method: 'PATCH',
            body: { notes, assignedTo },
          });
          await api(`/api/admin/consultations/${id}/status`, {
            method: 'PATCH',
            body: { status },
          });
          showToast('Notes saved successfully.', 'success');
          loadDetail(id);
        } catch (err) { showToast(err.message, 'error'); }
      });

      /* Status actions */
      container.querySelectorAll('[data-action]').forEach(el => {
        el.addEventListener('click', async () => {
          const action = el.dataset.action;

          if (action === 'reply') {
            openReplyModal(c, id);
          } else if (action === 'schedule') {
            openScheduleModal(c, id);
          } else if (action.startsWith('status-')) {
            const newStatus = action.replace('status-', '');
            try {
              await api(`/api/admin/consultations/${id}/status`, {
                method: 'PATCH',
                body: { status: newStatus },
              });
              showToast(`Status updated to ${newStatus}.`, 'success');
              loadDetail(id);
            } catch (err) { showToast(err.message, 'error'); }
          }
        });
      });

    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${err.message}</p></div>`;
    }
  }

  function openReplyModal(c, id) {
    const defaultMessage = `Subject: Your VENSHA SKIN Consultation\n\nHello ${c.name},\n\nThank you for your inquiry.\n\nWe've reviewed your consultation request and would like to schedule your appointment.\n\nDate: {{date}}\nTime: {{time}}\n\nPlease reply to confirm.\n\nThank you,\nVENSHA SKIN`;

    openReplyModalGeneric({
      id: id,
      name: c.name,
      email: c.email,
      subject: "Your Consultation Request - VENSHA SKIN",
      message: defaultMessage,
      endpoint: `/api/admin/consultations/${id}/reply`,
      onSuccess: () => loadDetail(id)
    });
  }

  function openReplyModalGeneric({ id, name, email, subject, message, endpoint, onSuccess }) {
    openModal({
      title: 'Reply to Client',
      wide: true,
      body: `
        <form data-reply-form>
          <div class="form-group">
            <label>To</label>
            <input type="text" value="${name} <${email}>" disabled style="opacity:0.7;" />
          </div>
          <div class="form-group" style="margin-top:12px;">
            <label>Subject</label>
            <input type="text" id="reply-subject" value="${subject}" />
          </div>
          <div class="form-group" style="margin-top:12px;">
            <label>Message</label>
            <textarea id="reply-message" rows="14" style="font-size:0.85rem;line-height:1.6;">${message}</textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn" data-cancel>Cancel</button>
            <button type="submit" class="btn btn-primary">&#9993; Send Email</button>
          </div>
        </form>`,
    });

    const overlay = document.querySelector('.modal-overlay');
    overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
    overlay.querySelector('[data-reply-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const s = overlay.querySelector('#reply-subject').value;
      const m = overlay.querySelector('#reply-message').value;
      try {
        await api(endpoint, {
          method: 'POST',
          body: { subject: s, message: m },
        });
        showToast('Reply sent successfully.', 'success');
        closeModal();
        if (onSuccess) onSuccess();
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  function openScheduleModal(c, id) {
    openModal({
      title: 'Schedule Consultation',
      body: `
        <form data-schedule-form>
          <div class="form-group">
            <label>Client</label>
            <input type="text" value="${c.name}" disabled style="opacity:0.7;" />
          </div>
          <div class="form-grid" style="margin-top:12px;">
            <div class="form-group">
              <label>Date</label>
              <input type="date" id="sched-date" value="${c.preferredDate || ''}" required />
            </div>
            <div class="form-group">
              <label>Time</label>
              <input type="time" id="sched-time" value="${c.preferredTime || ''}" required />
            </div>
          </div>
          <div class="form-group" style="margin-top:12px;">
            <label>Additional Message (optional)</label>
            <textarea id="sched-message" rows="4" placeholder="Any notes for the client..."></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn" data-cancel>Cancel</button>
            <button type="submit" class="btn btn-primary">&#128197; Send Schedule</button>
          </div>
        </form>`,
    });

    const overlay = document.querySelector('.modal-overlay');
    overlay.querySelector('[data-cancel]').addEventListener('click', closeModal);
    overlay.querySelector('[data-schedule-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const scheduledDate = overlay.querySelector('#sched-date').value;
      const scheduledTime = overlay.querySelector('#sched-time').value;
      const message = overlay.querySelector('#sched-message').value;
      const subject = 'Your Consultation Schedule - VENSHA SKIN';
      try {
        await api(`/api/admin/consultations/${id}/schedule`, {
          method: 'POST',
          body: { subject, message, scheduledDate, scheduledTime },
        });
        showToast('Schedule sent successfully.', 'success');
        closeModal();
        loadDetail(id);
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  loadList();
}

/* ═══════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════ */

const tabRenderers = {
  dashboard: renderDashboard,
  'machine-inquiries': renderMachineInquiries,
  inbox: renderInbox,
  consultations: renderConsultations,
  gallery: renderGallery,
  testimonials: renderTestimonials,
  research: renderResearch,
  faqs: renderFaqs,
  promotions: renderPromotions,
  'email-templates': renderEmailTemplates,
  cms: renderCms,
  media: renderMedia,
  settings: renderSettings,
};

function switchTab(tabId) {
  state.currentTab = tabId;

  /* Update sidebar */
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
  const link = document.querySelector(`[data-tab="${tabId}"]`);
  if (link) link.classList.add('active');

  /* Update sections */
  document.querySelectorAll('.admin-section').forEach(el => el.classList.remove('active'));
  const section = document.getElementById(`tab-${tabId}`);
  if (section) section.classList.add('active');

  /* Update topbar title */
  const titleEl = document.getElementById('topbarTitle');
  if (link) titleEl.textContent = link.textContent.trim();

  /* Render if not yet */
  if (tabRenderers[tabId]) {
    // Check if already rendered
    if (!section.dataset.rendered) {
      section.dataset.rendered = 'true';
      tabRenderers[tabId]();
    }
  }

  /* Close mobile sidebar */
  state.sidebarOpen = false;
  document.querySelector('.admin-sidebar')?.classList.remove('open');
}

/* ═══════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  /* Sidebar navigation */
  document.querySelectorAll('.sidebar-link').forEach(el => {
    el.addEventListener('click', () => switchTab(el.dataset.tab));
  });

  /* Mobile menu toggle */
  document.querySelector('.mobile-menu-btn')?.addEventListener('click', () => {
    state.sidebarOpen = !state.sidebarOpen;
    document.querySelector('.admin-sidebar')?.classList.toggle('open', state.sidebarOpen);
  });

  /* Logout */
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('vensha_token');
    localStorage.removeItem('vensha_user');
    window.location.href = '/login.html';
  });

  /* Auth check */
  try {
    const token = localStorage.getItem('vensha_token');
    if (!token) throw new Error('No token');
    const data = await api('/api/auth/me');
    state.user = data.user;
    document.getElementById('topbarUser').textContent = `${data.user.firstName} ${data.user.lastName}`;
  } catch {
    window.location.href = '/login.html';
    return;
  }

  /* Render initial tab */
  switchTab('dashboard');

  /* Load notification badges */
  updateNotificationBadges();
  setInterval(updateNotificationBadges, 60000); // refresh every 60s
});

/* ═══ Notification Badges ═══ */
async function updateNotificationBadges() {
  try {
    const [consultData, miData, msgData] = await Promise.allSettled([
      api('/api/admin/consultations?status=new&limit=100'),
      api('/api/admin/machine-inquiries?status=new&limit=100'),
      api('/api/admin/messages'),
    ]);

    const consultCount = consultData.status === 'fulfilled'
      ? (consultData.value.consultations || consultData.value || []).length
      : 0;

    const miCount = miData.status === 'fulfilled'
      ? (miData.value.inquiries || miData.value || []).length
      : 0;

    const unreadMessages = msgData.status === 'fulfilled'
      ? (msgData.value.messages || []).filter(m => !m.isRead).length
      : 0;

    setBadge('consultations', consultCount);
    setBadge('machine-inquiries', miCount);
    setBadge('inbox', unreadMessages);
  } catch (err) {
    // Silently fail - badges are non-critical
  }
}

function setBadge(tabId, count) {
  const link = document.querySelector(`.sidebar-link[data-tab="${tabId}"]`);
  if (!link) return;

  let badge = link.querySelector('.sidebar-badge');
  if (count > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'sidebar-badge';
      link.appendChild(badge);
    }
    badge.textContent = count > 99 ? '99+' : count;
  } else if (badge) {
    badge.remove();
  }
}

