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
        <div class="stat-card gold"><div class="num">${stats.appointments}</div><div class="lbl">Active Appointments</div></div>
        <div class="stat-card gold"><div class="num">${stats.completedAppointments}</div><div class="lbl">Completed</div></div>
        <div class="stat-card gold"><div class="num">${stats.users}</div><div class="lbl">Clients</div></div>
        <div class="stat-card gold"><div class="num">${stats.machineInquiries}</div><div class="lbl">New Inquiries</div></div>
        <div class="stat-card gold"><div class="num">${stats.messages}</div><div class="lbl">Unread Messages</div></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="data-table-wrap">
          <div class="table-toolbar"><strong>Recent Consultations</strong></div>
          ${recentActivity.consultations.length ? `<table class="data-table"><tbody>
            ${recentActivity.consultations.map(c => `<tr><td>${c.name}</td><td>${c.treatment}</td><td>${statusBadge(c.status)}</td><td>${fmtDateShort(c.createdAt)}</td></tr>`).join('')}
          </tbody></table>` : '<div class="empty-state"><p>No consultations yet.</p></div>'}
        </div>
        <div class="data-table-wrap">
          <div class="table-toolbar"><strong>Recent Appointments</strong></div>
          ${recentActivity.appointments.length ? `<table class="data-table"><tbody>
            ${recentActivity.appointments.map(a => `<tr><td>${a.user?.firstName || '—'} ${a.user?.lastName || ''}</td><td>${a.treatment}</td><td>${statusBadge(a.status)}</td><td>${fmtDateShort(a.scheduledAt)}</td></tr>`).join('')}
          </tbody></table>` : '<div class="empty-state"><p>No appointments yet.</p></div>'}
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

/* ─── 2. Appointments ─── */
function renderAppointments() {
  createCrudManager({
    container: document.getElementById('tab-appointments'),
    title: 'Appointments',
    description: 'Manage all client appointments — confirm, reschedule, or cancel.',
    apiBase: '/api/admin/appointments',
    searchable: true,
    pageSize: 25,
    columns: [
      { key: 'client', label: 'Client', render: (a) => `${a.user?.firstName || '—'} ${a.user?.lastName || ''}<br><small style="color:#888;">${a.user?.email || ''}</small>` },
      { key: 'treatment', label: 'Treatment' },
      { key: 'scheduledAt', label: 'Scheduled', render: (a) => fmtDate(a.scheduledAt) },
      { key: 'status', label: 'Status', render: (a) => statusBadge(a.status) },
    ],
    onTransform: (data) => data.appointments || [],
    rowActions: [
      {
        label: 'Confirm', class: 'btn-sm',
        action: async (item, reload) => {
          if (item.status === 'PENDING') {
            try {
              await api(`/api/admin/appointments/${item.id}/confirm`, { method: 'PATCH' });
              showToast('Appointment confirmed.', 'success');
              reload();
            } catch (err) { showToast(err.message, 'error'); }
          }
        },
      },
      {
        label: 'Reschedule', class: 'btn-sm',
        action: (item, reload) => {
          const modal = openModal({
            title: 'Reschedule Appointment',
            body: `
              <form class="form-grid" data-form>
                <div class="form-group full">
                  <label>New Date &amp; Time</label>
                  <input type="datetime-local" id="resched-date" required />
                </div>
                <div class="form-actions full">
                  <button type="button" class="btn" data-cancel>Cancel</button>
                  <button type="submit" class="btn btn-primary">Update</button>
                </div>
              </form>`,
          });
          modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
          modal.querySelector('[data-form]').addEventListener('submit', async (e) => {
            e.preventDefault();
            const dt = modal.querySelector('#resched-date').value;
            if (!dt) return;
            try {
              await api(`/api/admin/appointments/${item.id}/reschedule`, { method: 'PATCH', body: { scheduledAt: dt } });
              showToast('Rescheduled successfully.', 'success');
              closeModal();
              reload();
            } catch (err) { showToast(err.message, 'error'); }
          });
        },
      },
      {
        label: 'Cancel', class: 'btn-sm btn-danger',
        action: async (item, reload) => {
          const ok = await confirmDialog('Cancel this appointment? The client will be notified.');
          if (!ok) return;
          try {
            await api(`/api/admin/appointments/${item.id}/cancel`, { method: 'PATCH' });
            showToast('Appointment cancelled.', 'success');
            reload();
          } catch (err) { showToast(err.message, 'error'); }
        },
      },
    ],
    formFields: [
      { key: 'userId', label: 'Client ID', type: 'text', required: true, placeholder: 'User ID' },
      { key: 'treatment', label: 'Treatment', type: 'text', required: true },
      { key: 'scheduledAt', label: 'Scheduled Date & Time', type: 'datetime-local', required: true },
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Optional notes' },
      { key: 'confirm', label: 'Confirm immediately', type: 'checkbox', default: true },
    ],
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

/* ═══════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════ */

const tabRenderers = {
  dashboard: renderDashboard,
  appointments: renderAppointments,
  inbox: renderInbox,
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
});
