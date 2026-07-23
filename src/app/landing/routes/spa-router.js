/* ═══════════════════════════════════════════
   VENSHA SKIN — SPA Router
   Handles page routing for multi-page SPA
   Migrated to Supabase Auth
   ═══════════════════════════════════════════ */

import { api, setToken, setUser, requireGuest, showMsg, logout, supabase } from '../../shared/api.js';

(function () {
  'use strict';

  /* --- Page Routing --- */
  const PAGE_SECTIONS = {
    '/': 'page-landing',
    '/index.html': 'page-landing',
    '/login.html': 'page-login',
    '/register.html': 'page-register',
    '/admin.html': 'page-admin',
    '/coming-soon.html': 'page-coming-soon',
  };

  function showPage(path) {
    /* Hide all pages */
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));

    /* Show target */
    const sectionId = PAGE_SECTIONS[path] || 'page-landing';
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');

    /* Update document title */
    const titles = {
      'page-landing': 'VENSHASKIN | Megashape Pro',
      'page-login': 'Sign In — VENSHASKIN',
      'page-register': 'Create Account — VENSHASKIN',
      'page-admin': 'Admin Panel — VENSHASKIN',
      'page-coming-soon': 'Coming Soon — VENSHASKIN',
    };
    document.title = titles[sectionId] || 'VENSHASKIN';
  }

  /* --- Navigation handler --- */
  function handleNavigation(e) {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    /* Check if it's an internal page link */
    const path = new URL(href, window.location.origin).pathname;
    if (PAGE_SECTIONS[path]) {
      e.preventDefault();
      window.history.pushState({ path }, '', path);
      showPage(path);
      initializePage(path);
    }
  }

  /* --- Page initializers --- */
  let initializedPages = {};

  function initializePage(path) {
    if (initializedPages[path]) return;

    switch (path) {
      case '/login.html':
        initLoginPage();
        initializedPages[path] = true;
        break;
      case '/register.html':
        initRegisterPage();
        initializedPages[path] = true;
        break;
      case '/admin.html':
        initAdminPage();
        initializedPages[path] = true;
        break;
    }
  }

  /* --- Login page --- */
  function initLoginPage() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    requireGuest();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('loginMsg');
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      try {
        showMsg(msg, 'Signing in…');

        /* Sign in via Supabase Auth */
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);

        /* Fetch user profile from backend */
        setToken(data.session.access_token);
        const profile = await api('/api/auth/me');

        setUser(profile.user);
        window.location.href = profile.user.role === 'ADMIN' ? '/admin.html' : '/';
      } catch (err) { showMsg(msg, err.message, 'error'); }
    });
  }

  /* --- Register page --- */
  function initRegisterPage() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    requireGuest();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('registerMsg');
      const body = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        password: document.getElementById('password').value,
      };
      try {
        showMsg(msg, 'Creating account…');

        /* Register via our backend API (which creates Supabase Auth user + Prisma record) */
        const data = await api('/api/auth/register', { method: 'POST', body });

        setToken(data.token);
        setUser(data.user);
        window.location.href = '/';
      } catch (err) { showMsg(msg, err.message, 'error'); }
    });
  }
    /* Logout buttons */
    document.querySelectorAll('.logout-action').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.preventDefault(); logout(); });
    });

    /* Mobile drawer */
    const drawer = document.getElementById('mobileDrawer');
    const menuToggle = document.getElementById('menuToggle');
    const drawerClose = document.getElementById('drawerClose');
    const setDrawerOpen = (open) => {
      if (!drawer) return;
      drawer.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
      menuToggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
      drawer?.setAttribute('aria-hidden', open ? 'false' : 'true');
    };
    menuToggle?.addEventListener('click', () => setDrawerOpen(true));
    drawerClose?.addEventListener('click', () => setDrawerOpen(false));
    drawer?.addEventListener('click', (e) => { if (e.target === drawer) setDrawerOpen(false); });

    /* Sidebar navigation */
    document.querySelectorAll('#sidebarNav a, #mobileNav a').forEach((el) => {
      el.addEventListener('click', () => {
        setDrawerOpen(false);
        if (typeof window.switchTab === 'function') window.switchTab(el.dataset.tab);
      });
    });

    /* Init */
    const session = await requireAuth(['CLIENT', 'ADMIN']);
    if (!session) { window.location.href = '/login.html'; return; }

    /* Set sidebar user info */
    const avatarEl = document.getElementById('sidebarAvatar');
    const nameEl = document.getElementById('sidebarName');
    if (avatarEl) avatarEl.textContent = initials(`${session.user.firstName} ${session.user.lastName}`);
    if (nameEl) nameEl.textContent = `${session.user.firstName} ${session.user.lastName}`;

    if (typeof window.initPortal === 'function') await window.initPortal(session);
    if (typeof window.switchTab === 'function') window.switchTab('dashboard');
  }

  /* --- Admin page --- */
  function initAdminPage() {
    /* Dispatch DOMContentLoaded-like event for admin.js */
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
  }

  /* --- PopState handling --- */
  window.addEventListener('popstate', (e) => {
    const path = e.state?.path || window.location.pathname;
    showPage(path);
  });

  /* --- Document ready --- */
  document.addEventListener('DOMContentLoaded', () => {
    /* Intercept nav clicks */
    document.addEventListener('click', handleNavigation);

    /* Show current page */
    const path = window.location.pathname;
    showPage(path);

    /* Initialize current page */
    setTimeout(() => initializePage(path), 50);
  });

})();
