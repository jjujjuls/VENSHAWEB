import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import consultationRoutes from './routes/consultations.js';
import machineInquiryRoutes from './routes/machineInquiries.js';
import appointmentRoutes from './routes/appointments.js';
import adminRoutes from './routes/admin.js';
import settingsRoutes from './routes/settings.js';
import { getSiteSetting } from './middleware/auth.js';
import { startReminderScheduler } from './services/reminderService.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');
const app = express();
const PORT = process.env.PORT || 3000;

const PORTAL_PAGES = new Set([
  '/login.html',
  '/admin.html',
  '/coming-soon.html',
]);

async function isComingSoonEnabled() {
  const value = await getSiteSetting('site_coming_soon', 'false');
  return value === 'true';
}

async function sendHomePage(req, res) {
  if (await isComingSoonEnabled()) {
    return res.sendFile(path.join(rootDir, 'coming-soon.html'));
  }
  return res.sendFile(path.join(rootDir, 'index.html'));
}

/* ─── Inject VENSHA_API into HTML pages ─── */
function injectApiScript(html) {
  return html.replace(
    '</head>',
    `<script>window.VENSHA_API = window.location.origin;</script></head>`
  );
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/machine-inquiries', machineInquiryRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'venshaskin-platform' });
});

/* Helper: read an HTML file, inject VENSHA_API script, and send */
function sendWithApiInjection(res, filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  html = injectApiScript(html);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

/* Homepage must be registered before static — otherwise index.html is served first */
app.get(['/', '/index.html'], async (req, res, next) => {
  try {
    const filePath = await isComingSoonEnabled()
      ? path.join(rootDir, 'coming-soon.html')
      : path.join(rootDir, 'index.html');
    sendWithApiInjection(res, filePath);
  } catch (error) {
    next(error);
  }
});

app.use(express.static(rootDir, { index: false }));
app.use('/templates/emails', express.static(path.join(rootDir, 'templates/emails')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('*', async (req, res, next) => {
  if (req.path.startsWith('/api')) return next();

  if (PORTAL_PAGES.has(req.path)) {
    return sendWithApiInjection(res, path.join(rootDir, req.path.slice(1)));
  }

  try {
    await sendHomePage(req, res);
  } catch (error) {
    next(error);
  }
});

app.listen(PORT, () => {
  console.log(`VENSHASKIN platform running at http://localhost:${PORT}`);
  startReminderScheduler();
  console.log(`[reminder] Scheduler started (checks every ${Number(process.env.REMINDER_CHECK_INTERVAL_MS || 900000) / 60000} min)`);
});
