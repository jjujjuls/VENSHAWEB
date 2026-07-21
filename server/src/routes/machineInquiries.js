import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { sendMachineInquiryEmails } from '../services/emailService.js';

const prisma = new PrismaClient();
const router = Router();

router.post('/', requireAuth(['CLIENT', 'ADMIN']), async (req, res) => {
  try {
    const { businessName, phone, email, machineModel, quantity, intendedUse, message } = req.body;

    if (!phone?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Phone and email are required.' });
    }

    const inquiry = await prisma.machineInquiry.create({
      data: {
        userId: req.user.id,
        businessName: businessName?.trim() || null,
        phone: phone.trim(),
        email: email.trim(),
        machineModel: machineModel?.trim() || 'Megashape Pro',
        quantity: Math.max(1, Number(quantity) || 1),
        intendedUse: intendedUse?.trim() || null,
        message: message?.trim() || null,
      },
    });

    await sendMachineInquiryEmails(inquiry, req.user);
    res.status(201).json({ ok: true, inquiry });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to submit machine inquiry.' });
  }
});

router.get('/mine', requireAuth(['CLIENT', 'ADMIN']), async (req, res) => {
  const inquiries = await prisma.machineInquiry.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ inquiries });
});

export default router;
