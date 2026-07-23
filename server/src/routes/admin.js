import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import { requireAuth } from '../middleware/auth.js';
import { getSiteSetting } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import {
  sendAdminComposedEmail,
  sendBroadcastEmail,
  TEMPLATE_DEFAULTS,
} from '../services/emailService.js';

const prisma = new PrismaClient();
const router = Router();

/* ─── Multer setup for memory-buffered uploads ─── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg|pdf|mp4|mov/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
});

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'RESCHEDULED'];

function parseScheduledAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

router.get('/dashboard', requireAuth(['ADMIN']), async (_req, res) => {
  const [consultations, machineInquiries, users, comingSoon] = await Promise.all([
    prisma.consultation.count(),
    prisma.machineInquiry.count({ where: { status: 'new' } }),
    prisma.user.count({ where: { role: 'CLIENT' } }),
    getSiteSetting('site_coming_soon', 'false'),
  ]);

  const recentConsultations = await prisma.consultation.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
  });

  const recentMachineInquiries = await prisma.machineInquiry.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
  });

  res.json({
    stats: { consultations, machineInquiries, users },
    comingSoon: comingSoon === 'true',
    recentConsultations,
    recentMachineInquiries,
  });
});

router.get('/settings/coming-soon', requireAuth(['ADMIN']), async (_req, res) => {
  const value = await getSiteSetting('site_coming_soon', 'false');
  res.json({ enabled: value === 'true' });
});

router.put('/settings/coming-soon', requireAuth(['ADMIN']), async (req, res) => {
  const enabled = Boolean(req.body.enabled);

  await prisma.siteSetting.upsert({
    where: { key: 'site_coming_soon' },
    update: { value: enabled ? 'true' : 'false' },
    create: { key: 'site_coming_soon', value: enabled ? 'true' : 'false' },
  });

  res.json({ enabled });
});

/* ─── Machine Inquiries Management ─── */

router.get('/machine-inquiries', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search;

    let where = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    const [inquiries, total] = await Promise.all([
      prisma.machineInquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.machineInquiry.count({ where })
    ]);

    const pages = Math.ceil(total / limit);

    res.json({ inquiries, total, page, pages });
  } catch (error) {
    console.error('Fetch machine inquiries error:', error);
    res.status(500).json({ error: 'Unable to fetch machine inquiries.' });
  }
});

router.get('/machine-inquiries/:id', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const inquiry = await prisma.machineInquiry.findUnique({
      where: { id: req.params.id }
    });

    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found.' });

    const emailHistory = await prisma.message.findMany({
      where: {
        OR: [
          { fromEmail: inquiry.email },
          { toEmail: inquiry.email }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ inquiry, emailHistory });
  } catch (error) {
    console.error('Fetch machine inquiry error:', error);
    res.status(500).json({ error: 'Unable to fetch inquiry details.' });
  }
});

router.put('/machine-inquiries/:id', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    const updateData = {};
    if (status) updateData.status = status;
    
    // Using prisma.$executeRaw or ignoring notes if schema isn't updated. 
    // We will just update status for now since notes wasn't in schema.
    const inquiry = await prisma.machineInquiry.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json(inquiry);
  } catch (error) {
    console.error('Update machine inquiry error:', error);
    res.status(500).json({ error: 'Unable to update inquiry.' });
  }
});

router.post('/machine-inquiries/:id/reply', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required.' });
    }

    const inquiry = await prisma.machineInquiry.findUnique({
      where: { id: req.params.id }
    });

    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found.' });

    await sendAdminComposedEmail({ 
      to: inquiry.email, 
      subject, 
      message, 
      name: inquiry.name || inquiry.businessName || 'Valued Client'
    });

    await prisma.machineInquiry.update({
      where: { id: req.params.id },
      data: { status: 'replied' }
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Machine inquiry reply error:', error);
    res.status(500).json({ error: 'Unable to send reply.' });
  }
});



/* ─── Consultation Management ─── */

router.get('/consultations', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search;

    let where = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    const [consultations, total] = await Promise.all([
      prisma.consultation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.consultation.count({ where })
    ]);

    const pages = Math.ceil(total / limit);

    res.json({ consultations, total, page, pages });
  } catch (error) {
    console.error('Fetch consultations error:', error);
    res.status(500).json({ error: 'Unable to fetch consultations.' });
  }
});

router.get('/consultations/:id', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: req.params.id }
    });

    if (!consultation) return res.status(404).json({ error: 'Consultation not found.' });

    const emailHistory = await prisma.message.findMany({
      where: {
        OR: [
          { fromEmail: consultation.email },
          { toEmail: consultation.email }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ consultation, emailHistory });
  } catch (error) {
    console.error('Fetch consultation error:', error);
    res.status(500).json({ error: 'Unable to fetch consultation details.' });
  }
});

router.patch('/consultations/:id/status', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['new', 'pending', 'replied', 'completed', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const consultation = await prisma.consultation.update({
      where: { id: req.params.id },
      data: { status }
    });

    res.json(consultation);
  } catch (error) {
    console.error('Update consultation status error:', error);
    res.status(500).json({ error: 'Unable to update consultation status.' });
  }
});

router.patch('/consultations/:id/notes', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const { notes, assignedTo } = req.body;
    
    const consultation = await prisma.consultation.update({
      where: { id: req.params.id },
      data: { notes, assignedTo }
    });

    res.json(consultation);
  } catch (error) {
    console.error('Update consultation notes error:', error);
    res.status(500).json({ error: 'Unable to update consultation notes.' });
  }
});

router.post('/consultations/:id/reply', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required.' });
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: req.params.id }
    });

    if (!consultation) return res.status(404).json({ error: 'Consultation not found.' });

    await sendAdminComposedEmail({ 
      to: consultation.email, 
      subject, 
      message, 
      name: consultation.name 
    });

    await prisma.consultation.update({
      where: { id: req.params.id },
      data: { status: 'replied' }
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Consultation reply error:', error);
    res.status(500).json({ error: 'Unable to send reply.' });
  }
});

router.post('/consultations/:id/schedule', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const { subject, message, scheduledDate, scheduledTime } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required.' });
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: req.params.id }
    });

    if (!consultation) return res.status(404).json({ error: 'Consultation not found.' });

    await sendAdminComposedEmail({ 
      to: consultation.email, 
      subject, 
      message, 
      name: consultation.name 
    });

    await prisma.consultation.update({
      where: { id: req.params.id },
      data: { status: 'pending' }
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Consultation schedule error:', error);
    res.status(500).json({ error: 'Unable to send schedule email.' });
  }
});



router.get('/email-templates', requireAuth(['ADMIN']), async (_req, res) => {
  const dbTemplates = await prisma.emailTemplate.findMany({ orderBy: { slug: 'asc' } });
  const slugs = ['booking', 'reminder', 'promotion', 'newsletter', 'general-reply'];

  const templates = slugs.map((slug) => {
    const db = dbTemplates.find((t) => t.slug === slug);
    const defaults = TEMPLATE_DEFAULTS[slug];
    return {
      slug,
      name: db?.name || defaults?.name || slug,
      subject: db?.subject || defaults?.subject || '',
      bodyHtml: db?.bodyHtml || defaults?.intro || '',
      isActive: db?.isActive ?? true,
    };
  });

  res.json({ templates });
});

router.put('/email-templates/:slug', requireAuth(['ADMIN']), async (req, res) => {
  const { name, subject, bodyHtml, isActive = true } = req.body;
  const slug = req.params.slug;

  const template = await prisma.emailTemplate.upsert({
    where: { slug },
    update: { name, subject, bodyHtml, isActive },
    create: { slug, name, subject, bodyHtml, isActive },
  });

  res.json({ template });
});

router.post('/messages/send', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const { to, subject, message, templateSlug = 'general-reply', name } = req.body;

    if (!to?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Recipient and message are required.' });
    }

    const result = await sendAdminComposedEmail({
      to: to.trim(),
      subject: subject?.trim(),
      message: message.trim(),
      templateSlug,
      name: name?.trim() || 'Valued Client',
    });

    res.json({ ok: true, emailSent: result.sent });
  } catch (error) {
    console.error('Admin email send error:', error);
    res.status(500).json({ error: error.message || 'Unable to send email.' });
  }
});

router.get('/clients', requireAuth(['ADMIN']), async (_req, res) => {
  const clients = await prisma.user.findMany({
    where: { role: 'CLIENT' },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    orderBy: { firstName: 'asc' },
  });
  res.json({ clients });
});

/* ─── Enhanced Dashboard ─── */
router.get('/dashboard/enhanced', requireAuth(['ADMIN']), async (_req, res) => {
  const [consultations, machineInquiries, totalUsers, messages] = await Promise.all([
    prisma.consultation.count(),
    prisma.machineInquiry.count({ where: { status: 'new' } }),
    prisma.user.count({ where: { role: 'CLIENT' } }),
    prisma.message.count({ where: { isRead: false } }),
  ]);

  const recentActivity = await Promise.all([
    prisma.consultation.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.machineInquiry.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.message.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
  ]);

  res.json({
    stats: { consultations, machineInquiries, users: totalUsers, messages },
    recentActivity: {
      consultations: recentActivity[0],
      machineInquiries: recentActivity[1],
      messages: recentActivity[2],
    },
    comingSoon: await getSiteSetting('site_coming_soon', 'false') === 'true',
  });
});

/* ─── FAQs CRUD ─── */
router.get('/faqs', requireAuth(['ADMIN']), async (_req, res) => {
  const faqs = await prisma.faq.findMany({ orderBy: { displayOrder: 'asc' } });
  res.json({ faqs });
});

router.post('/faqs', requireAuth(['ADMIN']), async (req, res) => {
  const { question, answer, displayOrder, isActive } = req.body;
  const faq = await prisma.faq.create({
    data: {
      question, answer,
      displayOrder: displayOrder ?? 0,
      isActive: isActive ?? true,
    },
  });
  res.status(201).json({ faq });
});

router.put('/faqs/:id', requireAuth(['ADMIN']), async (req, res) => {
  const { question, answer, displayOrder, isActive } = req.body;
  const faq = await prisma.faq.update({
    where: { id: req.params.id },
    data: { question, answer, displayOrder, isActive },
  });
  res.json({ faq });
});

router.delete('/faqs/:id', requireAuth(['ADMIN']), async (req, res) => {
  await prisma.faq.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/* ─── Testimonials CRUD ─── */
router.get('/testimonials', requireAuth(['ADMIN']), async (_req, res) => {
  const testimonials = await prisma.testimonial.findMany({ orderBy: { displayOrder: 'asc' } });
  res.json({ testimonials });
});

router.post('/testimonials', requireAuth(['ADMIN']), async (req, res) => {
  const { author, quote, imageUrl, featured, displayOrder, isActive } = req.body;
  const testimonial = await prisma.testimonial.create({
    data: { author, quote, imageUrl, featured: featured ?? false, displayOrder: displayOrder ?? 0, isActive: isActive ?? true },
  });
  res.status(201).json({ testimonial });
});

router.put('/testimonials/:id', requireAuth(['ADMIN']), async (req, res) => {
  const { author, quote, imageUrl, featured, displayOrder, isActive } = req.body;
  const testimonial = await prisma.testimonial.update({
    where: { id: req.params.id },
    data: { author, quote, imageUrl, featured, displayOrder, isActive },
  });
  res.json({ testimonial });
});

router.delete('/testimonials/:id', requireAuth(['ADMIN']), async (req, res) => {
  await prisma.testimonial.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/* ─── Gallery CRUD ─── */
router.get('/gallery', requireAuth(['ADMIN']), async (_req, res) => {
  const items = await prisma.galleryItem.findMany({ orderBy: { displayOrder: 'asc' } });
  res.json({ items });
});

router.post('/gallery', requireAuth(['ADMIN']), async (req, res) => {
  const { title, imageUrl, caption, category, displayOrder, isActive } = req.body;
  const item = await prisma.galleryItem.create({
    data: { title, imageUrl, caption, category, displayOrder: displayOrder ?? 0, isActive: isActive ?? true },
  });
  res.status(201).json({ item });
});

router.put('/gallery/:id', requireAuth(['ADMIN']), async (req, res) => {
  const { title, imageUrl, caption, category, displayOrder, isActive } = req.body;
  const item = await prisma.galleryItem.update({
    where: { id: req.params.id },
    data: { title, imageUrl, caption, category, displayOrder, isActive },
  });
  res.json({ item });
});

router.delete('/gallery/:id', requireAuth(['ADMIN']), async (req, res) => {
  await prisma.galleryItem.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/* ─── Research CRUD ─── */
router.get('/research', requireAuth(['ADMIN']), async (_req, res) => {
  const items = await prisma.research.findMany({ orderBy: { displayOrder: 'asc' } });
  res.json({ items });
});

router.post('/research', requireAuth(['ADMIN']), async (req, res) => {
  const { title, summary, content, imageUrl, category, author, source, displayOrder, isActive } = req.body;
  const item = await prisma.research.create({
    data: { title, summary, content, imageUrl, category, author, source, displayOrder: displayOrder ?? 0, isActive: isActive ?? true },
  });
  res.status(201).json({ item });
});

router.put('/research/:id', requireAuth(['ADMIN']), async (req, res) => {
  const { title, summary, content, imageUrl, category, author, source, displayOrder, isActive } = req.body;
  const item = await prisma.research.update({
    where: { id: req.params.id },
    data: { title, summary, content, imageUrl, category, author, source, displayOrder, isActive },
  });
  res.json({ item });
});

router.delete('/research/:id', requireAuth(['ADMIN']), async (req, res) => {
  await prisma.research.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/* ─── Promotions CRUD ─── */
router.get('/promotions', requireAuth(['ADMIN']), async (_req, res) => {
  const promotions = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ promotions });
});

router.post('/promotions', requireAuth(['ADMIN']), async (req, res) => {
  const { title, description, bannerImageUrl, discountPercent, targetMembership, startDate, endDate, status, displayLocation } = req.body;
  const promotion = await prisma.promotion.create({
    data: {
      title, description, bannerImageUrl, discountPercent, targetMembership,
      startDate: new Date(startDate), endDate: new Date(endDate),
      status: status || 'DRAFT', displayLocation,
    },
  });
  res.status(201).json({ promotion });
});

router.put('/promotions/:id', requireAuth(['ADMIN']), async (req, res) => {
  const { title, description, bannerImageUrl, discountPercent, targetMembership, startDate, endDate, status, displayLocation } = req.body;
  const data = { title, description, bannerImageUrl, discountPercent, targetMembership, status, displayLocation };
  if (startDate) data.startDate = new Date(startDate);
  if (endDate) data.endDate = new Date(endDate);
  const promotion = await prisma.promotion.update({ where: { id: req.params.id }, data });
  res.json({ promotion });
});

router.delete('/promotions/:id', requireAuth(['ADMIN']), async (req, res) => {
  await prisma.promotion.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/* ─── Users (expanded) ─── */
router.get('/users', requireAuth(['ADMIN']), async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { appointments: true, consultations: true, messages: true } },
    },
  });
  res.json({ users });
});

router.get('/users/:id', requireAuth(['ADMIN']), async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { appointments: true, consultations: true, messages: true } },
      appointments: { orderBy: { scheduledAt: 'desc' }, take: 10 },
    },
  });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
});

router.put('/users/:id', requireAuth(['ADMIN']), async (req, res) => {
  const { firstName, lastName, email, phone, role } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { firstName, lastName, email, phone, role },
  });
  res.json({ user });
});

router.delete('/users/:id', requireAuth(['ADMIN']), async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/* ─── Notifications CRUD ─── */
router.get('/notifications', requireAuth(['ADMIN']), async (_req, res) => {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  res.json({ notifications });
});

router.post('/notifications/send', requireAuth(['ADMIN']), async (req, res) => {
  const { userId, title, body, channel } = req.body;
  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'Title and body are required.' });
  }
  if (userId === 'ALL' || !userId) {
    const users = await prisma.user.findMany({ where: { role: 'CLIENT' }, select: { id: true } });
    await prisma.notification.createMany({
      data: users.map(u => ({ userId: u.id, title, body, channel: channel || 'WEBSITE' })),
    });
    return res.status(201).json({ ok: true, count: users.length });
  }
  const notification = await prisma.notification.create({
    data: { userId, title, body, channel: channel || 'WEBSITE' },
  });
  res.status(201).json({ notification });
});

router.patch('/notifications/:id/read', requireAuth(['ADMIN']), async (req, res) => {
  const notification = await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
  res.json({ notification });
});

router.delete('/notifications/:id', requireAuth(['ADMIN']), async (req, res) => {
  await prisma.notification.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/* ─── Website Content (CMS) ─── */
router.get('/content', requireAuth(['ADMIN']), async (_req, res) => {
  const content = await prisma.websiteContent.findMany({ orderBy: [{ section: 'asc' }, { key: 'asc' }] });
  res.json({ content });
});

router.put('/content/:key', requireAuth(['ADMIN']), async (req, res) => {
  const { value, section, type } = req.body;
  const item = await prisma.websiteContent.upsert({
    where: { key: req.params.key },
    update: { value, section, type },
    create: { key: req.params.key, value, section: section || 'general', type: type || 'text' },
  });
  res.json({ item });
});

router.post('/content', requireAuth(['ADMIN']), async (req, res) => {
  const { key, section, value, type } = req.body;
  const item = await prisma.websiteContent.create({ data: { key, section, value, type: type || 'text' } });
  res.status(201).json({ item });
});

router.delete('/content/:key', requireAuth(['ADMIN']), async (req, res) => {
  await prisma.websiteContent.delete({ where: { key: req.params.key } });
  res.json({ ok: true });
});

/* ─── Media Library ─── */
router.get('/media', requireAuth(['ADMIN']), async (_req, res) => {
  const media = await prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ media });
});

router.post('/media/upload', requireAuth(['ADMIN']), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  
  const ext = path.extname(req.file.originalname);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  
  const { data, error } = await supabaseAdmin.storage
    .from('media')
    .upload(filename, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });
  
  if (error) {
    console.error('Supabase storage upload error:', error);
    return res.status(500).json({ error: 'Upload failed.' });
  }
  
  const { data: urlData } = supabaseAdmin.storage.from('media').getPublicUrl(filename);
  const url = urlData.publicUrl;
  
  const asset = await prisma.mediaAsset.create({
    data: { filename: req.file.originalname, url, mimeType: req.file.mimetype, altText: req.body.altText || null },
  });
  res.status(201).json({ asset });
});

router.put('/media/:id', requireAuth(['ADMIN']), async (req, res) => {
  const { altText } = req.body;
  const asset = await prisma.mediaAsset.update({ where: { id: req.params.id }, data: { altText } });
  res.json({ asset });
});

router.delete('/media/:id', requireAuth(['ADMIN']), async (req, res) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
  if (asset) {
    // Extract filename from Supabase URL
    const urlParts = asset.url.split('/');
    const storageFilename = urlParts[urlParts.length - 1];
    await supabaseAdmin.storage.from('media').remove([storageFilename]);
    await prisma.mediaAsset.delete({ where: { id: req.params.id } });
  }
  res.json({ ok: true });
});

/* ─── Messages (Inbox) ─── */
router.get('/messages', requireAuth(['ADMIN']), async (_req, res) => {
  const messages = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  res.json({ messages });
});

router.get('/messages/:id', requireAuth(['ADMIN']), async (req, res) => {
  const message = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  if (!message.isRead) {
    await prisma.message.update({ where: { id: message.id }, data: { isRead: true } });
  }
  res.json({ message: { ...message, isRead: true } });
});

router.patch('/messages/:id/star', requireAuth(['ADMIN']), async (req, res) => {
  const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
  if (!msg) return res.status(404).json({ error: 'Message not found.' });
  const message = await prisma.message.update({ where: { id: req.params.id }, data: { isStarred: !msg.isStarred } });
  res.json({ message });
});

router.patch('/messages/:id/archive', requireAuth(['ADMIN']), async (req, res) => {
  const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
  if (!msg) return res.status(404).json({ error: 'Message not found.' });
  const message = await prisma.message.update({ where: { id: req.params.id }, data: { isArchived: !msg.isArchived } });
  res.json({ message });
});

router.delete('/messages/:id', requireAuth(['ADMIN']), async (req, res) => {
  await prisma.message.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/* ─── Settings ─── */
router.get('/settings', requireAuth(['ADMIN']), async (_req, res) => {
  const settings = await prisma.siteSetting.findMany({ orderBy: { key: 'asc' } });
  res.json({ settings });
});

router.put('/settings/:key', requireAuth(['ADMIN']), async (req, res) => {
  const { value } = req.body;
  const setting = await prisma.siteSetting.upsert({
    where: { key: req.params.key },
    update: { value },
    create: { key: req.params.key, value },
  });
  res.json({ setting });
});

/* ─── Analytics ─── */
router.get('/analytics', requireAuth(['ADMIN']), async (_req, res) => {
  const [totalEvents, recentEvents, topPages] = await Promise.all([
    prisma.analyticsEvent.count(),
    prisma.analyticsEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.analyticsEvent.groupBy({ by: ['page'], _count: true, orderBy: { _count: { page: 'desc' } }, take: 10 }),
  ]);
  res.json({ totalEvents, recentEvents, topPages });
});

/* ─── Broadcast email to all clients ─── */
router.post('/messages/broadcast', requireAuth(['ADMIN']), async (req, res) => {
  try {
    const { subject, message, templateSlug = 'general-reply' } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const result = await sendBroadcastEmail({
      subject: subject?.trim(),
      message: message.trim(),
      templateSlug,
    });

    if (!result.sent) {
      return res.status(400).json({ error: result.reason === 'no_recipients' ? 'No clients found.' : 'SMTP not configured.' });
    }

    res.json({ ok: true, total: result.total, delivered: result.delivered });
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: error.message || 'Unable to send broadcast.' });
  }
});

export default router;
