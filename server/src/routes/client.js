import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = Router();

/* ─── Dashboard stats & activity ─── */
router.get('/dashboard', requireAuth(['CLIENT', 'ADMIN']), async (req, res) => {
  try {
    const userId = req.user.id;

    const [appointments, consultations, messages, notifications] = await Promise.all([
      prisma.appointment.findMany({
        where: { userId },
        orderBy: { scheduledAt: 'desc' },
      }),
      prisma.consultation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.message.findMany({
        where: { toEmail: req.user.email, isArchived: false },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const active = ['PENDING', 'CONFIRMED', 'RESCHEDULED'];
    const now = new Date();
    const upcomingAppts = appointments.filter(
      (a) => active.includes(a.status) && new Date(a.scheduledAt) > now
    ).length;
    const completedAppts = appointments.filter((a) => a.status === 'COMPLETED').length;
    const unreadMessages = messages.filter((m) => !m.isRead).length;
    const unreadNotifications = notifications.filter((n) => !n.isRead).length;

    const recentActivity = [
      ...appointments.slice(0, 5).map((a) => ({
        type: 'appointment',
        title: a.treatment,
        status: a.status,
        date: a.scheduledAt,
        id: a.id,
      })),
      ...consultations.slice(0, 3).map((c) => ({
        type: 'consultation',
        title: c.treatment,
        status: c.status,
        date: c.createdAt,
        id: c.id,
      })),
      ...messages.slice(0, 3).map((m) => ({
        type: 'message',
        title: m.subject,
        status: m.isRead ? 'read' : 'unread',
        date: m.createdAt,
        id: m.id,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    res.json({
      stats: {
        upcomingAppointments: upcomingAppts,
        completedAppointments: completedAppts,
        totalAppointments: appointments.length,
        consultations: consultations.length,
        unreadMessages,
        unreadNotifications,
      },
      recentActivity,
      upcomingAppointment: appointments
        .filter((a) => active.includes(a.status) && new Date(a.scheduledAt) > now)
        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0] || null,
    });
  } catch (error) {
    console.error('Client dashboard error:', error);
    res.status(500).json({ error: 'Unable to load dashboard.' });
  }
});

/* ─── My messages ─── */
router.get('/messages', requireAuth(['CLIENT', 'ADMIN']), async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { toEmail: req.user.email, isArchived: false },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'Unable to load messages.' });
  }
});

/* ─── Mark message read ─── */
router.patch('/messages/:id/read', requireAuth(['CLIENT', 'ADMIN']), async (req, res) => {
  try {
    const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!msg) return res.status(404).json({ error: 'Message not found.' });
    if (msg.toEmail !== req.user.email && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    await prisma.message.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Unable to update message.' });
  }
});

/* ─── My notifications ─── */
router.get('/notifications', requireAuth(['CLIENT', 'ADMIN']), async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: 'Unable to load notifications.' });
  }
});

/* ─── Mark notification read ─── */
router.patch('/notifications/:id/read', requireAuth(['CLIENT', 'ADMIN']), async (req, res) => {
  try {
    const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notif) return res.status(404).json({ error: 'Notification not found.' });
    if (notif.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied.' });
    }
    await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Unable to update notification.' });
  }
});

/* ─── Active promotions ─── */
router.get('/promotions', async (_req, res) => {
  try {
    const now = new Date();
    const promotions = await prisma.promotion.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ promotions });
  } catch (error) {
    res.status(500).json({ error: 'Unable to load promotions.' });
  }
});

export default router;
