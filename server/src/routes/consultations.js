import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendConsultationEmails } from '../services/emailService.js';

const prisma = new PrismaClient();
const router = Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, treatment, date, time, message } = req.body;

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !treatment?.trim()) {
      return res.status(400).json({ error: 'Name, email, phone, and treatment are required.' });
    }

    const consultation = await prisma.consultation.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        treatment: treatment.trim(),
        preferredDate: date || null,
        preferredTime: time || null,
        message: message?.trim() || null,
      },
    });

    await prisma.analyticsEvent.create({
      data: {
        eventType: 'consultation_submitted',
        page: '/#book',
        metadata: JSON.stringify({ treatment: consultation.treatment }),
      },
    });

    const emailResult = await sendConsultationEmails(consultation);

    res.status(201).json({
      ok: true,
      id: consultation.id,
      emailSent: emailResult.sent,
    });
  } catch (error) {
    console.error('Consultation error:', error);
    res.status(500).json({ error: 'Unable to submit consultation request.' });
  }
});

router.get('/', async (_req, res) => {
  res.status(403).json({ error: 'Admin access required.' });
});

export default router;
