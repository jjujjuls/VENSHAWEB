import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { sendWelcomeEmail } from '../services/emailService.js';

const prisma = new PrismaClient();
const router = Router();

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    memberSince: user.memberSince,
  };
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) return res.status(409).json({ error: 'Email already registered.' });

    const classic = await prisma.membershipLevel.findFirst({ where: { slug: 'classic' } });
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone?.trim() || null,
        role: 'CLIENT',
        membershipProgress: classic
          ? { create: { membershipLevelId: classic.id, sessionsCompleted: 0 } }
          : undefined,
      },
    });

    sendWelcomeEmail(user).catch(console.error);

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email?.toLowerCase().trim() } });
    if (!user?.passwordHash) return res.status(401).json({ error: 'Invalid credentials.' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials.' });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

router.get('/me', requireAuth(), async (req, res) => {
  const membership = await prisma.membershipProgress.findUnique({
    where: { userId: req.user.id },
    include: { membershipLevel: true },
  });

  res.json({
    user: publicUser(req.user),
    membership: membership
      ? {
          level: membership.membershipLevel.name,
          sessionsCompleted: membership.sessionsCompleted,
          minConsultations: membership.membershipLevel.minConsultations,
        }
      : null,
  });
});

export default router;
