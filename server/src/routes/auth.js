import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';

const prisma = new PrismaClient();
const router = Router();

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

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const user = await prisma.user.create({
      data: {
        id: authData.user.id,
        email: email.toLowerCase().trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone?.trim() || null,
        role: 'CLIENT',
      },
    });

    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    });

    if (signInError) {
      return res.status(401).json({ error: 'Login failed after registration.' });
    }

    res.status(201).json({ token: signInData.session.access_token, user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ 
      email: email?.toLowerCase().trim(), 
      password 
    });

    if (error || !data.session) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = await prisma.user.findUnique({ where: { id: data.user.id } });
    if (!user) {
      return res.status(401).json({ error: 'User record not found.' });
    }

    /* If coming soon is enabled, only ADMIN can log in */
    const comingSoon = await prisma.siteSetting.findUnique({ where: { key: 'site_coming_soon' } });
    if (comingSoon?.value === 'true' && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Site is in maintenance mode. Please check back later.' });
    }

    res.json({ token: data.session.access_token, user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

router.get('/me', requireAuth(), async (req, res) => {
  res.json({
    user: publicUser(req.user),
  });
});

/* ─── Update profile ─── */
router.put('/profile', requireAuth(), async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const data = {};
    if (firstName?.trim()) data.firstName = firstName.trim();
    if (lastName?.trim()) data.lastName = lastName.trim();
    if (phone !== undefined) data.phone = phone?.trim() || null;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Unable to update profile.' });
  }
});

/* ─── Change password ─── */
router.put('/password', requireAuth(), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: req.user.email,
      password: currentPassword
    });

    if (signInError) return res.status(401).json({ error: 'Current password is incorrect.' });

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      password: newPassword
    });

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update password.' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Unable to change password.' });
  }
});

export default router;
