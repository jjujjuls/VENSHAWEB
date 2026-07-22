/* ═══════════════════════════════════════════
   VENSHA SKIN — Shared API & Auth Utilities
   Used by: Landing SPA, Client Portal, Admin Panel
   ═══════════════════════════════════════════ */

const API = window.VENSHA_API || window.location.origin;
const LOCAL_USERS_KEY = 'vensha_local_users';
const LOCAL_SESSION_KEY = 'vensha_local_session';

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

/* ─── Local Auth (Fallback) ─── */
function loadLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function getLocalUser(email) {
  if (!email) return null;
  const normalizedEmail = email.toLowerCase().trim();
  const users = loadLocalUsers();
  return users[normalizedEmail] || null;
}

function createLocalToken() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function setLocalSession(token, email) {
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ token, email }));
}

function getLocalSession() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function clearLocalSession() {
  localStorage.removeItem(LOCAL_SESSION_KEY);
}

function publicUser(user) {
  return {
    id: user.id || null,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role || 'CLIENT',
    memberSince: user.memberSince || null,
  };
}

export function createLocalUser({ firstName, lastName, email, password, phone, role = 'CLIENT' }) {
  if (!email?.trim() || !password || !firstName?.trim() || !lastName?.trim()) {
    throw new Error('Missing required fields.');
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const users = loadLocalUsers();
  const normalizedEmail = email.toLowerCase().trim();
  if (users[normalizedEmail]) {
    throw new Error('Email already registered.');
  }

  users[normalizedEmail] = {
    id: `local-${Date.now()}`,
    email: normalizedEmail,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone?.trim() || '',
    role,
    memberSince: new Date().toISOString(),
    passwordHash: btoa(password),
  };

  saveLocalUsers(users);
  return publicUser(users[normalizedEmail]);
}

export function validateLocalUser(email, password) {
  if (!email?.trim() || !password) return null;
  const user = getLocalUser(email);
  if (!user || user.passwordHash !== btoa(password)) {
    return null;
  }
  return publicUser(user);
}

function localAuthMe() {
  const session = getLocalSession();
  if (!session) return null;
  const user = getLocalUser(session.email);
  if (!user) return null;
  return { user: publicUser(user) };
}

export function localLogin({ email, password }) {
  const user = validateLocalUser(email, password);
  if (!user) throw new Error('Invalid credentials.');
  const token = createLocalToken();
  setLocalSession(token, email);
  return { token, user };
}

export function localRegister(body) {
  const user = createLocalUser(body);
  const token = createLocalToken();
  setLocalSession(token, body.email);
  return { token, user };
}

/* ─── API Helper ─── */
export async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
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
  const user = getUser() || localAuthMe()?.user;
  if (user) {
    window.location.href = user.role === 'ADMIN' ? '/admin.html' : '/account.html';
  }
}

export async function requireAuth(roles = []) {
  const token = getToken();
  if (!token) {
    window.location.href = '/login.html';
    return null;
  }

  try {
    const data = await api('/api/auth/me');
    setUser(data.user);
    if (roles.length && !roles.includes(data.user.role)) {
      window.location.href = data.user.role === 'ADMIN' ? '/admin.html' : '/account.html';
      return null;
    }
    return data;
  } catch {
    const local = localAuthMe();
    if (local && (!roles.length || roles.includes(local.user.role))) {
      setUser(local.user);
      return { user: local.user, membership: null };
    }
    setToken(null);
    setUser(null);
    clearLocalSession();
    window.location.href = '/login.html';
    return null;
  }
}

export function logout() {
  setToken(null);
  setUser(null);
  clearLocalSession();
  window.location.href = '/login.html';
}

export function showMsg(el, text, type = '') {
  if (!el) return;
  el.textContent = text;
  el.className = `portal-msg${type ? ` ${type}` : ''}`;
}
