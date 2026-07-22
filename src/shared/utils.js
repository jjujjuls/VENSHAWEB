/* ═══════════════════════════════════════════
   VENSHA SKIN — Shared Utility Functions
   Used by: Client Portal, Admin Panel
   ═══════════════════════════════════════════ */

/* ─── Date Formatting ─── */
export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function fmtDateShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/* ─── Status Badges ─── */
export function statusBadge(status) {
  const map = {
    PENDING: '<span class="badge badge-pending">Pending</span>',
    CONFIRMED: '<span class="badge badge-confirmed">Confirmed</span>',
    COMPLETED: '<span class="badge badge-completed">Completed</span>',
    CANCELLED: '<span class="badge badge-cancelled">Cancelled</span>',
    RESCHEDULED: '<span class="badge badge-rescheduled">Rescheduled</span>',
    new: '<span class="badge badge-new">New</span>',
    read: '<span class="badge badge-read">Read</span>',
    unread: '<span class="badge badge-unread">Unread</span>',
  };
  return map[status] || `<span class="badge">${status}</span>`;
}

export function statusPill(status) {
  const cls = String(status).toLowerCase().replace(/\s+/g, '-');
  return `<span class="status-pill ${cls}">${status}</span>`;
}

/* ─── Initials ─── */
export function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'VS';
}
