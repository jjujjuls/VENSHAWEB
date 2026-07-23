/* ═══════════════════════════════════════════
   VENSHA SKIN — Shared API & Auth Utilities
   Used by: Landing SPA, Client Portal, Admin Panel
   Migrated to Supabase Auth
   ═══════════════════════════════════════════ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const API = window.VENSHA_API || window.location.origin;

/* ─── Supabase Client ─── */
const supabase = createClient(
  'https://anvwpodhvhjpnlquktuo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFudndwb2RodmhqcG5scXVrdHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MjcxOTQsImV4cCI6MjEwMDQwMzE5NH0.hh7NY1_hGtqwp0qOZQ-ewW5RdPmyYGOkLJHWc4PjHIE'
);

export { supabase };

/* ─── Token Management ─── */
export function getToken() {
  return localStorage.getItem('vensha_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('vensha_token', token);
  else localStorage.removeItem('vensha_token');
}

export function setUser(user) {
  if (user) localStorage.setItem('vensha_user', JSON.stringify(user));
  else localStorage.removeItem('vensha_user');
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('vensha_user') || 'null');
  } catch {
    return null;
  }
}

/* ─── API Helper ─── */
export async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };

  /* Get the current Supabase session token */
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    if (typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
    }
  }

  let response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers });
  } catch (error) {
    const networkError = new Error('Network request failed. Backend unavailable.');
    networkError.isNetworkError = true;
    throw networkError;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.');
    error.status = response.status;
    error.response = data;
    throw error;
  }
  return data;
}

/* ─── Admin API Helper (non-module context) ─── */
export function adminApi(path, options = {}) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const fetchOptions = { ...options, headers };
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    fetchOptions.body = JSON.stringify(options.body);
  }
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
    fetchOptions.body = options.body;
  }

  return fetch(`${API}${path}`, fetchOptions).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  });
}

/* ─── Auth Guards ─── */
export function requireGuest() {
  const user = getUser();
  if (user) {
    window.location.href = user.role === 'ADMIN' ? '/admin.html' : '/';
  }
}

export async function requireAuth(roles = []) {
  /* Check Supabase session first */
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    /* No Supabase session — check if we have a legacy token */
    const legacyToken = getToken();
    if (!legacyToken) {
      window.location.href = '/login.html';
      return null;
    }
  }

  /* Update stored token from Supabase session */
  if (session) {
    setToken(session.access_token);
  }

  try {
    const data = await api('/api/auth/me');
    setUser(data.user);
    if (roles.length && !roles.includes(data.user.role)) {
      window.location.href = data.user.role === 'ADMIN' ? '/admin.html' : '/';
      return null;
    }
    return data;
  } catch {
    setToken(null);
    setUser(null);
    await supabase.auth.signOut();
    window.location.href = '/login.html';
    return null;
  }
}

export async function logout() {
  setToken(null);
  setUser(null);
  await supabase.auth.signOut();
  window.location.href = '/login.html';
}

export function showMsg(el, text, type = '') {
  if (!el) return;
  el.textContent = text;
  el.className = `portal-msg${type ? ` ${type}` : ''}`;
}
