import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, '../../../templates/emails');

const TEMPLATE_DEFAULTS = {
  booking: {
    name: 'Booking',
    subject: 'Your Appointment — VENSHA SKIN',
    headline: 'Your appointment is confirmed',
    intro: 'We look forward to welcoming you. Here are your appointment details.',
    categoryLabel: 'Appointment',
    preheader: 'Your VENSHA SKIN appointment details',
    footerNote: 'Need to make a change? Reply to this email or visit your client portal.',
  },
  reminder: {
    name: 'Reminder',
    subject: 'Appointment Reminder — VENSHA SKIN',
    headline: 'Your appointment is coming up',
    intro: 'This is a gentle reminder about your upcoming visit with us.',
    categoryLabel: 'Reminder',
    preheader: 'Reminder: your upcoming VENSHA SKIN appointment',
    footerNote: 'We recommend arriving 10 minutes early for a relaxed check-in.',
  },
  promotion: {
    name: 'Promotion',
    subject: 'Exclusive Offer — VENSHA SKIN',
    headline: 'A curated offer for you',
    intro: 'As a valued member of the VENSHA family, we have something special to share.',
    categoryLabel: 'Exclusive Offer',
    preheader: 'An exclusive VENSHA SKIN offer awaits',
    footerNote: 'Offers are subject to availability. Book early to secure your preferred time.',
  },
  newsletter: {
    name: 'Newsletter',
    subject: 'VENSHA SKIN Newsletter',
    headline: 'From the VENSHA studio',
    intro: 'The latest news, treatments, and wellness insights from our team.',
    categoryLabel: 'Newsletter',
    preheader: 'Latest from VENSHA SKIN',
    footerNote: 'You are receiving this because you are part of the VENSHA SKIN community.',
  },
  'general-reply': {
    name: 'General Reply',
    subject: 'Message from VENSHA SKIN',
    headline: 'A message from our team',
    intro: 'Thank you for reaching out — your message is important to us.',
    categoryLabel: 'Personal Message',
    preheader: 'A message from the VENSHA SKIN team',
    footerNote: 'Simply reply to this email and our team will follow up directly.',
  },
  'admin-reply': {
    name: 'Admin Reply',
    subject: 'Response from VENSHA SKIN',
    headline: 'A VENSHA specialist has replied',
    intro: 'Thank you for reaching out — your message is important to us. Below is the response from the VENSHA team.',
    categoryLabel: 'Personal Message',
    preheader: 'A message from the VENSHA SKIN team',
    footerNote: 'If you would like to continue the conversation, simply reply to this email.',
  },
  'booking-admin': {
    name: 'Booking Admin',
    subject: 'New Appointment Booking — VENSHA SKIN',
    headline: 'New appointment request',
    intro: 'A new booking has been submitted and requires your attention.',
    categoryLabel: 'Admin Alert',
    preheader: 'New appointment booking received',
    footerNote: 'Review and confirm in the admin dashboard.',
  },
  'consultation-admin': {
    name: 'Consultation Admin',
    subject: 'New Consultation Request — VENSHA SKIN',
    headline: 'New consultation request',
    intro: 'A visitor has submitted a consultation request from the website.',
    categoryLabel: 'Admin Alert',
    preheader: 'New consultation request received',
    footerNote: 'Review in the admin dashboard and schedule an appointment.',
  },
  welcome: {
    name: 'Welcome',
    subject: 'Welcome to VENSHA SKIN',
    headline: 'Welcome to VENSHA SKIN',
    intro: 'We are delighted to have you join our community of refined wellness.',
    categoryLabel: 'Welcome',
    preheader: 'Welcome to the VENSHA SKIN family',
    footerNote: 'Explore your client portal to manage appointments and messages.',
  },
};

function renderTemplate(html, data) {
  let output = html;
  for (const [key, value] of Object.entries(data)) {
    output = output.replaceAll(`{{${key}}}`, value ?? '');
  }
  return output;
}

async function loadTemplate(filename) {
  const filePath = path.join(templatesDir, filename);
  return fs.readFile(filePath, 'utf-8');
}

function createTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function getFromAddress() {
  return `"${process.env.FROM_NAME || 'VENSHA SKIN'}" <${process.env.FROM_EMAIL || 'venshaskin@gmail.com'}>`;
}

function getAdminEmail() {
  return process.env.ADMIN_EMAIL || 'venshaskin@gmail.com';
}

function buildCtaBlock(ctaText, ctaUrl) {
  if (!ctaText || !ctaUrl) return '';
  return `<tr>
<td style="padding:0 40px 36px;background:#ffffff;text-align:center;">
<table cellpadding="0" cellspacing="0" role="presentation" style="display:inline-block;">
<tr>
<td style="border-radius:8px;background:#B89B5E;">
<a href="${ctaUrl}" style="display:inline-block;padding:14px 36px;background:#B89B5E;color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:2px;text-transform:uppercase;border-radius:8px;font-weight:500;border:1px solid #B89B5E;">${ctaText}</a>
</td>
</tr>
</table>
</td></tr>`;
}

function formatDateTime(date) {
  return new Date(date).toLocaleString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function appointmentDetailsHtml(appointment, user) {
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : '—';
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:24px;color:#444;">
      <tr><td style="padding:6px 0;color:#888;width:120px;">Client</td><td style="padding:6px 0;"><strong>${name}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#888;">Treatment</td><td style="padding:6px 0;"><strong>${appointment.treatment}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#888;">Date &amp; Time</td><td style="padding:6px 0;"><strong>${formatDateTime(appointment.scheduledAt)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#888;">Status</td><td style="padding:6px 0;"><strong>${appointment.status}</strong></td></tr>
      ${appointment.notes ? `<tr><td style="padding:6px 0;color:#888;">Notes</td><td style="padding:6px 0;">${appointment.notes}</td></tr>` : ''}
    </table>`;
}

function consultationDetailsHtml(consultation) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:24px;color:#444;">
      <tr><td style="padding:6px 0;color:#888;width:120px;">Name</td><td style="padding:6px 0;"><strong>${consultation.name}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#888;">Email</td><td style="padding:6px 0;">${consultation.email}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Phone</td><td style="padding:6px 0;">${consultation.phone}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Treatment</td><td style="padding:6px 0;"><strong>${consultation.treatment}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#888;">Preferred Date</td><td style="padding:6px 0;">${consultation.preferredDate || 'Not specified'}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Preferred Time</td><td style="padding:6px 0;">${consultation.preferredTime || 'Not specified'}</td></tr>
      ${consultation.message ? `<tr><td style="padding:6px 0;color:#888;">Message</td><td style="padding:6px 0;">${consultation.message}</td></tr>` : ''}
    </table>`;
}

async function getTemplateConfig(slug) {
  const dbTemplate = await prisma.emailTemplate.findUnique({ where: { slug } });
  const defaults = TEMPLATE_DEFAULTS[slug] || TEMPLATE_DEFAULTS['general-reply'];

  if (dbTemplate?.isActive) {
    return {
      subject: dbTemplate.subject,
      headline: dbTemplate.name,
      intro: dbTemplate.bodyHtml,
      categoryLabel: defaults.categoryLabel,
      preheader: defaults.preheader,
      footerNote: defaults.footerNote,
    };
  }

  return defaults;
}

export async function buildBrandedEmail({
  templateSlug = 'general-reply',
  name = 'Valued Client',
  message = '',
  headline,
  intro,
  preheader,
  categoryLabel,
  footerNote,
  ctaText,
  ctaUrl,
}) {
  const config = await getTemplateConfig(templateSlug);
  const base = await loadTemplate('base.html');

  return renderTemplate(base, {
    name,
    title: headline || config.headline,
    headline: headline || config.headline,
    intro: intro || config.intro,
    preheader: preheader || config.preheader,
    category_label: categoryLabel || config.categoryLabel,
    footer_note: footerNote || config.footerNote,
    message: message || '—',
    cta_block: buildCtaBlock(ctaText, ctaUrl),
    year: String(new Date().getFullYear()),
  });
}

export async function sendBrandedEmail({
  to,
  subject,
  templateSlug = 'general-reply',
  name,
  message,
  headline,
  intro,
  ctaText,
  ctaUrl,
  data = {},
}) {
  const config = await getTemplateConfig(templateSlug);
  const html = await buildBrandedEmail({
    templateSlug,
    name: name || data.name || 'Valued Client',
    message,
    headline,
    intro,
    ctaText,
    ctaUrl,
  });

  const transport = createTransport();
  if (!transport) {
    console.log(`[email] SMTP not configured. Would send "${subject || config.subject}" to ${to}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  await transport.sendMail({
    from: getFromAddress(),
    to,
    subject: subject || config.subject,
    html,
  });

  return { sent: true };
}

export async function sendAdminComposedEmail({ to, subject, message, templateSlug = 'admin-reply', name, channel = 'email' }) {
  const result = channel === 'sms' ? await sendSms({ to, message }) : await sendBrandedEmail({ to, subject, templateSlug, name, message });

  await prisma.message.create({
    data: {
      fromEmail: channel === 'sms' ? 'SMS Gateway' : getAdminEmail(),
      toEmail: channel === 'sms' ? to : to,
      subject: channel === 'sms' ? 'SMS to ' + to : (subject || (await getTemplateConfig(templateSlug)).subject),
      body: message,
      channel: channel,
    },
  });

  return result;
}

export async function sendConsultationEmails(consultation) {
  const clientMessage = consultationDetailsHtml(consultation);
  const adminMessage = clientMessage;

  const transport = createTransport();
  const adminEmail = getAdminEmail();

  /* Save to admin inbox */
  await prisma.message.create({
    data: {
      fromEmail: consultation.email,
      toEmail: adminEmail,
      subject: `New Consultation: ${consultation.treatment}`,
      body: `Name: ${consultation.name}\nEmail: ${consultation.email}\nPhone: ${consultation.phone}\nTreatment: ${consultation.treatment}\nPreferred Date: ${consultation.preferredDate || 'Not specified'}\nPreferred Time: ${consultation.preferredTime || 'Not specified'}\nMessage: ${consultation.message || '—'}`,
    },
  }).catch(console.error);

  const mailOptions = [
    {
      to: adminEmail,
      subject: 'New Consultation Request — VENSHA SKIN',
      templateSlug: 'consultation-admin',
      name: 'Admin',
      message: adminMessage,
    },
    {
      to: consultation.email,
      subject: 'Thank You — VENSHA SKIN Consultation Request Received',
      templateSlug: 'booking',
      name: consultation.name,
      message: `<p>We have received your consultation request and will be in touch shortly.</p>${clientMessage}`,
      headline: 'Thank you for reaching out',
      intro: 'Our team will review your inquiry and connect with you to schedule your visit.',
    },
  ];

  if (!transport) {
    console.log('[email] SMTP not configured. Consultation saved; emails skipped.');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  await Promise.all(mailOptions.map((opts) => sendBrandedEmail(opts)));
  return { sent: true };
}

export async function sendMachineInquiryEmails(inquiry, user) {
  const name = `${user.firstName} ${user.lastName}`.trim();
  const details = `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:24px;color:#444;">
      <tr><td style="padding:6px 0;color:#888;width:120px;">Client</td><td style="padding:6px 0;"><strong>${name}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#888;">Business</td><td style="padding:6px 0;">${inquiry.businessName || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Machine</td><td style="padding:6px 0;"><strong>${inquiry.machineModel}</strong> × ${inquiry.quantity}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Email</td><td style="padding:6px 0;">${inquiry.email}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Phone</td><td style="padding:6px 0;">${inquiry.phone}</td></tr>
      ${inquiry.message ? `<tr><td style="padding:6px 0;color:#888;">Message</td><td style="padding:6px 0;">${inquiry.message}</td></tr>` : ''}
    </table>`;

  const transport = createTransport();
  if (!transport) {
    console.log('[email] SMTP not configured. Machine inquiry saved; emails skipped.');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  await Promise.all([
    sendBrandedEmail({
      to: getAdminEmail(),
      templateSlug: 'consultation-admin',
      name: 'Admin',
      subject: 'Machine Purchase Inquiry — VENSHA SKIN',
      message: details,
      headline: 'New machine purchase inquiry',
    }),
    sendBrandedEmail({
      to: inquiry.email,
      templateSlug: 'general-reply',
      name,
      subject: 'Your Machine Inquiry — VENSHA SKIN',
      message: `<p>We have received your machine inquiry and will follow up shortly.</p>${details}`,
      headline: 'Inquiry received',
    }),
  ]);

  return { sent: true };
}

export async function sendWelcomeEmail(user) {
  const name = `${user.firstName} ${user.lastName}`.trim();
  const loginUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/login.html`;

  return sendBrandedEmail({
    to: user.email,
    templateSlug: 'welcome',
    name,
    message: `<p>Your client portal is ready. Sign in to manage appointments and messages.</p>
      <p style="margin-top:16px;"><a href="${loginUrl}" style="color:#B89B5E;">Sign in to your portal →</a></p>`,
    ctaText: 'Sign In',
    ctaUrl: loginUrl,
  });
}

export async function sendAppointmentBookingEmails(appointment, user, { isAdminNotify = true } = {}) {
  const name = `${user.firstName} ${user.lastName}`.trim();
  const details = appointmentDetailsHtml(appointment, user);
  const portalUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/account.html#appointments`;

  const sends = [
    sendBrandedEmail({
      to: user.email,
      templateSlug: 'booking',
      name,
      message: details,
      ctaText: 'View Appointment',
      ctaUrl: portalUrl,
    }),
  ];

  if (isAdminNotify) {
    sends.push(
      sendBrandedEmail({
        to: getAdminEmail(),
        templateSlug: 'booking-admin',
        name: 'Admin',
        message: details,
      })
    );
  }

  const results = await Promise.all(sends);
  return { sent: results.every((r) => r.sent !== false) };
}

export async function sendAppointmentConfirmationEmail(appointment, user) {
  const name = `${user.firstName} ${user.lastName}`.trim();
  return sendBrandedEmail({
    to: user.email,
    templateSlug: 'booking',
    name,
    subject: 'Appointment Confirmed — VENSHA SKIN',
    headline: 'Your appointment is confirmed',
    intro: 'We look forward to welcoming you. Here are your confirmed appointment details.',
    message: appointmentDetailsHtml(appointment, user),
    ctaText: 'Manage Appointment',
    ctaUrl: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/account.html#appointments`,
  });
}

export async function sendAppointmentReminderEmail(appointment, user) {
  const name = `${user.firstName} ${user.lastName}`.trim();
  return sendBrandedEmail({
    to: user.email,
    templateSlug: 'reminder',
    name,
    message: appointmentDetailsHtml(appointment, user),
    ctaText: 'View Details',
    ctaUrl: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/account.html#appointments`,
  });
}

export async function sendAppointmentRescheduleEmail(appointment, user, previousDate) {
  const name = `${user.firstName} ${user.lastName}`.trim();
  return sendBrandedEmail({
    to: user.email,
    templateSlug: 'booking',
    name,
    subject: 'Appointment Rescheduled — VENSHA SKIN',
    headline: 'Your appointment has been rescheduled',
    intro: `Your appointment has been moved from ${formatDateTime(previousDate)} to the new time below.`,
    message: appointmentDetailsHtml(appointment, user),
    ctaText: 'View Appointment',
    ctaUrl: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/account.html#appointments`,
  });
}

export async function sendAppointmentCancellationEmail(appointment, user) {
  const name = `${user.firstName} ${user.lastName}`.trim();
  return sendBrandedEmail({
    to: user.email,
    templateSlug: 'general-reply',
    name,
    subject: 'Appointment Cancelled — VENSHA SKIN',
    headline: 'Your appointment has been cancelled',
    intro: 'We are sorry to see this appointment cancelled. You are always welcome to book again.',
    message: `<p>The following appointment has been cancelled:</p>${appointmentDetailsHtml(appointment, user)}
      <p style="margin-top:16px;">Ready to rebook? Visit our website or reply to this email.</p>`,
    ctaText: 'Book Again',
    ctaUrl: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/#book`,
  });
}

/* ─── Admin broadcast to all clients ─── */

export async function sendBroadcastEmail({ subject, message, templateSlug = 'general-reply', exclude = [] }) {
  const clients = await prisma.user.findMany({
    where: { role: 'CLIENT', id: { notIn: exclude } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (!clients.length) return { sent: false, reason: 'no_recipients' };

  const transport = createTransport();
  if (!transport) return { sent: false, reason: 'smtp_not_configured' };

  let sentCount = 0;
  for (const client of clients) {
    try {
      await sendBrandedEmail({
        to: client.email,
        subject,
        templateSlug,
        name: `${client.firstName} ${client.lastName}`.trim(),
        message,
      });
      sentCount++;
    } catch (err) {
      console.error(`[broadcast] Failed for ${client.email}:`, err.message);
    }
  }

  return { sent: true, total: clients.length, delivered: sentCount };
}

/* ─── SMS Sending (SMTP-to-SMS gateway) ─── */
export async function sendSms({ to, message }) {
  /* Use SMTP-to-SMS gateway if SMTP is configured */
  const transport = createTransport();
  if (!transport) {
    console.log(`[sms] SMTP not configured. Would send SMS to ${to}: ${message.slice(0, 50)}...`);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  /* Detect carrier from number and use appropriate SMS gateway */
  const num = to.replace(/\D/g, '');
  const gateways = [
    `${num}@sms.globe.com.ph`,
    `${num}@mail.smart.com`,
  ];

  try {
    await transport.sendMail({
      from: getFromAddress(),
      to: gateways[0],
      subject: '',
      text: message,
    });
    console.log(`[sms] Sent to ${to} via SMTP gateway`);
    return { sent: true };
  } catch (err) {
    console.error('[sms] Failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

export { TEMPLATE_DEFAULTS, formatDateTime, appointmentDetailsHtml };
