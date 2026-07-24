import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendMachineInquiryEmails } from '../services/emailService.js';

const prisma = new PrismaClient();
const router = Router();

/* ─── Public machine inquiry submission ─── */
router.post('/', async (req, res) => {
  try {
    const { name, companyName, businessName, businessType, purchaseTimeline, phone, email, machineModel, quantity, intendedUse, message } = req.body;

    if (!phone?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Phone and email are required.' });
    }

    const inquiry = await prisma.machineInquiry.create({
      data: {
        name: name?.trim() || null,
        companyName: companyName?.trim() || null,
        businessName: businessName?.trim() || null,
        businessType: businessType?.trim() || null,
        purchaseTimeline: purchaseTimeline?.trim() || null,
        phone: phone.trim(),
        email: email.trim(),
        machineModel: machineModel?.trim() || 'Contour Pro Max',
        quantity: Math.max(1, Number(quantity) || 1),
        intendedUse: intendedUse?.trim() || null,
        message: message?.trim() || null,
      },
    });

    /* Save to admin inbox */
    const adminEmail = process.env.ADMIN_EMAIL || 'venshaskin@gmail.com';
    await prisma.message.create({
      data: {
        fromEmail: email.trim(),
        toEmail: adminEmail,
        subject: `Machine Purchase Inquiry: ${name?.trim() || 'Unknown'}`,
        body: `Name: ${name?.trim() || '—'}\nEmail: ${email.trim()}\nPhone: ${phone.trim()}\nCompany: ${companyName?.trim() || '—'}\nBusiness: ${businessName?.trim() || '—'}\nBusiness Type: ${businessType?.trim() || '—'}\nTimeline: ${purchaseTimeline?.trim() || '—'}\nMessage: ${message?.trim() || '—'}`,
      },
    }).catch(err => console.error('Machine inquiry inbox save error:', err));

    /* Send email notification */
    try {
      await sendMachineInquiryEmails(inquiry, { firstName: name || 'Guest', lastName: '', email: inquiry.email });
    } catch (emailErr) {
      console.error('Machine inquiry email error:', emailErr.message || emailErr);
    }

    res.status(201).json({ ok: true, inquiry });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to submit machine inquiry.' });
  }
});

export default router;
