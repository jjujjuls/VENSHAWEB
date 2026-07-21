import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { getSiteSetting } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = Router();

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
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
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

router.patch('/machine-inquiries/:id', requireAuth(['ADMIN']), async (req, res) => {
  const { status } = req.body;
  const inquiry = await prisma.machineInquiry.update({
    where: { id: req.params.id },
    data: { status: status || 'reviewed' },
  });
  res.json({ inquiry });
});

export default router;
