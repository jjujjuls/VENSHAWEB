import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, '../../../templates/emails');

function renderTemplate(html, data) {
  return Object.entries(data).reduce(
    (output, [key, value]) =>
      output.replaceAll(`{{${key}}}`, value ?? '—'),
    html
  );
}

async function loadTemplate(filename) {
  const filePath = path.join(templatesDir, filename);
  return fs.readFile(filePath, 'utf-8');
}

function createTransport() {
  if (!process.env.SMTP_HOST) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendConsultationEmails(consultation) {
  const data = {
    name: consultation.name,
    email: consultation.email,
    phone: consultation.phone,
    treatment: consultation.treatment,
    date: consultation.preferredDate || 'Not specified',
    time: consultation.preferredTime || 'Not specified',
    message: consultation.message || '—',
  };

  const [adminHtml, clientHtml] = await Promise.all([
    loadTemplate('consultation-admin.html'),
    loadTemplate('consultation-client.html'),
  ]);

  const transport = createTransport();
  const from = `"${process.env.FROM_NAME || 'VENSHA SKIN'}" <${process.env.FROM_EMAIL || 'venshaskin@gmail.com'}>`;
  const adminEmail = process.env.ADMIN_EMAIL || 'venshaskin@gmail.com';

  const mailOptions = [
    {
      from,
      to: adminEmail,
      subject: 'New Consultation Request — VENSHA SKIN',
      html: renderTemplate(adminHtml, data),
    },
    {
      from,
      to: consultation.email,
      subject: 'Thank You — VENSHA SKIN Consultation Request Received',
      html: renderTemplate(clientHtml, data),
    },
  ];

  if (!transport) {
    console.log('[email] SMTP not configured. Consultation saved; emails skipped.');
    console.log('[email] Admin would receive:', adminEmail);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  await Promise.all(mailOptions.map((options) => transport.sendMail(options)));
  return { sent: true };
}

export async function sendMachineInquiryEmails(inquiry, user) {
  const data = {
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: inquiry.email,
    phone: inquiry.phone,
    businessName: inquiry.businessName || '—',
    machineModel: inquiry.machineModel,
    quantity: String(inquiry.quantity),
    intendedUse: inquiry.intendedUse || '—',
    message: inquiry.message || '—',
  };

  const [adminHtml, clientHtml] = await Promise.all([
    loadTemplate('machine-inquiry-admin.html'),
    loadTemplate('machine-inquiry-client.html'),
  ]);

  const transport = createTransport();
  const from = `"${process.env.FROM_NAME || 'VENSHA SKIN'}" <${process.env.FROM_EMAIL || 'venshaskin@gmail.com'}>`;
  const adminEmail = process.env.ADMIN_EMAIL || 'venshaskin@gmail.com';

  const mailOptions = [
    {
      from,
      to: adminEmail,
      subject: 'Machine Purchase Inquiry — VENSHA SKIN',
      html: renderTemplate(adminHtml, data),
    },
    {
      from,
      to: inquiry.email,
      subject: 'Your Machine Inquiry — VENSHA SKIN',
      html: renderTemplate(clientHtml, data),
    },
  ];

  if (!transport) {
    console.log('[email] SMTP not configured. Machine inquiry saved; emails skipped.');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  await Promise.all(mailOptions.map((options) => transport.sendMail(options)));
  return { sent: true };
}

export async function sendWrappedEmail({ to, subject, bodyHtml, templateSlug = 'admin-reply.html', data = {} }) {
  const template = await loadTemplate(templateSlug);
  const html = renderTemplate(template, { ...data, message: bodyHtml || '' });
  const transport = createTransport();
  if (!transport) throw new Error('SMTP not configured');

  await transport.sendMail({
    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
}

export async function sendWelcomeEmail(user) {
  const html = await loadTemplate('welcome-client.html');
  const data = {
    name: `${user.firstName} ${user.lastName}`.trim(),
    loginUrl: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/login.html`,
  };

  const transport = createTransport();
  const from = `"${process.env.FROM_NAME || 'VENSHA SKIN'}" <${process.env.FROM_EMAIL || 'venshaskin@gmail.com'}>`;

  if (!transport) {
    console.log('[email] Welcome email skipped — SMTP not configured.');
    return { sent: false };
  }

  await transport.sendMail({
    from,
    to: user.email,
    subject: 'Welcome to VENSHA SKIN',
    html: renderTemplate(html, data),
  });
  return { sent: true };
}
