import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendMachineInquiryEmails } from '../services/emailService.js';

const prisma = new PrismaClient();
const router = Router();

/* ─── Public machine inquiry submission ─── */
router.post('/', async (req, res) => {
  try {
    const { name, businessName, phone, email, machineModel, quantity, intendedUse, message } = req.body;

    if (!phone?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Phone and email are required.' });
    }

    const inquiry = await prisma.machineInquiry.create({
      data: {
        name: name?.trim() || null,
        businessName: businessName?.trim() || null,
        phone: phone.trim(),
        email: email.trim(),
        machineModel: machineModel?.trim() || 'Megashape Pro',
        quantity: Math.max(1, Number(quantity) || 1),
        intendedUse: intendedUse?.trim() || null,
        message: message?.trim() || null,
      },
    });

    /* Send email notification (no user associated) */
    try {
      await sendMachineInquiryEmails(inquiry, { firstName: name || 'Guest', lastName: '', email: inquiry.email });
    } catch (emailErr) {
      console.error('Machine inquiry email error:', emailErr);
    }

    res.status(201).json({ ok: true, inquiry });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to submit machine inquiry.' });
  }
});

export default router;
